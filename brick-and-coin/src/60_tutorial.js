'use strict';
/* ============================================================================
   TUTORIAL — a few guided steps for a brand-new company: build, watch it sell,
   upgrade, then a look at Production. Shown in the coach card on the map, with
   an arrow on the lot to tap and a glow on the button to press. Skippable, and
   it can be replayed from the Menu. Progress is S.tut (TUT_DONE when finished).
   ========================================================================== */
let TUTLOT = -1;   // the lot the map arrow points at (-1: none)
function tutActive() { return !!S && S.tut < TUT.length; }
function firstBld() { for (let i = 0; i < S.lots.length; i++) { const l = S.lots[i]; if (l && l.b !== 'hq') return i; } return -1; }
function tutLot() {
  for (const i of [HQ_LOT + 1, HQ_LOT - 1, HQ_LOT + 3, HQ_LOT - 3]) if (!S.lots[i] && lotUnlocked(i)) return i;
  for (let i = 0; i < S.lots.length; i++) if (!S.lots[i] && lotUnlocked(i)) return i;
  return -1;
}
const selEmpty = () => !!UI.sel && UI.sel.i < 100 && !S.lots[UI.sel.i] && lotUnlocked(UI.sel.i);
const selBld = () => !!UI.sel && UI.sel.i < 100 && !!S.lots[UI.sel.i] && S.lots[UI.sel.i].b !== 'hq';
function bestBuildBtn() {
  const chip = document.querySelector('#side .bcard .chip.gold'), card = chip && chip.closest('.bcard');
  return (card && card.querySelector('[data-act=build]')) || document.querySelector('#side [data-act=build]');
}

const TUT = [
  { // 1: first building
    text: () => selEmpty() ? 'Pick a building and press <b>Build</b>. <b>Best pick</b> earns the most for its price and room.'
      : 'Welcome to Millbrook! Tap the <b>flashing lot</b> next to your HQ to build your first business.',
    lot: () => selEmpty() ? -1 : tutLot(),
    el: () => selEmpty() ? bestBuildBtn() : null,
    done: () => countBuildings() >= 1 },
  { // 2: it sells by itself
    text: () => { const i = firstBld(), P = i >= 0 && PRODUCTS[S.lots[i].b]; return P ? `Your ${P.bld} makes ${P.name} by itself and sells it for you. Watch your <b>cash</b> go up.` : 'Watch your <b>cash</b> go up as your goods sell.'; },
    el: () => '.tb-cash',
    done: () => S.stats.sales > 0 && S.t - (UI.tutT || 0) > 5 },
  { // 3: upgrade it
    text: () => {
      if (!selBld()) return 'Now tap your building to open it.';
      const l = S.lots[UI.sel.i], c = l.lv < MAX_BLD_LV ? upgradeCost(l) : 0;
      return S.cash >= c ? 'Press <b>Upgrade</b>. Each level makes it faster, and the building grows.' : `Upgrading costs ${money(c, false)}. Your sales will bring that in soon.`;
    },
    lot: () => selBld() ? -1 : firstBld(),
    el: () => selBld() ? '#side [data-act=upgrade]' : null,
    done: () => S.lots.some(l => l && l.b !== 'hq' && l.lv >= 2) },
  { // 4: production web
    text: () => 'Open <b>Production</b> to see every product. Unlocking new ones is how you grow, like turning your goods into better goods.',
    el: () => '#nav [data-act=prod]',
    done: () => UI.modal === 'prod' },
  { // 5: off you go
    text: () => 'That’s the basics. Follow the <b>goals</b> for cash rewards, and grow your company to open new parts of town.',
    btn: 'Got it', done: () => false },
];

function setCoachHi(target) {
  const want = typeof target === 'string' ? document.querySelector(target) : target || null;
  for (const e of document.querySelectorAll('.coach-hi')) if (e !== want) e.classList.remove('coach-hi');
  if (want && !want.classList.contains('coach-hi')) want.classList.add('coach-hi');
}
function updateCoach() {
  const el = $('#coach');
  if (!tutActive()) {
    if (!el.hidden) { el.hidden = true; renderGoalPill(); }
    setCoachHi(null); TUTLOT = -1; return;
  }
  let st = TUT[S.tut];
  while (st && st.done()) { S.tut++; UI.tutT = S.t; st = TUT[S.tut]; sfx('coach'); }
  if (!st) return updateCoach();
  const txt = st.text(), sig = S.tut + '|' + txt;
  if (el.dataset.sig !== sig) {
    el.dataset.sig = sig;
    el.innerHTML = `<p class="c-txt">${txt}</p><div class="c-row"><span class="c-step">Tutorial ${S.tut + 1} of ${TUT.length}</span>${st.btn
      ? `<button type="button" class="btn small gold" data-act="tutdone">${st.btn}</button>`
      : '<button type="button" class="c-skip" data-act="tutdone">Skip tutorial</button>'}</div>`;
  }
  if (el.hidden) { el.hidden = false; renderGoalPill(); }
  TUTLOT = st.lot ? st.lot() : -1;
  setCoachHi(st.el ? st.el() : null);
}
// the bouncing arrow over the lot to tap (drawn on the town canvas)
const COACH_ARROW = ['..KKKKK..', '..KYYYK..', '..KYYYK..', 'KKKYYYKKK', 'KYYYYYYYK', '.KYYYYYK.', '..KYYYK..', '...KYK...', '....K....'];
function drawCoachArrow(P, cx, bottom, t) {
  const y0 = bottom - COACH_ARROW.length + Math.round(Math.sin(t * 5) * 2);
  COACH_ARROW.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') P.p(cx - 4 + i, y0 + j, row[i] === 'K' ? K : '#ffd463'); });
}

