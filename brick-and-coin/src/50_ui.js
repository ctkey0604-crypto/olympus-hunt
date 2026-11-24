'use strict';
/* ============================================================================
   UI — top bar, side panel, menus (production web, market, stocks, leaderboard),
   start screen, toasts and the news ticker.
   ========================================================================== */
const $ = s => document.querySelector(s);
const UI = { investTab: 'portfolio', sel: null, sheet: false, modal: null, sideSig: '', modalSig: '', webSel: null, stockSel: 'MB10', stockTF: '1h', mktFilter: 'mine', confirm: '', startPick: 'wood', tpage: 'home', helpPg: 0, mtab: 'help', lbTab: 'all' };

/* ---------- formatting ---------- */
function money(n, cents) {
  const neg = n < 0; n = Math.abs(n); let s;
  if (n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
  else if (n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (n >= 100 || cents === false) s = Math.round(n).toLocaleString('en-US');
  else s = n.toFixed(n < 10 ? 2 : 1);
  return (neg ? '−' : '') + '$' + s;
}
function qty(n) { n = n || 0; return n >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 10) / 10); }
function pctTxt(x) { const s = x * 100, a = Math.abs(s); return (s >= 0 ? '+' : '−') + a.toFixed(a < 10 ? 1 : 0) + '%'; }
function changeOf(arr, n) { if (!arr || arr.length < 2) return 0; const a = arr[Math.max(0, arr.length - 1 - n)], b = arr[arr.length - 1]; return b / a - 1; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function rateTxt(x) { return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + '/min'; }

/* ---------- per-minute numbers ---------- */
function cyclesPerMin(p, lv, mult) { return 60 / PRODUCTS[p].sec * lv * mult; }
// Inputs you make yourself count at the market's sell price (what they'd fetch). Inputs you don't make count at the
// buy price, since the building has to buy them (v0.04: before, a factory buying everything could show a profit while losing money).
function inputPrice(q, act = activeProducts()) { return act.has(q) ? price(q) : buyPrice(q, FACTORY_MARKUP); }
function estProfit(p, lv = 1, mult = 1) {
  const P = PRODUCTS[p], c = cyclesPerMin(p, lv, mult), act = activeProducts();
  let v = c * P.out * price(p); for (const q in P.rec) v -= c * P.rec[q] * inputPrice(q, act);
  return v - UPKEEP[tierOf(p)] * lv;
}
function lotMult() { return efficiency() * boostMult(); }
function recipeHTML(p, small) {
  const P = PRODUCTS[p], sz = small ? 18 : 36;
  if (P.raw) return `<span class="muted">Needs no materials</span> → makes ${P.out} ${iconImg(p, sz, P.name)}`;
  return 'Uses ' + Object.keys(P.rec).map(q => `${P.rec[q]} ${iconImg(q, sz, PRODUCTS[q].name)}`).join(' + ') + ` → makes ${P.out} ${iconImg(p, sz, P.name)}`;
}
function recipeText(p) { const P = PRODUCTS[p]; if (P.raw) return `Needs no materials · makes ${P.name}`; return 'Uses ' + Object.keys(P.rec).map(q => `${P.rec[q]} ${PRODUCTS[q].name}`).join(' + ') + ` → makes ${P.out} ${P.name}`; }

/* ---------- live values: any element with data-live="key:arg" is refreshed every tick ---------- */
const LIVE = {
  inv: p => qty(S.inv[p]),
  price: p => money(price(p)),
  bprice: p => money(buyPrice(p)),
  est(arg) { const [p, lv, own] = arg.split('|'); const v = estProfit(p, +lv, own ? lotMult() : boostMult()); return { text: (v >= 0 ? '+' : '') + money(v) + '/min', cls: v >= 0 ? 'olive' : 'red' }; },
  prog(i, el) { const l = S.lots[i]; el.style.width = (l && l.running ? Math.min(100, l.prog * 100) : 0) + '%'; },
  status(i) {
    const l = S.lots[i]; if (!l) return '';
    if (l.stall) return { text: (l.stall === 'storage full' ? 'Stopped: storage full. Sell some, or set output to Auto.' : 'Waiting: ' + l.stall + '.') + ' No upkeep while it waits.', cls: 'status bad' };
    const e = efficiency();
    if (e < 1) return { text: `Running slow: over your factory limit (${Math.round(e * 100)}% speed)`, cls: 'status warn' };
    return { text: 'Running' + (boostPct() > 0 ? ` · startup boost +${boostPct()}%` : ''), cls: 'status ok' };
  },
  rate(i) { const l = S.lots[i]; if (!l) return ''; return rateTxt(cyclesPerMin(l.b, l.lv, lotMult()) * PRODUCTS[l.b].out) + ' ' + PRODUCTS[l.b].name; },
  uses(i) { const l = S.lots[i]; if (!l) return ''; const P = PRODUCTS[l.b]; if (P.raw) return 'no materials'; const c = cyclesPerMin(l.b, l.lv, lotMult()); return Object.keys(P.rec).map(q => rateTxt(c * P.rec[q]) + ' ' + PRODUCTS[q].name).join(', '); },
  lvv: () => money(levelValue(), false),
  lvbar(_, el) { const L = S.level; if (L >= MAX_LEVEL) { el.style.width = '100%'; return; } const a = LEVELS[L].nw, b = LEVELS[L + 1].nw; el.style.width = clamp((levelValue() - a) / (b - a), 0, 1) * 100 + '%'; },
  nw: () => money(netWorth(), false),
  capt: () => `${capUsed()} / ${capMax()}`, wht: () => `${qty(whUsed())} / ${whMax()}`,
  capbar(_, el) { el.style.width = Math.min(100, capUsed() / capMax() * 100) + '%'; el.classList.toggle('over', capUsed() > capMax()); },
  whbar(_, el) { el.style.width = Math.min(100, whUsed() / whMax() * 100) + '%'; el.classList.toggle('over', whUsed() >= whMax()); },
  ppm() { const v = profitPerMin(); return { text: (v >= 0 ? '+' : '') + money(v) + '/min', cls: v >= 0 ? 'olive' : 'red' }; },
  upkeep() { let u = 0; for (const l of S.lots) if (l && l.b !== 'hq' && !l.stall) u += upkeepPerMin(l); return money(u) + '/min'; },
  bupkeep(i) { const l = S.lots[i]; if (!l) return ''; return l.stall ? 'paused while it waits' : money(upkeepPerMin(l)) + '/min'; },
  spark(p, el) { el.setAttribute('d', sparkPath(S.market[p].hist, 90, 24)); },
  mchg(p) { const c = changeOf(S.market[p].hist, 59); return { text: pctTxt(c), cls: c >= 0 ? 'olive' : 'red' }; },
  crowd(p) {   // v0.07: what the other players are doing to a price; v0.11: and an Auto product waiting for a better price
    const m = crowdOthersMult(p) - 1, held = S.market[p].hold && (S.inv[p] || 0) >= 1, c = Math.abs(m) < .01 ? '' : ' · players ' + pctTxt(m);
    return { text: c + (held ? ' · holding for a better price' : ''), cls: held ? 'gold' : m < 0 ? 'red' : 'olive' };
  },
  aprice: t => money(S.assets[t].p),
  achg(arg) { const [t, w] = arg.split('|'); const A = S.assets[t]; const c = w === '4h' ? changeOf(A.h60, 239) : w === '10m' ? changeOf(A.h10, 59) : changeOf(A.h10, 359); return { text: pctTxt(c), cls: c >= 0 ? 'olive' : 'red' }; },
  hq: t => { const h = S.hold[t]; return h && h.q > 0 ? (h.q < 1 ? h.q.toFixed(4) : qty(h.q)) : '0'; },
  hval: t => { const h = S.hold[t]; return money(h ? h.q * S.assets[t].p : 0); },
  hpl(t) { const h = S.hold[t]; if (!h || h.q <= 0) return { text: '—', cls: 'muted' }; const v = h.q * S.assets[t].p - h.cost; return { text: (v >= 0 ? '+' : '') + money(v) + ' (' + pctTxt(v / h.cost) + ')', cls: v >= 0 ? 'olive' : 'red' }; },
  pval: () => money(portfolioValue()),
  ppl() { let v = 0, c = 0; for (const t in S.hold) { v += S.hold[t].q * S.assets[t].p; c += S.hold[t].cost; } const d = v - c; if (!c) return { text: '—', cls: 'muted' }; return { text: (d >= 0 ? '+' : '') + money(d), cls: d >= 0 ? 'olive' : 'red' }; },
  divh() { let d = 0; for (const t in S.hold) d += S.hold[t].q * S.assets[t].p * asset(t).yld * 60; return money(d) + '/hr'; },
  mood() { const c = changeOf(S.assets.MB10.h10, 59); return c > .004 ? { text: 'Rising', cls: 'olive' } : c < -.004 ? { text: 'Falling', cls: 'red' } : { text: 'Calm', cls: 'muted' }; },
  cash: () => money(S.cash, false),
  pv: k => money(propValue(+k), false), prent: k => money(propRent(+k)) + '/min', pbp: k => money(propBuyPrice(+k), false), psp: k => money(propSellPrice(+k), false),
  pback: k => { const h = (S.props[+k].own ? propValue(+k) : propBuyPrice(+k)) / propRent(+k) / 60; return h < 10 ? h.toFixed(1) + ' hours of rent' : Math.round(h) + ' hours of rent'; },
  pyld: k => (propRent(+k) * 60 / propValue(+k) * 100).toFixed(1) + '% of its value per hour',
  pgain(k) { k = +k; const p = S.props[k]; if (!p.own) return ''; const v = propSellPrice(k) - p.paid; return { text: (v >= 0 ? '+' : '') + money(v, false), cls: v >= 0 ? 'olive' : 'red' }; },
  hchg(w) { const H = S.house; const c = w === '4h' ? changeOf(H.h60, 239) : w === '10m' ? changeOf(H.h10, 59) : changeOf(H.h10, 359); return { text: pctTxt(c), cls: c >= 0 ? 'olive' : 'red' }; },
  revalue: () => money(propertyValue(), false), rerent: () => money(rentPerMin()) + '/min',
  goalbar(_, el) { el.style.width = '0%'; },
};
function updateLive(root) {
  if (!root) return;
  for (const el of root.querySelectorAll('[data-live]')) {
    const s = el.dataset.live, i = s.indexOf(':'), k = i < 0 ? s : s.slice(0, i), a = i < 0 ? '' : s.slice(i + 1);
    const f = LIVE[k]; if (!f) continue;
    const v = f(a, el); if (v == null) continue;
    const text = typeof v === 'string' ? v : v.text;
    if (el.textContent !== text) el.textContent = text;
    if (typeof v === 'object' && v.cls != null) { const base = el.dataset.base || ''; const c = (base + ' ' + v.cls).trim(); if (el.className !== c) el.className = c; }
  }
  for (const el of root.querySelectorAll('[data-cost]')) {   // not .disabled: an unaffordable button still takes the tap and answers with a "no" sound
    const off = !!el.dataset.block || S.cash < +el.dataset.cost;
    if (el.classList.contains('off') !== off) { el.classList.toggle('off', off); el.setAttribute('aria-disabled', off); }
  }
}
function sparkPath(h, w, ht) {
  if (!h || h.length < 2) return '';
  let lo = Infinity, hi = -Infinity; for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const span = hi - lo || 1; let d = '';
  h.forEach((v, i) => { const x = (i / (h.length - 1) * w).toFixed(1), y = (ht - 2 - (v - lo) / span * (ht - 4)).toFixed(1); d += (i ? 'L' : 'M') + x + ' ' + y; });
  return d;
}

/* ---------- top bar ---------- */
function updateTop() {
  $('#coName').textContent = S.company;
  $('#lvChip').textContent = `LV ${S.level} · ${LEVELS[S.level].name.toUpperCase()}`;
  const bc = $('#boostChip'), bp = boostPct(); bc.hidden = bp <= 0; if (bp > 0) bc.textContent = `Startup boost +${bp}%`;
  $('#cash').textContent = money(S.cash, false); $('#cash').style.color = S.cash < 0 ? 'var(--pink)' : '';   // red when in debt
  const v = profitPerMin(), pp = $('#ppm'); pp.textContent = (v >= 0 ? '+' : '') + money(v) + '/min profit'; pp.className = v >= 0 ? 'olive' : 'red';
  const nw = netWorth(); $('#nw').textContent = money(nw, false);
  const L = S.level, bar = $('#lvBar');
  if (L < MAX_LEVEL) { const a = LEVELS[L].nw, b = LEVELS[L + 1].nw; const lv = levelValue(); bar.style.width = clamp((lv - a) / (b - a), 0, 1) * 100 + '%'; $('#lvNext').textContent = `Level ${L + 1}: ${money(lv, false)} of ${money(b, false)}`; }
  else { bar.style.width = '100%'; $('#lvNext').textContent = `Top level: all of Millbrook is open`; }
  $('#lvBarWrap').setAttribute('aria-label', 'Progress to next level');
  $('#cap').textContent = `${capUsed()} / ${capMax()}`;
  const cb = $('#capBar'); cb.style.width = Math.min(100, capUsed() / capMax() * 100) + '%'; cb.classList.toggle('over', capUsed() > capMax());
  // v0.09: say what needs doing: over the limit, factories waiting for materials, or an HQ that's full
  const waiting = S.lots.filter(l => l && l.b !== 'hq' && l.stall && l.stall !== 'storage full').length, note = $('#capNote');
  note.textContent = capUsed() > capMax() ? `Over the limit: all factories at ${Math.round(efficiency() * 100)}% speed`
    : waiting ? `${waiting} waiting for materials: tap to see`
    : capUsed() >= capMax() && S.hqLv < HQ_COST.length ? `Full: ${hqQuote(1).slots > 1 ? `upgrade HQ for ${hqQuote(1).slots} more` : 'add a slot'} (${money(hqUpgradeCost(), false)})`
    : 'each building level uses one';
  note.classList.toggle('red', capUsed() > capMax() || waiting > 0);
  $('#wh').textContent = `${qty(whUsed())} / ${whMax()}`;
  const wb = $('#whBar'); wb.style.width = Math.min(100, whUsed() / whMax() * 100) + '%'; wb.classList.toggle('over', whUsed() >= whMax());
}

/* ---------- side panel ---------- */
function sideView() {
  if (!UI.sel) return homeView();
  const i = UI.sel.i;
  if (i >= 100) return propView(i - 100);
  const l = S.lots[i];
  if (l && l.b === 'hq') return hqView();
  if (l) return UI.rep === i ? replaceView(i, l) : bldView(i, l);
  if (!lotUnlocked(i)) return lockedView(i);
  return emptyView(i);
}
function homeView() {
  const g = GOALS[S.goal], act = activeProducts();
  const sig = `home|${S.goal}|${Object.keys(S.unlocked).join()}|${[...act].join()}|${JSON.stringify(S.flow)}`;
  const prods = PIDS.filter(p => S.unlocked[p]).map(p => `
    <div class="prow">${iconImg(p, 36)}<div class="nm"><b>${PRODUCTS[p].name}</b><span>${act.has(p) ? 'Have' : 'Not built yet · have'} <b data-live="inv:${p}"></b> · <b data-live="price:${p}"></b></span></div>
    ${flowSeg(p, true)}</div>`).join('');
  return { sig, html: `
    <section class="card"><h3>Goal ${S.goal < GOALS.length ? `<span class="muted">${S.goal + 1} of ${GOALS.length}</span>` : ''}</h3>
      ${g ? `<p>${g.text}</p><span class="chip gold" style="align-self:flex-start">Reward ${money(g.reward, false)}</span>` : '<p>Every goal done. You run Millbrook now.</p>'}</section>
    <section class="card"><h3>Your products <span class="muted">${act.size} of ${MAX_ACTIVE_PRODUCTS} running</span></h3>${prods}
      <p class="muted" style="font-size:12px">Auto keeps what your own factories need and sells the rest, but holds it back while the price is well below normal and sells it once the price recovers. Sell sells everything. Keep stores it all.</p></section>
    <section class="card"><h3>How to play</h3>
      <p class="tip">Tap an <b>empty lot</b> to build. Tap a <b>building</b> to upgrade it. Drag the map to look around.</p>
      <p class="tip">Open <b>Production</b> to unlock new products, <b>Market</b> to trade goods, <b>Invest</b> for stocks and real estate.</p>
      <p class="tip">Grow your <b>company</b> to open new areas of town and deeper products.</p></section>` };
}
function flowSeg(p, compact) {
  const f = flowOf(p);
  return `<div class="seg" role="group" aria-label="What to do with ${PRODUCTS[p].name}">${['auto', 'sell', 'keep'].map(v =>
    `<button type="button" data-act="flow" data-p="${p}" data-v="${v}" aria-pressed="${f === v}">${v === 'auto' ? 'Auto' : v === 'sell' ? 'Sell' : 'Keep'}</button>`).join('')}</div>`;
}
const LIMIT_TXT = `Product limit ${MAX_ACTIVE_PRODUCTS}/${MAX_ACTIVE_PRODUCTS}: tear down another product first`;
function emptyView(i) {
  const act = activeProducts();
  const list = PIDS.filter(p => S.unlocked[p]);
  const full = !hqRoom(), sig0 = `empty|${i}|${list.join()}|${[...act].join()}|${S.level}|${full ? capMax() + ',' + S.hqLv : ''}`;
  const best = bestPick(list, act);
  const cards = list.map(p => {
    const c = buildCost(p), blocked = !act.has(p) && act.size >= MAX_ACTIVE_PRODUCTS;
    return `<div class="bcard"><img class="px" src="${buildingPreview(p)}" alt="">
      <div class="info"><b>${PRODUCTS[p].bld} ${p === best ? '<span class="chip gold">Best pick</span>' : ''}</b><span>${recipeText(p)}</span>
      <span>${rateTxt(cyclesPerMin(p, 1, boostMult()) * PRODUCTS[p].out)} · upkeep ${money(UPKEEP[tierOf(p)])}/min</span>
      <span>Profit about <b data-live="est:${p}|1" data-base=""></b></span></div>
      <div class="act">${blocked ? `<span class="why">${LIMIT_TXT}</span>` : '<span></span>'}
      <button class="btn small" type="button" data-act="build" data-p="${p}" data-cost="${c}" ${blocked ? `data-block="${LIMIT_TXT}"` : full ? `data-block="${HQ_FULL}"` : ''}>Build ${money(c, false)}</button></div></div>`;
  }).join('');
  const sig = sig0 + '|' + best;
  return { sig, html: `
    <div class="side-head"><div><h2>Empty lot</h2><span class="muted">${ZONE_NAME[Math.floor(i / 12)]}</span></div></div>
    ${full ? hqFullCard() : ''}
    ${cards || '<p class="muted">You have no products unlocked yet.</p>'}
    <button class="btn ghost wide" type="button" data-act="prod">${iconImg('gear', 18)} Unlock more products</button>
    <button class="btn ghost wide" type="button" data-act="deselect">Back</button>` };
}
function lockedView(i) {
  const b = Math.floor(i / 12), L = ZONE_LEVEL[b];
  return { sig: `locked|${b}|${S.level}`, html: `
    <div class="side-head">${iconImg('lock', 54)}<div><h2>${ZONE_NAME[b]}</h2><span class="muted">Opens at Level ${L} (${LEVELS[L].name})</span></div></div>
    <section class="card"><p>Grow your company to <b class="gold">${money(LEVELS[L].nw, false)}</b> to build here. You're at <b data-live="lvv"></b>: its value, plus all you’ve put into your HQ, storage and research.</p>
    <div class="bar"><i data-live="lvbar"></i></div>
    <p class="muted" style="font-size:13px">A new level also unlocks deeper products in the Production web, and the market gets bigger so prices hold up when you sell more.</p></section>
    <button class="btn ghost wide" type="button" data-act="deselect">Back</button>` };
}
// buy HQ room: a whole upgrade early on, then a slot (or a few) at a time
function hqBtns() {
  if (S.hqLv >= HQ_COST.length) return '<span class="chip gold">HQ fully upgraded</span>';
  const q = hqQuote(1), b = (n, cls) => { const Q = hqQuote(n); return `<button class="btn ${cls}" type="button" data-act="hqup" data-n="${n}" data-cost="${Q.cost}">+${Q.slots} slot${Q.slots === 1 ? '' : 's'} · ${money(Q.cost, false)}</button>`; };
  if (q.slots > 1) return `<button class="btn" type="button" data-act="hqup" data-n="1" data-cost="${q.cost}">Upgrade HQ to ${capMax() + q.slots} slots · ${money(q.cost, false)}</button>`;
  return `<div class="hqbuy">${b(1, '')}${hqQuote(5).n > 1 ? b(5, 'ghost') : ''}</div>`;
}
function hqFullCard() { return `<section class="card"><h3>Your HQ is full <span class="muted" data-live="capt"></span></h3><p class="muted" style="font-size:13px">${S.hqLv < HQ_COST.length ? 'Add room, or' : 'Open a building to'} <b>replace</b> ${S.hqLv < HQ_COST.length ? 'a building with a better one (tap it on the map)' : 'it with a better one'}.</p>${hqBtns()}</section>`; }
function hqView() {
  const sig = `hq|${S.hqLv}|${hqPart()}|${S.whLv}|${S.level}|${capUsed() > capMax()}`;
  const whNext = S.whLv < WH_COST.length;
  return { sig, html: `
    <div class="side-head"><img class="px big-prev" src="${buildingPreview('hq', hqTier())}" alt=""><div><h2>${esc(S.company)} HQ</h2><span class="muted">Level ${S.level} · ${LEVELS[S.level].name}</span></div></div>
    <section class="card"><h3>Factory limit <span data-live="capt"></span></h3><div class="bar"><i data-live="capbar"></i></div>
      <p class="muted" style="font-size:13px">Every building level uses one slot. When it’s full, add room here, or open a building and <b>replace</b> it with a better one.${capUsed() > capMax() ? ' You’re over the limit, so <b>all</b> your factories run slower.' : ''}</p>
      ${hqBtns()}</section>
    <section class="card"><h3>Storage <span data-live="wht"></span></h3><div class="bar"><i data-live="whbar"></i></div>
      <p class="muted" style="font-size:13px">Goods you keep wait here for your other factories. When it's full, Auto products sell their extra.</p>
      ${whNext ? `<button class="btn ghost" type="button" data-act="whup" data-cost="${whUpgradeCost()}">Bigger warehouse (${WH_CAP[S.whLv + 1]}) · ${money(whUpgradeCost(), false)}</button>` : '<span class="chip gold">Warehouse fully upgraded</span>'}</section>
    <section class="card"><h3>Company</h3><div class="kv">
      <span>Profit</span><b data-live="ppm" data-base=""></b>
      <span>Upkeep</span><b data-live="upkeep"></b>
      <span>Buildings</span><b>${countBuildings()}</b>
      <span>Products running</span><b>${activeProducts().size} / ${MAX_ACTIVE_PRODUCTS}</b>
      <span>Net worth</span><b data-live="nw"></b>
      <span>Rank</span><b>#${playerRank()}</b></div></section>
    <button class="btn ghost wide" type="button" data-act="deselect">Back</button>` };
}
function bldView(i, l) {
  const P = PRODUCTS[l.b], up = l.lv < MAX_BLD_LV, uc = up ? upgradeCost(l) : 0, conf = UI.confirm === 'demo' + i;
  const stallKind = !l.stall ? '' : l.stall === 'storage full' ? 'full' : l.stall.startsWith('needs') ? 'needs' : 'price';
  const full = up && !hqRoom(), sig = `bld|${i}|${l.b}|${l.lv}|${l.autoBuy}|${flowOf(l.b)}|${conf}|${stallKind}|${full ? capMax() + ',' + S.hqLv : ''}`;
  let fix = '';
  if (stallKind === 'needs') { const miss = Object.keys(P.rec).filter(q => (S.inv[q] || 0) < P.rec[q]); const canMake = miss.filter(q => S.unlocked[q]).map(q => PRODUCTS[q].bld);
    fix = `<section class="card"><h3>Missing inputs</h3><p class="muted" style="font-size:13px">${canMake.length ? `Build a ${canMake.join(' or ')} to supply it, or buy` : 'You don’t make this yet. Buy'} it from the market automatically.</p>${l.autoBuy ? '' : `<button class="btn gold" type="button" data-act="fixbuy" data-i="${i}">Buy inputs automatically</button>`}</section>`; }
  if (stallKind === 'full') fix = `<section class="card"><h3>Storage is full</h3><button class="btn gold" type="button" data-act="flow" data-p="${l.b}" data-v="auto">Sell the extra automatically</button></section>`;
  const pips = Array.from({ length: MAX_BLD_LV }, (_, k) => `<i class="${k < l.lv ? 'on' : ''}"></i>`).join('');
  return { sig, html: `
    <div class="side-head"><img class="px big-prev" src="${buildingPreview(l.b, l.lv)}" alt=""><div><h2>${P.bld}</h2>
      <span class="muted">Makes ${P.name} · Level ${P.ring} product</span><div style="display:flex;gap:6px;align-items:center;margin-top:4px"><span class="pips" aria-label="Level ${l.lv} of ${MAX_BLD_LV}">${pips}</span><span class="muted" style="font-size:12px">Lv ${l.lv}</span></div></div></div>
    <p data-live="status:${i}" data-base="status"></p>
    <div class="bar olive"><i data-live="prog:${i}"></i></div>
    ${fix}
    <section class="card"><div class="kv">
      <span>Makes</span><b data-live="rate:${i}"></b>
      <span>Uses</span><b data-live="uses:${i}"></b>
      <span>Upkeep</span><b data-live="bupkeep:${i}"></b>
      <span>Profit</span><b data-live="est:${l.b}|${l.lv}|own" data-base=""></b>
      <span>${P.name} sells for</span><b data-live="price:${l.b}"></b>
      <span>In storage</span><b data-live="inv:${l.b}"></b></div>
      <div style="font-size:13px">${recipeHTML(l.b, true)}</div></section>
    <section class="card"><h3>Output</h3>${flowSeg(l.b)}
      <p class="muted" style="font-size:12px">${flowOf(l.b) === 'auto' ? 'Keeps what your own factories need, sells the rest.' : flowOf(l.b) === 'sell' ? 'Sells everything as it is made.' : 'Stores everything. The factory stops when storage is full.'}</p>
      ${P.raw ? '' : `<label class="check"><input type="checkbox" data-act="autobuy" data-i="${i}" ${l.autoBuy ? 'checked' : ''}> Buy missing inputs from the market (costs ${Math.round((FACTORY_MARKUP - 1) * 100)}% more than making them)</label>`}</section>
    <p class="muted" style="font-size:13px">${BLURB[l.b]}</p>
    ${full ? hqFullCard() : ''}
    ${up ? `<button class="btn" type="button" data-act="upgrade" data-cost="${uc}" ${full ? `data-block="${HQ_FULL}"` : ''}>Upgrade to Lv ${l.lv + 1} · ${money(uc, false)}${(() => { const g = estProfit(l.b, l.lv + 1, lotMult()) - estProfit(l.b, l.lv, lotMult()); return g > 0 ? ` · +${money(g)}/min` : ''; })()}</button><span class="muted" style="font-size:12px">Each level makes it faster and fancier: ${['street lamps', 'banner flags', 'gold roof trim', 'a gold crown'][l.lv - 1]} next.</span>` : '<span class="chip gold">Max level: fully decked out</span>'}
    <button class="btn ghost" type="button" data-act="repopen">Replace with another building</button>
    <button class="btn ${conf ? 'danger' : 'ghost'}" type="button" data-act="demolish">${conf ? `Tap again: tear down for ${money(l.spent * TEAR_DOWN, false)} back` : 'Tear down'}</button>
    <button class="btn ghost" type="button" data-act="deselect">Back</button>` };
}
// v0.16: pick what to put here instead
function replaceView(i, l) {
  const P = PRODUCTS[l.b], list = PIDS.filter(p => S.unlocked[p] && p !== l.b), now = usualProfit(l.b) * l.lv;
  const act = new Set(); S.lots.forEach((x, j) => { if (x && x.b !== 'hq' && j !== i) act.add(x.b); });
  let best = null, bs = now; for (const p of list) { const e = canReplace(i, p); if (e && e !== 'Not enough cash') continue; const v = usualProfit(p, act); if (v > bs) { bs = v; best = p; } }
  const cards = list.map(p => {
    const e = canReplace(i, p), blocked = e && e !== 'Not enough cash', c = replaceCost(i, p), conf = UI.confirm === `rep${i}${p}`;
    return `<div class="bcard"><img class="px" src="${buildingPreview(p)}" alt="">
      <div class="info"><b>${PRODUCTS[p].bld} ${p === best ? '<span class="chip gold">Earns more</span>' : ''}</b><span>${recipeText(p)}</span>
      <span>Profit about <b data-live="est:${p}|1" data-base=""></b></span></div>
      <div class="act">${blocked ? `<span class="why">${e}</span>` : '<span></span>'}
      <button class="btn small ${conf ? 'danger' : ''}" type="button" data-act="replace" data-p="${p}" data-cost="${Math.max(0, c)}" ${blocked ? `data-block="${e}"` : ''}>${conf ? 'Tap again: ' : ''}${c >= 0 ? `Replace ${money(c, false)}` : `Replace, get ${money(-c, false)} back`}</button></div></div>`;
  }).join('');
  return { sig: `rep|${i}|${l.b}|${l.lv}|${list.join()}|${[...act].join()}|${best}|${UI.confirm}`, html: `
    <div class="side-head"><img class="px big-prev" src="${buildingPreview(l.b, l.lv)}" alt=""><div><h2>Replace ${P.bld}</h2><span class="muted">Level ${l.lv} · profit about <b data-live="est:${l.b}|${l.lv}|own" data-base=""></b></span></div></div>
    <p class="muted" style="font-size:13px">The new building starts at level 1. What you spent on this one counts ${TRADE_IN * 100}% towards it; anything left over comes back at ${TEAR_DOWN * 100}%.</p>
    ${cards || '<p class="muted">Unlock another product first.</p>'}
    <button class="btn ghost wide" type="button" data-act="repclose">Back</button>` };
}
function propView(k) {
  const pl = PLOTS[k], P = PROPS[pl.t], pr = S.props[k], locked = P.lvl > S.level, conf = UI.confirm === 'psell' + k;
  const sig = `prop|${k}|${pr.own}|${pr.reno}|${locked}|${conf}`;
  const reno = pr.own && pr.reno < PROP_MAX_RENO;
  return { sig, html: `
    <div class="side-head"><img class="px" src="${housePreview(pl.t, pr.own ? pr.reno : 1)}" width="96" height="116" alt="" style="margin:-16px -6px -8px -10px;flex:none"><div><h2>${P.name}</h2>
      <span class="muted">${PLOT_WHERE(k)[0].toUpperCase() + PLOT_WHERE(k).slice(1)} · ${pr.own ? `<b class="gold">You own it</b> · renovation ${pr.reno}/${PROP_MAX_RENO}` : locked ? `Opens at Level ${P.lvl}` : 'For sale'}</span></div></div>
    <section class="card"><div class="kv">
      <span>Value</span><b data-live="pv:${k}"></b>
      <span>Rent</span><b class="olive" data-live="prent:${k}"></b>
      <span>Return</span><span data-live="pyld:${k}"></span>
      <span>Pays for itself in</span><span data-live="pback:${k}"></span>
      ${pr.own ? `<span>You paid</span><b>${money(pr.paid, false)}</b><span>Gain if sold</span><b data-live="pgain:${k}" data-base=""></b>` : ''}</div></section>
    ${pr.own ? `
      ${reno ? `<button class="btn" type="button" data-act="preno" data-k="${k}" data-cost="${Math.ceil(renoCost(k))}">Renovate · ${money(renoCost(k), false)}</button>
        <span class="muted" style="font-size:12px">Rent +${RENO_RENT * 100}%, value +${RENO_VALUE * 100}% of the base price, and it gets ${pr.reno === 1 ? 'a picket fence and flowers' : 'a lamp post and a gold flag'}.</span>` : '<span class="chip gold">Fully renovated</span>'}
      <button class="btn ${conf ? 'danger' : 'ghost'}" type="button" data-act="psell" data-k="${k}">${conf ? 'Tap again to sell for ' : 'Sell for '}<span data-live="psp:${k}"></span></button>`
    : locked ? `<p class="why">Reach Level ${P.lvl} (${LEVELS[P.lvl].name}) to buy this one.</p>`
    : `<button class="btn gold" type="button" data-act="pbuy" data-k="${k}" data-cost="${Math.ceil(propBuyPrice(k))}">Buy for <span data-live="pbp:${k}"></span></button>
       <span class="muted" style="font-size:12px">Includes a ${PROP_BUY_FEE * 100}% closing fee. Selling later has a ${PROP_SELL_FEE * 100}% fee.</span>`}
    <section class="card"><h3>Housing market <span data-live="hchg:1h" data-base=""></span></h3>
      <p class="muted" style="font-size:13px">Home prices over the last hour. They drift up slowly, slide when the stock market turns, and jump on boom or slump news. Rent stays the same either way.</p></section>
    <p class="muted" style="font-size:13px">${P.about}</p>
    <button class="btn ghost" type="button" data-act="deselect">Back</button>` };
}
function renderSide(force) {
  const v = sideView();
  if (force || v.sig !== UI.sideSig) { const el = $('#side'), top = el.scrollTop; el.innerHTML = '<div class="sheet-bar"><span class="grab"></span><button class="btn ghost small" type="button" data-act="sheetclose">Close</button></div>' + v.html; updateLive(el); el.scrollTop = v.sig.split('|')[1] === (UI.sideSig.split('|')[1]) ? top : 0; UI.sideSig = v.sig; }
  updateLive($('#side'));
}

/* ---------- modals ---------- */
function openModal(kind) { UI.modal = kind; UI.modalSig = ''; UI.confirm = ''; $('#modal').hidden = false; renderModal(true); const b = $('#modal .m-head .btn'); if (b) b.focus({ preventScroll: true }); }
function closeModal() { UI.modal = null; $('#modal').hidden = true; }
function renderModal(force) {
  if (!UI.modal) return;
  const v = MODAL[UI.modal]();
  if (force || v.sig !== UI.modalSig) {
    const sh = $('#modal .sheet'), top = sh.scrollTop, box = $('#loadBox'), typed = box ? box.value : '';   // v0.04: a pasted save code survives the redraw
    $('#mTitle').textContent = v.title; $('#mBody').innerHTML = v.html; updateLive($('#mBody')); sh.scrollTop = top; UI.modalSig = v.sig;   // grey before first drawn: no flash
    if (typed && $('#loadBox')) $('#loadBox').value = typed;
    if (v.after) v.after();
  }
  updateLive($('#mBody'));
  if (UI.modal === 'stocks') drawStockChart();
}
const WEBPOS = { wood: [-110, 72], wheat: [10, 72], ore: [130, 72], planks: [-135, 128], charcoal: [185, 128], flour: [10, 128],
  chair: [-120, 188], paper: [-75, 188], bread: [-5, 188], pasta: [35, 188], iron: [165, 188], nails: [125, 188],
  sofa: [-130, 248], books: [-95, 248], lunchbox: [-40, 248], canned: [70, 248], steel: [150, 248], tools: [190, 248],
  piano: [-115, 305], hamper: [15, 305], car: [170, 305] };
const WEB = 680, WC = WEB / 2;   // the web's size and middle (v0.04: grew from 560 for the Gold Hill ring)
function webXY(p) { const [a, r] = WEBPOS[p], t = a * Math.PI / 180; return [WC + Math.cos(t) * r, WC + Math.sin(t) * r]; }
const MODAL = {
  prod() {
    const act = activeProducts(), sel = UI.webSel || S.start;
    const sig = `prod|${Object.keys(S.unlocked).join()}|${[...act].join()}|${S.level}|${sel}`;
    let lines = '';
    for (const p of PIDS) for (const q in PRODUCTS[p].rec) {
      const [x1, y1] = webXY(q), [x2, y2] = webXY(p), on = S.unlocked[p] && S.unlocked[q];
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? BRANCH[PRODUCTS[q].branch].color : '#3e2c24'}" stroke-width="${on ? 3 : 2}" ${on ? '' : 'stroke-dasharray="4 4"'}/>`;
    }
    const rings = [[100], [158], [218], [277]].map(([r]) => `<circle cx="${WC}" cy="${WC}" r="${r}" fill="none" stroke="#2a1e19" stroke-width="2" stroke-dasharray="2 6"/>`).join('');
    const nodes = PIDS.map(p => {
      const [x, y] = webXY(p), P = PRODUCTS[p], own = S.unlocked[p], err = canUnlock(p), avail = !own && (err === '' || err === 'Not enough cash');
      const cls = own ? (act.has(p) ? 'active' : 'own') : avail ? 'avail' : 'locked';
      const tag = own ? '' : avail ? money(researchCost(p), false) : (P.ring > S.level ? 'LV ' + P.ring : '');
      return `<button type="button" class="node ${cls} ${sel === p ? 'sel' : ''}" style="left:${x}px;top:${y}px" data-act="webnode" data-p="${p}" aria-label="${P.name}${own ? ', unlocked' : ''}">${iconImg(p, 36)}${tag ? `<span class="tag">${tag}</span>` : ''}</button>`;
    }).join('');
    const ringLbl = [[100, 'LV 1 · MAIN STREET'], [188, 'LV 2 · MARKET ROW'], [248, 'LV 3 · INDUSTRIAL PARK'], [305, 'LV 4 · GOLD HILL']].map(([r, t]) => `<span class="ringlbl" style="left:${WC}px;top:${WC + r}px">${t}</span>`).join('');
    // detail pane
    const P = PRODUCTS[sel], own = S.unlocked[sel], err = canUnlock(sel), cost = researchCost(sel);
    const usedBy = consumersOf(sel).map(q => `${iconImg(q, 18)} ${PRODUCTS[q].name}`).join(', ') || 'Sold to customers only';
    const detail = `
      <div class="side-head"><img class="px big-prev" src="${buildingPreview(sel)}" alt=""><div><h2 class="disp" style="font-size:34px">${P.name}</h2>
        <span class="muted">${P.bld} · ${BRANCH[P.branch].name} · LV ${P.ring} ${LEVELS[P.ring].name}</span></div></div>
      <section class="card"><div style="font-size:14px">${recipeHTML(sel)}</div><div class="kv">
        <span>One building makes</span><b>${rateTxt(cyclesPerMin(sel, 1, 1) * P.out)}</b>
        <span>Sells for now</span><b data-live="price:${sel}"></b>
        <span>Profit per building</span><b data-live="est:${sel}|1" data-base=""></b>
        <span>Build cost</span><b>${money(buildCost(sel), false)}</b>
        <span>Used to make</span><span>${usedBy}</span></div></section>
      <p class="muted" style="font-size:13px">${BLURB[sel]}</p>
      ${own ? `<span class="chip ${act.has(sel) ? 'gold' : 'olive'}" style="align-self:flex-start">${act.has(sel) ? 'Running' : 'Unlocked: click an empty lot to build it'}</span>`
        : (err === '' || err === 'Not enough cash') ? `<button class="btn" type="button" data-act="unlock" data-p="${sel}" data-cost="${cost}">Unlock ${P.name} · ${money(cost, false)}</button>`
        : `<p class="why">${err}</p>`}
      <p class="muted" style="font-size:12px">You can run ${MAX_ACTIVE_PRODUCTS} products at once (${act.size} now), so pick a direction. Lines show what each product is made from.</p>`;
    return { sig, title: 'Production', html: `
      <p class="m-sub">Start in the middle, grow outward. Every level opens the next ring, and the outer rings need goods from other branches.</p>
      <div class="web-wrap"><div class="web-scroll"><div class="web" id="web">
        <svg width="${WEB}" height="${WEB}" viewBox="0 0 ${WEB} ${WEB}" aria-hidden="true">${rings}${lines}</svg>
        ${ringLbl}
        <div style="position:absolute;left:${WC}px;top:${WC}px;transform:translate(-50%,-50%);text-align:center;font-size:12px;color:var(--bone-dim)">${iconImg('house', 36)}<br>${esc(S.company)}</div>
        ${nodes}</div></div>
        <div class="web-detail">${detail}</div></div>`,
      after() { const w = $('#web'), wrap = w.closest('.web-wrap'); let k = Math.min(1, (wrap.clientWidth) / WEB); if (innerWidth <= 900) k = Math.max(.74, k); w.style.transform = k < 1 ? `scale(${k})` : ''; w.style.marginBottom = k < 1 ? `${-WEB * (1 - k)}px` : ''; w.style.marginRight = k < 1 ? `${-WEB * (1 - k)}px` : ''; const sc = w.parentElement, sel = w.querySelector('.node.sel'); if (sc.scrollWidth > sc.clientWidth && sel) sc.scrollLeft = Math.max(0, parseFloat(sel.style.left) * k - sc.clientWidth / 2); } };
  },
  market() {
    const f = UI.mktFilter, list = PIDS.filter(p => f === 'all' || S.unlocked[p] || (S.inv[p] || 0) > 0);
    const sig = `mkt|${f}|${list.join()}|${JSON.stringify(S.flow)}`;
    const rows = list.map(p => {
      const P = PRODUCTS[p], own = S.unlocked[p];
      return `<div class="mrow"><div class="good">${iconImg(p, 36)}<div><b>${P.name}</b><small>LV ${P.ring} · ${BRANCH[P.branch].name}<span data-live="crowd:${p}"></span></small></div></div>
        <b class="sellp gold" data-live="price:${p}"></b><span class="buyp muted" data-live="bprice:${p}"></span>
        <span class="chg" data-live="mchg:${p}" data-base="chg"></span>
        <span class="trend"><svg width="90" height="24" viewBox="0 0 90 24" aria-hidden="true"><path data-live="spark:${p}" fill="none" stroke="#ebc152" stroke-width="1.5"/></svg></span>
        <span class="have" data-live="inv:${p}"></span>
        <span class="flow">${own ? flowSeg(p) : '<span class="muted" style="font-size:12px">not unlocked</span>'}</span>
        <span class="acts"><button class="btn ghost small" type="button" data-act="sell" data-p="${p}" data-q="10">Sell 10</button><button class="btn ghost small" type="button" data-act="sell" data-p="${p}" data-q="all">Sell all</button><button class="btn small" type="button" data-act="buy" data-p="${p}" data-q="10">Buy 10</button></span></div>`;
    }).join('');
    return { sig, title: 'Market', html: `
      <p class="m-sub">Prices move with the news and the market, the same for every player in Millbrook. Millbrook is a big market: your steady selling barely moves a price, but dumping a huge pile at once pushes it down for a couple of minutes. When many players sell the same good, it drops for everyone (shown as “players”). Buying by hand costs ${Math.round((NPC_MARKUP - 1) * 100)}% more than selling; a factory buying its own materials pays ${Math.round((FACTORY_MARKUP - 1) * 100)}% more.</p>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <div class="seg" role="group" aria-label="Which goods"><button type="button" data-act="mktf" data-v="mine" aria-pressed="${f === 'mine'}">Your goods</button><button type="button" data-act="mktf" data-v="all" aria-pressed="${f === 'all'}">All goods</button></div>
        <span class="muted" style="font-size:13px">Storage <b data-live="wht"></b> <button class="btn ghost small" type="button" data-act="sellspare" title="Sells everything in storage except what your own factories need">Sell all spare</button></span></div>
      <div class="mlist"><div class="mrow mhead"><span class="good">GOOD</span><span class="sellp">SELL</span><span class="buyp">BUY</span><span class="chg">5 MIN</span><span class="trend">TREND</span><span class="have">YOU HAVE</span><span class="flow">OUTPUT</span><span class="acts"></span></div>${rows}</div>` };
  },
  stocks() {
    const it = UI.investTab, tabs = `<div class="seg" role="group" aria-label="Invest in" style="margin-bottom:12px">${[['portfolio', 'Portfolio'], ['stocks', 'Stocks'], ['re', 'Real estate'], ['players', 'Players'], ['mine', 'Your company']]
      .map(([v, l]) => `<button type="button" data-act="itab" data-v="${v}" aria-pressed="${it === v}">${l}</button>`).join('')}</div>`;
    if (it === 'portfolio') return portfolioView(tabs);  // v0.09 (55_pub.js)
    if (it === 'players') return pubPlayersView(tabs);   // v0.08 (55_pub.js)
    if (it === 'mine') return pubMineView(tabs);
    if (UI.investTab === 're') {
      const tf = UI.stockTF, own = S.props.map(p => p.own ? p.reno : 0).join('');
      const rows = PLOTS.map((pl, k) => {
        const P = PROPS[pl.t], pr = S.props[k], locked = P.lvl > S.level;
        return `<button type="button" class="st-row" data-act="pshow" data-k="${k}"><img class="px" src="${housePreview(pl.t, pr.own ? pr.reno : 1)}" width="36" height="44" alt="" style="margin:-6px 0">
          <span class="nm"><b>${P.name}</b><small>${PLOT_SIDE(k)} · ${pr.own ? 'yours' : locked ? 'Level ' + P.lvl : 'for sale'}</small></span>
          <span class="px2"><b data-live="pv:${k}"></b><small class="olive" data-live="prent:${k}"></small></span></button>`;
      }).join('');
      return { sig: `re|${tf}|${own}|${S.level}`, title: 'Invest', html: tabs + `
        <p class="m-sub">Buy homes and offices on the edges of town. They pay rent every second, in full even while you’re away (for up to ${RENT_MAX / 3600} hours), and renovating them raises the rent. Their value moves slowly with the housing market. Tap one to see it on the map.</p>
        <div class="st-wrap"><div class="st-list">${rows}</div>
          <div class="st-detail">
            <div class="side-head">${iconImg('house', 54)}<div style="flex:1"><h2>Housing market</h2><span class="muted">Average home price in Millbrook</span></div>
              <div style="text-align:right"><span data-live="hchg:${tf}" data-base=""></span> <span class="muted" style="font-size:12px">${tf}</span></div></div>
            <div style="display:flex;justify-content:flex-end"><div class="seg" role="group" aria-label="Chart range">${['10m', '1h', '4h'].map(v => `<button type="button" data-act="sttf" data-v="${v}" aria-pressed="${tf === v}">${v}</button>`).join('')}</div></div>
            <canvas id="stChart" class="st-chart" role="img" aria-label="Housing market chart"></canvas>
            <div class="stat-grid">
              <div class="stat"><span>You own</span><b>${S.props.filter(p => p.own).length} of ${PLOTS.length}</b></div>
              <div class="stat"><span>Worth</span><b data-live="revalue"></b></div>
              <div class="stat"><span>Rent</span><b class="olive" data-live="rerent"></b></div></div>
          </div></div>` };
    }
    const t = UI.stockSel, a = asset(t), tf = UI.stockTF;
    const sig = `stk|${t}|${tf}`;
    const list = ASSETS.map(x => `<button type="button" class="st-row ${x.t === t ? 'sel' : ''}" data-act="stsel" data-t="${x.t}">${iconImg(x.icon, 36)}
      <span class="nm"><b>${x.name}</b><small>${x.owner ? 'by ' + x.owner : x.kind} · ${x.t}</small></span>
      <span class="px2"><b data-live="aprice:${x.t}"></b><small data-live="achg:${x.t}|1h" data-base=""></small></span></button>`).join('');
    const sub = a.owner ? `by <b>${a.owner}</b> · ${a.kind}` : a.kind;
    const fee = Math.round(feeOf(t) * 1000) / 10;
    return { sig, title: 'Invest', html: tabs + `
      <p class="m-sub">Invest your spare cash in other players' companies, the index fund or PixCoin. Prices move every second, the same for everyone in Millbrook. Most companies pay dividends while you hold them.</p>
      <div class="st-wrap"><div style="display:flex;flex-direction:column;gap:12px">
        <div class="st-list">${list}</div>
        <section class="card"><h3>Your portfolio <b class="gold" data-live="pval"></b></h3><div class="kv">
          <span>Profit / loss</span><b data-live="ppl" data-base=""></b><span>Dividends</span><b data-live="divh"></b><span>Market mood</span><b data-live="mood" data-base=""></b></div></section></div>
        <div class="st-detail">
          <div class="side-head">${iconImg(a.icon, 54)}<div style="flex:1"><h2>${a.name}</h2><span class="muted">${sub} · ${a.t}</span></div>
            <div style="text-align:right"><b class="num gold" style="font-size:30px;line-height:1" data-live="aprice:${t}"></b><br><span data-live="achg:${t}|${tf}" data-base=""></span> <span class="muted" style="font-size:12px">${tf}</span></div></div>
          <div style="display:flex;justify-content:flex-end"><div class="seg" role="group" aria-label="Chart range">${['10m', '1h', '4h'].map(v => `<button type="button" data-act="sttf" data-v="${v}" aria-pressed="${tf === v}">${v}</button>`).join('')}</div></div>
          <canvas id="stChart" class="st-chart" role="img" aria-label="${a.name} price chart"></canvas>
          <div class="stat-grid">
            <div class="stat"><span>Risk</span><b class="${a.risk === 'Low' ? 'olive' : a.risk === 'Medium' ? 'gold' : 'red'}">${a.risk}</b></div>
            <div class="stat"><span>Dividend</span><b>${a.yld ? (a.yld * 60 * 100).toFixed(1) + '% per hour' : 'None'}</b></div>
            <div class="stat"><span>You own</span><b data-live="hq:${t}"></b></div>
            <div class="stat"><span>Worth</span><b data-live="hval:${t}"></b></div>
            <div class="stat"><span>Profit / loss</span><b data-live="hpl:${t}" data-base=""></b></div></div>
          <section class="card"><h3>Trade <span class="muted">cash <b data-live="cash"></b> · ${fee}% fee</span></h3>
            <div class="trade"><span class="muted" style="font-size:13px">Buy</span>${[100, 1000, 10000].map(v => `<button class="btn small" type="button" data-act="stbuy" data-v="${v}" data-cost="${v}">${money(v, false)}</button>`).join('')}
              <button class="btn small" type="button" data-act="stbuy" data-v="half">Half my cash</button></div>
            <div class="trade"><span class="muted" style="font-size:13px">Sell</span>${[[.25, '25%'], [.5, '50%'], [1, 'All']].map(([v, l]) => `<button class="btn ghost small" type="button" data-act="stsell" data-v="${v}">${l}</button>`).join('')}</div></section>
          <p class="muted" style="font-size:13px">${a.about || `A company run by ${a.owner}. Its price follows the whole market, the ${a.sector === 'tech' ? 'tech' : a.sector} business and its own news.`}</p></div></div>` };
  },
  board() {   // v0.07: real players only. Simulated companies live in the town's news, never here.
    const me = netWorth(), you = { name: NET.name || 'You', co: S.company, nw: me, lv: S.level, you: true, player: !!NET.token };
    const all = netOthers().concat([you]);
    all.sort((a, b) => b.nw - a.nw);
    const at = all.findIndex(x => x.you), show = all.map((x, k) => ({ x, k })).filter(({ k }) => k < 10 || Math.abs(k - at) <= 2);
    const lvl = nw => { let L = 1; while (L < MAX_LEVEL && nw >= LEVELS[L + 1].nw) L++; return L; };
    let last = -1;
    const rows = show.map(({ x, k }) => {
      const gap = k > last + 1 ? '<div class="lb-gap">···</div>' : ''; last = k;
      const tag = x.you ? '<span class="chip gold">YOU</span>' : `<span class="chip olive">${x.online ? '<i class="dot" title="online now"></i>' : ''}PLAYER</span>`;
      return gap + `<div class="lb-row ${x.you ? 'you' : ''} ${k < 3 ? 'top' : ''}"><span class="rk">#${k + 1}</span>${iconImg('house', 36)}
        <div style="min-width:0"><b>${esc(x.you ? S.company : x.name)}</b><br><span class="muted" style="font-size:12px">${esc(x.you ? (NET.token ? NET.name : 'You') : x.co || '')} · LV ${x.lv || lvl(x.nw)}</span></div>
        <span class="nw">${money(x.nw, false)}</span><span class="lb-tag">${tag}</span></div>`;
    }).join('');
    const sub = !NET_API ? 'Real players only. This copy of the game was opened as a file: open it at brickncoin.com to see the other players.'
      : `Real players only, by net worth (your part of your company, plus everything else you own).${NET.players ? ` ${NET.players} player${NET.players === 1 ? '' : 's'} · ${NET.online} online now.` : ''}${NET.token ? '' : ' <b>Log into your Inspirapixel account (Menu → Online) so other players see you here.</b>'}`;
    return { sig: `board|${show.map(({ x, k }) => k + x.name).join()}|${NET.token ? 1 : 0}|${NET.players}|${Math.floor(S.t / 2)}`, title: 'Leaderboard', html: `<p class="m-sub">${sub}</p><div class="lb">${rows}</div>` };
  },
  menu() {   // v0.06: sections down the side
    const tab = UI.mtab, conf = UI.confirm === 'reset';
    const tabs = [['help', 'How to Play'], ['settings', 'Settings'], ['save', 'Save & Transfer'], ['online', 'Online'], ['about', 'About']];
    const stat = (k, v) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`;
    const nav = `<nav class="mnav" aria-label="Menu sections"><button class="btn gold" type="button" data-act="close">Resume</button>
      ${tabs.map(([v, l]) => `<button type="button" class="mtab" data-act="mtab" data-v="${v}" aria-pressed="${tab === v}">${l}</button>`).join('')}
      <hr><button type="button" class="mtab" data-act="mainmenu">Main Menu</button></nav>`;
    let pane = '';
    if (tab === 'help') pane = `<h3>How to Play</h3>${helpHTML()}${tutActive() ? '' : '<button class="btn ghost small" type="button" data-act="tutreplay" style="align-self:flex-start">Replay the tutorial</button>'}`;
    else if (tab === 'settings') pane = `<h3>Settings</h3>${settingsHTML()}`;
    else if (tab === 'save') {
      let saved = false; try { saved = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
      pane = `<h3>Save &amp; Transfer</h3>
        <p class="muted" style="font-size:13px">${NET.token ? `You’re online as <b>${esc(NET.name)}</b>: ${esc(S.company)} is saved on the server every few minutes and when you leave, and in this browser.` : saved ? 'Your game saves itself in this browser every few seconds.' : 'This browser isn’t saving. Export your save code to keep your progress.'} A save code moves your company to any device or browser.</p>
        <div class="trade"><button class="btn" type="button" data-act="savenow">Save now</button><button class="btn ghost" type="button" data-act="copysave">Export save code</button></div>
        <label class="muted" style="font-size:13px" for="loadBox">Paste a save code here to import it</label><textarea id="loadBox" class="savebox" spellcheck="false"></textarea>
        <button class="btn ghost" type="button" data-act="loadsave" style="align-self:flex-start">Import save code</button>
        <section class="card" style="margin-top:8px"><h3 style="font:600 15px/1.2 var(--font-ui);color:var(--bone)">Start over</h3><p class="muted" style="font-size:13px">Deletes ${esc(S.company)} and its save for good. Export a save code first if you might want it back.</p>
          <div class="trade"><button class="btn ${conf ? 'danger' : 'ghost'}" type="button" data-act="reset">${conf ? `Tap again to delete ${esc(S.company)}` : 'Start a new company'}</button>
          ${conf ? '<button class="btn ghost" type="button" data-act="resetno">Keep my company</button>' : ''}</div></section>`;
    } else if (tab === 'online') {   // v0.07
      const ago = NET.lastSave ? Math.max(0, Math.round((Date.now() - NET.lastSave) / 60000)) : -1;
      pane = NET.token ? `<h3>Online</h3><p class="muted" style="font-size:13px">Logged into your Inspirapixel account as <b>${esc(NET.name)}</b>. ${esc(S.company)} is saved on the server every few minutes and when you leave, so you can carry on from any device. Your selling and buying count in the shared market, and you’re on the players’ leaderboard.</p>
          <div class="mstats">${stat('Players online', NET.online)}${stat('Players', NET.players || '—')}${stat('Saved online', ago < 0 ? 'not yet' : ago === 0 ? 'just now' : ago + ' min ago')}</div>
          <div class="trade"><button class="btn" type="button" data-act="netsave">Save online now</button><button class="btn ghost" type="button" data-act="logout">Log out</button></div>
          <p class="muted" style="font-size:13px">Add an email for password recovery on your <a href="https://olympushunt.com/account.html" target="_blank" rel="noopener" class="linkbtn">Inspirapixel account page</a>.</p>`
        : NET_API ? `<h3>Play online</h3><p class="muted" style="font-size:13px">Log into your <b>Inspirapixel account</b>, or create one: one account for every Inspirapixel game (it’s the same as your Olympus Hunt account), just a name and a password. Then ${esc(S.company)} is saved on the server (play it on any device), you join the players’ leaderboard, and your selling and buying count in the shared market.</p>
          <button class="btn gold" type="button" data-act="acctpage" style="align-self:flex-start">Log in or create your Inspirapixel account</button>
          <p class="muted" style="font-size:13px">No account? Keep playing: ${esc(S.company)} stays saved in this browser.</p>`
        : `<h3>Play online</h3><p class="muted" style="font-size:13px">This copy of the game was opened as a file, so it plays offline. Open it at brickncoin.com to play online.</p>`;
    } else {
      pane = `<h3>${esc(S.company)}</h3><div class="mstats">
          ${stat('Level', `${S.level} · ${LEVELS[S.level].name}`)}${stat('Net worth', money(netWorth(), false))}${stat('Rank', '#' + playerRank())}
          ${stat('Buildings', countBuildings())}${stat('Goals done', `${S.goal} of ${GOALS.length}`)}${stat('Time played', playTime(S.t))}</div>`;
    }
    return { sig: `menu|${tab}|${UI.helpPg}|${conf}|${AUD.set.musicOn}|${AUD.set.sfxOn}|${S.tut}|${!!document.fullscreenElement}|${tab === 'about' ? Math.floor(S.t / 60) : ''}|${NET.token}|${tab === 'online' ? NET.online + '|' + Math.floor(NET.lastSave / 60000) : ''}`,
      title: 'Menu', html: `<div class="mwrap">${nav}<section class="mpane">${pane}</section></div>` };
  },
};

/* ---------- stock chart (drawn at half resolution for a pixel look) ---------- */
function drawStockChart() {
  const c = $('#stChart'); if (!c) return;
  const W = Math.max(120, Math.floor(c.clientWidth / 2)), H = 120;
  if (c.width !== W) { c.width = W; c.height = H; }
  if (UI.investTab === 'players') return drawSmoothChart(c, pubSeries(UI.pubSel, UI.pubTF || '1d'));   // v0.13: a player's company
  let h;
  {
    const A = UI.investTab === 're' ? { p: S.house.i, h10: S.house.h10, h60: S.house.h60 } : S.assets[UI.stockSel], tf = UI.stockTF;
    h = (tf === '10m' ? A.h10.slice(-60) : tf === '1h' ? A.h10.slice(-360) : A.h60.slice(-240)).concat([A.p]);
  }
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, H);
  if (h.length < 2) return;
  let lo = Math.min(...h), hi = Math.max(...h); const pad = (hi - lo) * .08 || hi * .01; lo -= pad; hi += pad;
  const up = h[h.length - 1] >= h[0], col = up ? '#9bbb55' : '#ff8a7a';
  ctx.fillStyle = '#2a1e19'; for (let g = 1; g < 4; g++) { const y = Math.round(H * g / 4); for (let x = 0; x < W; x += 3) ctx.fillRect(x, y, 1, 1); }
  const Y = v => Math.round((H - 4) - (v - lo) / (hi - lo) * (H - 8));
  let prev = Y(h[0]);
  for (let x = 0; x < W; x++) {
    const i = Math.round(x / (W - 1) * (h.length - 1)), y = Y(h[i]);
    ctx.fillStyle = up ? 'rgba(155,187,85,.16)' : 'rgba(255,138,122,.14)'; ctx.fillRect(x, y, 1, H - y);
    ctx.fillStyle = col; ctx.fillRect(x, Math.min(y, prev), 1, Math.abs(y - prev) + 1); prev = y;
  }
  const y0 = Y(h[0]); ctx.fillStyle = '#85735d'; for (let x = 0; x < W; x += 4) ctx.fillRect(x, y0, 2, 1);
}

/* ---------- toasts & ticker ---------- */
function toast(text, kind = '', ms = 2600) {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), ms);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function renderTicker() {   // the world's headlines and the company's own news, newest first
  if (!S) return;
  const n = worldNews(3).concat(S.news.slice(0, 3).map(x => ({ text: x.text, kind: x.kind, wt: x.wt == null ? -1e12 : x.wt }))).sort((a, b) => b.wt - a.wt);
  if (!n.length) return;
  const chip = k => k === 'up' ? '<span class="chip olive">UP</span>' : k === 'down' ? '<span class="chip red">DOWN</span>' : k === 'you' ? '<span class="chip gold">YOU</span>' : '<span class="chip blue">NEWS</span>';
  $('#ticker').innerHTML = `${chip(n[0].kind)}<span class="tk-new">${esc(n[0].text)}</span>${n[1] ? `<span class="tk-old">· ${esc(n[1].text)}</span>` : ''}`;
}
function renderNav() {
  const b = (act, icon, label, short, key) => `<button class="btn ghost" type="button" data-act="${act}" aria-label="${label}" title="${label}">${iconImg(icon, 36)}<span class="lg">${label}</span><span class="sm">${short}</span> <kbd>${key}</kbd></button>`;
  $('#nav').innerHTML = b('prod', 'gear', 'Production', 'Produce', 'P') + b('market', 'crate', 'Market', 'Market', 'M') + b('stocks', 'bars', 'Invest', 'Invest', 'S') + b('board', 'trophy', 'Leaderboard', 'Ranks', 'L') + b('hq', 'house', 'HQ', 'HQ', 'H');
  $('#coinIcon').innerHTML = iconImg('coin', 36, 'Cash');
  $('#fullIcon').innerHTML = iconImg('full', 27);
  renderSoundBtn();
}
function renderSoundBtn() {
  const on = soundOn(), b = $('#soundBtn');
  if (b.dataset.on === String(on)) return;
  b.dataset.on = on; b.setAttribute('aria-pressed', on); b.title = on ? 'Sound is on: tap to mute' : 'Sound is off: tap to turn it on';
  $('#soundIcon').innerHTML = iconImg(on ? 'sound' : 'mute', 27);
}

/* ---------- shared by both menus: How to Play and settings ---------- */
const HELP = [
  { art: () => bigArt(buildingPreview('wood', 2)), t: 'Build', p: [
    'Tap an <b>empty lot</b> in town and pick a building.',
    '<b>Raw producers</b> (wood, wheat, ore) need nothing: they make goods and sell them for you, so your cash goes up on its own.',
    'Tap a building to <b>upgrade</b> it. Each level is faster, and the building grows.'] },
  { art: () => bigArt(buildingPreview('planks', 3)), t: 'Make better goods', p: [
    'Open <b>Production</b> (P) to unlock new products.',
    '<b>Factories</b> turn goods into better goods: wood → planks → chairs → furniture → grand pianos.',
    'A factory short of materials can <b>buy them</b> from the market, at 15% more.'] },
  { art: () => bigArt(buildingPreview('hq', 4)), t: 'Grow', p: [
    'Your <b>HQ</b> can run a limited number of building levels. Add room to it to grow, or <b>replace</b> a building with a better one.',
    'You can make <b>5 different products</b> at once, so pick a direction.',
    'Buildings cost a little <b>upkeep</b> each minute, but nothing while they wait for materials.'] },
  { art: () => icoArt('trophy'), t: 'Open the town', p: [
    'Growing your <b>company</b> opens new parts of town: its value, plus all you put into your HQ, storage and research.',
    `<b>Market Row</b> at ${money(LEVELS[2].nw, false)}, <b>Industrial Park</b> at ${money(LEVELS[3].nw, false)}, <b>Gold Hill</b> at ${money(LEVELS[4].nw, false)}.`,
    'Follow the <b>goals</b> for cash rewards.'] },
  { art: () => icoArt('bars'), t: 'Markets', p: [
    'Sell a lot of one thing and its <b>price drops</b>, so spread out. Booms and slumps in the news move prices too.',
    '<b>Invest</b> (S) in shares, the index fund or PixCoin, and buy homes that pay <b>rent</b>.',
    'The stock market and the news are <b>the same for every player</b>, live.'] },
  { art: () => icoArt('house'), t: 'Going public', p: [
    'At Level 3, worth $100,000, your company can <b>go public</b> (Invest → Your company): sell 5% to 90% of it to investors for cash to grow with.',
    'You pick the <b>price</b> (a lower one sells every share, a higher one may not), the <b>ticker</b>, and the <b>dividend</b>: how much of the profit you pay out.',
    'You always run it. The leaderboard counts <b>your part</b> of the company, and investors’ money doesn’t count toward the next level.'] },
  { art: () => icoArt('trophy'), t: 'Players’ companies', p: [
    'Buy <b>other players’ shares</b> in Invest → Players. You get your part of the dividends, even while you’re away. A big order moves the price as it goes through.',
    'An owner can <b>offer</b> players a price for their shares: it shows up on the company if you hold some, and you choose whether to sell.',
    'Own your company and want more of it? <b>Buy shares back</b> from investors, or make players an offer.'] },
  { art: () => icoArt('coin'), t: 'While you’re away', p: [
    'Closed, or left untouched for 10 minutes, your company keeps running at <b>25% speed</b> for up to 2 hours. <b>Rent</b> from your property keeps coming in full, for up to 8.',
    'Your game saves itself in this browser. A <b>save code</b> (Menu → Save &amp; Transfer) moves your company to another device.'] },
];
function bigArt(src) { return `<img src="${src}" alt="">`; }
function icoArt(name) { return `<img class="ico" src="${iconURL(name)}" alt="">`; }
function helpHTML() {
  const n = HELP.length, k = UI.helpPg = clamp(UI.helpPg, 0, n - 1), h = HELP[k];
  return `<div class="hpage"><div class="hart">${h.art()}</div><div><h3>${h.t}</h3>${h.p.map(x => `<p>${x}</p>`).join('')}</div></div>
    <div class="hnav"><button class="btn ghost small" type="button" data-act="helppg" data-v="-1" ${k === 0 ? 'disabled' : ''}>Back</button>
      <span class="hdots" role="img" aria-label="Page ${k + 1} of ${n}">${HELP.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</span>
      <button class="btn small" type="button" data-act="helppg" data-v="1" ${k === n - 1 ? 'disabled' : ''}>Next</button></div>`;
}
function settingsHTML() {
  const A = AUD.set, onOff = k => `<div class="seg" role="group" aria-label="${k === 'musicOn' ? 'Music' : 'Sound effects'}">${[[true, 'On'], [false, 'Off']].map(([v, l]) =>
    `<button type="button" data-act="aset" data-k="${k}" data-v="${v ? 1 : 0}" aria-pressed="${A[k] === v}">${l}</button>`).join('')}</div>`;
  return `<div class="sets">
    <div class="setrow"><span>Music</span>${onOff('musicOn')}<input type="range" min="0" max="10" step="1" value="${Math.round(A.music * 10)}" data-set="music" aria-label="Music volume"></div>
    <div class="setrow"><span>Sound effects</span>${onOff('sfxOn')}<input type="range" min="0" max="10" step="1" value="${Math.round(A.sfx * 10)}" data-set="sfx" aria-label="Sound effects volume"></div>
    <div class="setrow"><span>Full screen</span><button class="btn ghost small" type="button" data-act="full">${document.fullscreenElement || document.webkitFullscreenElement ? 'Leave full screen' : 'Go full screen'}</button></div>
    <p class="muted" style="font-size:12px">Each part of town has its own tune. Sound settings are kept on this device.</p></div>`;
}
function playTime(sec) { const m = Math.floor(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }

/* ---------- the starting menu (v0.06): a town drifting by behind the logo, the menu, the live market ---------- */
const START_INFO = {
  wood: { leads: 'Planks, Charcoal, Chairs, Paper, Books, Furniture, Pianos' },
  wheat: { leads: 'Flour, Bread, Pasta, Lunch Boxes, Canned Food, Gift Hampers' },
  ore: { leads: 'Iron, Nails, Steel, Tools, Motor Cars' },
};
let TITLE_SAVE = null, TITLE_TOWN = null;   // the company saved in this browser (shown on Continue), the backdrop picture
const TPAGES = {
  new() {
    const pick = UI.startPick, ex = TITLE_SAVE === 'both' ? NET.cloud : TITLE_SAVE;
    const cards = ['wood', 'wheat', 'ore'].map(p => `<button type="button" class="pick" data-act="pick" data-p="${p}" aria-pressed="${pick === p}">
      <img class="px prev" src="${buildingPreview(p)}" alt=""><span class="pk-txt"><b>${PRODUCTS[p].name}</b><span>${PRODUCTS[p].bld}</span><span>Leads to: ${START_INFO[p].leads}</span></span></button>`).join('');
    return `<h2>New company</h2><form class="start-form" id="startForm">
      <label>Company name<input id="coInput" maxlength="24" autocomplete="off" placeholder="e.g. Oakline Co." value=""></label>
      <div class="muted" style="font-size:14px">Pick your starting material. It decides your first direction. You can branch out later.</div>
      <div class="picks">${cards}</div>
      <div class="start-err" id="startErr"></div>
      ${ex ? `<div class="twarn">This replaces ${esc(ex.company)} ${NET.token ? 'online and in this browser' : 'in this browser'}. To keep it, open it and export its save code first (Menu → Save &amp; Transfer).</div>` : ''}
      <div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Back</button>
        <button class="btn gold" type="submit" id="tgo" style="font-size:18px;padding:12px 28px">Open for business</button></div></form>`;
  },
  account() {   // v0.07: log into or create an Inspirapixel account (the same accounts as Olympus Hunt: a name and a password)
    if (NET.token) return `<h2>Your Inspirapixel account</h2><p>Logged in as <b>${esc(NET.name)}</b>. Your company is saved on the server, so you can carry on from any device, and you’re on the players’ leaderboard.</p>
      <div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Back</button><button class="btn" type="button" data-act="logout">Log out</button></div>`;
    return `<h2>Log into your Inspirapixel account</h2><form class="start-form" id="acctForm">
      <p class="muted" style="font-size:14px">One Inspirapixel account works in every Inspirapixel game: if you play Olympus Hunt, it’s the same name and password. New here? Fill these in and press <b>Create account</b>. Online, your company is saved on the server, you join the players’ leaderboard, and your selling moves the shared market.</p>
      <label>Name<input id="acName" maxlength="20" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
      <label>Password<input id="acPw" type="password" maxlength="100" autocomplete="current-password"></label>
      <div class="start-err" id="acErr"></div>
      <div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Back</button>
        <button class="btn ghost" type="button" data-act="register" id="acNew">Create account</button>
        <button class="btn gold" type="submit" id="acGo" style="font-size:18px;padding:12px 28px">Log in</button></div>
      <p class="muted" style="font-size:13px"><a href="https://olympushunt.com/account.html?forgot" target="_blank" rel="noopener" class="linkbtn">Forgot password?</a> Names are 3 to 20 letters, numbers or underscores. Once you’re in, add an email on your <a href="https://olympushunt.com/account.html" target="_blank" rel="noopener" class="linkbtn">account page</a> so a forgotten password can be reset. No account? You can still play: your company is saved in this browser.</p></form>`;
  },
  pick() {   // v0.07: the account's online company and this browser's are different companies
    const L = loadLocal(), C = NET.cloud, card = (o, v, where) => o ? `<button type="button" class="tbtn" data-act="usesave" data-v="${v}">${where}<small>${esc(o.company)} · Lv ${o.level} · ${money(o.cash, false)}</small></button>` : '';
    return `<h2>Which company?</h2><p class="muted" style="font-size:14px">Your account has a company saved online, and this browser has a different one. Pick the one to play: the other is replaced the next time the game saves. To keep it, open it first and export its save code (Menu → Save &amp; Transfer).</p>
      <nav class="tmenu" aria-label="Companies">${card(C, 'cloud', 'Online')}${card(L, 'local', 'This browser')}</nav>
      <div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Back</button></div>`;
  },
  help() { return `<h2>How to play</h2>${helpHTML()}<div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Main menu</button></div>`; },
  settings() { return `<h2>Settings</h2>${settingsHTML()}<div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Back</button></div>`; },
  news() {   // What's New: the patch notes, newest first (WHATS_NEW in 10_data.js); reading it clears the NEW badge
    seenNews();
    return `<h2>What's new</h2><div class="wn">${WHATS_NEW.map((r, i) => `<section><h3>${r.v} · ${r.title}${i === 0 ? ' <span class="chip gold">NEW</span>' : ''}</h3>
      <ul>${r.items.map(x => `<li>${x}</li>`).join('')}</ul></section>`).join('')}</div>
      <div class="tfoot"><button class="btn ghost" type="button" data-act="tpage" data-v="home">Back</button></div>`;
  },
};
function renderTitle(page) {
  if (page) UI.tpage = page;
  const st = $('#start'), pg = UI.tpage, both = TITLE_SAVE === 'both', ex = both ? null : TITLE_SAVE;
  if (!$('#tbox')) {   // built once, so changing pages doesn't restart the drifting town
    st.innerHTML = `<div class="ttown" id="ttown"></div><div class="tshade"></div><div class="tbox" id="tbox"></div><footer class="tmarket" id="tmarket" aria-label="The live market"></footer>`;
    paintTitleTown();
  }
  const head = `<header class="thead"><div class="brand">INSPIRAPIXEL</div><h1 class="title">Brick &amp; <span class="shine">Coin</span></h1><div class="ver">${VERSION}</div></header>`;
  const home = `<nav class="tmenu" aria-label="Main menu">
    ${ex ? `<button type="button" class="tbtn main" data-act="continue">Continue<small>${esc(ex.company)} · Lv ${ex.level} ${LEVELS[ex.level] ? LEVELS[ex.level].name : ''} · ${money(ex.cash, false)}${NET.token ? ' · online' : ''}</small></button>` : ''}
    ${both ? '<button type="button" class="tbtn main" data-act="tpage" data-v="pick">Continue<small>Choose a company</small></button>' : ''}
    <button type="button" class="tbtn ${ex || both ? '' : 'main'}" data-act="tpage" data-v="new">New Company</button>
    <button type="button" class="tbtn" data-act="tpage" data-v="help">How to Play</button>
    <button type="button" class="tbtn" data-act="tpage" data-v="settings">Settings</button>
    <button type="button" class="tbtn" data-act="tpage" data-v="news">What's New${newsUnseen() ? '<span class="tnew chip gold">NEW</span>' : ''}</button>
    ${!NET_API ? '' : NET.token ? `<div class="tacct">Inspirapixel account: <b>${esc(NET.name)}</b> · <button type="button" class="linkbtn" data-act="tpage" data-v="account">Account</button></div>`
      : '<button type="button" class="tbtn" data-act="tpage" data-v="account">Play Online<small>Log into your Inspirapixel account</small></button>'}</nav>`;
  const box = $('#tbox');
  box.className = 'tbox' + (pg === 'home' ? '' : ' sub');
  box.innerHTML = head + (pg === 'home' ? home : `<section class="tpanel">${TPAGES[pg]()}</section>`);
  if (pg === 'new') $('#startForm').addEventListener('submit', e => { e.preventDefault(); startNew(); });
  if (pg === 'account' && $('#acctForm')) $('#acctForm').addEventListener('submit', e => { e.preventDefault(); doLogin(false); });
  renderTitleMarket();
}
// the NEW badge on What's New: shown until this device has opened the latest notes
const NEWS_KEY = 'inspirapixel_bizgame_seen';
function newsUnseen() { try { return localStorage.getItem(NEWS_KEY) !== WHATS_NEW[0].v; } catch (e) { return false; } }
function seenNews() { try { localStorage.setItem(NEWS_KEY, WHATS_NEW[0].v); } catch (e) {} }
// the live market along the bottom: the same prices and news every player sees right now
function renderTitleMarket() {
  const el = $('#tmarket'); if (!el || !WS.ready) return;
  const q = t => { const A = WS.assets[t], c = changeOf(A.h10, 359); return `<span class="tq">${iconImg(asset(t).icon, 18)}<b>${t}</b> ${money(A.p)} <span class="${c >= 0 ? 'olive' : 'red'}">${pctTxt(c)}</span></span>`; };
  const n = worldNews(1)[0];
  el.innerHTML = `<span class="chip gold">LIVE MARKET</span>${q('MB10')}${q('PXC')}${q('NOVA')}${n ? `<span class="tnews">${esc(n.text)}</span>` : ''}`;
}
// the backdrop: a busy Millbrook (every area open, buildings at every level), drawn once and scaled up in whole pixels
function paintTitleTown() {
  const el = $('#ttown'); if (!el) return;
  if (!TITLE_TOWN) TITLE_TOWN = townPostcard();
  const k = Math.max(1, Math.floor(innerHeight / 300));
  el.style.backgroundImage = `url(${TITLE_TOWN})`; el.style.backgroundSize = `${WORLD_W * k}px ${WORLD_H * k}px`;
}
function townPostcard() {
  const c = document.createElement('canvas'); c.width = WORLD_W; c.height = WORLD_H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  drawBackground(MAX_LEVEL); x.drawImage(BG, 0, 0); BG_LEVEL = -1;   // the game draws its own town again when it starts
  const plan = { 1: ['wood', 'wheat', 'ore', 'planks', 'flour', 'charcoal', 'wood', 'wheat', 'planks', 'ore'], 0: ['chair', 'paper', 'bread', 'pasta', 'iron', 'nails', 'chair', 'bread', 'iron'],
    2: ['sofa', 'books', 'lunchbox', 'canned', 'steel', 'tools', 'steel', 'sofa', 'canned'], 3: ['piano', 'hamper', 'car', 'piano', 'car', 'hamper', 'car', 'piano', 'hamper', 'car'] };
  const spots = [];
  for (let b = 0; b < 4; b++) { let k = 0; for (let i = b * 12; i < b * 12 + 12; i++) { if (i === HQ_LOT) { spots.push({ i, b: 'hq', lv: 5 }); continue; } const t = plan[b][k++]; if (t) spots.push({ i, b: t, lv: 1 + (i * 7) % 5 }); } }
  PLOTS.forEach((pl, k) => spots.push({ i: 100 + k, house: pl.t, reno: 1 + k % 3, own: k % 3 !== 1 }));
  spots.sort((a, b) => spotXY(a.i).y - spotXY(b.i).y);
  const P = Painter(x, TX, TY);
  for (const s of spots) {
    const { x: lx, y: ly } = spotXY(s.i);
    if (s.house) {
      x.drawImage(houseSprite(s.house, s.reno), TX + lx - 6, TY + ly - 14);
      if (s.own) { P.r(lx + PLOT - 6, ly - 10, 1, 9, K); P.r(lx + PLOT - 5, ly - 10, 5, 4, K); P.r(lx + PLOT - 5, ly - 9, 4, 2, '#ebc152'); }
      continue;
    }
    const tier = s.lv;
    x.drawImage(buildingSprite(s.b, tier), TX + lx - SPR_OX, TY + ly - SPR_OY);
    if (BUILD[s.b].anim) BUILD[s.b].anim(Painter(x, TX + lx, TY + ly), .35 + s.i * .37);
    if (tier >= 2) decorAnim(Painter(x, TX + lx, TY + ly), s.b, tier, s.i * .37);
    if (s.b !== 'hq') for (let k = 0; k < s.lv; k++) { P.r(lx + 1 + k * 4, ly + LOT - 4, 4, 4, K); P.r(lx + 2 + k * 4, ly + LOT - 3, 2, 2, '#ebc152'); }
  }
  for (let k = 0; k < 14; k++) {   // people out walking
    const h = k % 3 !== 0, v = ROAD_V[k % 2];
    drawWalker(P, { x: h ? -150 + k * 61 % 760 : v.x + 3 + k % 8, y: h ? ROAD_H.y + 3 + k % 7 : -60 + k * 47 % 520, shirt: SHIRTS[k % SHIRTS.length], hair: ['#3a2416', '#140d0b', '#8a5a34', '#ebc152'][k % 4] }, k * .3);
  }
  return c.toDataURL();
}

