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
   - Going public (v0.08): a company can sell up to 90% of itself in new shares (v0.18; it was 49%). The server
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
const PUB_MAX = .9;                // the most of a company outside shareholders can own (v0.18; it was 49%). The owner always runs it
// v0.18, freer going public: the owner picks the price, the ticker and the dividend, and can offer to buy shares back from players
const IPO_PRICE = [.8, 1.25];      // an IPO's price, against what investors think a share is worth
const DIV_MAX = .8, DIV_STD = .3, DIV_WAIT = 3600e3, DIV_HALF = 12 * 3600e3;   // dividends: up to 80% of profit, changed at most once an hour; investors come to believe a change over half a day
const ISSUE_WAIT = 3600e3;         // one sale of new shares an hour
const TENDER = [1, 1.25], TENDER_FOR = 24 * 3600e3, TENDER_MAX = .1;   // an offer to players: up to 25% over the price, for a day, one a day, up to 10% of the company's value
const slow = (env, ms) => env.DEV_FAST === '1' ? Math.min(ms, 4000) : ms;   // local tests only (server_check.js): the waits take seconds
const OWN_TICK = /^[A-Z][A-Z0-9]{1,4}$/;
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
    // v0.18: the dividend rate, what it was and when it changed; money raised from investors; the last sale of new shares;
    // and an offer to buy shares from players (price, shares left, until)
    for (const [c, def] of [['divr', 'REAL NOT NULL DEFAULT 0.3'], ['divp', 'REAL NOT NULL DEFAULT 0.3'], ['divt', 'INTEGER NOT NULL DEFAULT 0'], ['raised', 'REAL NOT NULL DEFAULT 0'],
      ['issuet', 'INTEGER NOT NULL DEFAULT 0'], ['tp', 'REAL NOT NULL DEFAULT 0'], ['tn', 'REAL NOT NULL DEFAULT 0'], ['tt', 'INTEGER NOT NULL DEFAULT 0']])
      if (!cols.some(x => x.name === c)) await env.DB.prepare(`ALTER TABLE listings ADD COLUMN ${c} ${def}`).run();
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
  if (path === '/api/dividend' && method === 'POST') return dividend(req, env, user);       // v0.18
  if (path === '/api/tender' && method === 'POST') return tender(req, env, user);
  if (path === '/api/tender/sell' && method === 'POST') return tenderSell(req, env, user);
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
// today's price, or its fair one if players have pushed it above that (paid to them the next time their game syncs).
async function startOver(env, user, now) {
  const L = await env.DB.prepare('SELECT * FROM listings WHERE owner = ? AND dead IS NULL').bind(user.name).first();
  const q = [env.DB.prepare('UPDATE players SET save = NULL, saved_at = ?, company = NULL, nw = 0, level = 1, ticker = NULL WHERE name = ?').bind(now, user.name)];
  if (L) q.push(env.DB.prepare('UPDATE listings SET dead = ? WHERE ticker = ?').bind(r4(ownerPrice(L, now, true)), L.ticker));
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
  let own = null, refund = 0;
  if (row.ticker) {
    own = await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(row.ticker).first();
    if (own) {
      const out = own.total - own.own, div = counts ? Math.min(Math.max(0, +b.div || 0), Math.max(0, num(b.profit)) * 5 + 1) : 0;
      q.push(env.DB.prepare('UPDATE listings SET book = ?, profit = ?, growth = ?, company = ?, dps = dps + ?, paid = paid + ? WHERE ticker = ?')
        .bind(Math.max(0, num(b.book)), num(b.profit), growthOf(b), str(b.company, 24), out > 0 ? div / out : 0, div, own.ticker));
      if (own.tn > 0 && now >= own.tt) { refund = own.tn * own.tp * (1 + BUYBACK_FEE); own.tn = 0; q.push(env.DB.prepare('UPDATE listings SET tn = 0 WHERE ticker = ?').bind(own.ticker)); }   // v0.18: an offer that ended: what wasn't used comes back
    }
  }
  // v0.08, a shareholder: dividends since the last look, buyouts of closed companies, and the holdings themselves
  const hold = await holdingsOf(env, user.name, q);
  await env.DB.batch(q);
  return json({ ...publicMarket(m, user.display), crowd: others, savedAt: s ? now : undefined,
    credit: r2((row.credit || 0) + hold.credit), holdings: hold.list, mine: own ? mineOf(own) : null, paidOut: hold.paidOut, refund: refund ? r2(refund) : undefined });
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
function mineOf(L) { return { ticker: L.ticker, total: r4(L.total), own: r4(L.own), listed: L.listed, paid: r2(L.paid), divr: r4(divr(L)), divp: r4(L.divp == null ? divr(L) : L.divp), divt: L.divt || 0, raised: r2(L.raised || 0), issuet: L.issuet || 0, tp: r4(L.tp || 0), tn: r4(L.tn || 0), tt: L.tt || 0 }; }

/* ---------- going public ---------- */
// What a share is worth to investors: the company's value plus 15 minutes of steady profit (at most 25% more), split
// over every share, then moved by players' buying and selling (square-root law, fading over half an hour). The game adds
// the market's mood and each company's own day-to-day wander on top, so the server checks trades within a wide band.
function growthOf(b) { const g = +b.growth; return Number.isFinite(g) ? Math.min(GROWTH[1], Math.max(GROWTH[0], g)) : 1; }
// v0.18: the dividend rate now, and the one investors believe in: it moves to a new rate over half a day, so a rate can't be put
// up to sell shares dear and straight down again to buy them back cheap. Steadier dividends are worth more: from 0.6x the
// minutes of profit at none, through 1x at 30% (what every company paid before), to 1.67x at 80%.
function divr(L) { return L.divr == null ? DIV_STD : L.divr; }
function divSeen(L, now) { const r = divr(L), p = L.divp == null ? r : L.divp; return r + (p - r) * Math.pow(.5, Math.max(0, now - (L.divt || 0)) / DIV_HALF); }
function fairPerShare(L, now = Date.now()) {
  const book = Math.max(0, L.book), g = L.growth == null ? 1 : L.growth, d = .6 + .4 * divSeen(L, now) / DIV_STD;
  return Math.max(.01, (book + Math.min(PUB_PREM_CAP * book, PUB_PREMIUM * Math.max(0, L.profit) * g * d)) / L.total);
}
// v0.18: how much of an offering investors take at a price (against what they think it's worth): all of it at 10% under, none at
// 30% over; they pay up for a company whose profit is climbing. And selling most of a company in one go costs up to 25% more off.
function ipoTaken(m, growth) { return Math.min(1, Math.max(0, (1.3 * (1 + .2 * (growth - 1)) - m) / .4)); }
function bigSale(f) { return 1 - .25 * Math.min(1, Math.max(0, (f - .5) / .4)); }
function moveOf(L, fb, fs) { const D = PUB_DEPTH * fairPerShare(L) * L.total; return Math.min(PUB_MOVE[1], Math.max(PUB_MOVE[0], Math.sqrt((1 + fb / D) / (1 + fs / D)))); }
// players' pressure fades with a 30-minute half-life, faster the further it had pushed the price (v0.11: investors lean against it)
function pressure(L, now) {
  const s = Math.min(1, Math.abs(Math.log(moveOf(L, L.fb, L.fs))) / Math.log(PUB_MOVE[1]));
  const k = Math.pow(.5, Math.max(0, now - L.ft) / 1000 / (PUB_HALF / (1 + PUB_REVERT * s))); return [L.fb * k, L.fs * k];
}
function sharePrice(L, now) { const [fb, fs] = pressure(L, now); return fairPerShare(L) * moveOf(L, fb, fs); }
// v0.17: a trade pays the price it makes. The shares go through a bit at a time, each bit at the price the ones before it left.
// (Until then a whole order was filled at the price from before it moved the market, so buying and selling straight back
// made money from nothing.) asked is the game's price now: this one times the market's mood and the company's own wander.
const FILL_STEPS = 40;
function fill(L, now, n, side, asked) {
  let [fb, fs] = pressure(L, now), cash = 0; const m0 = moveOf(L, fb, fs), dn = n / FILL_STEPS, buy = side === 'buy';
  for (let k = 0; k < FILL_STEPS; k++) {
    const half = dn * asked * moveOf(L, fb, fs) / m0 / 2, c = dn * asked * moveOf(L, fb + (buy ? half : 0), fs + (buy ? 0 : half)) / m0;
    cash += c; if (buy) fb += c; else fs += c;
  }
  return { cash, fb, fs };
}
// what the owner deals at: the fair price, never one that players' trading has pushed their way (v0.17)
function ownerPrice(L, now, sell) { const [fb, fs] = pressure(L, now), m = moveOf(L, fb, fs); return fairPerShare(L) * (sell ? Math.min(1, m) : Math.max(1, m)); }
async function ipo(req, env, user) {
  const b = await readJson(req), now = Date.now(), f = +b.f, book = num(b.book), profit = num(b.profit), growth = growthOf(b);
  const p = await env.DB.prepare('SELECT company, ticker FROM players WHERE name = ?').bind(user.name).first();
  if (!p || !p.company) return json({ error: 'Save your company online first (it saves every few minutes).' }, 400);
  if (p.ticker) return json({ error: 'Your company is already public.' }, 409);
  if (!(f >= .05 && f <= PUB_MAX)) return json({ error: `You can sell 5% to ${PUB_MAX * 100}% of your company.` }, 400);
  // v0.18: the owner's price, dividend and ticker (a game from before it sends none of them: 10% under, 30%, and one made up)
  const own = b.m != null, m = own ? +b.m : IPO_DISCOUNT, dv = b.div != null ? +b.div : DIV_STD, want = typeof b.ticker === 'string' ? b.ticker.trim().toUpperCase() : '';
  if (!(m >= IPO_PRICE[0] - 1e-9 && m <= IPO_PRICE[1] + 1e-9)) return json({ error: 'Pick a price from 20% under to 25% over.' }, 400);
  if (!(dv >= 0 && dv <= DIV_MAX + 1e-9)) return json({ error: `Dividends can be 0% to ${DIV_MAX * 100}% of profit.` }, 400);
  if (want && (!OWN_TICK.test(want) || RESERVED.includes(want))) return json({ error: RESERVED.includes(want) ? 'That ticker is taken.' : 'A ticker is 2 to 5 letters or numbers, starting with a letter.' }, 400);
  if (want && await env.DB.prepare('SELECT 1 FROM listings WHERE ticker = ?').bind(want).first()) return json({ error: 'That ticker is taken.' }, 409);
  if (!(book >= 1e5)) return json({ error: 'A company needs to be worth $100,000 (Level 3) to go public.' }, 400);
  const ticker = want || await newTicker(env, str(b.company, 24) || p.company);
  const L = { total: PUB_SHARES, own: PUB_SHARES, book, profit, growth, fb: 0, fs: 0, ft: now, divr: dv, divp: dv, divt: 0 };
  const pre = fairPerShare(L, now), taken = own ? ipoTaken(m, growth) : 1, issued = PUB_SHARES * f / (1 - f) * taken, price = pre * m * (own ? bigSale(f) : 1), raised = issued * price * (1 - IPO_FEE);
  if (issued < 100) return json({ error: 'No investor takes it at that price. Try a lower one.' }, 409);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO listings (ticker, owner, company, total, own, book, profit, growth, ft, listed, divr, divp, raised, issuet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(ticker, user.name, str(b.company, 24) || p.company, PUB_SHARES + issued, PUB_SHARES, book + raised, profit, growth, now, now, dv, dv, raised, now),
    env.DB.prepare('UPDATE players SET ticker = ? WHERE name = ?').bind(ticker, user.name),
  ]);
  MEM = null;
  return json({ ok: true, ticker, issued: r4(issued), price: r4(price), raised: r2(raised), taken: r4(taken), mine: mineOf({ ...L, ticker, total: PUB_SHARES + issued, listed: now, paid: 0, raised, issuet: now }) });
}
// The owner sells more new shares (up to 90% outside, once an hour) or buys shares back from Millbrook's investors, at today's price.
async function float(req, env, user) {
  const b = await readJson(req), now = Date.now(), target = +b.f;
  const p = await env.DB.prepare('SELECT ticker FROM players WHERE name = ?').bind(user.name).first();
  const L = p && p.ticker && await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(p.ticker).first();
  if (!L) return json({ error: 'Your company isn’t public.' }, 400);
  if (b.book != null) { L.book = Math.max(0, num(b.book)); L.profit = num(b.profit); L.growth = growthOf(b); }
  const held = (await env.DB.prepare('SELECT COALESCE(SUM(shares), 0) AS n FROM holdings WHERE ticker = ?').bind(L.ticker).first()).n;
  const out = L.total - L.own, price = ownerPrice(L, now, target > out / L.total);
  if (!(target >= 0 && target <= PUB_MAX + 1e-9)) return json({ error: `Outside shareholders can own at most ${PUB_MAX * 100}%.` }, 400);
  let total = L.total, cash = 0; const [fb, fs] = pressure(L, now);   // an offering or a buyback goes through the bank: it doesn't push the price (v0.17)
  if (target > out / L.total + 1e-9) {          // issue new shares
    const free = (L.issuet || 0) + slow(env, ISSUE_WAIT); if (now < free) return json({ error: `Investors need a while between sales: wait ${Math.ceil((free - now) / 60e3)} min.` }, 429);
    const n = (target * L.total - out) / (1 - target);
    total += n; cash = n * price * bigSale(n / total) * (1 - ISSUE_FEE);
  } else if (target < out / L.total - 1e-9) {   // buy back from the investors (players' shares can't be bought back)
    const n = Math.min(out - held, (out - target * L.total) / (1 - target));
    if (n <= 1e-6) return json({ error: 'Players hold all the other shares: there are none to buy back.' }, 400);
    total -= n; cash = -n * price * (1 + BUYBACK_FEE);
  } else return json({ error: 'Nothing to change.' }, 400);
  if (total - L.own < 1e-6) {   // all bought back: the company is private again
    await env.DB.batch([env.DB.prepare('DELETE FROM listings WHERE ticker = ?').bind(L.ticker), env.DB.prepare('UPDATE players SET ticker = NULL WHERE name = ?').bind(user.name)]);
    MEM = null;
    return json({ ok: true, cash: r2(cash), price: r4(price), mine: null, refund: L.tn > 0 ? r2(L.tn * L.tp * (1 + BUYBACK_FEE)) : undefined });   // an offer nobody's left to take
  }
  const raised = Math.max(0, (L.raised || 0) + cash), issuet = cash > 0 ? now : L.issuet || 0;
  await env.DB.prepare('UPDATE listings SET total = ?, book = ?, fb = ?, fs = ?, ft = ?, raised = ?, issuet = ? WHERE ticker = ?').bind(total, L.book + cash, fb, fs, now, raised, issuet, L.ticker).run();
  MEM = null;
  return json({ ok: true, cash: r2(cash), price: r4(price), mine: mineOf({ ...L, total, raised, issuet }) });
}
// v0.18: the owner sets how much of its profit the company pays out.
async function dividend(req, env, user) {
  const b = await readJson(req), now = Date.now(), rate = +b.rate, L = await ownListing(env, user);
  if (!L) return json({ error: 'Your company isn’t public.' }, 400);
  if (!(rate >= 0 && rate <= DIV_MAX + 1e-9)) return json({ error: `Dividends can be 0% to ${DIV_MAX * 100}% of profit.` }, 400);
  const free = (L.divt || 0) + slow(env, DIV_WAIT); if (now < free) return json({ error: `You can change it again in ${Math.ceil((free - now) / 60e3)} min.` }, 429);
  const seen = divSeen(L, now);
  await env.DB.prepare('UPDATE listings SET divr = ?, divp = ?, divt = ? WHERE ticker = ?').bind(rate, seen, now, L.ticker).run();
  MEM = null;
  return json({ ok: true, mine: mineOf({ ...L, divr: rate, divp: seen, divt: now }) });
}
async function ownListing(env, user) {
  const p = await env.DB.prepare('SELECT ticker FROM players WHERE name = ?').bind(user.name).first();
  return p && p.ticker ? env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(p.ticker).first() : null;
}
// v0.18: an offer to buy the company's shares from the players who hold them, for a day. The game pays for all of it when it's
// made; what isn't used comes back when it ends (sync) or is called off. One a day, for up to 10% of the company's value.
async function tender(req, env, user) {
  const b = await readJson(req), now = Date.now(), L = await ownListing(env, user);
  if (!L) return json({ error: 'Your company isn’t public.' }, 400);
  if (b.cancel === true) {
    if (!(L.tn > 0)) return json({ error: 'There’s no offer to call off.' }, 400);
    const back = L.tn * L.tp * (1 + BUYBACK_FEE);
    await env.DB.prepare('UPDATE listings SET tn = 0 WHERE ticker = ?').bind(L.ticker).run();
    MEM = null;
    return json({ ok: true, refund: r2(back), mine: mineOf({ ...L, tn: 0 }) });
  }
  if (now < (L.tt || 0)) return json({ error: `One offer a day: the next can start in ${Math.ceil((L.tt - now) / 3600e3)} h.` }, 429);
  const prem = +b.prem, px = +b.price, mk = sharePrice(L, now);
  if (!(prem >= TENDER[0] - 1e-9 && prem <= TENDER[1] + 1e-9)) return json({ error: 'Offer from today’s price to 25% over it.' }, 400);
  if (!(px > 0) || px / mk < BAND[0] || px / mk > BAND[1]) return json({ error: 'The price moved. Try again.', price: r4(mk) }, 409);
  const held = (await env.DB.prepare('SELECT COALESCE(SUM(shares), 0) AS n FROM holdings WHERE ticker = ?').bind(L.ticker).first()).n, n = Math.min(+b.shares || 0, held), tp = px * prem;
  if (!(n > 1e-3)) return json({ error: 'No player holds your shares.' }, 400);
  const cost = n * tp * (1 + BUYBACK_FEE);
  if (cost > TENDER_MAX * Math.max(0, L.book) + .01) return json({ error: `An offer can be worth up to ${TENDER_MAX * 100}% of the company.` }, 400);
  const old = L.tn > 0 ? L.tn * L.tp * (1 + BUYBACK_FEE) : 0;   // an ended one whose money hasn't gone back yet
  await env.DB.prepare('UPDATE listings SET tp = ?, tn = ?, tt = ? WHERE ticker = ?').bind(tp, n, now + slow(env, TENDER_FOR), L.ticker).run();
  MEM = null;
  return json({ ok: true, cost: r2(cost), refund: r2(old), mine: mineOf({ ...L, tp, tn: n, tt: now + slow(env, TENDER_FOR) }) });
}
// A player sells into an offer: the shares are cancelled, and the money was set aside when the offer was made.
async function tenderSell(req, env, user) {
  const b = await readJson(req), now = Date.now(), ticker = String(b.ticker || '');
  if (!TICK_RE.test(ticker) || !(+b.shares > 0)) return json({ error: 'That doesn’t make sense.' }, 400);
  const L = await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(ticker).first();
  if (!L || !(L.tn > 0) || now >= L.tt) return json({ error: 'That offer has ended.' }, 409);
  const h = await env.DB.prepare('SELECT * FROM holdings WHERE holder = ? AND ticker = ?').bind(user.name, ticker).first();
  const n = Math.min(+b.shares, h ? h.shares : 0, L.tn);
  if (!(n > 1e-6)) return json({ error: 'You own none of it.' }, 400);
  // both sides change together or not at all: only if this player still holds exactly what was read, and the offer still has
  // room (changes() is 1 when the line before it went through). Two sells at once can't both count the same shares.
  const owed = h.shares * Math.max(0, L.dps - h.seen), left = h.shares - n, cost = h.cost * Math.max(0, left / h.shares), total = L.total - n;
  const done = await env.DB.batch([
    env.DB.prepare('UPDATE holdings SET shares = ?, cost = ?, seen = ? WHERE holder = ? AND ticker = ? AND shares = ? AND seen = ? AND EXISTS (SELECT 1 FROM listings WHERE ticker = ? AND dead IS NULL AND tt > ? AND tn >= ?)')
      .bind(left, cost, L.dps, user.name, ticker, h.shares, h.seen, ticker, now, n - 1e-6),
    env.DB.prepare('UPDATE listings SET tn = MAX(0, tn - ?), total = total - ?, raised = MAX(0, raised - ?) WHERE ticker = ? AND changes() = 1').bind(n, n, n * L.tp, ticker),
  ]);
  if (!(done[0].meta && done[0].meta.changes === 1)) return json({ error: 'The offer just changed. Try again.' }, 409);
  const q = [env.DB.prepare('DELETE FROM holdings WHERE holder = ? AND ticker = ? AND shares < 1e-6').bind(user.name, ticker)];
  if (total - L.own < 1e-6) {   // that was the last share outside: the company is private again, and what's left of the offer goes back
    const rest = Math.max(0, L.tn - n);
    q.push(env.DB.prepare('DELETE FROM listings WHERE ticker = ?').bind(ticker), env.DB.prepare('UPDATE players SET ticker = NULL, credit = credit + ? WHERE name = ?').bind(rest > 1e-6 ? rest * L.tp * (1 + BUYBACK_FEE) : 0, L.owner));
  }
  await env.DB.batch(q);
  MEM = null;
  return json({ ok: true, cash: r2(n * L.tp), shares: r4(n), credit: r2(owed), holding: left < 1e-6 ? null : [ticker, r4(left), r2(cost)] });
}
// A player buys or sells shares of another player's company, from or to Millbrook's investors, at today's price.
async function trade(req, env, user) {
  const b = await readJson(req), now = Date.now(), ticker = String(b.ticker || ''), side = b.side; let n = +b.shares;
  if (!TICK_RE.test(ticker) || !(n > 0) || (side !== 'buy' && side !== 'sell')) return json({ error: 'That trade doesn’t make sense.' }, 400);
  const L = await env.DB.prepare('SELECT * FROM listings WHERE ticker = ? AND dead IS NULL').bind(ticker).first();
  if (!L) return json({ error: 'That company isn’t listed any more.' }, 404);
  if (L.owner === user.name) return json({ error: 'That’s your own company: buy shares back from Your company instead.' }, 400);
  const price = sharePrice(L, now), asked = +b.price;
  if (!(asked > 0) || asked / price < BAND[0] || asked / price > BAND[1]) return json({ error: 'The price moved. Try again.', price: r4(price) }, 409);
  const h = await env.DB.prepare('SELECT * FROM holdings WHERE holder = ? AND ticker = ?').bind(user.name, ticker).first();
  const owed = h ? h.shares * Math.max(0, L.dps - h.seen) : 0;
  let shares = h ? h.shares : 0, cost = h ? h.cost : 0, F;
  if (side === 'buy') {
    const held = (await env.DB.prepare('SELECT COALESCE(SUM(shares), 0) AS n FROM holdings WHERE ticker = ?').bind(ticker).first()).n;
    const avail = Math.max(0, L.total - L.own - held); if (n > avail + .01 || avail < 1e-6) return json({ error: `Only ${Math.floor(avail)} shares are for sale.` }, 400);
    n = Math.min(n, avail);   // a game knows the numbers to 4 places: buying the very last share shouldn't trip on the fifth (v0.18)
    F = fill(L, now, n, side, asked);
    shares += n; cost += F.cash;
  } else {
    if (n > shares + 1e-6) return json({ error: 'You don’t have that many shares.' }, 400);
    F = fill(L, now, n, side, asked);
    cost *= Math.max(0, 1 - n / shares); shares -= n;
  }
  const q = [env.DB.prepare('UPDATE listings SET fb = ?, fs = ?, ft = ? WHERE ticker = ?').bind(F.fb, F.fs, now, ticker)];
  if (shares < 1e-6) q.push(env.DB.prepare('DELETE FROM holdings WHERE holder = ? AND ticker = ?').bind(user.name, ticker));
  else q.push(env.DB.prepare('INSERT INTO holdings (holder, ticker, shares, cost, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(holder, ticker) DO UPDATE SET shares = excluded.shares, cost = excluded.cost, seen = excluded.seen')
    .bind(user.name, ticker, shares, cost, L.dps));
  await env.DB.batch(q);
  MEM = null;
  return json({ ok: true, price: r6(F.cash / n), credit: r2(owed), holding: shares < 1e-6 ? null : [ticker, r4(shares), r2(cost)] });
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
  const lst = (await env.DB.prepare(`SELECT l.ticker, l.company, p.display, l.total, l.own, l.book, l.profit, l.growth, l.fb, l.fs, l.ft, l.paid, l.listed, p.seen, l.divr, l.divp, l.divt, l.tp, l.tn, l.tt,
      (SELECT COALESCE(SUM(h.shares), 0) FROM holdings h WHERE h.ticker = l.ticker) AS held,
      (SELECT COUNT(*) FROM holdings h WHERE h.ticker = l.ticker) AS holders
    FROM listings l JOIN players p ON p.name = l.owner WHERE l.dead IS NULL ORDER BY l.book DESC LIMIT 40`).all()).results || [];
  MEM = { t: now, crowd: roundFlow(crowd), online, players: total ? total.n : top.length,
    board: top.map(r => [r.display, r.company, Math.round(r.nw), r.level, r.seen > now - ONLINE ? 1 : 0]),
    // a listing: ticker, company, owner, shares, owner's shares, value, profit/min, buying, selling (both $, at ft), ft, dividends paid, listed, players' shares, holders, owner online, profit trend (v0.11), dividend rate, what it was, when it changed, offer to players: price, shares left, until (v0.18)
    listings: lst.map(L => [L.ticker, L.company, L.display, r4(L.total), r4(L.own), r2(L.book), r2(L.profit), r2(L.fb), r2(L.fs), L.ft, r2(L.paid), L.listed, r4(L.held), L.holders, L.seen > now - ONLINE ? 1 : 0, r4(L.growth == null ? 1 : L.growth), r4(divr(L)), r4(L.divp == null ? divr(L) : L.divp), L.divt || 0, r4(L.tp || 0), r4(L.tn > 0 && L.tt > now ? L.tn : 0), L.tt || 0]) };
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
const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000, r6 = x => Math.round(x * 1e6) / 1e6;
const num = x => (Number.isFinite(+x) ? Math.max(-1e15, Math.min(1e15, +x)) : 0);
const lvl = x => Math.max(1, Math.min(9, Math.floor(+x) || 1));
const str = (x, n) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : null);
function saveOf(b) { if (typeof b.save !== 'string' || !b.save) return null; return b.save.length > SAVE_MAX ? false : b.save; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
async function readJson(req) { try { return await req.json(); } catch (e) { return {}; } }
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
function randomB64(n) { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
