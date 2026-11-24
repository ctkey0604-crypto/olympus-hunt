'use strict';
/* ============================================================================
   GROUP (v0.19): your own money, and more than one company.
   - ROOT is your first company, and it is the save. S is the company you're in: ROOT, or one of ROOT.grp.cos. A save with
     one company has no grp at all, so it is exactly what it was before, and a game from before keeps a grp it doesn't know.
   - ROOT.grp = { wallet: your own money, active: which one you're in, cos: the others }. It's made the first time it's
     needed (a second company, or taking dividends from a public one).
   - The company you're in runs at full speed. The others run under a manager (c.mgr): slower until trained, for 10% of
     their profit, with an order: hold, grow (it spends the company's own cash) or home (its cash goes to your wallet).
   - Money moves freely between you and a company that's all yours. Money you put in doesn't count toward its levels
     (c.put); what it makes with it does, and what you take out still counts. A public company pays you dividends instead.
   - A public company can found companies with its own money, and owns them: c.subOf is its owner's gid. Their value and
     profit are part of its own, they pay its shareholders their part, and their money goes to it and comes from it.
   ========================================================================== */
const GRP_MAX = 5, GRP_LEVEL = 3, GRP_MIN = 25000;          // the most companies, the level it takes to found one, and the least to put in
const GRP_WORTH = [0, 0, 0, 1e7, 5e7];                       // your net worth for a 4th and a 5th (a 3rd takes Level 4)
const MGR_SPEED = [.6, .75, .9, 1], MGR_TRAIN = [25000, 100000, 400000], MGR_FEE = .1, MGR_EVERY = 10;
const MGR_ORDERS = { hold: 'Hold', grow: 'Grow', home: 'Send home' };

function allCos() {   // every company, the first one first (a test that swaps S for its own copy gets just that)
  if (!ROOT) return S ? [S] : [];
  const l = ROOT.grp && ROOT.grp.cos.length ? [ROOT, ...ROOT.grp.cos] : [ROOT];
  return !S || l.includes(S) ? l : [S];
}
function mainCo() { return allCos()[0] || S; }
function grp() { return ROOT.grp || (ROOT.grp = { wallet: 0, active: 0, cos: [] }); }
function wallet() { return ROOT && ROOT.grp && mainCo() === ROOT ? ROOT.grp.wallet || 0 : 0; }
function mgrOf(c) { return c.mgr || (c.mgr = { tr: 0, order: 'hold', paid: 0, t: 0 }); }
function mgrSpeed(c) { return MGR_SPEED[clamp(mgrOf(c).tr | 0, 0, MGR_SPEED.length - 1)]; }
// do something as another company: every rule in the game works on S
function withCo(c, fn) {
  if (c === S) return fn();
  const was = S, m = MANAGED; S = c; MANAGED = mgrSpeed(c); attachWorld();
  try { return fn(); } finally { c.assets = c.house = c.rivals = undefined; S = was; MANAGED = m; attachWorld(); }
}
function listedCo() { return allCos().find(c => c.pub) || null; }   // the server keeps one listing a player, so one company can be public
function coWorth() { return companyValue() * ownFrac(); }
// companies a public company owns
function parentOf(c) { return (c && c.subOf && allCos().find(x => x.gid === c.subOf)) || null; }
function subsOf(c) { return c && c.gid ? allCos().filter(x => x.subOf === c.gid) : []; }
function withSubs(fn) { let v = fn(); for (const c of subsOf(S)) v += withCo(c, fn); return v; }   // S and what it owns
function steadyAll() { return withSubs(profitSteady); }
function growthAll() { const a = steadyAll(), b = withSubs(profitLong); return a > 0 && b > 0 ? clamp(a / b, GROWTH_MIN, GROWTH_MAX) : 1; }
function adoptSubs(l) {   // a company that's owned owns none, and its owner has to be there
  delete l[0].subOf; for (const c of l) if (c.subOf) delete c.gid;
  for (const c of l) if (c.subOf && !l.some(x => x.gid === c.subOf)) delete c.subOf;
}
function netWorth() {   // what you're worth: your own money, and your part of every company
  const l = allCos(); if (l.length === 1 && !wallet()) return coWorth();
  let v = wallet(); for (const c of l) if (!parentOf(c)) v += withCo(c, coWorth); return v;
}
function topLevel() { return Math.max(...allCos().map(c => c.level)); }

/* ---------- money between you and your companies ---------- */
const allYours = c => !c.pub && !parentOf(c);
function takeMoney(c, amt) {   // company -> you (or the company that owns it)
  const P = parentOf(c); if (P) { amt = Math.min(amt, c.cash); if (!(amt >= 1)) return 'Not enough cash'; c.cash -= amt; c.put = (c.put || 0) - amt; P.cash += amt; return ''; }
  if (!allYours(c)) return `${c.company} is public: it pays you dividends instead`;
  amt = Math.min(amt, c.cash); if (!(amt >= 1)) return 'Not enough cash';
  c.cash -= amt; c.put = (c.put || 0) - amt; grp().wallet += amt; return '';
}
function putMoney(c, amt) {    // you (or the company that owns it) -> company
  const P = parentOf(c); if (P) { amt = Math.min(amt, P.cash); if (!(amt >= 1)) return `${P.company} has no cash`; P.cash -= amt; c.cash += amt; c.put = (c.put || 0) + amt; return ''; }
  if (!allYours(c)) return `${c.company} is public: your own money can’t go into it`;
  amt = Math.min(amt, wallet()); if (!(amt >= 1)) return 'You have no money of your own yet';
  grp().wallet -= amt; c.cash += amt; c.put = (c.put || 0) + amt; return '';
}

/* ---------- founding and closing ---------- */
function coSlots() { let n = topLevel() >= 4 ? 3 : topLevel() >= GRP_LEVEL ? 2 : 1; const w = netWorth(); for (let k = 3; k < GRP_WORTH.length; k++) if (topLevel() >= 4 && w >= GRP_WORTH[k]) n = k + 1; return Math.min(GRP_MAX, n); }
function nextSlotWhy() {
  const n = allCos().length; if (n < coSlots()) return '';
  return n >= GRP_MAX ? `You have ${GRP_MAX} companies, the most there can be.` : n === 1 ? `Reach Level ${GRP_LEVEL} to found a second company.` : n === 2 ? 'Reach Level 4 for a third.' : `Be worth ${money(GRP_WORTH[n], false)} for another.`;
}
function foundBy(by) { return S.pub && by !== 'me' ? 'co' : 'me'; }   // a public company founds with its own money and owns it, or you do with yours
function foundMoney(by) { return foundBy(by) === 'co' ? Math.max(0, S.cash) : wallet() + (allYours(S) ? Math.max(0, S.cash) : 0); }   // yours, and what the company you're in has if it's all yours
function canFound(name, start, amt, by) {
  const why = nextSlotWhy(); if (why) return why;
  if (!(typeof name === 'string' && name.length >= 2 && name.length <= 24)) return 'Give it a name (2–24 letters)';
  if (allCos().some(c => c.company.toLowerCase() === name.toLowerCase())) return 'You have a company called that';
  if (!PRODUCTS[start] || !PRODUCTS[start].raw) return 'Pick what it starts with';
  if (!(amt >= GRP_MIN)) return `It takes at least ${money(GRP_MIN, false)}`;
  if (foundMoney(by) < amt) return foundBy(by) === 'me' && !allYours(S) ? 'You don’t have that much of your own' : 'Not enough cash';
  return '';
}
function foundCo(name, start, amt, by) {
  const e = canFound(name, start, amt, by); if (e) return e;
  const G = grp(), owned = foundBy(by) === 'co', mine = owned ? 0 : Math.min(amt, wallet()); G.wallet -= mine;
  if (owned) { S.cash -= amt; S.gid = S.gid || 'g' + Math.floor(nowMs()).toString(36); }   // its value is still the company's: nothing to take off its levels
  else if (amt > mine) { S.cash -= amt - mine; S.put = (S.put || 0) - (amt - mine); }
  const c = blankCo(name, start); Object.assign(c, { cash: amt, put: amt, tut: TUT_DONE, goal: GOALS.length, pubTut: 1 }); if (owned) c.subOf = S.gid;   // goals and the tutorials are yours, not the company's
  G.cos.push(c); pushNews(`${(owned ? S : mainCo()).company} founds ${name}`, 'you');
  return '';
}
function closeValue(c) { return withCo(c, () => { let v = S.cash + portfolioValue() * .99 + propertyValue() * (1 - PROP_SELL_FEE); for (const l of S.lots) if (l && l.b !== 'hq') v += l.spent * TEAR_DOWN; for (const p in S.inv) v += S.inv[p] * price(p) * .8; return Math.max(0, v); }); }
function closeCo(c) {
  if (c === mainCo()) return 'Your first company can’t be closed';
  if (c.pub) return 'Buy all its shares back first';
  if (subsOf(c).length) return `Close the companies ${c.company} owns first`;
  const v = closeValue(c), G = grp(), P = parentOf(c); if (S === c) goCo(P || mainCo());
  G.cos = G.cos.filter(x => x !== c); if (P) P.cash += v; else G.wallet += v; G.active = allCos().indexOf(S); return '';
}
// step into another company
function goCo(c) {
  if (!c || c === S || !allCos().includes(c)) return false;
  S.assets = S.house = S.rivals = undefined; S = c; grp().active = allCos().indexOf(c); attachWorld(); prefillGoodsHist(); return true;
}

/* ---------- managers: a company you're not in ---------- */
function trainMgr(c) {
  const m = mgrOf(c), cost = MGR_TRAIN[m.tr]; if (cost == null) return 'Fully trained';
  if (c.cash < cost) return `${c.company} doesn’t have ${money(cost, false)}`;
  c.cash -= cost; m.tr++; return '';
}
// v0.19: is this a tick a managed company's buildings work in? A manager at 90% sits out one tick in ten. (Slower ticks came out
// slower than they said: a batch that ends partway through a tick loses the rest of it.)
function mgrTick() { const m = mgrOf(S), a = (+m.a || 0) + MANAGED, go = a >= 1 - 1e-9; m.a = clamp(go ? a - 1 : a, 0, 1); return go; }
// each second (from coStep, S is the managed company): the fee on this second's profit, and every 10 s, its order
function mgrSecond() {
  const m = mgrOf(S), p = S.prof[S.profI]; if (p > 0) { const f = p * MGR_FEE; S.cash -= f; S.prof[S.profI] -= f; m.paid = (m.paid || 0) + f; }
  m.t = (m.t || 0) + 1; if (m.t < MGR_EVERY || AWAY_RATE < 1) return; m.t = 0;   // left idle, managers keep things running but don't spend
  if (m.order === 'home' && !S.pub) { const keep = Math.max(2000, townValue() * .05); if (S.cash > keep + 1) takeMoney(S, S.cash - keep); }
  else if (m.order === 'grow') mgrGrow();
}
function mgrGrow() {   // one careful step: room when it's full, a much better product, the best building, then upgrades
  const free = S.cash - Math.max(2500, townValue() * .1); if (free <= 0) return;   // what it keeps back: factories buy their materials with it
  if (!hqRoom()) { if (S.hqLv < HQ_COST.length && free >= hqQuote(1).cost) upgradeHQ(1); return; }
  const act = activeProducts(), list = PIDS.filter(p => S.unlocked[p]), bestNow = Math.max(0, ...list.map(p => usualProfit(p, act)));
  if (act.size < MAX_ACTIVE_PRODUCTS) {
    const next = PIDS.filter(p => !S.unlocked[p] && PRODUCTS[p].ring <= S.level && Object.keys(PRODUCTS[p].rec).some(q => S.unlocked[q]) && usualProfit(p, act) > 1.3 * bestNow).sort((a, b) => usualProfit(b, act) - usualProfit(a, act))[0];
    if (next && free >= 1.5 * (researchCost(next) + buildCost(next))) { unlock(next); return; }
  }
  let lot = -1; for (let i = 0; i < S.lots.length; i++) if (!S.lots[i] && lotUnlocked(i)) { lot = i; break; }
  const pick = lot >= 0 ? bestPick(list, act) : null;
  if (pick && free >= buildCost(pick)) { build(lot, pick); return; }
  let up = -1, best = 0; S.lots.forEach((l, i) => { if (l && l.b !== 'hq' && l.lv < MAX_BLD_LV && free >= upgradeCost(l)) { const r = usualProfit(l.b, act) / upgradeCost(l); if (r > best) { best = r; up = i; } } });
  if (up >= 0) upgrade(up);
}
