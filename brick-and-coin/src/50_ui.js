'use strict';
/* ============================================================================
   UI — top bar, side panel, menus (production web, market, stocks, leaderboard),
   start screen, toasts and the news ticker.
   ========================================================================== */
const $ = s => document.querySelector(s);
const UI = { investTab: 'stocks', sel: null, sheet: false, modal: null, sideSig: '', modalSig: '', webSel: null, stockSel: 'MB10', stockTF: '1h', mktFilter: 'mine', confirm: '', startPick: 'wood' };

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
function inputPrice(q, act = activeProducts()) { return act.has(q) ? price(q) : buyPrice(q); }
function estProfit(p, lv = 1, mult = 1) {
  const P = PRODUCTS[p], c = cyclesPerMin(p, lv, mult), act = activeProducts();
  let v = c * P.out * price(p); for (const q in P.rec) v -= c * P.rec[q] * inputPrice(q, act);
  return v - UPKEEP[tierOf(p)] * lv;
}
function lotMult() { return efficiency() * (boostOn() ? STARTUP_BOOST : 1); }
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
  est(arg) { const [p, lv, own] = arg.split('|'); const v = estProfit(p, +lv, own ? lotMult() : (boostOn() ? STARTUP_BOOST : 1)); return { text: (v >= 0 ? '+' : '') + money(v) + '/min', cls: v >= 0 ? 'olive' : 'red' }; },
  prog(i, el) { const l = S.lots[i]; el.style.width = (l && l.running ? Math.min(100, l.prog * 100) : 0) + '%'; },
  status(i) {
    const l = S.lots[i]; if (!l) return '';
    if (l.stall) return { text: (l.stall === 'storage full' ? 'Stopped: storage full. Sell some, or set output to Auto.' : 'Waiting: ' + l.stall + '.') + ' No upkeep while it waits.', cls: 'status bad' };
    const e = efficiency();
    if (e < 1) return { text: `Running slow: over your factory limit (${Math.round(e * 100)}% speed)`, cls: 'status warn' };
    return { text: 'Running' + (boostOn() ? ' · startup boost +50%' : ''), cls: 'status ok' };
  },
  rate(i) { const l = S.lots[i]; if (!l) return ''; return rateTxt(cyclesPerMin(l.b, l.lv, lotMult()) * PRODUCTS[l.b].out) + ' ' + PRODUCTS[l.b].name; },
  uses(i) { const l = S.lots[i]; if (!l) return ''; const P = PRODUCTS[l.b]; if (P.raw) return 'no materials'; const c = cyclesPerMin(l.b, l.lv, lotMult()); return Object.keys(P.rec).map(q => rateTxt(c * P.rec[q]) + ' ' + PRODUCTS[q].name).join(', '); },
  lvbar(_, el) { const L = S.level; if (L >= MAX_LEVEL) { el.style.width = '100%'; return; } const a = LEVELS[L].nw, b = LEVELS[L + 1].nw; el.style.width = clamp((netWorth() - a) / (b - a), 0, 1) * 100 + '%'; },
  nw: () => money(netWorth(), false),
  capt: () => `${capUsed()} / ${capMax()}`, wht: () => `${qty(whUsed())} / ${whMax()}`,
  capbar(_, el) { el.style.width = Math.min(100, capUsed() / capMax() * 100) + '%'; el.classList.toggle('over', capUsed() > capMax()); },
  whbar(_, el) { el.style.width = Math.min(100, whUsed() / whMax() * 100) + '%'; el.classList.toggle('over', whUsed() >= whMax()); },
  ppm() { const v = profitPerMin(); return { text: (v >= 0 ? '+' : '') + money(v) + '/min', cls: v >= 0 ? 'olive' : 'red' }; },
  upkeep() { let u = 0; for (const l of S.lots) if (l && l.b !== 'hq' && !l.stall) u += upkeepPerMin(l); return money(u) + '/min'; },
  bupkeep(i) { const l = S.lots[i]; if (!l) return ''; return l.stall ? 'paused while it waits' : money(upkeepPerMin(l)) + '/min'; },
  spark(p, el) { el.setAttribute('d', sparkPath(S.market[p].hist, 90, 24)); },
  mchg(p) { const c = changeOf(S.market[p].hist, 59); return { text: pctTxt(c), cls: c >= 0 ? 'olive' : 'red' }; },
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
  $('#boostChip').hidden = !boostOn();
  $('#cash').textContent = money(S.cash, false); $('#cash').style.color = S.cash < 0 ? 'var(--pink)' : '';   // red when in debt
  const v = profitPerMin(), pp = $('#ppm'); pp.textContent = (v >= 0 ? '+' : '') + money(v) + '/min profit'; pp.className = v >= 0 ? 'olive' : 'red';
  const nw = netWorth(); $('#nw').textContent = money(nw, false);
  const L = S.level, bar = $('#lvBar');
  if (L < MAX_LEVEL) { const a = LEVELS[L].nw, b = LEVELS[L + 1].nw; bar.style.width = clamp((nw - a) / (b - a), 0, 1) * 100 + '%'; $('#lvNext').textContent = `Level ${L + 1} (${LEVELS[L + 1].name}) at ${money(b, false)}`; }
  else { bar.style.width = '100%'; $('#lvNext').textContent = `Top level: all of Millbrook is open`; }
  $('#lvBarWrap').setAttribute('aria-label', 'Progress to next level');
  $('#cap').textContent = `${capUsed()} / ${capMax()}`;
  const cb = $('#capBar'); cb.style.width = Math.min(100, capUsed() / capMax() * 100) + '%'; cb.classList.toggle('over', capUsed() > capMax());
  $('#capNote').textContent = capUsed() > capMax() ? `Over the limit: all factories at ${Math.round(efficiency() * 100)}% speed` : 'each building level uses one';
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
  if (l) return bldView(i, l);
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
      <p class="muted" style="font-size:12px">Auto keeps what your own factories need and sells the rest. Sell sells everything. Keep stores it all.</p></section>
    <section class="card"><h3>How to play</h3>
      <p class="tip">Tap an <b>empty lot</b> to build. Tap a <b>building</b> to upgrade it. Drag the map to look around.</p>
      <p class="tip">Open <b>Production</b> to unlock new products, <b>Market</b> to trade goods, <b>Invest</b> for stocks and real estate.</p>
      <p class="tip">Grow your <b>net worth</b> to open new areas of town and deeper products.</p></section>` };
}
function flowSeg(p, compact) {
  const f = flowOf(p);
  return `<div class="seg" role="group" aria-label="What to do with ${PRODUCTS[p].name}">${['auto', 'sell', 'keep'].map(v =>
    `<button type="button" data-act="flow" data-p="${p}" data-v="${v}" aria-pressed="${f === v}">${v === 'auto' ? 'Auto' : v === 'sell' ? 'Sell' : 'Keep'}</button>`).join('')}</div>`;
}
function emptyView(i) {
  const act = activeProducts();
  const list = PIDS.filter(p => S.unlocked[p]);
  const sig0 = `empty|${i}|${list.join()}|${[...act].join()}|${S.level}`;
  let best = null, bs = -Infinity;
  for (const p of list) { if (!act.has(p) && act.size >= MAX_ACTIVE_PRODUCTS) continue; const sc = estProfit(p) / buildCost(p); if (S.cash >= buildCost(p) && sc > bs) { bs = sc; best = p; } }
  const cards = list.map(p => {
    const c = buildCost(p), blocked = !act.has(p) && act.size >= MAX_ACTIVE_PRODUCTS;
    return `<div class="bcard"><img class="px" src="${buildingPreview(p)}" alt="">
      <div class="info"><b>${PRODUCTS[p].bld} ${p === best ? '<span class="chip gold">Best pick</span>' : ''}</b><span>${recipeText(p)}</span>
      <span>${rateTxt(cyclesPerMin(p, 1, boostOn() ? STARTUP_BOOST : 1) * PRODUCTS[p].out)} · upkeep ${money(UPKEEP[tierOf(p)])}/min</span>
      <span>Profit about <b data-live="est:${p}|1" data-base=""></b></span></div>
      <div class="act">${blocked ? `<span class="why">Product limit ${MAX_ACTIVE_PRODUCTS}/${MAX_ACTIVE_PRODUCTS}: tear down another product first</span>` : '<span></span>'}
      <button class="btn small" type="button" data-act="build" data-p="${p}" data-cost="${c}" ${blocked ? 'data-block="1"' : ''}>Build ${money(c, false)}</button></div></div>`;
  }).join('');
  const sig = sig0 + '|' + best;
  return { sig, html: `
    <div class="side-head"><div><h2>Empty lot</h2><span class="muted">${ZONE_NAME[Math.floor(i / 12)]}</span></div></div>
    ${cards || '<p class="muted">You have no products unlocked yet.</p>'}
    <button class="btn ghost wide" type="button" data-act="prod">${iconImg('gear', 18)} Unlock more products</button>
    <button class="btn ghost wide" type="button" data-act="deselect">Back</button>` };
}
function lockedView(i) {
  const b = Math.floor(i / 12), L = ZONE_LEVEL[b];
  return { sig: `locked|${b}|${S.level}`, html: `
    <div class="side-head">${iconImg('lock', 54)}<div><h2>${ZONE_NAME[b]}</h2><span class="muted">Opens at Level ${L} (${LEVELS[L].name})</span></div></div>
    <section class="card"><p>Reach <b class="gold">${money(LEVELS[L].nw, false)}</b> net worth to build here. You're at <b data-live="nw"></b>.</p>
    <div class="bar"><i data-live="lvbar"></i></div>
    <p class="muted" style="font-size:13px">A new level also unlocks deeper products in the Production web, and the market gets bigger so prices hold up when you sell more.</p></section>
    <button class="btn ghost wide" type="button" data-act="deselect">Back</button>` };
}
function hqView() {
  const sig = `hq|${S.hqLv}|${S.whLv}|${S.level}`;
  const hqNext = S.hqLv < HQ_COST.length, whNext = S.whLv < WH_COST.length;
  return { sig, html: `
    <div class="side-head"><img class="px big-prev" src="${buildingPreview('hq', 1 + Math.round(S.hqLv * 4 / 7))}" alt=""><div><h2>${esc(S.company)} HQ</h2><span class="muted">Level ${S.level} · ${LEVELS[S.level].name}</span></div></div>
    <section class="card"><h3>Factory limit <span data-live="capt"></span></h3><div class="bar"><i data-live="capbar"></i></div>
      <p class="muted" style="font-size:13px">Every building level uses one slot. Go over the limit and <b>all</b> your factories slow down.</p>
      ${hqNext ? `<button class="btn" type="button" data-act="hqup" data-cost="${hqUpgradeCost()}">Upgrade HQ to ${HQ_CAP[S.hqLv + 1]} slots · ${money(hqUpgradeCost(), false)}</button>` : '<span class="chip gold">HQ fully upgraded</span>'}</section>
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
  const stallKind = !l.stall ? '' : l.stall === 'storage full' ? 'full' : 'needs';
  const sig = `bld|${i}|${l.b}|${l.lv}|${l.autoBuy}|${flowOf(l.b)}|${conf}|${stallKind}`;
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
      ${P.raw ? '' : `<label class="check"><input type="checkbox" data-act="autobuy" data-i="${i}" ${l.autoBuy ? 'checked' : ''}> Buy missing inputs from the market (costs ${Math.round((NPC_MARKUP - 1) * 100)}% more than making them)</label>`}</section>
    <p class="muted" style="font-size:13px">${BLURB[l.b]}</p>
    ${up ? `<button class="btn" type="button" data-act="upgrade" data-cost="${uc}">Upgrade to Lv ${l.lv + 1} · ${money(uc, false)}</button><span class="muted" style="font-size:12px">Each level makes it faster and fancier: ${['street lamps', 'banner flags', 'gold roof trim', 'a gold crown'][l.lv - 1]} next.</span>` : '<span class="chip gold">Max level: fully decked out</span>'}
    <button class="btn ${conf ? 'danger' : 'ghost'}" type="button" data-act="demolish">${conf ? `Tap again: tear down for ${money(l.spent * .4, false)} back` : 'Tear down'}</button>
    <button class="btn ghost" type="button" data-act="deselect">Back</button>` };
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
  if (force || v.sig !== UI.sideSig) { const el = $('#side'), top = el.scrollTop; el.innerHTML = '<div class="sheet-bar"><span class="grab"></span><button class="btn ghost small" type="button" data-act="sheetclose">Close</button></div>' + v.html; el.scrollTop = v.sig.split('|')[1] === (UI.sideSig.split('|')[1]) ? top : 0; UI.sideSig = v.sig; }
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
    $('#mTitle').textContent = v.title; $('#mBody').innerHTML = v.html; sh.scrollTop = top; UI.modalSig = v.sig;
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
      return `<div class="mrow"><div class="good">${iconImg(p, 36)}<div><b>${P.name}</b><small>LV ${P.ring} · ${BRANCH[P.branch].name}</small></div></div>
        <b class="sellp gold" data-live="price:${p}"></b><span class="buyp muted" data-live="bprice:${p}"></span>
        <span class="chg" data-live="mchg:${p}" data-base="chg"></span>
        <span class="trend"><svg width="90" height="24" viewBox="0 0 90 24" aria-hidden="true"><path data-live="spark:${p}" fill="none" stroke="#ebc152" stroke-width="1.5"/></svg></span>
        <span class="have" data-live="inv:${p}"></span>
        <span class="flow">${own ? flowSeg(p) : '<span class="muted" style="font-size:12px">not unlocked</span>'}</span>
        <span class="acts"><button class="btn ghost small" type="button" data-act="sell" data-p="${p}" data-q="10">Sell 10</button><button class="btn ghost small" type="button" data-act="sell" data-p="${p}" data-q="all">Sell all</button><button class="btn small" type="button" data-act="buy" data-p="${p}" data-q="10">Buy 10</button></span></div>`;
    }).join('');
    return { sig, title: 'Market', html: `
      <p class="m-sub">Prices move with supply, demand and the news. Sell a lot at once and the price drops. Buying from the market costs ${Math.round((NPC_MARKUP - 1) * 100)}% more than selling.</p>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <div class="seg" role="group" aria-label="Which goods"><button type="button" data-act="mktf" data-v="mine" aria-pressed="${f === 'mine'}">Your goods</button><button type="button" data-act="mktf" data-v="all" aria-pressed="${f === 'all'}">All goods</button></div>
        <span class="muted" style="font-size:13px">Storage <b data-live="wht"></b></span></div>
      <div class="mlist"><div class="mrow mhead"><span class="good">GOOD</span><span class="sellp">SELL</span><span class="buyp">BUY</span><span class="chg">5 MIN</span><span class="trend">TREND</span><span class="have">YOU HAVE</span><span class="flow">OUTPUT</span><span class="acts"></span></div>${rows}</div>` };
  },
  stocks() {
    const tabs = `<div class="seg" role="group" aria-label="Invest in" style="margin-bottom:12px"><button type="button" data-act="itab" data-v="stocks" aria-pressed="${UI.investTab !== 're'}">Stocks</button><button type="button" data-act="itab" data-v="re" aria-pressed="${UI.investTab === 're'}">Real estate</button></div>`;
    if (UI.investTab === 're') {
      const tf = UI.stockTF, own = S.props.map(p => p.own ? p.reno : 0).join('');
      const rows = PLOTS.map((pl, k) => {
        const P = PROPS[pl.t], pr = S.props[k], locked = P.lvl > S.level;
        return `<button type="button" class="st-row" data-act="pshow" data-k="${k}"><img class="px" src="${housePreview(pl.t, pr.own ? pr.reno : 1)}" width="36" height="44" alt="" style="margin:-6px 0">
          <span class="nm"><b>${P.name}</b><small>${PLOT_SIDE(k)} · ${pr.own ? 'yours' : locked ? 'Level ' + P.lvl : 'for sale'}</small></span>
          <span class="px2"><b data-live="pv:${k}"></b><small class="olive" data-live="prent:${k}"></small></span></button>`;
      }).join('');
      return { sig: `re|${tf}|${own}|${S.level}`, title: 'Invest', html: tabs + `
        <p class="m-sub">Buy homes and offices on the edges of town. They pay rent every second, and renovating them raises the rent. Their value moves slowly with the housing market. Tap one to see it on the map.</p>
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
      <p class="m-sub">Invest your spare cash in other players' companies, the index fund or PixCoin. Prices move every second. Most companies pay dividends while you hold them.</p>
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
  board() {
    const me = netWorth(), all = S.rivals.map((r, i) => ({ name: r.name, co: RIVAL_CO[r.name], nw: r.nw, link: RIVALS[i].link })).concat([{ name: 'You', co: S.company, nw: me, you: true }]);
    all.sort((a, b) => b.nw - a.nw);
    const sig = 'board|' + all.map(x => x.name).join();
    const lvl = nw => { let L = 1; while (L < MAX_LEVEL && nw >= LEVELS[L + 1].nw) L++; return L; };
    const rows = all.map((x, k) => {
      const ic = x.you ? 'house' : x.link ? asset(x.link).icon : 'crate';
      return `<div class="lb-row ${x.you ? 'you' : ''} ${k < 3 ? 'top' : ''}"><span class="rk">#${k + 1}</span>${iconImg(ic, 36)}
        <div style="min-width:0"><b>${esc(x.you ? S.company : x.name)}</b><br><span class="muted" style="font-size:12px">${x.you ? 'You' : esc(x.co)} · LV ${lvl(x.nw)}</span></div>
        <span class="nw">${money(x.nw, false)}</span><span class="muted" style="font-size:12px;text-align:right">${x.you ? 'you' : x.link ? x.link : ''}</span></div>`;
    }).join('');
    return { sig: sig + '|' + Math.floor(S.t / 2), title: 'Leaderboard', html: `<p class="m-sub">The richest players in Millbrook. Net worth = cash + buildings + goods + stocks.</p><div class="lb">${rows}</div>` };
  },
  menu() {
    let saved = false; try { saved = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
    const conf = UI.confirm === 'reset', A = AUD.set;
    const onOff = k => `<div class="seg" role="group" aria-label="${k === 'musicOn' ? 'Music' : 'Sound effects'}">${[[true, 'On'], [false, 'Off']].map(([v, l]) =>
      `<button type="button" data-act="aset" data-k="${k}" data-v="${v ? 1 : 0}" aria-pressed="${A[k] === v}">${l}</button>`).join('')}</div>`;
    return { sig: `menu|${conf}|${A.musicOn}|${A.sfxOn}|${S.tut}`, title: 'Menu', html: `
      <div class="help">
        <section class="card"><h3>Sound</h3>
          <div class="setrow"><span>Music</span>${onOff('musicOn')}<input type="range" min="0" max="10" step="1" value="${Math.round(A.music * 10)}" data-set="music" aria-label="Music volume"></div>
          <div class="setrow"><span>Sound effects</span>${onOff('sfxOn')}<input type="range" min="0" max="10" step="1" value="${Math.round(A.sfx * 10)}" data-set="sfx" aria-label="Sound effects volume"></div>
          <p class="muted" style="font-size:12px">Each part of town has its own tune. The speaker button at the top turns all sound on or off.</p></section>
        <section class="card"><h3>Save</h3><p class="muted" style="font-size:13px">${saved ? 'Your game saves itself in this browser every few seconds.' : 'This browser isn’t saving. Export your save code to keep your progress.'} A save code moves your company to any device or browser.</p>
          <div class="trade"><button class="btn" type="button" data-act="savenow">Save now</button><button class="btn ghost" type="button" data-act="copysave">Export save code</button></div>
          <label class="muted" style="font-size:13px" for="loadBox">Paste a save code here to import it</label><textarea id="loadBox" class="savebox" spellcheck="false"></textarea>
          <button class="btn ghost" type="button" data-act="loadsave">Import save code</button></section>
        <section class="card"><h3>How it works</h3>
          <p><b>Build</b> on empty lots. Raw producers need nothing. Factories turn goods into better goods.</p>
          <p><b>Factory limit:</b> your HQ can run so many building levels. Upgrade it to grow.</p>
          <p><b>Upkeep:</b> every building costs a little each minute to run, but nothing while it's stopped waiting for materials.</p>
          <p><b>Levels:</b> net worth opens new areas of town and deeper rings of products.</p>
          <p><b>Market:</b> the more you sell of one thing, the lower its price. Spread out.</p>
          <p><b>Invest:</b> stocks (the index fund is steady, PixCoin is wild) and real estate west and east of town that pays rent.</p>
          <p><b>Upgrades:</b> every building level makes it faster and grows the building: annex, back wing, smokestack, then a gold tower.</p>
          <p><b>Offline:</b> your factories keep running at 25% speed for up to 2 hours.</p>
          ${tutActive() ? '' : '<button class="btn ghost" type="button" data-act="tutreplay">Replay the tutorial</button>'}</section>
        <section class="card"><h3>Start over</h3><p class="muted" style="font-size:13px">Deletes ${esc(S.company)} and its save for good. Export a save code first if you might want it back.</p>
          <button class="btn ${conf ? 'danger' : 'ghost'}" type="button" data-act="reset">${conf ? `Tap again to delete ${esc(S.company)}` : 'Start a new company'}</button>
          ${conf ? '<button class="btn ghost" type="button" data-act="resetno">Keep my company</button>' : ''}</section>
      </div><p class="muted" style="font-size:12px;margin-top:12px">Brick &amp; Coin ${VERSION} · an Inspirapixel game</p>` };
  },
};

/* ---------- stock chart (drawn at half resolution for a pixel look) ---------- */
function drawStockChart() {
  const c = $('#stChart'); if (!c) return;
  const W = Math.max(120, Math.floor(c.clientWidth / 2)), H = 120;
  if (c.width !== W) { c.width = W; c.height = H; }
  const A = UI.investTab === 're' ? { p: S.house.i, h10: S.house.h10, h60: S.house.h60 } : S.assets[UI.stockSel], tf = UI.stockTF;
  let h = tf === '10m' ? A.h10.slice(-60) : tf === '1h' ? A.h10.slice(-360) : A.h60.slice(-240);
  h = h.concat([A.p]);
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
function renderTicker() {
  const n = S.news; if (!n.length) return;
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

/* ---------- start screen ---------- */
const START_INFO = {
  wood: { leads: 'Planks, Charcoal, Chairs, Paper, Books, Furniture, Pianos' },
  wheat: { leads: 'Flour, Bread, Pasta, Lunch Boxes, Canned Food, Gift Hampers' },
  ore: { leads: 'Iron, Nails, Steel, Tools, Motor Cars' },
};
function renderStart(existing) {
  const pick = UI.startPick;
  const cards = ['wood', 'wheat', 'ore'].map(p => `<button type="button" class="pick" data-act="pick" data-p="${p}" aria-pressed="${pick === p}">
    <img class="px prev" src="${buildingPreview(p)}" alt=""><span class="pk-txt"><b>${PRODUCTS[p].name}</b><span>${PRODUCTS[p].bld}</span><span>Leads to: ${START_INFO[p].leads}</span></span></button>`).join('');
  $('#start').innerHTML = `<div class="start-card">
    <div class="brand">INSPIRAPIXEL</div><h1 class="title">Brick &amp; <span class="shine">Coin</span></h1><div class="ver">${VERSION} · single-player test</div>
    ${existing ? `<section class="card" style="width:min(420px,100%);align-items:center"><b>${esc(existing.company)}</b><span class="muted" style="font-size:13px">Level ${existing.level} · ${money(existing.cash, false)} cash</span>
      <button class="btn gold wide" type="button" data-act="continue">Continue</button></section><div class="muted" style="font-size:13px">or start a new company (this replaces your save)</div>` : ''}
    <form class="start-form" id="startForm">
      <label>Company name<input id="coInput" maxlength="24" autocomplete="off" placeholder="e.g. Oakline Co." value=""></label>
      <div class="muted" style="font-size:14px">Pick your starting material. It decides your first direction. You can branch out later.</div>
      <div class="picks">${cards}</div>
      <div class="start-err" id="startErr"></div>
      <button class="btn ${existing ? 'ghost' : 'gold'}" type="submit" style="font-size:18px;padding:12px 28px">Open for business</button>
    </form></div>`;
  $('#startForm').addEventListener('submit', e => { e.preventDefault(); startNew(); });
}

