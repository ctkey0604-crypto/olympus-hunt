/* ============================== WORLD ==================================== */
const OBST = {
  rock: { w: 14, h: 8 }, boulder: { w: 22, h: 12 }, cart: { w: 26, h: 10 }, tree: { w: 8, h: 6 }, olive: { w: 8, h: 6 },
  fence: { w: 40, h: 4 }, gatepost: { w: 14, h: 8 }, column: { w: 12, h: 8 }, brokencol: { w: 12, h: 8 }, brazier: { w: 8, h: 6 }, statue: { w: 12, h: 8 },
  slab: { w: 20, h: 10 }, pylon: { w: 10, h: 8 }, anvil: { w: 12, h: 6 }, fountain: { w: 30, h: 16 }, stall: { w: 28, h: 8 },
  crate: { w: 12, h: 8 }, amphora: { w: 8, h: 6 }, board: { w: 18, h: 4 },
  pine: { w: 8, h: 6 }, vine: { w: 26, h: 4 }, rosebush: { w: 12, h: 6 }, coral: { w: 10, h: 6 }, grave: { w: 10, h: 5 },
  crystal: { w: 10, h: 6 }, stump: { w: 10, h: 6 }, shell: { w: 14, h: 8 }, rack: { w: 18, h: 4 }, hearth: { w: 22, h: 10 }, gatedoors: { w: 48, h: 6 },
  obelisk: { w: 16, h: 12 }, tstatue: { w: 22, h: 10 }, tdoor: { w: 56, h: 8 },
};
const SPAWN_TILES = [[5, 5], [20, 4], [34, 5], [4, 13], [35, 13], [5, 21], [20, 21], [34, 21], [12, 4], [28, 4], [12, 21], [28, 21]];
// Spawn points and the start spot stretch to fit bigger arenas.
function spawnTiles() {
  if (WT === 40 && HT === 26) return SPAWN_TILES;
  return SPAWN_TILES.map(([x, y]) => [Math.round(3 + (x - 3) * (INNER.x1 - 3) / 33), Math.round(3 + (y - 3) * (INNER.y1 - 3) / 19)]);
}
function playerStart() { return [Math.floor(WT / 2), Math.floor(HT / 2) + 1]; }

function mkObstacle(kind, tx, ty, variant) {
  const o = OBST[kind], cx = tx * TILE + 8, cy = ty * TILE + 8;
  return { kind, variant, x: cx, y: cy, h: o.h, box: { x: cx - o.w / 2, y: cy - o.h / 2, w: o.w, h: o.h }, seed: Math.round(tx * 31 + ty * 7) };
}
function makeWorld(boxes, openRects = [], inner = INNER) {
  const grid = new Uint8Array(WT * HT);
  for (let ty = 0; ty < HT; ty++) for (let tx = 0; tx < WT; tx++)
    grid[ty * WT + tx] = (tx < inner.x0 || tx > inner.x1 || ty < inner.y0 || ty > inner.y1) ? 1 : 0;
  for (const r of openRects) for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) grid[ty * WT + tx] = 0;
  return { grid, boxes, wt: WT, ht: HT };
}
function solidTile(tx, ty) { const w = sc.world; if (tx < 0 || ty < 0 || tx >= w.wt || ty >= w.ht) return true; return w.grid[ty * w.wt + tx] === 1; }
function pointBlocked(x, y) {
  if (solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) return true;
  for (const b of sc.world.boxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  return false;
}
function raycast(x, y, ang, max, margin = 8) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let d = 0; d <= max; d += 3) if (pointBlocked(x + dx * (d + margin), y + dy * (d + margin))) return Math.max(0, d);
  return max;
}
function resolveCircleBox(e, b) {
  const cx = clamp(e.x, b.x, b.x + b.w), cy = clamp(e.y, b.y, b.y + b.h);
  const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= e.r * e.r) return false;
  if (d2 === 0) {
    const l = e.x - b.x, r = b.x + b.w - e.x, t = e.y - b.y, bt = b.y + b.h - e.y, m = Math.min(l, r, t, bt);
    if (m === l) e.x = b.x - e.r; else if (m === r) e.x = b.x + b.w + e.r; else if (m === t) e.y = b.y - e.r; else e.y = b.y + b.h + e.r;
    return true;
  }
  const d = Math.sqrt(d2), push = e.r - d; e.x += dx / d * push; e.y += dy / d * push; return true;
}
// Moves an entity with collision. Flyers ignore obstacles and only stay inside the arena.
function moveEntity(e, mx, my, fly = false) {
  let blocked = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 3));
  for (let i = 0; i < steps; i++) {
    e.x += mx / steps; e.y += my / steps;
    if (fly) {
      const nx = clamp(e.x, IPX.minX + e.r, IPX.maxX - e.r), ny = clamp(e.y, IPX.minY + e.r, IPX.maxY - e.r);
      if (nx !== e.x || ny !== e.y) blocked = true; e.x = nx; e.y = ny; continue;
    }
    const x0 = Math.floor((e.x - e.r) / TILE), x1 = Math.floor((e.x + e.r) / TILE), y0 = Math.floor((e.y - e.r) / TILE), y1 = Math.floor((e.y + e.r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
      if (solidTile(tx, ty) && resolveCircleBox(e, { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })) blocked = true;
    for (const b of sc.world.boxes) if (resolveCircleBox(e, b)) blocked = true;
  }
  return blocked;
}

/* ---- terrain themes ---- */
const HEDGE = { border: 'hedge', hedgeBase: '#26381a', hedge: ['#2f4720', '#3b5a26', '#4a6e2e', '#2a3f1c'], hedgeHi: '#5f8a38' };
const PINES = { border: 'hedge', hedgeBase: '#101c0e', hedge: ['#1a2e16', '#22391c', '#2b4724', '#152612'], hedgeHi: '#3c6a30' };
const SEA = { border: 'sea', sea: ['#2c6a8a', '#3b82a3', '#5aa3c0', '#e6f2ff'] };
const THEMES = {
  road:      { floor: 'grass', base: '#5b7832', shades: ['#506a2c', '#69883b', '#486127'], flowers: 90, road: true, ...HEDGE },
  pasture:   { floor: 'grass', base: '#64883a', shades: ['#59793a', '#759a42', '#4e6b2d'], flowers: 220, patches: ['#8a6b42', '#977649'], ...HEDGE },
  grove:     { floor: 'grass', base: '#8a9150', shades: ['#7d8547', '#9aa05c', '#737a40'], flowers: 50, patches: ['#a08657', '#937a4d'],
               border: 'drystone', stoneBase: '#4f4a40', stone: ['#9b9384', '#b2aa99', '#857d6e', '#a39b8b'], stoneHi: '#cfc8b8' },
  pass:      { floor: 'rock', base: '#857057', shades: ['#7a654d', '#917b60', '#6e5a44', '#9a8468'], crack: '#5c4a38', pebble: '#a8957a', moss: '#6b7d3a',
               border: 'cliff', rockBase: '#4a3c30', rocks: ['#5a4a3b', '#6b5a48', '#3e3228', '#77654f'], rockHi: '#8a775f' },
  storm:     { floor: 'rock', base: '#4c5160', shades: ['#444957', '#575c6b', '#3d414e', '#60667a'], crack: '#2c2f38', pebble: '#727a8c', puddles: '#34445e',
               border: 'cliff', rockBase: '#1f222a', rocks: ['#353946', '#424755', '#2a2d37', '#4d5262'], rockHi: '#6b7286', weather: 'storm' },
  forge:     { floor: 'rock', base: '#5a3f33', shades: ['#4f362b', '#664a3c', '#45302a', '#6e5040'], crack: '#2c1a14', pebble: '#7d5d4a', lava: 16,
               border: 'cliff', rockBase: '#1c110c', rocks: ['#3a2722', '#47302a', '#2c1d19', '#553a30'], rockHi: '#7a5444', weather: 'embers' },
  temple:    { floor: 'marble', light: '#d3c7ad', dark: '#c3b69b', fleck: ['#c9bca1', '#b8ab90'], grout: '#a2967d', crack: '#8f846c', moss: '#7f9a4a', cracks: .12, medallion: ['#1a1210', '#c35f2a'],
               border: 'wall', wallBase: '#8f8470', wall: ['#a99d86', '#9b8f78'], wallHi: '#bdb29b', frieze: '#c35f2a' },
  ruins:     { floor: 'marble', light: '#c9bfa8', dark: '#b6ab92', fleck: ['#bfb49c', '#a99e86'], grout: '#968b74', crack: '#7f7563', moss: '#6f8a3e', cracks: .3, missing: .16,
               border: 'wall', wallBase: '#7d7362', wall: ['#988d78', '#8a7f6b'], wallHi: '#ada28c', frieze: '#c35f2a', broken: true },
  parthenon: { floor: 'marble', light: '#dcd8cc', dark: '#cdc8ba', fleck: ['#d3cec1', '#c2bdaf'], grout: '#aaa597', crack: '#959082', cracks: .08, medallion: ['#1a1210', '#4f8fc7'],
               border: 'wall', wallBase: '#8d8a80', wall: ['#b3afa3', '#a4a094'], wallHi: '#c9c5b9', frieze: '#4f8fc7' },
  summit:    { floor: 'marble', light: '#f0e8d3', dark: '#e4d8b8', fleck: ['#eae0c6', '#d9cca8'], grout: '#c9a958', crack: '#c9b98f', cracks: .04, medallion: ['#a8842a', '#4f8fc7'],
               border: 'clouds', weather: 'storm' },
  village:   { floor: 'grass', base: '#6a8c3c', shades: ['#5e7d35', '#79a046', '#53702f'], flowers: 160, plaza: true,
               border: 'drystone', stoneBase: '#4f4a40', stone: ['#a39b8b', '#b8b0a0', '#8f8778', '#aca494'], stoneHi: '#d4cdbd' },
  hall:      { floor: 'marble', light: '#e6dcc6', dark: '#d8ccb2', fleck: ['#ded3bb', '#cbbfa5'], grout: '#b0a48a', crack: '#9c9078', cracks: .05, medallion: ['#3a2416', '#cf6a2f'], runner: '#8f2a1c',
               border: 'wall', wallBase: '#7d7362', wall: ['#b5a98f', '#a69a80'], wallHi: '#d0c4aa', frieze: '#cf6a2f' },
  // ---- v3 ----
  forest:    { floor: 'grass', base: '#3f5f2a', shades: ['#375425', '#4a6d30', '#30491f'], flowers: 30, patches: ['#5a4630', '#4e3d2a'], ...PINES },
  glade:     { floor: 'grass', base: '#7a9a40', shades: ['#6e8c39', '#88a84a', '#637f33'], flowers: 180, flowerCols: ['#ebc152', '#f0e4cc', '#ffd463'], ...PINES },
  moon:      { floor: 'marble', light: '#c8cdd8', dark: '#b4bac8', fleck: ['#bfc4d0', '#a8aebc'], grout: '#8f96a8', crack: '#7f8698', cracks: .08, medallion: ['#1a2442', '#d5dbe5'],
               border: 'wall', wallBase: '#5f6878', wall: ['#8f98a8', '#7f8898'], wallHi: '#b5bcc8', frieze: '#d5dbe5', night: true },
  vineyard:  { floor: 'grass', base: '#7a8a3c', shades: ['#6e7d36', '#869843', '#647232'], flowers: 40, patches: ['#8a6b42', '#7c5f3a'], rows: '#6a5232',
               border: 'drystone', stoneBase: '#4f4a40', stone: ['#9b9384', '#b2aa99', '#857d6e', '#a39b8b'], stoneHi: '#cfc8b8' },
  thicket:   { floor: 'grass', base: '#4a6430', shades: ['#41582a', '#557238', '#3a4f25'], flowers: 20, patches: ['#4e3d2a', '#5a4630'], ...PINES },
  theater:   { floor: 'marble', light: '#e0d0b8', dark: '#d0bfa4', fleck: ['#d8c7ad', '#c4b399'], grout: '#ab9a80', crack: '#958670', cracks: .12, medallion: ['#1a1210', '#7a4f9c'],
               border: 'wall', wallBase: '#8a7a64', wall: ['#b5a48a', '#a6957b'], wallHi: '#cbbaa0', frieze: '#7a4f9c' },
  rose:      { floor: 'grass', base: '#6a9a48', shades: ['#5e8a40', '#76a852', '#557c3a'], flowers: 300, flowerCols: ['#f2a7c0', '#e88aa8', '#ffffff', '#c76d8e'],
               border: 'hedge', hedgeBase: '#1f3a18', hedge: ['#2f4f22', '#3b6028', '#4a7230', '#284620'], hedgeHi: '#f2a7c0', weather: 'petals' },
  cythera:   { floor: 'marble', light: '#f0dcd8', dark: '#e4cac4', fleck: ['#ead2ce', '#dcc0ba'], grout: '#c4a8a2', crack: '#b0948e', cracks: .06, medallion: ['#c76d8e', '#f2a7c0'], ...SEA },
  dryland:   { floor: 'rock', base: '#a08a5a', shades: ['#947e52', '#ac9664', '#88744a', '#b8a272'], crack: '#6a5a3a', pebble: '#c0aa7a',
               border: 'cliff', rockBase: '#5a4a30', rocks: ['#7a6440', '#8a744c', '#6a5636', '#9a8458'], rockHi: '#b09a6a' },
  cave:      { floor: 'rock', base: '#3a4238', shades: ['#343b32', '#424a40', '#2e352c', '#4a5248'], crack: '#20261e', pebble: '#55604f', moss: '#4e6b2d',
               border: 'cliff', rockBase: '#151a14', rocks: ['#262c24', '#2e352c', '#1e231c', '#363e34'], rockHi: '#4a5446', night: true },
  delphi:    { floor: 'marble', light: '#efe6cc', dark: '#e2d6b4', fleck: ['#e8dec2', '#d6caa8'], grout: '#c9a958', crack: '#b8a47a', cracks: .05, medallion: ['#a8842a', '#ffd463'],
               border: 'wall', wallBase: '#9a8a64', wall: ['#c4b48e', '#b5a580'], wallHi: '#ddd0aa', frieze: '#c9a032' },
  crossroads:{ floor: 'rock', base: '#3a3448', shades: ['#342e42', '#423a52', '#2e283a', '#4a4258'], crack: '#1f1a2a', pebble: '#5a5470',
               border: 'cliff', rockBase: '#120e1a', rocks: ['#241e30', '#2c2638', '#1c1828', '#342e40'], rockHi: '#4a4458', night: true },
  battlefield:{ floor: 'rock', base: '#6a4a3a', shades: ['#604234', '#745242', '#563a2e', '#7c5a48'], crack: '#3a2418', pebble: '#8a6a54', puddles: '#5a2018',
               border: 'cliff', rockBase: '#2a1a12', rocks: ['#4a3024', '#563a2c', '#3e281e', '#624434'], rockHi: '#7a5442' },
  warpit:    { floor: 'rock', base: '#b89a6a', shades: ['#ac8e60', '#c4a674', '#a08456', '#ceb080'], crack: '#8a6a42', pebble: '#d4ba8a',
               border: 'wall', wallBase: '#4a3a30', wall: ['#6a5444', '#5c483a'], wallHi: '#86705c', frieze: '#c0412e' },
  beach:     { floor: 'rock', base: '#d8c08a', shades: ['#cfb57e', '#e2cb96', '#c4aa72', '#e8d4a0'], crack: '#b89c66', pebble: '#f3e9d4', ...SEA },
  reef:      { floor: 'rock', base: '#b8a87a', shades: ['#ac9c70', '#c4b486', '#a09066', '#ccbc8e'], crack: '#8a7a54', pebble: '#e07a3a', puddles: '#4a8a90', ...SEA },
  seatemple: { floor: 'marble', light: '#cfe4e0', dark: '#bcd6d0', fleck: ['#c6ddd8', '#b0ccc6'], grout: '#8ab0a8', crack: '#7aa098', cracks: .1, moss: '#3c8f82', medallion: ['#1a4a44', '#57c2b0'], ...SEA },
  palacegarden:{ floor: 'grass', base: '#6a9a48', shades: ['#5e8a40', '#76a852', '#557c3a'], flowers: 200, flowerCols: ['#5b9bd5', '#ffffff', '#e9c04f', '#f2a7c0'],
               border: 'hedge', hedgeBase: '#1f3a18', hedge: ['#2f4f22', '#3b6028', '#4a7230', '#284620'], hedgeHi: '#e9c04f' },
  palace:    { floor: 'marble', light: '#e8ecf2', dark: '#d8dee8', fleck: ['#e0e6ee', '#ccd4e0'], grout: '#a8b0c0', crack: '#949cac', cracks: .04, medallion: ['#2c5684', '#e9c04f'],
               border: 'wall', wallBase: '#8a92a2', wall: ['#b8c0ce', '#a8b0be'], wallHi: '#d6dce6', frieze: '#5b9bd5' },
  workshop:  { floor: 'rock', base: '#5a4a3a', shades: ['#504234', '#665442', '#46392c', '#6e5c48'], crack: '#2c2018', pebble: '#7a6a54',
               border: 'wall', wallBase: '#3a302a', wall: ['#5a4a3a', '#4a3c30'], wallHi: '#7a6450', frieze: '#ff8a2b', weather: 'embers' },
  volcano:   { floor: 'rock', base: '#3a2620', shades: ['#32201a', '#442e26', '#2a1a14', '#4c342a'], crack: '#140a06', pebble: '#5a3e32', lava: 28,
               border: 'cliff', rockBase: '#120806', rocks: ['#2a1a14', '#34201a', '#22140e', '#3e2820'], rockHi: '#5a3a2c', weather: 'embers' },
  asphodel:  { floor: 'grass', base: '#6a7a6a', shades: ['#606f60', '#748474', '#566456'], flowers: 260, flowerCols: ['#f3e9d4', '#d8dcd0', '#c8b8ff'],
               border: 'drystone', stoneBase: '#2a2a30', stone: ['#4a4a52', '#56565e', '#3e3e46', '#5e5e66'], stoneHi: '#7a7a82', weather: 'fog' },
  styx:      { floor: 'rock', base: '#2c3434', shades: ['#262e2e', '#323a3a', '#202828', '#384040'], crack: '#141a1a', pebble: '#4a5454', puddles: '#1f3a32',
               border: 'sea', sea: ['#14262a', '#1c3238', '#2a4a50', '#7fd0c8'], weather: 'fog', night: true },
  underworld:{ floor: 'marble', light: '#3a3640', dark: '#2e2a34', fleck: ['#34303a', '#28242e'], grout: '#1a181e', crack: '#4a4652', cracks: .1, medallion: ['#0e0e12', '#7fe08a'],
               border: 'wall', wallBase: '#141218', wall: ['#2e2a34', '#262230'], wallHi: '#4a4652', frieze: '#7fe08a', night: true },
  dream:     { floor: 'grass', base: '#3a3a6a', shades: ['#34345e', '#424276', '#2e2e54'], flowers: 160, flowerCols: ['#c8b8ff', '#ffffff', '#9a6bc0'],
               border: 'hedge', hedgeBase: '#14142a', hedge: ['#24244a', '#2c2c56', '#343462', '#1e1e40'], hedgeHi: '#c8b8ff', weather: 'fog', night: true },
};

// Under the temple: the Titans' hall and their arenas.
Object.assign(THEMES, {
  skyvault:  { floor: 'rock', base: '#3c4052', shades: ['#363a4b', '#454a5e', '#2f3342', '#50566c'], crack: '#22252f', pebble: '#6a7088', stars: 140, border: 'void', night: true },
  dawnhall:  { floor: 'marble', light: '#f6ecd0', dark: '#ecdcb4', fleck: ['#f0e2c0', '#e0cca0'], grout: '#d4a84a', crack: '#c9a46b', cracks: .04, medallion: ['#ff8a2b', '#ffd463'],
               border: 'wall', wallBase: '#a8842a', wall: ['#e9c04f', '#d8ae3e'], wallHi: '#fff0b0', frieze: '#ff8a2b' },
  riverdeep: { floor: 'rock', base: '#3e6a68', shades: ['#38605e', '#467472', '#325654', '#4e7e7a'], crack: '#22403e', pebble: '#7fd0c8', puddles: '#2c5a70', border: 'sea', sea: ['#14303a', '#1c4450', '#2a6070', '#bfe8f0'] },
  starfield: { floor: 'marble', light: '#1e2a4a', dark: '#1a2442', fleck: ['#22305a', '#16203a'], grout: '#0e1428', crack: '#2c3a6a', cracks: .02, stars: 260, medallion: ['#0e1428', '#e6f2ff'], border: 'void', night: true },
  memorywell:{ floor: 'marble', light: '#3a3448', dark: '#322c40', fleck: ['#403a50', '#2c2638'], grout: '#221e2c', crack: '#5a5070', cracks: .12, medallion: ['#1a1622', '#c8b8ff'],
               border: 'wall', wallBase: '#1a1622', wall: ['#3a3448', '#322c40'], wallHi: '#5a5070', frieze: '#c8b8ff', weather: 'fog', night: true },
  lawcourt:  { floor: 'marble', light: '#eae6dc', dark: '#dcd6c8', fleck: ['#e2ddd0', '#d0c9b8'], grout: '#b5ac98', crack: '#a39a86', cracks: .03, medallion: ['#a8842a', '#f3e9d4'],
               border: 'wall', wallBase: '#9a9284', wall: ['#cfc8b8', '#c2bba9'], wallHi: '#ece6d8', frieze: '#e9c04f' },
  diktecave: { floor: 'rock', base: '#4a4232', shades: ['#433b2c', '#524a38', '#3c3428', '#5a5240'], crack: '#28221a', pebble: '#6a604a', moss: '#5a7a32',
               border: 'cliff', rockBase: '#16120c', rocks: ['#2c261c', '#342e22', '#241e16', '#3c3428'], rockHi: '#544a38', night: true },
  tartarus:  { floor: 'rock', base: '#2a1e22', shades: ['#241a1e', '#302428', '#1e1418', '#382a2e'], crack: '#0e080a', pebble: '#4a3438', lava: 34,
               border: 'cliff', rockBase: '#0a0608', rocks: ['#1e1418', '#261a1e', '#160e12', '#2e2226'], rockHi: '#4a3438', weather: 'embers', night: true },
  titanhall: { floor: 'marble', light: '#3a3640', dark: '#322e38', fleck: ['#403c46', '#2a2630'], grout: '#1e1c22', crack: '#4a4652', cracks: .08, medallion: ['#141218', '#b48cff'], runner: '#3a1a5a',
               border: 'wall', wallBase: '#141218', wall: ['#3a3640', '#322e38'], wallHi: '#56525e', frieze: '#a8842a', night: true },
});
function genLayers(themeKey, secret, opts = {}) {
  const T = THEMES[themeKey], R = mulberry(hashStr(themeKey + (opts.seed || '')));
  const inner = opts.inner || IPX;
  const floor = mkCanvas(WORLD_W, WORLD_H); paintFloor(floor.getContext('2d'), T, R, opts.axis);
  const border = mkCanvas(WORLD_W, WORLD_H), bx = border.getContext('2d'); paintBorder(bx, T, R, inner);
  const ground = mkCanvas(WORLD_W, WORLD_H), gx = ground.getContext('2d');
  gx.drawImage(floor, 0, 0);
  let cover = null, rect = null;
  if (secret) {
    rect = { x: secret.x * TILE, y: secret.y * TILE, w: secret.w * TILE, h: secret.h * TILE };
    cover = mkCanvas(rect.w, rect.h); cover.getContext('2d').drawImage(border, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    bx.clearRect(rect.x, rect.y, rect.w, rect.h);
    gx.fillStyle = 'rgba(0,0,0,.2)'; gx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  if (opts.gate) { const gp = opts.gate.pad || 0; const lip = opts.gate.lip || 0; bx.clearRect(opts.gate.x * TILE - gp, opts.gate.y * TILE + lip, opts.gate.w * TILE + gp * 2, WORLD_H); }     // the gateposts are objects (gatepost), placed by the village and temple
  if (opts.gate) paintGateway(gx, opts.gate, inner, R, !!opts.gateRoad);
  gx.drawImage(border, 0, 0);
  gx.fillStyle = 'rgba(0,0,0,.14)'; gx.fillRect(inner.minX, inner.minY, inner.maxX - inner.minX, 3); gx.fillRect(inner.minX, inner.minY, 3, inner.maxY - inner.minY);
  if (secret) paintHint(gx, T, secret, R);
  return { ground, cover, rect };
}
// ax: the x the carpet and the floor medallion are centred on (the room's middle unless a place says otherwise).
function paintFloor(x, T, R, ax = WORLD_W / 2) {
  const W = WORLD_W, H = WORLD_H;
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); };
  const pick = a => a[(R() * a.length) | 0];
  const blob = (cx, cy, rx, ry, cols, keep = .92) => { for (let py = -ry; py <= ry; py++) { const w = rx * Math.sqrt(Math.max(0, 1 - (py / ry) ** 2)); for (let px = -w; px <= w; px++) if (R() < keep) dot(cx + px, cy + py, pick(cols)); } };
  if (T.floor === 'grass') {
    x.fillStyle = T.base; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 8; i++) dot(R() * W, R() * H, pick(T.shades));
    for (let i = 0; i < 380; i++) { const px = (R() * W) | 0, py = (R() * H) | 0, col = R() < .5 ? T.shades[1] : T.shades[2]; dot(px, py, col, 1, 2); dot(px + 2, py, col, 1, 2); dot(px + 1, py - 1, col, 1, 2); }
    const fl = T.flowerCols || ['#f0e4cc', '#ebc152', '#d9493b', '#b58fd6'];
    for (let i = 0; i < (T.flowers || 0); i++) { const px = R() * W, py = R() * H, col = pick(fl); dot(px, py, col); if (R() < .3) dot(px + 1, py + 1, col); }
    if (T.patches) for (let i = 0; i < 7; i++) blob(80 + R() * (W - 160), 80 + R() * (H - 160), 14 + R() * 18, 8 + R() * 10, T.patches);
    if (T.rows) for (let py = 72; py < H - 60; py += 40) for (let px = 60; px < W - 60; px++) { if (R() < .85) dot(px, py, T.rows); if (R() < .1) dot(px, py - 1, '#4e6e2b'); }
    if (T.road) {
      const cyAt = px => H / 2 + Math.sin(px / 70) * 14 + Math.sin(px / 23) * 3;
      for (let px = 0; px < W; px++) {
        const cy = cyAt(px), hw = 17 + Math.sin(px / 11) * 1.5 + Math.sin(px / 5) * .8;
        for (let py = Math.floor(cy - hw); py <= cy + hw; py++) dot(px, py, Math.abs(py - cy) > hw - 2 ? '#7f6239' : (R() < .14 ? '#9a774a' : '#a8834f'));
        if (px % 2 === 0) { dot(px, cy - 6, '#93703f'); dot(px, cy + 6, '#93703f'); }
      }
      for (let i = 0; i < 300; i++) { const px = R() * W, cy = cyAt(px); dot(px, cy + (R() - .5) * 30, R() < .5 ? '#7c5f3a' : '#c09a63'); }
    }
    if (T.plaza) paintCobbles(x, R);
  } else if (T.floor === 'rock') {
    x.fillStyle = T.base; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 6; i++) dot(R() * W, R() * H, pick(T.shades));
    for (let i = 0; i < 32; i++) { let px = R() * W, py = R() * H; for (let k = 0; k < 26; k++) { dot(px, py, T.crack); px += R() * 2 - .5; py += R() * 2 - 1; } }
    for (let i = 0; i < 320; i++) { const px = R() * W, py = R() * H; dot(px, py, T.pebble, 2, 1); dot(px, py + 1, T.crack, 2, 1); }
    if (T.moss) for (let i = 0; i < 60; i++) { const px = R() * W, py = R() * H; dot(px, py, T.moss, 1, 2); dot(px + 1, py + 1, T.moss); }
    if (T.puddles) for (let i = 0; i < 9; i++) { const cx = R() * W, cy = R() * H; blob(cx, cy, 8 + R() * 10, 3 + R() * 3, [T.puddles], 1); dot(cx - 3, cy - 1, '#ffffff22', 4, 1); }
    if (T.lava) for (let i = 0; i < T.lava; i++) {
      let px = R() * W, py = R() * H;
      for (let k = 0; k < 40; k++) { dot(px - 1, py, '#2c1a14', 3, 1); dot(px, py, R() < .2 ? '#ffd463' : '#ff7a2b'); px += R() * 2 - .4; py += R() * 2 - 1; }
    }
  } else if (T.floor === 'marble') {
    for (let ty = 0; ty < H / TILE; ty++) for (let tx = 0; tx < W / TILE; tx++) {
      const X = tx * TILE, Y = ty * TILE;
      if (T.missing && R() < T.missing) {
        x.fillStyle = '#8a7a5c'; x.fillRect(X, Y, TILE, TILE);
        for (let i = 0; i < 30; i++) dot(X + R() * TILE, Y + R() * TILE, R() < .5 ? '#6f8a3e' : '#7c6c50');
        continue;
      }
      const light = (tx + ty) % 2 === 0;
      x.fillStyle = light ? T.light : T.dark; x.fillRect(X, Y, TILE, TILE);
      for (let i = 0; i < 18; i++) dot(X + R() * TILE, Y + R() * TILE, light ? T.fleck[0] : T.fleck[1]);
      x.fillStyle = T.grout; x.fillRect(X, Y, TILE, 1); x.fillRect(X, Y, 1, TILE);
      if (R() < (T.cracks || .1)) { let px = X + R() * TILE, py = Y + R() * TILE; for (let k = 0; k < 10; k++) { dot(px, py, T.crack); px += R() * 2 - .7; py += R() * 2 - 1; } }
      if (T.moss && R() < .1) for (let k = 0; k < 6; k++) dot(X + R() * 4, Y + R() * TILE, T.moss);
    }
    if (T.runner) { x.fillStyle = '#1a1210'; x.fillRect(ax - 25, 0, 50, H); x.fillStyle = T.runner; x.fillRect(ax - 24, 0, 48, H); x.fillStyle = '#e9c04f'; x.fillRect(ax - 21, 0, 1, H); x.fillRect(ax + 20, 0, 1, H); }
    if (T.medallion) {
      const cx = ax, cy = H / 2 + 8, [dk, ac] = T.medallion;
      const ring = (r0, r1, col) => { for (let py = -r1; py <= r1; py++) for (let px = -r1; px <= r1; px++) { const d = Math.hypot(px, py); if (d >= r0 && d <= r1) dot(cx + px, cy + py, col); } };
      ring(0, 46, dk); ring(36, 40, ac); ring(41, 46, dk); ring(0, 30, ac); ring(0, 22, dk);
      for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; dot(cx + Math.cos(an) * 26, cy + Math.sin(an) * 26, dk, 2, 2); }
      for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2 + .2; dot(cx + Math.cos(an) * 12, cy + Math.sin(an) * 12, ac, 2, 2); }
    }
  }
  if (T.stars) for (let i = 0; i < T.stars; i++) { const px = R() * W, py = R() * H, c = R() < .15 ? '#ffd463' : R() < .5 ? '#ffffff' : '#9fb8d8'; dot(px, py, c); if (R() < .08) { dot(px - 1, py, c); dot(px + 1, py, c); dot(px, py - 1, c); dot(px, py + 1, c); } }
}
// Village paths: plaza around the fountain and roads to every door and the gate.
function isPath(px, py) {
  const dx = (px - 328) / 112, dy = (py - 240) / 74;
  if (dx * dx + dy * dy < 1) return true;
  if (px >= 304 && px < 352 && py > 120) return true;          // the main street
  if (py > 200 && py < 238 && px > 100 && px < 560) return true;
  if (px > 102 && px < 138 && py > 200 && py < 336) return true;
  if (px > 518 && px < 554 && py > 200 && py < 336) return true;
  return false;
}
function paintCobbles(x, R) {
  const cols = ['#b5ab98', '#a69c88', '#c2b8a4', '#ada390'];
  for (let py = 0; py < WORLD_H; py += 4) for (let px = (py / 4 % 2) * 3; px < WORLD_W; px += 6) {
    if (!isPath(px + 3, py + 2)) continue;
    x.fillStyle = '#7f7765'; x.fillRect(px, py, 6, 4);
    x.fillStyle = cols[(R() * cols.length) | 0]; x.fillRect(px, py, 5, 3);
    if (R() < .3) { x.fillStyle = '#d6ccb8'; x.fillRect(px, py, 2, 1); }
  }
}
function paintBorder(x, T, R, B = IPX) {
  const W = WORLD_W, H = WORLD_H;
  const inB = (px, py) => px < B.minX || px >= B.maxX || py < B.minY || py >= B.maxY;
  const pick = a => a[(R() * a.length) | 0];
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); };
  const fill = col => { x.fillStyle = col; x.fillRect(0, 0, W, B.minY); x.fillRect(0, B.maxY, W, H - B.maxY); x.fillRect(0, 0, B.minX, H); x.fillRect(B.maxX, 0, W - B.maxX, H); };
  const disc = (cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy++) { const w = Math.sqrt(r * r - yy * yy); x.fillRect((cx - w) | 0, (cy + yy) | 0, (w * 2) | 0, 1); } };
  // bricks and stones stop flush at the edge of the floor instead of poking teeth into it
  const clipOut = () => { x.save(); x.beginPath(); x.rect(0, 0, W, H); x.rect(B.minX, B.minY, B.maxX - B.minX, B.maxY - B.minY); x.clip('evenodd'); };
  let edge = '#140d0b';
  if (T.border === 'hedge') {
    fill(T.hedgeBase);
    for (let i = 0; i < 2200; i++) { const px = R() * W, py = R() * H; if (!inB(px, py)) continue; const r = 3 + R() * 5; disc(px, py, r, pick(T.hedge)); if (R() < .4) dot(px - 1, py - r + 1, T.hedgeHi, 2, 1); }
    edge = '#0e160a';
  } else if (T.border === 'cliff') {
    fill(T.rockBase);
    for (let i = 0; i < 1500; i++) { const px = R() * W, py = R() * H; if (!inB(px, py)) continue; const w = 4 + R() * 9, h = 3 + R() * 7; dot(px, py, pick(T.rocks), w | 0, h | 0); dot(px, py, T.rockHi, w | 0, 1); }
  } else if (T.border === 'drystone') {
    fill(T.stoneBase); clipOut();
    for (let py = 0; py < H; py += 6) for (let px = -(R() * 8 | 0); px < W;) {
      const w = 7 + (R() * 7 | 0);
      if (inB(px + w / 2, py + 3)) { dot(px, py, pick(T.stone), w - 1, 5); dot(px, py, T.stoneHi, w - 1, 1); }
      px += w;
    }
    x.restore();
  } else if (T.border === 'wall') {
    fill(T.wallBase); clipOut();
    for (let py = 0; py < H; py += 8) for (let px = ((py / 8) % 2) * 8; px < W; px += 16) {
      if (!inB(px + 4, py + 4)) continue;
      if (T.broken && R() < .12) { dot(px, py, '#5e5545', 15, 7); continue; }
      dot(px, py, pick(T.wall), 15, 7); dot(px, py, T.wallHi, 15, 1);
    }
    x.restore();
    const fy = B.minY - 22; dot(0, fy, '#1a1210', W, 10);
    for (let px = 0; px < W; px += 6) { x.fillStyle = T.frieze; x.fillRect(px, fy + 1, 5, 1); x.fillRect(px + 4, fy + 1, 1, 5); x.fillRect(px + 1, fy + 5, 4, 1); x.fillRect(px + 1, fy + 3, 1, 3); x.fillRect(px + 1, fy + 3, 2, 1); x.fillRect(px, fy + 7, 6, 1); }
    if (T.broken) for (let i = 0; i < 40; i++) { let px = R() * W, py = R() * H; if (!inB(px, py)) continue; for (let k = 0; k < 8; k++) { dot(px, py, '#4a4236'); px += R() * 2 - 1; py += R() * 2 - .5; } }
  } else if (T.border === 'clouds') {
    fill('#b9c1cf');
    for (let i = 0; i < 1700; i++) { const px = R() * W, py = R() * H; if (!inB(px, py)) continue; disc(px, py, 3 + R() * 7, pick(['#ffffff', '#eef1f6', '#d5dbe5', '#c4ccd9'])); }
    for (let i = 0; i < 70; i++) { const px = R() * W, py = R() * H; if (inB(px, py)) dot(px, py, '#e9c04f'); }
    edge = '#8f98a8';
  } else if (T.border === 'void') {                     // the edge of the world: nothing but stars
    fill('#070912');
    for (let i = 0; i < 26; i++) { const px = R() * W, py = R() * H; if (inB(px, py)) disc(px, py, 8 + R() * 18, R() < .5 ? '#0e1430' : '#160e2a'); }
    for (let i = 0; i < 900; i++) { const px = R() * W, py = R() * H; if (inB(px, py)) dot(px, py, R() < .1 ? '#ffd463' : R() < .5 ? '#ffffff' : '#5b6a9a'); }
    edge = '#2c3a6a';
  } else if (T.border === 'sea') {
    const [base, mid, hi, foam] = T.sea;
    fill(base);
    for (let i = 0; i < 1400; i++) { const px = R() * W, py = R() * H; if (!inB(px, py)) continue; dot(px, py, R() < .6 ? mid : hi, 3 + (R() * 6 | 0), 1); }
    // rocks along the shore, and foam
    for (let i = 0; i < 260; i++) {
      const side = (R() * 4) | 0; let px, py;
      if (side === 0) { px = R() * W; py = B.minY - 2 - R() * 10; } else if (side === 1) { px = R() * W; py = B.maxY + R() * 10; }
      else if (side === 2) { px = B.minX - 2 - R() * 10; py = R() * H; } else { px = B.maxX + R() * 10; py = R() * H; }
      if (R() < .55) { dot(px, py, '#5a5045', 4 + (R() * 5 | 0), 3); dot(px, py, '#7a6e60', 4, 1); } else dot(px, py, foam, 2, 1);
    }
    edge = '#1a2a30';
  }
  x.fillStyle = edge;
  x.fillRect(B.minX - 1, B.minY - 1, B.maxX - B.minX + 2, 1); x.fillRect(B.minX - 1, B.maxY, B.maxX - B.minX + 2, 1);
  x.fillRect(B.minX - 1, B.minY - 1, 1, B.maxY - B.minY + 2); x.fillRect(B.maxX, B.minY - 1, 1, B.maxY - B.minY + 2);
}
// The passage through the wall under a gate: the wall's inner faces in shadow, a stone sill on the threshold,
// and (in the village) the street's cobbles giving way to the dirt road that leads out of town.
function paintGateway(x, g, B, R, road) {
  const x0 = g.x * TILE - (g.pad || 0), x1 = (g.x + g.w) * TILE + (g.pad || 0), y0 = B.maxY, H = WORLD_H;
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); };
  const gp = g.pad || 0;
  if (gp) for (const sx of [x0, x1 - gp - 3]) for (let py = y0 - 2; py < y0 + 20; py += 4) {   // paving into the widened sides
    dot(sx, py, '#7f7765', gp + 3, 4);
    for (let px = sx - ((py >> 2) % 2) * 3; px < sx + gp + 3; px += 6) { const a = Math.max(px, sx), b = Math.min(px + 5, sx + gp + 3); if (b > a) dot(a, py, ['#b5ab98', '#a69c88', '#c2b8a4', '#ada390'][(R() * 4) | 0], b - a, 3); }
  }
  if (road) paintGatePassage(x, R, x0, x1, y0, H, H, 'closed');
}
// Akros' gate, the same from inside the town and from the road outside: the street's cobbles run into the gap and give
// way to the dirt road, and the cut ends of the wall show on both sides. doors: 'closed' (inside Akros: the two doors
// shut across the middle, seen from above), 'open' (standing open against the sides) or 'none' (drawn live elsewhere).
function paintGatePassage(x, R, x0, x1, yTop, yBot, wallEnd = yBot, doors = 'open') {
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); };
  const pick = a => a[(R() * a.length) | 0], len = yBot - yTop;
  for (let py = yTop; py < yBot; py++) for (let px = x0; px < x1; px++) dot(px, py, R() < .14 ? '#9a774a' : '#a8834f');
  // cobbles over the town end, thinning out toward the road
  for (let py = yTop; py < yBot; py += 4) for (let px = x0 + 3 - ((py - yTop) / 4 % 2) * 3; px < x1 - 3; px += 6) {
    const k = (py - yTop) / len; if (k > .4 && R() < (k - .4) * 2.4) continue;
    const a = Math.max(px, x0 + 4), b = Math.min(px + 6, x1 - 4); if (b - a < 2) continue;
    dot(a, py, '#8a8170', b - a, 4); dot(a, py, pick(['#b5ab98', '#a69c88', '#c2b8a4', '#ada390']), b - a - 1, 3);
  }
  for (const rx of [x0 + 15, x1 - 16]) for (let py = yTop + Math.round(len * .45); py < yBot; py++) if (R() < .75) dot(rx + Math.round(Math.sin(py / 5 + rx) * .7), py, '#7f6239');   // wheel ruts
  // the wall's cut ends: the left face catches the light, the right one is in shadow
  for (const [fx, lit] of [[x0, true], [x1 - 3, false]]) {
    dot(fx, yTop, lit ? '#c9c1ae' : '#7f7868', 3, wallEnd - yTop);
    for (let py = yTop + 2; py < wallEnd; py += 6) dot(fx, py, lit ? '#a39b8b' : '#5f594d', 3, 1);
    dot(lit ? fx + 3 : fx - 1, yTop, '#3a362e', 1, wallEnd - yTop);
  }
  dot(x1 - 7, yTop, 'rgba(0,0,0,.16)', 3, wallEnd - yTop);
  if (doors === 'closed') {                                  // the doors shut, seen from above: their top edges across the gap
    const by = yTop + Math.round((wallEnd - yTop) * .42), w = x1 - x0 - 6;
    dot(x0 + 3, by + 6, 'rgba(0,0,0,.28)', w, 3);
    dot(x0 + 3, by - 1, '#1a1210', w, 7); dot(x0 + 4, by, '#6b4528', w - 2, 5); dot(x0 + 4, by, '#8a5a34', w - 2, 1);
    for (let px = x0 + 8; px < x1 - 5; px += 5) dot(px, by + 1, '#5a3a22', 1, 4);
    dot(Math.round((x0 + x1) / 2) - 1, by - 1, '#1a1210', 2, 7);
    for (const px of [x0 + 9, x0 + 17, x1 - 11, x1 - 19]) { dot(px, by + 2, '#3a2416', 2, 2); dot(px, by + 2, '#9aa0a6'); }
    return;
  }
  if (doors !== 'open') return;
  // the gate doors, swung open flat against each side at the town end
  const dh = Math.min(22, len - 8);
  for (const [dx, d] of [[x0 + 5, 1], [x1 - 8, -1]]) {
    dot(dx - 1, yTop + 1, '#1a1210', 5, dh + 2); dot(dx, yTop + 2, '#6b4528', 3, dh); dot(d > 0 ? dx + 2 : dx, yTop + 2, '#5a3a22', 1, dh);
    for (const yy of [yTop + 5, yTop + dh - 3]) { dot(dx, yy, '#3a2416', 3, 2); dot(dx + 1, yy, '#9aa0a6'); }
  }
}
// A small visual clue where the hidden nook meets the arena.
function paintHint(x, T, s, R) {
  const dot = (px, py, col) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, 1, 1); };
  let pts = [];
  if (s.x + s.w - 1 < INNER.x0) for (let i = 0; i < 6; i++) pts.push([IPX.minX - 2 - R() * 6, s.y * TILE + 4 + R() * (s.h * TILE - 8)]);
  else if (s.x > INNER.x1) for (let i = 0; i < 6; i++) pts.push([IPX.maxX + 1 + R() * 6, s.y * TILE + 4 + R() * (s.h * TILE - 8)]);
  else if (s.y + s.h - 1 < INNER.y0) for (let i = 0; i < 6; i++) pts.push([s.x * TILE + 4 + R() * (s.w * TILE - 8), IPX.minY - 2 - R() * 6]);
  else for (let i = 0; i < 6; i++) pts.push([s.x * TILE + 4 + R() * (s.w * TILE - 8), IPX.maxY + 1 + R() * 6]);
  for (const [px, py] of pts) {
    if (T.border === 'hedge') { dot(px, py, R() < .5 ? '#f0e4cc' : '#ebc152'); dot(px + 1, py, '#7fae48'); }
    else if (T.border === 'clouds') dot(px, py, '#e9c04f');
    else if (T.border === 'sea') { dot(px, py, '#f3e9d4'); dot(px + 1, py, '#e9c04f'); }
    else { dot(px, py, '#140d0b'); dot(px + 1, py + 1, '#140d0b'); }
  }
}

/* ---- pixel drawing helpers (crisp, no anti-aliasing) ---- */
function pxEllipse(cx, cy, rx, ry, col) {
  cx = Math.round(cx); cy = Math.round(cy); ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + .5)) ** 2))); ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
function pxRing(cx, cy, r, col, gap = 1) {
  ctx.fillStyle = col; const step = 1 / Math.max(r, 1) * gap;
  for (let a = 0; a < Math.PI * 2; a += step) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
}
function pxRingFlat(cx, cy, r, col, gap = 1) {
  ctx.fillStyle = col; const step = 1 / Math.max(r, 1) * gap;
  for (let a = 0; a < Math.PI * 2; a += step) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .6), 1, 1);
}
function pxLine(x0, y0, x1, y1, col, dashed = 0) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, i = 0; ctx.fillStyle = col;
  for (let n = 0; n < 1200; n++) {
    if (!dashed || (i++ % (dashed * 2)) < dashed) ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function jagged(x0, y0, x1, y1, col, amp = 3, seg = 8, seed = 1) {
  const R = mulberry(seed), d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(d / seg));
  const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n, o = i === n ? 0 : (R() * 2 - 1) * amp;
    const qx = lerp(x0, x1, t) + nx * o, qy = lerp(y0, y1, t) + ny * o;
    pxLine(px, py, qx, qy, col); px = qx; py = qy;
  }
}
// name: a sprite name or a frames array. scale draws chunky (2x) for giants.
function drawSpr(name, fi, x, y, flip, tint, alpha = 1, scale = 1) {
  const frames = typeof name === 'string' ? SPR[name] : name, fr = frames[fi % frames.length];
  const img = tint === 'white' ? (flip ? fr.wf : fr.wn) : tint === 'gold' ? (flip ? fr.gf : fr.gn) : (flip ? fr.f : fr.n);
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  ctx.drawImage(img, Math.round(x - fr.w * scale / 2), Math.round(y - fr.h * scale + scale), fr.w * scale, fr.h * scale);
  if (alpha < 1) ctx.globalAlpha = 1;
}
const DIGITS = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '-': '000000111000000', '!': '010010010000010' };
function drawNum(str, x, y, col) {
  const w = str.length * 4 - 1; const cx = Math.round(x - w / 2); y = Math.round(y);
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass ? col : '#140d0b';
    let ox = cx;
    for (const ch of str) {
      const g = DIGITS[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') {
        const px = ox + (i % 3), py = y + Math.floor(i / 3);
        if (pass) ctx.fillRect(px, py, 1, 1); else { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
      }
      ox += 4;
    }
  }
}

/* ---- obstacle and prop art ---- */
// Highest rank you've beaten this god or Titan on: -1 never, 0 Low, 1 High, 2 God Rank.
function godRank(god, save = G.save) {
  if (!save) return -1;
  let best = -1; for (const qd of QUESTS) if (qd.boss === god && save.cleared[qd.id] && qd.rank > best) best = qd.rank;
  return best;
}
function godBeaten(god) { return godRank(god) >= 0; }
function flame(sx, sy, w, h, seed) {
  const R = mulberry(Math.floor(G.time * 12) + seed);
  for (let i = 0; i < w + 3; i++) { const fx = sx - w / 2 + R() * w, fh = 2 + R() * h; ctx.fillStyle = R() < .4 ? '#ffd463' : R() < .7 ? '#ff8a2b' : '#d9493b'; ctx.fillRect(Math.round(fx), Math.round(sy - fh), 1, Math.round(fh)); }
}
function drawObstacle(o, sx, sy) {
  const t = G.time;
  switch (o.kind) {
    case 'rock':
      pxEllipse(sx, sy + 1, 8, 3, 'rgba(0,0,0,.3)');
      pxEllipse(sx, sy - 3, 8, 6, '#1a1512'); pxEllipse(sx, sy - 3, 7, 5, '#6f6a64'); pxEllipse(sx - 1, sy - 4, 5, 3, '#8d8780'); pxEllipse(sx - 2, sy - 6, 2, 1, '#aaa39a');
      break;
    case 'boulder':
      pxEllipse(sx, sy + 2, 13, 4, 'rgba(0,0,0,.3)');
      pxEllipse(sx, sy - 6, 13, 10, '#1a1512'); pxEllipse(sx, sy - 6, 12, 9, '#6d5d4b'); pxEllipse(sx - 2, sy - 8, 9, 6, '#857360'); pxEllipse(sx - 4, sy - 11, 4, 2, '#a08c74');
      pxLine(sx + 3, sy - 12, sx + 6, sy - 4, '#4e4235'); pxLine(sx - 6, sy - 3, sx - 1, sy - 2, '#4e4235');
      break;
    case 'tree': case 'olive': {
      const olive = o.kind === 'olive';
      pxEllipse(sx, sy + 1, 12, 4, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 3, sy - 12, 6, 13);
      ctx.fillStyle = olive ? '#7a6a55' : '#6b4528'; ctx.fillRect(sx - 2, sy - 12, 4, 12); ctx.fillStyle = olive ? '#5a4d3c' : '#4e321d'; ctx.fillRect(sx + 1, sy - 12, 1, 12);
      const cy = sy - 22, c = olive ? ['#4e5a3a', '#6b7a52', '#8a9a6c', '#a9b88a'] : ['#35521f', '#446a28', '#5a8634', '#6d9a3e'];
      pxEllipse(sx, cy, 13, 11, '#1a1210'); pxEllipse(sx, cy, 12, 10, c[0]); pxEllipse(sx - 2, cy - 2, 9, 7, c[1]); pxEllipse(sx - 4, cy - 4, 5, 3, c[2]);
      const R = mulberry(o.seed); for (let i = 0; i < 12; i++) { ctx.fillStyle = R() < .5 ? c[3] : (olive ? '#3e4a2c' : '#2c441a'); ctx.fillRect(Math.round(sx - 9 + R() * 18), Math.round(cy - 8 + R() * 14), 1, 1); }
      if (olive) for (let i = 0; i < 4; i++) { ctx.fillStyle = sc && sc.theme === 'palacegarden' ? '#e9c04f' : '#3a2f4a'; ctx.fillRect(Math.round(sx - 7 + R() * 14), Math.round(cy - 4 + R() * 8), 1, 1); }
      break;
    }
    case 'pine': {
      pxEllipse(sx, sy + 1, 10, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 2, sy - 6, 4, 7); ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 1, sy - 6, 2, 6);
      for (let i = 0; i < 4; i++) {
        const y = sy - 6 - i * 7, w = 11 - i * 2;
        ctx.fillStyle = '#0e160a'; for (let k = 0; k < 9; k++) { const ww = Math.round(w * (k + 1) / 9); ctx.fillRect(sx - ww - 1, y - 9 + k, ww * 2 + 2, 1); }
        for (let k = 0; k < 8; k++) { const ww = Math.round(w * (k + 1) / 9); ctx.fillStyle = k < 2 ? '#3c6a30' : '#22391c'; ctx.fillRect(sx - ww, y - 8 + k, ww * 2, 1); ctx.fillStyle = '#2b4724'; ctx.fillRect(sx - ww, y - 8 + k, ww, 1); }
      }
      break;
    }
    case 'stump':
      pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 6, sy - 8, 12, 9); ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 5, sy - 7, 10, 7); ctx.fillStyle = '#4e321d'; ctx.fillRect(sx + 2, sy - 7, 2, 7);
      pxEllipse(sx, sy - 8, 5, 2, '#1a1210'); pxEllipse(sx, sy - 8, 4, 1, '#c09a63'); ctx.fillStyle = '#8a6b42'; ctx.fillRect(sx - 1, sy - 8, 2, 1);
      break;
    case 'vine':
      for (let i = -12; i <= 12; i += 8) { ctx.fillStyle = '#1a1210'; ctx.fillRect(sx + i - 1, sy - 14, 3, 15); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx + i, sy - 13, 1, 13); }
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 14, sy - 13, 29, 2);
      { const R = mulberry(o.seed); for (let i = 0; i < 26; i++) { ctx.fillStyle = R() < .6 ? '#4e8a3a' : '#2f5a22'; ctx.fillRect(Math.round(sx - 13 + R() * 27), Math.round(sy - 13 + R() * 9), 2, 2); }
        for (let i = 0; i < 5; i++) { const gx = Math.round(sx - 11 + R() * 22), gy = Math.round(sy - 8 + R() * 3); ctx.fillStyle = '#4a2f63'; ctx.fillRect(gx, gy, 2, 3); ctx.fillStyle = '#7a4f9c'; ctx.fillRect(gx, gy, 1, 2); } }
      break;
    case 'rosebush': {
      pxEllipse(sx, sy + 1, 8, 2, 'rgba(0,0,0,.3)');
      pxEllipse(sx, sy - 5, 8, 6, '#1a1210'); pxEllipse(sx, sy - 5, 7, 5, '#3b6028'); pxEllipse(sx - 2, sy - 6, 4, 3, '#4a7230');
      const R = mulberry(o.seed); for (let i = 0; i < 7; i++) { ctx.fillStyle = R() < .5 ? '#f2a7c0' : '#c0412e'; ctx.fillRect(Math.round(sx - 6 + R() * 12), Math.round(sy - 9 + R() * 7), 2, 2); }
      break;
    }
    case 'coral': {
      pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
      const cols = ['#e07a3a', '#f2a7c0', '#c0412e'], col = cols[o.seed % 3];
      const br = [[0, 0, 0, -14], [0, -6, -5, -11], [0, -8, 5, -13], [-5, -11, -6, -15], [5, -13, 6, -16]];
      for (const [a, b, c2, d] of br) { pxLine(sx + a - 1, sy + b, sx + c2 - 1, sy + d, '#1a1210'); pxLine(sx + a + 1, sy + b, sx + c2 + 1, sy + d, '#1a1210'); }
      for (const [a, b, c2, d] of br) { pxLine(sx + a, sy + b, sx + c2, sy + d, col); }
      break;
    }
    case 'grave':
      pxEllipse(sx, sy + 1, 6, 2, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 5, sy - 12, 10, 13); ctx.fillRect(sx - 4, sy - 13, 8, 1);
      ctx.fillStyle = '#8a8a90'; ctx.fillRect(sx - 4, sy - 11, 8, 11); ctx.fillRect(sx - 3, sy - 12, 6, 1); ctx.fillStyle = '#a8a8ae'; ctx.fillRect(sx - 4, sy - 11, 8, 1);
      ctx.fillStyle = '#5a5a60'; ctx.fillRect(sx - 1, sy - 9, 2, 6); ctx.fillRect(sx - 3, sy - 7, 6, 2);
      break;
    case 'crystal': {
      pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
      const col = sc && sc.theme === 'cave' ? ['#7fe08a', '#2f8a4a'] : sc && sc.theme === 'moon' ? ['#d5dbe5', '#8f98a8'] : ['#c8b8ff', '#6b5a8a'];
      for (const [dx, h, w] of [[-3, 12, 3], [2, 16, 4], [5, 9, 3]]) {
        ctx.fillStyle = '#1a1210'; ctx.fillRect(sx + dx - 1, sy - h - 1, w + 2, h + 2);
        ctx.fillStyle = col[1]; ctx.fillRect(sx + dx, sy - h, w, h); ctx.fillStyle = col[0]; ctx.fillRect(sx + dx, sy - h, 1, h);
      }
      if (Math.floor(t * 3 + o.seed) % 5 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 3, sy - 15, 1, 1); }
      break;
    }
    case 'shell':
      pxEllipse(sx, sy + 1, 9, 3, 'rgba(0,0,0,.3)');
      pxEllipse(sx, sy - 5, 9, 7, '#1a1210'); pxEllipse(sx, sy - 5, 8, 6, '#f2c0b0');
      for (let i = -3; i <= 3; i++) pxLine(sx, sy, sx + i * 2.6, sy - 11, '#c98a7a');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 3, sy - 1, 6, 2); ctx.fillStyle = '#e0a090'; ctx.fillRect(sx - 2, sy - 1, 4, 1);
      break;
    case 'rack':
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 10, sy - 6, 20, 3); ctx.fillRect(sx - 9, sy - 6, 2, 7); ctx.fillRect(sx + 7, sy - 6, 2, 7);
      ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 9, sy - 5, 18, 1);
      for (let i = -7; i <= 7; i += 4) { pxLine(sx + i, sy, sx + i + 1, sy - 22, '#8a5a34'); ctx.fillStyle = '#c7ccd1'; ctx.fillRect(sx + i + 1, sy - 25, 1, 3); }
      break;
    case 'fence':
      for (let i = -20; i <= 20; i += 10) { ctx.fillStyle = '#1a1210'; ctx.fillRect(sx + i - 1, sy - 10, 4, 12); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx + i, sy - 9, 2, 10); }
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 21, sy - 8, 43, 3); ctx.fillRect(sx - 21, sy - 4, 43, 3);
      ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 20, sy - 7, 41, 1); ctx.fillRect(sx - 20, sy - 3, 41, 1);
      break;
    case 'cart':
      pxEllipse(sx, sy + 2, 15, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 14, sy - 13, 28, 12);
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 13, sy - 12, 26, 10);
      ctx.fillStyle = '#5a3a22'; for (let i = -13; i < 13; i += 5) ctx.fillRect(sx + i, sy - 12, 1, 10);
      ctx.fillStyle = '#c09a63'; ctx.fillRect(sx - 13, sy - 12, 26, 1);
      pxEllipse(sx - 7, sy - 1, 4, 4, '#1a1210'); pxEllipse(sx - 7, sy - 1, 3, 3, '#6b4528'); ctx.fillStyle = '#c09a63'; ctx.fillRect(sx - 8, sy - 2, 2, 2);
      pxLine(sx + 13, sy - 6, sx + 20, sy - 2, '#5a3a22');
      break;
    case 'gatepost': {
      // A square stone pier seen from above and in front, like everything else here: a big light top with a
      // terracotta inlay, a short front face of two courses on a plinth, the east side in shade, a shadow to the lower right.
      const K = '#1a1210', L = '#e8dfca', M = '#cfc4ab', D = '#b5a98f';
      // 35px tall, the same seen from inside the town and from the road
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx - 4, sy - 1, 15, 4);
      ctx.fillStyle = K; ctx.fillRect(sx - 8, sy - 35, 16, 36);
      ctx.fillStyle = D; ctx.fillRect(sx - 7, sy - 4, 14, 4); ctx.fillStyle = '#9d927b'; ctx.fillRect(sx - 7, sy - 1, 14, 1);
      ctx.fillStyle = M; ctx.fillRect(sx - 7, sy - 24, 14, 20);
      ctx.fillStyle = D; ctx.fillRect(sx - 7, sy - 18, 14, 1); ctx.fillRect(sx - 7, sy - 11, 14, 1);
      ctx.fillRect(sx - 2, sy - 24, 1, 6); ctx.fillRect(sx + 2, sy - 17, 1, 6); ctx.fillRect(sx - 3, sy - 10, 1, 6);
      ctx.fillStyle = '#a99e86'; ctx.fillRect(sx + 4, sy - 24, 3, 24);
      ctx.fillStyle = L; ctx.fillRect(sx - 7, sy - 34, 14, 10);
      ctx.fillStyle = '#f6f0e1'; ctx.fillRect(sx - 7, sy - 34, 14, 1); ctx.fillRect(sx - 7, sy - 34, 1, 9);
      ctx.fillStyle = D; ctx.fillRect(sx - 7, sy - 25, 14, 1); ctx.fillRect(sx + 6, sy - 33, 1, 8);
      ctx.fillStyle = '#86391a'; ctx.fillRect(sx - 3, sy - 31, 6, 4); ctx.fillStyle = '#cf6a2f'; ctx.fillRect(sx - 2, sy - 30, 4, 2);
      break;
    }
    case 'column': case 'brokencol': {
      const gold = o.variant === 'gold', hgt = o.kind === 'column' ? 34 : 13;
      const dark = (sc && sc.theme === 'underworld') || o.variant === 'dark';
      const C = gold ? ['#e9c04f', '#c9a032', '#fff0b0', '#a8842a'] : dark ? ['#4a4652', '#3a3640', '#5e5a66', '#2e2a34'] : ['#e8dfca', '#c9bda4', '#f3ecdb', '#b5a98f'];
      pxEllipse(sx + 3, sy + 2, 9, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 8, sy - 3, 16, 5); ctx.fillRect(sx - 6, sy - hgt - 1, 12, hgt);
      ctx.fillStyle = C[3]; ctx.fillRect(sx - 7, sy - 2, 14, 3);
      ctx.fillStyle = C[0]; ctx.fillRect(sx - 5, sy - hgt, 10, hgt - 2);
      ctx.fillStyle = C[1]; ctx.fillRect(sx - 3, sy - hgt, 1, hgt - 2); ctx.fillRect(sx, sy - hgt, 1, hgt - 2); ctx.fillRect(sx + 3, sy - hgt, 2, hgt - 2);
      if (o.kind === 'column') {
        ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 8, sy - hgt - 5, 16, 5);
        ctx.fillStyle = C[0]; ctx.fillRect(sx - 7, sy - hgt - 4, 14, 3); ctx.fillStyle = C[2]; ctx.fillRect(sx - 7, sy - hgt - 4, 14, 1);
      } else {
        ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 5, sy - hgt - 2, 4, 2); ctx.fillRect(sx + 1, sy - hgt - 3, 4, 3);
        ctx.fillStyle = C[0]; ctx.fillRect(sx - 4, sy - hgt - 1, 2, 1); ctx.fillRect(sx + 2, sy - hgt - 2, 2, 2);
      }
      break;
    }
    case 'brazier': {
      pxEllipse(sx, sy + 1, 6, 2, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 2, sy - 9, 4, 10); ctx.fillRect(sx - 6, sy - 13, 12, 5);
      ctx.fillStyle = '#6b5a3a'; ctx.fillRect(sx - 1, sy - 9, 2, 9);
      ctx.fillStyle = '#b08a2a'; ctx.fillRect(sx - 5, sy - 12, 10, 3); ctx.fillStyle = '#e9c04f'; ctx.fillRect(sx - 5, sy - 12, 10, 1);
      if (o.variant !== 'unlit') flame(sx, sy - 13, 8, 6, o.seed);
      break;
    }
    case 'hearth': {
      const lit = G.save && G.save.blessing;
      pxEllipse(sx, sy + 1, 13, 4, 'rgba(0,0,0,.3)');
      pxEllipse(sx, sy - 3, 12, 6, '#1a1210'); pxEllipse(sx, sy - 3, 11, 5, '#8f8470'); pxEllipse(sx, sy - 4, 8, 3, '#2a1e19');
      const R = mulberry(o.seed); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.fillStyle = R() < .5 ? '#a99d86' : '#bdb29b'; ctx.fillRect(Math.round(sx + Math.cos(a) * 10) - 1, Math.round(sy - 3 + Math.sin(a) * 4), 3, 2); }
      flame(sx, sy - 4, lit ? 14 : 8, lit ? 12 : 6, o.seed);
      if (lit && Math.random() < .3) sc.parts.push({ x: o.x + rand(-6, 6), y: o.y - 14, vx: rand(-6, 6), vy: rand(-26, -14), g: 0, life: .9, max: .9, c: '#ffd463', s: 1 });
      break;
    }
    case 'statue': {
      const god = o.variant || 'owl', gr = god === 'owl' ? -1 : godRank(god), gold = gr >= 0, img = statueImg(god, gold ? STATUE_TONE[gr] : 'stone');
      const big = !!o.big;
      pxEllipse(sx + 2, sy + 2, 9, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 8, sy - 9, 16, 11);
      ctx.fillStyle = '#b5a98f'; ctx.fillRect(sx - 7, sy - 8, 14, 9); ctx.fillStyle = '#d8ceb7'; ctx.fillRect(sx - 7, sy - 8, 14, 2);
      if (big) { ctx.fillStyle = gold ? '#e9c04f' : '#8f8470'; ctx.fillRect(sx - 5, sy - 4, 10, 1); }
      ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - 8 - img.height + 1));
      if (gold && Math.floor(t * 3 + o.seed) % 4 === 0) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(sx + 4, sy - 8 - img.height + 3, 1, 1); }
      if (gold && o.trophy) { flame(sx - 6, sy - 9, 2, 3, o.seed); flame(sx + 6, sy - 9, 2, 3, o.seed + 7); }
      break;
    }
    case 'tstatue': {                                 // a Titan on a wide plinth, dark until you beat it
      const gr = godRank(o.variant), img = statueImg(o.variant, gr >= 0 ? STATUE_TONE[gr] : 'stone');
      pxEllipse(sx + 2, sy + 2, 13, 3, 'rgba(0,0,0,.35)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 12, sy - 11, 24, 13);
      ctx.fillStyle = '#4a4652'; ctx.fillRect(sx - 11, sy - 10, 22, 11); ctx.fillStyle = '#6a6672'; ctx.fillRect(sx - 11, sy - 10, 22, 2);
      ctx.fillStyle = gr >= 0 ? RANK_TINT[gr] ? RANK_TINT[gr].trim : '#e9c04f' : '#2a2630'; ctx.fillRect(sx - 7, sy - 5, 14, 1);
      if (gr < 0) ctx.globalAlpha = .7;
      ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - 10 - img.height + 1));
      ctx.globalAlpha = 1;
      if (gr >= 0 && Math.floor(t * 3 + o.seed) % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 6, sy - 10 - img.height + 6, 1, 1); }
      if (gr >= 0) { flame(sx - 10, sy - 11, 2, 3, o.seed); flame(sx + 10, sy - 11, 2, 3, o.seed + 5); }
      break;
    }
    case 'obelisk': {                                 // Hyperion's hall: you can hide behind these
      pxEllipse(sx + 3, sy + 2, 10, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 9, sy - 5, 18, 7); ctx.fillRect(sx - 7, sy - 40, 14, 37); ctx.fillRect(sx - 5, sy - 45, 10, 6);
      ctx.fillStyle = '#8f846c'; ctx.fillRect(sx - 8, sy - 4, 16, 5);
      ctx.fillStyle = '#d8ceb7'; ctx.fillRect(sx - 6, sy - 39, 12, 36); ctx.fillStyle = '#b5a98f'; ctx.fillRect(sx + 2, sy - 39, 4, 36);
      ctx.fillStyle = '#e9c04f'; ctx.fillRect(sx - 4, sy - 44, 8, 5); ctx.fillStyle = '#fff0b0'; ctx.fillRect(sx - 4, sy - 44, 3, 2);
      ctx.fillStyle = '#8f846c'; for (let i = 0; i < 4; i++) ctx.fillRect(sx - 3, sy - 34 + i * 7, 4, 1);
      break;
    }
    case 'tdoor': {                                   // the sealed gate at the far end of the Titans' hall
      const open = G.save && G.save.stairs;
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 29, sy - 46, 58, 47);
      ctx.fillStyle = '#4a3a24'; ctx.fillRect(sx - 28, sy - 45, 56, 45);
      for (const d of [-1, 1]) {
        const x0 = d < 0 ? sx - 26 : sx + 1;
        ctx.fillStyle = '#7a5a2a'; ctx.fillRect(x0, sy - 40, 25, 40); ctx.fillStyle = '#5a4220'; ctx.fillRect(x0 + (d < 0 ? 0 : 22), sy - 40, 3, 40);
        ctx.fillStyle = '#a8842a'; for (let yy = sy - 36; yy < sy - 2; yy += 8) ctx.fillRect(x0 + 3, yy, 19, 1);
        ctx.fillStyle = '#e9c04f'; ctx.fillRect(x0 + (d < 0 ? 20 : 3), sy - 22, 2, 3);
      }
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 1, sy - 40, 2, 40);
      const glow = Math.floor(t * 2) % 2 ? '#b48cff' : '#8a5ad8';
      ctx.fillStyle = open ? glow : '#3a2a4a'; ctx.fillRect(sx - 5, sy - 44, 10, 3); ctx.fillRect(sx - 3, sy - 47, 6, 3);
      break;
    }
    case 'slab':
      pxEllipse(sx, sy + 1, 12, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 11, sy - 8, 22, 9);
      ctx.fillStyle = '#c9bfa8'; ctx.fillRect(sx - 10, sy - 7, 20, 7); ctx.fillStyle = '#e0d7c2'; ctx.fillRect(sx - 10, sy - 7, 20, 2);
      pxLine(sx - 4, sy - 7, sx - 1, sy - 1, '#8f846c'); ctx.fillStyle = '#7f9a4a'; ctx.fillRect(sx + 6, sy - 2, 2, 1);
      break;
    case 'pylon': {
      pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#0e0f13'; ctx.fillRect(sx - 6, sy - 26, 12, 27);
      ctx.fillStyle = '#3a3e4a'; ctx.fillRect(sx - 5, sy - 25, 10, 25); ctx.fillStyle = '#4d5262'; ctx.fillRect(sx - 5, sy - 25, 3, 25);
      const glow = Math.floor(t * 8 + o.seed) % 6 === 0 ? '#ffffff' : '#57c2b0';
      ctx.fillStyle = '#0e0f13'; ctx.fillRect(sx - 3, sy - 32, 6, 7); ctx.fillStyle = glow; ctx.fillRect(sx - 2, sy - 31, 4, 5);
      break;
    }
    case 'anvil':
      pxEllipse(sx, sy + 1, 8, 2, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 4, sy - 6, 8, 7); ctx.fillRect(sx - 8, sy - 11, 16, 6);
      ctx.fillStyle = '#4b4f57'; ctx.fillRect(sx - 3, sy - 6, 6, 6); ctx.fillRect(sx - 7, sy - 10, 14, 4); ctx.fillStyle = '#8a909a'; ctx.fillRect(sx - 7, sy - 10, 14, 1);
      break;
    case 'fountain': {
      pxEllipse(sx, sy - 6, 16, 9, '#1a1210'); pxEllipse(sx, sy - 6, 15, 8, '#b5a98f'); pxEllipse(sx, sy - 7, 12, 6, '#3f6ea8'); pxEllipse(sx - 2, sy - 8, 6, 3, '#5b8fc9');
      const R = mulberry(Math.floor(t * 8));
      for (let i = 0; i < 6; i++) { ctx.fillStyle = '#e6f2ff'; ctx.fillRect(Math.round(sx - 10 + R() * 20), Math.round(sy - 11 + R() * 8), 1, 1); }
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 3, sy - 22, 6, 15); ctx.fillStyle = '#e8dfca'; ctx.fillRect(sx - 2, sy - 21, 4, 13);
      ctx.fillStyle = '#5b8fc9'; ctx.fillRect(sx - 1, sy - 26 + (Math.floor(t * 10) % 3), 2, 4);
      break;
    }
    case 'stall': {
      pxEllipse(sx, sy + 1, 15, 3, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 14, sy - 10, 28, 11); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 13, sy - 9, 26, 9);
      const goods = ['#d9822b', '#7fa548', '#c0412e', '#e9c04f']; for (let i = 0; i < 8; i++) { ctx.fillStyle = goods[i % 4]; ctx.fillRect(sx - 12 + i * 3, sy - 11, 2, 2); }
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 15, sy - 24, 30, 8); ctx.fillRect(sx - 13, sy - 17, 2, 8); ctx.fillRect(sx + 11, sy - 17, 2, 8);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#f3e9d4' : '#cf6a2f'; ctx.fillRect(sx - 14 + i * 4, sy - 23, 4, 6); }
      break;
    }
    case 'crate':
      pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 7, sy - 12, 14, 13); ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 6, sy - 11, 12, 11);
      ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 6, sy - 6, 12, 1); pxLine(sx - 6, sy - 11, sx + 5, sy - 1, '#6b4528');
      break;
    case 'amphora':
      pxEllipse(sx, sy + 1, 5, 2, 'rgba(0,0,0,.3)');
      pxEllipse(sx, sy - 6, 5, 6, '#1a1210'); pxEllipse(sx, sy - 6, 4, 5, '#c35f2a'); ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 4, sy - 7, 8, 2); ctx.fillRect(sx - 2, sy - 15, 4, 4);
      ctx.fillStyle = '#c35f2a'; ctx.fillRect(sx - 1, sy - 14, 2, 3);
      break;
    case 'gatedoors': {                                // the village gate, shut
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 24, sy - 26, 48, 27);
      for (const d of [-1, 1]) {
        const x0 = d < 0 ? sx - 23 : sx + 1;
        ctx.fillStyle = '#6b4528'; ctx.fillRect(x0, sy - 25, 22, 25);
        ctx.fillStyle = '#5a3a22'; for (let i = 3; i < 22; i += 5) ctx.fillRect(x0 + i, sy - 25, 1, 25);
        ctx.fillStyle = '#3a2416'; ctx.fillRect(x0, sy - 19, 22, 2); ctx.fillRect(x0, sy - 7, 22, 2);
        ctx.fillStyle = '#9aa0a6'; for (const yy of [sy - 18, sy - 6]) for (let i = 2; i < 22; i += 6) ctx.fillRect(x0 + i, yy, 1, 1);
      }
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 1, sy - 25, 2, 25);
      ctx.fillStyle = '#4b4f57'; ctx.fillRect(sx - 14, sy - 14, 28, 3); ctx.fillStyle = '#8a909a'; ctx.fillRect(sx - 14, sy - 14, 28, 1);
      break;
    }
    case 'board':
      ctx.fillStyle = '#1a1210'; ctx.fillRect(sx - 10, sy - 18, 20, 13); ctx.fillRect(sx - 9, sy - 6, 2, 7); ctx.fillRect(sx + 7, sy - 6, 2, 7);
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 9, sy - 17, 18, 11);
      ctx.fillStyle = '#f3e9d4'; ctx.fillRect(sx - 7, sy - 15, 5, 6); ctx.fillRect(sx - 1, sy - 16, 4, 5); ctx.fillRect(sx + 4, sy - 14, 4, 6);
      ctx.fillStyle = '#c0412e'; ctx.fillRect(sx - 5, sy - 15, 1, 1); ctx.fillRect(sx + 1, sy - 16, 1, 1); ctx.fillRect(sx + 6, sy - 14, 1, 1);
      break;
  }
}


