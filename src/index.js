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
  if (path.startsWith('/api/rooms') || path === '/api/pvp/board') { const r = await roomsPublic(req, env, path, method); if (r) return r; }
  if (path === '/api/vote' && method === 'GET') { const who = await authed(req, env); return json(await lobbyStub(env).vote(null, who ? who.name : null)); }
  if (path === '/api/boards' && method === 'GET') return json(await lobbyStub(env).scoreBoards());
  if (path === '/api/suggest' && method === 'GET') { const who = await authed(req, env); return json(await lobbyStub(env).suggest(who ? who.name : null)); }
  if (path === '/api/forum' && method === 'GET') return json(await lobbyStub(env).forumList());
  { const m = method === 'GET' && (path.match(/^\/api\/forum\/t\/([a-z0-9]{4,20})$/) || path.match(/^\/api\/suggest\/c\/([a-z0-9_]{1,30}\.[a-z0-9]{1,12})$/));
    if (m) { const who = await authed(req, env), L = lobbyStub(env), r = path.includes('/forum/') ? await L.forumThread(m[1], who ? who.name : null) : await L.suggestComments(m[1], who ? who.name : null); return json(r, r.error ? 404 : 200); } }

  const user = await authed(req, env);
  if (!user) return json({ error: 'You are signed out. Sign in again.' }, 401);
  if (path === '/api/me' && method === 'GET') return json({ name: user.display });
  // The owner's dashboard. It reads game progress, and runs the community suggestions. To any other account these addresses don't exist.
  if (path === '/api/owner/players' && method === 'GET') return user.name === OWNER ? json(await ownerReport(env)) : json({ error: 'Not found.' }, 404);
  if (path === '/api/owner/suggest' && method === 'POST') {
    if (user.name !== OWNER) return json({ error: 'Not found.' }, 404);
    const b = await readJson(req), r = await lobbyStub(env).suggestOwner(String(b.do || ''), String(b.id || ''));
    return json(r, r.error ? 400 : 200);
  }
  // Community suggestions: post your own idea (one per account), vote for someone else's (one vote, can be changed), or take yours down.
  if (path === '/api/suggest' && method === 'POST') { const b = await readJson(req), r = await lobbyStub(env).suggestPost(user.name, user.display, b.text); return json(r, r.error ? 400 : 200); }
  if (path === '/api/suggest/vote' && method === 'POST') { const b = await readJson(req), r = await lobbyStub(env).suggestVote(user.name, String(b.id || '')); return json(r, r.error ? 400 : 200); }
  if (path === '/api/suggest/delete' && method === 'POST') { const r = await lobbyStub(env).suggestDelete(user.name); return json(r, r.error ? 400 : 200); }
  if (path.startsWith('/api/forum') || path.startsWith('/api/suggest/') && method === 'POST') {
    const b = await readJson(req), L = lobbyStub(env), own = user.name === OWNER, s = k => String(b[k] || '');
    let r = null;
    if (path === '/api/forum' && method === 'POST') r = await L.forumPost(user.name, user.display, b.title, b.text);
    else if (path === '/api/forum/reply' && method === 'POST') r = await L.forumReply(user.name, user.display, s('id'), b.text);
    else if (path === '/api/forum/delete' && method === 'POST') r = await L.forumDelete(user.name, own, s('id'), s('rid'));
    else if (path === '/api/suggest/comment' && method === 'POST') r = await L.suggestComment(user.name, user.display, s('id'), b.text);
    else if (path === '/api/suggest/uncomment' && method === 'POST') r = await L.suggestUncomment(user.name, own, s('id'), s('cid'));
    if (r) return json(r, r.error ? 400 : 200);
  }
  if (path === '/api/vote' && method === 'POST') { const b = await readJson(req), r = await lobbyStub(env).vote(String(b.choice || ''), user.name); return json(r, r.error ? 400 : 200); }
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
      if (r.meta.changes > 0) { const sc = scoreOf(save); if (sc.time || sc.wave) try { await lobbyStub(env).scoreReport(user.name, user.display, sc); } catch {} }   // the boards never cost anyone a save
      return json({ ok: true, kept: r.meta.changes > 0 });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM saves WHERE name = ? AND slot = ?').bind(user.name, slot).run();
      return json({ ok: true });
    }
  }
  return json({ error: 'Not found.' }, 404);
}

/* ---------- the owner's dashboard ---------- */
// Game progress only: passwords, password hashes and session tokens are never selected. One row per save, newest first.
const OWNER = 'theowner', OWNER_ROWS = 600;
async function ownerReport(env) {
  const { results } = await env.DB.prepare(`SELECT u.name, u.display, u.created, s.slot, s.saved_at,
      json_extract(s.data, '$.rank') AS rank, json_extract(s.data, '$.playtime') AS play, json_extract(s.data, '$.money') AS money,
      json_extract(s.data, '$.weapon') AS weapon, json_extract(s.data, '$.endless.best') AS wave, json_extract(s.data, '$.finishTime') AS finish,
      json_extract(s.data, '$.stairs') AS stairs, json_extract(s.data, '$.cleared') AS cleared
    FROM users u LEFT JOIN saves s ON s.name = u.name ORDER BY s.saved_at DESC LIMIT ?`).bind(OWNER_ROWS).all();
  return { now: Date.now(), rows: results || [] };
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
// Coliseum fights: everyone starts on this rating, and the same two players only count this many times a day.
const PVP_START = 1000, PVP_K = 24, PVP_KILLS_DAY = 30, PVP_WINS_DAY = 10;
// The community vote on the title screen: what update 1.1 will be. A new poll needs a new id, and the game's list of choices has to match.
const POLL = { id: 'next1', choices: ['egypt', 'norse', 'harder'] };
// Community suggestions: players post their own ideas and vote. Off until the owner opens them from the dashboard, which also ends the
// 1.1 vote. Each round, one idea per account and one vote per account (not for your own idea). The owner can take any idea down,
// or start a new round once the winner is in the game. Anyone can read them, and kids play this, so posts are filtered.
const SUGGEST_MIN = 8, SUGGEST_MAX = 150, SUGGEST_GAP = 60000, SUGGEST_SHOW = 100;
const RUDE_WORD = /^(f+u+c*k|fck|fk$|sh+i+t(?!ake)|sht$|b+i+t+c+h|btch|c+u+n+t|n+i+g+g|niga$|f+a+g|d+i+c+k|cocks?$|cocksuck|puss(y|ie)|wh+o+r+e|slut|rapes?$|raped$|rapist|raping|porn|nazi|retard|ass$|asses$|asshole|dumbass|jackass|bastard|kys$|penis|vagina|boob|tits?$|sex|cum$|dildo|nudes?$|horny$)/;
const RUDE_SQUASHED = /n+i+g+g+(a|e|u|h)|f+u+c+k|kill+(ur|your)sel|c+u+n+t/;
const POST_LINKS = /https?:|www\.|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|co|me|tv|ly|app|dev)\b/i;
function isRude(text) {
  const plain = text.toLowerCase().replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/[@4]/g, 'a').replace(/[5$]/g, 's');
  return plain.split(/[^a-z*]+/).some(w => (w = w.replace(/\*/g, '')) && RUDE_WORD.test(w)) || RUDE_SQUASHED.test(plain.replace(/[^a-z]/g, ''));
}
// Anything a player writes for others to read. lines: keeps line breaks (posts and replies), otherwise one line.
function cleanPost(v, min, max, lines = false) {
  if (typeof v !== 'string') return { error: 'Write something first.' };
  const text = (lines ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    : v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ')).trim().slice(0, max);
  if (text.length < min) return { error: 'That’s too short. Say a bit more.', short: true };
  if (POST_LINKS.test(text)) return { error: 'No links, please.' };
  if (isRude(text)) return { error: 'Keep it clean. That has a word that isn’t allowed here.' };
  return { text };
}
function suggestText(v) { const r = cleanPost(v, SUGGEST_MIN, SUGGEST_MAX); return r.short ? { error: 'That’s too short. Say a bit more about your idea.' } : r; }
// The community board: one General discussion, live for everyone. Threads with replies; the author or the owner can take either down.
const FORUM_GAP = 60000, REPLY_GAP = 10000, FORUM_SHOW = 60, REPLY_MAX = 300, ID_RE = /^[a-z0-9]{4,20}$/, IDEA_RE = /^[a-z0-9_]{1,30}\.[a-z0-9]{1,12}$/;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// What a save puts on the public boards: the play time when Typhon first fell, and the best Endless wave. A run faster than half an
// hour, or a wave reached faster than a wave can be played, simply stays off them.
const RUN_MIN = 1800, WAVE_SECS = 15;
function scoreOf(s) {
  const won = !!(s.cleared && s.cleared.gr_typhon_hunt), play = Number(s.playtime) || 0, time = Math.round(Number(s.finishTime) || 0), wave = Math.floor(Number(s.endless && s.endless.best) || 0);
  return { time: won && time >= RUN_MIN && time <= play + 60 ? time : 0, wave: won && wave > 0 && wave * WAVE_SECS <= play ? wave : 0 };
}
const roomStub = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));
const lobbyStub = env => env.LOBBY.get(env.LOBBY.idFromName('main'));
function newCode() { const b = crypto.getRandomValues(new Uint8Array(5)); return [...b].map(x => CODE_ABC[x % CODE_ABC.length]).join(''); }

// No sign-in needed: the room list, the ping and the WebSocket itself (it carries a one-time ticket instead).
async function roomsPublic(req, env, path, method) {
  if (path === '/api/rooms' && method === 'GET') return json({ rooms: await lobbyStub(env).list() });
  if (path === '/api/pvp/board' && method === 'GET') return json({ board: await lobbyStub(env).pvpBoard() });
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
//   stall (a guest in a hunt has had no snapshots for a while)   handoff (leaving the hunt you run: it goes on, you stay in the room)
//   pvpres {deaths, beat} (the end of a Coliseum fight: who took you down and who beat you. Only your own losses count.)
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
    return JSON.stringify({ t: 'room', v: 3, hand: 1, code: M.code, name: M.name || '', host: M.host, runner: M.runner ?? null, me: forId, pub: M.pub, rank: M.rank, quest: M.quest, phase: M.phase, hunt: M.hunt,
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
        M.fight = /^pvp_/.test(M.quest.id) ? { crew: { ...M.crew }, at: Date.now(), seen: {} } : null;
        await this.save();
        const s = JSON.stringify({ t: 'depart', quest: M.quest, ids, cfg: m.cfg || null, from: me.id });
        for (const o of this.sockets()) this.send(o, s);
        this.broadcastRoom(); await this.toLobby(); return;
      }
      case 'leave': me.hunt = false; ws.serializeAttachment(me); M.hunt = (M.hunt || []).filter(i => i !== me.id); await this.save(); { const h = this.byId(M.runner ?? M.host); if (h && h !== ws) this.send(h, { t: 'gone', from: me.id }); } this.broadcastRoom(); return;
      case 'end': if (runs) await this.endHunt(); return;
      case 'pvpres': {                                               // a fight's result. Each player reports only their own losses, once.
        const F = M.fight; if (!F || !F.crew[me.id] || F.seen[me.id] || Date.now() - F.at > 1800000) return;
        F.seen[me.id] = 1; await this.save();
        const deaths = (Array.isArray(m.deaths) ? m.deaths : []).slice(0, 6).filter(a => Array.isArray(a) && F.crew[a[0]] && a[0] !== me.id).map(a => ({ ...F.crew[a[0]], n: clampInt(a[1], 1, 5) }));
        const beat = (Array.isArray(m.beat) ? m.beat : []).slice(0, 6).filter(id => F.crew[id] && id !== me.id).map(id => F.crew[id]);
        if (deaths.length || beat.length) try { await lobbyStub(this.env).pvpReport({ me: F.crew[me.id], deaths, beat }); } catch {}
        return;
      }
      case 'handoff':
        if (M.phase !== 'hunt' || !runs) return;
        me.hunt = false; ws.serializeAttachment(me); M.hunt = (M.hunt || []).filter(i => i !== me.id);
        if (await this.handOn(me)) { await this.save(); this.broadcastRoom(); await this.toLobby(); }
        return;
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
    if (hunting && me.id === runner) { if (!(await this.handOn(me))) return; }
    else if (hunting && me.hunt) { const h = this.byId(runner); if (h) this.send(h, { t: 'gone', from: me.id }); }
    await this.save(); this.broadcastRoom(); await this.toLobby();
  }
  // The player running the hunt is off it: the next player on it whose game can take over runs it now. Nobody can: it ends.
  async handOn(me) {
    const M = this.meta, left = this.members(), others = this.sockets().filter(o => o.deserializeAttachment().id !== me.id);
    const next = M.hunt.map(id => left.find(a => a.id === id && a.hunt && a.cap)).find(Boolean);
    if (!next) { for (const o of others) this.send(o, { t: 'hostleft' }); await this.endHunt(); return false; }
    M.runner = next.id;
    for (const o of others) this.send(o, { t: 'runner', id: next.id, old: me.id });
    return true;
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
  // The fight board. A kill or a win only ever arrives from the player who lost it, and the same two players stop counting after a few a day.
  async pvpRec(p) { return (await this.ctx.storage.get('p:' + p.key)) || { key: p.key, name: p.name, r: PVP_START, k: 0, d: 0, w: 0, l: 0 }; }
  async pvpRoom(tag, max) {
    const n = (await this.ctx.storage.get(tag)) || 0; if (n >= max) return false;
    await this.ctx.storage.put(tag, n + 1); return true;
  }
  async pvpReport({ me, deaths, beat }) {
    const day = Math.floor(Date.now() / 86400000), S = this.ctx.storage, a = await this.pvpRec(me);
    for (const d of deaths) {
      const b = await this.pvpRec(d); let n = 0;
      for (let i = 0; i < d.n; i++) if (await this.pvpRoom('c:' + day + ':k:' + d.key + '>' + me.key, PVP_KILLS_DAY)) n++;
      if (n) { b.k += n; a.d += n; await S.put('p:' + d.key, b); }
    }
    for (const w of beat) {
      if (!(await this.pvpRoom('c:' + day + ':w:' + w.key + '>' + me.key, PVP_WINS_DAY))) continue;
      const b = await this.pvpRec(w), gain = Math.max(1, Math.round(PVP_K * (1 - 1 / (1 + Math.pow(10, (a.r - b.r) / 400)))));
      b.r += gain; b.w++; a.r = Math.max(0, a.r - gain); a.l++; await S.put('p:' + w.key, b);
    }
    await S.put('p:' + me.key, a);
    if (Math.random() < .05) { const old = await S.list({ prefix: 'c:', limit: 500 }); for (const k of old.keys()) if (!k.startsWith('c:' + day + ':')) await S.delete(k); }
  }
  async pvpBoard() {
    const all = [...(await this.ctx.storage.list({ prefix: 'p:' })).values()];
    return all.sort((x, y) => y.r - x.r || (y.k - y.d) - (x.k - x.d)).slice(0, 25).map(({ name, r, k, d, w, l }) => ({ name, r, k, d, w, l }));
  }
  // The speedrun and Endless boards: each account's best across its saves.
  async scoreReport(key, name, { time, wave }) {
    const S = this.ctx.storage, k = 's:' + key, o = (await S.get(k)) || { name, time: 0, wave: 0 }; let changed = o.name !== name;
    o.name = name;
    if (time && (!o.time || time < o.time)) { o.time = time; changed = true; }
    if (wave > o.wave) { o.wave = wave; changed = true; }
    if (changed) await S.put(k, o);
  }
  async scoreBoards() {
    const all = [...(await this.ctx.storage.list({ prefix: 's:' })).values()];
    return { speed: all.filter(o => o.time).sort((a, b) => a.time - b.time).slice(0, 25).map(({ name, time }) => ({ name, time })),
             endless: all.filter(o => o.wave).sort((a, b) => b.wave - a.wave).slice(0, 25).map(({ name, wave }) => ({ name, wave })) };
  }
  // The community vote: one vote per account, and changing it moves the count. A null choice just reads the totals.
  async vote(choice, who) {
    const S = this.ctx.storage, at = 'v:' + POLL.id + ':', key = who ? at + 'u:' + who : null, counts = (await S.get(at + 'n')) || {};
    let mine = key ? (await S.get(key)) || null : null;
    const closed = !!(await S.get('sg:on'));                         // opening the suggestions ends this vote
    if (choice !== null) {
      if (closed) return { error: 'The 1.1 vote is over. Thanks for voting!' };
      if (!key || !POLL.choices.includes(choice)) return { error: 'That isn’t on the ballot.' };
      if (choice !== mine) {
        if (mine) counts[mine] = Math.max(0, (counts[mine] || 0) - 1);
        counts[choice] = (counts[choice] || 0) + 1;
        await S.put(at + 'n', counts); await S.put(key, choice); mine = choice;
      }
    }
    return { poll: POLL.id, counts, mine, closed };
  }
  // Community suggestions. Keys: sg:on, sg:round, sg:<round>:p:<author> (their idea and its count), sg:<round>:v:<voter> (the id
  // they voted for), sg:last:<author> (when they last posted). An idea's id carries its time, so a vote for an idea that was taken
  // down never counts for a new one from the same player.
  async sgRound() { return (await this.ctx.storage.get('sg:round')) || 1; }
  async suggest(who, all = false) {
    const S = this.ctx.storage, on = !!(await S.get('sg:on')), round = await this.sgRound(), at = 'sg:' + round + ':';
    const posts = [...(await S.list({ prefix: at + 'p:' })).values()].sort((a, b) => b.n - a.n || a.at - b.at);
    let mine = who ? (await S.get(at + 'v:' + who)) || null : null;
    if (mine && !posts.some(p => p.id === mine)) mine = null;
    const shown = all ? posts : posts.slice(0, SUGGEST_SHOW), own = who && posts.find(p => p.who === who);
    if (own && !shown.includes(own)) shown.push(own);
    return { on, round, mine, total: posts.length, posts: shown.map(p => ({ id: p.id, name: p.name, text: p.text, n: p.n, c: p.c || 0, yours: p.who === who || undefined })) };
  }
  async suggestPost(who, name, raw) {
    const S = this.ctx.storage; if (!(await S.get('sg:on'))) return { error: 'Suggestions aren’t open yet.' };
    const t = suggestText(raw); if (t.error) return t;
    const round = await this.sgRound(), key = 'sg:' + round + ':p:' + who, now = Date.now();
    if (await S.get(key)) return { error: 'You already have an idea up. Take it down first to post a different one.' };
    const last = (await S.get('sg:last:' + who)) || 0;
    if (now - last < SUGGEST_GAP) return { error: 'Wait a minute before posting again.' };
    await S.put(key, { id: who + '.' + now.toString(36), who, name, text: t.text, at: now, n: 0 });
    await S.put('sg:last:' + who, now);
    return this.suggest(who);
  }
  async suggestVote(who, id) {
    const S = this.ctx.storage; if (!(await S.get('sg:on'))) return { error: 'Suggestions aren’t open yet.' };
    const at = 'sg:' + (await this.sgRound()) + ':', author = id.split('.')[0], post = author && await S.get(at + 'p:' + author);
    if (!post || post.id !== id) return { error: 'That idea was taken down.' };
    if (post.who === who) return { error: 'You can’t vote for your own idea.' };
    const vk = at + 'v:' + who, mine = (await S.get(vk)) || null;
    if (mine !== id) {
      if (mine) { const old = await S.get(at + 'p:' + mine.split('.')[0]); if (old && old.id === mine) { old.n = Math.max(0, old.n - 1); await S.put(at + 'p:' + old.who, old); } }
      post.n++; await S.put(at + 'p:' + author, post); await S.put(vk, id);
    }
    return this.suggest(who);
  }
  async suggestDelete(who) {
    const S = this.ctx.storage, at = 'sg:' + (await this.sgRound()) + ':', key = at + 'p:' + who, p = await S.get(key);
    if (!p) return { error: 'You don’t have an idea up.' };
    await S.delete(key); await this.wipe(at + 'c:' + p.id + ':');        // its votes and comments go with it: those players can vote again
    return this.suggest(who);
  }
  async suggestOwner(act, id) {
    const S = this.ctx.storage;
    if (act === 'on' || act === 'off') await S.put('sg:on', act === 'on');
    else if (act === 'delete') { const at = 'sg:' + (await this.sgRound()) + ':', p = await S.get(at + 'p:' + id.split('.')[0]); if (p && p.id === id) { await S.delete(at + 'p:' + p.who); await this.wipe(at + 'c:' + p.id + ':'); } }
    else if (act === 'round') {                                      // the winner is in the game: clear the board for the next round
      const old = await this.sgRound(); await S.put('sg:round', old + 1);
      await this.wipe('sg:' + old + ':');
    } else if (act !== 'list') return { error: 'Unknown action.' };
    return this.suggest(null, true);
  }
  async wipe(prefix) { for (;;) { const keys = [...(await this.ctx.storage.list({ prefix, limit: 128 })).keys()]; if (!keys.length) return; await this.ctx.storage.delete(keys); } }
  async gap(who, kind, ms) {                                         // one post a minute, one reply every few seconds
    const k = 'fm:last' + kind + ':' + who, now = Date.now(), last = (await this.ctx.storage.get(k)) || 0;
    if (now - last < ms) return false;
    await this.ctx.storage.put(k, now); return true;
  }
  // Comments under an idea: sg:<round>:c:<idea id>:<comment id>. The idea keeps the count (c).
  async suggestComments(id, who) {
    const at = 'sg:' + (await this.sgRound()) + ':', p = IDEA_RE.test(id) && await this.ctx.storage.get(at + 'p:' + id.split('.')[0]);
    if (!p || p.id !== id) return { error: 'That idea was taken down.' };
    const cs = [...(await this.ctx.storage.list({ prefix: at + 'c:' + id + ':' })).values()].sort((a, b) => a.at - b.at);
    return { id, now: Date.now(), comments: cs.map(c => ({ id: c.id, name: c.name, text: c.text, at: c.at, yours: c.who === who || undefined })) };
  }
  async suggestComment(who, name, id, raw) {
    const S = this.ctx.storage; if (!(await S.get('sg:on'))) return { error: 'Suggestions aren’t open yet.' };
    const at = 'sg:' + (await this.sgRound()) + ':', p = IDEA_RE.test(id) && await S.get(at + 'p:' + id.split('.')[0]);
    if (!p || p.id !== id) return { error: 'That idea was taken down.' };
    const t = cleanPost(raw, 2, REPLY_MAX, true); if (t.error) return t;
    if ((p.c || 0) >= 200) return { error: 'This idea has all the comments it can take.' };
    if (!(await this.gap(who, 'r', REPLY_GAP))) return { error: 'Slow down a little, then try again.' };
    const cid = newId(); await S.put(at + 'c:' + id + ':' + cid, { id: cid, who, name, text: t.text, at: Date.now() });
    p.c = (p.c || 0) + 1; await S.put(at + 'p:' + p.who, p);
    return this.suggestComments(id, who);
  }
  async suggestUncomment(who, owner, id, cid) {
    const S = this.ctx.storage, at = 'sg:' + (await this.sgRound()) + ':', key = at + 'c:' + id + ':' + cid, c = IDEA_RE.test(id) && ID_RE.test(cid) && await S.get(key);
    if (!c) return { error: 'That comment is already gone.' };
    if (c.who !== who && !owner) return { error: 'That isn’t yours.' };
    await S.delete(key);
    const p = await S.get(at + 'p:' + id.split('.')[0]); if (p && p.id === id) { p.c = Math.max(0, (p.c || 0) - 1); await S.put(at + 'p:' + p.who, p); }
    return this.suggestComments(id, who);
  }
  // The board: fm:t:<id> (a thread, with its reply count n and last activity), fm:r:<thread id>:<reply id>.
  async forumList() {
    const all = [...(await this.ctx.storage.list({ prefix: 'fm:t:' })).values()].sort((a, b) => b.last - a.last);
    return { now: Date.now(), total: all.length, threads: all.slice(0, FORUM_SHOW).map(t => ({ id: t.id, name: t.name, title: t.title, at: t.at, last: t.last, n: t.n })) };
  }
  async forumThread(id, who) {
    const S = this.ctx.storage, t = ID_RE.test(id) && await S.get('fm:t:' + id);
    if (!t) return { error: 'That post was taken down.' };
    const rs = [...(await S.list({ prefix: 'fm:r:' + id + ':' })).values()].sort((a, b) => a.at - b.at);
    return { now: Date.now(), thread: { id: t.id, name: t.name, title: t.title, text: t.text, at: t.at, n: t.n, yours: t.who === who || undefined },
             replies: rs.map(r => ({ id: r.id, name: r.name, text: r.text, at: r.at, yours: r.who === who || undefined })) };
  }
  async forumPost(who, name, rawTitle, rawText) {
    const a = cleanPost(rawTitle, 4, 60); if (a.error) return { error: a.short ? 'Give your post a longer title.' : a.error };
    const b = cleanPost(rawText, 10, 600, true); if (b.error) return b;
    if (!(await this.gap(who, 't', FORUM_GAP))) return { error: 'Wait a minute before starting another post.' };
    const id = newId(), now = Date.now();
    await this.ctx.storage.put('fm:t:' + id, { id, who, name, title: a.text, text: b.text, at: now, last: now, n: 0 });
    return this.forumThread(id, who);
  }
  async forumReply(who, name, id, raw) {
    const S = this.ctx.storage, t = ID_RE.test(id) && await S.get('fm:t:' + id);
    if (!t) return { error: 'That post was taken down.' };
    const c = cleanPost(raw, 2, REPLY_MAX, true); if (c.error) return c;
    if (t.n >= 300) return { error: 'This post is full. Start a new one.' };
    if (!(await this.gap(who, 'r', REPLY_GAP))) return { error: 'Slow down a little, then try again.' };
    const rid = newId(), now = Date.now();
    await S.put('fm:r:' + id + ':' + rid, { id: rid, who, name, text: c.text, at: now });
    t.n++; t.last = now; await S.put('fm:t:' + id, t);
    return this.forumThread(id, who);
  }
  async forumDelete(who, owner, id, rid) {
    const S = this.ctx.storage, t = ID_RE.test(id) && await S.get('fm:t:' + id);
    if (!t) return { error: 'That post was taken down.' };
    if (rid) {
      const key = 'fm:r:' + id + ':' + rid, r = ID_RE.test(rid) && await S.get(key);
      if (!r) return { error: 'That reply is already gone.' };
      if (r.who !== who && !owner) return { error: 'That isn’t yours.' };
      await S.delete(key); t.n = Math.max(0, t.n - 1); await S.put('fm:t:' + id, t);
      return this.forumThread(id, who);
    }
    if (t.who !== who && !owner) return { error: 'That isn’t yours.' };
    await S.delete('fm:t:' + id); await this.wipe('fm:r:' + id + ':');
    return this.forumList();
  }
  async list() {
    const rooms = (await this.ctx.storage.get('rooms')) || {}, now = Date.now(); let changed = false;
    for (const [k, v] of Object.entries(rooms)) if (now - v.seen > 75000) { delete rooms[k]; changed = true; }
    if (changed) await this.ctx.storage.put('rooms', rooms);
    return Object.values(rooms).filter(r => r.pub && r.n > 0).sort((a, b) => b.created - a.created).slice(0, 60)
      .map(r => ({ code: r.code, name: r.name || '', host: r.host, n: r.n, max: r.max, rank: r.rank, phase: r.phase, quest: r.quest }));
  }
}
