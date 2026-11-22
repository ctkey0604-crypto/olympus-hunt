/* ============================================================================
   Brick & Coin server (v0.07-v0.08) at brickncoin.com/api/*. Everything else on the
   site is a static file that Cloudflare serves without running this code, so only the
   game's own calls (about one a minute per player) use the free plan's requests.

   - Accounts are Olympus Hunt accounts: a name and a password, no email. Logging in
     asks Olympus Hunt's own server (the OH service binding) whether they're right,
     so Olympus Hunt's code and database are never touched. Then this server gives
     the player its own session.
   - Each player has one company, saved here (the save is the same text as a save code).
   - The shared market: every minute a player's game reports how much of each good it
     sold and bought (in "building-level minutes", so the server needs no product list).
     The server keeps each player's flow fading with a 5-minute half-life and adds them
     up. Every game turns the total into a gentle price move (see crowdMult() in the game):
     one player barely moves a price, a crowd dumping the same good moves it a lot, and
     it's capped. Reports are capped too, so a doctored game can't crash a price alone.
   - The players' leaderboard: real players only, by net worth.
   - Going public (v0.08): a company can sell up to 49% of itself in new shares. The server
     keeps the share register (how many shares exist, how many the owner has, which
     players hold the rest; Millbrook's simulated investors hold whatever players don't),
     the buying and selling pressure on each share (it fades over half an hour), and the
     dividends paid (as dividends per share, so paying them costs one row, not one per
     holder). Cash itself lives in each player's game, like everything else in the company.
   The totals, leaderboard and listings are worked out at most every 20 s and kept in
   one row, so a sync costs a few database rows whatever the number of players.
   ========================================================================== */
const SESSION_DAYS = 60;
const CROWD_HALF = 300;            // seconds: how fast a burst of selling fades (same as the game's CROWD_HALF)
const ACTIVE = 30 * 60e3;          // a player's flow counts while they've synced in the last 30 minutes
const ONLINE = 3 * 60e3;           // "online" on the leaderboard: synced in the last 3 minutes
const BOARD_DAYS = 30;             // the leaderboard shows players seen in the last 30 days
const AGG_EVERY = 20e3;            // work the totals out again at most this often
const HIST_EVERY = 300e3, HIST_KEEP = 26 * 3600e3;   // v0.12: each listing's share price every 5 minutes, kept a day, for the charts
const FLOW_CAP = 400;              // most building-level minutes of one good a player can report per minute
const SYNC_MIN = 15e3;             // reports closer together than this are ignored (the market is still returned)
const SAVE_MAX = 400e3;            // characters
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/, PID_RE = /^[a-z]{2,12}$/, TICK_RE = /^[A-Z0-9]{2,6}$/;
// going public (the game has the same numbers in 10_data.js)
const PUB_SHARES = 100000;         // an owner's shares before going public
const PUB_MAX = .49;               // the most of a company outside shareholders can own
const PUB_HALF = 1800;             // seconds: buying and selling pressure on a share fades with a 30-minute half-life
const PUB_DEPTH = .05;             // buying 5% of a company's value pushes its price up about 41% (the square-root law)
const PUB_MOVE = [.6, 1.6];        // the most players' trading can move a share price
const PUB_PREMIUM = 15, PUB_PREM_CAP = .25;   // investors add 15 minutes of steady profit to a company's value, at most 25% more
const GROWTH = [.5, 1.5], PUB_REVERT = 3;      // v0.11: × its profit trend; trading pressure fades up to 4× faster when stretched
                                               // (v0.10; it was an hour, up to 3× its value, so share prices ran far ahead of the company)
const IPO_DISCOUNT = .9, IPO_FEE = .05, ISSUE_FEE = .05, BUYBACK_FEE = .005;
const BAND = [.6, 1.7];            // a trade's price must be this close to the server's own idea of it
const RESERVED = ['MB10', 'TSW', 'FORG', 'CRMB', 'RDLN', 'SITW', 'GLDN', 'NOVA', 'PXC'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try { await schema(env); return await api(req, env, url.pathname, req.method); }
    catch (e) { console.log('api error', e && e.stack || e); return json({ error: 'Something went wrong on the server. Try again in a minute.' }, 500); }
  },
};

/* ---------- tables (made the first time, kept after) ---------- */
let schemaReady = null;
function schema(env) {
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS players (name TEXT PRIMARY KEY, display TEXT NOT NULL, company TEXT, nw REAL NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1, seen INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, flow TEXT, flow_t INTEGER NOT NULL DEFAULT 0,
      last_sync INTEGER NOT NULL DEFAULT 0, save TEXT, saved_at INTEGER NOT NULL DEFAULT 0, ticker TEXT, credit REAL NOT NULL DEFAULT 0)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS players_seen ON players(seen)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS players_nw ON players(nw)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT, t INTEGER NOT NULL DEFAULT 0)'),
    // v0.08: listed companies (dead = the buyout price per share once the owner has closed the company) and who holds them
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS listings (ticker TEXT PRIMARY KEY, owner TEXT NOT NULL, company TEXT, total REAL NOT NULL, own REAL NOT NULL,
      book REAL NOT NULL DEFAULT 0, profit REAL NOT NULL DEFAULT 0, fb REAL NOT NULL DEFAULT 0, fs REAL NOT NULL DEFAULT 0, ft INTEGER NOT NULL DEFAULT 0,
      dps REAL NOT NULL DEFAULT 0, paid REAL NOT NULL DEFAULT 0, listed INTEGER NOT NULL, dead REAL)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS listings_owner ON listings(owner)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS holdings (holder TEXT NOT NULL, ticker TEXT NOT NULL, shares REAL NOT NULL, cost REAL NOT NULL DEFAULT 0,
      seen REAL NOT NULL DEFAULT 0, PRIMARY KEY (holder, ticker))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS holdings_ticker ON holdings(ticker)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pub_hist (ticker TEXT NOT NULL, t INTEGER NOT NULL, px REAL NOT NULL, PRIMARY KEY (ticker, t))'),
  ]).then(async () => {   // v0.11: a listing's profit trend (added to tables made before it)
    const cols = (await env.DB.prepare('PRAGMA table_info(listings)').all()).results || [];
    if (!cols.some(c => c.name === 'growth')) await env.DB.prepare('ALTER TABLE listings ADD COLUMN growth REAL NOT NULL DEFAULT 1').run();
  }).catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ---------- the API ---------- */
async function api(req, env, path, method) {
  if (path === '/api/health') return json({ ok: true, game: 'brick-and-coin' });
  if (path === '/api/market' && method === 'GET') { const m = await market(env, Date.now()); return json(publicMarket(m, null)); }
  if (path === '/api/pubhist' && method === 'GET') {   // v0.12: a listing's share prices over the last day, oldest first
    const t = new URL(req.url).searchParams.get('t') || '';
    if (!TICK_RE.test(t)) return json({ error: 'Which company?' }, 400);
    const rows = (await env.DB.prepare('SELECT t, px FROM pub_hist WHERE ticker = ? AND t > ? ORDER BY t').bind(t, Date.now() - HIST_KEEP).all()).results || [];
    return json({ t, every: HIST_EVERY, pts: rows.map(r => [r.t, r4(r.px)]) });
  }
  if ((path === '/api/login' || path === '/api/register') && method === 'POST') return signIn(req, env, path === '/api/register');

  const user = await authed(req, env);
  if (!user) return json({ error: 'Please log in again.' }, 401);
  if (path === '/api/me' && method === 'GET') {
    const r = await env.DB.prepare('SELECT company, level, nw, saved_at, ticker FROM players WHERE name = ?').bind(user.name).first();
    return json({ name: user.display, company: r && r.company, level: r && r.level, nw: r && r.nw, savedAt: r && r.saved_at || 0, ticker: r && r.ticker });
  }
  if (path === '/api/save' && method === 'GET') {
    const r = await env.DB.prepare('SELECT save, saved_at FROM players WHERE name = ?').bind(user.name).first();
    return json({ save: r && r.save || null, savedAt: r && r.saved_at || 0, now: Date.now() });
  }
  if (path === '/api/save' && method === 'POST') {   // a save on its own: leaving the page, the main menu, a new company
    const b = await readJson(req), now = Date.now(), s = saveOf(b);
    if (b.clear === true) return startOver(env, user, now);
    if (s === false) return json({ error: 'That save is too big.' }, 413);
    if (!s) return json({ error: 'No save sent.' }, 400);
    await env.DB.prepare('UPDATE players SET save = ?, saved_at = ?, company = ?, nw = ?, level = ?, seen = ? WHERE name = ?')
      .bind(s, now, str(b.company, 24), num(b.nw), lvl(b.level), now, user.name).run();
    return json({ ok: true, savedAt: now });
  }
  if (path === '/api/sync' && method === 'POST') return sync(req, env, user);
  if (path === '/api/ipo' && method === 'POST') return ipo(req, env, user);
  if (path === '/api/float' && method === 'POST') return float(req, env, user);
  if (path === '/api/shares' && method === 'POST') return trade(req, env, user);
  if (path === '/api/logout' && method === 'POST') { await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(user.tokenHash).run(); return json({ ok: true }); }
  return json({ error: 'Not found.' }, 404);
}

/* ---------- accounts: the Olympus Hunt login ---------- */
async function signIn(req, env, create) {
  const b = await readJson(req), name = typeof b.name === 'string' ? b.name.trim() : '', password = typeof b.password === 'string' ? b.password : '';
  if (!NAME_RE.test(name)) return json({ error: 'Names are 3 to 20 letters, numbers or underscores.' }, 400);
  if (password.length < 6 || password.length > 100) return json({ error: create ? 'Passwords need at least 6 characters.' : 'Wrong name or password.' }, create ? 400 : 401);
  const r = await ohAsk(env, create ? '/api/register' : '/api/login', { name, password });
  if (r.status !== 200 || !r.data || typeof r.data.name !== 'string') return json({ error: (r.data && r.data.error) || 'Couldn’t reach the account server. Try again in a minute.' }, r.status === 200 ? 502 : r.status);
  const display = r.data.name, key = display.toLowerCase(), now = Date.now();
  await env.DB.prepare('INSERT INTO players (name, display, created) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET display = excluded.display').bind(key, display, now).run();
  const token = randomB64(32);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token, name, expires) VALUES (?, ?, ?)').bind(await sha256(token), key, now + SESSION_DAYS * 86400e3),
    env.DB.prepare('DELETE FROM sessions WHERE name = ? AND expires < ?').bind(key, now),
  ]);
  const p = await env.DB.prepare('SELECT company, level, saved_at FROM players WHERE name = ?').bind(key).first();
  return json({ name: display, token, company: p && p.company, level: p && p.level, savedAt: p && p.saved_at || 0 });
}
// Olympus Hunt's own login/register, through the service binding (no public request, no change to Olympus Hunt).
// Local testing (wrangler dev with --var DEV_LOGIN:1 and no binding): any name, password "secret1".
async function ohAsk(env, path, body) {
  if (!env.OH) {
    if (env.DEV_LOGIN !== '1') return { status: 503, data: { error: 'The account server isn’t connected.' } };
    return body.password === 'secret1' ? { status: 200, data: { name: body.name, token: 'dev' } } : { status: 401, data: { error: 'Wrong name or password.' } };
  }
  const r = await env.OH.fetch('https://olympushunt.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
}
async function authed(req, env) {
  const h = req.headers.get('Authorization') || '', token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token || token.length > 100) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare('SELECT s.name, s.expires, p.display FROM sessions s JOIN players p ON p.name = s.name WHERE s.token = ?').bind(tokenHash).first();
  if (!row || row.expires < Date.now()) return null;
  return { name: row.name, display: row.display, tokenHash };
}
// Start over: the company leaves the server and the leaderboard. If it was listed, its shareholders are bought out at
// today's price (paid to them the next time their game syncs).
async function startOver(env, user, now) {
  const L = await env.DB.prepare('SELECT * FROM listings WHERE owner = ? AND dead IS NULL').bind(user.name).first();
  const q = [env.DB.prepare('UPDATE players SET save = NULL, saved_at = ?, company = NULL, nw = 0, level = 1, ticker = NULL WHERE name = ?').bind(now, user.name)];
  if (L) q.push(env.DB.prepare('UPDATE listings SET dead = ? WHERE ticker = ?').bind(r4(sharePrice(L, now)), L.ticker));
  await env.DB.batch(q);
  if (L) MEM = null;
  return json({ ok: true });
}

/* ---------- the minute-by-minute sync ---------- */
async function sync(req, env, user) {
  const b = await readJson(req), now = Date.now();
  const row = await env.DB.prepare('SELECT flow, flow_t, last_sync, ticker, credit FROM players WHERE name = ?').bind(user.name).first() || {};
  const old = decayFlow(parseFlow(row.flow), now - (row.flow_t || now));
  const m = await market(env, now);
  // what everyone else is doing: the total minus this player's own part of it
  const mine = decayFlow(parseFlow(row.flow), m.t - (row.flow_t || m.t)), others = {};
  for (const p in m.crowd) { const s = Math.max(0, m.crowd[p][0] - (mine[p] ? mine[p][0] : 0)), q = Math.max(0, m.crowd[p][1] - (mine[p] ? mine[p][1] : 0)); if (s > .01 || q > .01) others[p] = [r3(s), r3(q)]; }
  // add this report (capped, and ignored if it comes too soon after the last)
  const gap = now - (row.last_sync || 0), counts = gap >= SYNC_MIN, flow = old;
  if (counts && b.flow && typeof b.flow === 'object') {
    const cap = FLOW_CAP * Math.min(5, Math.max(.25, gap / 60e3));
    let n = 0;
    for (const p in b.flow) {
      if (!PID_RE.test(p) || ++n > 40) continue;
      const v = b.flow[p]; if (!Array.isArray(v)) continue;
      const s = Math.min(cap, Math.max(0, +v[0] || 0)), q = Math.min(cap, Math.max(0, +v[1] || 0));
      if (s + q <= 0) continue;
      const f = flow[p] || (flow[p] = [0, 0]); f[0] += s; f[1] += q;
    }
  }
  for (const p in flow) if (flow[p][0] < .01 && flow[p][1] < .01) delete flow[p];
  const s = saveOf(b);
  if (s === false) return json({ error: 'That save is too big.' }, 413);
  const q = [];
  const sets = ['company = ?', 'nw = ?', 'level = ?', 'seen = ?', 'flow = ?', 'flow_t = ?', 'credit = 0'], vals = [str(b.company, 24), num(b.nw), lvl(b.level), now, JSON.stringify(roundFlow(flow)), now];
  if (counts) { sets.push('last_sync = ?'); vals.push(now); }
  if (s) { sets.push('save = ?', 'saved_at = ?'); vals.push(s, now); }
  q.push(env.DB.prepare(`UPDATE players SET ${sets.join(', ')} WHERE name = ?`).bind(...vals, user.name));
  // v0.08, an owner: the company's value and profit (they set its share price) and the dividends it paid since the last sync
  let own = null;
  if (row.ticker) {
    own = await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(row.ticker).first();
    if (own) {
      const out = own.total - own.own, div = counts ? Math.min(Math.max(0, +b.div || 0), Math.max(0, num(b.profit)) * 5 + 1) : 0;
      q.push(env.DB.prepare('UPDATE listings SET book = ?, profit = ?, growth = ?, company = ?, dps = dps + ?, paid = paid + ? WHERE ticker = ?')
        .bind(Math.max(0, num(b.book)), num(b.profit), growthOf(b), str(b.company, 24), out > 0 ? div / out : 0, div, own.ticker));
    }
  }
  // v0.08, a shareholder: dividends since the last look, buyouts of closed companies, and the holdings themselves
  const hold = await holdingsOf(env, user.name, q);
  await env.DB.batch(q);
  return json({ ...publicMarket(m, user.display), crowd: others, savedAt: s ? now : undefined,
    credit: r2((row.credit || 0) + hold.credit), holdings: hold.list, mine: own ? mineOf(own) : null, paidOut: hold.paidOut });
}
// a player's holdings, settling what's owed (dividends per share since last seen; buyouts) into q
async function holdingsOf(env, name, q) {
  const rows = (await env.DB.prepare('SELECT h.ticker, h.shares, h.cost, h.seen, l.dps, l.dead, l.company FROM holdings h JOIN listings l ON l.ticker = h.ticker WHERE h.holder = ?').bind(name).all()).results || [];
  let credit = 0; const list = [], paidOut = [];
  for (const h of rows) {
    const div = h.shares * Math.max(0, h.dps - h.seen);
    if (h.dead != null) {   // the company closed: bought out at its last price
      const cash = h.shares * h.dead + div; credit += cash; paidOut.push([h.ticker, h.company, r2(cash)]);
      q.push(env.DB.prepare('DELETE FROM holdings WHERE holder = ? AND ticker = ?').bind(name, h.ticker));
      continue;
    }
    if (div > 0) { credit += div; q.push(env.DB.prepare('UPDATE holdings SET seen = ? WHERE holder = ? AND ticker = ?').bind(h.dps, name, h.ticker)); }
    list.push([h.ticker, r4(h.shares), r2(h.cost)]);
  }
  return { credit, list, paidOut };
}
function mineOf(L) { return { ticker: L.ticker, total: r4(L.total), own: r4(L.own), listed: L.listed, paid: r2(L.paid) }; }

/* ---------- going public ---------- */
// What a share is worth to investors: the company's value plus 15 minutes of steady profit (at most 25% more), split
// over every share, then moved by players' buying and selling (square-root law, fading over half an hour). The game adds
// the market's mood and each company's own day-to-day wander on top, so the server checks trades within a wide band.
function growthOf(b) { const g = +b.growth; return Number.isFinite(g) ? Math.min(GROWTH[1], Math.max(GROWTH[0], g)) : 1; }
function fairPerShare(L) { const book = Math.max(0, L.book), g = L.growth == null ? 1 : L.growth; return Math.max(.01, (book + Math.min(PUB_PREM_CAP * book, PUB_PREMIUM * Math.max(0, L.profit) * g)) / L.total); }
function moveOf(L, fb, fs) { const D = PUB_DEPTH * fairPerShare(L) * L.total; return Math.min(PUB_MOVE[1], Math.max(PUB_MOVE[0], Math.sqrt((1 + fb / D) / (1 + fs / D)))); }
// players' pressure fades with a 30-minute half-life, faster the further it had pushed the price (v0.11: investors lean against it)
function pressure(L, now) {
  const s = Math.min(1, Math.abs(Math.log(moveOf(L, L.fb, L.fs))) / Math.log(PUB_MOVE[1]));
  const k = Math.pow(.5, Math.max(0, now - L.ft) / 1000 / (PUB_HALF / (1 + PUB_REVERT * s))); return [L.fb * k, L.fs * k];
}
function sharePrice(L, now) { const [fb, fs] = pressure(L, now); return fairPerShare(L) * moveOf(L, fb, fs); }
async function ipo(req, env, user) {
  const b = await readJson(req), now = Date.now(), f = +b.f, book = num(b.book), profit = num(b.profit), growth = growthOf(b);
  const p = await env.DB.prepare('SELECT company, ticker FROM players WHERE name = ?').bind(user.name).first();
  if (!p || !p.company) return json({ error: 'Save your company online first (it saves every few minutes).' }, 400);
  if (p.ticker) return json({ error: 'Your company is already public.' }, 409);
  if (!(f >= .05 && f <= PUB_MAX)) return json({ error: `You can sell 5% to ${PUB_MAX * 100}% of your company.` }, 400);
  if (!(book >= 1e5)) return json({ error: 'A company needs to be worth $100,000 (Level 3) to go public.' }, 400);
  const ticker = await newTicker(env, str(b.company, 24) || p.company);
  const L = { total: PUB_SHARES, own: PUB_SHARES, book, profit, growth, fb: 0, fs: 0, ft: now };
  const pre = fairPerShare(L), issued = PUB_SHARES * f / (1 - f), price = pre * IPO_DISCOUNT, raised = issued * price * (1 - IPO_FEE);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO listings (ticker, owner, company, total, own, book, profit, growth, ft, listed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(ticker, user.name, str(b.company, 24) || p.company, PUB_SHARES + issued, PUB_SHARES, book + raised, profit, growth, now, now),
    env.DB.prepare('UPDATE players SET ticker = ? WHERE name = ?').bind(ticker, user.name),
  ]);
  MEM = null;
  return json({ ok: true, ticker, issued: r4(issued), price: r4(price), raised: r2(raised), mine: { ticker, total: r4(PUB_SHARES + issued), own: PUB_SHARES, listed: now, paid: 0 } });
}
// The owner sells more new shares (up to 49% outside) or buys shares back from Millbrook's investors, at today's price.
async function float(req, env, user) {
  const b = await readJson(req), now = Date.now(), target = +b.f;
  const p = await env.DB.prepare('SELECT ticker FROM players WHERE name = ?').bind(user.name).first();
  const L = p && p.ticker && await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(p.ticker).first();
  if (!L) return json({ error: 'Your company isn’t public.' }, 400);
  if (b.book != null) { L.book = Math.max(0, num(b.book)); L.profit = num(b.profit); L.growth = growthOf(b); }
  const held = (await env.DB.prepare('SELECT COALESCE(SUM(shares), 0) AS n FROM holdings WHERE ticker = ?').bind(L.ticker).first()).n;
  const price = sharePrice(L, now), out = L.total - L.own;
  if (!(target >= 0 && target <= PUB_MAX + 1e-9)) return json({ error: `Outside shareholders can own at most ${PUB_MAX * 100}%.` }, 400);
  let total = L.total, cash = 0, fb = pressure(L, now)[0], fs = pressure(L, now)[1];
  if (target > out / L.total + 1e-9) {          // issue new shares
    const n = (target * L.total - out) / (1 - target);
    total += n; cash = n * price * (1 - ISSUE_FEE); fs += n * price;
  } else if (target < out / L.total - 1e-9) {   // buy back from the investors (players' shares can't be bought back)
    const n = Math.min(out - held, (out - target * L.total) / (1 - target));
    if (n <= 1e-6) return json({ error: 'Players hold all the other shares: there are none to buy back.' }, 400);
    total -= n; cash = -n * price * (1 + BUYBACK_FEE); fb += n * price;
  } else return json({ error: 'Nothing to change.' }, 400);
  if (total - L.own < 1e-6) {   // all bought back: the company is private again
    await env.DB.batch([env.DB.prepare('DELETE FROM listings WHERE ticker = ?').bind(L.ticker), env.DB.prepare('UPDATE players SET ticker = NULL WHERE name = ?').bind(user.name)]);
    MEM = null;
    return json({ ok: true, cash: r2(cash), price: r4(price), mine: null });
  }
  await env.DB.prepare('UPDATE listings SET total = ?, book = ?, fb = ?, fs = ?, ft = ? WHERE ticker = ?').bind(total, L.book + cash, fb, fs, now, L.ticker).run();
  MEM = null;
  return json({ ok: true, cash: r2(cash), price: r4(price), mine: mineOf({ ...L, total }) });
}
// A player buys or sells shares of another player's company, from or to Millbrook's investors, at today's price.
async function trade(req, env, user) {
  const b = await readJson(req), now = Date.now(), ticker = String(b.ticker || ''), n = +b.shares, side = b.side;
  if (!TICK_RE.test(ticker) || !(n > 0) || (side !== 'buy' && side !== 'sell')) return json({ error: 'That trade doesn’t make sense.' }, 400);
  const L = await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(ticker).first();
  if (!L) return json({ error: 'That company isn’t listed any more.' }, 404);
  if (L.owner === user.name) return json({ error: 'That’s your own company: buy shares back from Your company instead.' }, 400);
  const price = sharePrice(L, now), asked = +b.price;
  if (!(asked > 0) || asked / price < BAND[0] || asked / price > BAND[1]) return json({ error: 'The price moved. Try again.', price: r4(price) }, 409);
  const h = await env.DB.prepare('SELECT * FROM holdings WHERE holder = ? AND ticker = ?').bind(user.name, ticker).first();
  const owed = h ? h.shares * Math.max(0, L.dps - h.seen) : 0;
  let [fb, fs] = pressure(L, now), shares = h ? h.shares : 0, cost = h ? h.cost : 0;
  if (side === 'buy') {
    const held = (await env.DB.prepare('SELECT COALESCE(SUM(shares), 0) AS n FROM holdings WHERE ticker = ?').bind(ticker).first()).n;
    if (n > L.total - L.own - held + 1e-6) return json({ error: `Only ${Math.floor(Math.max(0, L.total - L.own - held))} shares are for sale.` }, 400);
    shares += n; cost += n * asked; fb += n * asked;
  } else {
    if (n > shares + 1e-6) return json({ error: 'You don’t have that many shares.' }, 400);
    cost *= Math.max(0, 1 - n / shares); shares -= n; fs += n * asked;
  }
  const q = [env.DB.prepare('UPDATE listings SET fb = ?, fs = ?, ft = ? WHERE ticker = ?').bind(fb, fs, now, ticker)];
  if (shares < 1e-6) q.push(env.DB.prepare('DELETE FROM holdings WHERE holder = ? AND ticker = ?').bind(user.name, ticker));
  else q.push(env.DB.prepare('INSERT INTO holdings (holder, ticker, shares, cost, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(holder, ticker) DO UPDATE SET shares = excluded.shares, cost = excluded.cost, seen = excluded.seen')
    .bind(user.name, ticker, shares, cost, L.dps));
  await env.DB.batch(q);
  MEM = null;
  return json({ ok: true, price: r4(asked), credit: r2(owed), holding: shares < 1e-6 ? null : [ticker, r4(shares), r2(cost)] });
}
async function newTicker(env, company) {
  const words = company.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  let base = words.length > 1 ? words.map(w => w[0]).join('').slice(0, 4) : (words[0] || 'CO').slice(0, 4);
  if (base.length < 3 && words[0]) base = (base + words[0].slice(1)).slice(0, 4);
  base = (base + 'XX').slice(0, Math.max(3, Math.min(4, base.length)));
  for (let k = 0; k < 40; k++) {
    const t = k ? base.slice(0, 4) + (k + 1) : base;
    if (RESERVED.includes(t)) continue;
    if (!(await env.DB.prepare('SELECT 1 FROM listings WHERE ticker = ?').bind(t).first())) return t;
  }
  return 'P' + Math.floor(Math.random() * 90000 + 10000);
}

/* ---------- the totals, the leaderboard and the listings, kept in one row ---------- */
let MEM = null;   // this server copy's last look at that row
async function market(env, now) {
  if (MEM && now - MEM.t < AGG_EVERY / 2) return MEM;
  const row = await env.DB.prepare("SELECT v, t FROM meta WHERE k = 'market'").first();
  if (row && now - row.t < AGG_EVERY) { try { MEM = JSON.parse(row.v); return MEM; } catch (e) {} }
  const act = (await env.DB.prepare('SELECT flow, flow_t, seen FROM players WHERE seen > ?').bind(now - ACTIVE).all()).results || [];
  const crowd = {}; let online = 0;
  for (const r of act) {
    if (r.seen > now - ONLINE) online++;
    const f = decayFlow(parseFlow(r.flow), now - r.flow_t);
    for (const p in f) { const c = crowd[p] || (crowd[p] = [0, 0]); c[0] += f[p][0]; c[1] += f[p][1]; }
  }
  const top = (await env.DB.prepare('SELECT display, company, nw, level, seen FROM players WHERE seen > ? AND company IS NOT NULL ORDER BY nw DESC LIMIT 25').bind(now - BOARD_DAYS * 86400e3).all()).results || [];
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE seen > ? AND company IS NOT NULL').bind(now - BOARD_DAYS * 86400e3).first();
  const lst = (await env.DB.prepare(`SELECT l.ticker, l.company, p.display, l.total, l.own, l.book, l.profit, l.growth, l.fb, l.fs, l.ft, l.paid, l.listed, p.seen,
      (SELECT COALESCE(SUM(h.shares), 0) FROM holdings h WHERE h.ticker = l.ticker) AS held,
      (SELECT COUNT(*) FROM holdings h WHERE h.ticker = l.ticker) AS holders
    FROM listings l JOIN players p ON p.name = l.owner WHERE l.dead IS NULL ORDER BY l.book DESC LIMIT 40`).all()).results || [];
  MEM = { t: now, crowd: roundFlow(crowd), online, players: total ? total.n : top.length,
    board: top.map(r => [r.display, r.company, Math.round(r.nw), r.level, r.seen > now - ONLINE ? 1 : 0]),
    // a listing: ticker, company, owner, shares, owner's shares, value, profit/min, buying, selling (both $, at ft), ft, dividends paid, listed, players' shares, holders, owner online, profit trend (v0.11)
    listings: lst.map(L => [L.ticker, L.company, L.display, r4(L.total), r4(L.own), r2(L.book), r2(L.profit), r2(L.fb), r2(L.fs), L.ft, r2(L.paid), L.listed, r4(L.held), L.holders, L.seen > now - ONLINE ? 1 : 0, r4(L.growth == null ? 1 : L.growth)]) };
  await env.DB.prepare("INSERT INTO meta (k, v, t) VALUES ('market', ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, t = excluded.t").bind(JSON.stringify(MEM), now).run();
  // v0.12: once every 5 minutes, each listing's share price for the charts (before the market's mood and the company's own
  // wander, which the game adds, as it does for today's price). A second server copy's try for the same slot is ignored.
  const slot = Math.floor(now / HIST_EVERY) * HIST_EVERY;
  if (lst.length && slot > HIST_T) {
    HIST_T = slot;
    await env.DB.batch([...lst.map(L => env.DB.prepare('INSERT OR IGNORE INTO pub_hist (ticker, t, px) VALUES (?, ?, ?)').bind(L.ticker, slot, r4(sharePrice(L, now)))),
      env.DB.prepare('DELETE FROM pub_hist WHERE t < ?').bind(now - HIST_KEEP)]);
  }
  return MEM;
}
let HIST_T = 0;
function publicMarket(m, me) { return { now: Date.now(), t: m.t, crowd: m.crowd, online: m.online, players: m.players, board: m.board, listings: m.listings || [], me }; }

/* ---------- helpers ---------- */
function parseFlow(s) { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function decayFlow(f, ms) { const k = Math.pow(.5, Math.max(0, ms) / 1000 / CROWD_HALF), o = {}; for (const p in f) if (Array.isArray(f[p])) o[p] = [(+f[p][0] || 0) * k, (+f[p][1] || 0) * k]; return o; }
function roundFlow(f) { const o = {}; for (const p in f) o[p] = [r3(f[p][0]), r3(f[p][1])]; return o; }
const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000;
const num = x => (Number.isFinite(+x) ? Math.max(-1e15, Math.min(1e15, +x)) : 0);
const lvl = x => Math.max(1, Math.min(9, Math.floor(+x) || 1));
const str = (x, n) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : null);
function saveOf(b) { if (typeof b.save !== 'string' || !b.save) return null; return b.save.length > SAVE_MAX ? false : b.save; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
async function readJson(req) { try { return await req.json(); } catch (e) { return {}; } }
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
function randomB64(n) { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
