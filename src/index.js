// Olympus Hunt server. Serves the game from /public and keeps player accounts and saves in a D1 database.
// Every route lives under /api/. Anything else is a file from /public.

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

  const user = await authed(req, env);
  if (!user) return json({ error: 'You are signed out. Sign in again.' }, 401);
  if (path === '/api/me' && method === 'GET') return json({ name: user.display });
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
