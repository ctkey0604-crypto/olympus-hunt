'use strict';
/* ============================================================================
   SIM — the economy. Runs in fixed steps; nothing here touches the page.
   ========================================================================== */
let S = null;                     // the whole game state (saved as JSON)
const LOG = { onNews: null, onToast: null, onPop: null, onLevel: null, onGoal: null };
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const fat = () => gauss() * (Math.random() < .04 ? 2.6 : 1) / 1.109;   // fat tails: now and then a much bigger move (scaled back to unit variance)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function newGame(company, start) {
  S = {
    v: 1, company, start, cash: START_CASH, t: 0, level: 1, hqLv: 0, whLv: 0, tut: 0, settings: null,
    lots: new Array(36).fill(null), inv: {}, unlocked: { [start]: true }, flow: {}, spent: {},
    market: {}, events: [], nextEvent: 45, news: [], goal: 0,
    stats: { sales: 0, built: 0 }, prof: new Array(60).fill(0), profI: 0, profN: 0,
    assets: {}, hold: {}, regime: 'bull', mVar: 0, cryptoMode: 'calm', cryptoT: 0, stockAcc: 0, divAcc: 0, histAcc10: 0, histAcc60: 0,
    rivals: RIVALS.map(r => ({ name: r.name, nw: r.nw })), savedAt: Date.now(), boostShown: false,
    props: PLOTS.map(() => ({ own: false, reno: 1, paid: 0 })), house: { i: 1, h10: [], h60: [] },
  };
  S.lots[HQ_LOT] = { b: 'hq', lv: 1 };
  for (const p of PIDS) S.market[p] = { n: gauss() * .04, sat: 0, bp: 0, hist: [] };
  initAssets();
  // four hours of market history so the charts aren't empty on day one
  for (let i = 0; i < 4 * 3600; i++) stepAssets(1, true);
  for (const p of PIDS) for (let i = 0; i < 60; i++) { stepMarketNoise(p, 5); S.market[p].hist.push(+price(p).toFixed(2)); }
  pushNews('Welcome to Millbrook. ' + company + ' opens for business.', 'info');
}

/* ---------------------------------------------------------------- helpers */
function countBuildings(s = S) { return s.lots.filter(l => l && l.b !== 'hq').length; }
function activeProducts(s = S) { const set = new Set(); for (const l of s.lots) if (l && l.b !== 'hq') set.add(l.b); return set; }
function capUsed() { let n = 0; for (const l of S.lots) if (l && l.b !== 'hq') n += l.lv; return n; }
function capMax() { return HQ_CAP[S.hqLv]; }
function efficiency() { const u = capUsed(), m = capMax(); return u > m ? m / u : 1; }
function whUsed() { let n = 0; for (const p in S.inv) n += S.inv[p]; return n; }
function whMax() { return WH_CAP[S.whLv]; }
function boostOn() { return S.level < 2; }
function buildCost(p) { return BUILD_COST[tierOf(p)]; }
function upgradeCost(l) { return Math.round(buildCost(l.b) * UPGRADE_MULT[l.lv - 1]); }
function researchCost(p) { return RESEARCH[tierOf(p)]; }
function hqUpgradeCost() { return HQ_COST[S.hqLv]; }
function whUpgradeCost() { return WH_COST[S.whLv]; }
function upkeepPerMin(l) { return UPKEEP[tierOf(l.b)] * l.lv; }
function consumersOf(p) { const out = []; for (const id of PIDS) if (PRODUCTS[id].rec[p]) out.push(id); return out; }
function lotUnlocked(i) { return ZONE_LEVEL[Math.floor(i / 12)] <= S.level; }
function marketDepth(p) { const P = PRODUCTS[p]; return 60 * (60 / P.sec) * P.out * MARKET_SIZE[S.level]; }

/* ---------------------------------------------------------------- goods market */
function evMult(p) { let m = 1; for (const e of S.events) if (e.mult && e.mult[p]) m *= e.mult[p]; return m; }
function evSpeed(p) { let m = 1; for (const e of S.events) if (e.speed && e.speed[p]) m *= e.speed[p]; return m; }
function price(p) {
  const M = S.market[p], D = marketDepth(p);
  return PRODUCTS[p].base * evMult(p) * Math.exp(M.n) / (1 + M.sat / D) * (1 + M.bp / D);
}
function buyPrice(p) { return price(p) * NPC_MARKUP; }
function stepMarketNoise(p, dt) { const M = S.market[p]; M.n += -0.01 * M.n * dt + 0.006 * Math.sqrt(dt) * gauss(); M.n = clamp(M.n, -.35, .35); }
function sellGoods(p, q, auto) {
  if (q <= 0) return 0;
  const M = S.market[p], D = marketDepth(p), chunk = Math.max(1, D / 25);
  let left = q, rev = 0;
  while (left > 0) { const c = Math.min(left, chunk); rev += c * price(p); M.sat += c; left -= c; }
  S.cash += rev; S.stats.sales += rev; addProfit(rev);
  return rev;
}
function buyGoods(p, q) {
  const M = S.market[p], D = marketDepth(p), chunk = Math.max(1, D / 25);
  let left = q, cost = 0;
  while (left > 0) { const c = Math.min(left, chunk); cost += c * buyPrice(p); M.bp += c; left -= c; }
  return cost;
}
function quoteBuy(p, q) { const M = S.market[p], D = marketDepth(p); return q * buyPrice(p) * (1 + q / D / 2); }
function addProfit(x) { S.prof[S.profI] += x; }
function profitPerMin() { let s = 0; for (const v of S.prof) s += v; const n = Math.min(60, Math.max(1, S.profN)); return s * 60 / n; }

/* how much of a product we want to keep in storage before selling the rest */
function flowOf(p) { return S.flow[p] || 'auto'; }
function keepBuffer(p) {
  const f = flowOf(p);
  if (f === 'keep') return Infinity;
  if (f === 'sell') return 0;
  let use = 0;
  for (const l of S.lots) if (l && l.b !== 'hq') { const r = PRODUCTS[l.b].rec[p]; if (r) use += r * 60 / PRODUCTS[l.b].sec * l.lv; }
  return use > 0 ? Math.max(20, use * 2) : 0;   // two minutes of what your own factories eat
}

/* ---------------------------------------------------------------- production */
function stepProduction(dt, offlineRate = 1) {
  const eff = efficiency() * (boostOn() ? STARTUP_BOOST : 1) * offlineRate;
  for (let i = 0; i < 36; i++) {
    const l = S.lots[i]; if (!l || l.b === 'hq') continue;
    const P = PRODUCTS[l.b];
    if (!l.running) {
      // gather inputs for the next cycle
      let ok = true; const miss = [];
      for (const q in P.rec) if ((S.inv[q] || 0) < P.rec[q]) { ok = false; miss.push(q); }
      if (!ok && l.autoBuy) {
        let cost = 0; for (const q of miss) cost += quoteBuy(q, P.rec[q] - (S.inv[q] || 0));
        if (S.cash >= cost) { for (const q of miss) { const need = P.rec[q] - (S.inv[q] || 0); const c = buyGoods(q, need); S.cash -= c; addProfit(-c); S.inv[q] = (S.inv[q] || 0) + need; } ok = true; }
      }
      if (!ok) { l.stall = 'needs ' + miss.map(q => PRODUCTS[q].name).join(' + '); continue; }
      for (const q in P.rec) { S.inv[q] -= P.rec[q]; if (S.inv[q] <= 1e-9) delete S.inv[q]; }
      l.running = true; l.prog = 0; l.stall = '';
    }
    l.prog += dt * eff * l.lv * evSpeed(l.b) / P.sec;
    if (l.prog >= 1) {
      const buf = keepBuffer(l.b), have = S.inv[l.b] || 0;
      let keep = Math.max(0, Math.min(P.out, buf - have));
      const room = whMax() - whUsed();
      if (keep > room) keep = Math.max(0, room);
      const sell = P.out - keep;
      if (flowOf(l.b) === 'keep' && sell > 0) { l.prog = 1; l.stall = 'storage full'; continue; }
      if (keep > 0) S.inv[l.b] = have + keep;
      let rev = 0; if (sell > 0) rev = sellGoods(l.b, sell, true);
      if (LOG.onPop && offlineRate === 1) LOG.onPop(i, l.b, rev);
      l.running = false; l.prog = 0; l.stall = '';
    }
  }
}
function stepUpkeep(dt, rate = 1) {
  let u = 0; for (const l of S.lots) if (l && l.b !== 'hq') u += upkeepPerMin(l);
  const c = u / 60 * dt * rate; S.cash -= c; addProfit(-c);
}
function sellSurplus() {
  for (const p in S.inv) {
    const f = flowOf(p); if (f === 'keep') continue;
    const extra = S.inv[p] - keepBuffer(p);
    if (extra >= 1) { const q = Math.floor(extra); S.inv[p] -= q; if (S.inv[p] <= 1e-9) delete S.inv[p]; sellGoods(p, q, true); }
  }
}

/* ---------------------------------------------------------------- actions (return an error string or '') */
function canUnlock(p) {
  const P = PRODUCTS[p];
  if (S.unlocked[p]) return 'Already unlocked';
  if (P.ring > S.level) return `Needs Level ${P.ring} (${LEVELS[P.ring].name})`;
  if (!P.raw && !Object.keys(P.rec).some(q => S.unlocked[q])) return 'Unlock one of its inputs first';
  if (S.cash < researchCost(p)) return 'Not enough cash';
  return '';
}
function unlock(p) { const e = canUnlock(p); if (e) return e; S.cash -= researchCost(p); S.unlocked[p] = true; pushNews(`${S.company} can now make ${PRODUCTS[p].name}.`, 'you'); return ''; }
function canBuild(i, p) {
  if (!lotUnlocked(i)) return 'Area locked';
  if (S.lots[i]) return 'Lot taken';
  if (!S.unlocked[p]) return 'Unlock it first';
  const act = activeProducts(); if (!act.has(p) && act.size >= MAX_ACTIVE_PRODUCTS) return `Product limit ${MAX_ACTIVE_PRODUCTS}/${MAX_ACTIVE_PRODUCTS}`;
  if (S.cash < buildCost(p)) return 'Not enough cash';
  return '';
}
function build(i, p) {
  const e = canBuild(i, p); if (e) return e;
  S.cash -= buildCost(p); S.lots[i] = { b: p, lv: 1, prog: 0, running: false, stall: '', autoBuy: false, spent: buildCost(p) };
  S.stats.built++; return '';
}
function canUpgrade(i) { const l = S.lots[i]; if (!l || l.b === 'hq') return 'No building'; if (l.lv >= MAX_BLD_LV) return 'Max level'; if (S.cash < upgradeCost(l)) return 'Not enough cash'; return ''; }
function upgrade(i) { const e = canUpgrade(i); if (e) return e; const l = S.lots[i], c = upgradeCost(l); S.cash -= c; l.spent += c; l.lv++; return ''; }
function demolish(i) { const l = S.lots[i]; if (!l || l.b === 'hq') return 'No building'; S.cash += Math.round(l.spent * .4); S.lots[i] = null; return ''; }
function upgradeHQ() { if (S.hqLv >= HQ_COST.length) return 'HQ is maxed'; const c = hqUpgradeCost(); if (S.cash < c) return 'Not enough cash'; S.cash -= c; S.hqLv++; S.spent.hq = (S.spent.hq || 0) + c; return ''; }
function upgradeWH() { if (S.whLv >= WH_COST.length) return 'Storage is maxed'; const c = whUpgradeCost(); if (S.cash < c) return 'Not enough cash'; S.cash -= c; S.whLv++; S.spent.wh = (S.spent.wh || 0) + c; return ''; }
function manualSell(p, q) { q = Math.min(q, Math.floor(S.inv[p] || 0)); if (q <= 0) return 'Nothing to sell'; S.inv[p] -= q; if (S.inv[p] <= 1e-9) delete S.inv[p]; sellGoods(p, q); return ''; }
function manualBuy(p, q) {
  if (whUsed() + q > whMax()) return 'Storage full';
  const est = quoteBuy(p, q); if (S.cash < est) return 'Not enough cash';
  const c = buyGoods(p, q); S.cash -= c; addProfit(-c); S.inv[p] = (S.inv[p] || 0) + q; return '';
}

/* ---------------------------------------------------------------- net worth, levels, rank */
function netWorth() {
  let nw = S.cash;
  for (const l of S.lots) if (l && l.b !== 'hq') nw += l.spent * .6;
  nw += ((S.spent.hq || 0) + (S.spent.wh || 0)) * .5;
  for (const p in S.inv) nw += S.inv[p] * price(p) * .9;
  nw += portfolioValue() + propertyValue();
  return nw;
}
function playerRank(s = S) { const nw = netWorth(); let r = 1; for (const x of s.rivals) if (x.nw > nw) r++; return r; }
function checkLevel() {
  const nw = netWorth();
  while (S.level < MAX_LEVEL && nw >= LEVELS[S.level + 1].nw) {
    S.level++;
    pushNews(`${S.company} reaches Level ${S.level}: ${LEVELS[S.level].name} is open!`, 'you');
    if (LOG.onLevel) LOG.onLevel(S.level);
  }
}
function checkGoals() {
  while (S.goal < GOALS.length && GOALS[S.goal].done(S)) {
    const g = GOALS[S.goal]; S.cash += g.reward; S.goal++;
    if (LOG.onToast) LOG.onToast(`Goal complete: +$${g.reward.toLocaleString()}`, 'good');
    if (LOG.onGoal) LOG.onGoal(g);
  }
}

/* ---------------------------------------------------------------- news events */
function pushNews(text, kind = 'info') { S.news.unshift({ text, kind, t: S.t }); if (S.news.length > 12) S.news.length = 12; if (LOG.onNews) LOG.onNews(text, kind); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function relevantProduct() {
  const mine = PIDS.filter(p => S.unlocked[p] || (PRODUCTS[p].ring <= S.level && (PRODUCTS[p].raw || Object.keys(PRODUCTS[p].rec).some(q => S.unlocked[q]))));
  return Math.random() < .75 && mine.length ? pick(mine) : pick(PIDS.filter(p => PRODUCTS[p].ring <= S.level));
}
function spawnEvent() {
  const r = Math.random();
  if (r < .42) {
    const p = relevantProduct(), up = Math.random() < .55, m = up ? 1.3 + Math.random() * .4 : .62 + Math.random() * .16, dur = 110 + Math.random() * 100;
    S.events.push({ until: S.t + dur, mult: { [p]: m } });
    pushNews(pick(up ? EV_UP : EV_DOWN).replace('{P}', PRODUCTS[p].name) + ` (${up ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%)`, up ? 'up' : 'down');
    nudgeSector(PRODUCTS[p].branch, (m - 1) * .08);
  } else if (r < .55) {
    const b = pick(Object.keys(EV_SECTOR)), [text, list] = EV_SECTOR[b], mult = {};
    for (const p of list) mult[p] = 1.22; S.events.push({ until: S.t + 150, mult });
    pushNews(text + ' (+22%)', 'up'); nudgeSector(b, .035);
  } else if (r < .65) {
    const opts = [
      ['Heat wave: farms grow 30% slower', { wheat: .7 }, { wheat: 1.2 }],
      ['Perfect weather: farms grow 30% faster', { wheat: 1.3 }, { wheat: .9 }],
      ['Tunnel collapse: mines dig at half speed', { ore: .5 }, { ore: 1.35 }],
      ['Storm knocks out the sawmills', { planks: .6 }, { planks: 1.25 }],
      ['New furnace tech: smelters run 25% faster', { iron: 1.25, steel: 1.25 }, null],
    ];
    const [text, speed, mult] = pick(opts); S.events.push({ until: S.t + 120, speed, mult: mult || undefined });
    pushNews(text, 'info');
  } else {
    stockEvent();
  }
  S.nextEvent = S.t + 55 + Math.random() * 55;
}
function nudgeSector(sector, x) { for (const a of ASSETS) if (a.sector === sector) jumpAsset(a.t, x * (0.6 + Math.random() * .8)); }

/* ---------------------------------------------------------------- stock market
   Prices follow a factor model that behaves like a real market:
   - one market factor with bull/bear regimes and volatility clustering (GARCH),
   - sector factors (wood/food/metal also follow your goods prices),
   - company-specific noise, fat tails and sudden jumps (earnings, scandals),
   - an index fund built from all the listed companies,
   - a crypto coin with its own calm/hype/crash moods and big jumps. */
const MKT = { volBase: .016 / 60, a: .07, b: .91 };   // market moves about 1.6% an hour
function initAssets() {
  S.mVar = MKT.volBase ** 2; S.sect = { wood: 0, food: 0, metal: 0, tech: 0 };
  for (const a of ASSETS) S.assets[a.t] = { p: a.p0, h10: [], h60: [], last: 0 };
  const comps = ASSETS.filter(a => !a.index && !a.crypto);
  S.idxDiv = comps.reduce((s, a) => s + a.shares * a.p0, 0) / 100;
}
function asset(t) { return ASSETS.find(a => a.t === t); }
function jumpAsset(t, x) { const A = S.assets[t]; if (A) A.p = Math.max(asset(t).crypto ? 50 : 0.5, A.p * Math.exp(x)); if (t !== 'MB10') recomputeIndex(); }
function recomputeIndex() { let v = 0; for (const a of ASSETS) if (!a.index && !a.crypto) v += a.shares * S.assets[a.t].p; S.assets.MB10.p = v / S.idxDiv; }
let lastSectorPx = null;
function sectorGoodsIndex() { const o = { wood: 0, food: 0, metal: 0 }, n = { wood: 0, food: 0, metal: 0 }; for (const p of PIDS) { const b = PRODUCTS[p].branch; o[b] += Math.log(price(p) / PRODUCTS[p].base); n[b]++; } for (const b in o) o[b] /= n[b]; return o; }
function stepAssets(dt, pre) {
  // regime switching: long calm bull runs, shorter sharp bear spells
  if (S.regime === 'bull' && Math.random() < dt / 1700) { S.regime = 'bear'; if (!pre) pushNews('Markets turn nervous: stocks slide', 'down'); }
  else if (S.regime === 'bear' && Math.random() < dt / 380) { S.regime = 'bull'; if (!pre) pushNews('Buyers return: stocks recover', 'up'); }
  const bear = S.regime === 'bear';
  const mu = bear ? -0.05 / 3600 : 0.02 / 3600;      // bull: +2%/hr, bear: −5%/hr
  const base = MKT.volBase * (bear ? 1.55 : 1);
  const z = fat();
  let rM = mu + Math.sqrt(S.mVar) * z;
  S.mVar = base * base * (1 - MKT.a - MKT.b) + MKT.a * rM * rM + MKT.b * S.mVar;
  const volMult = Math.sqrt(S.mVar) / MKT.volBase;
  // sector moves, plus a pull from what goods are doing on the market
  let goods = null;
  if (!pre) { goods = sectorGoodsIndex(); if (!lastSectorPx) lastSectorPx = goods; }
  const rS = {};
  for (const s of ['wood', 'food', 'metal', 'tech']) {
    rS[s] = (s === 'tech' ? .02 : .01) / 60 * gauss();
    if (goods && goods[s] != null) rS[s] += (goods[s] - lastSectorPx[s]) * .25;
  }
  if (goods) lastSectorPx = goods;
  for (const a of ASSETS) {
    if (a.index) continue;
    const A = S.assets[a.t]; let r;
    if (a.crypto) {
      S.cryptoT -= dt;
      if (S.cryptoT <= 0) {
        const m = S.cryptoMode, u = Math.random();
        if (m === 'calm') { if (u < .08) { S.cryptoMode = 'hype'; S.cryptoT = 60 + Math.random() * 120; } else if (u < .12) { S.cryptoMode = 'crash'; S.cryptoT = 30 + Math.random() * 60; } else S.cryptoT = 30; }
        else { S.cryptoMode = 'calm'; S.cryptoT = 120 + Math.random() * 300; }
      }
      const cm = S.cryptoMode, cmu = cm === 'hype' ? .25 / 3600 : cm === 'crash' ? -.5 / 3600 : .004 / 3600;
      const cvol = (cm === 'calm' ? .10 : cm === 'hype' ? .15 : .22) / 60;   // per hour
      r = cmu + .4 * rM + cvol * fat();
      if (Math.random() < dt / 600) r += gauss() * .04;
    } else {
      r = a.beta * rM + a.gamma * rS[a.sector] + a.vol / 60 * Math.sqrt(volMult) * fat();
      if (Math.random() < dt * a.jump) r += gauss() * a.jsize;
    }
    A.p = Math.max(a.crypto ? 50 : 0.5, A.p * Math.exp(r));
  }
  recomputeIndex();
  stepHousing(dt, rM, pre);
  S.histAcc10 += dt; S.histAcc60 += dt;
  if (S.histAcc10 >= 10) { S.histAcc10 -= 10; for (const a of ASSETS) { const A = S.assets[a.t]; A.h10.push(+A.p.toPrecision(6)); if (A.h10.length > 360) A.h10.shift(); } S.house.h10.push(+S.house.i.toPrecision(6)); if (S.house.h10.length > 360) S.house.h10.shift(); }
  if (S.histAcc60 >= 60) { S.histAcc60 -= 60; for (const a of ASSETS) { const A = S.assets[a.t]; A.h60.push(+A.p.toPrecision(6)); if (A.h60.length > 240) A.h60.shift(); } S.house.h60.push(+S.house.i.toPrecision(6)); if (S.house.h60.length > 240) S.house.h60.shift(); }
  // rivals' fortunes follow their companies
  if (!pre) {
    for (let i = 0; i < S.rivals.length; i++) {
      const R = RIVALS[i], X = S.rivals[i];
      let r = R.g / 60 * dt + .0003 * gauss();
      if (R.link) { const A = S.assets[R.link]; if (A.last) r += R.k * Math.log(A.p / A.last); }
      X.nw = Math.max(1000, X.nw * Math.exp(r));
    }
  }
  for (const a of ASSETS) S.assets[a.t].last = S.assets[a.t].p;
}
function stockEvent() {
  const u = Math.random();
  if (u < .14) { const up = Math.random() < .55; const x = up ? .05 + Math.random() * .04 : -(.06 + Math.random() * .04); S.house.i *= Math.exp(x);
    pushNews(up ? 'Housing boom: home prices jump' : 'Housing slump: home prices fall', up ? 'up' : 'down'); return; }
  if (u < .3) { const up = Math.random() < .5; const x = up ? .015 + Math.random() * .015 : -(.02 + Math.random() * .02);
    pushNews(up ? 'Strong jobs report lifts the whole market' : 'Interest rate fears rattle the market', up ? 'up' : 'down');
    for (const a of ASSETS) if (!a.index) jumpAsset(a.t, x * (a.crypto ? 1.5 : a.beta) * (0.8 + Math.random() * .4));
    if (!up && Math.random() < .35) S.regime = 'bear';
  } else if (u < .4) { const up = Math.random() < .45; jumpAsset('PXC', up ? .12 + Math.random() * .13 : -(.18 + Math.random() * .17));
    if (up) { S.cryptoMode = 'hype'; S.cryptoT = 90; }
    pushNews(up ? 'PixCoin hits the headlines: buyers pile in' : pick(['PixCoin exchange hacked: coins stolen', 'Regulators crack down on PixCoin']), up ? 'up' : 'down');
  } else if (u < .52) { const up = Math.random() < .5; jumpAsset('NOVA', up ? .1 + Math.random() * .1 : -(.1 + Math.random() * .08));
    pushNews(up ? 'Nova Robotics unveils a new robot' : 'Nova Robotics recalls 10,000 robots', up ? 'up' : 'down');
  } else { const a = pick(ASSETS.filter(x => !x.index && !x.crypto)), up = Math.random() < .55; jumpAsset(a.t, up ? .05 + Math.random() * .06 : -(.06 + Math.random() * .07));
    pushNews(pick(up ? EV_STOCK_UP : EV_STOCK_DOWN).replace('{C}', a.name) + ` (${a.t})`, up ? 'up' : 'down');
  }
}
function holding(t) { return S.hold[t] || (S.hold[t] = { q: 0, cost: 0 }); }
function portfolioValue() { let v = 0; for (const t in S.hold) v += S.hold[t].q * S.assets[t].p; return v; }
function feeOf(t) { return asset(t).crypto ? FEE.crypto : FEE.stock; }
function buyAsset(t, dollars) {
  dollars = Math.min(dollars, S.cash); if (dollars < 1) return 'Not enough cash';
  const h = holding(t), p = S.assets[t].p; h.q += dollars * (1 - feeOf(t)) / p; h.cost += dollars; S.cash -= dollars; return '';
}
function sellAsset(t, frac) {
  const h = holding(t); if (h.q <= 0) return 'You own none';
  const q = h.q * frac, p = S.assets[t].p; S.cash += q * p * (1 - feeOf(t)); h.cost *= (1 - frac); h.q -= q; if (h.q < 1e-9) { h.q = 0; h.cost = 0; } return '';
}
function payDividends(dtMin) { let d = 0; for (const t in S.hold) { const h = S.hold[t]; if (h.q > 0) d += h.q * S.assets[t].p * asset(t).yld * dtMin; } if (d > 0) { S.cash += d; addProfit(d); } }

/* ---------------------------------------------------------------- main step */
function step(dt) {
  S.t += dt;
  // events
  S.events = S.events.filter(e => e.until > S.t);
  if (S.t >= S.nextEvent) spawnEvent();
  for (const p of PIDS) { stepMarketNoise(p, dt); const M = S.market[p], k = Math.exp(-dt * Math.LN2 / 120); M.sat *= k; M.bp *= k; }
  stepProduction(dt);
  stepUpkeep(dt);
  payRent(dt);
  S.stockAcc += dt; while (S.stockAcc >= 1) { S.stockAcc -= 1; stepAssets(1, false); }
  S.divAcc += dt; if (S.divAcc >= 10) { payDividends(S.divAcc / 60); S.divAcc = 0; }
  S._sec = (S._sec || 0) + dt;
  if (S._sec >= 1) {
    S._sec -= 1;
    sellSurplus();
    for (const p of PIDS) { const M = S.market[p]; M._h = (M._h || 0) + 1; if (M._h >= 5) { M._h = 0; M.hist.push(+price(p).toFixed(2)); if (M.hist.length > 60) M.hist.shift(); } }
    S.profI = (S.profI + 1) % 60; S.prof[S.profI] = 0; S.profN++;
    checkLevel(); checkGoals();
  }
}
// production while the page was closed: slower, and markets stand still
function offlineCatchUp(sec) {
  sec = Math.min(sec, OFFLINE_MAX); if (sec < 30) return null;
  const cash0 = S.cash, stepN = Math.ceil(sec / 5), dt = sec / stepN;
  for (let i = 0; i < stepN; i++) {
    stepProduction(dt, OFFLINE_RATE); stepUpkeep(dt, OFFLINE_RATE); payRent(dt, OFFLINE_RATE);
    for (const p of PIDS) { const M = S.market[p], k = Math.exp(-dt * Math.LN2 / 120); M.sat *= k; M.bp *= k; }
    sellSurplus();
  }
  return { sec, earned: S.cash - cash0 };
}

/* ---------------------------------------------------------------- save / load */
function serialize() { S.savedAt = Date.now(); return JSON.stringify(S); }
function saveLocal() { if (!S) return false; try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; } }
function loadLocal() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function adopt(obj) {
  S = obj;
  for (const p of PIDS) if (!S.market[p]) S.market[p] = { n: 0, sat: 0, bp: 0, hist: [] };
  for (const a of ASSETS) if (!S.assets[a.t]) S.assets[a.t] = { p: a.p0, h10: [], h60: [], last: a.p0 };
  if (!S.sect) S.sect = { wood: 0, food: 0, metal: 0, tech: 0 };
  if (!S.props) S.props = PLOTS.map(() => ({ own: false, reno: 1, paid: 0 }));
  while (S.props.length < PLOTS.length) S.props.push({ own: false, reno: 1, paid: 0 });
  if (!S.house) S.house = { i: 1, h10: [], h60: [] };
  if (!S.idxDiv) { const comps = ASSETS.filter(a => !a.index && !a.crypto); S.idxDiv = comps.reduce((s, a) => s + a.shares * a.p0, 0) / 100; }
  while (S.rivals.length < RIVALS.length) S.rivals.push({ name: RIVALS[S.rivals.length].name, nw: RIVALS[S.rivals.length].nw });
  if (typeof S.tut !== 'number') S.tut = countBuildings(S) > 0 ? TUT_DONE : 0;   // v0.03: players from older saves skip the tutorial
  if (S.settings === undefined) S.settings = null;                                // v0.03: sound settings (filled in by the page)
}
function encodeSave() { return btoa(unescape(encodeURIComponent(serialize()))); }
function decodeSave(str) { const o = JSON.parse(decodeURIComponent(escape(atob(str.trim())))); if (!o || !o.lots || !o.company) throw new Error('bad'); return o; }

/* ---------------------------------------------------------------- real estate */
// Home prices drift up slowly, follow the stock market a little, and wobble far less than stocks.
function stepHousing(dt, rM, pre) {
  if (!S.house) return;
  const mu = (S.regime === 'bear' ? -0.01 : 0.015) / 3600;
  const r = mu * dt + .25 * rM + .008 / 60 * Math.sqrt(dt) * gauss();
  S.house.i = clamp(S.house.i * Math.exp(r), .4, 6);
}
function propBase(k) { return PROPS[PLOTS[k].t].price; }
function propValue(k) { const p = S.props[k]; return propBase(k) * S.house.i * (1 + RENO_VALUE * (p.reno - 1)); }
function propRent(k) { const p = S.props[k], P = PROPS[PLOTS[k].t]; return P.price * P.yld * (1 + RENO_RENT * (p.reno - 1)); }   // per minute
function propertyValue() { let v = 0; if (!S.props) return 0; for (let k = 0; k < S.props.length; k++) if (S.props[k].own) v += propValue(k); return v; }
function rentPerMin() { let r = 0; if (!S.props) return 0; for (let k = 0; k < S.props.length; k++) if (S.props[k].own) r += propRent(k); return r; }
function payRent(dt, rate = 1) { const r = rentPerMin() / 60 * dt * rate; if (r > 0) { S.cash += r; addProfit(r); } }
function propBuyPrice(k) { return propValue(k) * (1 + PROP_BUY_FEE); }
function propSellPrice(k) { return propValue(k) * (1 - PROP_SELL_FEE); }
function renoCost(k) { return propBase(k) * RENO_COST * S.props[k].reno; }
function canBuyProp(k) {
  const p = S.props[k], P = PROPS[PLOTS[k].t];
  if (p.own) return 'You own it';
  if (P.lvl > S.level) return `Needs Level ${P.lvl} (${LEVELS[P.lvl].name})`;
  if (S.cash < propBuyPrice(k)) return 'Not enough cash';
  return '';
}
function buyProp(k) { const e = canBuyProp(k); if (e) return e; const c = propBuyPrice(k); S.cash -= c; Object.assign(S.props[k], { own: true, paid: c }); pushNews(`${S.company} buys the ${PROPS[PLOTS[k].t].name.toLowerCase()} on the ${PLOT_SIDE(k).toLowerCase()}.`, 'you'); return ''; }
function sellProp(k) { const p = S.props[k]; if (!p.own) return 'You don’t own it'; S.cash += propSellPrice(k); Object.assign(p, { own: false, reno: 1, paid: 0 }); return ''; }
function renovate(k) { const p = S.props[k]; if (!p.own) return 'Buy it first'; if (p.reno >= PROP_MAX_RENO) return 'Fully renovated'; const c = renoCost(k); if (S.cash < c) return 'Not enough cash'; S.cash -= c; p.paid += c; p.reno++; return ''; }

