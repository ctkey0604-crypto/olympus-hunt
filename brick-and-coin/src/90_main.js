'use strict';
/* ============================================================================
   MAIN — game loop, the camera, drawing the town, taps/drags and keys.
   ========================================================================== */
const canvas = $('#map'), ctx = canvas.getContext('2d');
let HOVER = -1, lastFrame = 0, simAcc = 0, uiAcc = 0, saveAcc = 0, hiddenAt = 0, running = false;
let lastInput = Date.now() + CLOCK_OFF, idleFrom = null;   // the idle rule: see frame()
function noteInput() {
  lastInput = nowMs();
  if (idleFrom && running) {   // back after being idle: say what happened while the game ran at the away rate
    const min = Math.round((lastInput - idleFrom.at) / 60000), d = S.cash - idleFrom.cash;
    if (min >= 1) toast(`You were idle for ${min} min: the game ran at ${Math.round(OFFLINE_RATE * 100)}% speed (${d >= 0 ? '+' : ''}${money(d, false)})`, 'good', 5000);
  }
  idleFrom = null; AWAY_RATE = 1;
}
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, noteInput, { passive: true, capture: true });
const CAM = { x: TX, y: TY, s: 2, tx: null, ty: null, vw: MAP_W, vh: MAP_H, set: false };
const popAcc = {};
const isPhone = () => (innerWidth <= 900 && innerHeight > innerWidth) || (innerWidth > innerHeight && innerHeight <= 540);   // upright phone, or a phone on its side
const isFlat = () => innerWidth > innerHeight && innerHeight <= 540;

/* ---------- camera ---------- */
function clampCam() {
  CAM.x = CAM.vw >= WORLD_W ? (WORLD_W - CAM.vw) / 2 : clamp(CAM.x, 0, WORLD_W - CAM.vw);
  CAM.y = CAM.vh >= WORLD_H ? (WORLD_H - CAM.vh) / 2 : clamp(CAM.y, 0, WORLD_H - CAM.vh);
}
function centerOn(wx, wy, smooth) {
  if (smooth) { CAM.tx = wx - CAM.vw / 2; CAM.ty = wy - CAM.vh / 2; }
  else { CAM.x = wx - CAM.vw / 2; CAM.y = wy - CAM.vh / 2; CAM.tx = CAM.ty = null; clampCam(); }
}
function camHome() { if (isPhone()) centerOn(TX + 240, TY + 146); else centerOn(TX + MAP_W / 2, TY + 136); }
function resize() {
  const wrap = $('#mapwrap'), cw = Math.max(50, wrap.clientWidth), ch = Math.max(50, wrap.clientHeight);
  let s;
  if (isFlat()) s = clamp(ch / 175, 1.5, 2.6);                                  // phone on its side: big lots, most of the town's height in view
  else if (isPhone()) s = clamp(Math.min(cw / 220, ch / 190), 1.5, 2.6);           // big enough to tap a lot with a thumb
  else { const fit = Math.min(cw / (MAP_W + 6), ch / (MAP_H + 6)); s = fit >= 1 ? Math.max(1, Math.floor(fit + .12)) : fit; }   // whole pixels look sharpest; crop a sliver rather than shrink
  const keepX = CAM.x + CAM.vw / 2, keepY = CAM.y + CAM.vh / 2;
  CAM.s = Math.max(.5, s);
  CAM.vw = Math.ceil(cw / CAM.s); CAM.vh = Math.ceil(ch / CAM.s);
  canvas.width = CAM.vw; canvas.height = CAM.vh;
  canvas.style.width = CAM.vw * CAM.s + 'px'; canvas.style.height = CAM.vh * CAM.s + 'px';
  ctx.imageSmoothingEnabled = false;
  if (!CAM.set) { camHome(); CAM.set = true; } else centerOn(keepX, keepY);
  renderZoneLabels();
}
function stepCamera(dt) {
  if (CAM.tx == null) return;
  const k = Math.min(1, dt * 9);
  CAM.x += (CAM.tx - CAM.x) * k; CAM.y += (CAM.ty - CAM.y) * k;
  const tx = CAM.tx, ty = CAM.ty; clampCam();
  const cx = CAM.vw >= WORLD_W ? CAM.x : clamp(tx, 0, WORLD_W - CAM.vw), cy = CAM.vh >= WORLD_H ? CAM.y : clamp(ty, 0, WORLD_H - CAM.vh);
  if (Math.abs(CAM.x - cx) < .5 && Math.abs(CAM.y - cy) < .5) { CAM.x = cx; CAM.y = cy; CAM.tx = CAM.ty = null; }
}
function spotXY(i) { return i >= 100 ? PLOTS[i - 100] : lotXY(i); }
function hqTier() { return 1 + Math.round(S.hqLv * 4 / 7); }
function drawPlot(P, k, x, y, t) {
  const pr = S.props[k], type = PLOTS[k].t, locked = PROPS[type].lvl > S.level;
  ctx.drawImage(houseSprite(type, pr.own ? pr.reno : 1), x - 6, y - 14);
  if (pr.own) { P.r(x + PLOT - 6, y - 10, 1, 9, K); P.r(x + PLOT - 5, y - 10, 5, 4, K); P.r(x + PLOT - 5, y - 9, 4, 2, Math.sin(t * 4 + k) > 0 ? '#ebc152' : '#ffd463'); }
  else {
    const sx = x + 2, sy = y + PLOT - 12;
    P.r(sx + 4, sy + 5, 1, 7, K); P.r(sx, sy, 10, 6, K); P.r(sx + 1, sy + 1, 8, 4, locked ? '#85735d' : '#f0e4cc'); P.r(sx + 2, sy + 2, 6, 1, locked ? '#5a4c3d' : '#d9493b'); P.r(sx + 2, sy + 4, 4, 1, '#85735d');
  }
}
function offX() { return Math.round(TX - CAM.x); }
function offY() { return Math.round(TY - CAM.y); }

/* ---------- drawing ---------- */
function render(t) {
  if (BG_LEVEL !== S.level || !BG) { drawBackground(S.level); renderZoneLabels(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0706'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, offX(), offY());
  ctx.drawImage(BG, -TX, -TY);
  const P = Painter(ctx);
  const order = []; for (let i = 0; i < LOTS; i++) order.push(i); for (let k = 0; k < PLOTS.length; k++) order.push(100 + k);
  order.sort((a, b) => spotXY(a).y - spotXY(b).y);
  let walkersDrawn = false;
  for (const i of order) {
    const { x, y } = spotXY(i);
    if (!walkersDrawn && y > ROAD_H.y) { for (const w of WALKERS) drawWalker(P, w, t); walkersDrawn = true; }
    if (i >= 100) { drawPlot(P, i - 100, x, y, t); continue; }
    const l = S.lots[i];
    if (!l) {
      if (lotUnlocked(i)) {
        for (const [dx, dy] of [[1, 1], [37, 1], [1, 35], [37, 35]]) { P.r(x + dx, y + dy, 2, 4, K); P.p(x + dx, y + dy, '#8a5a34'); }
        if (HOVER === i || (UI.sel && UI.sel.i === i)) { ctx.fillStyle = 'rgba(235,193,82,.16)'; ctx.fillRect(x, y, LOT, LOT); P.r(x + 18, y + 13, 4, 14, '#ebc152'); P.r(x + 13, y + 18, 14, 4, '#ebc152'); }
      }
      continue;
    }
    const type = l.b, tier = type === 'hq' ? hqTier() : l.lv;
    ctx.drawImage(buildingSprite(type, tier), x - SPR_OX, y - SPR_OY);
    if (BUILD[type].anim) BUILD[type].anim(Painter(ctx, x, y), (l.running || type === 'hq' ? t : 0.35) + i * .37);
    if (tier >= 2) decorAnim(Painter(ctx, x, y), type, tier, t + i * .37);
    if (type !== 'hq') {
      for (let k = 0; k < l.lv; k++) { P.r(x + 1 + k * 4, y + LOT - 4, 4, 4, K); P.r(x + 2 + k * 4, y + LOT - 3, 2, 2, '#ebc152'); }
      if (l.stall) { const bx = x + LOT - 11, by = y - 8 + Math.round(Math.sin(t * 4)); P.r(bx, by, 9, 10, K); P.r(bx + 1, by + 1, 7, 8, '#f0e4cc'); P.r(bx + 4, by + 2, 1, 4, '#d9493b'); P.p(bx + 4, by + 7, '#d9493b'); }
      const sm = BUILD[type].smoke;
      if (sm && l.running) { l._sm = (l._sm || 0) - 1 / 60; if (l._sm <= 0) { l._sm = .45 / Math.sqrt(l.lv); for (const [sx, sy] of sm) emitSmoke(x + sx, y + sy, type === 'steel' || type === 'iron'); } }
    }
  }
  if (!walkersDrawn) for (const w of WALKERS) drawWalker(P, w, t);
  drawParticles(P);
  for (const p of POPS) { const { x, y } = lotXY(p.i); ctx.globalAlpha = Math.min(1, 2.2 - p.age * 2); ctx.drawImage(iconCanvas(p.icon), x + 11, y - 6 - p.age * 14); ctx.globalAlpha = 1; }
  const sel = UI.sel ? UI.sel.i : -1;
  for (const i of [sel, HOVER]) {
    if (i < 0) continue;
    const { x, y } = spotXY(i), sz = i >= 100 ? PLOT : LOT, c = i === sel ? '#ffd463' : 'rgba(255,212,99,.6)', o = i === sel ? Math.round(Math.sin(t * 6)) : 0;
    const x0 = x - 2 - o, y0 = y - 2 - o, x1 = x + sz + 1 + o, y1 = y + sz + 1 + o;
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { P.r(sx > 0 ? cx : cx - 4, cy, 5, 1, c); P.r(cx, sy > 0 ? cy : cy - 4, 1, 5, c); }
  }
  if (TUTLOT >= 0) {   // tutorial: a flashing lot and a bouncing arrow
    const { x, y } = lotXY(TUTLOT), l = S.lots[TUTLOT];
    if (!l) { ctx.fillStyle = `rgba(255,212,99,${.12 + .16 * (Math.sin(t * 6) + 1) / 2})`; ctx.fillRect(x, y, LOT, LOT); }
    drawCoachArrow(P, x + LOT / 2, l ? y - 22 : y - 3, t);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const ov = $('#overlay'), tr = `translate(${offX() * CAM.s}px,${offY() * CAM.s}px)`;
  if (ov.style.transform !== tr) ov.style.transform = tr;
  // which area is in the middle of the view (for the jump buttons)
  const mid = CAM.x + CAM.vw / 2 - TX, midY = CAM.y + CAM.vh / 2 - TY, b = midY > HILL.y + 20 ? 3 : mid < 165 ? 0 : mid < 318 ? 1 : 2;
  for (const btn of document.querySelectorAll('.dist button')) btn.classList.toggle('on', +btn.dataset.b === b);
  setMusicArea(ZONE_LEVEL[b] <= S.level ? b : 1);   // locked areas keep the Main Street tune
}
function renderZoneLabels() {
  if (!S) return;
  let html = '';
  for (let b = 0; b < ZONE_LEVEL.length; b++) {
    if (ZONE_LEVEL[b] <= S.level) continue;
    const L = ZONE_LEVEL[b];
    for (const [x, y] of zoneLabelSpots(b))
      html += `<div class="zlabel" style="left:${x * CAM.s}px;top:${y * CAM.s}px">${ZONE_NAME[b].toUpperCase()}<small>Opens at Level ${L} · ${money(LEVELS[L].nw, false)}</small></div>`;
  }
  $('#overlay').querySelectorAll('.zlabel').forEach(e => e.remove());
  $('#overlay').insertAdjacentHTML('beforeend', html);
}
function floatText(i, text) {
  const { x, y } = lotXY(i), el = document.createElement('div');
  el.className = 'pop'; el.textContent = text; el.style.left = (x + LOT / 2) * CAM.s + 'px'; el.style.top = (y - 4) * CAM.s + 'px';
  $('#overlay').appendChild(el); setTimeout(() => el.remove(), 1150);
}
function renderGoalPill() {
  const g = GOALS[S.goal], el = $('#goalPill');
  const html = `${iconImg('trophy', 27)}<span>${g ? `<b>Goal:</b> ${esc(g.text)}` : '<b>All goals done!</b>'}</span>`;
  if (el.dataset.g !== String(S.goal)) { el.innerHTML = html; el.dataset.g = S.goal; }
  el.hidden = (!!UI.sheet && isPhone()) || tutActive();   // the tutorial card takes its place
}

/* ---------- bottom sheet (phones) ---------- */
function setSheet(open) { UI.sheet = open; $('#side').classList.toggle('open', open); renderGoalPill(); }
function selectLot(i) {
  UI.sel = i >= 0 ? { i } : null; UI.confirm = '';
  renderSide(true);
  if (isPhone()) {
    setSheet(i >= 0);
    // keep the tapped lot visible above the sheet
    if (i >= 0 && isFlat()) { const { x, y } = spotXY(i), visW = CAM.vw - $('#side').offsetWidth / CAM.s, sx = TX + x + LOT / 2; if (sx - CAM.x > visW - 24) centerOn(sx + CAM.vw / 2 - visW / 2, CAM.y + CAM.vh / 2, true); }
    else if (i >= 0) { const { x, y } = spotXY(i), sheetH = $('#side').offsetHeight / CAM.s, visH = CAM.vh - Math.min(sheetH, CAM.vh * .7); const sy = TY + y + LOT / 2; if (sy - CAM.y > visH - 24) centerOn(TX + x + LOT / 2, sy + CAM.vh / 2 - visH / 2, true); }
  }
}

/* ---------- loop ---------- */
function frame(now) {
  if (!running) return;
  const dt = Math.min(.25, (now - (lastFrame || now)) / 1000); lastFrame = now;
  // keep the shared world on the world clock: nudge small slips, start over after a big one (a sleeping tab, a clock fix)
  const slip = worldNow() - WT;
  if (Math.abs(slip) > 3) { WT = worldNow(); worldReset(); prefillGoodsHist(); renderTicker(); } else if (Math.abs(slip) > .5) WT += slip;
  // idle: no input for IDLE_AFTER seconds. Then it runs like a closed game: a quarter speed, and after OFFLINE_MAX it waits.
  const idle = (nowMs() - lastInput) / 1000 - IDLE_AFTER;
  AWAY_RATE = idle <= 0 ? 1 : idle <= OFFLINE_MAX ? OFFLINE_RATE : 0;
  if (AWAY_RATE < 1 && !idleFrom) idleFrom = { at: lastInput + IDLE_AFTER * 1000, cash: S.cash };
  simAcc += dt; let n = 0;
  while (simAcc >= .2 && n < 10) { step(.2); simAcc -= .2; n++; }
  stepWalkers(dt); stepParticles(dt); stepCamera(dt);
  for (const i in popAcc) { popAcc[i].t -= dt; if (popAcc[i].t <= 0) { if (popAcc[i].v >= 1) { floatText(+i, '+' + money(popAcc[i].v, false)); sfx('cash'); } delete popAcc[i]; } }
  render(now / 1000);
  uiAcc += dt; if (uiAcc >= .25) { uiAcc = 0; updateTop(); renderSide(); renderModal(); updateCoach(); renderGoalPill(); netTick(); }
  saveAcc += dt; if (saveAcc >= 15) { saveAcc = 0; saveLocal(); }
  requestAnimationFrame(frame);
}
LOG.onPop = (i, p, rev) => {
  if (rev > 0) { const a = popAcc[i] || (popAcc[i] = { v: 0, t: 1.2 }); a.v += rev; }
  else if (POPS.filter(x => x.i === i).length < 1) POPS.push({ i, icon: p, age: 0 });
};
LOG.onNews = () => { if (running) renderTicker(); };
LOG.onToast = (text, kind) => toast(text, kind);
LOG.onGoal = () => sfx('goal');
LOG.onLevel = L => {
  toast(`Level ${L}! ${LEVELS[L].name} is open`, 'big', 4200); sfx('level'); drawBackground(L); renderZoneLabels(); UI.sideSig = ''; UI.modalSig = '';
  if (L === 4 && running) { const [x, y] = zoneCenter(3); centerOn(TX + x, TY + y, true); }   // Gold Hill is out of sight to the south: go and look
};

/* ---------- input: tap to select, drag to look around ---------- */
let drag = null;
function lotAt(ev) {
  const r = canvas.getBoundingClientRect(), x = (ev.clientX - r.left) / CAM.s - offX(), y = (ev.clientY - r.top) / CAM.s - offY();
  for (let i = 0; i < LOTS; i++) { const p = lotXY(i); if (x >= p.x - 2 && x < p.x + LOT + 2 && y >= p.y - 2 && y < p.y + LOT + 2) return i; }
  for (let k = 0; k < PLOTS.length; k++) { const p = PLOTS[k]; if (x >= p.x - 2 && x < p.x + PLOT + 2 && y >= p.y - 6 && y < p.y + PLOT + 2) return 100 + k; }
  return -1;
}
canvas.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  drag = { x: e.clientX, y: e.clientY, cx: CAM.x, cy: CAM.y, moved: false };
  CAM.tx = CAM.ty = null;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', e => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; canvas.classList.add('dragging'); }
    if (drag.moved) { CAM.x = drag.cx - dx / CAM.s; CAM.y = drag.cy - dy / CAM.s; clampCam(); }
  }
  if (e.pointerType === 'mouse') HOVER = drag && drag.moved ? -1 : lotAt(e);
});
canvas.addEventListener('pointerup', e => { if (drag && !drag.moved) { const i = lotAt(e); if (i >= 0) sfx('select'); selectLot(i); } drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('pointerleave', () => { HOVER = -1; });
canvas.addEventListener('wheel', e => { e.preventDefault(); CAM.tx = CAM.ty = null; CAM.x += e.deltaX / CAM.s; CAM.y += e.deltaY / CAM.s; clampCam(); }, { passive: false });

function toggleFullscreen() {
  const d = document, el = d.documentElement;
  const isFull = d.fullscreenElement || d.webkitFullscreenElement;
  const fail = () => toast('Full screen is blocked here. Open the game in its own browser tab, or on iPhone use Share → Add to Home Screen.', 'bad', 5000);
  try {
    if (isFull) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return fail();
    const p = req.call(el, { navigationUI: 'hide' });
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) {} };
    if (p && p.then) p.then(lock, fail); else lock();
  } catch (e) { fail(); }
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => setTimeout(resize, 60)));

// actions with their own sound (played once they succeed); every other button just clicks
const ACT_SND = { build: 'build', upgrade: 'upgrade', hqup: 'upgrade', whup: 'upgrade', preno: 'upgrade', unlock: 'unlock',
  stbuy: 'buy', pbuy: 'buy', buy: 'buy', sell: 'sell', stsell: 'sell', psell: 'sell', demolish: 'demolish' };
function act(el) {
  const a = el.dataset.act, p = el.dataset.p, snd = ACT_SND[a]; let err = '';
  if (!snd) sfx('tap');
  if (a !== 'demolish' && a !== 'reset' && a !== 'psell' && a !== 'ipo' && a !== 'pubfloat') UI.confirm = '';
  switch (a) {
    case 'sound': toggleAllSound(); renderSoundBtn(); sfx('tap'); saveSound(); saveLocal(); UI.modalSig = ''; return;
    case 'aset': AUD.set[el.dataset.k] = el.dataset.v === '1'; audioLevels(); if (running) renderSoundBtn(); saveSound(); saveLocal(); break;
    case 'tpage': UI.confirm = ''; renderTitle(el.dataset.v); { const f = $('#tbox .tpanel input, #tbox .tbtn'); if (f && !matchMedia('(pointer: coarse)').matches) f.focus({ preventScroll: true }); } return;
    case 'helppg': UI.helpPg += +el.dataset.v; if (!running) { renderTitle(); return; } break;
    case 'mtab': UI.mtab = el.dataset.v; break;
    case 'mainmenu': saveLocal(); netSaveNow(); closeModal(); selectLot(-1); running = false; showTitle(); return;
    case 'acctpage': saveLocal(); netSaveNow(); closeModal(); selectLot(-1); running = false; showTitle('account'); return;   // v0.07: log in from the game's Menu
    case 'register': doLogin(true); return;
    case 'logout': netSaveNow(); netLogout().then(() => { if (running) { UI.modalSig = ''; renderModal(); toast('Logged out. Your company stays saved in this browser.', 'good'); } else showTitle('home'); }); return;
    case 'netsave': netSaveNow(); toast('Saved online', 'good'); return;
    case 'lbtab': UI.lbTab = el.dataset.v; break;
    case 'pubsel': UI.pubSel = el.dataset.t; if (isPhone()) $('#modal .sheet').scrollTop = 0; break;   // v0.08: going public, players' shares
    case 'ipof': UI.ipoF = +el.dataset.v; UI.confirm = ''; break;
    case 'ipo': if (UI.confirm !== 'ipo') { UI.confirm = 'ipo'; break; } UI.confirm = ''; pubAct(pubGoPublic(UI.ipoF), 'ipo'); return;
    case 'pubfloat': { const k = 'float' + el.dataset.v; if (UI.confirm !== k) { UI.confirm = k; break; } UI.confirm = ''; pubAct(pubFloat(+el.dataset.v), 'float'); return; }
    case 'pubbuy': pubAct(pubTrade(UI.pubSel, 'buy', +el.dataset.v), 'buy'); return;
    case 'pubsell': pubAct(pubTrade(UI.pubSel, 'sell', +el.dataset.v), 'sell'); return;
    case 'usesave': { const o = el.dataset.v === 'cloud' ? NET.cloud : loadLocal(); if (o) { adopt(JSON.parse(JSON.stringify(o))); begin(true); } return; }   // saved (here and online) once time away is paid
    case 'tutdone': S.tut = TUT_DONE; updateCoach(); saveLocal(); return;
    case 'tutreplay': S.tut = 0; UI.tutT = S.t; closeModal(); selectLot(-1); updateCoach(); return;
    case 'resetno': break;
    case 'close': closeModal(); return;
    case 'menu': openModal('menu'); return;
    case 'full': toggleFullscreen(); return;
    case 'prod': UI.webSel = UI.webSel || S.start; openModal('prod'); return;
    case 'market': openModal('market'); return;
    case 'stocks': openInvest(); return;
    case 'board': openModal('board'); return;
    case 'hq': closeModal(); selectLot(HQ_LOT); return;
    case 'tbfact': {   // v0.09: the top bar's Factories: a factory that's waiting for materials if any, else the HQ
      closeModal(); const k = S.lots.findIndex(l => l && l.b !== 'hq' && l.stall && l.stall !== 'storage full');
      if (k >= 0) { const { x, y } = lotXY(k); centerOn(TX + x + LOT / 2, TY + y + LOT / 2, true); selectLot(k); } else selectLot(HQ_LOT);
      return;
    }
    case 'sellspare': { const r = sellAllSpare(); if (r.n) toast(`Sold ${qty(r.n)} goods for ${money(r.got, false)}`, 'good'); else toast('Nothing spare to sell: your factories need what’s in storage', ''); break; }
    case 'pfgo': UI.investTab = el.dataset.v; if (el.dataset.v === 'stocks') UI.stockSel = el.dataset.t; else UI.pubSel = el.dataset.t; break;
    case 'goals': UI.sel = null; renderSide(true); setSheet(true); return;
    case 'sheetclose': UI.sel = null; setSheet(false); renderSide(true); return;
    case 'jump': { const [x, y] = zoneCenter(+el.dataset.b); centerOn(TX + x, TY + y, true); return; }
    case 'deselect': UI.sel = null; if (isPhone()) setSheet(false); break;
    case 'build': err = build(UI.sel.i, p); if (!err) { toast(`${PRODUCTS[p].bld} built`, 'good'); } break;
    case 'upgrade': err = upgrade(UI.sel.i); break;
    case 'demolish': if (UI.confirm === 'demo' + UI.sel.i) { err = demolish(UI.sel.i); UI.confirm = ''; } else UI.confirm = 'demo' + UI.sel.i; break;
    case 'flow': S.flow[p] = el.dataset.v; break;
    case 'fixbuy': { const l = S.lots[+el.dataset.i]; if (l) l.autoBuy = true; break; }
    case 'unlock': err = unlock(p); if (!err) toast(`${PRODUCTS[p].name} unlocked`, 'good'); break;
    case 'webnode': UI.webSel = p; break;
    case 'sell': err = manualSell(p, el.dataset.q === 'all' ? Infinity : +el.dataset.q); break;
    case 'buy': err = manualBuy(p, +el.dataset.q); break;
    case 'mktf': UI.mktFilter = el.dataset.v; break;
    case 'stsel': UI.stockSel = el.dataset.t; if (isPhone()) $('#modal .sheet').scrollTop = 0; break;
    case 'sttf': UI.stockTF = el.dataset.v; break;
    case 'pubtf': UI.pubTF = el.dataset.v; break;   // v0.12: a player company's chart range
    case 'stbuy': err = buyAsset(UI.stockSel, el.dataset.v === 'half' ? S.cash / 2 : +el.dataset.v); break;
    case 'stsell': err = sellAsset(UI.stockSel, +el.dataset.v); break;
    case 'pbuy': err = buyProp(+el.dataset.k); if (!err) toast('Property bought. Rent starts now.', 'good'); break;
    case 'psell': { const k = +el.dataset.k; if (UI.confirm === 'psell' + k) { err = sellProp(k); UI.confirm = ''; if (!err) toast('Property sold', 'good'); } else UI.confirm = 'psell' + k; break; }
    case 'preno': err = renovate(+el.dataset.k); if (!err) toast('Renovated: higher rent and value', 'good'); break;
    case 'pshow': { const k = +el.dataset.k; closeModal(); centerOn(TX + PLOTS[k].x + PLOT / 2, TY + PLOTS[k].y + PLOT / 2, true); setTimeout(() => selectLot(100 + k), 350); return; }
    case 'itab': UI.investTab = el.dataset.v; break;
    case 'hqup': err = upgradeHQ(); if (!err) toast(`HQ upgraded: ${capMax()} factory slots`, 'good'); break;
    case 'whup': err = upgradeWH(); if (!err) toast(`Warehouse holds ${whMax()} now`, 'good'); break;
    case 'savenow': { const ok = saveLocal(); toast(ok ? 'Saved' : 'This browser blocked saving. Use Copy save code.', ok ? 'good' : 'bad'); return; }
    case 'copysave': {
      const code = encodeSave();
      const box = $('#loadBox'); if (box) { box.value = code; box.select(); }
      try { navigator.clipboard.writeText(code).then(() => toast('Save code copied', 'good'), () => toast('Copy blocked: the code is in the box, copy it by hand', 'bad')); }
      catch (e) { toast('Copy blocked: the code is in the box, copy it by hand', 'bad'); }
      return;
    }
    case 'loadsave': {
      try { const o = decodeSave($('#loadBox').value); adopt(o); saveLocal(); closeModal(); UI.sel = null; afterLoad(); toast('Save loaded', 'good'); }
      catch (e) { toast('That save code didn’t work', 'bad'); }
      return;
    }
    case 'reset': if (UI.confirm === 'reset') { UI.confirm = ''; try { localStorage.removeItem(SAVE_KEY); } catch (e) {} netClearSave(); running = false; closeModal(); S = null; showTitle('new'); return; } UI.confirm = 'reset'; break;
    case 'pick': UI.startPick = p; for (const b of document.querySelectorAll('.pick')) b.setAttribute('aria-pressed', b.dataset.p === p); return;
    case 'continue': { const o = TITLE_SAVE; if (o && o !== 'both') { adopt(JSON.parse(JSON.stringify(o))); begin(true); } return; }   // no save before begin(): saving stamps the time, and time away is worked out from it
  }
  if (err) { toast(err, 'bad'); sfx('error'); }
  else if (snd) sfx(UI.confirm ? 'tap' : snd);   // first tap of a two-tap action only clicks
  if (!running) { if (!$('#start').hidden) renderTitle(); return; }   // on the starting menu: no company to redraw
  UI.sideSig = ''; UI.modalSig = '';
  renderSide(); renderModal(); updateTop();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'INPUT') return; if (el.disabled) return;
  if (el.classList.contains('off')) {   // can't afford it (or not allowed): say so
    sfx('error');
    toast(el.dataset.block ? `Product limit ${MAX_ACTIVE_PRODUCTS}/${MAX_ACTIVE_PRODUCTS}: tear down another product first` : `Not enough cash: this costs ${money(+el.dataset.cost, false)}`, 'bad');
    return;
  }
  act(el);
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset) return;
  if (el.dataset.act === 'autobuy') { const l = S.lots[+el.dataset.i]; if (l) l.autoBuy = el.checked; UI.sideSig = ''; sfx('tap'); }
  if (el.dataset.set) { if (el.dataset.set === 'sfx') sfx('tap'); saveSound(); saveLocal(); }
});
document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.set) { AUD.set[el.dataset.set] = clamp(+el.value / 10, 0, 1); audioLevels(); } });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => {
  if (!running) { if (e.key === 'Escape' && !$('#start').hidden && UI.tpage !== 'home') renderTitle('home'); return; }   // starting menu: Esc goes back
  if (e.target.closest('input,textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (UI.modal) closeModal(); else if (UI.sel || UI.sheet) selectLot(-1); else { sfx('tap'); openModal('menu'); } return; }   // nothing open: Esc opens the menu
  const map = { p: 'prod', m: 'market', s: 'stocks', l: 'board' };
  if (map[k]) { sfx('tap'); if (UI.modal === map[k]) closeModal(); else { if (k === 'p') UI.webSel = UI.webSel || S.start; if (k === 's') openInvest(); else openModal(map[k]); } }
  if (k === 'h') { sfx('tap'); closeModal(); selectLot(HQ_LOT); }
  if (k === 'f') toggleFullscreen();
  const pan = { arrowleft: [-40, 0], arrowright: [40, 0], arrowup: [0, -40], arrowdown: [0, 40] }[k];
  if (pan && !UI.modal) { e.preventDefault(); CAM.tx = CAM.ty = null; CAM.x += pan[0]; CAM.y += pan[1]; clampCam(); }
});
let wasMode = isFlat() ? 'flat' : isPhone() ? 'phone' : 'desk';
addEventListener('resize', () => { if (!running) return; const md = isFlat() ? 'flat' : isPhone() ? 'phone' : 'desk'; if (md !== wasMode) { wasMode = md; setSheet(false); CAM.set = false; UI.sideSig = ''; renderSide(true); renderNav(); } resize(); });
document.addEventListener('visibilitychange', () => {
  if (!running) return;
  if (document.hidden) { hiddenAt = nowMs(); saveLocal(); netSaveNow(true); }
  else if (hiddenAt) { const r = offlineCatchUp((nowMs() - hiddenAt) / 1000); hiddenAt = 0; lastFrame = 0; if (r) toast(`While you were away (${Math.round(r.sec / 60)} min): ${r.earned >= 0 ? '+' : ''}${money(r.earned, false)}`, 'good', 5000); }
});
addEventListener('pagehide', () => { if (running) { saveLocal(); netSaveNow(true); } });

/* ---------- start: the starting menu, then the game ---------- */
let titleTimer = 0;
// what Continue opens: this browser's company, or (logged in) the server's copy, or a choice between them (v0.07)
function refreshTitleSave() { const o = loadLocal(); TITLE_SAVE = pickSave(o && o.company ? o : null, NET.token && NET.cloud && NET.cloud.company ? NET.cloud : null); }
function showTitle(page) {
  refreshTitleSave();
  $('#app').hidden = true; $('#start').hidden = false;
  if (!WS.ready || Math.abs(worldNow() - WT) > 3) { WT = worldNow(); worldReset(); }
  renderTitle(page || 'home');
  clearInterval(titleTimer);
  titleTimer = setInterval(() => { if (running) return; WT = worldNow(); worldTick(); renderTitleMarket(); }, 1000);   // the live market keeps ticking
  AUD.want = AUD.cand = 1;   // the Main Street tune
}
function startNew() {
  const name = ($('#coInput').value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) { $('#startErr').textContent = 'Give your company a name (2–24 letters).'; $('#coInput').focus(); return; }
  const ex = TITLE_SAVE === 'both' ? NET.cloud : TITLE_SAVE;
  if (ex && UI.confirm !== 'tnew') { UI.confirm = 'tnew'; sfx('tap'); $('#tgo').textContent = `Tap again to replace ${ex.company}`; $('#tgo').classList.replace('gold', 'danger'); return; }
  UI.confirm = '';
  newGame(name, UI.startPick); S.settings = AUD.set; saveLocal(); netSaveNow(); sfx('goal'); begin(false);
}
// v0.07: log in or create an account from the starting menu's Play Online page
async function doLogin(create) {
  const name = ($('#acName') ? $('#acName').value : '').trim(), pw = $('#acPw') ? $('#acPw').value : '', err = $('#acErr'), btns = [$('#acGo'), $('#acNew')];
  if (!err) return;
  if (!name || !pw) { err.textContent = 'Enter a name and a password.'; sfx('error'); return; }
  err.textContent = create ? 'Creating your account…' : 'Logging in…'; btns.forEach(b => { if (b) b.disabled = true; });
  try {
    await netLogin(name, pw, create);
    try { await netFetchSave(); } catch (e) {}
    sfx('goal'); refreshTitleSave(); renderTitle(TITLE_SAVE === 'both' ? 'pick' : 'home');
  } catch (e) { err.textContent = e.message; btns.forEach(b => { if (b) b.disabled = false; }); sfx('error'); }
}
// v0.09: Invest opens on your Portfolio once you own something, and on Stocks until then
function openInvest() {
  const owns = Object.values(S.hold).some(h => h.q > 0) || Object.keys(S.pubHold || {}).length > 0 || S.props.some(p => p.own);
  if (UI.investTab === 'portfolio' && !owns) UI.investTab = 'stocks';
  openModal('stocks');
}
function afterLoad() { UI.sideSig = ''; UI.modalSig = ''; drawBackground(S.level); renderTicker(); renderZoneLabels(); updateTop(); renderSide(true); renderGoalPill(); }
function begin(loaded) {
  S.settings = AUD.set;   // sound settings belong to the device (SOUND_KEY); the save keeps a copy for older versions
  clearInterval(titleTimer);
  $('#start').hidden = true; $('#app').hidden = false;
  UI.sel = null; UI.sheet = false; UI.tutT = S.t; CAM.set = false; renderNav(); resize(); afterLoad(); setSheet(false); updateCoach();
  musicStart();
  WT = worldNow(); worldReset(); prefillGoodsHist(); renderTicker();
  lastInput = nowMs(); idleFrom = null;
  if (loaded) {   // time away is measured on the server's clock once it has answered (so moving a device's clock doesn't pay)
    const savedAt = S.savedAt || nowMs();
    Promise.race([clockReady, new Promise(r => setTimeout(r, 2500))]).then(() => {
      const r = offlineCatchUp((nowMs() - savedAt) / 1000);
      if (r) toast(`While you were away (${Math.round(r.sec / 60)} min): ${r.earned >= 0 ? '+' : ''}${money(r.earned, false)}`, 'good', 5000);
    });
  }
  NET.lastSync = 0; NET.lastSave = 0;   // tell the server (or ask it) straight away
  if (!running) { running = true; lastFrame = 0; requestAnimationFrame(frame); }
}
function boot() {
  netLoad();   // v0.07: logged in on this device? Then ask the server for the company saved there.
  if (NET.token) netFetchSave().then(() => { refreshTitleSave(); if (!running && UI.tpage === 'home' && !$('#start').hidden) renderTitle('home'); }, () => {});
  const existing = loadLocal();
  applyAudioSettings(loadSound() || (existing && existing.settings));   // this device's sound settings (an older save's, the first time)
  showTitle();
  SPLASH.done.then(() => { if (!running) musicStart(); });   // the menu music once the splash has gone (that press lets the browser play sound)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (running) resize(); });
  addEventListener('resize', () => { if (!running && !$('#start').hidden) paintTitleTown(); });
}
// test hook for automated playtests
window.__game = { get S() { return S; }, CAM, step, build, upgrade, unlock, upgradeHQ, upgradeWH, netWorth, price, buyAsset, sellAsset, playerRank, capUsed, capMax, efficiency, profitPerMin, AUD, sfx, TUT,
  NET, netTake, crowdMult, crowdOthersMult, simBoard, simsAlive, sellGoods, companyValue, pubPrice, pubListing, ownFrac };
boot();

