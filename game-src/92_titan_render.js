/* ---- Titans: bodies, the things they hold, and what their attacks look like ---- */
function drawGlobe(cx, cy, r, t, alpha = 1) {
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  pxEllipse(cx, cy, r + 1, r + 1, '#0a0d1e'); pxEllipse(cx, cy, r, r, '#1e2a5a'); pxEllipse(cx - 2, cy - 2, r - 3, r - 3, '#2c3a78');
  const R = mulberry(7);
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2 + t * .4, d = R() * (r - 2); ctx.fillStyle = R() < .3 ? '#ffd463' : '#ffffff'; ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * .9), 1, 1); }
  ctx.fillStyle = '#e9c04f'; for (let a = 0; a < Math.PI * 2; a += .12) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .32 + Math.cos(a) * 2), 1, 1);
  ctx.fillStyle = '#a8842a'; for (let yy = -r; yy <= r; yy += 2) ctx.fillRect(Math.round(cx + Math.sin(t * .8) * Math.sqrt(Math.max(0, r * r - yy * yy)) * .4), Math.round(cy + yy), 1, 1);
  ctx.globalAlpha = 1;
}
function drawSickle(cx, cy, a, r, col = '#d5dbe5') {
  for (let k = -1.3; k <= 1.3; k += .12) { const x = cx + Math.cos(a + k) * r, y = cy + Math.sin(a + k) * r; ctx.fillStyle = OUTLINE; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
  for (let k = -1.3; k <= 1.3; k += .12) { const x = cx + Math.cos(a + k) * r, y = cy + Math.sin(a + k) * r; ctx.fillStyle = Math.abs(k) > 1 ? '#ffffff' : col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
}
function drawHourglass(cx, cy, frac) {
  ctx.fillStyle = OUTLINE; ctx.fillRect(cx - 5, cy - 8, 11, 17);
  ctx.fillStyle = '#a8842a'; ctx.fillRect(cx - 4, cy - 7, 9, 2); ctx.fillRect(cx - 4, cy + 6, 9, 2);
  // glass: wide at the ends, narrow in the middle
  const W = [7, 5, 3, 1, 1, 3, 5, 7];
  W.forEach((w, i) => { ctx.fillStyle = '#d8e6f0'; ctx.fillRect(cx - (w >> 1), cy - 5 + i + (i > 3 ? 1 : 0), w, 1); });
  // sand: the top half drains as time runs out
  const top = Math.round(4 * frac);
  ctx.fillStyle = '#e9c04f';
  for (let i = 4 - top; i < 4; i++) ctx.fillRect(cx - (W[i] >> 1), cy - 5 + i, W[i], 1);
  for (let i = 4 + top; i < 8; i++) ctx.fillRect(cx - (W[i] >> 1), cy - 4 + i, W[i], 1);
  if (blink(8) && frac > 0) ctx.fillRect(cx, cy - 1, 1, 3);
}
// What each Titan holds or wears beyond the body. 'back' draws behind the sprite, 'front' in front.
function drawTitanProps(b, sx, sy, layer, fr) {
  const t = G.time, top = sy - fr.h + 1, d = b.flip ? -1 : 1, raised = b.frame === 2;
  const handY = top + (TITAN_SPR[b.type].base === 'bare' ? 25 : 21), handX = sx + d * 12;
  switch (b.type) {
    case 'atlas':
      if (layer === 'front' && (b.globe || b.state === 'reform')) {
        const pull = b.state === 'throwAim' ? (b.st < b.lockAt ? 6 : 3) : 0;
        drawGlobe(sx - Math.cos(b.aim || 0) * pull, top - 9, 12, t, b.state === 'reform' ? 1 - b.st : 1);
        if (b.state === 'throwAim' && blink(10)) pxRing(sx, top - 9, 14, '#ffd463', 2);
      }
      break;
    case 'hyperion': {
      if (layer === 'back') {
        const hx = sx, hy = top + 7, glow = b.state === 'flare' ? 1 - b.st / (b.flareMax || 2) : 0, n = 12;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + t * .6, l = 9 + 3 * Math.sin(t * 5 + i) + glow * 10; pxLine(hx + Math.cos(a) * 8, hy + Math.sin(a) * 8, hx + Math.cos(a) * (8 + l), hy + Math.sin(a) * (8 + l), i % 2 ? '#ffd463' : '#ff8a2b'); }
        if (glow > 0) { ctx.globalAlpha = .25 + glow * .35; pxEllipse(sx, top + 18, 18 + glow * 14, 22 + glow * 14, '#fff6d8'); ctx.globalAlpha = 1; }
      }
      break;
    }
    case 'oceanus':
      if (layer === 'back') { pxRingFlat(sx, sy, 15 + Math.sin(t * 3) * 2, '#57c2b0', 2); pxRingFlat(sx, sy, 19 + Math.sin(t * 3 + 1) * 2, '#bfe8f0', 3); }
      else { const hx = raised ? sx + d * 10 : handX, hy = raised ? top + 1 : handY; pxLine(hx, hy + 12, hx, hy - 22, '#8a5a34'); const tp = hy - 22; for (const o of [-3, 0, 3]) pxLine(hx + o, tp - (o ? 4 : 6), hx + o, tp, '#57c2b0'); pxLine(hx - 3, tp, hx + 3, tp, '#e9c04f'); }
      break;
    case 'coeus': {
      if (layer !== 'front') break;
      const hx = handX, hy = handY; pxLine(hx, hy + 14, hx, hy - 26, '#d5dbe5');
      const a = t * 2.4, ox = hx + Math.cos(a) * 6, oy = hy - 28 + Math.sin(a) * 3; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ox) - 1, Math.round(oy), 3, 1); ctx.fillRect(Math.round(ox), Math.round(oy) - 1, 1, 3);
      if (b.readT > 0) { pxEllipse(sx, top + 2, 2, 2, OUTLINE); ctx.fillStyle = blink(8) ? '#ffffff' : '#5b9bd5'; ctx.fillRect(sx - 1, top + 1, 2, 2); }
      break;
    }
    case 'mnemosyne':
      if (layer !== 'front') break;
      for (let i = 0; i < 4; i++) { const a = t * 1.4 + i * Math.PI / 2, x = sx + Math.cos(a) * 18, y = top + 10 + Math.sin(a) * 6; ctx.fillStyle = OUTLINE; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4); ctx.fillStyle = i % 2 ? '#c8b8ff' : '#ffffff'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
      break;
    case 'themis': {
      if (layer !== 'front') break;
      const lx = sx - d * 12, ly = raised ? top + 2 : handY - 2, tip = b.law ? Math.sin(t * 3) * 2 : 0, gold = b.law ? (blink(6) ? '#ffffff' : '#ffd463') : '#e9c04f';
      pxLine(lx - 7, ly - 1 + tip, lx + 7, ly - 1 - tip, gold);
      for (const s of [-1, 1]) { const px = lx + s * 7, py = ly - 1 - s * tip; pxLine(px, py, px, py + 6, '#c2b293'); pxLine(px - 3, py + 7, px + 3, py + 7, gold); pxLine(px - 2, py + 8, px + 2, py + 8, gold); }
      const hx = sx + d * 12, hy = handY; pxLine(hx, hy + 2, hx + d * 2, hy - 14, '#f3e9d4'); pxLine(hx - 2, hy + 1, hx + 2, hy + 1, '#e9c04f');
      break;
    }
    case 'rhea':
      if (layer === 'front' && !raised) { const bx = sx + d * 3, by = top + 18; pxEllipse(bx, by, 5, 4, OUTLINE); pxEllipse(bx, by, 4, 3, '#d8ceb7'); ctx.fillStyle = '#a39a86'; ctx.fillRect(bx - 3, by, 7, 1); }
      break;
    case 'cronus': {
      if (layer === 'front') {
        const sweeping = b.state === 'sweepAim', a = sweeping ? (b.aim || 0) + (b.st < .3 ? 0 : -1.4) : (b.flip ? Math.PI + .9 : -.9);
        const hx = sweeping ? sx + Math.cos(b.aim || 0) * 8 : handX, hy = sweeping ? top + 20 : handY;
        if (!b.sickleOut || b.state !== 'recover') { pxLine(hx, hy + 6, hx + Math.cos(a) * 18, hy + Math.sin(a) * 18 - 6, '#5a3a22'); drawSickle(hx + Math.cos(a) * 22, hy + Math.sin(a) * 22 - 6, a + Math.PI / 2 * d, 8); }
        if (b.hg) drawHourglass(Math.round(sx), Math.round(top - 10), clamp(b.hg.t / b.hg.max, 0, 1));
      }
      break;
    }
  }
}
// Titans are drawn into a small buffer at normal size, then doubled, like the other giants.
const TITAN_SCALE = 2, TBUF = mkCanvas(110, 120), TBX = TBUF.getContext('2d'); TBX.imageSmoothingEnabled = false;
function drawTitan(b, X, Y) {
  if (b.hidden) return;
  const main = ctx; ctx = TBX; TBX.clearRect(0, 0, TBUF.width, TBUF.height);
  try { drawTitanBody(b, 55, 100); } finally { ctx = main; }
  ctx.drawImage(TBUF, Math.round(X - 55 * TITAN_SCALE), Math.round(Y - 100 * TITAN_SCALE), TBUF.width * TITAN_SCALE, TBUF.height * TITAN_SCALE);
}
function drawTitanBody(b, sx, sy) {
  const frames = rankFrames(b.def.sprite, b.rank), moving = b.walking && Math.hypot(b.vx, b.vy) > 5;
  const fi = b.frame === 2 ? 2 : moving ? Math.floor(b.walkT * 3.5) % 2 : 0;
  const tint = b.flash > 0 ? 'white' : b.state === 'enrage' && blink(12) ? 'gold' : null, fr = frames[fi];
  const bob = moving ? 0 : Math.round(Math.sin(G.time * 2) * .6);
  drawTitanProps(b, sx, sy - bob, 'back', fr);
  drawSpr(frames, fi, sx, sy - bob, b.flip, tint, b.alpha);
  drawTitanProps(b, sx, sy - bob, 'front', fr);
  if (b.vuln > 0) for (let i = 0; i < 4; i++) { const a = G.time * 4 + i * 1.57, x = Math.round(sx + Math.cos(a) * 12), y = Math.round(sy - fr.h - 2 + Math.sin(a) * 2); ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ebc152'; ctx.fillRect(x, y, 1, 1); }
}
// Telegraphs that belong only to the Titans.
function drawTitanTelegraph(b, S, sx, sy) {
  const st = b.state;
  if (st === 'throwAim') { const len = raycast(b.x, b.y, b.aim, 500, 14), col = b.st < b.lockAt ? '#ff5a3c' : blink(16) ? '#9fb8ff' : '#3c4a78'; for (const o of [-6, 0, 6]) pxLine(sx - Math.sin(b.aim) * o, sy + Math.cos(b.aim) * o, sx + Math.cos(b.aim) * len - Math.sin(b.aim) * o, sy + Math.sin(b.aim) * len + Math.cos(b.aim) * o, col, o ? 3 : 0); }
  if (st === 'stomp' || st === 'quake') pxRingFlat(sx, sy, 8 + (1 - b.st / .9) * 26, blink(16) ? '#ff5a3c' : '#ebc152', 2);
  if (st === 'beamsAim' && b.beams) {
    const B = b.beams;
    for (let i = 0; i < B.n; i++) { const a = B.a + i / B.n * Math.PI * 2, len = raycast(b.x, b.y, a, 360, 12) + 12; pxLine(sx, sy - 6, sx + Math.cos(a) * len, sy - 6 + Math.sin(a) * len, blink(14) ? '#ffffff' : '#ffd463', 3);
      const a2 = a + B.dir * .3; arrowHead(sx + Math.cos(a2) * 34, sy - 6 + Math.sin(a2) * 34, a2 + B.dir * Math.PI / 2, '#ff5a3c'); }
  }
  if (st === 'waves' || st === 'proclaim' || st === 'echo' || st === 'wrap') pxRingFlat(sx, sy, 10 + (Math.sin(G.time * 10) + 1) * 4, blink(16) ? '#ffffff' : b.def.colors[0], 2);
  if (st === 'recall') { const p = q.player, [px, py] = S(p.x, p.y), k = 1 - b.st / 1.15; pxRingFlat(px, py, 16 - k * 8, blink(12) ? '#ffffff' : '#c8b8ff', 1.5); }
  if (st === 'sweepAim') {
    const locked = b.st < .3, col = locked ? '#ff5a3c' : blink(14) ? '#ebc152' : '#cf6a2f';
    ctx.globalAlpha = .22; for (let r = 8; r < 78; r += 3) for (let k = -1.15; k <= 1.15; k += 6 / r) { ctx.fillStyle = '#d9493b'; ctx.fillRect(Math.round(sx + Math.cos(b.aim + k) * r), Math.round(sy + Math.sin(b.aim + k) * r * .7), 2, 2); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = col; for (let k = -1.15; k <= 1.15; k += .03) ctx.fillRect(Math.round(sx + Math.cos(b.aim + k) * 78), Math.round(sy + Math.sin(b.aim + k) * 78 * .7), 1, 1);
    for (const k of [-1.15, 1.15]) pxLine(sx, sy, sx + Math.cos(b.aim + k) * 78, sy + Math.sin(b.aim + k) * 78 * .7, col, 2);
  }
}
// Things on the arena floor during a Titan fight: the river's current, Hyperion's light and shadows, Mnemosyne's echoes.
function drawTitanWorld(S) {
  const b = q.boss; if (!b || b.dead) return;
  if (b.type === 'oceanus' && q.current) {
    const C = q.current, ca = Math.cos(C.a), sa = Math.sin(C.a), R = mulberry(3), sp = C.s * 2.2;
    ctx.globalAlpha = .4; ctx.fillStyle = '#bfe8f0';
    for (let i = 0; i < 46; i++) {
      const bx = R() * (VIEW_W + 40), by = R() * (VIEW_H + 40), off = (G.time * sp + R() * 400);
      const x = ((bx + ca * off) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20, y = ((by + sa * off) % (VIEW_H + 40) + VIEW_H + 40) % (VIEW_H + 40) - 20;
      for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(x - ca * k), Math.round(y - sa * k), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (C.next !== null) { const p = q.player, [px, py] = S(p.x, p.y - 26); for (let i = -1; i <= 1; i++) arrowHead(px + Math.cos(C.next) * (8 + i * 6), py + Math.sin(C.next) * (8 + i * 6) * .6, C.next, blink(8) ? '#ffffff' : '#57c2b0'); }
  }
  if (b.type === 'hyperion' && b.state === 'flare') {                 // shadows behind the obelisks show where it's safe
    const k = 1 - b.st / (b.flareMax || 2);
    ctx.fillStyle = `rgba(255,246,216,${.08 + k * .3})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(20,12,30,.55)';
    for (const bx of q.world.boxes) {
      const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2, a = Math.atan2(cy - b.y, cx - b.x), far = 520;
      const corners = [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x + bx.w, bx.y + bx.h], [bx.x, bx.y + bx.h]];
      // the two corners that stick out most to each side, seen from Hyperion
      let lo = null, hi = null, loA = 9, hiA = -9;
      for (const c of corners) { const d = angDiff(a, Math.atan2(c[1] - b.y, c[0] - b.x)); if (d < loA) { loA = d; lo = c; } if (d > hiA) { hiA = d; hi = c; } }
      const ex = (c, ang) => [c[0] + Math.cos(ang) * far, c[1] + Math.sin(ang) * far];
      const pts = [lo, hi, ex(hi, Math.atan2(hi[1] - b.y, hi[0] - b.x)), ex(lo, Math.atan2(lo[1] - b.y, lo[0] - b.x))].map(([x, y]) => S(x, y));
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const pt of pts.slice(1)) ctx.lineTo(pt[0], pt[1]); ctx.closePath(); ctx.fill();
    }
  }
  if (b.type === 'hyperion' && b.state === 'beams' && b.beams) {
    const B = b.beams, [sx, sy] = S(b.x, b.y);
    for (let i = 0; i < B.n; i++) {
      const a = B.a + i / B.n * Math.PI * 2, len = raycast(b.x, b.y, a, 360, 12) + 12;
      for (let o = -2; o <= 2; o++) { const nx = -Math.sin(a) * o, ny = Math.cos(a) * o; pxLine(sx + nx, sy - 6 + ny, sx + nx + Math.cos(a) * len, sy - 6 + ny + Math.sin(a) * len, Math.abs(o) === 2 ? '#ff8a2b' : Math.abs(o) === 1 ? '#ffd463' : '#ffffff'); }
    }
  }
}
function drawGhost(gh, S) {
  const [sx, sy] = S(gh.x, gh.y), a = gh.clock < 0 ? .25 + (gh.clock + .6) / .6 * .25 : .55;
  drawSpr(heroFrames(q.player.look), Math.floor(G.time * 8) % 2, sx, sy, Math.cos(gh.face) < 0, 'white', a);
  if (Math.random() < .3) sc.parts.push({ x: gh.x + rand(-4, 4), y: gh.y - rand(2, 14), vx: 0, vy: -14, g: 0, life: .4, max: .4, c: '#c8b8ff', s: 1 });
}
