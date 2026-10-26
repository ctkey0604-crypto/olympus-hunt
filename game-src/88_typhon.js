/* ============================== TYPHON: art, arena and fight ============================== */
// Seen from above like everything else: a horned giant rising out of a serpent's coils, bat wings spread behind him,
// six serpent heads swaying on long necks from his shoulders. His rule: when the heads burst out of the ground he is
// shielded until every one of them has been cut down, and then he reels.
{
  const pal = Object.assign({}, PAL, { a: '#2a1c18', A: '#160e0c', s: '#6b7a4a', S: '#45512f', T: '#2e3822', k: '#ff5a3c', m: '#8a2a16', M: '#5a180c',
                                       d: '#2a1c18', c: '#55643c', C: '#3a4528', h: '#3a3036', H: '#1a1416', e: '#ff8a2b', E: '#ffd463' });
  // horns, a burning mouth, a dark band at the waist where his body turns into the serpent
  const look = { '0': '..h____________________h..', '1': '..Hh__________________hH..', '2': '...Hh________________hH...', '3': '....hH_____________Hh.....',
                 '8': '__________seeees__________', '22': '_____dddddddddddddddd_____',
                 '27': '.......CccccccccccC.......', '28': '........CccccccccC........' };
  const body = rows => patchRows(rows, look).slice(0, 29);
  SPR.typhon = [body(TITAN_BASE.bare), body(TITAN_BASE.bare), body(patchRows(TITAN_BASE.bare, TITAN_RAISE.bare))].map(r => frameOf(r, pal));
  SPR.typhonhead = buildFrames(SPRITE_DATA.python, Object.assign({}, PAL, { g: '#8a9a5e', G: '#55643c', y: '#ff8a2b' }));
}
// He is a little bigger than the biggest Titan.
BOSSES.typhon.hits *= 1.3;
{ const cr = QUEST_BY_ID[rid('cronus_hunt', 2)], ty = QUEST_BY_ID[TYPHON_Q]; ty.reward = Math.round(cr.reward * 1.5 / 100) * 100; ty.stars = 10; }

Object.assign(THEMES, {
  etna: { floor: 'rock', base: '#2e1c18', shades: ['#281814', '#36221c', '#221410', '#3c2820'], crack: '#120604', pebble: '#4a2e26', lava: 64,
          border: 'cliff', rockBase: '#0e0604', rocks: ['#2a1410', '#341a14', '#22100c', '#3e2018'], rockHi: '#6a2a1a', weather: 'embers' },
});
ARENAS.etna = { name: 'Heart of Etna', theme: 'etna', wt: 56, ht: 36,
  obstacles: [['boulder', 11, 9], ['boulder', 44, 9], ['boulder', 11, 27], ['boulder', 44, 27], ['rock', 19, 17], ['rock', 36, 18], ['brazier', 22, 7], ['brazier', 33, 7], ['brazier', 22, 29], ['brazier', 33, 29]],
  secret: { x: 41, y: 1, w: 3, h: 2, chest: [42, 1], hint: 'In the heart of Etna, the north wall on the right has cooled into a hollow. Walk into it.' } };

/* ---- drawing ---- */
function pxTri(x0, y0, x1, y1, x2, y2, col) {
  const P = [[x0, y0], [x1, y1], [x2, y2]].map(([x, y]) => [Math.round(x), Math.round(y)]).sort((a, b) => a[1] - b[1]);
  const at = (a, c, y) => a[1] === c[1] ? a[0] : a[0] + (c[0] - a[0]) * (y - a[1]) / (c[1] - a[1]);
  ctx.fillStyle = col;
  for (let y = P[0][1]; y <= P[2][1]; y++) {
    const xa = at(P[0], P[2], y), xb = y < P[1][1] ? at(P[0], P[1], y) : at(P[1], P[2], y);
    const l = Math.round(Math.min(xa, xb)), r = Math.round(Math.max(xa, xb)); ctx.fillRect(l, y, r - l + 1, 1);
  }
}
const TY_LIFT = 7;                                           // he sits up on his coils
function typhonTop(sy) { return sy - TY_LIFT - SPR.typhon[0].h + 1; }
// The six heads: three on each shoulder, swaying. In buffer coordinates (the body is drawn at half size, then doubled).
function typhonHeads(b, sx, top) {
  const t = G.time, hot = b.state === 'breathAim' || b.state === 'breath' || b.state === 'volley' || b.state === 'summonHeads', out = [];
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, k = i % 3, bx = sx + s * (6 + k * 2), by = top + 12 + k * 2;
    const a = -Math.PI / 2 + s * (.5 + k * .52) + Math.sin(t * 1.6 + i * 1.3) * .14, L = 14 + k * 3 + (hot ? 4 : 0);
    out.push({ s, bx, by, hx: bx + Math.cos(a) * L, hy: by + Math.sin(a) * L * .9, a });
  }
  return out;
}
function typhonHeadWorld(b, i) {
  const h = typhonHeads(b, 55, typhonTop(100))[i];
  return { x: b.x + (h.hx - 55) * TITAN_SCALE, y: clamp(b.y + (h.hy - 100) * TITAN_SCALE, IPX.minY + 6, IPX.maxY - 6) };
}
function typhonWings(b, sx, top) {
  const gale = b.state === 'gale' || b.state === 'galeAim', flap = Math.sin(G.time * (gale ? 10 : 2.2)) * (gale ? 6 : 3);
  for (const s of [-1, 1]) {
    const rx = sx + s * 8, ry = top + 13;
    const tips = [[s * 44, -24 + flap], [s * 50, -6 + flap * .7], [s * 45, 10 + flap * .4], [s * 30, 21 + flap * .2]];
    for (let i = 0; i < tips.length - 1; i++) pxTri(rx, ry, rx + tips[i][0], ry + tips[i][1], rx + tips[i + 1][0], ry + tips[i + 1][1], i % 2 ? '#5a1c14' : '#6a2418');
    for (let i = 0; i < tips.length - 1; i++) pxLine(rx + tips[i][0], ry + tips[i][1], rx + tips[i + 1][0], ry + tips[i + 1][1], OUTLINE);
    for (const [dx, dy] of tips) pxLine(rx, ry, rx + dx, ry + dy, '#2a1c18');
    pxLine(rx, ry - 1, rx + tips[0][0], ry + tips[0][1] - 1, OUTLINE);
    ctx.fillStyle = '#e6dcc6'; ctx.fillRect(Math.round(rx + tips[0][0]), Math.round(ry + tips[0][1]) - 1, 1, 2);   // a claw on the wing tip
  }
}
function typhonNecks(b, heads) {
  const hot = b.state === 'breathAim' || b.state === 'breath' || b.state === 'volley';
  for (const h of heads) {
    const n = 7;
    for (let j = 0; j <= n; j++) { const x = lerp(h.bx, h.hx, j / n), y = lerp(h.by, h.hy, j / n) - Math.sin(j / n * Math.PI) * 2; pxEllipse(x, y, 3, 2, OUTLINE); }
    for (let j = 0; j <= n; j++) { const x = lerp(h.bx, h.hx, j / n), y = lerp(h.by, h.hy, j / n) - Math.sin(j / n * Math.PI) * 2; pxEllipse(x, y, 2, 1, j % 2 ? '#55643c' : '#6b7a4a'); }
    pxEllipse(h.hx, h.hy, 4, 3, OUTLINE); pxEllipse(h.hx, h.hy, 3, 2, '#6b7a4a');
    ctx.fillStyle = '#93a46a'; ctx.fillRect(Math.round(h.hx) - 1, Math.round(h.hy) - 2, 3, 1);
    ctx.fillStyle = '#ff5a3c'; ctx.fillRect(Math.round(h.hx + h.s), Math.round(h.hy) - 1, 1, 1);
    const mx = Math.round(h.hx + Math.cos(h.a) * 3), my = Math.round(h.hy + Math.sin(h.a) * 2);
    ctx.fillStyle = hot ? (blink(12) ? '#ffd463' : '#ff8a2b') : '#2a1c18'; ctx.fillRect(mx - 1, my, 2, 1);
  }
}
// The serpent half, coiled under him: a spiral tube of scales. It's split into arcs (the half-turns behind his body and
// the ones in front of it); each arc is outlined and filled as one piece so it reads as a single snake, not a pile of beads.
function typhonCoils(b, sx, sy, layer) {
  const cx = sx, cy = sy - 4, n = 70, spin = (b.walkT || 0) * 1.4, arcs = []; let cur = null;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), a = spin + k * Math.PI * 3.6 + 1.3, r = 29 - 22 * k;
    if ((Math.sin(a) > 0) !== (layer === 'front')) { cur = null; continue; }
    if (!cur) { cur = []; arcs.push(cur); }
    cur.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * .42, i, rx: Math.round(1.5 + 4 * Math.min(1, k * 1.6)) });
  }
  const meanY = A => A.reduce((t, g) => t + g.y, 0) / A.length;
  arcs.sort((A, B) => meanY(A) - meanY(B));
  for (const arc of arcs) {
    for (const g of arc) pxEllipse(g.x, g.y, g.rx + 1, Math.max(1, Math.round(g.rx * .7)) + 1, OUTLINE);
    for (const g of arc) pxEllipse(g.x, g.y, g.rx, Math.max(1, Math.round(g.rx * .7)), '#6b7a4a');
    for (const g of arc) if (g.rx >= 3) pxEllipse(g.x, g.y + 1, g.rx - 1, Math.max(1, Math.round(g.rx * .7) - 1), '#5a6a3e');
    for (const g of arc) if (g.i % 4 === 0 && g.rx >= 3) { ctx.fillStyle = '#3a4528'; ctx.fillRect(Math.round(g.x), Math.round(g.y - g.rx * .7) + 1, 1, Math.max(1, Math.round(g.rx * 1.2))); }
    for (const g of arc) { ctx.fillStyle = '#93a46a'; ctx.fillRect(Math.round(g.x), Math.round(g.y - g.rx * .7), 1, 1); }
  }
}
function drawTyphonBody(b, sx, sy) {
  const frames = SPR.typhon, fi = b.frame === 2 ? 2 : 0, top = typhonTop(sy);
  const tint = b.flash > 0 ? 'white' : b.state === 'enrage' && blink(12) ? 'gold' : null, heads = typhonHeads(b, sx, top);
  if (b.alpha < 1) ctx.globalAlpha = Math.max(0, b.alpha);
  typhonWings(b, sx, top);
  typhonCoils(b, sx, sy, 'back');
  typhonNecks(b, heads);
  ctx.globalAlpha = 1;
  drawSpr(frames, fi, sx, sy - TY_LIFT, false, tint, b.alpha);
  if (b.alpha < 1) ctx.globalAlpha = Math.max(0, b.alpha);
  typhonCoils(b, sx, sy, 'front');
  ctx.globalAlpha = 1;
  if (b.ward) { ctx.globalAlpha = .55 + Math.sin(G.time * 6) * .2; pxRingFlat(sx, sy - 18, 30, '#ff8a2b', 2); pxRingFlat(sx, sy - 18, 32, '#ffd463', 3); ctx.globalAlpha = 1; }
  if (b.vuln > 0) for (let i = 0; i < 5; i++) { const a = G.time * 4 + i * 1.26, x = Math.round(sx + Math.cos(a) * 16), y = Math.round(top - 4 + Math.sin(a) * 2); ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ebc152'; ctx.fillRect(x, y, 1, 1); }
}
// Telegraphs: the fire cone, the tail's rings, the wing beat.
function drawTyphonTelegraph(b, S, sx, sy) {
  if (b.state === 'breathAim') {
    const locked = b.st < .3, col = locked ? '#ff5a3c' : blink(14) ? '#ffd463' : '#ff8a2b', R = 150;
    ctx.globalAlpha = .2; for (let r = 14; r < R; r += 4) for (let k = -.55; k <= .55; k += 5 / r) { ctx.fillStyle = '#ff5a3c'; ctx.fillRect(Math.round(sx + Math.cos(b.aim + k) * r), Math.round(sy + Math.sin(b.aim + k) * r * .8), 2, 2); }
    ctx.globalAlpha = 1;
    for (const k of [-.55, .55]) pxLine(sx, sy, sx + Math.cos(b.aim + k) * R, sy + Math.sin(b.aim + k) * R * .8, col, 2);
  }
  if (b.state === 'coil') pxRingFlat(sx, sy, 10 + (1 - b.st / .85) * 30, blink(16) ? '#ff5a3c' : '#ebc152', 2);
  if (b.state === 'galeAim') for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + G.time, r = 40 + (G.time * 60 % 20); arrowHead(sx + Math.cos(a) * r, sy - 10 + Math.sin(a) * r * .6, a, blink(10) ? '#ffffff' : '#9fb8ff'); }
  if (b.state === 'summonHeads') pxRingFlat(sx, sy, 20 + Math.sin(G.time * 12) * 4, blink(10) ? '#ff8a2b' : '#ffd463', 2);
}
// On the floor: the wind of his wings while it blows.
function drawTyphonWorld(S, b) {
  if (!q.gale) return;
  const [bx, by] = S(b.x, b.y), R = mulberry(5);
  ctx.globalAlpha = .45; ctx.fillStyle = '#e6f2ff';
  for (let i = 0; i < 48; i++) {
    const a = R() * Math.PI * 2, d = (G.time * 150 + R() * 300) % 300 + 20, x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d * .7;
    for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x + Math.cos(a) * k), Math.round(y + Math.sin(a) * k * .7), 1, 1);
  }
  ctx.globalAlpha = 1;
}

/* ---- the fight ---- */
TITAN_AI.typhon = function (b, dt, c) {
  const p = q.player, P2 = b.phase >= 2, P3 = b.phase >= 3, D = pct => tD(b, pct);
  if (titanCommon(b, dt, 'Typhon tears free', 'His serpent heads are waking up')) return;
  // Below a quarter of his health he stops holding back: the mountain erupts around you for the rest of the fight.
  if (b.phase === 2 && b.hp <= b.maxHp * .25) {
    b.phase = 3; Music.level(3); b.state = 'enrage'; b.st = 1.6; b.invuln = 1.6; titanStill(b); b.headT = Math.min(b.headT ?? 0, 3);
    banner('The hundred heads roar', 'Etna is erupting', true); Sound.play('roar'); addShake(7); G.flash = .2;
    return;
  }
  b.flip = false; b.frame = null;
  const heads = q.enemies.filter(e => e.type === 'typhon_head' && !e.dead);
  b.ward = heads.length ? .3 : 0;
  b.label = heads.length ? `${heads.length} serpent head${heads.length > 1 ? 's' : ''} left · shielded` : null;
  if (P2) b.headT = (b.headT ?? 0) - dt;
  if (P3) { b.eruptT = (b.eruptT ?? 2) - dt; if (b.eruptT <= 0 && !p.dead) { b.eruptT = rand(3.2, 4.2); typhonErupt(b, D); } }
  switch (b.state) {
    case 'idle':
      titanWalk(b, c, 100, P2 ? 38 : 32, dt); b.st -= dt;
      if (b.st <= 0 && !p.dead) {
        if (P2 && b.headT <= 0 && !heads.length) { b.state = 'summonHeads'; b.st = 1.2; Sound.play('roar'); addShake(4); break; }
        const opts = ['breath', 'volley', 'mountain', 'coil', 'breath'];
        if (P2) opts.push('gale', 'mountain');
        const pick = pickAttack(b, opts);
        if (pick === 'breath') { b.state = 'breathAim'; b.st = P2 ? .8 : .95; Sound.play('telegraph'); }
        else if (pick === 'volley') { b.state = 'volley'; b.st = .7; Sound.play('telegraph'); }
        else if (pick === 'mountain') { b.state = 'heave'; b.st = 1; Sound.play('telegraph'); }
        else if (pick === 'coil') { b.state = 'coil'; b.st = .85; Sound.play('telegraph'); }
        else { b.state = 'galeAim'; b.st = .7; Sound.play('telegraph'); }
      }
      break;
    case 'breathAim':                                          // the heads draw breath, then sweep fire across the cone
      titanStill(b); b.st -= dt;
      if (b.st > .3) b.aim = Math.atan2(c.dy, c.dx);
      if (b.st <= 0) { b.state = 'breath'; b.st = b.breathMax = P3 ? 1.5 : 1.2; b.fireT = 0; Sound.play('roar'); }
      break;
    case 'breath': {
      titanStill(b); b.st -= dt; b.fireT -= dt;
      if (b.fireT <= 0) {
        b.fireT = .055;
        const k = 1 - b.st / b.breathMax, a = b.aim + Math.sin(k * Math.PI * 2) * .5;
        spawnProj(b.x + Math.cos(a) * 18, b.y + Math.sin(a) * 12, a, 165, D(.11), 'typhonfire', 'enemy', { r: 4, life: 1.6, src: b });
      }
      if (b.st <= 0) { b.state = 'recover'; b.st = 1; }
      break;
    }
    case 'volley':                                             // every head spits a fireball that hangs, then flies at you
      titanStill(b); b.st -= dt;
      if (b.st <= 0) {
        const n = 6 + (P2 ? 2 : 0);
        for (let i = 0; i < n; i++) { const h = typhonHeadWorld(b, i % 6); spawnProj(h.x, h.y, 0, 0, D(.13), 'typhonfire', 'enemy', { r: 4, life: 4, src: b, ghost: true, delay: .3 + i * .14, launch: 175 }); }
        Sound.play('charm'); b.state = 'recover'; b.st = 1.2;
      }
      break;
    case 'heave':                                              // he tears a piece off the mountain and throws it
      titanStill(b); b.st -= dt; b.frame = 2;
      if (Math.random() < .5) dust(b.x + rand(-24, 24), b.y + rand(-4, 4), 1);
      if (b.st <= 0) {
        addCircleHazard(p.x, p.y, 34, 1.3, D(.3), 'etna', { then: h => { addPuddle(h.x, h.y, 26, 6, 'lava', .025); addShake(5); burst(h.x, h.y - 6, 18, ['#ff8a2b', '#ffd463', '#5a3e32'], 120); } });
        for (let i = 0; i < (P2 ? 6 : 4); i++) { const a = rand(0, Math.PI * 2), d = rand(50, 130); addCircleHazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .8, 13, 1 + i * .1, D(.15), 'etna', { small: true }); }
        Sound.play('roar'); addShake(3); b.state = 'recover'; b.st = 1.2;
      }
      break;
    case 'coil':                                               // his tail lashes out in rings
      titanStill(b); b.st -= dt;
      if (b.st <= 0) { quakeRings(b, D, P2 ? [[36, 12, .25], [62, 16, .5], [90, 20, .75], [118, 24, 1]] : [[36, 12, .3], [62, 16, .55], [90, 20, .8]]); b.state = 'recover'; b.st = 1.1; }
      break;
    case 'galeAim': titanStill(b); b.st -= dt; b.frame = 2; if (b.st <= 0) { b.state = 'gale'; b.st = 2.6; q.gale = { t: 2.6, s: 72, a: 0 }; b.boltT = .2; Sound.play('roar'); } break;
    case 'gale':                                               // his wings blow you away while lightning finds you
      titanStill(b); b.st -= dt; b.boltT -= dt; b.frame = 2;
      if (b.boltT <= 0 && !p.dead) { b.boltT = .5; addCircleHazard(p.x + rand(-16, 16), p.y + rand(-12, 12), 15, .75, D(.16), 'bolt'); }
      if (b.st <= 0) { q.gale = null; b.state = 'recover'; b.st = .9; }
      break;
    case 'summonHeads': {                                      // serpent heads burst out of the ground; he is shielded until they're cut down
      titanStill(b); b.st -= dt; b.frame = 2;
      if (Math.random() < .4) burst(b.x + rand(-30, 30), b.y - rand(10, 60), 1, ['#ff8a2b', '#ffd463'], 60);
      if (b.st <= 0) {
        const n = P3 ? 4 : 3, off = rand(0, Math.PI * 2);
        for (let i = 0; i < n; i++) {
          const a = off + i / n * Math.PI * 2, r = rand(95, 130);
          const e = makeEnemy('typhon_head', clamp(b.x + Math.cos(a) * r, IPX.minX + 16, IPX.maxX - 16), clamp(b.y + Math.sin(a) * r * .8, IPX.minY + 16, IPX.maxY - 16));
          e.st = 1; e.onDeath = typhonHeadDown; e.typhon = b; q.enemies.push(e);
          burst(e.x, e.y - 4, 16, ['#5a3e32', '#ff8a2b', '#ffd463'], 90); dust(e.x, e.y, 10);
        }
        banner('The serpent heads rise', 'Typhon is shielded until you cut them all down'); addShake(5); Sound.play('thud');
        b.headT = 99; b.state = 'recover'; b.st = .8;
      }
      break;
    }
    case 'reel':                                               // every head is down: he's open
      titanStill(b); b.st -= dt;
      if (Math.random() < .3) sc.parts.push({ x: b.x + rand(-16, 16), y: b.y - rand(30, 70), vx: rand(-8, 8), vy: -16, g: 0, life: .6, max: .6, c: Math.random() < .5 ? '#8f8a82' : '#ff8a2b', s: 1 });
      if (b.st <= 0) { b.state = 'idle'; b.st = .5; }
      break;
  }
  bossContact(b, D(.1));
};
function typhonErupt(b, D) {
  const p = q.player; Sound.play('thud'); addShake(3);
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2), d = i === 0 ? rand(0, 16) : rand(40, 150);
    addCircleHazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .8, 14, 1.1 + i * .12, D(.14), 'etna', { small: true, then: h => addPuddle(h.x, h.y, 14, 3.5, 'lava', .02) });
  }
}
function typhonHeadDown(e) {
  const b = e.typhon;
  Sound.play('kill'); burst(e.x, e.y - 6, 18, ['#6b7a4a', '#ff8a2b', '#ffd463'], 110);
  q.fx.push({ t: 'ring', x: e.x, y: e.y, r0: 2, r1: 18, life: .3, max: .3, c: '#ff8a2b' }); q.stats.kills++;
  if (!b || b.dead || q.enemies.some(o => o.type === 'typhon_head' && !o.dead)) return;
  b.ward = 0; b.label = null; b.state = 'reel'; b.st = 3; b.vx = b.vy = 0; setVuln(b, 1.35, 3); b.headT = b.phase >= 3 ? 14 : 20;
  banner('Typhon reels', 'His heads are down. Hit him now'); Sound.play('break'); addShake(6); G.flash = .12;
}
// Runs every step of his fight: the wind from his wings pushes you away from him.
function typhonTick(b, dt) {
  const p = q.player, G2 = q.gale;
  if (!G2) return;
  G2.t -= dt; if (G2.t <= 0) { q.gale = null; return; }
  G2.a = Math.atan2(p.y - b.y, p.x - b.x);
  if (!p.dead && p.dodgeT <= 0 && p.dashT <= 0 && q.phase === 'boss') moveEntity(p, Math.cos(G2.a) * G2.s * dt, Math.sin(G2.a) * G2.s * dt);
}
