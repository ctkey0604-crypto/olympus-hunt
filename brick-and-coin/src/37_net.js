'use strict';
/* ============================================================================
   NET (v0.07): your account, your company saved on the server, and the shared
   market. The game still plays fine with no account or no connection: then the
   company is saved in this browser only, as before.
   - Logging in uses an Inspirapixel account (the same accounts as Olympus Hunt): a name and a password.
   - Once a minute a logged-in game tells the server (server/index.js) how much of
     each good it sold and bought, and hears back what everyone else is doing and
     the players' leaderboard. Every 3 minutes, and when you leave, it sends the save.
     A game with no account just listens, every 2 minutes.
   - crowdMult() turns what the crowd of players is doing into a price move.
   ========================================================================== */
const NET_KEY = 'inspirapixel_bizgame_account';
const NET_API = /^https?:$/.test(location.protocol) ? '/api' : '';   // a page opened as a file plays offline
const SYNC_EVERY = 60, SAVE_EVERY = 180, GUEST_EVERY = 120;            // seconds
const NET = { name: null, token: null, crowd: {}, crowdWT: 0, online: 0, players: 0, board: [], flow: {},
  lastSync: 0, lastSave: 0, busy: false, down: 0, cloud: undefined, said: {},
  listings: [], div: 0 };   // v0.08: the public companies, and dividends this company has paid since the last sync
let CROWD_OFF = false;   // true while working out time away (plain prices)

/* ---------- the crowd: everyone's selling and buying ----------
   Flows are counted in "building-level minutes" (what one level of a building makes in a minute), so a crowd selling
   Nails and a crowd selling Motor Cars weigh the same. Each burst fades with a CROWD_HALF half-life. With D the market's
   depth (CROWD_R0 building levels selling non-stop), the price moves by sqrt((1 + bought/D) / (1 + sold/D)): the square
   root, like a real market, so doubling the selling doesn't double the drop. One busy player selling 50 levels' worth
   moves a price about 7%; a crowd of 300 levels' worth, about 29%; never more than CROWD_MIN..CROWD_MAX. */
const CROWD_D = CROWD_R0 * CROWD_HALF / 60 / Math.LN2;
const CROWD_OWN = {};    // this player's own part: { p: [sold, bought, world time] }, faded as it's read
function unitsPerMin(p) { const P = PRODUCTS[p]; return 60 / P.sec * P.out; }
function crowdOwnNow(p) {
  let o = CROWD_OWN[p]; if (!o) o = CROWD_OWN[p] = [0, 0, WT];
  if (WT > o[2]) { const k = Math.pow(.5, (WT - o[2]) / CROWD_HALF); o[0] *= k; o[1] *= k; o[2] = WT; }
  return o;
}
function crowdOthers(p) { const c = NET.crowd[p]; if (!c) return [0, 0]; const k = Math.pow(.5, Math.max(0, WT - NET.crowdWT) / CROWD_HALF); return [c[0] * k, c[1] * k]; }
function crowdMove(s, b) { return clamp(Math.sqrt((1 + b / CROWD_D) / (1 + s / CROWD_D)), CROWD_MIN, CROWD_MAX); }
function crowdMult(p) { if (CROWD_OFF) return 1; const o = crowdOthers(p), m = crowdOwnNow(p); return crowdMove(o[0] + m[0], o[1] + m[1]); }
function crowdOthersMult(p) { const o = crowdOthers(p); return crowdMove(o[0], o[1]); }   // the other players alone (for the Market)
// every sale and purchase (from sellGoods / buyGoods) counts towards the crowd, and goes in the next report to the server
function crowdNote(p, sold, bought) {
  if (CROWD_OFF) return;
  const u = unitsPerMin(p), s = sold / u, b = bought / u, o = crowdOwnNow(p);
  o[0] += s; o[1] += b;
  if (NET.token) { const f = NET.flow[p] || (NET.flow[p] = [0, 0]); f[0] += s; f[1] += b; }
}

/* ---------- talking to the server ---------- */
async function netCall(path, body) {
  if (!NET_API) throw new Error('Playing offline: open the game at brickncoin.com to play online.');
  const h = { 'Content-Type': 'application/json' }; if (NET.token) h.Authorization = 'Bearer ' + NET.token;
  let r;
  try { r = await fetch(NET_API + path, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch (e) { throw new Error('Can’t reach the server. Check your connection and try again.'); }
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (r.status === 401 && NET.token && path !== '/login' && path !== '/register') netForget();
  if (!r.ok) { const e = new Error(d.error || (r.status === 404 ? 'Online play isn’t available here.' : 'The server had a problem. Try again in a minute.')); e.status = r.status; throw e; }
  return d;
}
function netLoad() { try { const o = JSON.parse(localStorage.getItem(NET_KEY) || 'null'); if (o && o.token) { NET.name = o.name; NET.token = o.token; } } catch (e) {} }
function netStore() { try { if (NET.token) localStorage.setItem(NET_KEY, JSON.stringify({ name: NET.name, token: NET.token })); else localStorage.removeItem(NET_KEY); } catch (e) {} }
function netForget() { NET.name = NET.token = null; NET.cloud = undefined; NET.flow = {}; netStore(); }
async function netLogin(name, password, create) {
  const d = await netCall(create ? '/register' : '/login', { name, password });
  NET.name = d.name; NET.token = d.token; NET.cloud = undefined; NET.flow = {}; NET.lastSync = 0; netStore();
  return d;
}
async function netLogout() { const t = NET.token; if (t) { try { await netCall('/logout', {}); } catch (e) {} } netForget(); }
// the company saved on the server (NET.cloud: the save, null if there's none, undefined until we've asked)
async function netFetchSave() {
  if (!NET.token) { NET.cloud = undefined; return; }
  const d = await netCall('/save');
  try { NET.cloud = d.save ? JSON.parse(d.save) : null; } catch (e) { NET.cloud = null; }
}
function netBody() { return { company: S.company, nw: Math.round(netWorth()), level: S.level, book: Math.round(companyValue()), profit: Math.round(profitPerMin() * 100) / 100 }; }
// send the save now (leaving, the main menu, a new company). keepalive lets it finish after the page closes.
function netSaveNow(leaving) {
  if (!NET.token || !S || !NET_API) return;
  const body = JSON.stringify({ ...netBody(), save: serialize() });
  NET.cloud = JSON.parse(serialize());
  try {
    fetch(NET_API + '/save', { method: 'POST', keepalive: !!leaving && body.length < 60000, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + NET.token }, body })
      .then(r => { if (r.ok) NET.lastSave = Date.now(); else if (r.status === 401) netForget(); }, () => {});
  } catch (e) {}
}
// Start over: the server forgets the company too
function netClearSave() { if (NET.token) netCall('/save', { clear: true }).catch(() => {}); NET.cloud = null; }
async function netSync(withSave) {
  if (!NET.token || NET.busy || !S) return;
  NET.busy = true; const t0 = Date.now();
  const flow = NET.flow, div = NET.div; NET.flow = {}; NET.div = 0;
  const body = { ...netBody(), flow, div };
  if (withSave) body.save = serialize();
  try { const d = await netCall('/sync', body); netTake({ ...d, _t0: t0 }); NET.down = 0; if (withSave) { NET.lastSave = Date.now(); NET.cloud = JSON.parse(body.save); } }
  catch (e) {
    if (NET.token) { for (const p in flow) { const f = NET.flow[p] || (NET.flow[p] = [0, 0]); f[0] += flow[p][0]; f[1] += flow[p][1]; } NET.div += div; }   // goes in the next report
    NET.down++;
  }
  NET.busy = false;
}
// what the server says: the crowd (without this player's own part), who's online, the players' leaderboard
function netTake(d) {
  NET.crowd = d.crowd || {}; NET.crowdWT = (d.t || d.now || nowMs()) / 1000 - WORLD.epoch;
  NET.online = d.online || 0; NET.players = d.players || 0; NET.board = Array.isArray(d.board) ? d.board : [];
  NET.listings = Array.isArray(d.listings) ? d.listings.map(pubParse) : [];
  if (!S) return;
  pubTake(d);   // v0.08: this company's listing, its holdings, dividends and buyouts (38_pub.js)
  for (const p in NET.crowd) {   // a big crowd move makes the news (once every 10 minutes per good)
    const m = crowdOthersMult(p), said = NET.said[p] || 0;
    if (Math.abs(m - 1) < .08 || WT - said < 600) continue;
    NET.said[p] = WT;
    pushNews(m < 1 ? `Players are selling a lot of ${PRODUCTS[p].name}: its price is down ${Math.round((1 - m) * 100)}%` : `Players are buying up ${PRODUCTS[p].name}: its price is up ${Math.round((m - 1) * 100)}%`, m < 1 ? 'down' : 'up');
  }
}
// once a second while the game runs: report (logged in) or listen (no account), backing off while the server can't be reached
function netTick() {
  if (!NET_API || !S) return;
  const now = Date.now(), back = Math.min(8, 1 + NET.down);
  if (NET.token) { if (now - NET.lastSync >= SYNC_EVERY * 1000 * back) { NET.lastSync = now; netSync(now - NET.lastSave >= SAVE_EVERY * 1000); } }
  else if (now - NET.lastSync >= GUEST_EVERY * 1000 * back) { NET.lastSync = now; netCall('/market').then(netTake, () => { NET.down++; }); }
}
// the other real players on the leaderboard (not this one), as leaderboard rows
function netOthers() {
  const me = (NET.name || '').toLowerCase();
  return NET.board.filter(r => String(r[0]).toLowerCase() !== me).map(r => ({ name: r[0], co: r[1], nw: r[2], lv: r[3], online: !!r[4], player: true }));
}
// Continue: the server's copy when logged in, unless this device has a newer copy of the same company.
// 'both' when they're two different companies (the player chooses).
function pickSave(local, cloud) {
  if (!cloud) return local; if (!local) return cloud;
  if (local.company === cloud.company && local.start === cloud.start) return (local.savedAt || 0) > (cloud.savedAt || 0) + 5000 ? local : cloud;
  return 'both';
}
