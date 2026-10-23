/* ============================== RENDER =================================== */
let vignette = null;
function makeVignette() {
  const c = mkCanvas(VIEW_W, VIEW_H), x = c.getContext('2d');
  const g = x.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * .35, VIEW_W / 2, VIEW_H / 2, VIEW_W * .62);
  g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(1, 'rgba(10,6,4,.55)');
  x.fillStyle = g; x.fillRect(0, 0, VIEW_W, VIEW_H); return c;
}
function camOffset() {
  const sh = Settings.data.shake ? G.shake : 0;
  return [Math.round(G.cam.x + (sh ? rand(-sh, sh) * .6 : 0)), Math.round(G.cam.y + (sh ? rand(-sh, sh) * .6 : 0))];
}
const blink = (hz = 16) => Math.floor(G.time * hz) % 2 === 0;
function drawParticlesAndText(S) {
  for (const pt of sc.parts) { const [sx, sy] = S(pt.x, pt.y); ctx.globalAlpha = clamp(pt.life / pt.max * 1.4, 0, 1); ctx.fillStyle = pt.c; ctx.fillRect(sx, sy, pt.s, pt.s); }
  ctx.globalAlpha = 1;
  for (const t of sc.texts) { const [sx, sy] = S(t.x, t.y); if (t.life > .1 || Math.floor(G.time * 30) % 2) drawNum(t.s, sx, sy, t.c); }
}
function arrowHead(x, y, a, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) for (let j = -i; j <= i; j++) ctx.fillRect(Math.round(x + Math.cos(a) * (3 - i) - Math.sin(a) * j * .7), Math.round(y + Math.sin(a) * (3 - i) + Math.cos(a) * j * .7), 1, 1);
}
function drawTelegraphs(S) {
  for (const e of q.enemies) {
    const [sx, sy] = S(e.x, e.y);
    if (e.state === 'spawn') { const k = 1 - e.st / .9; pxEllipse(sx, sy, 2 + k * 7, 1 + k * 3, 'rgba(20,10,8,.6)'); pxRing(sx, sy, 3 + k * 8, '#cf6a2f', 2); continue; }
    if (e.boss) { drawBossTelegraph(e, S, sx, sy); if (e.def.titan) drawTitanTelegraph(e, S, sx, sy); continue; }
    const role = e.def.role, w = e.state === 'windup';
    const lineTo = (len, hot) => { if (blink(12)) pxLine(sx, sy, sx + Math.cos(e.aim) * len, sy + Math.sin(e.aim) * len, hot ? '#ff5a3c' : '#cf6a2f', 2); };
    if (role === 'charger' && w) lineTo(70, e.st < .3);
    if (role === 'flyer' && w) lineTo(90, e.st < .3);
    if (role === 'leaper' && w) { lineTo((e.def.pounce || 240) * .3, e.st < .3); const ex = sx + Math.cos(e.aim) * (e.def.pounce || 240) * .3, ey = sy + Math.sin(e.aim) * (e.def.pounce || 240) * .3; pxRing(ex, ey, 4, e.st < .3 ? '#ff5a3c' : '#cf6a2f'); }
    if (role === 'tank' && e.def.attack === 'slam' && w) { const R = 34 * Math.max(1, e.scale * .75), k = 1 - e.st / .95; pxEllipse(sx, sy, Math.round(R * k), Math.round(R * k * .55), 'rgba(217,73,59,.28)'); pxRingFlat(sx, sy, R, blink(14) ? '#ff5a3c' : '#ebc152', 2); }
    if (role === 'tank' && e.def.attack === 'thrust' && w && blink(12)) pxLine(sx, sy - 4, sx + Math.cos(e.face) * 30, sy - 4 + Math.sin(e.face) * 30, '#ff5a3c', 2);
    if (role === 'tank' && e.def.attack === 'volley' && w) pxRing(sx, sy - 10, 8 + (1 - e.st) * 10, blink(14) ? '#5b9bd5' : '#ffffff', 2);
    if (role === 'exploder' && e.state === 'fuse') { const k = 1 - e.st / .7; pxEllipse(sx, sy, Math.round(28 * k), Math.round(28 * k * .55), 'rgba(217,73,59,.25)'); pxRingFlat(sx, sy, 28, blink(18) ? '#ff5a3c' : '#ebc152', 2); }
    if (role === 'teleporter' && e.state === 'gone') { const [tx, ty] = S(e.tx, e.ty), k = 1 - e.st / .5; pxRingFlat(tx, ty, 3 + k * 7, '#c8b8ff', 1.5); pxEllipse(tx, ty, Math.round(2 + k * 5), Math.round(1 + k * 2), 'rgba(58,47,74,.5)'); }
  }
  for (const s of q.pspikes) { if (s.t >= 0) continue; const [sx, sy] = S(s.x, s.y); pxRingFlat(sx, sy, s.r || 8, s.fire ? '#ff8a2b' : '#c9b48e', 2); }
}
function drawBossTelegraph(b, S, sx, sy) {
  const st = b.state;
  if ((st === 'dashAim' || st === 'lungeAim' || st === 'boltAim') && b.dashEnd) {
    const [ex, ey] = S(b.dashEnd.x, b.dashEnd.y), col = b.st < b.lockAt ? '#ff5a3c' : (blink(16) ? '#ebc152' : '#cf6a2f');
    pxLine(sx, sy, ex, ey, col); pxLine(sx, sy + 1, ex, ey + 1, col); pxRing(ex, ey, 5, col);
  }
  if (st === 'aegisWind') pxRing(sx, sy, 6 + (1 - b.st / .8) * 14, blink(16) ? '#ebc152' : '#ff5a3c');
  if (st === 'leapAim' || st === 'leap') {
    const P = b.cur.p1, [tx, ty] = S(b.tx, b.ty), k = st === 'leap' ? 1 : clamp(1 - b.st / .65, 0, 1);
    pxEllipse(tx, ty, Math.round(P.r * k), Math.round(P.r * k * .55), 'rgba(217,73,59,.28)'); pxRingFlat(tx, ty, P.r, blink(14) ? '#ff5a3c' : '#ebc152', 2);
  }
  if (st === 'charmAim') { const P = b.cur.p1, col = b.st < .3 ? '#ff5a3c' : (blink(14) ? '#f2a7c0' : '#c76d8e'); pxLine(sx, sy - 10, sx + Math.cos(b.aim) * P.range, sy - 10 + Math.sin(b.aim) * P.range, col, b.st < .3 ? 0 : 3); }
  if (st === 'beamAim' && b.beam) {
    const P = b.cur.p1, len = P.len, a = b.beam.a0, bx = sx, by = sy - 8;
    pxLine(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, blink(14) ? '#ffffff' : (b.cur.p1.col || '#ffd463'), 3);
    const a2 = a + b.beam.dir * .35; arrowHead(bx + Math.cos(a2) * 40, by + Math.sin(a2) * 40, a2 + b.beam.dir * Math.PI / 2, '#ff5a3c');
  }
  if (st === 'quake' || st === 'wave' || st === 'confuse') pxRingFlat(sx, sy, 6 + (st === 'quake' ? (1 - b.st / .6) : (1 - b.st / .7)) * 18, blink(16) ? '#ff5a3c' : '#ebc152', 2);
  if (st === 'vanished') { pxEllipse(sx, sy + 1, 7, 3, 'rgba(20,10,30,.55)'); if (blink(6)) pxRingFlat(sx, sy, 8, '#7fe08a', 3); }
}
function drawHazards(S) {
  // puddles first, they sit on the floor
  for (const h of q.hazards) if (h.type === 'puddle') {
    const [sx, sy] = S(h.x, h.y), P = PUDDLE[h.kind], fade = clamp(h.life / .6, 0, 1), grow = clamp(h.t / .25, 0, 1);
    ctx.globalAlpha = .75 * fade; pxEllipse(sx, sy, Math.round(h.r * grow), Math.round(h.r * .6 * grow), P.col);
    ctx.globalAlpha = .9 * fade; const R = mulberry((h.x * 3 + h.y) | 0 + Math.floor(G.time * 4));
    for (let i = 0; i < 5; i++) { ctx.fillStyle = P.hi; ctx.fillRect(Math.round(sx - h.r * .7 + R() * h.r * 1.4), Math.round(sy - h.r * .4 + R() * h.r * .8), 2, 1); }
    ctx.globalAlpha = 1;
  }
  for (const h of q.hazards) {
    const [sx, sy] = S(h.x, h.y);
    if (h.type === 'circle' && !h.fired) {
      const k = clamp(h.t / h.delay, 0, 1), col = { bolt: '#57c2b0', lob: '#c8b8ff', geyser: '#5aa3c0', curse: '#3f9a8a', soulfire: '#7fe08a', witchfire: '#57c2b0', apple: '#e9c04f', shadow: '#7fe08a', sunfire: '#ffd463',
        sky: '#9fb8ff', axis: '#e6f2ff', memory: '#c8b8ff', judgment: '#ffd463', stone: '#c9a46b' }[h.kind] || '#ff5a3c';
      if (h.kind === 'star') { const tw = blink(10) ? 3 : 2; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - tw, sy - 6, tw * 2 + 1, 1); ctx.fillRect(sx, sy - 6 - tw, 1, tw * 2 + 1); pxRingFlat(sx, sy, 5, '#9fd0ff', 2); continue; }
      const fill = h.kind === 'lob' ? 'rgba(154,107,192,.25)' : h.kind === 'bolt' || h.kind === 'axis' ? 'rgba(87,194,176,.3)' : h.kind === 'sky' ? 'rgba(80,100,200,.3)' : h.kind === 'judgment' ? 'rgba(233,192,79,.3)' : 'rgba(217,73,59,.3)';
      pxEllipse(sx, sy, Math.round(h.r * k), Math.round(h.r * k * .6), fill);
      pxRingFlat(sx, sy, h.r, k > .75 && blink(20) ? '#ffffff' : col, 2);
      if ((h.kind === 'spear' || h.kind === 'arrow' || h.kind === 'sunfire') && k > .6) { const top = sy - 46 * (1 - (k - .6) / .4); pxLine(sx, top - 15, sx, top, h.kind === 'sunfire' ? '#ffd463' : '#8a5a34'); pxLine(sx, top, sx, top + 3, '#c7ccd1'); }
      if (h.kind === 'apple' && k > .5) { const top = sy - 50 * (1 - (k - .5) / .5); pxEllipse(sx, top, 2, 2, '#e9c04f'); }
      if ((h.kind === 'sky' || h.kind === 'stone') && k > .45) { const top = sy - 70 * (1 - (k - .45) / .55), r2 = h.kind === 'sky' ? Math.min(5, h.r / 3) : 3; pxEllipse(sx, top, r2 + 1, r2 + 1, OUTLINE); pxEllipse(sx, top, r2, r2, h.kind === 'sky' ? '#9fb8ff' : '#8f846c'); if (h.kind === 'sky') { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1, Math.round(top) - 1, 2, 2); pxLine(sx, top - r2 - 1, sx, top - r2 - 8, '#3c4a78', 2); } }
      if (h.kind === 'judgment' && k > .55) { const top = sy - 50 * (1 - (k - .55) / .45); pxLine(sx, top - 14, sx, top, '#f3e9d4'); pxLine(sx - 2, top - 11, sx + 2, top - 11, '#e9c04f'); }
      if (h.kind === 'lob' && h.from) { const [fx, fy] = S(h.from.x, h.from.y), x = lerp(fx, sx, k), y = lerp(fy, sy, k) - Math.sin(k * Math.PI) * 30; pxEllipse(x, y - 4, 2, 3, '#140d0b'); pxEllipse(x, y - 4, 1, 2, PUDDLE[h.puddle].hi); }
    } else if (h.type === 'ring') { pxRingFlat(sx, sy, h.r, h.col || '#ebc152'); pxRingFlat(sx, sy, h.r - 1, '#fff6d8', 2); }
    else if (h.type === 'whirl') {
      if (h.t < h.delay) { const k = h.t / h.delay; pxRingFlat(sx, sy, h.r * k, blink(14) ? '#ffffff' : '#57c2b0', 2); continue; }
      const fade = clamp(h.life / .5, 0, 1); ctx.globalAlpha = .7 * fade;
      pxEllipse(sx, sy, h.r, Math.round(h.r * .6), 'rgba(28,68,80,.5)');
      for (let arm = 0; arm < 3; arm++) for (let r = 4; r < h.r; r += 2) { const a = arm * 2.09 - G.time * 3 + r * .08; ctx.fillStyle = r < 14 ? '#ffffff' : '#7fd0c8'; ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * .6), 1, 1); }
      ctx.globalAlpha = 1;
    }
    else if (h.type === 'lane' && !h.fired) {
      const [ax, ay] = S(h.x0, h.y0), [bx, by] = S(h.x1, h.y1), k = h.t / h.delay, hot = k > .7;
      const col = h.kind === 'bolt' ? (hot && blink(20) ? '#ffffff' : h.col || '#57c2b0') : h.kind === 'wave' ? (hot && blink(20) ? '#ffffff' : '#57c2b0') : (hot && blink(20) ? '#ff5a3c' : '#cf6a2f');
      pxLine(ax, ay, bx, by, col, hot ? 0 : 4);
      if (h.kind === 'goat' || h.kind === 'wave') { const a = Math.atan2(by - ay, bx - ax); arrowHead(clamp(ax + Math.cos(a) * 14, 4, VIEW_W - 4), clamp(ay, 4, VIEW_H - 4), a, '#ff5a3c'); }
    }
  }
}
function renderQuest() {
  if (!q) return;
  const [cx, cy] = camOffset();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(q.ground, -cx, -cy);
  const S = (x, y) => [Math.round(x - cx), Math.round(y - cy)];
  drawHazards(S);
  drawTitanWorld(S);
  drawTelegraphs(S);
  for (const f of q.fx) if (f.t === 'ring') { const [sx, sy] = S(f.x, f.y), k = 1 - f.life / f.max; pxRing(sx, sy, lerp(f.r0, f.r1, k), f.c); pxRing(sx, sy, lerp(f.r0, f.r1, k) - 1, f.c, 2); }
  // shadows
  const shadow = (x, y, rx) => { const [sx, sy] = S(x, y); pxEllipse(sx, sy + 1, rx, Math.max(1, Math.round(rx / 2.6)), 'rgba(0,0,0,.32)'); };
  for (const e of q.enemies) if (e.state !== 'spawn' && !e.hidden && (!e.boss || e.alpha > .3 || e.air)) shadow(e.x, e.y, e.def.titan ? 24 : e.r + 1);
  if (!q.player.dead) shadow(q.player.x, q.player.y, 5);
  for (const k of q.pickups) shadow(k.x, k.y, 2);
  // depth-sorted drawables
  const list = [];
  for (const o of q.obstacles) list.push({ y: o.y + o.h / 2, draw: () => { const [sx, sy] = S(o.x, o.y); drawObstacle(o, sx, sy + o.h / 2); } });
  for (const e of q.enemies) list.push({ y: e.y, draw: () => drawEnemy(e, S) });
  for (const k of q.pickups) list.push({ y: k.y, draw: () => drawPickup(k, S) });
  if (q.chest) list.push({ y: q.chest.y, draw: () => { const [sx, sy] = S(q.chest.x, q.chest.y); drawSpr('chest', q.chest.open ? 1 : 0, sx, sy, false); } });
  if (!q.player.dead) list.push({ y: q.player.y, draw: () => drawPlayer(q.player, S) });
  for (const gh of q.ghosts || []) list.push({ y: gh.y, draw: () => drawGhost(gh, S) });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();
  // the wall over the hidden nook (see-through while you're inside it)
  if (q.cover) { const r = q.coverRect, [sx, sy] = S(r.x, r.y); ctx.globalAlpha = inCover(q.player.x, q.player.y) ? .28 : 1; ctx.drawImage(q.cover, sx, sy); ctx.globalAlpha = 1; }
  for (const e of q.enemies) if (e.boss && e.beam && e.state === 'beam') drawBeam(e, S);
  for (const f of q.fx) {
    if (f.t === 'after') { const [sx, sy] = S(f.x, f.y); drawSpr(f.frames || f.spr, 0, sx, sy, f.flip, f.gold ? 'gold' : 'white', f.life / f.max * .5, f.scale || 1); }
    else if (f.t === 'slash') { const [sx, sy] = S(f.x, f.y); for (let i = -3; i <= 3; i++) { const a = f.a + i * .22; ctx.fillStyle = f.col || '#f0e4cc'; ctx.fillRect(Math.round(sx + Math.cos(a) * 10), Math.round(sy + Math.sin(a) * 10), 1, 1); } }
    else if (f.t === 'bolt') { const [sx, sy] = S(f.x, f.y); jagged(sx, -4, sx, sy, '#ffffff', 5, 10, f.seed); jagged(sx + 1, -4, sx + 1, sy, f.col || '#ffd463', 5, 10, f.seed); pxEllipse(sx, sy, 6, 3, '#fff6d8'); }
    else if (f.t === 'laneBolt') { const [ax, ay] = S(f.x0, f.y0), [bx, by] = S(f.x1, f.y1); jagged(ax, ay, bx, by, '#ffffff', 5, 12, f.seed); jagged(ax, ay + 1, bx, by + 1, f.col || '#ffd463', 5, 12, f.seed + 2); }
    else if (f.t === 'sweep') { const [sx, sy] = S(f.x, f.y), k = 1 - f.life / f.max; for (let a = -1.15; a <= 1.15; a += .03) { const r = f.r * (.6 + .4 * k); ctx.fillStyle = Math.abs(a) > 1 ? '#a7adb3' : '#ffffff'; ctx.fillRect(Math.round(sx + Math.cos(f.a + a) * r), Math.round(sy + Math.sin(f.a + a) * r * .7), 2, 1); } }
    else if (f.t === 'spear') { const [sx, sy] = S(f.x, f.y); ctx.globalAlpha = clamp(f.life / f.max * 2, 0, 1); pxLine(sx, sy - 15, sx, sy - 2, f.col || '#8a5a34'); pxLine(sx, sy - 2, sx, sy + 1, '#c7ccd1'); ctx.globalAlpha = 1; }
    else if (f.t === 'zap') { const [ax, ay] = S(f.x0, f.y0), [bx, by] = S(f.x1, f.y1); jagged(ax, ay, bx, by, '#ffffff', 4, 6, f.seed); jagged(ax, ay + 1, bx, by + 1, '#57c2b0', 4, 6, f.seed + 3); }
    else if (f.t === 'beamfx') { const [sx, sy] = S(f.x, f.y); ctx.globalAlpha = clamp(f.life / f.max * 2, 0, 1); for (let o = -1; o <= 1; o++) pxLine(sx, sy + o, sx + Math.cos(f.a) * f.len, sy + o + Math.sin(f.a) * f.len, o ? f.c : '#ffffff'); ctx.globalAlpha = 1; }
  }
  for (const pr of q.projs) drawProj(pr, S);
  proDraw(S);
  drawParticlesAndText(S);
  // off-screen enemy arrows
  for (const e of q.enemies) {
    if (e.state === 'spawn' || e.hidden) continue;
    const [sx, sy] = S(e.x, e.y - 6);
    if (sx >= -4 && sx <= VIEW_W + 4 && sy >= -4 && sy <= VIEW_H + 4) continue;
    const ax = clamp(sx, 8, VIEW_W - 8), ay = clamp(sy, 22, VIEW_H - 8), a = Math.atan2(sy - ay, sx - ax);
    arrowHead(ax, ay, a, e.boss ? '#ebc152' : '#cf6a2f');
  }
  drawWeather(S);
  if (!vignette) vignette = makeVignette();
  ctx.drawImage(vignette, 0, 0);
  const p = q.player;
  if (!p.dead && p.hp / p.st.maxHp < .3) { ctx.fillStyle = `rgba(160,20,10,${.12 + Math.sin(G.time * 6) * .06})`; ctx.fillRect(0, 0, VIEW_W, 3); ctx.fillRect(0, VIEW_H - 3, VIEW_W, 3); ctx.fillRect(0, 0, 3, VIEW_H); ctx.fillRect(VIEW_W - 3, 0, 3, VIEW_H); }
  if (q.phase === 'defeat') { ctx.fillStyle = `rgba(30,0,0,${clamp((2.6 - q.endT) / 2.6, 0, .6)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(G.flash * 3, 0, .45)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}
function drawWeather(S) {
  if (q.fog.length) for (const f of q.fog) { const [sx, sy] = S(f.x, f.y); if (sx < -f.r || sx > VIEW_W + f.r || sy < -f.r || sy > VIEW_H + f.r) continue; ctx.globalAlpha = .07; pxEllipse(sx, sy, f.r, Math.round(f.r * .45), '#dcdcf0'); pxEllipse(sx + 6, sy - 2, Math.round(f.r * .6), Math.round(f.r * .3), '#ffffff'); ctx.globalAlpha = 1; }
  if (q.weather === 'storm') {
    ctx.fillStyle = 'rgba(20,24,40,.18)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const R = mulberry(Math.floor(G.time * 20)); ctx.fillStyle = 'rgba(170,190,220,.45)';
    for (let i = 0; i < 46; i++) { const x = R() * VIEW_W, y = R() * VIEW_H; ctx.fillRect(x | 0, y | 0, 1, 4); }
  }
  if (q.night) {
    const [px, py] = S(q.player.x, q.player.y - 6);
    const g = ctx.createRadialGradient(px, py, 30, px, py, 190);
    g.addColorStop(0, 'rgba(8,10,30,.05)'); g.addColorStop(1, 'rgba(8,10,30,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
function drawBeam(b, S) {
  const P = b.cur.p1, [sx, sy] = S(b.x, b.y - 8), a = b.beam.a, len = P.len, col = P.col || '#ffd463';
  for (let o = -2; o <= 2; o++) { const nx = -Math.sin(a) * o, ny = Math.cos(a) * o; pxLine(sx + nx, sy + ny, sx + nx + Math.cos(a) * len, sy + ny + Math.sin(a) * len, Math.abs(o) === 2 ? col : Math.abs(o) === 1 ? '#fff6d8' : '#ffffff'); }
  if (Math.random() < .6) burst(b.x + Math.cos(a) * rand(20, len), b.y - 8 + Math.sin(a) * rand(20, len), 1, [col, '#ffffff'], 30);
}
function drawPlayer(p, S) {
  const [sx, sy] = S(p.x, p.y);
  if (p.invuln > 0 && p.dodgeT <= 0 && p.dashT <= 0 && p.guardFlash <= 0 && Math.floor(G.time * 20) % 2) return;
  const frames = heroFrames(p.look), flip = Math.cos(p.face) < 0, dir = flip ? -1 : 1;
  const fi = p.moving && !p.swing ? Math.floor(p.walkT * 8) % 2 : 0;
  const bob = p.moving && !p.swing ? (Math.floor(p.walkT * 8) % 2) : 0;
  const behind = Math.sin(p.swing ? p.swing.aim : p.face) < -.3;
  const hx = sx + (flip ? -2 : 2), hy = sy - 8 - bob;
  const sh = p.st && p.st.shield, k = easeOut(p.shieldT || 0);
  // The shield swings from your back arm to the front when you guard, gets knocked back when it takes a hit, and lunges on a bash.
  let shDraw = null;
  if (sh && p.dodgeT <= 0) {
    const kick = (p.blockKick > 0 ? -3 * p.blockKick / .15 : 0) + (p.bashT > 0 ? 5 * Math.sin((1 - p.bashT / .2) * Math.PI) : 0);
    const bx = sx - dir * 4, by = sy - 9 - bob, fx = sx + Math.cos(p.face) * (7 + kick), fy = sy - 9 + Math.sin(p.face) * (4 + kick * .5);
    const cx = lerp(bx, fx, k), cy = lerp(by, fy, k) - Math.sin(k * Math.PI) * 2;
    shDraw = { cx, cy, rx: Math.round(lerp(3, 5, k)), ry: Math.round(lerp(4, 7, k)), front: k > .5 && Math.sin(p.face) > -.3, flash: p.guardFlash > 0, glow: p.fx && p.fx.riposte > 0 };
  }
  if (shDraw && !shDraw.front) drawShield(sh, shDraw.cx, shDraw.cy, shDraw.rx, shDraw.ry, shDraw.flash, shDraw.glow);
  if (behind) drawWeapon(p, hx, hy);
  if (p.dodgeT > 0) drawSpr(frames, 1, sx, sy + 1, flip, null, .65);
  else drawSpr(frames, fi, sx, sy - bob, flip, p.flash > 0 ? 'white' : null);
  if (!behind) drawWeapon(p, hx, hy);
  if (shDraw && shDraw.front) drawShield(sh, shDraw.cx, shDraw.cy, shDraw.rx, shDraw.ry, shDraw.flash, shDraw.glow);
  if (p.fx && (p.fx.str > 0 || p.fx.spd > 0) && Math.random() < .2) sc.parts.push({ x: p.x + rand(-5, 5), y: p.y - rand(2, 14), vx: 0, vy: -16, g: 0, life: .35, max: .35, c: p.fx.str > 0 ? '#e9a030' : '#57c2b0', s: 1 });
  if (p.aegisT > 0) { pxRing(sx, sy - 9, 12, blink(16) ? '#ebc152' : '#5b9bd5'); pxRing(sx, sy - 9, 13, '#fff6d8', 3); }
  const top = sy - 26 - bob, F = p.fx || {};
  if (F.charm > 0) for (let i = 0; i < 2; i++) { const a = G.time * 4 + i * 3.1, x = Math.round(sx + Math.cos(a) * 6), y = Math.round(top + Math.sin(a) * 2); ctx.fillStyle = '#f2a7c0'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1); }
  if (F.confuse > 0) for (let i = 0; i < 3; i++) { const a = -G.time * 5 + i * 2.1; ctx.fillStyle = '#9a6bc0'; ctx.fillRect(Math.round(sx + Math.cos(a) * 6), Math.round(top + 2 + Math.sin(a) * 1.5), 1, 1); }
  if (F.sleep > 0) { const k = Math.floor(G.time * 2) % 3; ctx.fillStyle = '#c8b8ff'; for (let i = 0; i <= k; i++) { const zx = sx + 4 + i * 3, zy = top - i * 3; ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1); } }
  if (p.guardBreak > 0) for (let i = 0; i < 3; i++) { const a = G.time * 6 + i * 2.1; ctx.fillStyle = '#ebc152'; ctx.fillRect(Math.round(sx + Math.cos(a) * 5), Math.round(top + 2 + Math.sin(a) * 1.5), 1, 1); }
  if (F.frenzy > 0 && Math.random() < .25) sc.parts.push({ x: p.x + rand(-5, 5), y: p.y - rand(4, 16), vx: 0, vy: -20, g: 0, life: .3, max: .3, c: '#9a6bc0', s: 1 });
  if (F.heart > 0 && Math.random() < .25) sc.parts.push({ x: p.x + rand(-5, 5), y: p.y - rand(4, 16), vx: 0, vy: -20, g: 0, life: .3, max: .3, c: '#f2a7c0', s: 1 });
}
function drawShield(sh, cx, cy, rx, ry, flash, glow) {
  const [a, b, c] = sh.colors;
  pxEllipse(cx, cy, rx + 1, ry + 1, '#140d0b'); pxEllipse(cx, cy, rx, ry, flash ? '#ffffff' : b);
  pxEllipse(cx - (rx > 3 ? 1 : 0), cy - 1, Math.max(1, rx - 1), Math.max(1, ry - 1), flash ? '#ffffff' : a);
  if (rx > 3 && !flash) { ctx.fillStyle = '#ffffff55'; ctx.fillRect(Math.round(cx) - rx + 2, Math.round(cy) - ry + 2, 1, Math.max(1, ry - 2)); }
  ctx.fillStyle = c; ctx.fillRect(Math.round(cx), Math.round(cy) - 1, 1, 2); if (rx > 3) ctx.fillRect(Math.round(cx) - 1, Math.round(cy), 3, 1);
  if (glow && blink(10)) pxRing(cx, cy, Math.max(rx, ry) + 2, '#ebc152', 2);
}
const WEAPON_TINT = { keraunos: '#ffd463', storm_fangs: '#57c2b0', athena_spear: '#f3e9d4', hoplite_dory: '#e9c04f', cyclops_club: '#8a5a34', owl_bow: '#a7adb3' };
// Rank forms keep their weapon's look with a red (High Rank) or violet (God Rank) edge.
function weaponTint(id) {
  const r = rankOf(id), b = baseId(id), c = WEAPON_TINT[b] || (WEAPON_COLORS[b] && WEAPON_COLORS[b][0]);
  return r ? mixHex(c || '#c7ccd1', RANK_TINT[r].trim, .55) : c;
}
function drawWeapon(p, hx, hy) {
  if (p.dodgeT > 0) return;
  const w = p.st.weapon, fullId = G.save.weapon, id = baseId(fullId), kind = w.kind, K = KINDS[kind];
  let ang = p.face, ext = 0, trail = null;
  if (p.swing) {
    const s = p.swing, tt = clamp((s.t - s.windup) / s.active, 0, 1);
    if (kind === 'spear') { ang = s.aim; ext = s.t < s.windup ? -3 : Math.sin(tt * Math.PI) * 9; }
    else if (kind === 'bow') ang = s.aim;
    else {
      const from = s.aim - K.arc / 2 * s.side, to = s.aim + K.arc / 2 * s.side;
      ang = s.t < s.windup ? from - .3 * s.side : lerp(from, to, easeOut(tt));
      if (s.t >= s.windup) trail = { from, cur: ang, r: kind === 'hammer' ? K.reach - 4 : K.reach - 3 };
    }
  } else if (p.fx && p.fx.spin > 0) { ang = G.time * 30; trail = { from: ang - 2.5, cur: ang, r: 20 }; }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (d, side = 0) => [hx + ca * d - sa * side, hy + sa * d + ca * side];
  const tint = weaponTint(fullId);
  if (trail) {
    const steps = 14, col = kind === 'hammer' ? '#ebc152' : (tint || '#f0e4cc');
    for (let i = 0; i <= steps; i++) {
      const a = lerp(trail.from, trail.cur, i / steps); ctx.globalAlpha = .25 + .75 * (i / steps); ctx.fillStyle = col;
      ctx.fillRect(Math.round(hx + Math.cos(a) * trail.r), Math.round(hy + 2 + Math.sin(a) * trail.r), kind === 'hammer' ? 2 : 1, kind === 'hammer' ? 2 : 1);
      if (kind !== 'daggers') ctx.fillRect(Math.round(hx + Math.cos(a) * (trail.r - 2)), Math.round(hy + 2 + Math.sin(a) * (trail.r - 2)), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  const grip = (WEAPON_COLORS[id] && WEAPON_COLORS[id][2]) || '#8a5a34';
  switch (kind) {
    case 'sword': { const [a1, b1] = P(1), [a2, b2] = P(10); pxLine(a1, b1, a2, b2, tint || '#e9c04f'); const [c1, d1] = P(2, -2), [c2, d2] = P(2, 2); pxLine(c1, d1, c2, d2, '#a8842a'); const [e1, f1] = P(9); ctx.fillStyle = '#fff3c0'; ctx.fillRect(Math.round(e1), Math.round(f1), 1, 1); break; }
    case 'spear': { const [a1, b1] = P(-4 + ext), [a2, b2] = P(13 + ext); pxLine(a1, b1, a2, b2, id === 'athena_spear' ? '#e9c04f' : grip); const [c1, d1] = P(13 + ext), [c2, d2] = P(16 + ext); pxLine(c1, d1, c2, d2, tint || '#c7ccd1');
      if (id === 'trident' || id === 'bident') { for (const sd of id === 'trident' ? [-2, 2] : [-1.5, 1.5]) { const [e1, f1] = P(13 + ext, sd), [e2, f2] = P(16 + ext, sd); pxLine(e1, f1, e2, f2, tint); } } break; }
    case 'hammer': { const [a1, b1] = P(-1), [a2, b2] = P(9); pxLine(a1, b1, a2, b2, grip); const big = id === 'cyclops_club' || id === 'satyr_club'; for (let s = -3; s <= 3; s++) { const [c1, d1] = P(9, s), [c2, d2] = P(big ? 14 : 12, s); pxLine(c1, d1, c2, d2, big ? (Math.abs(s) === 3 ? '#5a3a22' : '#8a5a34') : (Math.abs(s) === 3 ? '#636a72' : (tint && id !== 'bull_maul' ? tint : '#a7adb3'))); } break; }
    case 'daggers': { const col = tint || '#c7ccd1'; const [a1, b1] = P(1, -2), [a2, b2] = P(6, -2); pxLine(a1, b1, a2, b2, col); const [c1, d1] = P(0, 2), [c2, d2] = P(5, 3); pxLine(c1, d1, c2, d2, col); break; }
    case 'bow': {
      ctx.fillStyle = tint || '#8a5a34';
      for (let i = -5; i <= 5; i++) { const a = ang + i * .2; ctx.fillRect(Math.round(hx + Math.cos(a) * 5), Math.round(hy + Math.sin(a) * 5), 1, 1); }
      const a1 = hx + Math.cos(ang - 1) * 5, b1 = hy + Math.sin(ang - 1) * 5, a2 = hx + Math.cos(ang + 1) * 5, b2 = hy + Math.sin(ang + 1) * 5;
      const pull = p.swing && p.swing.t < p.swing.windup ? -2 : 0; const [m1, n1] = P(pull);
      pxLine(a1, b1, m1, n1, '#f0e4cc'); pxLine(m1, n1, a2, b2, '#f0e4cc');
      break;
    }
  }
}
function drawEnemy(e, S) {
  const [sx, sy] = S(e.x, e.y);
  if (e.boss) return drawBoss(e, sx, sy);
  if (e.hidden) return;
  const d = e.def, spr = d.sprite, sc2 = e.scale || 1, alt = e.fly ? 10 + Math.round(Math.sin(G.time * 5 + e.id) * 2) : 0;
  if (e.state === 'spawn') { const k = clamp(1 - e.st / .8, 0, 1); drawSpr(spr, 0, sx, sy - alt + Math.round((1 - k) * 6), e.flip, 'white', k * .8, sc2); return; }
  if (e.state === 'bones') {                                   // a pile of bones that shakes before it stands up
    const sh = e.st < 1 && blink(20) ? 1 : 0, R = mulberry(e.id);
    for (let i = 0; i < 9; i++) { const x = sx - 6 + R() * 12 + sh, y = sy - 3 + R() * 4; ctx.fillStyle = '#140d0b'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 5, 3); ctx.fillStyle = i % 3 ? '#f3e9d4' : '#c2b293'; ctx.fillRect(Math.round(x), Math.round(y), 3, 1); }
    ctx.fillStyle = '#f3e9d4'; ctx.fillRect(sx - 2 + sh, sy - 6, 4, 3); ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 1 + sh, sy - 5, 1, 1); ctx.fillRect(sx + 1 + sh, sy - 5, 1, 1);
    const k = clamp(e.st / 3.2, 0, 1); ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 7, sy - 10, 14, 3); ctx.fillStyle = '#7fe08a'; ctx.fillRect(sx - 6, sy - 9, Math.round(12 * (1 - k)), 1);
    return;
  }
  let fi = e.fly ? Math.floor(G.time * (e.state === 'windup' ? 14 : 7)) % 2 : Math.floor(e.walkT * 7) % 2, ox = 0;
  if ((d.role === 'charger' || d.role === 'leaper') && e.state === 'windup') { ox = blink(30) ? 1 : -1; fi = 0; }
  if (d.role === 'tank' && d.attack !== 'thrust' && e.state === 'windup') ox = blink(24) ? 1 : -1;
  let tint = e.flash > 0 ? 'white' : null;
  if (d.role === 'exploder' && e.state === 'fuse' && blink(14)) tint = 'white';
  let alpha = e.alpha;
  if (d.tint === 'pink') alpha *= .75 + Math.sin(G.time * 8 + e.id) * .1;
  if (d.sprite === 'shade') alpha *= .82;
  if (d.role === 'tank' && d.attack === 'thrust') drawSpear(e, sx, sy);
  let breath = 0;
  if (d.role === 'decoy') { fi = 0; if (e.real && Math.sin(G.time * 3.2) > .55) { breath = 1; fi = 1; } }   // the real Rhea breathes
  drawSpr(rankFrames(spr, e.rank), fi, sx + ox, sy - alt - breath, e.flip, tint, alpha, sc2);
  if (d.shield) drawShieldMark(e, sx, sy);
  const top = sy - e.h;
  const mark = col => { ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 2, top - 5, 4, 8); ctx.fillStyle = col; ctx.fillRect(sx - 1, top - 4, 2, 4); ctx.fillRect(sx - 1, top + 1, 2, 1); };
  if (e.state === 'windup') mark(d.role === 'shooter' || d.role === 'summoner' || d.role === 'thrower' ? '#ebc152' : '#ff5a3c');
  if (e.state === 'windup' && (d.role === 'shooter' || d.role === 'thrower')) { const a = G.time * 20; ctx.fillStyle = '#c2b293'; ctx.fillRect(Math.round(sx + Math.cos(a) * 5), Math.round(sy - e.h + 3 + Math.sin(a) * 2), 1, 1); }
  if (e.stun > 0) for (let i = 0; i < 3; i++) { const a = G.time * 6 + i * 2.1; ctx.fillStyle = '#ebc152'; ctx.fillRect(Math.round(sx + Math.cos(a) * 5), Math.round(top + 1 + Math.sin(a) * 1.5), 1, 1); }
  if (e.markT > 0) { ctx.fillStyle = '#140d0b'; ctx.fillRect(sx + 5, top - 3, 3, 3); ctx.fillStyle = '#7fe08a'; ctx.fillRect(sx + 6, top - 2, 1, 1); }
  if (e.hp < e.maxHp) { const w = d.cls === 'heavy' ? 22 : d.cls === 'medium' ? 16 : 12, bx = sx - w / 2, by = top - 1; ctx.fillStyle = '#140d0b'; ctx.fillRect(bx - 1, by - 1, w + 2, 3); ctx.fillStyle = '#3a2a22'; ctx.fillRect(bx, by, w, 1); ctx.fillStyle = '#d9493b'; ctx.fillRect(bx, by, Math.max(1, Math.round(w * e.hp / e.maxHp)), 1); }
}
function drawSpear(e, sx, sy) {
  const s = e.scale || 1, ext = (e.state === 'attack' ? 10 : e.state === 'windup' ? -3 : 0) * s, ca = Math.cos(e.face), sa = Math.sin(e.face), hx = sx + ca * 2 * s, hy = sy - 7 * s;
  pxLine(hx - ca * 6 * s, hy - sa * 6 * s, hx + ca * (14 * s + ext), hy + sa * (14 * s + ext), e.def.sprite === 'automaton' || e.def.sprite === 'talos' ? '#8f6c1c' : '#8a5a34');
  pxLine(hx + ca * (14 * s + ext), hy + sa * (14 * s + ext), hx + ca * (17 * s + ext), hy + sa * (17 * s + ext), '#c7ccd1');
}
function drawShieldMark(e, sx, sy) {
  const up = (e.state === 'move' || e.state === 'windup') && e.stun <= 0;
  if (!up) return;
  const cx = sx + Math.cos(e.face) * 6, cy = sy - 7 + Math.sin(e.face) * 3, auto = e.def.sprite === 'automaton';
  pxEllipse(cx, cy, 4, 5, '#140d0b'); pxEllipse(cx, cy, 3, 4, auto ? '#c9a032' : '#e9c04f'); ctx.fillStyle = auto ? '#ff8a2b' : '#c0412e'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
}
// What each god carries. Drawn in code so it can swing and glow.
const GOD_HELD = { artemis: ['bow', '#d5dbe5'], dionysus: ['thyrsus', '#4e8a3a'], apollo: ['bow', '#ffd463'], ares: ['spear', '#c7ccd1'], poseidon: ['trident', '#e9c04f'],
  hera: ['scepter', '#e9c04f'], hephaestus: ['hammer', '#4b4f57'], hades: ['bident', '#7fe08a'], pan: ['pipes', '#c9a46b'], hecate: ['torches', '#57c2b0'],
  nemesis: ['sword', '#d5dbe5'], eris: ['apple', '#e9c04f'], hypnos: ['poppy', '#c0412e'], aphrodite: ['mirror', '#e9c04f'] };
function drawHeld(god, hx, hy, flip, raised) {
  const H = GOD_HELD[god]; if (!H) return;
  const [kind, col] = H, d = flip ? -1 : 1, up = raised ? -4 : 0;
  switch (kind) {
    case 'bow': ctx.fillStyle = col; for (let i = -6; i <= 6; i++) { const a = (flip ? Math.PI : 0) + i * .2; ctx.fillRect(Math.round(hx + Math.cos(a) * 6), Math.round(hy + up + Math.sin(a) * 6), 1, 1); } pxLine(hx + Math.cos(-1.2) * 6 * d, hy + up - 6 * .93, hx + Math.cos(1.2) * 6 * d, hy + up + 6 * .93, '#f0e4cc'); break;
    case 'spear': case 'trident': case 'bident': case 'thyrsus': case 'scepter': case 'poppy': {
      pxLine(hx, hy + 8, hx, hy - 12 + up, kind === 'scepter' ? '#e9c04f' : kind === 'poppy' ? '#4e8a3a' : '#8a5a34');
      const t = hy - 12 + up;
      if (kind === 'spear') pxLine(hx, t - 4, hx, t, col);
      else if (kind === 'trident') { pxLine(hx - 2, t - 4, hx - 2, t, col); pxLine(hx, t - 5, hx, t, col); pxLine(hx + 2, t - 4, hx + 2, t, col); pxLine(hx - 2, t, hx + 2, t, col); }
      else if (kind === 'bident') { pxLine(hx - 1, t - 5, hx - 1, t, col); pxLine(hx + 1, t - 5, hx + 1, t, col); }
      else if (kind === 'thyrsus') { pxEllipse(hx, t - 2, 2, 3, '#140d0b'); pxEllipse(hx, t - 2, 1, 2, '#a8842a'); ctx.fillStyle = col; ctx.fillRect(hx - 2, t + 1, 1, 1); ctx.fillRect(hx + 2, t + 2, 1, 1); }
      else if (kind === 'scepter') { pxEllipse(hx, t - 2, 2, 2, '#140d0b'); ctx.fillStyle = '#3f9a8a'; ctx.fillRect(hx - 1, t - 3, 3, 3); ctx.fillStyle = '#2c5684'; ctx.fillRect(hx, t - 2, 1, 1); }
      else if (kind === 'poppy') { pxEllipse(hx, t - 2, 3, 2, '#140d0b'); pxEllipse(hx, t - 2, 2, 1, col); ctx.fillStyle = '#140d0b'; ctx.fillRect(hx, t - 2, 1, 1); }
      break;
    }
    case 'hammer': pxLine(hx, hy + 6, hx + 3 * d, hy - 8 + up, '#6b4528'); for (let s = -3; s <= 3; s++) pxLine(hx + 3 * d + s, hy - 9 + up, hx + 3 * d + s, hy - 13 + up, Math.abs(s) === 3 ? '#2a2c31' : col); break;
    case 'sword': pxLine(hx, hy + 2, hx + 2 * d, hy - 10 + up, col); pxLine(hx - 2, hy + 1, hx + 2, hy + 1, '#e9c04f'); break;
    case 'pipes': for (let i = 0; i < 4; i++) pxLine(hx + i * d, hy - 2, hx + i * d, hy + 2 - i, col); break;
    case 'torches': for (const o of [-6, 6]) { pxLine(hx + o * d * .5 - 3 * d, hy + 4, hx + o * d * .5 - 3 * d, hy - 6 + up, '#5a3a22'); flame(hx + o * d * .5 - 3 * d, hy - 6 + up, 3, 4, o + 3); const R = mulberry(Math.floor(G.time * 10) + o); ctx.fillStyle = R() < .5 ? col : '#c8b8ff'; ctx.fillRect(hx + o * d * .5 - 3 * d, hy - 9 + up - Math.floor(R() * 3), 1, 2); } break;
    case 'apple': pxEllipse(hx, hy - 2 + up, 2, 2, '#140d0b'); pxEllipse(hx, hy - 2 + up, 1, 1, col); ctx.fillStyle = '#fff6d8'; ctx.fillRect(hx - 1, hy - 3 + up, 1, 1); break;
    case 'mirror': pxEllipse(hx, hy - 4 + up, 2, 3, '#140d0b'); pxEllipse(hx, hy - 4 + up, 1, 2, '#e6f2ff'); pxLine(hx, hy - 1 + up, hx, hy + 2 + up, col); break;
  }
}
function drawBoss(b, sx, sy) {
  if (b.def.titan) return drawTitan(b, sx, sy);
  let tint = b.flash > 0 ? 'white' : (b.state === 'enrage' || b.state === 'ascend') && blink(12) ? 'gold' : null;
  const RF = name => rankFrames(name, b.rank);
  if (b.type === 'hermes') {
    const hover = b.state === 'winded' ? 1 : Math.round(3 + Math.sin(G.time * 4) * 2), fi = Math.floor(G.time * 6) % 2;
    if (b.state === 'dash') { drawSpr('hermes', 0, sx, sy - 4, b.flip, 'gold', .9); return; }
    const hx = sx + (b.flip ? -5 : 5), hy = sy - hover - 8;
    pxLine(hx, hy + 6, hx, hy - 12, '#e9c04f');
    ctx.fillStyle = '#57c2b0'; for (let i = 0; i < 6; i++) ctx.fillRect(hx + (i % 2 ? 1 : -1), hy - 2 - i * 2, 1, 1);
    ctx.fillStyle = '#f3e9d4'; ctx.fillRect(hx - 2, hy - 12, 2, 1); ctx.fillRect(hx + 1, hy - 12, 2, 1);
    if (b.state === 'fanWind' || b.state === 'ringWind') { ctx.fillStyle = blink(20) ? '#ffffff' : '#57c2b0'; ctx.fillRect(hx - 1, hy - 14, 3, 3); }
    drawSpr(RF('hermes'), fi, sx, sy - hover, b.flip, tint, b.alpha);
  } else if (b.type === 'athena') {
    const fi = b.state === 'idle' && Math.hypot(b.vx, b.vy) > 5 ? Math.floor(b.walkT * 6) % 2 : 0;
    const lunging = b.state === 'lunge', ca = Math.cos(b.face), sa = Math.sin(b.face);
    const ext = lunging ? 12 : b.state === 'lungeAim' ? -4 : 0, hx = sx + ca * 3, hy = sy - 9;
    pxLine(hx - ca * 8, hy - sa * 8, hx + ca * (16 + ext), hy + sa * (16 + ext), '#e9c04f');
    pxLine(hx + ca * (16 + ext), hy + sa * (16 + ext), hx + ca * (20 + ext), hy + sa * (20 + ext), '#f3e9d4');
    drawSpr(RF('athena'), fi, sx, sy, b.flip, lunging ? 'gold' : tint, b.alpha);
    if (b.guard) {
      const cx = sx + ca * 8, cy = sy - 9 + sa * 4;
      pxEllipse(cx, cy, 6, 7, '#140d0b'); pxEllipse(cx, cy, 5, 6, '#4f8fc7'); pxRing(cx, cy, 5, '#e9c04f', 1.5);
      ctx.fillStyle = '#e9c04f'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3); ctx.fillStyle = '#57c2b0'; ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
    }
    if (b.state === 'aegisWind' && blink(16)) burst(b.x, b.y - 10, 1, ['#ebc152'], 40);
  } else if (b.type === 'zeus') {
    const P3 = b.phase === 3, hover = Math.round(6 + Math.sin(G.time * 3) * 2), raised = /Wind|Aim/.test(b.state);
    const hx = sx + (b.flip ? -7 : 7), hy = sy - hover - (raised ? 22 : 12);
    ctx.fillStyle = blink(14) ? '#fff6d8' : '#ffd463';
    const zig = [[0, 0], [3, -3], [1, -4], [4, -8], [1, -7], [2, -11]];
    for (let i = 1; i < zig.length; i++) pxLine(hx + zig[i - 1][0], hy + zig[i - 1][1], hx + zig[i][0], hy + zig[i][1], ctx.fillStyle);
    if (P3) { pxRing(sx, sy - hover - 12, 14 + Math.sin(G.time * 6) * 2, blink(10) ? '#ffd463' : '#57c2b0', 2); if (!tint && blink(5)) tint = 'gold'; }
    drawSpr(RF('zeus'), 0, sx, sy - hover, b.flip, tint, b.alpha);
    if (b.phase >= 2 && Math.random() < (P3 ? .6 : .3)) sc.parts.push({ x: b.x + rand(-10, 10), y: b.y - rand(10, 28) - hover, vx: rand(-20, 20), vy: rand(-20, 10), g: 0, life: .2, max: .2, c: P3 ? '#ffd463' : '#57c2b0', s: 1 });
  } else {
    if (b.hidden) return;
    const lift = Math.round(b.z || 0), moving = b.state === 'idle' && Math.hypot(b.vx, b.vy) > 5;
    const fi = moving ? Math.floor(b.walkT * 6) % 2 : 0, crouch = b.state === 'leapAim' ? 2 : 0;
    const hx = sx + (b.flip ? -6 : 6), hy = sy - 10 - lift + crouch, raised = /Aim|Wind|fan|ring|rain|wave|quake|puddles|confuse|stampede/.test(b.state);
    if (b.reflectT > 0) { pxEllipse(sx, sy - 9, 10, 13, 'rgba(255,255,255,.18)'); pxRing(sx, sy - 9, 12 + (blink(10) ? 1 : 0), '#ffffff', 1.5); }
    if (b.type === 'aphrodite' && Math.random() < .08) sc.parts.push({ x: b.x + rand(-8, 8), y: b.y - rand(10, 24), vx: 0, vy: -14, g: 0, life: .8, max: .8, c: '#f2a7c0', s: 1 });
    drawHeld(b.type, hx, hy, b.flip, raised);
    drawSpr(RF(b.def.sprite), fi, sx, sy - lift + crouch, b.flip, b.state === 'dash' ? 'gold' : tint, b.alpha);
  }
}
function drawPickup(k, S) {
  const [sx, sy] = S(k.x, k.y - k.z - 2);
  if (k.item === '@heal') {
    const pulse = Math.floor(G.time * 6) % 2;
    pxEllipse(sx, sy - 2, 3, 3, '#140d0b'); pxEllipse(sx, sy - 2, 2, 2, pulse ? '#ffd463' : '#ebc152'); ctx.fillStyle = '#fff6d8'; ctx.fillRect(sx - 1, sy - 3, 1, 1);
    return;
  }
  const r = ITEMS[k.item].rarity, bob = k.z > 0 ? 0 : Math.round(Math.sin(G.time * 4 + k.x) * 1), img = iconCanvas(k.item);
  ctx.drawImage(img, sx - 5, sy - 10 + bob);
  if (r >= 3 && Math.floor(G.time * 4 + k.x) % 3 === 0) { ctx.fillStyle = r === 4 ? '#ebc152' : '#5b9bd5'; ctx.fillRect(sx + 4, sy - 13 + bob, 1, 3); ctx.fillRect(sx + 3, sy - 12 + bob, 3, 1); }
}
const PROJ_COL = { heart: ['#f2a7c0', '#c76d8e'], water: ['#5aa3c0', '#e6f2ff'], grape: ['#7a4f9c', '#4a2f63'], soul: ['#7fe08a', '#2f8a4a'], note: ['#7fa548', '#e9c04f'],
  witchfire: ['#57c2b0', '#2c5684'], dream: ['#c8b8ff', '#6b5a8a'], eyebolt: ['#5b9bd5', '#ffffff'], sunbolt: ['#ffd463', '#ffffff'], blade: ['#d5dbe5', '#8f98a8'], plume: ['#3f9a8a', '#e9c04f'] };
function drawProj(pr, S) {
  const [sx, sy] = S(pr.x, pr.y), a = Math.atan2(pr.vy, pr.vx), ca = Math.cos(a), sa = Math.sin(a);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(sx - 1, sy, 3, 1);
  const y = sy - 6;
  switch (pr.kind) {
    case 'stone': ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 2, y - 2, 4, 4); ctx.fillStyle = '#a7adb3'; ctx.fillRect(sx - 1, y - 1, 2, 2); ctx.fillStyle = '#e0e4e8'; ctx.fillRect(sx - 1, y - 1, 1, 1); break;
    case 'arrow': case 'arrowE': case 'sunarrow': pxLine(sx - ca * 6, y - sa * 6, sx, y, pr.kind === 'arrow' ? '#8a5a34' : pr.kind === 'sunarrow' ? '#ffd463' : '#5a3a22'); ctx.fillStyle = pr.kind === 'arrow' ? '#e0e4e8' : '#ff5a3c'; ctx.fillRect(Math.round(sx + ca), Math.round(y + sa), 1, 1); ctx.fillStyle = '#f0e4cc'; ctx.fillRect(Math.round(sx - ca * 6), Math.round(y - sa * 6), 1, 1); break;
    case 'snake':
      for (let i = 4; i >= 0; i--) { const w = Math.sin(pr.t * 18 - i) * 1.5; ctx.fillStyle = i === 0 ? '#140d0b' : (i % 2 ? '#57c2b0' : '#3c8f82'); const px = sx - ca * i * 2 - sa * w, py = y - sa * i * 2 + ca * w; ctx.fillRect(Math.round(px) - (i === 0 ? 1 : 0), Math.round(py) - (i === 0 ? 1 : 0), i === 0 ? 3 : 2, i === 0 ? 3 : 2); }
      ctx.fillStyle = '#57c2b0'; ctx.fillRect(sx, y, 1, 1); break;
    case 'feather': pxLine(sx - ca * 4, y - sa * 4, sx, y, '#f3e9d4'); ctx.fillStyle = '#ebc152'; ctx.fillRect(sx, y, 1, 1); ctx.fillStyle = '#140d0b'; ctx.fillRect(Math.round(sx - ca * 5), Math.round(y - sa * 5), 1, 1); break;
    case 'thunder': jagged(sx - ca * 9, y - sa * 9, sx + ca * 2, y + sa * 2, '#fff6d8', 2, 4, (pr.t * 30) | 0); jagged(sx - ca * 9, y - sa * 9 + 1, sx + ca * 2, y + sa * 2 + 1, '#ffd463', 2, 4, (pr.t * 30 + 5) | 0); break;
    case 'orb': pxEllipse(sx, y, 4, 4, '#140d0b'); pxEllipse(sx, y, 3, 3, Math.floor(pr.t * 10) % 2 ? '#57c2b0' : '#3c8f82'); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1, y - 1, 2, 2); break;
    case 'zspark': ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 2, y - 2, 4, 4); ctx.fillStyle = Math.floor(pr.t * 20) % 2 ? '#ffffff' : '#ffd463'; ctx.fillRect(sx - 1, y - 1, 2, 2); break;
    case 'heart': { ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 3, y - 2, 7, 4); ctx.fillRect(sx - 2, y + 2, 5, 1); ctx.fillRect(sx - 1, y + 3, 3, 1); const [c1] = PROJ_COL.heart; ctx.fillStyle = c1; ctx.fillRect(sx - 2, y - 1, 2, 2); ctx.fillRect(sx + 1, y - 1, 2, 2); ctx.fillRect(sx - 1, y + 1, 3, 1); ctx.fillRect(sx, y + 2, 1, 1); ctx.fillRect(sx, y, 1, 1); break; }
    case 'goat': drawSpr('goat', Math.floor(pr.t * 10) % 2, sx, sy + 1, pr.vx < 0, null); break;
    case 'blade': {
      const a2 = pr.delay > 0 ? Math.atan2(q.player.y - pr.y, q.player.x - pr.x) : a, c2 = Math.cos(a2), s2 = Math.sin(a2);
      if (pr.delay > 0 && blink(10)) pxRing(sx, y, 4, '#e9c04f', 2);
      pxLine(sx - c2 * 5, y - s2 * 5, sx + c2 * 2, y + s2 * 2, '#d5dbe5'); pxLine(sx - c2 * 5 - s2, y - s2 * 5 + c2, sx - c2 * 3 - s2, y - s2 * 3 + c2, '#e9c04f'); break;
    }
    case 'globe': pxEllipse(sx, sy, 16, 5, 'rgba(0,0,0,.35)'); drawGlobe(sx, sy - 16, 16, pr.t * 4); break;
    case 'sickle': drawSickle(sx, y - 6, pr.t * 16, 12); break;
    case 'wave': for (let o = -9; o <= 9; o++) { const px = sx - sa * o, py = y + ca * o - Math.abs(Math.sin(o * .7 + pr.t * 12)) * 3; ctx.fillStyle = OUTLINE; ctx.fillRect(Math.round(px), Math.round(py) - 1, 2, 4); ctx.fillStyle = Math.abs(o) % 3 === 0 ? '#e6f2ff' : '#5aa3c0'; ctx.fillRect(Math.round(px), Math.round(py), 1, 2); } break;
    case 'lion': drawSpr('lion', Math.floor(pr.t * 10) % 2, sx, sy + 1, pr.vx < 0, 'gold', .85); if (Math.random() < .4) sc.parts.push({ x: pr.x, y: pr.y - 6, vx: 0, vy: -10, g: 0, life: .3, max: .3, c: '#ffd463', s: 1 }); break;
    case 'crescent': for (let k = -1.2; k <= 1.2; k += .1) { const px = sx + Math.cos(a + k) * 7 - ca * 4, py = y + Math.sin(a + k) * 7 - sa * 4; ctx.fillStyle = Math.abs(k) > .9 ? '#ffd463' : '#ffffff'; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); } break;
    case 'piercer': pxLine(sx - ca * 10, y - sa * 10, sx, y, '#ffffff'); pxLine(sx - ca * 10, y - sa * 10 + 1, sx, y + 1, '#ffd463'); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(sx + ca), Math.round(y + sa), 2, 2); break;
    default: {
      const [c1, c2] = PROJ_COL[pr.kind] || ['#ff5a3c', '#ffd463'], big = pr.kind === 'soul' || pr.kind === 'dream' || pr.kind === 'witchfire';
      pxEllipse(sx, y, big ? 3 : 2, big ? 3 : 2, '#140d0b'); pxEllipse(sx, y, big ? 2 : 1, big ? 2 : 1, Math.floor(pr.t * 12) % 2 ? c1 : c2);
      if (big && Math.random() < .3) sc.parts.push({ x: pr.x, y: pr.y - 6, vx: 0, vy: -10, g: 0, life: .25, max: .25, c: c1, s: 1 });
    }
  }
}

/* ---- village and temple rendering ---- */
function drawBuilding(b, sx, sy) {
  const W = b.box.w, H = b.box.h, F = 26, RH = H - F, t = G.time;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(sx + 4, sy + H, W, 4);
  if (b.kind === 'temple') {
    ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 1, sy - 1, W + 2, H + 2);
    ctx.fillStyle = '#d8ceb7'; ctx.fillRect(sx, sy, W, RH);
    for (let y = sy + 4; y < sy + RH; y += 5) { ctx.fillStyle = '#c9bda4'; ctx.fillRect(sx, y, W, 1); }
    ctx.fillStyle = '#1a1210'; ctx.fillRect(sx, sy + RH - 12, W, 9);
    for (let px = sx; px < sx + W; px += 6) { ctx.fillStyle = '#c35f2a'; ctx.fillRect(px, sy + RH - 11, 5, 1); ctx.fillRect(px + 4, sy + RH - 11, 1, 5); ctx.fillRect(px + 1, sy + RH - 7, 4, 1); ctx.fillRect(px + 1, sy + RH - 9, 1, 3); ctx.fillRect(px, sy + RH - 5, 6, 1); }
    ctx.fillStyle = '#2a1e19'; ctx.fillRect(sx + 4, sy + RH, W - 8, F - 4);
    const R = mulberry(Math.floor(t * 10)); for (let i = 0; i < 6; i++) { ctx.fillStyle = R() < .5 ? '#ff8a2b' : '#ffd463'; ctx.fillRect(sx + W / 2 - 6 + R() * 12 | 0, sy + RH + 8 + R() * 6 | 0, 1, 2); }
    for (let i = 0; i < 8; i++) { const cx = sx + 8 + i * ((W - 16) / 7); if (i === 3 || i === 4) continue; ctx.fillStyle = '#1a1210'; ctx.fillRect(cx - 4, sy + RH - 2, 8, F); ctx.fillStyle = '#efe7d4'; ctx.fillRect(cx - 3, sy + RH - 1, 6, F - 2); ctx.fillStyle = '#c9bda4'; ctx.fillRect(cx + 1, sy + RH - 1, 2, F - 2); }
    ctx.fillStyle = '#b5a98f'; ctx.fillRect(sx - 2, sy + H - 4, W + 4, 4); ctx.fillStyle = '#d8ceb7'; ctx.fillRect(sx - 2, sy + H - 4, W + 4, 1);
    // a glint for every god you've beaten: gold, diamond or amethyst
    GODS.forEach((g, i) => { const r = godRank(g.id); ctx.fillStyle = r < 0 ? '#8f8470' : ['#e9c04f', '#cdeeff', '#b48cff'][r]; ctx.fillRect(sx + 10 + i * ((W - 20) / 11) | 0, sy + 3, 2, 2); });
    return;
  }
  const wall = b.kind === 'forge' ? ['#a99d86', '#8f8470'] : ['#e6d9bd', '#cbbd9f'];
  ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 1, sy - 1, W + 2, H + 2);
  ctx.fillStyle = '#b5532a'; ctx.fillRect(sx, sy, W, RH);
  for (let y = sy + 3; y < sy + RH; y += 4) { ctx.fillStyle = '#8f3f1d'; ctx.fillRect(sx, y, W, 1); }
  for (let y = sy; y < sy + RH - 1; y += 4) for (let x = sx + ((y - sy) / 4 % 2) * 3; x < sx + W; x += 6) { ctx.fillStyle = '#cf6a2f'; ctx.fillRect(x, y, 3, 1); }
  ctx.fillStyle = '#e8874a'; ctx.fillRect(sx, sy, W, 1);
  ctx.fillStyle = '#6b2c12'; ctx.fillRect(sx, sy + RH - 2, W, 2);
  ctx.fillStyle = wall[0]; ctx.fillRect(sx, sy + RH, W, F);
  ctx.fillStyle = wall[1]; ctx.fillRect(sx, sy + RH, W, 2); ctx.fillRect(sx, sy + H - 3, W, 3);
  const dx = Math.round(sx + Math.floor(b.w / 2) * TILE + 2);
  ctx.fillStyle = '#1a1210'; ctx.fillRect(dx - 1, sy + H - 19, 14, 19);
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(dx, sy + H - 18, 12, 18); ctx.fillStyle = '#6b4528'; ctx.fillRect(dx + 3, sy + H - 18, 1, 18); ctx.fillRect(dx + 8, sy + H - 18, 1, 18);
  ctx.fillStyle = '#e9c04f'; ctx.fillRect(dx + 9, sy + H - 10, 1, 1);
  for (const wx of [sx + 8, sx + W - 18]) { if (Math.abs(wx - dx) < 16) continue; ctx.fillStyle = '#1a1210'; ctx.fillRect(wx, sy + RH + 6, 10, 9); ctx.fillStyle = '#2b3d55'; ctx.fillRect(wx + 1, sy + RH + 7, 8, 7); ctx.fillStyle = '#8a5a34'; ctx.fillRect(wx + 1, sy + RH + 10, 8, 1); if (b.kind === 'home') { ctx.fillStyle = '#7fa548'; ctx.fillRect(wx, sy + RH + 15, 10, 2); ctx.fillStyle = '#d9493b'; ctx.fillRect(wx + 2, sy + RH + 14, 1, 1); ctx.fillRect(wx + 6, sy + RH + 14, 1, 1); } }
  const signIcon = { forge: 'bronze_sword', hall: 'herald_token', store: 'cattle_hide', home: null }[b.kind];
  if (signIcon) { ctx.fillStyle = '#1a1210'; ctx.fillRect(dx - 1, sy + RH + 1, 14, 10); ctx.fillStyle = '#c09a63'; ctx.fillRect(dx, sy + RH + 2, 12, 8); const ic = iconCanvas(signIcon); ctx.drawImage(ic, dx + 1, sy + RH + 1, 10, 10 * ic.height / ic.width); }
  if (b.kind === 'forge') { ctx.fillStyle = '#1a1210'; ctx.fillRect(sx + W - 22, sy - 8, 10, 12); ctx.fillStyle = '#6f685b'; ctx.fillRect(sx + W - 21, sy - 7, 8, 10); ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ff8a2b' : '#ffd463'; ctx.fillRect(sx + W - 19, sy - 7, 4, 2); }
  if (b.kind === 'hall') for (const bx2 of [sx + 3, sx + W - 8]) { ctx.fillStyle = '#1a1210'; ctx.fillRect(bx2 - 1, sy + RH - 1, 7, 18); ctx.fillStyle = '#4f8fc7'; ctx.fillRect(bx2, sy + RH, 5, 16); ctx.fillStyle = '#e9c04f'; ctx.fillRect(bx2 + 2, sy + RH + 5, 1, 5); }
}
function renderVillage() {
  const [cx, cy] = camOffset();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(V.ground, -cx, -cy);
  const S = (x, y) => [Math.round(x - cx), Math.round(y - cy)];
  if (V.id === 'temple') drawStairs(S, G.save.stairs ? 1 : G.cutscene ? G.cutscene.open || 0 : 0, true);
  if (V.id === 'hall') drawStairs(S, 1, false);
  const shadow = (x, y, rx) => { const [sx, sy] = S(x, y); pxEllipse(sx, sy + 1, rx, Math.max(1, Math.round(rx / 2.6)), 'rgba(0,0,0,.3)'); };
  for (const n of V.npcs) shadow(n.x, n.y, 4);
  shadow(V.player.x, V.player.y, 5);
  const list = [];
  for (const b of V.buildings) list.push({ y: b.box.y + b.box.h, draw: () => { const [sx, sy] = S(b.box.x, b.box.y); drawBuilding(b, sx, sy); } });
  for (const o of V.props) list.push({ y: o.y + o.h / 2, draw: () => { const [sx, sy] = S(o.x, o.y); drawObstacle(o, sx, sy + o.h / 2); } });
  for (const n of V.npcs) list.push({ y: n.y, draw: () => {
    const [sx, sy] = S(n.x, n.y); drawSpr(n.sprite, 0, sx, sy, n.flip);
    if (n.id === 'herald' && (rankReady() || finaleReady())) { const by = sy - 24 - (Math.floor(G.time * 3) % 2); ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 2, by - 8, 5, 12); ctx.fillStyle = '#ebc152'; ctx.fillRect(sx - 1, by - 7, 3, 6); ctx.fillRect(sx - 1, by + 1, 3, 2); }
  } });
  list.push({ y: V.player.y, draw: () => drawPlayer(V.player, S) });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();
  drawParticlesAndText(S);
  const t = V.target;
  if (t && !G.dialog && !G.cutscene) {
    const [sx, sy] = S(t.x, t.y), top = sy - (t.kind === 'npc' ? 22 : t.kind === 'statue' ? (V.id === 'hall' ? 58 : 44) : t.kind === 'tgate' ? 52 : 26) - (Math.floor(G.time * 3) % 2);
    ctx.fillStyle = '#140d0b'; ctx.fillRect(sx - 3, top - 1, 7, 5); ctx.fillStyle = '#ebc152'; ctx.fillRect(sx - 2, top, 5, 1); ctx.fillRect(sx - 1, top + 1, 3, 1); ctx.fillRect(sx, top + 2, 1, 1);
  }
  tutDraw(S);
  if (V.night) {                                       // the Titans' hall is lit by braziers and your own torch
    const [px, py] = S(V.player.x, V.player.y - 6), g = ctx.createRadialGradient(px, py, 40, px, py, 230);
    g.addColorStop(0, 'rgba(10,6,20,.05)'); g.addColorStop(1, 'rgba(10,6,20,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (!vignette) vignette = makeVignette();
  ctx.drawImage(vignette, 0, 0);
}
// The stairway under the temple. open: 0 a carved slab, 1 a stairwell going down. down=false: the way back up, in the hall.
function drawStairs(S, open, down) {
  const x0 = down ? STAIRS.x : tc(20) - 8 - 24, y0 = down ? STAIRS.y : IPX.minY - 30, w = 48, h = down ? STAIRS.h : 34, [sx, sy] = S(x0, y0);
  if (down) {
    // the stairwell, seen from above: dark steps going down
    if (open > 0) {
      ctx.fillStyle = '#0b0706'; ctx.fillRect(sx, sy, w, h);
      for (let i = 0; i < 6; i++) { const yy = sy + 3 + i * 4.5, sh = Math.round(255 * (1 - i / 6) * .55); ctx.fillStyle = `rgb(${sh},${Math.round(sh * .9)},${Math.round(sh * .8)})`; ctx.fillRect(sx + 3 + i, Math.round(yy), w - 6 - i * 2, 2); }
      if (Math.floor(G.time * 2) % 2) { ctx.fillStyle = '#b48cff'; ctx.fillRect(sx + w / 2 - 1, sy + h - 6, 2, 2); }
    }
    // the slab slides north as it opens
    const off = Math.round(open * (h + 6)), slabY = sy - off;
    if (open < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(sx - 2, sy - h - 10, w + 4, h * 2 + 10); ctx.clip();
      ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 1, slabY - 1, w + 2, h + 2);
      ctx.fillStyle = '#c9bda4'; ctx.fillRect(sx, slabY, w, h); ctx.fillStyle = '#b5a98f'; ctx.fillRect(sx, slabY + h - 3, w, 3);
      ctx.fillStyle = '#a39782'; ctx.fillRect(sx + 4, slabY + 4, w - 8, 1); ctx.fillRect(sx + 4, slabY + h - 7, w - 8, 1);
      // a faint carving of a figure holding up the sky
      ctx.fillStyle = '#9a8e78'; ctx.fillRect(sx + w / 2 - 1, slabY + 12, 3, 8); ctx.fillRect(sx + w / 2 - 4, slabY + 10, 9, 1); pxRing(sx + w / 2, slabY + 7, 3, '#9a8e78', 1.5);
      ctx.restore();
    }
    ctx.fillStyle = '#8f8470'; ctx.fillRect(sx - 2, sy - 2, w + 4, 2); ctx.fillRect(sx - 2, sy + h, w + 4, 2); ctx.fillRect(sx - 2, sy, 2, h); ctx.fillRect(sx + w, sy, 2, h);
  } else {
    // the way back up: lit steps rising into the north wall
    ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    for (let i = 0; i < 7; i++) { const sh = 70 + i * 22; ctx.fillStyle = `rgb(${sh},${Math.round(sh * .92)},${Math.round(sh * .8)})`; ctx.fillRect(sx + i, sy + i * 5, w - i * 2, 5); ctx.fillStyle = '#2a1e19'; ctx.fillRect(sx + i, sy + i * 5 + 4, w - i * 2, 1); }
  }
}
// The hero as the forge shows them: drawn into a small canvas, scaled up crisp by CSS. The weapon is held the way it is in a hunt.
function drawPreview(canvas, equip, shieldId, weaponId) {
  const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, canvas.width, canvas.height);
  const fr = heroFrames(equip)[0], left = Math.round(canvas.width / 2 - fr.w / 2) - 2, top = canvas.height - 2 - fr.h;
  const w = WEAPONS[weaponId], kind = w.kind, sh = shieldId && KINDS[kind].oneHand ? SHIELDS[shieldId] : null;
  const dot = (px, py, col) => { x.fillStyle = col; x.fillRect(Math.round(px), Math.round(py), 1, 1); };
  const line = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col); };
  const hx = left + 10, hy = top + 14;                       // the front hand
  const tint = weaponTint(weaponId); weaponId = baseId(weaponId); const grip = (WEAPON_COLORS[weaponId] && WEAPON_COLORS[weaponId][2]) || '#8a5a34';
  if (sh) { const [a, b, c] = sh.colors; x.fillStyle = '#140d0b'; x.fillRect(left, top + 11, 6, 8); x.fillStyle = b; x.fillRect(left + 1, top + 12, 4, 6); x.fillStyle = a; x.fillRect(left + 1, top + 12, 3, 5); x.fillStyle = c; x.fillRect(left + 2, top + 14, 1, 2); }
  const back = kind === 'spear' || kind === 'bow';
  const weapon = () => {
    if (kind === 'sword') { line(hx, hy, hx + 4, hy - 9, tint || '#e9c04f'); line(hx - 1, hy - 1, hx + 2, hy, '#a8842a'); dot(hx + 4, hy - 9, '#fff3c0'); }
    else if (kind === 'spear') {
      line(hx, hy + 5, hx + 3, hy - 13, id(weaponId) === 'athena_spear' ? '#e9c04f' : grip); line(hx + 3, hy - 14, hx + 4, hy - 17, tint || '#c7ccd1');
      if (weaponId === 'trident' || weaponId === 'bident') { line(hx + 1, hy - 14, hx + 2, hy - 16, tint); if (weaponId === 'trident') line(hx + 5, hy - 14, hx + 6, hy - 16, tint); }
    }
    else if (kind === 'hammer') { line(hx, hy + 2, hx + 3, hy - 7, grip); const big = weaponId === 'cyclops_club' || weaponId === 'satyr_club'; for (let i = -3; i <= 3; i++) line(hx + 3 + i, hy - 8 - Math.round(i * .3), hx + 3 + i, hy - (big ? 12 : 11) - Math.round(i * .3), big ? (Math.abs(i) === 3 ? '#5a3a22' : '#8a5a34') : (Math.abs(i) === 3 ? '#636a72' : (tint && weaponId !== 'bull_maul' ? tint : '#a7adb3'))); }
    else if (kind === 'daggers') { const col = tint || '#c7ccd1'; line(hx, hy, hx + 3, hy - 4, col); line(left + 2, hy, left, hy - 4, col); }
    else if (kind === 'bow') { const col = tint || '#8a5a34'; for (let i = -6; i <= 6; i++) dot(hx + 3 - Math.round(Math.abs(i) * Math.abs(i) / 14), hy - 2 + i, col); line(hx + 1, hy - 8, hx + 1, hy + 4, '#f0e4cc'); }
  };
  const id = v => v;
  if (back) weapon();
  x.drawImage(fr.n, left, top);
  if (!back) weapon();
}


/* ============================== HUD ====================================== */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setHTML(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function hudMode(m) {
  for (const k in hudCache) delete hudCache[k];
  $('qhud').hidden = m !== 'quest'; $('vhud').hidden = m !== 'village'; $('hint').hidden = true; $('hint').classList.remove('tut'); $('goal').hidden = true;
  const r = m === 'quest' && q ? q.def.rank : G.save ? G.save.rank : 0, tag = $(m === 'quest' ? 'hudRank' : 'vRank');
  if (tag) { tag.hidden = !r; tag.dataset.rank = r; tag.textContent = r ? RANKS[r].name : ''; }
  $('prompt').hidden = true; $('dialog').hidden = true; $('banner').hidden = true;
  $('tAttack').textContent = m === 'village' ? 'Use' : 'Attack';
  const st = G.save ? playerStats() : null;
  $('tAbil').hidden = m === 'village' || !(st && st.weapon.ability);
  $('tGuard').hidden = m === 'village' || !(st && st.shield);
}
function hudReset() {
  $('lootFeed').innerHTML = ''; $('bossBar').hidden = true;
  const st = q.player.st, ab = st.weapon.ability;
  const key = a => touchMode ? '' : ` [${codeLabel(Input.bind[a][0])}]`;
  $('pipAbil').hidden = !ab; if (ab) $('abilName').textContent = ABILITIES[ab].name + key('ability');
  $('pipDodge').querySelector('b').textContent = 'Dash' + key('dodge');
  $('tAbil').hidden = !ab; $('tGuard').hidden = !st.shield;
  $('guardBar').hidden = !st.shield;
}
function updateHud() {
  const p = q.player;
  const frac = clamp(p.hp / p.st.maxHp, 0, 1), w = (frac * 100).toFixed(1) + '%';
  if (hudCache.hpW !== w) { hudCache.hpW = w; $('hpFill').style.width = w; $('hpGhost').style.width = w; }
  $('hpBar').classList.toggle('low', frac < .3);
  setText('hpText', `${Math.ceil(p.hp)} / ${p.st.maxHp}`);
  $('pipDodge').classList.toggle('cool', !canDash(p));
  const dl = 'Dash' + (maxDashes(p) > 1 ? ` ×${p.dashes}` : '') + (touchMode ? '' : ` [${codeLabel(Input.bind.dodge[0])}]`);
  if (hudCache.dl !== dl) { hudCache.dl = dl; $('pipDodge').querySelector('b').textContent = dl; }
  $('pipAbil').classList.toggle('cool', p.abilCd > 0);
  // cooldowns drain from the top of each pip
  const w2 = p.st.weapon, ab = w2.ability ? ABILITIES[w2.ability].cd * (1 - p.st.abilityCd) * (w2.cdMul || 1) : 1;
  const dc = (canDash(p) ? 0 : clamp(p.dodgeCd / dashRecharge(p), 0, 1) * 100).toFixed(0) + '%', ac = (clamp(p.abilCd / ab, 0, 1) * 100).toFixed(0) + '%';
  if (hudCache.dc !== dc) { hudCache.dc = dc; $('pipDodge').querySelector('u').style.height = dc; }
  if (hudCache.ac !== ac) { hudCache.ac = ac; $('pipAbil').querySelector('u').style.height = ac; }
  if (p.st.shield) { $('guardFill').style.width = (clamp(p.guard / p.st.guardMax, 0, 1) * 100).toFixed(1) + '%'; $('guardBar').classList.toggle('broken', p.guardBreak > 0); }
  const F = p.fx, tags = [];
  if (q.blessed) tags.push(['good', 'Blessed']);
  if (F.charm > 0) tags.push(['bad', 'Charmed']); if (F.confuse > 0) tags.push(['bad', 'Confused']); if (F.sleep > 0) tags.push(['bad', 'Asleep']);
  else if (F.drowsy > .4) tags.push(['bad', 'Drowsy']);
  if (F.slow > 0) tags.push(['bad', 'Slowed']); if (F.poison > 0) tags.push(['bad', 'Poisoned']); if (F.burn > 0) tags.push(['bad', 'Burning']);
  if (p.guardBreak > 0) tags.push(['bad', 'Guard broken']);
  if (F.riposte > 0) tags.push(['good', 'Riposte']); if (F.str > 0) tags.push(['good', `Strength ${Math.ceil(F.str)}s`]); if (F.spd > 0) tags.push(['good', `Double dash ${Math.ceil(F.spd)}s`]);
  if (F.frenzy > 0) tags.push(['good', 'Frenzy']); if (F.heart > 0) tags.push(['good', 'Heartsteal']); if (F.killRush > 0) tags.push(['good', 'Revel']);
  if (F.echo > 0) tags.push(['good', 'Echo']); if (F.foresight > 0 && p.foresightN > 0) tags.push(['good', `Foresight ${p.foresightN}`]); if (q.timeStop > 0) tags.push(['good', 'Time stopped']);
  if (p.st.perks.ward && p.wardT <= 0) tags.push(['good', 'Warded']);
  setHTML('statusRow', tags.map(([c, t]) => `<span class="st-tag ${c}">${t}</span>`).join(''));
  setText('hudLoot', String(Object.values(q.loot).reduce((a, b) => a + b, 0)));
  updatePotionBar(p);
  let wave = '';
  if (q.phase === 'boss') wave = '';
  else if (q.phase === 'victory') wave = 'Victory';
  else if (q.phase === 'defeat') wave = 'Defeated';
  else if (q.waveIdx >= 0) wave = `Wave ${Math.min(q.waveIdx + 1, q.def.waves.length)} / ${q.def.waves.length}` + (q.def.boss ? ' + boss' : '');
  else wave = q.def.name;
  setText('hudWave', wave);
  if (q.boss) {
    const bw = (clamp(q.boss.hp / q.boss.maxHp, 0, 1) * 100).toFixed(1) + '%';
    if (hudCache.bw !== bw) { hudCache.bw = bw; $('bossFill').style.width = bw; $('bossGhost').style.width = bw; }
    setText('bossTitle', q.boss.label || q.boss.def.title);
  }
  tickHint();
}
// Short hints for new hunters at the top of the screen.
let hintT = 0;
function showHint(html, t = 6) { const h = $('hint'); h.innerHTML = html; h.hidden = false; h.classList.remove('tut'); hintT = t; }
function tickHint() { if (hintT > 0) { hintT -= 1 / 60; if (hintT <= 0) $('hint').hidden = true; } }
function updateVillageHud() {
  setText('vMoney', fmtMoney(G.save.money));
  tickHint();
  const t = V.target, pr = $('prompt');
  if (t && !G.dialog && !G.cutscene) {
    const verb = t.kind === 'npc' ? 'Talk to' : t.kind === 'statue' ? 'Look at' : t.kind === 'board' ? 'Read' : t.kind === 'hearth' ? 'Visit' : t.kind === 'stairs' ? (t.goes === 'hall' ? 'Go down' : 'Go up') : t.kind === 'tgate' ? 'Open' : 'Enter';
    const html = `${touchMode ? '' : kbd(Input.bind.guard[0]) + ' '}${verb} ${esc(t.kind === 'npc' ? t.name : t.name.replace(/^The /, 'the '))}`;
    if (hudCache.prompt !== html) { hudCache.prompt = html; pr.innerHTML = html; }
    pr.hidden = false;
  } else pr.hidden = true;
}
let bannerTimer = 0;
function banner(main, sub = '', boss = false) {
  const b = $('banner'); b.hidden = true; void b.offsetWidth;
  $('bannerMain').textContent = main; $('bannerSub').textContent = sub; b.classList.toggle('boss', boss); b.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, 2200);
}
function feed(item) {
  const box = $('lootFeed'), last = box.lastElementChild;
  if (last && last.dataset.item === item && !last.classList.contains('out')) {
    const n = +last.dataset.n + 1; last.dataset.n = n; last.querySelector('b').textContent = '+' + n;
    clearTimeout(+last.dataset.timer); last.dataset.timer = setTimeout(() => fadeFeed(last), 2400);
    return;
  }
  const el = document.createElement('div'); el.className = 'feed'; el.dataset.item = item; el.dataset.n = 1;
  el.innerHTML = `<img alt="" src="${icon(item)}"><span class="r${ITEMS[item].rarity}">${esc(ITEMS[item].name)}</span><b>+1</b>`;
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  el.dataset.timer = setTimeout(() => fadeFeed(el), 2400);
}
function fadeFeed(el) { el.classList.add('out'); setTimeout(() => el.remove(), 450); }

