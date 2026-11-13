/* ============================== INSIDE THE BUILDINGS ============================== */
// The Forge, the Tavern, Melita's Market and your home are rooms you walk into, one screen each (the Temple has its own
// builder in 85_village.js). A room is data: its floor and walls (a theme), furniture (props), who works there (npcs),
// seats you can sit at, and rugs painted on the floor. Leave through the doorway at the bottom.
// Someone behind a counter is talked to from in front of it.
Object.assign(THEMES, {
  tavernroom: { floor: 'planks', base: '#6e4a2c', planks: ['#86593a', '#7a5232', '#8f6342'], seam: '#3e2716', grain: '#6a4428',
                border: 'wall', wallBase: '#2e2018', wall: ['#c9b48f', '#bba57f'], wallHi: '#e0cfa8', frieze: '#8a5a34' },
  homeroom:   { floor: 'planks', base: '#7a5a3a', planks: ['#94704a', '#8a6642', '#9c7852'], seam: '#4a321e', grain: '#7a5a38',
                border: 'wall', wallBase: '#2e2018', wall: ['#e6d9bd', '#d8caac'], wallHi: '#f3ecdb', frieze: '#c35f2a' },
  marketroom: { floor: 'planks', base: '#8a6642', planks: ['#a37a50', '#97704a', '#ab845a'], seam: '#5a3e24', grain: '#8a6642',
                border: 'wall', wallBase: '#2e2018', wall: ['#e6d9bd', '#d8caac'], wallHi: '#f3ecdb', frieze: '#5b8fc9' },
  forgeroom:  { floor: 'marble', light: '#5a5048', dark: '#4e4540', fleck: ['#625850', '#463e38'], grout: '#2e2824', crack: '#2a221e', cracks: .2,
                border: 'wall', wallBase: '#1c1410', wall: ['#6f685b', '#5f594e'], wallHi: '#8f8470', frieze: '#cf6a2f' },
  arena:      { floor: 'rock', base: '#c9b48a', shades: ['#c2ad82', '#d1bd94', '#baa57a', '#d6c39c'], crack: '#a8926c', pebble: '#ab9570',
                border: 'wall', wallBase: '#7d7362', wall: ['#b5a98f', '#a69a80'], wallHi: '#d0c4aa', frieze: '#c0412e' },
});
// Vindheim's Mead Hall and Smithy: the same floors, inside timber walls like the North's halls (41_norse_world.js)
Object.assign(THEMES, { meadroom: { ...THEMES.tavernroom, ...LONGWALL, frieze: '#9fd0ff' }, smithroom: { ...THEMES.forgeroom, ...LONGWALL, frieze: '#ff8a2b' } });
// The Coliseum's floor, for practice and for fights between players.
Object.assign(ARENAS, { coliseum: { name: 'The Coliseum', theme: 'arena', wt: 46, ht: 30, secret: null, dress: (x, R) => paintColiseum(x, R),
  obstacles: [['column', 12, 9], ['column', 33, 9], ['column', 12, 20], ['column', 33, 20], ['column', 22, 7], ['column', 23, 22], ['brokencol', 7, 15], ['brokencol', 38, 14],
              ['firebowl', 5, 5], ['firebowl', 40, 5], ['firebowl', 5, 24], ['firebowl', 40, 24]] } });
// Dressing the Coliseum, measured against a person (about 10 wide, 16 tall). The wall is nearly three people high, its stones are
// as tall as a person and twice as long, and the barred gates and banners are sized to match. Nobody is watching.
const ARENA_FACE = ['#b5a98f', '#ab9f86', '#a69a80', '#bbaf95'], ARENA_TOP = ['#cfc3a9', '#c6baa0', '#d6cab0', '#c0b49a'];
function arenaStone(x, R, bx, by, bw, bh, cw, ch, S, lit, shade) {
  x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
  x.fillStyle = '#6f6554'; x.fillRect(bx, by, bw, bh);                                            // the joints
  for (let y = by, row = 0; y < by + bh; y += ch, row++) for (let px = bx - (row % 2 ? cw / 2 : 0); px < bx + bw; px += cw) {
    x.fillStyle = S[R() * S.length | 0]; x.fillRect(px + 1, y + 1, cw - 1, ch - 1);
    x.fillStyle = lit; x.fillRect(px + 1, y + 1, cw - 1, 1);
    x.fillStyle = shade; x.fillRect(px + 1, y + ch - 1, cw - 1, 1);
    for (let i = 0; i < 4; i++) { x.fillStyle = R() < .5 ? shade : lit; x.fillRect(px + 2 + R() * (cw - 6) | 0, y + 2 + R() * (ch - 4) | 0, 1 + (R() * 3 | 0), 1); }   // chips and pits
  }
  x.restore();
}
// A gate in the wall, big enough to walk through, with an iron grille down.
function arenaGate(x, cx, top, bottom) {
  const K = '#1a1210', half = (y, hw, t) => { const d = y - t; return d >= hw ? hw : Math.round(Math.sqrt(hw * hw - (hw - d) * (hw - d))); };
  for (let y = top; y < bottom; y++) {
    const o = half(y, 16, top), i = y >= top + 4 ? half(y, 12, top + 4) : 0;
    x.fillStyle = K; x.fillRect(cx - o - 1, y, o * 2 + 2, 1);
    x.fillStyle = '#c6baa0'; x.fillRect(cx - o, y, o * 2, 1);
    x.fillStyle = '#8f8470'; x.fillRect(cx + o - 2, y, 2, 1);
    if (i) { x.fillStyle = K; x.fillRect(cx - i - 1, y, i * 2 + 2, 1); x.fillStyle = y > bottom - 7 ? '#2a1e19' : '#120c0a'; x.fillRect(cx - i, y, i * 2, 1); }
  }
  for (const a of [-1.15, -.55, .55, 1.15]) { x.fillStyle = '#6f6554'; for (let r = 12; r < 16; r++) x.fillRect(Math.round(cx + Math.sin(a) * r), Math.round(top + 16 - Math.cos(a) * r), 1, 1); }   // the arch stones
  x.fillStyle = K; x.fillRect(cx - 4, top - 1, 8, 7); x.fillStyle = '#e0d4ba'; x.fillRect(cx - 3, top, 6, 5); x.fillStyle = '#a69a80'; x.fillRect(cx - 3, top + 4, 6, 1);   // the keystone
  for (let bx = cx - 10; bx <= cx + 9; bx += 5) for (let y = top + 4; y < bottom; y++) if (Math.abs(bx - cx) + 1 < half(y, 12, top + 4)) { x.fillStyle = '#4a4a52'; x.fillRect(bx, y, 2, 1); x.fillStyle = '#7a7a84'; x.fillRect(bx, y, 1, 1); }
  for (const y of [top + 13, top + 23]) { x.fillStyle = '#4a4a52'; x.fillRect(cx - 11, y, 22, 2); x.fillStyle = '#7a7a84'; x.fillRect(cx - 11, y, 22, 1); }
}
function arenaBanner(x, cx, top, bottom) {
  const K = '#1a1210', w = 7;
  for (let y = top + 2; y < bottom; y++) {
    const n = Math.max(0, y - (bottom - 7)), hw = w - n;                                            // it comes to a point
    x.fillStyle = K; x.fillRect(cx - hw - 1, y, hw * 2 + 2, 1);
    if (y === bottom - 1) continue;
    x.fillStyle = '#b0382a'; x.fillRect(cx - hw, y, hw * 2, 1);
    x.fillStyle = '#8f2e1e'; x.fillRect(cx + hw - 3, y, Math.min(3, hw * 2), 1); x.fillStyle = '#c9503c'; x.fillRect(cx - hw + 2, y, 1, 1);
  }
  x.fillStyle = '#d8ae3e'; x.fillRect(cx - 5, top + 4, 1, bottom - top - 12); x.fillRect(cx + 4, top + 4, 1, bottom - top - 12);
  const c = top + 13; x.fillStyle = '#e9c04f'; x.fillRect(cx - 2, c - 2, 4, 4); x.fillRect(cx - 1, c - 4, 2, 8); x.fillRect(cx - 4, c - 1, 8, 2);
  x.fillStyle = '#ffd463'; x.fillRect(cx - 1, c - 1, 2, 2);
  x.fillStyle = K; x.fillRect(cx - 10, top - 1, 20, 4); x.fillStyle = '#c9a032'; x.fillRect(cx - 9, top, 18, 2); x.fillStyle = '#ffd463'; x.fillRect(cx - 9, top, 18, 1);   // the rod
}
// A round bronze shield hung on the wall, about half a person across.
function arenaShield(x, cx, cy) {
  const disc = (r, c, ox = 0, oy = 0) => { x.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r + r - y * y)); x.fillRect(cx + ox - w, cy + oy + y, w * 2 + 1, 1); } };
  disc(7, '#1a1210'); disc(6, '#8f6a1c'); disc(5, '#a8842a'); disc(5, '#c9a032', -1, -1); disc(2, '#6b5a1f'); disc(1, '#ffd463');
}
function paintColiseum(x, R, gate) {
  const W = WORLD_W, H = WORLD_H, B = IPX, K = '#1a1210', inner = B.maxX - B.minX, foot = B.minY;
  // the walls seen from above: both sides, the near side, and a strip of the far one
  const top = (bx, by, bw, bh) => arenaStone(x, R, bx, by, bw, bh, 32, 16, ARENA_TOP, '#e0d4ba', '#b5a98f');
  top(0, 0, B.minX, H); top(B.maxX, 0, W - B.maxX, H); top(B.minX, 0, inner, 6);
  const gap = gate ? [gate.x * TILE, (gate.x + gate.w) * TILE] : null;
  if (gap) { top(B.minX, B.maxY, gap[0] - B.minX, H - B.maxY); top(gap[1], B.maxY, B.maxX - gap[1], H - B.maxY); } else top(B.minX, B.maxY, inner, H - B.maxY);
  // the far wall's face, which is the one you look at: a cornice, a red key pattern, two courses of big stones, a plinth
  arenaStone(x, R, B.minX, 16, inner, foot - 20, 32, 14, ARENA_FACE, '#d0c4aa', '#8f8470');
  x.fillStyle = K; x.fillRect(B.minX, 6, inner, 10);
  x.fillStyle = '#c0412e'; for (let px = B.minX; px < B.maxX; px += 6) { x.fillRect(px, 7, 5, 1); x.fillRect(px + 4, 7, 1, 5); x.fillRect(px + 1, 11, 4, 1); x.fillRect(px + 1, 9, 1, 3); x.fillRect(px + 1, 9, 2, 1); x.fillRect(px, 13, 6, 1); }
  x.fillStyle = '#8f8470'; x.fillRect(B.minX, foot - 4, inner, 4); x.fillStyle = '#b5a98f'; x.fillRect(B.minX, foot - 4, inner, 1); x.fillStyle = K; x.fillRect(B.minX, foot - 1, inner, 1);
  // where the sand meets the walls
  x.fillStyle = K; x.fillRect(B.minX - 1, 6, 1, B.maxY - 6 + (H - B.maxY)); x.fillRect(B.maxX, 6, 1, H - 6);
  if (gap) { x.fillRect(B.minX, B.maxY, gap[0] - B.minX, 1); x.fillRect(gap[1], B.maxY, B.maxX - gap[1], 1); x.fillRect(gap[0] - 1, B.maxY, 1, H - B.maxY); x.fillRect(gap[1], B.maxY, 1, H - B.maxY); } else x.fillRect(B.minX, B.maxY, inner, 1);
  for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(70,48,24,${(.2 - i * .025).toFixed(3)})`; x.fillRect(B.minX, foot + i, inner, 1); }
  for (let i = 0; i < 4; i++) { x.fillStyle = `rgba(70,48,24,${(.12 - i * .03).toFixed(3)})`; x.fillRect(B.minX + i, foot, 1, B.maxY - foot); x.fillRect(B.maxX - 1 - i, foot, 1, B.maxY - foot); }
  // gates and banners along it, evenly, leaving the fight board its bit of wall in the room
  const n = Math.max(2, Math.round(inner / 240)), gates = [], flags = [], shields = [];
  if (gate) { gates.push(B.minX + 102, B.maxX - 102); flags.push(W / 2 - 62, W / 2 + 62); shields.push(B.minX + 44, B.maxX - 44, W / 2 - 92, W / 2 + 92); }
  else {
    for (let i = 0; i < n; i++) { const at = f => Math.round(B.minX + inner * (i + f) / n); gates.push(at(.5)); shields.push(at(.25), at(.75)); if (i) flags.push(at(0)); }
    shields.shift(); shields.pop();
    shields.push(B.minX + 34, B.maxX - 34);
  }
  for (const c of gates) arenaGate(x, c, 18, foot);
  for (const c of flags) arenaBanner(x, c, 16, foot - 6);
  for (const c of shields) arenaShield(x, c, 29);
  x.fillStyle = 'rgba(120,90,50,.1)';                                                               // the sand in front of a gate is scuffed by whatever came through it
  for (const c of gates) for (let i = 0; i < 90; i++) { const a = R() * Math.PI, r = Math.sqrt(R()); x.fillRect(Math.round(c + Math.cos(a) * r * 20), Math.round(foot + Math.sin(a) * r * 20), 2, 1); }
  // the sand: raked in wide rings, packed down in a loose circle where people fight, scuffed in the middle
  const cx = W / 2, cy = (foot + B.maxY) / 2, rx = inner * .38, ry = (B.maxY - foot) * .4, step = (a, b) => 1 / Math.max(a, b, 1);
  for (let k = 2; k < 9; k++) { const a = rx * k / 8 + 14, b = ry * k / 8 + 8; for (let t = 0; t < Math.PI * 2; t += step(a, b) * 2) { if (R() < .3) continue; const px = Math.round(cx + Math.cos(t) * a), py = Math.round(cy + Math.sin(t) * b); x.fillStyle = '#bda878'; x.fillRect(px, py, 2, 1); x.fillStyle = '#d6c39c'; x.fillRect(px, py + 1, 2, 1); } }
  x.fillStyle = 'rgba(120,90,50,.07)'; for (let t = 0; t < Math.PI * 2; t += step(rx, ry) * .8) for (let d = -6; d <= 6; d += 3) if (R() < .4) x.fillRect(Math.round(cx + Math.cos(t) * (rx + d)), Math.round(cy + Math.sin(t) * (ry + d * .7)), 2, 1);
  x.fillStyle = '#ab9570'; for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()), px = cx + Math.cos(a) * r * rx * .6, py = cy + Math.sin(a) * r * ry * .6; for (let k = 0, L = 2 + R() * 6 | 0, d = R() * 6.3; k < L; k++) x.fillRect(Math.round(px + Math.cos(d) * k * 1.5), Math.round(py + Math.sin(d) * k), 1, 1); }
}
// soft: you can walk over it (stools)
Object.assign(OBST, {
  counter: { w: 72, h: 10 }, table: { w: 26, h: 10 }, stool: { w: 8, h: 4, soft: true }, barrel: { w: 12, h: 8 }, bed: { w: 20, h: 28 },
  chestbox: { w: 18, h: 8 }, furnace: { w: 46, h: 12 }, armorstand: { w: 12, h: 6 }, shelf: { w: 40, h: 6 }, fireplace: { w: 34, h: 10 }, dummy: { w: 10, h: 6 }, firebowl: { w: 10, h: 6 },
});
const ROOMS = {
  forge: { name: 'The Forge', theme: 'forgeroom', sub: 'Dion makes your gear at the anvil',
    props: [['furnace', 11.5, 3.3], ['anvil', 11.5, 6.6], ['rack', 5, 3.5], ['rack', 7, 3.5], ['armorstand', 16.5, 3.7, 'bronze'], ['armorstand', 18.5, 3.7, 'iron'],
            ['barrel', 5, 9.4, 'water'], ['crate', 19.2, 9.4], ['crate', 18.2, 10.2]],
    npcs: [{ id: 'smith', name: 'Dion the Smith', sprite: 'smith', x: 216, y: 114, flip: true, opens: 'armory' }] },
  tavern: { name: 'The Tavern', theme: 'tavernroom', sub: 'Sit down and order something for the road',
    props: [['counter', 11.5, 4.4, 'tavern'], ['fireplace', 4.8, 3.2], ['barrel', 17.6, 3.4], ['barrel', 19.2, 3.4], ['barrel', 19.2, 4.6],
            ['table', 6, 7.4], ['stool', 4.7, 7.6], ['stool', 7.3, 7.6], ['table', 17, 7.4], ['stool', 15.7, 7.6], ['stool', 18.3, 7.6],
            ['amphora', 3.4, 10.4], ['amphora', 20, 10.4]],
    npcs: [{ id: 'keeper', name: 'Phaedra', sprite: 'keeper', x: 192, y: 67, opens: 'tavern', behind: true }],
    seats: [[85, 131, 0], [123, 131, Math.PI], [261, 131, 0], [299, 131, Math.PI]],   // a little forward of each stool, so it shows behind you
    rugs: [[128, 108, 128, 44, '#8f2e1e', '#e9c04f']] },
  market: { name: 'Melita’s Market', theme: 'marketroom', sub: 'Potions, and parts from hunts you’ve cleared',
    props: [['counter', 11.5, 4.4, 'market'], ['shelf', 5.4, 3.2, 'potions'], ['shelf', 17.6, 3.2, 'jars'], ['amphora', 3.6, 7.6], ['amphora', 4.4, 8.4],
            ['crate', 19.4, 7.8], ['barrel', 18.4, 9.6], ['crate', 19.6, 10.2]],
    npcs: [{ id: 'merchant', name: 'Melita the Trader', sprite: 'merchant', x: 192, y: 67, opens: 'market', behind: true }],
    rugs: [[136, 112, 112, 40, '#2b4f7a', '#e9c04f']] },
  home: { name: 'Your Home', theme: 'homeroom', sub: 'Everything you bring home goes in your chest',
    props: [['bed', 4.8, 4.2], ['chestbox', 8, 3.6], ['fireplace', 12.5, 3.2], ['shelf', 18.4, 3.2, 'jars'], ['table', 16.5, 7.6], ['stool', 15.2, 7.8], ['stool', 17.8, 7.8],
            ['amphora', 20, 10.2], ['barrel', 3.6, 10]],
    spots: [{ id: 'chest', name: 'your chest', kind: 'chest', opens: 'stash', x: 136, y: 78 }],
    rugs: [[136, 112, 112, 44, '#5a6e3a', '#d8ccb4']] },
  coliseum: { name: 'The Coliseum', theme: 'arena', sub: 'Agon runs the fights. The practice room is free any time', wt: 36, ht: 22, paint: (x, R, gate) => paintColiseum(x, R, gate),
    props: [['firebowl', 15, 3.8], ['firebowl', 20, 3.8], ['board', 17.5, 3.4], ['firebowl', 14.5, 17.4], ['firebowl', 20.5, 17.4],
            ['rack', 3.8, 3.5], ['rack', 5.2, 3.5], ['rack', 11.6, 3.5], ['armorstand', 23.4, 3.7, 'iron'], ['armorstand', 29.6, 3.7, 'bronze'], ['armorstand', 31, 3.7, 'iron'],
            ['column', 7, 8], ['column', 7, 14], ['column', 28, 8], ['column', 28, 14],
            ['dummy', 23.5, 9.6], ['dummy', 26.5, 9.6], ['dummy', 25, 11.4],
            ['amphora', 3.8, 16.8], ['amphora', 4.8, 17.5], ['crate', 3.8, 18], ['barrel', 31.4, 16.6, 'water'], ['barrel', 30.4, 17.6, 'water'], ['crate', 31.6, 18]],
    npcs: [{ id: 'arena', name: 'Agon the Arena Master', sprite: 'arena', x: 200, y: 150 }],
    spots: [{ id: 'dummy', name: 'practice mode', kind: 'practice', x: 408, y: 190 }, { id: 'dummy2', name: 'practice mode', kind: 'practice', x: 384, y: 162 }, { id: 'dummy3', name: 'practice mode', kind: 'practice', x: 432, y: 162 }, { id: 'fights', name: 'the leaderboards', kind: 'board', opens: 'pvpboard', x: 288, y: 84 }] },
  // Vindheim's (north: true): you come out into Vindheim, and they count as being in Vindheim (atVindheim, save.town)
  meadhall: { name: 'The Mead Hall', theme: 'meadroom', sub: 'Sit down and order something for the road', north: true, music: 'vindheim',
    props: [['counter', 11.5, 4.4, 'tavern'], ['fireplace', 4.8, 3.2], ['meadbarrel', 17.6, 3.6], ['meadbarrel', 19.2, 3.6], ['meadbarrel', 19.2, 5],
            ['table', 6, 7.4], ['stool', 4.7, 7.6], ['stool', 7.3, 7.6], ['table', 17, 7.4], ['stool', 15.7, 7.6], ['stool', 18.3, 7.6],
            ['logpile', 3.6, 10.2], ['meadbarrel', 20, 10.2]],
    seats: [[85, 131, 0], [123, 131, Math.PI], [261, 131, 0], [299, 131, Math.PI]],
    rugs: [[128, 108, 128, 44, '#2b4f7a', '#9fd0ff']] },
  smithy: { name: 'Brokk’s Smithy', theme: 'smithroom', sub: 'Brokk forges the North’s gear', north: true, music: 'vindheim',
    props: [['forgefire', 11.5, 3.1], ['anvil', 11.5, 6.4], ['rack', 5, 3.5], ['rack', 7, 3.5], ['logpile', 18.6, 3.8], ['barrel', 5, 9.4, 'water'], ['meadbarrel', 19.2, 9.6]],
    npcs: [{ id: 'brokk', name: 'Brokk the Smith', sprite: 'brokk', x: 216, y: 114, flip: true, opens: () => openPanel('armory', 'Brokk’s Forge') }] },
};
for (const R of Object.values(ROOMS)) { R.wt = R.wt || 24; R.ht = R.ht || 15; }

function buildRoom(id) {
  const D = ROOMS[id];
  const props = D.props.map(([k, tx, ty, v]) => mkObstacle(k, tx, ty, v));
  const gate = { x: D.wt / 2 - 1, y: D.ht - 3, w: 2 }, layers = genLayers(D.theme, null, { gate, seed: id, axis: WORLD_W / 2 });
  const gx = layers.ground.getContext('2d');
  for (const [x, y, w, h, c1, c2] of D.rugs || []) paintRug(gx, x, y, w, h, c1, c2);
  if (D.paint) D.paint(gx, mulberry(hashStr(id + ':paint')), gate);
  const npcs = (D.npcs || []).map(n => ({ ...n, r: 4, flip: !!n.flip, walkT: 0, moving: false, talkT: 0 }));
  const spots = (D.spots || []).map(s => ({ ...s }));
  for (const n of npcs) if (n.behind) spots.push({ id: n.id + '_counter', kind: 'npc', npc: n, name: n.name, x: n.x, y: n.y + 24 });   // just in front of the counter
  (D.seats || []).forEach(([x, y, face], i) => spots.push({ id: 'seat' + i, name: 'a seat', kind: 'seat', x, y, face }));
  return { id, name: D.name, theme: D.theme, sub: D.sub, music: D.music || (Music.songs['room_' + id] ? 'room_' + id : 'akros'), exitTo: D.north ? 'vindheim' : 'village',
           world: makeWorld(props.filter(o => !OBST[o.kind].soft).map(o => o.box), [{ x: gate.x, y: gate.y, w: 2, h: 2 }]),
           ground: layers.ground, buildings: [], props, npcs, spots, parts: [], fx: [], texts: [], player: null, target: null, smokeT: 0 };
}
function paintRug(x, rx, ry, w, h, c1, c2) {
  x.fillStyle = '#1a1210'; x.fillRect(rx - 1, ry - 1, w + 2, h + 2);
  x.fillStyle = c1; x.fillRect(rx, ry, w, h);
  x.fillStyle = c2; x.fillRect(rx + 2, ry + 2, w - 4, 1); x.fillRect(rx + 2, ry + h - 3, w - 4, 1); x.fillRect(rx + 2, ry + 2, 1, h - 4); x.fillRect(rx + w - 3, ry + 2, 1, h - 4);
  for (let px = rx + 6; px < rx + w - 6; px += 8) { x.fillRect(px, ry + Math.floor(h / 2) - 1, 3, 1); x.fillRect(px + 1, ry + Math.floor(h / 2) - 2, 1, 3); }
}
// The practice floor: your own gear and a dummy that never hits back, with nothing to win or lose and no room needed.
// It doesn't fall; it just shakes off the damage. Leave from the pause menu.
Object.assign(ENEMIES, { dummy: { name: 'Practice Dummy', role: 'dummy', cls: 'medium', sprite: 'dummy', r: 6, speed: 0, hpM: 9000, dmgP: 0, kbRes: 0, colors: ['#d9b860', '#8a5a34', '#c0412e'], loot: [] } });
ROLES.dummy = (e, dt) => { e.vx = e.vy = e.kbx = e.kby = 0; e.stun = 0; if (e.hp < e.maxHp * .5) e.hp = e.maxHp; };
const PRACTICE = { id: 'practice', base: 'practice', practice: true, name: 'Practice', god: 'ares', arena: 'coliseum', rank: 0, tier: 1, mt: 1, waves: [{}], requires: [], reward: 0, stars: 1, desc: '' };
function startPractice() {
  startQuest(PRACTICE); q.phase = 'practice';
  const d = makeEnemy('dummy', tc(23), tc(11)); d.state = 'move'; q.enemies.push(d);
}
function endPractice() { fadeTo(() => enterPlace('coliseum', 'practice')); }
// Sitting down at a tavern table: you take the seat and stay there. Order from it if you like, or just walk off to get up.
function sitAt(seat) {
  if (townPeers().some(o => dist(o, seat) < 5)) { toast('Someone is already sitting there.'); return; }
  const p = V.player; p.x = seat.x; p.y = seat.y; p.face = seat.face; p.moving = false;
  V.seat = seat; V.target = null;
}

/* ---- the furniture ---- */
// A potion bottle and a mug standing on a surface at y (their bottom edge).
function drawBottle(x, y, col) {
  ctx.fillStyle = col[1]; ctx.fillRect(x, y - 4, 4, 4);                         // the body, its shaded side
  ctx.fillStyle = col[0]; ctx.fillRect(x, y - 4, 3, 3);
  ctx.fillStyle = col[2] || '#ffffff'; ctx.fillRect(x, y - 4, 1, 1);           // a glint
  ctx.fillStyle = '#d8d2c4'; ctx.fillRect(x + 1, y - 6, 2, 2);                 // the neck
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(x + 1, y - 7, 2, 1);                 // the cork
}
function drawMug(x, y) {
  ctx.fillStyle = '#6b7078'; ctx.fillRect(x, y - 5, 5, 5); ctx.fillRect(x + 5, y - 4, 1, 3);   // the mug and its handle
  ctx.fillStyle = '#9aa0a6'; ctx.fillRect(x, y - 5, 4, 4);
  ctx.fillStyle = '#f3e9d4'; ctx.fillRect(x, y - 6, 5, 2); ctx.fillRect(x + 1, y - 7, 2, 1);   // foam over the top
}
const PROP_ART = {
  counter(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx, sy + 1, 38, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 37, sy - 19, 74, 20);
    ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 36, sy - 13, 72, 13);
    ctx.fillStyle = '#5a3a22'; for (let x = sx - 34; x < sx + 36; x += 8) ctx.fillRect(x, sy - 13, 1, 13);
    ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 36, sy - 18, 72, 5); ctx.fillStyle = '#c09a63'; ctx.fillRect(sx - 36, sy - 18, 72, 1);
    // what's on the counter, drawn to its own shape (edges in a darker shade of its colour, no box around it)
    if (o.variant === 'market') Object.values(POTIONS).forEach((P, i) => { for (let k = 0; k < 2; k++) drawBottle(sx - 28 + i * 20 + k * 6, sy - 18, P.col); });
    else for (const mx of [sx - 26, sx - 4, sx + 18]) drawMug(mx, sy - 18);
  },
  table(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx, sy + 1, 14, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 10, sy - 6, 3, 7); ctx.fillRect(sx + 7, sy - 6, 3, 7);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 9, sy - 6, 1, 6); ctx.fillRect(sx + 8, sy - 6, 1, 6);
    ctx.fillStyle = K; ctx.fillRect(sx - 14, sy - 14, 28, 9); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 13, sy - 13, 26, 7); ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 13, sy - 13, 26, 2);
    const R = mulberry(o.seed); if (R() < .7) drawMug(sx - 7, sy - 13);
    ctx.fillStyle = '#b5a98f'; ctx.fillRect(sx + 1, sy - 14, 8, 2); ctx.fillStyle = '#e6e1d6'; ctx.fillRect(sx + 2, sy - 15, 6, 2); ctx.fillStyle = '#c35f2a'; ctx.fillRect(sx + 4, sy - 15, 2, 1);   // a plate with something on it
  },
  stool(o, sx, sy) {                                   // low, so someone sitting on it is in proportion
    pxEllipse(sx, sy, 6, 2, 'rgba(0,0,0,.3)'); ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 5, sy - 5, 10, 3); ctx.fillRect(sx - 4, sy - 2, 2, 2); ctx.fillRect(sx + 2, sy - 2, 2, 2);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 4, sy - 4, 8, 1); ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 3, sy - 2, 1, 2); ctx.fillRect(sx + 2, sy - 2, 1, 2);
  },
  barrel(o, sx, sy) {
    const K = OUTLINE, water = o.variant === 'water'; pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 7, sy - 14, 14, 15); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 6, sy - 13, 12, 13); ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 6, sy - 13, 3, 13);
    ctx.fillStyle = '#4b4f57'; ctx.fillRect(sx - 6, sy - 11, 12, 1); ctx.fillRect(sx - 6, sy - 4, 12, 1);
    ctx.fillStyle = water ? '#3f6ea8' : '#5a3a22'; ctx.fillRect(sx - 5, sy - 14, 10, 2); if (water) { ctx.fillStyle = '#7fb0e0'; ctx.fillRect(sx - 3, sy - 14, 3, 1); }
  },
  bed(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx + 2, sy + 1, 11, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 11, sy - 34, 22, 35); ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 10, sy - 33, 20, 33);
    ctx.fillStyle = '#e8dfca'; ctx.fillRect(sx - 9, sy - 31, 18, 29); ctx.fillStyle = '#f3ecdb'; ctx.fillRect(sx - 7, sy - 30, 14, 6);
    ctx.fillStyle = '#4f7fb5'; ctx.fillRect(sx - 9, sy - 20, 18, 18); ctx.fillStyle = '#6f9fd5'; ctx.fillRect(sx - 9, sy - 20, 18, 2); ctx.fillStyle = '#e9c04f'; ctx.fillRect(sx - 9, sy - 12, 18, 1);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 10, sy - 2, 20, 2);
  },
  chestbox(o, sx, sy) { pxEllipse(sx, sy + 1, 9, 2, 'rgba(0,0,0,.3)'); drawSpr('chest', 0, sx, sy, false); },
  dummy(o, sx, sy) { pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)'); drawSpr('dummy', 0, sx, sy, false); },
  firebowl(o, sx, sy) {                                // a bronze bowl on a tall stand, about a head taller than a person
    const K = OUTLINE, f = Math.floor(G.time * 7 + o.seed) % 3; pxEllipse(sx, sy + 1, 8, 2, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 2, sy - 18, 4, 19); ctx.fillRect(sx - 6, sy - 2, 12, 4); ctx.fillRect(sx - 8, sy - 24, 16, 7);
    ctx.fillStyle = '#7a6230'; ctx.fillRect(sx - 1, sy - 17, 2, 16); ctx.fillStyle = '#a8842a'; ctx.fillRect(sx - 1, sy - 17, 1, 16); ctx.fillRect(sx - 5, sy - 1, 10, 2);
    ctx.fillStyle = '#a8842a'; ctx.fillRect(sx - 7, sy - 23, 14, 5); ctx.fillStyle = '#d8ae3e'; ctx.fillRect(sx - 7, sy - 23, 14, 1); ctx.fillStyle = '#6b5a1f'; ctx.fillRect(sx - 7, sy - 19, 14, 1);
    ctx.fillStyle = '#c0412e'; ctx.fillRect(sx - 6, sy - 25, 12, 2);
    ctx.fillStyle = '#ff8a2b'; ctx.fillRect(sx - 5 + f, sy - 28, 8, 3); ctx.fillRect(sx - 3, sy - 31 - (f === 1 ? 1 : 0), 5, 3);
    ctx.fillStyle = '#ffd463'; ctx.fillRect(sx - 3 + f % 2, sy - 27, 4, 2); ctx.fillRect(sx - 1, sy - 29, 2 + f % 2, 2);
  },
  furnace(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx, sy + 1, 24, 3, 'rgba(0,0,0,.35)');
    ctx.fillStyle = K; ctx.fillRect(sx - 23, sy - 30, 46, 31); ctx.fillRect(sx - 7, sy - 44, 14, 15);
    ctx.fillStyle = '#6f685b'; ctx.fillRect(sx - 22, sy - 29, 44, 29); ctx.fillRect(sx - 6, sy - 43, 12, 14);
    ctx.fillStyle = '#5f594e'; for (let y = sy - 27; y < sy; y += 6) for (let x = sx - 22 + ((y - sy) / 6 % 2 ? 0 : 5); x < sx + 22; x += 10) ctx.fillRect(x, y, 9, 1);
    ctx.fillStyle = '#8f8470'; ctx.fillRect(sx - 22, sy - 29, 44, 1);
    ctx.fillStyle = K; ctx.fillRect(sx - 11, sy - 18, 22, 15); ctx.fillStyle = '#2a120a'; ctx.fillRect(sx - 10, sy - 17, 20, 14);
    ctx.fillStyle = Math.floor(G.time * 6) % 2 ? '#ff8a2b' : '#ffd463'; ctx.fillRect(sx - 9, sy - 5, 18, 2);
    flame(sx, sy - 5, 16, 8, o.seed);
    if (sc && Math.random() < .2) sc.parts.push({ x: o.x + rand(-3, 3), y: o.y - 46, vx: rand(-3, 3), vy: rand(-14, -8), g: 0, life: 1.6, max: 1.6, c: Math.random() < .5 ? '#8f8a82' : '#6f6a62', s: 2 });
  },
  armorstand(o, sx, sy) {
    const K = OUTLINE, metal = o.variant === 'iron' ? ['#8a909a', '#5a5e66', '#c7ccd1'] : ['#c9a032', '#8f6a1c', '#f3d77a'];
    pxEllipse(sx, sy + 1, 6, 2, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 1, sy - 22, 3, 23); ctx.fillRect(sx - 5, sy - 2, 11, 3); ctx.fillStyle = '#6b4528'; ctx.fillRect(sx, sy - 21, 1, 21);
    ctx.fillStyle = K; ctx.fillRect(sx - 6, sy - 22, 13, 13); ctx.fillStyle = metal[0]; ctx.fillRect(sx - 5, sy - 21, 11, 11); ctx.fillStyle = metal[1]; ctx.fillRect(sx + 2, sy - 21, 4, 11); ctx.fillStyle = metal[2]; ctx.fillRect(sx - 5, sy - 21, 11, 1);
    ctx.fillStyle = K; ctx.fillRect(sx - 4, sy - 30, 9, 8); ctx.fillStyle = metal[0]; ctx.fillRect(sx - 3, sy - 29, 7, 6); ctx.fillStyle = K; ctx.fillRect(sx - 2, sy - 26, 5, 1);
    ctx.fillStyle = '#c0412e'; ctx.fillRect(sx - 1, sy - 33, 3, 3);
  },
  shelf(o, sx, sy) {
    const K = OUTLINE; ctx.fillStyle = K; ctx.fillRect(sx - 21, sy - 30, 42, 31); ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 20, sy - 29, 40, 29);
    ctx.fillStyle = '#3e2716'; ctx.fillRect(sx - 18, sy - 27, 36, 9); ctx.fillRect(sx - 18, sy - 15, 36, 9);
    ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 20, sy - 18, 40, 2); ctx.fillRect(sx - 20, sy - 6, 40, 2);
    const R = mulberry(o.seed), cols = o.variant === 'potions' ? Object.values(POTIONS).map(P => P.col[0]) : ['#c35f2a', '#e9c04f', '#7fa548', '#d8ccb4', '#8a5a34'];
    for (const row of [sy - 25, sy - 13]) for (let x = sx - 17; x < sx + 16; x += 5) { if (R() < .2) continue; const c = cols[(R() * cols.length) | 0]; ctx.fillStyle = c; ctx.fillRect(x, row + 1, 3, 6); ctx.fillStyle = '#ffffff55'; ctx.fillRect(x, row + 1, 1, 2); }
  },
  fireplace(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx, sy + 1, 18, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 17, sy - 24, 34, 25); ctx.fillStyle = '#a99d86'; ctx.fillRect(sx - 16, sy - 23, 32, 23);
    ctx.fillStyle = '#8f8470'; for (let y = sy - 20; y < sy; y += 5) ctx.fillRect(sx - 16, y, 32, 1);
    ctx.fillStyle = '#c9bda4'; ctx.fillRect(sx - 17, sy - 25, 34, 3);
    ctx.fillStyle = K; ctx.fillRect(sx - 9, sy - 15, 18, 15); ctx.fillStyle = '#2a120a'; ctx.fillRect(sx - 8, sy - 14, 16, 14);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 6, sy - 3, 12, 2);
    flame(sx, sy - 3, 10, 7, o.seed);
  },
};

/* ---- the Tavern: a meal before a hunt ---- */
// One meal per hunt. It lasts your next hunt (online too) and is used up when that hunt starts; until then the menu is
// closed to you, so nobody pays twice. Small on purpose: about what one more refine level or a set bonus gives, so no
// monster needs to be any stronger for it. art: what you're seen eating or drinking.
// drops: the chance each part that falls brings a second one. Loot is shared, so one plate feeds the whole party, and it doesn't stack.
const MEALS = {
  stew:    { name: 'Shepherd’s Stew',   short: 'Stew',       food: true,  art: 'bowl',   price: 120, desc: '+10% health on your next hunt.', hp: .10 },
  skewers: { name: 'Lamb Skewers',      short: 'Skewers',    food: true,  art: 'skewer', price: 160, desc: '+6% damage on your next hunt.', dmg: .06 },
  bread:   { name: 'Olive Bread',       short: 'Olive bread', food: true, art: 'bread',  price: 120, desc: '+10% defense on your next hunt.', def: .10 },
  figs:    { name: 'Forager’s Figs',    short: 'Figs',       food: true,  art: 'figs',   price: 180, desc: '25% more drops on your next hunt.', drops: .25 },
  wine:    { name: 'Honeyed Wine',      short: 'Wine',       food: false, art: 'cup',    price: 140, desc: 'Your dash recharges 15% faster on your next hunt.', dash: .15 },
  barley:  { name: 'Mint Barley Water', short: 'Barley water', food: false, art: 'mug',  price: 140, desc: 'Your weapon skill recharges 12% faster on your next hunt.', skill: .12 },
};
function mealCost(id) { return rankPrice(MEALS[id].price); }
function orderMeal(id) {
  const s = G.save, M = MEALS[id]; if (!M || s.meal) return;                 // already eaten: nothing more until the next hunt
  const cost = mealCost(id); if (s.money < cost) return;
  s.money -= cost; s.meal = id; persist(true); netSendInfo();
  closePanel(); startEating(id);
}
function renderTavern() {
  const s = G.save, cur = s.meal && MEALS[s.meal];
  const card = ([id, M]) => {
    const cost = mealCost(id), mine = s.meal === id;
    return `<article class="gear${mine ? ' meal-on' : ''}"><div class="gear-head"><div><b>${esc(M.name)}</b></div></div>
      <p class="desc">${esc(M.desc)}</p>
      <div class="stats"><span>Price <b class="gold">${fmtMoney(cost)} dr</b></span></div>
      <div class="actions"><button class="btn small" type="button" data-meal="${id}" ${cur || s.money < cost ? 'disabled' : ''}>${mine ? 'You ate this' : cur ? 'You’ve already eaten' : 'Order'}</button></div></article>`;
  };
  const list = Object.entries(MEALS);
  return `<p class="muted" style="margin:0 0 12px">One meal or drink per hunt. It lasts your next hunt, then you can order again.</p>
    ${cur ? `<div class="unlock" style="margin:0 0 12px">You’ve already ${cur.food ? 'eaten' : 'had'} the ${esc(cur.name)}: ${esc(cur.desc)} Come back after your hunt.</div>` : ''}
    <p class="sub">Food</p><div class="grid meal-grid">${list.filter(([, M]) => M.food).map(card).join('')}</div>
    <p class="sub" style="margin-top:14px">Drinks</p><div class="grid meal-grid">${list.filter(([, M]) => !M.food).map(card).join('')}</div>`;
}
// Eating it, right there in the Tavern: a few bites (or sips), crumbs or drops, then a little tune and a sparkle.
// You stand still while you eat. V.eat = { meal, t, dur, bites: times left to play a bite sound }.
const eatState = id => { const M = MEALS[id]; return { meal: id, t: 0, dur: M.food ? 2.2 : 1.8, bites: M.food ? [.35, .95, 1.55] : [.45, 1.15] }; };
function startEating(id) {
  const p = V.player;
  if (!V.seat) p.face = Math.PI / 2;                   // seated, you keep facing the table
  p.moving = false; V.target = null;
  V.eat = eatState(id);
}
// One step of a meal, yours (sounds and the banner) or another player's in the same room (just the crumbs and the sparkle).
// Returns true when it's finished.
function eatStep(e, p, dt, mine) {
  const M = MEALS[e.meal]; e.t += dt;
  if (e.bites.length && e.t >= e.bites[0]) {
    e.bites.shift(); if (mine) Sound.play(M.food ? 'eat' : 'drink');
    const cols = M.food ? ['#c09a63', '#e9c04f', '#8a5a34'] : M.art === 'cup' ? ['#e9a030', '#ffd463'] : ['#c8e6c9', '#ffffff'];
    for (let i = 0; i < 5; i++) V.parts.push({ x: p.x + rand(-2, 4), y: p.y - 11, vx: rand(-14, 14), vy: rand(-18, -4), g: 90, life: .5, max: .5, c: cols[i % cols.length], s: 1 });
  }
  if (e.t < e.dur) return false;
  burst(p.x, p.y - 10, 16, ['#ffd463', '#fff6d8', '#9bbb55'], 70);
  return true;
}
function tickEating(dt) {
  const M = MEALS[V.eat.meal];
  if (!eatStep(V.eat, V.player, dt, true)) return;
  V.eat = null; Sound.play('jingle');
  banner(`${M.food ? 'You ate' : 'You drank'} the ${M.name}`, M.desc.replace(' on your next hunt.', ' on your next hunt'));
}
// The meal in someone's hand, going up to their mouth and back with each bite.
function drawEating(S, e = V.eat, p = V.player) {
  const M = MEALS[e.meal], [sx, sy] = S(p.x, p.y), K = OUTLINE, dir = Math.cos(p.face) < 0 ? -1 : 1, low = p.sitting ? -1 : 0;
  // from the hand (by the hip) up to the mouth and back, on the side you're facing
  const lift = Math.max(0, Math.sin(e.t * Math.PI / (M.food ? .6 : .7))), x = Math.round(sx + dir * (5 - lift * 3)), y = Math.round(sy - 6 + low - lift * 5);
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  if (M.art === 'bowl') { R(-3, -2, 7, 4, K); R(-2, -1, 5, 2, '#a3713f'); R(-2, -2, 5, 1, '#c35f2a'); if (Math.floor(e.t * 6) % 2) R(-1, -5, 1, 2, '#e6e1d6'); }
  else if (M.art === 'skewer') { R(-5, 0, 11, 1, '#c09a63'); for (const cx of [-4, -1, 2]) { R(cx, -2, 3, 4, K); R(cx + 1, -1, 1, 2, '#a3532a'); } }
  else if (M.art === 'bread') { R(-3, -2, 7, 4, K); R(-2, -1, 5, 2, '#d9a35a'); R(-1, -2, 3, 1, '#e9c27a'); R(0, -1, 1, 1, '#4e5a3a'); }
  else if (M.art === 'figs') { R(-4, 0, 9, 1, '#e6e1d6'); R(-3, 1, 7, 1, K); for (const cx of [-3, 1]) { R(cx, -3, 3, 3, '#6a3d86'); R(cx, -1, 3, 1, '#4a2a66'); R(cx, -3, 1, 1, '#a877c6'); R(cx + 1, -4, 1, 1, '#4e6e2b'); } }
  else if (M.art === 'cup') { R(-3, -3, 7, 3, K); R(-2, -3, 5, 2, '#c9a032'); R(-2, -3, 5, 1, '#e9a030'); R(0, 0, 1, 2, '#c9a032'); R(-1, 2, 3, 1, '#c9a032'); }
  else { R(-3, -4, 6, 7, K); R(-2, -3, 4, 5, '#9aa0a6'); R(-2, -4, 4, 1, '#c8e6c9'); R(2, -2, 2, 3, K); }
}
