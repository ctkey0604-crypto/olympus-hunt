// Olympus Hunt server. Serves the game from /public and keeps player accounts and saves in a D1 database.
// Every route lives under /api/. Anything else is a file from /public.
// Multiplayer rooms (bottom of this file): a Room Durable Object per room relays messages between the players' browsers
// (the host's browser runs the hunt), and one Lobby object keeps the public room list.
import { DurableObject } from 'cloudflare:workers';

const ITER = 100000;                 // Cloudflare's maximum for PBKDF2. Stored per user, so it can change later.
const SESSION_DAYS = 60;
const MAX_SAVE_BYTES = 200 * 1024;
const MAX_FAILS = 8, LOCK_MINUTES = 15;
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      await ensureTables(env);
      return await route(req, env, url);
    } catch (e) {
      return json({ error: 'Server error: ' + (e && e.message ? e.message : String(e)) }, 500);
    }
  },
};

/* ---------- database ---------- */
let tablesReady = null;
function ensureTables(env) {
  if (!tablesReady) {
    tablesReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
        name TEXT PRIMARY KEY, display TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, iter INTEGER NOT NULL,
        created INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS saves (name TEXT NOT NULL, slot INTEGER NOT NULL, data TEXT NOT NULL, saved_at INTEGER NOT NULL, PRIMARY KEY (name, slot))`),
    ]).catch(e => { tablesReady = null; throw e; });
  }
  return tablesReady;
}

/* ---------- routes ---------- */
async function route(req, env, url) {
  const path = url.pathname, method = req.method;
  if (path === '/api/health') return json({ ok: true, game: 'olympus-hunt' });
  if (path === '/api/register' && method === 'POST') return register(req, env);
  if (path === '/api/login' && method === 'POST') return login(req, env);
  if (path.startsWith('/api/rooms')) { const r = await roomsPublic(req, env, path, method); if (r) return r; }

  const user = await authed(req, env);
  if (!user) return json({ error: 'You are signed out. Sign in again.' }, 401);
  if (path === '/api/me' && method === 'GET') return json({ name: user.display });
  if (path.startsWith('/api/rooms')) { const r = await roomsAuthed(req, env, path, method, user); if (r) return r; }
  if (path === '/api/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(user.tokenHash).run();
    return json({ ok: true });
  }
  if (path === '/api/saves' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT slot, data, saved_at FROM saves WHERE name = ?').bind(user.name).all();
    const saves = {};
    for (const r of results) saves[r.slot] = { save: JSON.parse(r.data), savedAt: r.saved_at };
    return json({ saves });
  }
  const m = path.match(/^\/api\/saves\/([1-3])$/);
  if (m) {
    const slot = Number(m[1]);
    if (method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_SAVE_BYTES) return json({ error: 'That save is too big.' }, 413);
      let body; try { body = JSON.parse(text); } catch { return json({ error: 'Bad save data.' }, 400); }
      const save = body && body.save;
      if (!save || typeof save !== 'object' || Array.isArray(save)) return json({ error: 'Bad save data.' }, 400);
      const now = Date.now(), old = await env.DB.prepare('SELECT data FROM saves WHERE name = ? AND slot = ?').bind(user.name, slot).first();
      let prev = null; try { prev = old ? JSON.parse(old.data) : null; } catch {}
      const why = checkSave(save, prev, now);
      if (why) return json({ error: `The server couldn’t store this save: ${why}.`, check: true }, 422);
      save._at = now;                                              // when the server took it (the next check measures from here)
      const savedAt = Number.isFinite(save.savedAt) ? Math.floor(save.savedAt) : Date.now();
      // Keep whichever copy is newer, so an old tab can't overwrite newer progress.
      const r = await env.DB.prepare(`INSERT INTO saves (name, slot, data, saved_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(name, slot) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at WHERE excluded.saved_at >= saves.saved_at`)
        .bind(user.name, slot, JSON.stringify(save), savedAt).run();
      return json({ ok: true, kept: r.meta.changes > 0 });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM saves WHERE name = ? AND slot = ?').bind(user.name, slot).run();
      return json({ ok: true });
    }
  }
  return json({ error: 'Not found.' }, 404);
}

async function register(req, env) {
  const { name, password } = await readJson(req);
  if (typeof name !== 'string' || !NAME_RE.test(name)) return json({ error: 'Names are 3 to 20 letters, numbers or underscores.' }, 400);
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) return json({ error: 'Passwords need at least 6 characters.' }, 400);
  const key = name.toLowerCase();
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE name = ?').bind(key).first();
  if (exists) return json({ error: 'That name is taken.' }, 409);
  const salt = randomHex(16), hash = await pbkdf2(password, salt, ITER);
  try {
    await env.DB.prepare('INSERT INTO users (name, display, salt, hash, iter, created) VALUES (?, ?, ?, ?, ?, ?)').bind(key, name, salt, hash, ITER, Date.now()).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return json({ error: 'That name is taken.' }, 409);
    throw e;
  }
  return json({ name, token: await newSession(env, key) });
}

async function login(req, env) {
  const { name, password } = await readJson(req);
  if (typeof name !== 'string' || typeof password !== 'string') return json({ error: 'Enter your name and password.' }, 400);
  const key = name.toLowerCase(), now = Date.now();
  const u = await env.DB.prepare('SELECT * FROM users WHERE name = ?').bind(key).first();
  if (!u) { await pbkdf2(password, 'x'.repeat(32), ITER); return json({ error: 'Wrong name or password.' }, 401); }   // same work either way
  if (u.locked_until > now) return json({ error: `Too many wrong tries. Wait ${Math.ceil((u.locked_until - now) / 60000)} min and try again.` }, 429);
  const hash = await pbkdf2(password, u.salt, u.iter);
  if (!safeEqual(hash, u.hash)) {
    const fails = u.fails + 1, lock = fails >= MAX_FAILS;
    await env.DB.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE name = ?').bind(lock ? 0 : fails, lock ? now + LOCK_MINUTES * 60000 : 0, key).run();
    return json({ error: 'Wrong name or password.' }, 401);
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET fails = 0, locked_until = 0 WHERE name = ?').bind(key),
    env.DB.prepare('DELETE FROM sessions WHERE name = ? AND expires < ?').bind(key, now),
  ]);
  return json({ name: u.display, token: await newSession(env, key) });
}

async function authed(req, env) {
  const h = req.headers.get('Authorization') || '', token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token || token.length > 100) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT s.name, s.expires, u.display FROM sessions s JOIN users u ON u.name = s.name WHERE s.token = ?`).bind(tokenHash).first();
  if (!row || row.expires < Date.now()) return null;
  return { name: row.name, display: row.display, tokenHash };
}
async function newSession(env, name) {
  const token = randomB64(32);
  await env.DB.prepare('INSERT INTO sessions (token, name, expires) VALUES (?, ?, ?)').bind(await sha256(token), name, Date.now() + SESSION_DAYS * 86400000).run();
  return token;
}

/* ---------- helpers ---------- */
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
async function readJson(req) { try { return await req.json(); } catch { return {}; } }
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
function randomHex(n) { return hex(crypto.getRandomValues(new Uint8Array(n))); }
function randomB64(n) { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256));
}
function safeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* ---------- save checks ---------- */
// The game runs in the player's browser, so a save can be edited before it's sent. These checks turn away saves that
// can't come from real play. They're generous on purpose: a real player's save must never be refused.
const SAVE_RATE = 1200;     // drachmae one second of play may earn: about 3x the best real rate (a fast Typhon kill)
const SAVE_SLACK = 150000;  // on top of that per save: hidden caches, a long hunt's pay landing at once, rounding
const PLAY_SLACK = 300;     // seconds of play a save may claim beyond the real time since the server's last copy
const idRank = id => typeof id !== 'string' ? 0 : id.startsWith('gr_') ? 2 : id.startsWith('hr_') ? 1 : 0;
const TYPHON_GEAR = new Set(['typhon_fang', 'typhonic']);      // God Rank gear without the gr_ prefix, forged from his heart
const RANK_UP_MIN = 8;      // hunts cleared on a rank before the next one can open (the real rule is every god and Titan: 25)
const CLEAR_SECS = 6;       // seconds of play a cleared hunt takes at the very least (real hunts take minutes)
const CLEAR_SLACK = 150;    // hunts a save may have cleared beyond that: saves from before play time was counted
function checkSave(s, prev, now) {
  const okNum = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}, arr = v => Array.isArray(v) ? v : [];
  if (!okNum(s.money, 1e12) || (s.playtime !== undefined && !okNum(s.playtime, 1e8))) return 'it has numbers the game can’t make';
  const rank = s.rank === undefined ? 0 : s.rank;
  if (![0, 1, 2].includes(rank)) return 'it has a rank that doesn’t exist';
  if (Object.values(obj(s.inv)).some(v => !okNum(v, 1e6)) || Object.values(obj(s.potions)).some(v => !okNum(v, 99)) || Object.values(obj(s.refine)).some(v => !okNum(v, 10)))
    return 'it holds more of something than the game allows';
  // nothing from a rank you haven't reached
  const cleared = obj(s.cleared);
  const ids = [...arr(s.weapons), ...arr(s.shields), ...arr(s.pieces).map(p => String(p).split(':')[0]), ...Object.values(obj(s.equip)), s.weapon, s.shield,
               ...Object.keys(obj(s.inv)), ...Object.keys(cleared), ...Object.keys(obj(s.refine))];
  if (ids.some(id => idRank(id) > rank)) return 'it has gear or hunts from a rank it hasn’t reached';
  if (!cleared.gr_typhon_hunt && ids.some(id => TYPHON_GEAR.has(id))) return 'it has Typhon’s gear without Typhon slain';
  // a rank opens only after hunting through the one below, and its parts and gear come from its own hunts
  const onRank = r => Object.keys(cleared).filter(id => cleared[id] > 0 && idRank(id) === r).length;
  if (rank >= 1 && onRank(0) < RANK_UP_MIN) return 'it has High Rank without the Normal Rank hunts';
  if (rank >= 2 && onRank(1) < RANK_UP_MIN) return 'it has God Rank without the High Rank hunts';
  const owned = [...arr(s.weapons), ...arr(s.shields), ...arr(s.pieces).map(p => String(p).split(':')[0]), ...Object.values(obj(s.equip)), s.weapon, s.shield,
                 ...Object.keys(obj(s.inv)).filter(k => s.inv[k] > 0), ...Object.keys(obj(s.refine))];
  for (const r of [1, 2]) if (!onRank(r) && owned.some(id => idRank(id) === r)) return 'it has parts or gear from a rank it hasn’t hunted on';
  if (cleared.gr_typhon_hunt && onRank(2) < RANK_UP_MIN) return 'it has Typhon slain without the God Rank hunts';
  const en = obj(s.endless);
  if ((en.best > 0 || en.last > 0) && !cleared.gr_typhon_hunt) return 'it has an Endless Hunt record before Typhon was slain';
  // what you wear and hold has to be yours
  const pieces = new Set(arr(s.pieces));
  if (Object.entries(obj(s.equip)).some(([sl, set]) => set !== 'traveler' && !pieces.has(set + ':' + sl)) ||
      (s.weapon && s.weapon !== 'bronze_sword' && !arr(s.weapons).includes(s.weapon)) || (s.shield && !arr(s.shields).includes(s.shield)))
    return 'it wears or holds gear it doesn’t own';
  // every hunt takes real play time
  const clearsOf = c => Object.values(obj(c)).reduce((n, v) => n + (typeof v === 'number' && v > 0 ? Math.floor(v) : 0), 0);
  const play = s.playtime || 0, clears = clearsOf(cleared);
  if (clears > play / CLEAR_SECS + CLEAR_SLACK) return 'it has more hunts cleared than its play time allows';
  // progress since the server's last copy of this same game (a new game in the slot starts fresh)
  const p = prev && prev.createdAt === s.createdAt && typeof prev._at === 'number' ? prev : null;
  if (p) {
    const dPlay = play - (p.playtime || 0), dReal = (now - p._at) / 1000;
    if (dPlay > dReal + PLAY_SLACK) return 'it claims more play time than has passed';
    if (s.money - (p.money || 0) > Math.max(0, dPlay) * SAVE_RATE + SAVE_SLACK) return 'its drachmae went up faster than hunting pays';
    if (clears - clearsOf(p.cleared) > Math.max(0, dPlay) / CLEAR_SECS + 3) return 'it cleared hunts faster than they can be played';
  } else if (s.money > play * SAVE_RATE + SAVE_SLACK) return 'it has more drachmae than its play time could earn';
  return null;
}

/* ---------- multiplayer rooms ---------- */
// Room codes: 5 letters, no I or O so nobody mixes them up with 1 and 0.
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ', CODE_RE = /^[A-Z]{5}$/, ROOM_MAX = 6;
// A lost connection isn't a goodbye: a player's place is held this long. STALL_MS: how long the player running a hunt can go
// quiet (no snapshot, no ping) before the room stops waiting on them.
const HOLD_MS = 20000, STALL_MS = 12000;
const roomStub = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));
const lobbyStub = env => env.LOBBY.get(env.LOBBY.idFromName('main'));
function newCode() { const b = crypto.getRandomValues(new Uint8Array(5)); return [...b].map(x => CODE_ABC[x % CODE_ABC.length]).join(''); }

// No sign-in needed: the room list, the ping and the WebSocket itself (it carries a one-time ticket instead).
async function roomsPublic(req, env, path, method) {
  if (path === '/api/rooms' && method === 'GET') return json({ rooms: await lobbyStub(env).list() });
  const m = path.match(/^\/api\/rooms\/([A-Za-z]{5})\/(ws|ping)$/);
  if (!m) return null;
  const code = m[1].toUpperCase();
  if (m[2] === 'ping') return json({ ok: true, open: await roomStub(env, code).isOpen() });
  if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return json({ error: 'Expected a WebSocket.' }, 426);
  return roomStub(env, code).fetch(req);
}
// Signed in: make a room, or get a ticket to join one. A ticket is good for 30 seconds and one connection.
async function roomsAuthed(req, env, path, method, user) {
  const who = { key: user.name, name: user.display };
  if (path === '/api/rooms' && method === 'POST') {
    const body = await readJson(req), pub = body.public !== false, rank = clampInt(body.rank, 0, 2), name = roomName(body.name);
    for (let i = 0; i < 6; i++) {
      const code = newCode(), r = await roomStub(env, code).init({ code, owner: who, pub, rank, name });
      if (r.ok) return json({ code, ticket: (await roomStub(env, code).ticket(who)).ticket });
    }
    return json({ error: 'Could not make a room. Try again.' }, 503);
  }
  const m = path.match(/^\/api\/rooms\/([A-Za-z]{5})\/ticket$/);
  if (m && method === 'POST') {
    const r = await roomStub(env, m[1].toUpperCase()).ticket(who);
    return r.error ? json({ error: r.error }, r.status || 400) : json({ ticket: r.ticket });
  }
  return null;
}
function clampInt(v, a, b) { v = Math.floor(Number(v) || 0); return v < a ? a : v > b ? b : v; }
// A room's name, as the host typed it: one line, 24 characters. Rude words make it no name at all (the list shows
// "<host>'s room" instead), since anyone can see the public room list.
const ROOM_RUDE = /f+u+c+k|sh[i1]t|b[i1]tch|c+u+n+t|n[i1]gg|f+a+g|d[i1]ck|c+o+c+k|puss(y|ie)|wh[o0]re|slut|rap(e|ist)|porn|nazi|retard/i;
function roomName(v) {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  return ROOM_RUDE.test(s.replace(/[\s._\-*]/g, '')) ? '' : s;
}

// One room. It never runs the game: it keeps who is in it, who hosts, the posted quest and ready flags,
// and passes messages on. Uses the WebSocket Hibernation API, so an idle room costs nothing.
// Messages are small JSON objects with a type t. From players:
//   info {gear, rank}   town {..}   post {quest}   ready {v}   cancel   depart {ids, cfg}   end   leave
//   up {..} (a guest's own hunter, hits, claims: goes to the host)   down {..} / to {id, m} (the host's snapshots and events)
//   chat {text}   kick {id} (host only: that player is removed and can't rejoin this room)   name {name} (host only: rename it)
//   stall (a guest in a hunt has had no snapshots for a while)
// To players: room {..} on every change, the relayed messages with from = sender's id, chat {from, name, text},
// kick {id, name} (to the others), err {msg}. A kicked player's connection closes with code 4002.
// A dropped connection: away {id, name} to everyone and their place is held (meta.away). They reconnect with re=<their id>
// and keep that id; the player running the hunt gets back {from}. Not back in time: gone {from}, or if it was the player
// running the hunt, runner {id, old} names who runs it now (hostleft if nobody can).
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = null;
    ctx.blockConcurrencyWhile(async () => { this.meta = (await ctx.storage.get('meta')) || null; });
    // the in-room ping is answered by Cloudflare without waking the room up
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('p', 'q'));
  }
  async save() { await this.ctx.storage.put('meta', this.meta); }
  sockets() { return this.ctx.getWebSockets().filter(ws => { try { return !!ws.deserializeAttachment(); } catch { return false; } }); }
  members() { return this.sockets().map(ws => ws.deserializeAttachment()).sort((a, b) => a.at - b.at); }
  awayList() { return Object.values((this.meta && this.meta.away) || {}); }          // the players whose place is being held

  async init({ code, owner, pub, rank, name }) {
    if (this.meta && (this.sockets().length || this.awayList().length)) return { ok: false };
    this.meta = { code, owner: owner.key, pub, rank, name: name || '', host: 0, quest: null, phase: 'town', hunt: [], created: Date.now(), nextId: 1, tickets: {} };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + 60000);   // nobody turned up: close it
    return { ok: true };
  }
  async ticket(who) {
    if (!this.meta) return { error: 'That room doesn’t exist (or it closed).', status: 404 };
    if ((this.meta.banned || []).includes(who.key)) return { error: 'The host removed you from that room.', status: 403 };
    const others = [...this.members(), ...this.awayList()].filter(m => m.key !== who.key);
    if (others.length >= ROOM_MAX) return { error: 'That room is full.', status: 409 };
    const now = Date.now(), t = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    for (const [k, v] of Object.entries(this.meta.tickets)) if (v.exp < now) delete this.meta.tickets[k];
    this.meta.tickets[t] = { key: who.key, name: who.name, exp: now + 30000 };
    await this.save();
    return { ticket: t };
  }

  async fetch(req) {
    const url = new URL(req.url), t = url.searchParams.get('ticket') || '';
    if (!this.meta) return new Response('That room doesn’t exist.', { status: 404 });
    const tk = this.meta.tickets[t];
    if (!tk || tk.exp < Date.now()) return new Response('Bad or old ticket.', { status: 403 });
    delete this.meta.tickets[t];
    const M = this.meta, re = Number(url.searchParams.get('re')) || 0, replaced = [];
    let back = null;                                                 // re: their id before the drop. They carry on as that player.
    this.missing();
    for (const ws of this.ctx.getWebSockets()) {                    // the same account in a second tab replaces the first
      const a = ws.deserializeAttachment(); if (a && a.key === tk.key) { if (a.id === re) back = a; else replaced.push(a); ws.serializeAttachment(null); try { ws.close(4001, 'Joined from somewhere else'); } catch {} }
    }
    for (const a of this.awayList()) if (a.key === tk.key) { delete M.away[a.id]; if (a.id === re) back = a; else replaced.push(a); }
    if (!back && this.sockets().length + this.awayList().length >= ROOM_MAX) { await this.save(); return new Response('That room is full.', { status: 409 }); }
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const me = back ? { ...back, at: Date.now(), hunt: M.phase === 'hunt' && (M.hunt || []).includes(back.id) }
      : { id: M.nextId++, key: tk.key, name: tk.name, at: Date.now(), ready: false, hunt: false, rank: 0, gear: null };
    delete me.until;
    server.serializeAttachment(me);
    if (!this.members().some(m => m.id === M.host) && !(M.away || {})[M.host]) M.host = me.id;   // first one in hosts
    await this.save();
    if (back && me.hunt) { const h = this.byId(M.runner ?? M.host); if (h && h !== server) this.send(h, { t: 'back', from: me.id }); }
    this.broadcastRoom(); await this.toLobby();
    for (const a of replaced) await this.lost(a);                    // started over (a reload, a second tab): the old one is gone for good
    await this.wake();
    return new Response(null, { status: 101, webSocket: client });
  }

  roomMsg(forId) {
    const M = this.meta;
    return JSON.stringify({ t: 'room', v: 3, code: M.code, name: M.name || '', host: M.host, runner: M.runner ?? null, me: forId, pub: M.pub, rank: M.rank, quest: M.quest, phase: M.phase, hunt: M.hunt,
      members: this.members().map(m => ({ id: m.id, name: m.name, ready: m.ready, hunt: m.hunt, rank: m.rank, gear: m.gear, why: m.why || null })),
      away: this.awayList().map(a => ({ id: a.id, name: a.name })) });
  }
  broadcastRoom() { for (const ws of this.sockets()) { const a = ws.deserializeAttachment(); try { ws.send(this.roomMsg(a.id)); } catch {} } }
  send(ws, o) { try { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch {} }
  byId(id) { return this.sockets().find(ws => ws.deserializeAttachment().id === id); }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 200000) return;       // (one full snapshot after a drop can be big)
    const me = ws.deserializeAttachment(); if (!me || !this.meta) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const M = this.meta, isHost = me.id === M.host, runs = me.id === (M.runner ?? M.host);   // runs: the player whose game runs the hunt (who posted it)
    switch (m.t) {
      case 'up': {                                                   // a guest's own hunter and actions: to the host
        const h = this.byId(M.runner ?? M.host); if (h && h !== ws) { m.from = me.id; this.send(h, m); } return;
      }
      case 'down': {                                                 // the host's hunt snapshot: to everyone in the hunt
        if (!runs) return; const s = JSON.stringify(m);
        this.downAt = Date.now();
        for (const o of this.sockets()) if (o !== ws && o.deserializeAttachment().hunt) this.send(o, s);
        return;
      }
      case 'stall': {                                                // no snapshots for a guest: is the player running the hunt still there?
        if (M.phase !== 'hunt' || runs) return;
        const h = this.byId(M.runner ?? M.host); if (!h) return;
        const a = h.deserializeAttachment(); let ts = null; try { ts = this.ctx.getWebSocketAutoResponseTimestamp(h); } catch {}
        if (Date.now() - Math.max(ts ? ts.getTime() : 0, a.at || 0, this.downAt || 0) > STALL_MS) await this.dropped(h, 4003, 'No answer', true);
        return;
      }
      case 'to': { if (!runs) return; const o = this.byId(m.id); if (o) this.send(o, m.m); return; }   // the host to one player
      case 'town': case 'emote': {                                   // where you are in Akros: to everyone else
        m.from = me.id; const s = JSON.stringify(m);
        for (const o of this.sockets()) if (o !== ws) this.send(o, s);
        return;
      }
      case 'info': {                                                 // what you look like and carry (drawn by the others), and your rank
        const g = m.gear && typeof m.gear === 'object' ? JSON.stringify(m.gear) : null;
        me.gear = g && g.length < 1200 ? JSON.parse(g) : null; me.rank = clampInt(m.rank, 0, 2); me.cap = m.cap === 1 ? 1 : 0;   // cap 1: their game can take over a hunt
        me.why = typeof m.why === 'string' ? m.why.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').slice(0, 40) : null;   // why they can't take the posted hunt
        ws.serializeAttachment(me);
        this.broadcastRoom(); if (me.id === M.host) await this.toLobby(); return;
      }
      case 'ready': if (M.quest && M.phase === 'town') { me.ready = !!m.v; ws.serializeAttachment(me); this.broadcastRoom(); } return;
      case 'post':
        if (M.phase !== 'town' || !m.quest || typeof m.quest.id !== 'string') return;
        if (M.quest && M.quest.by !== me.id && !isHost) return;           // someone else's quest is up: only they or the host can replace it
        M.quest = { id: m.quest.id.slice(0, 40), name: String(m.quest.name || '').slice(0, 60), rank: clampInt(m.quest.rank, 0, 2), by: me.id };
        for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.ready = a.id === me.id; o.serializeAttachment(a); }
        await this.save(); this.broadcastRoom(); await this.toLobby(); return;
      case 'cancel':
        if (M.phase !== 'town' || !M.quest || !(isHost || M.quest.by === me.id)) return;
        M.quest = null; for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.ready = false; o.serializeAttachment(a); }
        await this.save(); this.broadcastRoom(); await this.toLobby(); return;
      case 'depart': {
        if (M.phase !== 'town' || !M.quest || (M.quest.by ?? M.host) !== me.id) return;   // whoever posted it departs
        const ids = this.members().filter(a => a.id === me.id || a.ready).map(a => a.id);
        M.phase = 'hunt'; M.hunt = ids; M.runner = me.id; M.crew = {};
        for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.hunt = ids.includes(a.id); o.serializeAttachment(a); if (a.hunt) M.crew[a.id] = { key: a.key, name: a.name }; }
        await this.save();
        const s = JSON.stringify({ t: 'depart', quest: M.quest, ids, cfg: m.cfg || null, from: me.id });
        for (const o of this.sockets()) this.send(o, s);
        this.broadcastRoom(); await this.toLobby(); return;
      }
      case 'leave': me.hunt = false; ws.serializeAttachment(me); M.hunt = (M.hunt || []).filter(i => i !== me.id); await this.save(); { const h = this.byId(M.runner ?? M.host); if (h && h !== ws) this.send(h, { t: 'gone', from: me.id }); } this.broadcastRoom(); return;
      case 'end': if (runs) await this.endHunt(); return;
      case 'pub': if (isHost) { M.pub = !!m.v; await this.save(); this.broadcastRoom(); await this.toLobby(); } return;
      case 'name': if (isHost) { M.name = roomName(m.name); await this.save(); this.broadcastRoom(); await this.toLobby(); } return;   // the host renames the room
      case 'chat': {                                                 // room chat: to everyone, the sender included, so all see the same order
        if (typeof m.text !== 'string') return;
        const text = m.text.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), now = Date.now();
        if (!text || now - (me.chatAt || 0) < 600) return;
        me.chatAt = now; ws.serializeAttachment(me);
        const s = JSON.stringify({ t: 'chat', from: me.id, name: me.name, text });
        for (const o of this.sockets()) this.send(o, s);
        return;
      }
      case 'kick': {                                                 // the host removes a player, who can't come back to this room
        if (!isHost || m.id === me.id) return;
        const o = this.byId(m.id); if (!o) return;
        const a = o.deserializeAttachment();
        M.banned = [...(M.banned || []), a.key].slice(-20);
        for (const x of this.sockets()) if (x !== o) this.send(x, { t: 'kick', id: a.id, name: a.name });
        await this.dropped(o, 4002, 'Removed by the host'); return;
      }
    }
  }
  async endHunt() {
    const M = this.meta; M.phase = 'town'; M.quest = null; M.hunt = []; M.runner = null; M.crew = null;
    for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.ready = false; a.hunt = false; o.serializeAttachment(a); }
    for (const a of this.awayList()) a.ready = a.hunt = false;
    await this.save(); this.broadcastRoom(); await this.toLobby();
  }
  // Code 1000 is the game saying goodbye. Anything else is a connection lost, so their place is held.
  async webSocketClose(ws, code) { await this.dropped(ws, 1000, 'bye', code !== 1000); }
  async webSocketError(ws) { await this.dropped(ws, 1000, 'bye', true); }
  async dropped(ws, code = 1000, reason = 'bye', hold = false) {
    const me = ws.deserializeAttachment(); if (!me || !this.meta) return;
    try { ws.serializeAttachment(null); } catch {} try { ws.close(code, reason); } catch {}
    if (!hold) { await this.lost(me); return; }
    const M = this.meta;
    (M.away = M.away || {})[me.id] = { ...me, until: Date.now() + HOLD_MS };
    for (const o of this.sockets()) this.send(o, { t: 'away', id: me.id, name: me.name });
    await this.save(); this.broadcastRoom(); await this.toLobby(); await this.wake();
  }
  // Someone is gone for good: hand on what they held.
  async lost(me) {
    const M = this.meta, left = this.members(), away = this.awayList();
    if (!left.length && !away.length) { await this.closeRoom(); return; }
    const runner = M.runner ?? M.host, hunting = M.phase === 'hunt';
    if (me.id === M.host) M.host = (left[0] || away[0]).id;          // the host left: the oldest player hosts now
    if (hunting) M.hunt = (M.hunt || []).filter(i => i !== me.id);
    if (hunting && me.id === runner) {                               // the next player on the hunt whose game can take it over
      const next = M.hunt.map(id => left.find(a => a.id === id && a.hunt && a.cap)).find(Boolean);
      if (!next) { for (const o of this.sockets()) this.send(o, { t: 'hostleft' }); await this.endHunt(); return; }
      M.runner = next.id;
      for (const o of this.sockets()) this.send(o, { t: 'runner', id: next.id, old: me.id });
    } else if (hunting && me.hunt) { const h = this.byId(runner); if (h) this.send(h, { t: 'gone', from: me.id }); }
    await this.save(); this.broadcastRoom(); await this.toLobby();
  }
  // A room restarting closes every connection and no close event comes: anyone on the hunt with no connection and no held
  // place gets one now.
  missing() {
    const M = this.meta; if (M.phase !== 'hunt') return;
    for (const id of M.hunt || []) {
      const c = (M.crew || {})[id]; if (!c || this.byId(id) || (M.away || {})[id]) continue;
      (M.away = M.away || {})[id] = { id, key: c.key, name: c.name, at: Date.now(), ready: false, hunt: true, rank: 0, gear: null, until: Date.now() + HOLD_MS };
    }
  }
  async expire() {                                                   // held places that have run out
    const now = Date.now();
    for (const a of this.awayList()) if (a.until <= now) { delete this.meta.away[a.id]; await this.lost(a); if (!this.meta) return; }
  }
  async wake() { await this.ctx.storage.setAlarm(Math.min(Date.now() + 30000, ...this.awayList().map(a => a.until + 50))); }   // the next alarm: 30 s, or when a held place runs out
  async closeRoom() {
    const code = this.meta && this.meta.code;
    this.meta = null; await this.ctx.storage.deleteAll(); await this.ctx.storage.deleteAlarm();
    if (code) try { await lobbyStub(this.env).remove(code); } catch {}
  }
  async toLobby() {
    const M = this.meta; if (!M) return; const mem = [...this.members(), ...this.awayList()], host = mem.find(m => m.id === M.host);
    try {
      await lobbyStub(this.env).update({ code: M.code, name: M.name || '', pub: M.pub, host: host ? host.name : '', n: mem.length, max: ROOM_MAX,
        hostKey: host ? host.key : '', rank: host ? host.rank : M.rank, phase: M.phase, quest: M.quest ? M.quest.name : null, created: M.created });
    } catch {}
  }
  async alarm() {                                                    // every 30 s: drop dead connections, tell the lobby
    if (!this.meta) return;
    await this.sweep(); if (!this.meta) return;
    this.missing(); await this.expire(); if (!this.meta) return;
    if (!this.sockets().length && !this.awayList().length) { await this.closeRoom(); return; }
    await this.save(); await this.toLobby(); await this.wake();
  }
  // A connection that stopped answering (a PC asleep, a dropped network) still looks open. Players ping every 2 s,
  // every 10 s from a hidden tab, so 90 s of silence means they're gone.
  async sweep() {
    const now = Date.now();
    for (const ws of this.sockets()) {
      const a = ws.deserializeAttachment(); let ts = null; try { ts = this.ctx.getWebSocketAutoResponseTimestamp(ws); } catch {}
      if (now - Math.max(ts ? ts.getTime() : 0, a.at || 0) > 90000) await this.dropped(ws);
    }
  }
  async isOpen() { if (this.meta) await this.sweep(); const n = this.sockets().length + this.awayList().length; return !!(this.meta && n && n < ROOM_MAX); }
}

// The public room list. Rooms check in when something changes and once a minute; ones that go quiet drop off.
export class Lobby extends DurableObject {
  async update(info) {
    if (!info || !CODE_RE.test(info.code)) return;
    const rooms = (await this.ctx.storage.get('rooms')) || {};
    for (const [k, v] of Object.entries(rooms)) if (k !== info.code && info.hostKey && v.hostKey === info.hostKey) {   // one room per player: the newest
      if (v.created > info.created) { if (rooms[info.code]) { delete rooms[info.code]; await this.ctx.storage.put('rooms', rooms); } return; }
      delete rooms[k];
    }
    rooms[info.code] = { ...info, seen: Date.now() };
    await this.ctx.storage.put('rooms', rooms);
  }
  async remove(code) { const rooms = (await this.ctx.storage.get('rooms')) || {}; if (rooms[code]) { delete rooms[code]; await this.ctx.storage.put('rooms', rooms); } }
  async list() {
    const rooms = (await this.ctx.storage.get('rooms')) || {}, now = Date.now(); let changed = false;
    for (const [k, v] of Object.entries(rooms)) if (now - v.seen > 75000) { delete rooms[k]; changed = true; }
    if (changed) await this.ctx.storage.put('rooms', rooms);
    return Object.values(rooms).filter(r => r.pub && r.n > 0).sort((a, b) => b.created - a.created).slice(0, 60)
      .map(r => ({ code: r.code, name: r.name || '', host: r.host, n: r.n, max: r.max, rank: r.rank, phase: r.phase, quest: r.quest }));
  }
}
