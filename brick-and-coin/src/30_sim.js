'use strict';
/* ============================================================================
   SIM — the economy. Runs in fixed steps; nothing here touches the page.
   ========================================================================== */
let S = null;                     // the whole game state (saved as JSON)
let RENT_RATE = 1;                // v0.17: rent is paid in full, left idle too, until RENT_MAX
let AWAY_RATE = 1;                // 1 while someone's playing; OFFLINE_RATE when the game is left idle; 0 once idle past OFFLINE_MAX
const LOG = { onNews: null, onToast: null, onPop: null, onLevel: null, onGoal: null };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const SAVE_V = 4;                 // save format: 1 = v0.01-v0.03, 2 = v0.04 (Gold Hill), 3 = v0.05 (shared world), 4 = v0.08 (public companies). adopt() brings older saves up to date.
function newGame(company, start) {
  // v0.05: the market, news, rivals and home prices live in the shared world (35_world.js), not in the save
  S = {
    v: SAVE_V, company, start, cash: START_CASH, t: 0, level: 1, hqLv: 0, whLv: 0, tut: 0, settings: null,
    lots: new Array(LOTS).fill(null), inv: {}, unlocked: { [start]: true }, flow: {}, spent: {},
    market: {}, news: [], goal: 0, stats: { sales: 0, built: 0 }, prof: new Array(60).fill(0), profI: 0, profN: 0,
    hold: {}, divAcc: 0, savedAt: nowMs(), boostShown: false, props: PLOTS.map(() => ({ own: false, reno: 1, paid: 0 })),
    pub: null, pubHold: {},   // v0.08: this company's listing (if public), and shares it holds in other players' companies
  };
  S.lots[HQ_LOT] = { b: 'hq', lv: 1 };
  for (const p of PIDS) S.market[p] = { sat: 0, bp: 0, hist: [] };
  if (!WS.ready) WT = worldNow();
  attachWorld(); prefillGoodsHist();
  pushNews('Welcome to Millbrook. ' + company + ' opens for business.', 'info');
}

/* ---------------------------------------------------------------- helpers */
function countBuildings(s = S) { return s.lots.filter(l => l && l.b !== 'hq').length; }
function activeProducts(s = S) { const set = new Set(); for (const l of s.lots) if (l && l.b !== 'hq') set.add(l.b); return set; }
function capUsed() { let n = 0; for (const l of S.lots) if (l && l.b !== 'hq') n += l.lv; return n; }
// v0.16: the HQ's slots, with those of the next upgrade bought so far (kept with the HQ level they belong to)
function hqUnits() { return HQ_UNITS[S.hqLv] || []; }
function hqPart() { const P = S.hqPart; return P && P.lv === S.hqLv && hqUnits().length ? clamp(P.n | 0, 0, hqUnits().length - 1) : 0; }
function capMax() { let n = HQ_CAP[S.hqLv]; const k = hqPart(); for (let i = 0; i < k; i++) n += hqUnits()[i][0]; return n; }
// the next n things the HQ sells: how many there are, the slots they add and what they cost
function hqQuote(n = 1) {
  let lv = S.hqLv, i = hqPart(), slots = 0, cost = 0, got = 0;
  while (got < n && lv < HQ_COST.length) { const [q, c] = HQ_UNITS[lv][i]; slots += q; cost += c; got++; if (++i >= HQ_UNITS[lv].length) { lv++; i = 0; } }
  return { n: got, slots, cost };
}
function hqRoom() { return capUsed() < capMax(); }   // v0.16: a full HQ takes no more building levels (they only slowed everything down)
function efficiency() { const u = capUsed(), m = capMax(); return u > m ? m / u : 1; }
function whUsed() { let n = 0; for (const p in S.inv) n += S.inv[p]; return n; }
function whMax() { return WH_CAP[S.whLv]; }
// v0.16: +50% until Level 2, then fading to nothing over BOOST_FADE (S.boostLeft, set in checkLevel)
function boostMult() { return 1 + (STARTUP_BOOST - 1) * (S.level < 2 ? 1 : clamp((S.boostLeft || 0) / BOOST_FADE, 0, 1)); }
function boostPct() { return Math.round((boostMult() - 1) * 100); }
function buildCost(p) { return BUILD_COST[tierOf(p)]; }
function upgradeCost(l) { return Math.round(buildCost(l.b) * UPGRADE_MULT[l.lv - 1]); }
function researchCost(p) { return RESEARCH[tierOf(p)]; }
function hqUpgradeCost() { return hqQuote(1).cost; }
function whUpgradeCost() { return WH_COST[S.whLv]; }
function upkeepPerMin(l) { return UPKEEP[tierOf(l.b)] * l.lv; }
function consumersOf(p) { const out = []; for (const id of PIDS) if (PRODUCTS[id].rec[p]) out.push(id); return out; }
function lotUnlocked(i) { return ZONE_LEVEL[Math.floor(i / 12)] <= S.level; }
function marketDepth(p) { const P = PRODUCTS[p]; return 60 * (60 / P.sec) * P.out * MARKET_SIZE[S.level]; }

/* ---------------------------------------------------------------- goods market */
// a good's price: its base, today's shared swing and news (the world), what the crowd of players is selling and buying
// (v0.07, crowdMult() in 37_net.js), then this player's own selling and buying pressure
function evMult(p) { return WS.mult[p] || 1; }
function evSpeed(p) { return WS.speed[p] || 1; }
function price(p) {
  const M = S.market[p], D = marketDepth(p);
  return PRODUCTS[p].base * evMult(p) * Math.exp(WS.noise[p] || 0) * crowdMult(p) * ownImpact(M, D);
}
// what buying costs: by hand, or for a factory's own inputs (FACTORY_MARKUP, v0.15)
function buyPrice(p, markup = NPC_MARKUP) { return price(p) * markup; }
// your own recent selling (sat) and buying (bp), fading with a 2-minute half-life, against a deep market (v0.09)
function ownImpact(M, D) { const K = OWN_DEPTH * D; return clamp(Math.sqrt((1 + M.bp / K) / (1 + M.sat / K)), OWN_MIN, OWN_MAX); }
// the last 5 minutes of prices for the sparklines, from the world (at today's own selling pressure)
function prefillGoodsHist() {
  const now = Math.floor(WT);
  for (const p of PIDS) {
    const M = S.market[p], D = marketDepth(p), own = ownImpact(M, D); M.hist = [];
    for (let k = 59; k >= 0; k--) { const g = goodsAt(now - 5 * k, WS.evs); M.hist.push(+(PRODUCTS[p].base * (g.mult[p] || 1) * Math.exp(g.noise[p]) * own).toFixed(2)); }
  }
}
function sellGoods(p, q, auto) {
  if (q <= 0) return 0;
  const M = S.market[p], D = marketDepth(p), chunk = Math.max(1, D / 25);
  let left = q, rev = 0;
  while (left > 0) { const c = Math.min(left, chunk); rev += c * price(p); M.sat += c; left -= c; }
  crowdNote(p, q, 0);
  S.cash += rev; S.stats.sales += rev; addProfit(rev);
  return rev;
}
function buyGoods(p, q, markup) {
  const M = S.market[p], D = marketDepth(p), chunk = Math.max(1, D / 25);
  let left = q, cost = 0;
  while (left > 0) { const c = Math.min(left, chunk); cost += c * buyPrice(p, markup); M.bp += c; left -= c; }
  crowdNote(p, 0, q);
  return cost;
}
// v0.16: what to build next: the most profit for its price and for the HQ room it takes (what a slot costs at the next HQ
// upgrade), at usual prices, so a passing boom doesn't decide it. By price alone the cheapest raw material always won.
function usualProfit(p, act = activeProducts()) {
  const P = PRODUCTS[p]; let v = P.out * P.base; for (const q in P.rec) v -= P.rec[q] * PRODUCTS[q].base * (act.has(q) ? 1 : FACTORY_MARKUP);
  return v * 60 / P.sec * boostMult() - UPKEEP[tierOf(p)];
}
function slotPrice() { if (S.hqLv >= HQ_COST.length) return HQ_UNITS[HQ_COST.length - 1].slice(-1)[0][1]; const Q = hqQuote(1); return Q.cost / Q.slots; }
function bestPick(list, act = activeProducts()) {
  const slot = slotPrice(); let best = null, bs = 0;
  for (const p of list) { if ((!act.has(p) && act.size >= MAX_ACTIVE_PRODUCTS) || S.cash < buildCost(p)) continue; const sc = usualProfit(p, act) / (buildCost(p) + slot); if (sc > bs) { bs = sc; best = p; } }
  return best;
}
// does making p still pay if every input you don't make yourself is bought from the market?
function buysPay(p) {
  const P = PRODUCTS[p]; if (P.raw) return false;
  const act = activeProducts(); let cost = 0; for (const q in P.rec) cost += P.rec[q] * (act.has(q) ? price(q) : buyPrice(q, FACTORY_MARKUP));
  return P.out * price(p) - cost > upkeepPerMin({ b: p, lv: 1 }) * P.sec / 60;
}
// v0.09: sell everything in storage except what your own factories need (two minutes of it), Keep products included
function sellAllSpare() {
  let got = 0, n = 0;
  for (const p in S.inv) {
    let use = 0; for (const l of S.lots) if (l && l.b !== 'hq') { const r = PRODUCTS[l.b].rec[p]; if (r) use += r * 60 / PRODUCTS[l.b].sec * l.lv; }
    const q = Math.floor(S.inv[p] - (use > 0 ? Math.max(20, use * 2) : 0));
    if (q >= 1) { S.inv[p] -= q; if (S.inv[p] <= 1e-9) delete S.inv[p]; got += sellGoods(p, q); n += q; }
  }
  return { got, n };
}
function quoteBuy(p, q, markup) { const M = S.market[p], D = marketDepth(p); return q * buyPrice(p, markup) * Math.sqrt(1 + q / (OWN_DEPTH * D) / 2); }
// v0.11: what the company made while the game was closed isn't this minute's profit: it used to land in one second of the
// ledger, so $/min (and the steady profit investors value) jumped for a while after every return
let PROFIT_OFF = false;
function addProfit(x) { if (!PROFIT_OFF) S.prof[S.profI] += x; }
function profitPerMin() { let s = 0; for (const v of S.prof) s += v; const n = Math.min(60, Math.max(1, S.profN)); return s * 60 / n; }
// profit per minute averaged over about 10 minutes: what investors value a company on, so one big sale or a bulk buy of
// inputs doesn't swing its share price (v0.10)
function profitSteady() { return S.profAvg == null ? profitPerMin() : S.profAvg; }
// v0.11: profit averaged over the last hour, and the trend investors see: steady profit against it (0.5 to 1.5)
function profitLong() { return S.profLong == null ? profitSteady() : S.profLong; }
function profitGrowth() { const a = profitSteady(), b = profitLong(); return a > 0 && b > 0 ? clamp(a / b, GROWTH_MIN, GROWTH_MAX) : 1; }
// v0.11: a good's price against its usual one, and whether an Auto product is waiting in storage for a better price
function priceRatio(p) { return price(p) / PRODUCTS[p].base; }
function autoHold(p) {
  const M = S.market[p];
  if (flowOf(p) !== 'auto' || CROWD_OFF) return (M.hold = false);   // CROWD_OFF: the game was closed (plain prices)
  const r = priceRatio(p), roomy = whUsed() < whMax() * HOLD_ROOM;
  return (M.hold = roomy && (M.hold ? r < HOLD_UNTIL : r < HOLD_BELOW));
}

/* how much of a product we want to keep in storage before selling the rest */
function flowOf(p) { return S.flow[p] || 'auto'; }
function keepBuffer(p) {
  const f = flowOf(p);
  if (f === 'keep') return Infinity;
  if (f === 'sell') return 0;
  let use = 0;
  for (const l of S.lots) if (l && l.b !== 'hq') { const r = PRODUCTS[l.b].rec[p]; if (r) use += r * 60 / PRODUCTS[l.b].sec * l.lv; }
  const need = use > 0 ? Math.max(20, use * 2) : 0;   // two minutes of what your own factories eat
  return autoHold(p) ? Math.max(need, whMax() * HOLD_ROOM) : need;   // v0.11: or all of it, while the price is low
}

/* ---------------------------------------------------------------- production */
function stepProduction(dt, offlineRate = 1) {
  const eff = efficiency() * boostMult() * offlineRate;
  if (S.boostLeft > 0) S.boostLeft = Math.max(0, S.boostLeft - dt * offlineRate);   // idle or closed, it fades as slowly as the town runs
  for (let i = 0; i < S.lots.length; i++) {
    const l = S.lots[i]; if (!l || l.b === 'hq') continue;
    const P = PRODUCTS[l.b];
    if (!l.running) {
      // gather inputs for the next cycle
      let ok = true; const miss = [];
      for (const q in P.rec) if ((S.inv[q] || 0) < P.rec[q]) { ok = false; miss.push(q); }
      if (!ok && l.autoBuy) {
        // v0.11: wait out a price spike if buying now would lose money; stock up when an input is cheap and there's room
        const spike = offlineRate === 1 && miss.find(q => priceRatio(q) > BUY_WAIT);
        if (spike && !buysPay(l.b)) { l.stall = `${PRODUCTS[spike].name} costs ${Math.round((priceRatio(spike) - 1) * 100)}% more than usual: it waits for the price to come down`; continue; }
        const amt = {}; let cost = 0, extra = 0;
        for (const q of miss) {
          const need = P.rec[q] - (S.inv[q] || 0), cheap = offlineRate === 1 && priceRatio(q) < BUY_CHEAP && whUsed() + extra + P.rec[q] * BUY_STOCK < whMax() * HOLD_ROOM;
          amt[q] = need + (cheap ? P.rec[q] * (BUY_STOCK - 1) : 0); extra += amt[q]; cost += quoteBuy(q, amt[q], FACTORY_MARKUP);
        }
        if (S.cash < cost * 3) { cost = 0; for (const q of miss) { amt[q] = P.rec[q] - (S.inv[q] || 0); cost += quoteBuy(q, amt[q], FACTORY_MARKUP); } }   // short of cash: just this cycle
        if (S.cash >= cost) { for (const q of miss) { const c = buyGoods(q, amt[q], FACTORY_MARKUP); S.cash -= c; addProfit(-c); S.inv[q] = (S.inv[q] || 0) + amt[q]; } ok = true; }
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
// v0.04: a building that's stopped (waiting for materials, or storage full) pays no upkeep. Before, a company whose
// factories had run out of materials and cash sank into debt forever, offline too.
function stepUpkeep(dt, rate = 1) {
  let u = 0; for (const l of S.lots) if (l && l.b !== 'hq' && !l.stall) u += upkeepPerMin(l);
  const c = u / 60 * dt * rate; S.cash -= c; addProfit(-c);
}
function sellSurplus() {
  for (const p in S.inv) {
    const f = flowOf(p); if (f === 'keep') continue;
    const extra = S.inv[p] - keepBuffer(p);
    // v0.11: an Auto product sells a pile it held back a little at a time (about a minute's worth of the market a second), so
    // it doesn't knock its own price straight back down
    const step = f === 'auto' ? Math.max(5, marketDepth(p) / 20) : Infinity;
    if (extra >= 1) { const q = Math.floor(Math.min(extra, step)); S.inv[p] -= q; if (S.inv[p] <= 1e-9) delete S.inv[p]; sellGoods(p, q, true); }
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
const HQ_FULL = 'Your HQ is full: add room to it, or replace a building';
function canBuild(i, p) {
  if (!lotUnlocked(i)) return 'Area locked';
  if (S.lots[i]) return 'Lot taken';
  if (!S.unlocked[p]) return 'Unlock it first';
  const act = activeProducts(); if (!act.has(p) && act.size >= MAX_ACTIVE_PRODUCTS) return `Product limit ${MAX_ACTIVE_PRODUCTS}/${MAX_ACTIVE_PRODUCTS}`;
  if (!hqRoom()) return HQ_FULL;
  if (S.cash < buildCost(p)) return 'Not enough cash';
  return '';
}
function build(i, p) {
  const e = canBuild(i, p); if (e) return e;
  // v0.09: a new factory buys missing inputs from the market by default, as long as that still makes a profit
  S.cash -= buildCost(p); S.lots[i] = { b: p, lv: 1, prog: 0, running: false, stall: '', autoBuy: buysPay(p), spent: buildCost(p) };
  S.stats.built++; return '';
}
function canUpgrade(i) { const l = S.lots[i]; if (!l || l.b === 'hq') return 'No building'; if (l.lv >= MAX_BLD_LV) return 'Max level'; if (!hqRoom()) return HQ_FULL; if (S.cash < upgradeCost(l)) return 'Not enough cash'; return ''; }
function upgrade(i) { const e = canUpgrade(i); if (e) return e; const l = S.lots[i], c = upgradeCost(l); S.cash -= c; l.spent += c; l.lv++; return ''; }
function demolish(i) { const l = S.lots[i]; if (!l || l.b === 'hq') return 'No building'; S.cash += Math.round(l.spent * TEAR_DOWN); S.lots[i] = null; return ''; }
// v0.16: swap a building for a new Lv 1 one in one go. What was spent on the old one counts 75% towards the new one; whatever
// is left over comes back as if torn down. (Never a gain: a building counts 60% in the company's value.)
function replaceCost(i, p) { const l = S.lots[i], c = buildCost(p), used = Math.min(l.spent, c / TRADE_IN); return Math.round(c - used * TRADE_IN - (l.spent - used) * TEAR_DOWN); }   // below 0: money back
function canReplace(i, p) {
  const l = S.lots[i]; if (!l || l.b === 'hq') return 'No building';
  if (l.b === p) return 'It makes that already';
  if (!S.unlocked[p]) return 'Unlock it first';
  const rest = new Set(); S.lots.forEach((x, j) => { if (x && x.b !== 'hq' && j !== i) rest.add(x.b); });
  if (!rest.has(p) && rest.size >= MAX_ACTIVE_PRODUCTS) return `Product limit ${MAX_ACTIVE_PRODUCTS}/${MAX_ACTIVE_PRODUCTS}`;
  if (S.cash < replaceCost(i, p)) return 'Not enough cash';
  return '';
}
function replaceBld(i, p) {
  const e = canReplace(i, p); if (e) return e;
  S.cash -= replaceCost(i, p); S.lots[i] = { b: p, lv: 1, prog: 0, running: false, stall: '', autoBuy: false, spent: buildCost(p) };
  S.lots[i].autoBuy = buysPay(p); S.stats.built++; return '';
}
function upgradeHQ(n = 1) {
  if (S.hqLv >= HQ_COST.length) return 'HQ is maxed';
  const Q = hqQuote(n); if (S.cash < Q.cost) return 'Not enough cash';
  S.cash -= Q.cost; S.spent.hq = (S.spent.hq || 0) + Q.cost;
  let lv = S.hqLv, i = hqPart() + Q.n; while (lv < HQ_COST.length && i >= HQ_UNITS[lv].length) { i -= HQ_UNITS[lv].length; lv++; }
  S.hqLv = lv; S.hqPart = i > 0 ? { lv, n: i } : null; return '';
}
function upgradeWH() { if (S.whLv >= WH_COST.length) return 'Storage is maxed'; const c = whUpgradeCost(); if (S.cash < c) return 'Not enough cash'; S.cash -= c; S.whLv++; S.spent.wh = (S.spent.wh || 0) + c; return ''; }
function manualSell(p, q) { q = Math.min(q, Math.floor(S.inv[p] || 0)); if (q <= 0) return 'Nothing to sell'; S.inv[p] -= q; if (S.inv[p] <= 1e-9) delete S.inv[p]; sellGoods(p, q); return ''; }
function manualBuy(p, q) {
  if (whUsed() + q > whMax()) return 'Storage full';
  const est = quoteBuy(p, q); if (S.cash < est) return 'Not enough cash';
  const c = buyGoods(p, q); S.cash -= c; addProfit(-c); S.inv[p] = (S.inv[p] || 0) + q; return '';
}

/* ---------------------------------------------------------------- net worth, levels, rank */
// v0.08: the company's whole value, and the owner's net worth (their part of it, once outside shareholders own some)
function netWorth() { return companyValue() * ownFrac(); }
function companyValue() {
  let nw = S.cash;
  for (const l of S.lots) if (l && l.b !== 'hq') nw += l.spent * .6;
  nw += ((S.spent.hq || 0) + (S.spent.wh || 0)) * .5;
  for (const p in S.inv) nw += S.inv[p] * price(p) * .9;
  nw += portfolioValue() + propertyValue() + pubHoldValue();
  return nw;
}
// v0.16: what opens areas of town: the company's value, plus the half of the HQ and storage it leaves out, plus research. Before,
// putting money into them pushed the next level further away.
function researchSpent() { let v = 0; for (const p in S.unlocked) if (p !== S.start && PRODUCTS[p]) v += researchCost(p); return v; }
// v0.18: money from investors doesn't count (selling most of a company would open the next level on the spot); what's made with it does
function levelValue() { return companyValue() + ((S.spent.hq || 0) + (S.spent.wh || 0)) * .5 + researchSpent() - (S.pub ? Math.max(0, S.pub.raised || 0) : 0); }
// rank among the real players (v0.07: the leaderboard is players only)
function playerRank(s = S) { const nw = netWorth(); let r = 1; for (const x of netOthers()) if (x.nw > nw) r++; return r; }
function checkLevel() {
  const nw = levelValue();   // areas of town open with the whole company (v0.08), investment included (v0.16)
  while (S.level < MAX_LEVEL && nw >= LEVELS[S.level + 1].nw) {
    S.level++;
    if (S.level === 2) S.boostLeft = BOOST_FADE;
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

/* ---------------------------------------------------------------- news */
// the company's own news (the world's news comes from 35_world.js; the ticker shows both)
function pushNews(text, kind = 'info') { S.news.unshift({ text, kind, wt: WT }); if (S.news.length > 12) S.news.length = 12; if (LOG.onNews) LOG.onNews(text, kind); }

/* ---------------------------------------------------------------- stock market (prices come from the shared world) */
function asset(t) { return ASSETS.find(a => a.t === t); }
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
  S.t += dt; WT += dt;
  worldTick();   // the shared world, once a world second
  for (const p of PIDS) { const M = S.market[p], k = Math.exp(-dt * Math.LN2 / 120); M.sat *= k; M.bp *= k; }
  stepProduction(dt, AWAY_RATE);   // left idle, the company runs like it does while closed (v0.05)
  stepUpkeep(dt, AWAY_RATE);
  payRent(dt, RENT_RATE);
  S.divAcc += dt; if (S.divAcc >= 10) { if (AWAY_RATE === 1) payDividends(S.divAcc / 60); pubPayDividends(S.divAcc / 60); S.divAcc = 0; }
  S._sec = (S._sec || 0) + dt;
  if (S._sec >= 1) {
    S._sec -= 1;
    sellSurplus();
    for (const p of PIDS) { const M = S.market[p]; M._h = (M._h || 0) + 1; if (M._h >= 5) { M._h = 0; M.hist.push(+price(p).toFixed(2)); if (M.hist.length > 60) M.hist.shift(); } }
    // v0.15: left idle, the averages investors look at wait, as they do while the game is closed. They used to take in the
    // quarter-speed profit, so a company whose owner stepped away looked like it was failing.
    if (AWAY_RATE === 1) {
      S.profAvg = profitSteady() + (S.prof[S.profI] * 60 - profitSteady()) * (1 - Math.exp(-1 / PROF_AVG));
      S.profLong = profitLong() + (S.prof[S.profI] * 60 - profitLong()) * (1 - Math.exp(-1 / PROF_LONG));
    }
    S.profI = (S.profI + 1) % 60; S.prof[S.profI] = 0; S.profN++;
    checkLevel(); checkGoals();
  }
}
// Production while the game was closed: a quarter speed, for up to 2 hours, at plain prices. Booms, slumps and weather
// are left out (v0.05): the world's news is public and timed, so a return could otherwise be timed to a boom.
function offlineCatchUp(sec) {
  const gone = sec; sec = Math.min(sec, OFFLINE_MAX); if (!(sec >= 30)) return null;
  const cash0 = S.cash, stepN = Math.ceil(sec / 5), dt = sec / stepN, keep = [WS.mult, WS.speed, WS.noise];
  WS.mult = {}; WS.speed = {}; WS.noise = {}; CROWD_OFF = true;   // plain prices: no news, and no crowd (v0.07)
  PROFIT_OFF = true;                                              // v0.11: and none of it counts as this minute's profit
  for (let i = 0; i < stepN; i++) {
    stepProduction(dt, OFFLINE_RATE); stepUpkeep(dt, OFFLINE_RATE); payRent(dt);   // v0.17: rent in full
    for (const p of PIDS) { const M = S.market[p], k = Math.exp(-dt * Math.LN2 / 120); M.sat *= k; M.bp *= k; }
    sellSurplus();
  }
  [WS.mult, WS.speed, WS.noise] = keep; CROWD_OFF = false;
  const rentSec = Math.min(gone, RENT_MAX); payRent(rentSec - sec);   // and it goes on after the factories stop
  PROFIT_OFF = false;
  const rent = rentPerMin() / 60 * rentSec;
  return { sec: rent > 0 ? rentSec : sec, earned: S.cash - cash0, rent };
}
function awayText(r) { const m = r.sec / 60; return `While you were away (${m < 120 ? Math.round(m) + ' min' : Math.round(m / 6) / 10 + ' h'}): ${r.earned >= 0 ? '+' : ''}${money(r.earned, false)}${r.rent > 0 ? `, ${money(r.rent, false)} of it rent` : ''}`; }

/* ---------------------------------------------------------------- save / load */
// the save holds the company only: the shared world (S.assets, S.house, S.rivals) is worked out, never stored
function serialize() { S.savedAt = nowMs(); const { assets, house, rivals, ...own } = S; return JSON.stringify(own); }
function saveLocal() { if (!S) return false; try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; } }
function loadLocal() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function adopt(obj) {
  S = obj;
  for (const p of PIDS) if (!S.market[p]) S.market[p] = { sat: 0, bp: 0, hist: [] };
  if (!S.props) S.props = PLOTS.map(() => ({ own: false, reno: 1, paid: 0 }));
  while (S.props.length < PLOTS.length) S.props.push({ own: false, reno: 1, paid: 0 });
  if (typeof S.tut !== 'number') S.tut = countBuildings(S) > 0 ? TUT_DONE : 0;   // v0.03: players from older saves skip the tutorial
  if (S.settings === undefined) S.settings = null;                                // v0.03: sound settings (filled in by the page)
  while (S.lots.length < LOTS) S.lots.push(null);                                 // v0.04: 12 Gold Hill lots
  if (!(S.v >= 2)) {
    // v0.04 put two Gold Hill goals (13, 14) before "top 5" and "richest". Saves that were past goal 12 go to the
    // Gold Hill goals first; any that had already won "top 5" or "richest" can earn those rewards once more later.
    S.goal = Math.min(S.goal, 13);
  }
  if (!(S.v >= 3)) {
    // v0.05: the market moved to the shared world. Drop the old private one (prices, charts, events, rivals) and old news.
    for (const k of ['assets', 'house', 'rivals', 'events', 'nextEvent', 'regime', 'mVar', 'cryptoMode', 'cryptoT', 'stockAcc', 'histAcc10', 'histAcc60', 'sect', 'idxDiv']) delete S[k];
    for (const p of PIDS) delete S.market[p].n;
    S.news = [];
  }
  if (S.divAcc == null) S.divAcc = 0;
  if (S.pub === undefined) S.pub = null;            // v0.08
  if (!S.pubHold) S.pubHold = {};
  S.v = SAVE_V;
  if (!WS.ready) WT = worldNow();
  attachWorld(); prefillGoodsHist();
}
function encodeSave() { return btoa(unescape(encodeURIComponent(serialize()))); }
function decodeSave(str) { const o = JSON.parse(decodeURIComponent(escape(atob(str.trim())))); if (!o || !o.lots || !o.company) throw new Error('bad'); return o; }

/* ---------------------------------------------------------------- real estate (the housing index comes from the shared world) */
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
function buyProp(k) { const e = canBuyProp(k); if (e) return e; const c = propBuyPrice(k); S.cash -= c; Object.assign(S.props[k], { own: true, paid: c }); pushNews(`${S.company} buys the ${PROPS[PLOTS[k].t].name.toLowerCase()} ${PLOT_WHERE(k)}.`, 'you'); return ''; }
function sellProp(k) { const p = S.props[k]; if (!p.own) return 'You don’t own it'; S.cash += propSellPrice(k); Object.assign(p, { own: false, reno: 1, paid: 0 }); return ''; }
function renovate(k) { const p = S.props[k]; if (!p.own) return 'Buy it first'; if (p.reno >= PROP_MAX_RENO) return 'Fully renovated'; const c = renoCost(k); if (S.cash < c) return 'Not enough cash'; S.cash -= c; p.paid += c; p.reno++; return ''; }

