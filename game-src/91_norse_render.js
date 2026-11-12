/* ============================== THE NORTH: drawing ============================== */
// What the North's gods hold, its shots and strikes, Fenrir and his chain, and the dark of Ragnarök. 90_render.js calls in
// through HELD_ART (drawHeld), BOSS_DRAW (drawBoss), norseTelegraph (drawBossTelegraph), PROJ_DRAW (drawProj), FX_DRAW
// (the effects loop), drawRavens (drawPlayer) and drawRagnarok (drawWeather).
Object.assign(GOD_HELD, { heimdall: ['sword', '#ffd463'], freyja: ['staff', '#ffb347'], tyr: ['sword', '#d5dbe5'], loki: ['flame', '#7fe08a'], thor: ['hammer', '#9aa0a6'], odin: ['spear', '#9fd0ff'] });
Object.assign(PROJ_COL, { seidr: ['#b58fd6', '#6b4a8a'], lokifire: ['#7fe08a', '#2f8a4a'], rune: ['#9fd0ff', '#1a2442'], frost: ['#cdeeff', '#5b9bd5'] });
const HELD_ART = {
  // Freyja's seidr staff, an amber stone at the top that glows
  staff(hx, hy, d, up, col) {
    pxLine(hx, hy + 8, hx, hy - 12 + up, '#8a5a34'); const t = hy - 13 + up;
    pxEllipse(hx, t, 2, 2, OUTLINE); pxEllipse(hx, t, 1, 1, blink(6) ? '#fff0b0' : col);
    if (Math.random() < .2) sc.parts.push({ x: hx + G.cam.x + rand(-2, 2), y: t + G.cam.y, vx: 0, vy: -10, g: 0, life: .5, max: .5, c: col, s: 1 });
  },
  // Loki: a green flame that burns in his open hand
  flame(hx, hy, d, up, col) {
    const R = mulberry(Math.floor(G.time * 12));
    for (let i = 0; i < 6; i++) { const fx = hx - 2 + R() * 4, fh = 1 + R() * 5; ctx.fillStyle = R() < .4 ? '#e6ffe0' : R() < .7 ? col : '#2f8a4a'; ctx.fillRect(Math.round(fx), Math.round(hy - 2 + up - fh), 1, Math.round(fh)); }
  },
};
const PROJ_DRAW = {
  raven(pr, sx, y) {
    const up = Math.floor(pr.t * 12) % 2, f = pr.vx < 0 ? -1 : 1, x = Math.round(sx), yy = Math.round(y);
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 4, yy - 2, 9, 4);
    ctx.fillStyle = pr.team === 'enemy' ? '#1f1f24' : '#3a3a44'; ctx.fillRect(x - 3, yy - 1, 7, 2); ctx.fillRect(x - 4, yy - (up ? 2 : 0), 2, 1); ctx.fillRect(x + 3, yy - (up ? 2 : 0), 2, 1);
    ctx.fillStyle = '#4b4f57'; ctx.fillRect(x + f * 4, yy, 1, 1); ctx.fillStyle = '#9fd0ff'; ctx.fillRect(x + f * 2, yy - 1, 1, 1);
  },
  axe(pr, sx, y) {                                          // a hand-axe turning over and over
    const a = pr.t * 14, ca = Math.cos(a), sa = Math.sin(a), hx = sx + ca * 3, hy = y + sa * 3;
    pxLine(sx - ca * 4, y - sa * 4, hx, hy, '#8a5a34'); pxEllipse(hx, hy, 2, 2, OUTLINE); ctx.fillStyle = '#c7ccd1'; ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2);
  },
  gungnir(pr, sx, y, a) {                                   // the spear that never misses, point first, trailing light
    const ca = Math.cos(a), sa = Math.sin(a);
    ctx.globalAlpha = .35; pxEllipse(sx, y, 6, 4, '#9fd0ff'); ctx.globalAlpha = 1;
    pxLine(sx - ca * 10, y - sa * 10 + 1, sx + ca * 4, y + sa * 4 + 1, OUTLINE); pxLine(sx - ca * 10, y - sa * 10, sx + ca * 4, y + sa * 4, '#d5dbe5'); pxLine(sx + ca * 4, y + sa * 4, sx + ca * 8, y + sa * 8, '#ffffff');
    if (Math.random() < .6) sc.parts.push({ x: pr.x - Math.cos(a) * 6, y: pr.y - 6, vx: 0, vy: 0, g: 0, life: .25, max: .25, c: '#9fd0ff', s: 1 });
  },
  likeness(pr, sx, y, a, sy) { drawSpr(heroFrames(pr.look), Math.floor(pr.t * 8) % 2, sx, sy + 1, pr.vx < 0, null, .55); if (Math.random() < .3) sc.parts.push({ x: pr.x + rand(-4, 4), y: pr.y - rand(4, 14), vx: 0, vy: -12, g: 0, life: .35, max: .35, c: '#7fe08a', s: 1 }); },
  spiritwolf(pr, sx, y, a, sy) { drawSpr(SPR.freki, Math.floor(pr.t * 8) % 2, sx, sy + 1, pr.vx < 0, 'white', .5); if (Math.random() < .4) sc.parts.push({ x: pr.x + rand(-6, 6), y: pr.y - rand(2, 8), vx: 0, vy: -8, g: 0, life: .4, max: .4, c: '#cdeeff', s: 1 }); },
};
// Mjölnir in flight (a thrown trident under the hood, 51_norse_combat.js): the head turning over, sparks coming off it.
function drawHammerProj(pr, sx, y) {
  const a = pr.t * 16, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  pxLine(sx - ca * 5, y - sa * 5, sx + ca * 2, y + sa * 2, '#6b4528');
  for (let s = -3; s <= 3; s++) pxLine(sx + ca * 2 + nx * s, y + sa * 2 + ny * s, sx + ca * 6 + nx * s, y + sa * 6 + ny * s, Math.abs(s) === 3 ? '#4b4f57' : '#9aa0a6');
  if (Math.random() < .6) sc.parts.push({ x: pr.x + rand(-3, 3), y: pr.y - 6 + rand(-3, 3), vx: rand(-20, 20), vy: rand(-20, 20), g: 0, life: .2, max: .2, c: Math.random() < .5 ? '#57c2b0' : '#ffffff', s: 1 });
}
const FX_DRAW = {
  // Tyr's sword strokes: a clean white line with a steel edge
  laneSlash(f, S) {
    const [ax, ay] = S(f.x0, f.y0), [bx, by] = S(f.x1, f.y1), k = f.life / f.max;
    ctx.globalAlpha = clamp(k * 1.6, 0, 1); pxLine(ax, ay, bx, by, '#ffffff'); pxLine(ax, ay + 1, bx, by + 1, f.col || '#d5dbe5'); ctx.globalAlpha = 1;
  },
  // Hofund's skill: the rainbow bridge, seven colours side by side
  rainbow(f, S) {
    const [ax, ay] = S(f.x0, f.y0), [bx, by] = S(f.x1, f.y1), a = Math.atan2(by - ay, bx - ax), nx = -Math.sin(a), ny = Math.cos(a);
    ctx.globalAlpha = clamp(f.life / f.max * 1.6, 0, 1);
    RAINBOW.forEach((c, i) => { const o = i - 3; pxLine(ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o, c); });
    ctx.globalAlpha = 1;
  },
};
// The Allfather's two ravens, circling at head height (they're away for a moment after they strike).
function drawRavens(p, sx, sy) {
  if ((p.ravenT || 0) < .6 && q) return;
  for (let i = 0; i < 2; i++) {
    const a = G.time * 3 + i * Math.PI, x = Math.round(sx + Math.cos(a) * 10), y = Math.round(sy - 24 + Math.sin(a) * 3), up = Math.floor(G.time * 10 + i) % 2;
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 3, y - 1, 7, 3);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 3, y - (up ? 1 : 0), 1, 1); ctx.fillRect(x + 3, y - (up ? 1 : 0), 1, 1);
    ctx.fillStyle = '#9fd0ff'; ctx.fillRect(x + (Math.cos(a + Math.PI / 2) > 0 ? 1 : -1), y, 1, 1);
  }
}
// Fenrir, twice as big as anything else in the North, and while it holds, the silk ribbon running from the middle of the
// ring of stones to his neck.
const BOSS_DRAW = {
  fenrir(b, sx, sy, tint) {
    const lift = Math.round(b.z || 0), moving = b.state === 'idle' && Math.hypot(b.vx, b.vy) > 5, fi = moving ? Math.floor(b.walkT * 6) % 2 : 0;
    const crouch = /Aim$/.test(b.state) ? 2 : 0, lunge = b.state === 'bite' || b.state === 'charge' || b.state === 'devour';
    pxEllipse(sx, sy + 1, 22, 5, 'rgba(0,0,0,.3)');
    if (b.stage === 'bound' && b.grx) {
      const ax = sx + (b.gcx - b.x), ay = sy + (b.gcy - b.y), nx = sx + (b.flip ? -14 : 14), ny = sy - 16 - lift + crouch;
      pxEllipse(ax, ay, 4, 2, OUTLINE); pxEllipse(ax, ay - 1, 3, 2, '#6a6a72');
      pxLine(ax, ay - 2, nx, ny, '#9fd0ff'); pxLine(ax, ay - 3, nx, ny - 1, '#f2f7fb');
    }
    drawSpr(SPR.fenrir, fi, sx, sy - lift + crouch, b.flip, lunge ? 'gold' : tint, b.alpha, 2);
    if (b.stage === 'ragnarok' && Math.random() < .5) sc.parts.push({ x: b.x + (b.flip ? -18 : 18) + rand(-2, 2), y: b.y - 22 - lift, vx: rand(-6, 6), vy: rand(-20, -8), g: 0, life: .4, max: .4, c: Math.random() < .5 ? '#ff5a3c' : '#ffd463', s: 1 });
    else if (Math.random() < .15) sc.parts.push({ x: b.x + rand(-20, 20), y: b.y - rand(4, 26), vx: 0, vy: -10, g: 0, life: .5, max: .5, c: '#cdeeff', s: 1 });
  },
};
// Telegraphs the shared drawing doesn't know: Fenrir's lunges and pounces, the edge of Gleipnir's reach.
function norseTelegraph(b, S, sx, sy) {
  const st = b.state;
  if (b.type !== 'fenrir') return;
  if (b.stage === 'bound' && b.grx) { const [cx, cy] = S(b.gcx, b.gcy); pxRingDots(cx, cy, b.grx + 1, b.gry / b.grx, '#2c5684', 3); pxRingDots(cx, cy, b.grx, b.gry / b.grx, '#9fd0ff', 3); }   // how far Gleipnir lets him reach
  if ((st === 'biteAim' || st === 'chargeAim' || st === 'devourAim') && b.dashEnd) {
    const [ex, ey] = S(b.dashEnd.x, b.dashEnd.y), col = b.st < .3 ? '#ff5a3c' : (blink(16) ? '#ebc152' : '#cf6a2f');
    pxLine(sx, sy, ex, ey, col); pxLine(sx, sy + 1, ex, ey + 1, col); pxRing(ex, ey, 6, col);
  }
  if (st === 'pounceAim' || st === 'pounce') {
    const [tx, ty] = S(b.tx, b.ty), k = st === 'pounce' ? 1 : clamp(1 - b.st / .6, 0, 1);
    pxEllipse(tx, ty, Math.round(30 * k), Math.round(30 * k * .55), 'rgba(217,73,59,.28)'); pxRingFlat(tx, ty, 30, blink(14) ? '#ff5a3c' : '#ebc152', 2);
  }
  if (st === 'howl' || st === 'claw') pxRingFlat(sx, sy, 8 + (1 - b.st / .7) * 20, blink(16) ? '#9fd0ff' : '#ffffff', 2);
}
// Ragnarök: the sun is gone. Everything goes dark red, and ash comes down.
function drawRagnarok(S) {
  ctx.fillStyle = 'rgba(48,4,2,.42)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (Math.floor(G.time * 1.3) % 7 === 0 && Math.random() < .05) G.flash = Math.max(G.flash, .05);                    // far-off fire lights the sky now and then
  if (Math.random() < .6) sc.parts.push({ x: G.cam.x + rand(-10, VIEW_W + 30), y: G.cam.y - 4, vx: rand(-12, -2), vy: rand(14, 26), g: 0, life: 8, max: 8, c: Math.random() < .5 ? '#5a4a4a' : Math.random() < .5 ? '#ff8a2b' : '#2a2224', s: 1 });
}
