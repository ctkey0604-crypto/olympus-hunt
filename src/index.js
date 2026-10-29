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

/* ---------- multiplayer rooms ---------- */
// Room codes: 5 letters, no I or O so nobody mixes them up with 1 and 0.
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ', CODE_RE = /^[A-Z]{5}$/, ROOM_MAX = 4;
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
    const body = await readJson(req), pub = body.public !== false, rank = clampInt(body.rank, 0, 2);
    for (let i = 0; i < 6; i++) {
      const code = newCode(), r = await roomStub(env, code).init({ code, owner: who, pub, rank });
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

// One room. It never runs the game: it keeps who is in it, who hosts, the posted quest and ready flags,
// and passes messages on. Uses the WebSocket Hibernation API, so an idle room costs nothing.
// Messages are small JSON objects with a type t. From players:
//   info {gear, rank}   town {..}   post {quest}   ready {v}   cancel   depart {ids, cfg}   end   leave
//   up {..} (a guest's own hunter, hits, claims: goes to the host)   down {..} / to {id, m} (the host's snapshots and events)
// To players: room {..} on every change, the relayed messages with from = sender's id, err {msg}.
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

  async init({ code, owner, pub, rank }) {
    if (this.meta && this.sockets().length) return { ok: false };
    this.meta = { code, owner: owner.key, pub, rank, host: 0, quest: null, phase: 'town', hunt: [], created: Date.now(), nextId: 1, tickets: {} };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + 60000);   // nobody turned up: close it
    return { ok: true };
  }
  async ticket(who) {
    if (!this.meta) return { error: 'That room doesn’t exist (or it closed).', status: 404 };
    const others = this.members().filter(m => m.key !== who.key);
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
    for (const ws of this.ctx.getWebSockets()) {                    // the same account in a second tab replaces the first
      const a = ws.deserializeAttachment(); if (a && a.key === tk.key) { ws.serializeAttachment(null); try { ws.close(4001, 'Joined from somewhere else'); } catch {} }
    }
    if (this.sockets().length >= ROOM_MAX) { await this.save(); return new Response('That room is full.', { status: 409 }); }
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const me = { id: this.meta.nextId++, key: tk.key, name: tk.name, at: Date.now(), ready: false, hunt: false, rank: 0, gear: null };
    server.serializeAttachment(me);
    if (!this.members().some(m => m.id === this.meta.host)) this.meta.host = me.id;   // first one in hosts
    await this.save();
    this.broadcastRoom(); await this.toLobby();
    await this.ctx.storage.setAlarm(Date.now() + 60000);
    return new Response(null, { status: 101, webSocket: client });
  }

  roomMsg(forId) {
    const M = this.meta;
    return JSON.stringify({ t: 'room', code: M.code, host: M.host, me: forId, pub: M.pub, rank: M.rank, quest: M.quest, phase: M.phase, hunt: M.hunt,
      members: this.members().map(m => ({ id: m.id, name: m.name, ready: m.ready, hunt: m.hunt, rank: m.rank, gear: m.gear })) });
  }
  broadcastRoom() { for (const ws of this.sockets()) { const a = ws.deserializeAttachment(); try { ws.send(this.roomMsg(a.id)); } catch {} } }
  send(ws, o) { try { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch {} }
  byId(id) { return this.sockets().find(ws => ws.deserializeAttachment().id === id); }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 64000) return;
    const me = ws.deserializeAttachment(); if (!me || !this.meta) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const M = this.meta, isHost = me.id === M.host;
    switch (m.t) {
      case 'up': {                                                   // a guest's own hunter and actions: to the host
        const h = this.byId(M.host); if (h && h !== ws) { m.from = me.id; this.send(h, m); } return;
      }
      case 'down': {                                                 // the host's hunt snapshot: to everyone in the hunt
        if (!isHost) return; const s = JSON.stringify(m);
        for (const o of this.sockets()) if (o !== ws && o.deserializeAttachment().hunt) this.send(o, s);
        return;
      }
      case 'to': { if (!isHost) return; const o = this.byId(m.id); if (o) this.send(o, m.m); return; }   // the host to one player
      case 'town': case 'emote': {                                   // where you are in Akros: to everyone else
        m.from = me.id; const s = JSON.stringify(m);
        for (const o of this.sockets()) if (o !== ws) this.send(o, s);
        return;
      }
      case 'info': {                                                 // what you look like and carry (drawn by the others), and your rank
        const g = m.gear && typeof m.gear === 'object' ? JSON.stringify(m.gear) : null;
        me.gear = g && g.length < 1200 ? JSON.parse(g) : null; me.rank = clampInt(m.rank, 0, 2); ws.serializeAttachment(me);
        this.broadcastRoom(); if (me.id === M.host) await this.toLobby(); return;
      }
      case 'ready': if (M.quest && M.phase === 'town') { me.ready = !!m.v; ws.serializeAttachment(me); this.broadcastRoom(); } return;
      case 'post':
        if (!isHost || M.phase !== 'town' || !m.quest || typeof m.quest.id !== 'string') return;
        M.quest = { id: m.quest.id.slice(0, 40), name: String(m.quest.name || '').slice(0, 60), rank: clampInt(m.quest.rank, 0, 2) };
        for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.ready = a.id === me.id; o.serializeAttachment(a); }
        await this.save(); this.broadcastRoom(); await this.toLobby(); return;
      case 'cancel':
        if (!isHost || M.phase !== 'town') return;
        M.quest = null; for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.ready = false; o.serializeAttachment(a); }
        await this.save(); this.broadcastRoom(); await this.toLobby(); return;
      case 'depart': {
        if (!isHost || M.phase !== 'town' || !M.quest) return;
        const ids = this.members().filter(a => a.id === me.id || a.ready).map(a => a.id);
        M.phase = 'hunt'; M.hunt = ids;
        for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.hunt = ids.includes(a.id); o.serializeAttachment(a); }
        await this.save();
        const s = JSON.stringify({ t: 'depart', quest: M.quest, ids, cfg: m.cfg || null, from: me.id });
        for (const o of this.sockets()) this.send(o, s);
        this.broadcastRoom(); await this.toLobby(); return;
      }
      case 'leave': me.hunt = false; ws.serializeAttachment(me); { const h = this.byId(M.host); if (h && h !== ws) this.send(h, { t: 'gone', from: me.id }); } this.broadcastRoom(); return;
      case 'end': if (isHost) await this.endHunt(); return;
      case 'pub': if (isHost) { M.pub = !!m.v; await this.save(); this.broadcastRoom(); await this.toLobby(); } return;
    }
  }
  async endHunt() {
    const M = this.meta; M.phase = 'town'; M.quest = null; M.hunt = [];
    for (const o of this.sockets()) { const a = o.deserializeAttachment(); a.ready = false; a.hunt = false; o.serializeAttachment(a); }
    await this.save(); this.broadcastRoom(); await this.toLobby();
  }
  async webSocketClose(ws, code) { await this.dropped(ws); }
  async webSocketError(ws) { await this.dropped(ws); }
  async dropped(ws) {
    const me = ws.deserializeAttachment(); if (!me || !this.meta) return;
    try { ws.serializeAttachment(null); } catch {} try { ws.close(1000, 'bye'); } catch {}
    const M = this.meta, left = this.members();
    if (!left.length) { await this.closeRoom(); return; }
    if (me.id === M.host) {                                          // the host left: the oldest player hosts now
      M.host = left[0].id;
      if (M.phase === 'hunt') { for (const o of this.sockets()) this.send(o, { t: 'hostleft' }); await this.endHunt(); return; }
    } else if (M.phase === 'hunt' && me.hunt) { const h = this.byId(M.host); if (h) this.send(h, { t: 'gone', from: me.id }); }
    await this.save(); this.broadcastRoom(); await this.toLobby();
  }
  async closeRoom() {
    const code = this.meta && this.meta.code;
    this.meta = null; await this.ctx.storage.deleteAll(); await this.ctx.storage.deleteAlarm();
    if (code) try { await lobbyStub(this.env).remove(code); } catch {}
  }
  async toLobby() {
    const M = this.meta; if (!M) return; const mem = this.members(), host = mem.find(m => m.id === M.host);
    try {
      await lobbyStub(this.env).update({ code: M.code, pub: M.pub, host: host ? host.name : '', n: mem.length, max: ROOM_MAX,
        rank: host ? host.rank : M.rank, phase: M.phase, quest: M.quest ? M.quest.name : null, created: M.created });
    } catch {}
  }
  async alarm() {                                                    // every minute: still alive? tell the lobby
    if (!this.meta) return;
    if (!this.sockets().length) { await this.closeRoom(); return; }
    await this.toLobby(); await this.ctx.storage.setAlarm(Date.now() + 60000);
  }
  async isOpen() { return !!(this.meta && this.sockets().length && this.sockets().length < ROOM_MAX); }
}

// The public room list. Rooms check in when something changes and once a minute; ones that go quiet drop off.
export class Lobby extends DurableObject {
  async update(info) {
    if (!info || !CODE_RE.test(info.code)) return;
    const rooms = (await this.ctx.storage.get('rooms')) || {};
    rooms[info.code] = { ...info, seen: Date.now() };
    await this.ctx.storage.put('rooms', rooms);
  }
  async remove(code) { const rooms = (await this.ctx.storage.get('rooms')) || {}; if (rooms[code]) { delete rooms[code]; await this.ctx.storage.put('rooms', rooms); } }
  async list() {
    const rooms = (await this.ctx.storage.get('rooms')) || {}, now = Date.now(); let changed = false;
    for (const [k, v] of Object.entries(rooms)) if (now - v.seen > 150000) { delete rooms[k]; changed = true; }
    if (changed) await this.ctx.storage.put('rooms', rooms);
    return Object.values(rooms).filter(r => r.pub && r.n > 0).sort((a, b) => b.created - a.created).slice(0, 60)
      .map(r => ({ code: r.code, host: r.host, n: r.n, max: r.max, rank: r.rank, phase: r.phase, quest: r.quest }));
  }
}
