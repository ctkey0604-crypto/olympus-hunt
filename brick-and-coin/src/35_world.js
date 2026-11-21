'use strict';
/* ============================================================================
   WORLD (v0.05): the shared market. Every copy of the game works out the same
   stock prices, PixCoin, home prices, rival fortunes, news and price swings from
   one world clock and one seed, so everyone in Millbrook sees the same thing at
   the same moment, with no server and no history to replay: the world at any
   second is a pure function of that second.
   - All chance comes from hashing (seed, stream, slot). Nothing here uses
     Math.random or anything about the player. The random numbers use only
     integer maths and + - * /, so every browser gets exactly the same ones.
   - Smooth wandering is "value noise" at several time scales, from 15 seconds to
     3 days. It moves like a real market up close but never drifts off forever,
     so the world can run for months.
   - News happens in 30-second slots. Each slot's event (if any) comes from its
     hash: what it is, what it says, how long it lasts and what it moves.
   - What a player does (their own selling and buying pressure on goods) is
     layered on top in price() and stays on their device for now.
   Changing WORLD.seed, the epoch or the model gives everyone a new world at once.
   ========================================================================== */
const WORLD = { seed: 0x6b1c0a5e, epoch: Date.UTC(2026, 10, 1) / 1000 };
let WT = 0;          // world time: seconds since WORLD.epoch, kept in step with the world clock
let CLOCK_OFF = 0;   // ms to add to this device's clock to match the server's (set by syncClock)
function nowMs() { return Date.now() + CLOCK_OFF; }
function worldNow() { return nowMs() / 1000 - WORLD.epoch; }

/* ---------- shared randomness ---------- */
function mix32(x) { x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return x >>> 0; }
function hu(s, i) { return mix32(mix32(i ^ Math.imul(s, 0x9e3779b1)) ^ WORLD.seed) / 4294967296; }   // uniform 0..1 for stream s, slot i
function hn(s, i) { return (hu(4 * s, i) + hu(4 * s + 1, i) + hu(4 * s + 2, i) + hu(4 * s + 3, i) - 2) * 1.7320508075688772; }   // about normal, sd 1
function vn(s, t, L) { const x = t / L, i = Math.floor(x), f = x - i, w = f * f * (3 - 2 * f), a = hn(s, i); return a + (hn(s, i + 1) - a) * w; }
// noise over time scales Ls (seconds), sized to move about sig per sqrt(second) like a random walk, up to the slowest scale
function fbm(s, t, sig, Ls) { let v = 0; for (let k = 0; k < Ls.length; k++) v += vn(s * 16 + k, t, Ls[k]) * Math.sqrt(Ls[k]); return v * sig * W_NOISE; }
const W_NOISE = .62;   // calibrated so the market moves about 1.6% an hour, as it did before v0.05

/* ---------- the models ---------- */
const OCT_F = [15, 60, 240, 960], OCT_S = [3840, 15360, 61440, 245760];   // fast and slow time scales
const OCT_SEC = [240, 960, 3840, 15360, 61440], OCT_ID = [15, 60, 240, 960, 3840, 15360];   // a company's own wander settles within hours
const MKT_SIG = .016 / 60, TREND = .002 / 86400;                          // about 1.6% an hour; a slow climb of 0.2% a day
const SECTORS = ['wood', 'food', 'metal', 'tech'], SECTOR_SIG = { wood: .01 / 60, food: .01 / 60, metal: .01 / 60, tech: .02 / 60 };
const BEAR_LEN = 960, BEAR_ODDS = .2;   // 16-minute spells; one in five is a nervous, sliding one
// Balance (v0.05). News moves fade slowly (half a day) and are modest, so "buy right after a crash, sell a few hours later"
// doesn't beat the trading fees: a shock fades back only a few percent of itself an hour. And because prices wander around
// fair values rather than off forever, the size of the swings sets what simply holding pays on average (the ups outweigh
// the downs): kept to a few percent a day, so parking cash in PixCoin while you sleep isn't a money machine.
// Check with test/market_check.js after changing any of this.
const TAU = { stock: 43200, crypto: 43200, house: 43200 }, JUMP = { stock: .35, crypto: .3, house: .35 };
const IDX_DIV = ASSETS.filter(a => !a.index && !a.crypto).reduce((s, a) => s + a.shares * a.p0, 0) / 100;
const A_IDX = {}; ASSETS.forEach((a, i) => { A_IDX[a.t] = i; });
function isBear(i) { return hu(4, i) < BEAR_ODDS; }
function bearVol(t) {   // volatility is 55% higher in a nervous spell, blended in over two minutes
  const i = Math.floor(t / BEAR_LEN), w = Math.min(1, (t - i * BEAR_LEN) / 120), a = isBear(i - 1) ? 1 : 0, b = isBear(i) ? 1 : 0;
  return 1 + .55 * (a + (b - a) * w);
}

/* ---------- news: one possible event every 30 seconds ---------- */
const EV_SLOT = 30, EV_ODDS = .37;   // about one event every 80 s, as before
const EV_WEATHER = [
  ['Heat wave: farms grow 30% slower', { wheat: .7 }, { wheat: 1.2 }],
  ['Perfect weather: farms grow 30% faster', { wheat: 1.3 }, { wheat: .9 }],
  ['Tunnel collapse: mines dig at half speed', { ore: .5 }, { ore: 1.35 }],
  ['Storm knocks out the sawmills', { planks: .6 }, { planks: 1.25 }],
  ['New furnace tech: smelters run 25% faster', { iron: 1.25, steel: 1.25 }, null],
];
const PROD_PICK = (() => { const w = { 1: 3, 2: 3, 3: 2, 4: 1 }, out = []; let c = 0; for (const p of PIDS) { c += w[PRODUCTS[p].ring] || 1; out.push([c, p]); } return out.map(([x, p]) => [x / c, p]); })();
const COMPANIES = ASSETS.filter(a => !a.index && !a.crypto);
// the event in slot j, or null. Everything about it comes from the slot's hashes.
function slotEvent(j) {
  const out = [];
  if (j * EV_SLOT % BEAR_LEN === 0) {   // a new 16-minute spell starts: nervous or not
    const i = j * EV_SLOT / BEAR_LEN, now = isBear(i), was = isBear(i - 1), t = i * BEAR_LEN;
    if (now) out.push({ t, j, text: was ? '' : 'Markets turn nervous: stocks slide', kind: 'down', jumps: [['mkt', -.008, TAU.stock, BEAR_LEN]] });
    else if (was) out.push({ t, j, text: 'Buyers return: stocks recover', kind: 'up', jumps: [] });
  }
  if (hu(50, j) >= EV_ODDS) return out;
  const u = k => hu(51 + k, j), t = j * EV_SLOT + Math.floor(u(0) * EV_SLOT), r = u(1), e = { t, j, text: '', kind: 'info', jumps: [] };
  const sectorJumps = (b, x) => { COMPANIES.forEach((a, k) => { if (a.sector === b) e.jumps.push([a.t, JUMP.stock * x * (.6 + .8 * u(10 + k)), TAU.stock, 0]); }); };
  if (r < .42) {   // one product booms or slumps
    const p = PROD_PICK.find(([c]) => u(2) < c)[1], up = u(3) < .55, m = up ? 1.3 + .4 * u(4) : .62 + .16 * u(4);
    const list = up ? EV_UP : EV_DOWN;
    Object.assign(e, { dur: 110 + 100 * u(5), mult: { [p]: m }, kind: up ? 'up' : 'down',
      text: list[Math.floor(u(6) * list.length)].replace('{P}', PRODUCTS[p].name) + ` (${up ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%)` });
    sectorJumps(PRODUCTS[p].branch, (m - 1) * .08);
  } else if (r < .55) {   // a whole branch booms
    const b = Object.keys(EV_SECTOR)[Math.floor(u(2) * 3)], [text, list] = EV_SECTOR[b], mult = {};
    for (const p of list) mult[p] = 1.22;
    Object.assign(e, { dur: 150, mult, kind: 'up', text: text + ' (+22%)' });
    sectorJumps(b, .035);
  } else if (r < .65) {   // weather and machines: production runs faster or slower
    const [text, speed, mult] = EV_WEATHER[Math.floor(u(2) * EV_WEATHER.length)];
    Object.assign(e, { dur: 120, speed, mult: mult || null, text });
  } else {   // the stock market
    const v = u(2), up = u(3) < (v < .14 ? .55 : v < .3 ? .5 : v < .4 ? .5 : v < .52 ? .5 : .55);   // ups and downs even out over time
    if (v < .14) {
      const x = up ? .05 + .04 * u(4) : -(.06 + .04 * u(4));
      Object.assign(e, { kind: up ? 'up' : 'down', text: up ? 'Housing boom: home prices jump' : 'Housing slump: home prices fall', jumps: [['house', JUMP.house * x, TAU.house, 0]] });
    } else if (v < .3) {
      const x = up ? .015 + .015 * u(4) : -(.02 + .02 * u(4));
      Object.assign(e, { kind: up ? 'up' : 'down', text: up ? 'Strong jobs report lifts the whole market' : 'Interest rate fears rattle the market' });
      ASSETS.forEach((a, k) => { if (!a.index) e.jumps.push([a.t, (a.crypto ? JUMP.crypto * 1.5 : JUMP.stock * a.beta) * x * (.8 + .4 * u(10 + k)), a.crypto ? TAU.crypto : TAU.stock, 0]); });
    } else if (v < .4) {
      const x = up ? .15 + .15 * u(4) : -(.15 + .15 * u(4));
      Object.assign(e, { kind: up ? 'up' : 'down', jumps: [['PXC', JUMP.crypto * x, TAU.crypto, 0]],
        text: up ? 'PixCoin hits the headlines: buyers pile in' : u(5) < .5 ? 'PixCoin exchange hacked: coins stolen' : 'Regulators crack down on PixCoin' });
    } else if (v < .52) {
      const x = up ? .1 + .1 * u(4) : -(.1 + .08 * u(4));
      Object.assign(e, { kind: up ? 'up' : 'down', jumps: [['NOVA', JUMP.stock * x, TAU.stock, 0]], text: up ? 'Nova Robotics unveils a new robot' : 'Nova Robotics recalls 10,000 robots' });
    } else {
      const a = COMPANIES[Math.floor(u(4) * COMPANIES.length)], x = up ? .05 + .06 * u(5) : -(.06 + .07 * u(5)), list = up ? EV_STOCK_UP : EV_STOCK_DOWN;
      Object.assign(e, { kind: up ? 'up' : 'down', jumps: [[a.t, JUMP.stock * x, TAU.stock, 0]], text: list[Math.floor(u(6) * list.length)].replace('{C}', a.name) + ` (${a.t})` });
    }
  }
  out.push(e);
  return out;
}
// every event between two world times, oldest first (v0.07: the simulated companies' news too)
function eventsBetween(t0, t1) {
  const out = []; for (let j = Math.floor(t0 / EV_SLOT); j <= Math.floor(t1 / EV_SLOT); j++) for (const e of slotEvent(j)) if (e.t >= t0 && e.t <= t1) out.push(e);
  const sims = simEventsBetween(t0, t1);
  if (sims.length) { for (const e of sims) out.push(e); out.sort((a, b) => a.t - b.t); }
  return out;
}
const EV_KEEP = 3 * 86400 + 5 * 3600;   // how far back events still matter (4 fade times: 3 days for PixCoin) plus the 4-hour charts

/* ---------- the world at one moment ---------- */
// jump sums: how much the news of the last hours still moves each thing
function jumpSums(t, evs) {
  const J = { mkt: 0, house: 0 };
  for (const e of evs) {
    if (e.t > t) break;
    const age = t - e.t;
    for (const [k, x, tau, ramp] of e.jumps) {
      if (age > 4 * tau) continue;
      J[k] = (J[k] || 0) + x * (ramp ? Math.min(1, age / ramp) : 1) * Math.exp(-Math.max(0, age - ramp) / tau);
    }
  }
  return J;
}
// prices of every asset, the housing index and the market at world time t (evs must cover the hours before t)
function marketAt(t, evs) {
  const J = jumpSums(t, evs), vol = Math.exp(.35 * vn(3, t, 1800)) * bearVol(t);
  const mkt = fbm(1, t, MKT_SIG, OCT_F) * vol + fbm(2, t, MKT_SIG, OCT_S) + J.mkt, slow = fbm(2, t, MKT_SIG, OCT_S) + J.mkt, trend = TREND * t;
  const sec = {}; SECTORS.forEach((s, k) => { sec[s] = fbm(20 + k, t, SECTOR_SIG[s], OCT_SEC); });
  const p = {}; let idx = 0;
  ASSETS.forEach((a, k) => {
    if (a.index) return;
    let L;
    if (a.crypto) L = Math.log(a.p0) + trend + .4 * mkt + fbm(100 + k, t, .05 / 60, OCT_ID) * Math.exp(.4 * vn(130, t, 900));
    else L = Math.log(a.p0) + trend + a.beta * mkt + a.gamma * sec[a.sector] + fbm(100 + k, t, a.vol / 60, OCT_ID) * Math.sqrt(vol);
    p[a.t] = Math.exp(L + (J[a.t] || 0));
    if (!a.crypto) idx += a.shares * p[a.t];
  });
  p.MB10 = idx / IDX_DIV;
  const house = clamp(Math.exp(trend + .25 * slow + fbm(140, t, .008 / 60, [960, 3840, 15360, 61440, 245760]) + J.house), .4, 6);
  return { p, house };
}
// rivals' fortunes rise and fall with their companies' shares, and wander a little on their own
function rivalsAt(t, p) {
  return RIVALS.map((R, i) => {
    let nw = R.nw * Math.exp(fbm(200 + i, t, .0003, OCT_S));
    if (R.link) { const a = ASSETS[A_IDX[R.link]]; nw *= Math.pow(p[R.link] / a.p0, R.k); }
    return Math.max(1000, nw);
  });
}
/* ---------- simulated companies (v0.07) ----------
   Besides the established tycoons above, Millbrook has a steady stream of made-up companies that live like real players:
   one opens about every 6 hours, grows at a human pace (most play a little, a few a lot), moves into new areas of town as
   it gets richer, levels off where its owner stops improving (most stay small, a few get rich, like real players), and
   after a few days either sells up or (three in ten) goes bust. They're all worked out from the world clock, so every
   player sees the same ones, and they're marked as simulated on the leaderboard. */
const SIM_EVERY = 6 * 3600, SIM_LIFE = 14 * 86400;   // one opens about every 6 h (about 25 around at once); none lasts over 14 days
const SIM_MEMO = new Map();
function simOf(n) {
  let s = SIM_MEMO.get(n); if (s) return s;
  const u = k => hu(700 + k, n), pick = (a, k) => a[Math.floor(u(k) * a.length)];
  const branch = ['wood', 'wheat', 'ore'][Math.floor(u(1) * 3)], busts = u(3) < .3, born = n * SIM_EVERY + Math.floor(u(0) * SIM_EVERY);
  const first = pick(SIM_FIRST, 5), tag = pick(SIM_TAG, 6), style = u(7);
  const name = style < .4 ? first + tag : style < .7 ? (first + tag).toLowerCase() + (10 + Math.floor(u(8) * 89)) : first + '_' + tag;
  s = { n, born, branch, busts, name, co: pick(SIM_SUR, 9) + ' ' + pick(SIM_KIND[branch], 10),
    k: .15 + .95 * u(2) * u(2),                                                     // hours played per hour: most a little, a few a lot
    cap: 2e4 * Math.pow(250, Math.pow(u(11), 1.5)),                                 // where it levels off: $20k to $5M, most nearer the bottom
    end: born + (busts ? 3600 * (5 + 100 * u(4)) : 86400 * (3 + 11 * u(4))) };       // bust within days, or sell up after 3-14 days
  SIM_MEMO.set(n, s); if (SIM_MEMO.size > 600) SIM_MEMO.delete(SIM_MEMO.keys().next().value);
  return s;
}
// net worth by hours played: about $10k after 30 min, $100k after 3 h, $1M after a long day (like the playtest bot), levelling
// off at the company's own ceiling
function simCurve(x, cap) { const nw = Math.pow(10, 3.3 + .714 * Math.log(1 + x / .3)); return nw * cap / (nw + cap); }
function simHoursTo(nw, cap) { if (nw >= cap * .9) return Infinity; const raw = nw * cap / (cap - nw); return .3 * (Math.exp((Math.log10(raw) - 3.3) / .714) - 1); }
function simNw(s, t) {
  if (t < s.born || t >= s.end) return 0;
  let nw = simCurve((t - s.born) / 3600 * s.k, s.cap) * Math.exp(fbm(900 + s.n % 61, t, .0005, OCT_F));
  if (s.busts && s.end - t < 7200) nw *= Math.max(.05, (s.end - t) / 7200);   // a failing company slides for its last two hours
  return Math.max(800, nw);
}
function simLevel(nw) { let L = 1; while (L < MAX_LEVEL && nw >= LEVELS[L + 1].nw) L++; return L; }
function simsAlive(t) {
  const out = [];
  for (let n = Math.max(0, Math.floor((t - SIM_LIFE) / SIM_EVERY) - 1); n <= Math.floor(t / SIM_EVERY); n++) { const s = simOf(n); if (t >= s.born && t < s.end) out.push(s); }
  return out;
}
// the simulated companies right now, with their net worth and level (kept for 5 s: the leaderboard reads it often)
let SIM_NOW = { t: -1, list: [] };
function simBoard(t) {
  t = Math.floor(t / 5) * 5; if (SIM_NOW.t === t) return SIM_NOW.list;
  const list = simsAlive(t).map(s => { const nw = simNw(s, t); return { name: s.name, co: s.co, nw, lv: simLevel(nw), sim: true }; });
  SIM_NOW = { t, list }; return list;
}
// their news: opening, each new area of town, and selling up or going bust
const SIM_AREA = { 2: 'grows into Market Row', 3: 'builds in the Industrial Park', 4: 'moves up to Gold Hill' };
function simEventsBetween(t0, t1) {
  const out = [], ev = (t, text, kind) => { if (t >= t0 && t <= t1) out.push({ t, j: -1, text, kind, jumps: [] }); };
  for (let n = Math.max(0, Math.floor((t0 - SIM_LIFE) / SIM_EVERY) - 1); n <= Math.floor(t1 / SIM_EVERY); n++) {
    const s = simOf(n); if (s.end < t0 || s.born > t1) continue;
    ev(s.born, `New in town: ${s.co} opens on Main Street`, 'info');
    for (let L = 2; L <= MAX_LEVEL; L++) {
      const h = simHoursTo(LEVELS[L].nw * 1.02, s.cap); if (!Number.isFinite(h)) break;
      const t = s.born + Math.round(h / s.k * 3600);
      if (t < s.end - (s.busts ? 7200 : 0)) ev(t, `${s.co} ${SIM_AREA[L]}`, 'up');
    }
    ev(s.end, s.busts ? `${s.co} goes bust` : `${s.name} sells ${s.co} and retires`, s.busts ? 'down' : 'info');
  }
  return out;
}

// goods: shared price swings (about ±4%) and any news that is boosting or cutting prices or production speed
function goodsAt(t, evs) {
  const noise = {}, mult = {}, speed = {};
  PIDS.forEach((p, k) => { const s = 300 + 3 * k; noise[p] = .025 * vn(s, t, 20) + .03 * vn(s + 1, t, 80) + .035 * vn(s + 2, t, 320); });
  for (let n = evs.length - 1; n >= 0; n--) {
    const e = evs[n]; if (e.t > t) continue; if (t - e.t > 300) break;
    if (!e.dur || t >= e.t + e.dur) continue;
    if (e.mult) for (const q in e.mult) mult[q] = (mult[q] || 1) * e.mult[q];
    if (e.speed) for (const q in e.speed) speed[q] = (speed[q] || 1) * e.speed[q];
  }
  return { noise, mult, speed };
}
// everything at once, for tests and anyone checking that two devices agree
function worldSnapshot(t) {
  t = Math.floor(t);
  const evs = eventsBetween(t - EV_KEEP, t), m = marketAt(t, evs), g = goodsAt(t, evs), r = rivalsAt(t, m.p), f = (x, d) => +x.toFixed(d);
  const o = { t, prices: {}, house: f(m.house, 5), rivals: r.map(x => Math.round(x)), goods: {}, news: evs.filter(e => e.text).slice(-5).map(e => e.text) };
  for (const k in m.p) o.prices[k] = f(m.p[k], 2);
  for (const p of PIDS) o.goods[p] = [f(g.noise[p], 5), f(g.mult[p] || 1, 4), f(g.speed[p] || 1, 4)];
  return o;
}

/* ---------- keeping the live world up to date ---------- */
// WS is what the game reads: S.assets, S.house and S.rivals point at its parts (they're never saved).
const WS = { ready: false, sec: null, evs: [], evFrom: 0, evTo: -1, assets: {}, house: { i: 1, h10: [], h60: [] }, rivals: RIVALS.map(r => ({ name: r.name, nw: r.nw })),
  noise: {}, mult: {}, speed: {}, i10: 0, i60: 0, lastNews: -1 };
for (const a of ASSETS) WS.assets[a.t] = { p: a.p0, h10: [], h60: [] };
function attachWorld() { if (!WS.ready) worldReset(); S.assets = WS.assets; S.house = WS.house; S.rivals = WS.rivals; }
// keep the event list covering [now − EV_KEEP, now]
function worldEventsTo(t) {
  const from = t - EV_KEEP;
  if (from < WS.evFrom || t < WS.evTo || t - WS.evTo > EV_KEEP) { WS.evs = eventsBetween(from, t); WS.evFrom = from; WS.evTo = t; return; }
  if (t > WS.evTo) { for (const e of eventsBetween(WS.evTo + 1e-6, t)) WS.evs.push(e); WS.evTo = t; }
  let n = 0; while (n < WS.evs.length && WS.evs[n].t < from) n++;
  if (n) WS.evs.splice(0, n);
  WS.evFrom = from;
}
// start over at the current world time: events, the 1-hour and 4-hour charts, today's prices
function worldReset() {
  const s = Math.floor(WT);
  WS.ready = true; WS.sec = null; WS.evFrom = Infinity; worldEventsTo(s);
  for (const a of ASSETS) { WS.assets[a.t].h10 = []; WS.assets[a.t].h60 = []; }
  WS.house.h10 = []; WS.house.h60 = [];
  const fill = (key, step, n) => { const top = Math.floor(s / step); for (let k = n - 1; k >= 0; k--) { const m = marketAt((top - k) * step, WS.evs); for (const a of ASSETS) WS.assets[a.t][key].push(+m.p[a.t].toPrecision(6)); WS.house[key].push(+m.house.toPrecision(6)); } };
  fill('h10', 10, 360); fill('h60', 60, 240);
  WS.i10 = Math.floor(s / 10); WS.i60 = Math.floor(s / 60);
  worldTick();
}
// once a world second: today's prices, rivals, goods swings and news effects; a chart point every 10 s and 60 s
function worldTick() {
  const s = Math.floor(WT);
  if (s === WS.sec) return;
  WS.sec = s;
  worldEventsTo(s);
  const m = marketAt(s, WS.evs), g = goodsAt(s, WS.evs), r = rivalsAt(s, m.p);
  for (const a of ASSETS) WS.assets[a.t].p = m.p[a.t];
  WS.house.i = m.house;
  r.forEach((nw, i) => { WS.rivals[i].nw = nw; });
  WS.noise = g.noise; WS.mult = g.mult; WS.speed = g.speed;
  const push = (arr, v, max) => { arr.push(+v.toPrecision(6)); if (arr.length > max) arr.shift(); };
  if (Math.floor(s / 10) > WS.i10) { WS.i10 = Math.floor(s / 10); for (const a of ASSETS) push(WS.assets[a.t].h10, m.p[a.t], 360); push(WS.house.h10, m.house, 360); }
  if (Math.floor(s / 60) > WS.i60) { WS.i60 = Math.floor(s / 60); for (const a of ASSETS) push(WS.assets[a.t].h60, m.p[a.t], 240); push(WS.house.h60, m.house, 240); }
  const last = worldNews(1)[0];
  if (last && last.wt !== WS.lastNews) { const first = WS.lastNews < 0; WS.lastNews = last.wt; if (!first && LOG.onNews) LOG.onNews(last.text, last.kind); }
}
// the latest world headlines, newest first
function worldNews(n) { const out = []; for (let k = WS.evs.length - 1; k >= 0 && out.length < n; k--) { const e = WS.evs[k]; if (e.text && e.t <= WT) out.push({ text: e.text, kind: e.kind, wt: e.t }); } return out; }

/* ---------- the world clock ---------- */
// Ask the server what time it is (the Date header of this page; static files cost nothing on Cloudflare). If this device's
// clock is more than 2 s out, use the server's. Offline earnings use this clock too, so moving a device's clock doesn't pay.
let clockSynced = false;
const clockReady = (async () => {
  try {
    if (!/^https?:$/.test(location.protocol)) return;
    const t0 = Date.now(), r = await fetch(location.href, { method: 'HEAD', cache: 'no-store' }), t1 = Date.now();
    const d = Date.parse(r.headers.get('Date') || ''); if (!d) return;
    const off = d + 500 - (t0 + t1) / 2;   // the header is to the second: aim for the middle of it
    if (Math.abs(off) > 2000) CLOCK_OFF = off;
    clockSynced = true;
  } catch (e) {}
})();
