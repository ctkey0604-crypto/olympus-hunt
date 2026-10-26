/* ============================== THE ROAD TO AKROS ============================== */
// A new hunter's first minutes: the dirt road outside the village, bandits robbing a cart, and every control
// taught by doing it (walk, attack, dodge, parts, potions). You can't fall here. When the road is clear the
// gate opens and you walk straight into Akros. Pause → Skip the tutorial jumps to the village.
Object.assign(THEMES, { approach: { floor: 'grass', base: '#5b7832', shades: ['#506a2c', '#69883b', '#486127'], flowers: 110, ...HEDGE } });
ARENAS.akros_road = {
  name: 'Outside Akros', theme: 'approach', paint: paintApproach,
  obstacles: [['cart', 24, 12], ['crate', 26, 13], ['amphora', 25, 14], ['rock', 9, 8], ['rock', 31, 18], ['tree', 7, 15], ['tree', 33, 7],
              ['tree', 12, 20], ['rock', 15, 5], ['boulder', 28, 20], ['olive', 6, 5], ['olive', 34, 15]],
};
const PROLOGUE = { id: 'prologue', name: 'The Road to Akros', prologue: true, god: 'hermes', tier: 1, mt: 1, rank: 0, arena: 'akros_road',
                   reward: 0, stars: 1, requires: [], waves: [{ bandit: 2 }, { bandit: 3 }, { bandit: 2, slinger: 2 }] };
const ROAD_GATE = { x0: 19 * TILE, x1: 22 * TILE };          // the gateway in Akros' wall, same street as inside

// The road's look: the village wall across the north end with its gate, and the dirt road running up to it.
function paintApproach(x, R) {
  const W = WORLD_W, H = WORLD_H, top = IPX.minY, gx0 = ROAD_GATE.x0, gx1 = ROAD_GATE.x1, mid = (gx0 + gx1) / 2;
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); };
  const V = THEMES.village, pick = a => a[(R() * a.length) | 0];
  // the dirt road, wandering a little, straight where it meets the gate
  const cxAt = py => mid + (py > top + 40 ? Math.sin((py - top - 40) / 60) * 12 : 0);
  for (let py = top - 4; py < H; py++) {
    const cx = cxAt(py), near = clamp(1 - (py - top) / 36, 0, 1), hw = (21 + Math.sin(py / 9) * 1.2 + Math.sin(py / 4) * .6) * (1 - near) + 24 * near;
    for (let px = Math.floor(cx - hw); px <= cx + hw; px++) dot(px, py, Math.abs(px - cx) > hw - 2 ? '#7f6239' : (R() < .14 ? '#9a774a' : '#a8834f'));
    for (const off of [-9, 9]) { dot(cx + off + Math.round(Math.sin(py / 13) * .8), py, '#93703f', 2, 1); }
  }
  for (let i = 0; i < 260; i++) { const py = top + R() * (H - top), cx = cxAt(py); dot(cx + (R() - .5) * 40, py, R() < .5 ? '#7c5f3a' : '#c09a63'); }
  // Akros' wall across the top, the same stone as inside
  dot(0, 0, V.stoneBase, W, top);
  for (let py = 0; py < top; py += 6) for (let px = -(R() * 8 | 0); px < W;) { const w = 7 + (R() * 7 | 0); dot(px, py, pick(V.stone), w - 1, 5); dot(px, py, V.stoneHi, w - 1, 1); px += w; }
  dot(0, top - 3, '#3a362e', W, 3); dot(0, top, 'rgba(0,0,0,.22)', W, 4);           // the wall's foot and its shadow on the grass
  // the gateway: cobbles through the wall, shaded inner faces, a sill, two posts
  paintGatePassage(x, R, gx0, gx1, 0, top + 4, top);
  // red roof tiles peeking over the wall
  for (const [rx, rw] of [[70, 90], [430, 110]]) { dot(rx, 0, '#6b2c12', rw, 10); for (let px = rx; px < rx + rw; px += 6) dot(px, 2, '#b5532a', 5, 6); dot(rx, 9, '#8f3f1d', rw, 1); }
}

// ---- the tutorial's state while you walk the road ----
function startPrologue() {
  const s = G.save;
  // a traveller's pack: a couple of potions to learn with (you keep what you don't drink)
  s.potions.health = Math.max(s.potions.health || 0, 2); s.potions.strength = Math.max(s.potions.strength || 0, 1); s.potions.speed = Math.max(s.potions.speed || 0, 1);
  startQuest(PROLOGUE);
  if (!q) return;
  const p = q.player; p.x = (ROAD_GATE.x0 + ROAD_GATE.x1) / 2; p.y = IPX.maxY - 26; p.face = -Math.PI / 2;
  G.cam.x = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W); G.cam.y = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  q.pro = { step: 'move', x0: p.x, y0: p.y, moved: 0, swings: 0, atk: 0, partsT: 0, partsShown: false, potions: q.stats.potions || 0, shown: '' };
  banner('The Road to Akros', 'Bandits have been seen near the village gate');
}
function proHint(key, html, pulse) {
  const P = q.pro;
  if (P.shown !== key) { P.shown = key; showHint(html, 999); $('hint').classList.add('tut'); }
  tutPulse(touchMode ? pulse : null);
}
function proClear() { const P = q.pro; if (P.shown) { P.shown = ''; $('hint').hidden = true; $('hint').classList.remove('tut'); tutPulse(null); } }
const potionKeys = () => `${kbd(Input.bind.potion1[0])} heals · ${kbd(Input.bind.potion2[0])} strength · ${kbd(Input.bind.potion3[0])} double dash`;
// Every tick of the road: one prompt at a time, each cleared by doing it.
function proTick(dt) {
  const P = q.pro, p = q.player; if (!P) return;
  const drank = (q.stats.potions || 0) > P.potions;
  const mouse = Settings.data.mouse;
  if (P.step === 'move') {
    P.moved = Math.max(P.moved, Math.hypot(p.x - P.x0, p.y - P.y0));
    proHint('move', touchMode ? 'Drag on the left side of the screen to walk' : `${moveKeysHTML()} to walk · ${kbd('Escape')} pauses`, null);
    if (P.moved > 36) { P.step = 'attack'; q.timer = .7; }
  } else if (P.step === 'attack') {
    if (p.atkCd > P.atk + .01) P.swings++; P.atk = p.atkCd;
    proHint('attack', touchMode ? 'Bandits! Tap <b>Attack</b> to swing your sword' : `Bandits! ${kbd(Input.bind.attack[0])}${mouse ? ' or click' : ''} to <b>attack</b> · hold it to keep swinging`, 'tAttack');
    if (P.swings >= 3) { P.step = 'fight'; proClear(); }
  } else if (P.step === 'fight' && q.waveIdx >= 1) {
    P.step = 'dodge';
  } else if (P.step === 'dodge') {
    proHint('dodge', touchMode ? 'When a bandit winds up, tap <b>Dash</b> to get clear. Nothing hits you mid-dash' : `When a bandit winds up, ${kbd(Input.bind.dodge[0])}${mouse ? ' or right click' : ''} to <b>dash</b> · nothing can hit you mid-dash`, 'dodge');
    if (p.dodgeT > 0) { P.step = 'fight2'; proClear(); }
  } else if (P.step === 'fight2' && (q.waveIdx >= 2 || p.hp < p.st.maxHp * .55)) {
    P.step = 'potion'; P.potions = q.stats.potions || 0;
  } else if (P.step === 'potion') {
    proHint('potion', touchMode ? 'Tap a <b>potion</b> at the top right to drink it. Red heals, green gives a double dash'
                                : `Drink a potion from the corner: ${potionKeys()}`, null);
    if (drank) { P.step = 'fight3'; proClear(); }
  }
  // parts: shown once, when nothing else is being taught
  const got = Object.values(q.loot).reduce((a, b) => a + b, 0);
  if (got > 0 && !P.partsShown && (P.step === 'fight' || P.step === 'fight2' || P.step === 'fight3')) { P.partsShown = true; P.partsT = 5; }
  const teaching = P.step === 'move' || P.step === 'attack' || P.step === 'dodge' || P.step === 'potion' || P.step === 'walkout';
  if (P.partsT > 0 && teaching) P.partsT = 0;                              // a lesson that needs doing comes first
  if (P.partsT > 0) {
    P.partsT -= dt; proHint('parts', touchMode ? 'Monsters drop <b>parts</b>. The smith in Akros forges them into gear' : 'Monsters drop <b>parts</b>. Take them home and the smith forges them into armor and weapons', null);
    if (P.partsT <= 0) proClear();
  }
  if (q.phase === 'walkout') {
    proHint('gate', 'The road is clear. Walk through the gate into <b>Akros</b>', null);
    if (p.y < IPX.minY - 6 && p.x > ROAD_GATE.x0 && p.x < ROAD_GATE.x1) proFinish(false);
  }
}
// The flow of the road: wait for your first steps before the bandits come; at the end, open the gate instead of a results screen.
function proFlow() {
  if (q.phase === 'intro' && q.pro && q.pro.step === 'move') { q.timer = Math.max(q.timer, .7); }
}
function proWaveBanner(i) {
  const lines = [['Bandits!', 'They’re robbing a cart on the road'], ['More of them', 'Watch for the wind-up before they lunge'], ['Slingers', 'They throw from range. Close in, or dash past the stones']];
  banner(...(lines[i] || ['Bandits', '']));
}
function proWalkout() {
  q.phase = 'walkout'; Sound.play('win'); q.hazards = [];
  for (let ty = 0; ty < INNER.y0; ty++) for (let tx = 19; tx < 22; tx++) q.world.grid[ty * q.world.wt + tx] = 0;   // the gate opens
  banner('The road is clear', 'Akros is through the gate');
  q.pro.step = 'walkout'; proClear();
}
function proFinish(skipped) {
  if (!q || q.phase === 'leaving') return;
  const s = G.save; q.phase = 'leaving';
  for (const k of q.pickups) if (!k.dead && k.item !== '@heal') q.loot[k.item] = (q.loot[k.item] || 0) + 1;
  for (const [k, v] of Object.entries(q.loot)) s.inv[k] = (s.inv[k] || 0) + v;
  s.tut = Math.max(s.tut, TUT.TALK); persist(); CG.gameplay(false);
  proClear(); tutPulse(null);
  if (skipped) toast('Tutorial skipped. You can turn tips off in Options.');
  fadeTo(() => enterVillage('road'));
}
// The arrow to the gate once the road is clear.
function proDraw(S) {
  if (!q || !q.def.prologue || q.phase !== 'walkout') return;
  drawPointer(S, (ROAD_GATE.x0 + ROAD_GATE.x1) / 2, IPX.minY - 4, 22);
}
// You can't fall on the road: you get back up with some health and a reminder about potions.
function proSave(p) {
  p.hp = Math.max(1, Math.round(p.st.maxHp * .3)); p.invuln = 1.5; G.slowmo = .5;
  burst(p.x, p.y - 8, 14, ['#ebc152', '#9bbb55', '#ffffff'], 80); banner('Back on your feet', 'Drink a health potion when you’re hurt');
  if (q.pro && (q.pro.step === 'fight' || q.pro.step === 'fight2')) q.pro.step = 'potion';
}
