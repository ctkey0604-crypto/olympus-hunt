/* ============================== THE NORTH: its lands and props ============================== */
// Snow on the ground (the 'snow' floor in paintFloor), pines with snow on them, ice cliffs and a cold sea around the edges.
// The props are drawn by NORSE_PROPS, which joins PROP_ART in 85_vindheim.js (PROP_ART lives in 85_rooms.js).
const SNOWPINES = { border: 'hedge', hedgeBase: '#13201c', hedge: ['#1f3329', '#284034', '#30503f', '#1a2c24'], hedgeHi: '#e8f2fa' };
const DARKPINES = { border: 'hedge', hedgeBase: '#0c1412', hedge: ['#16241e', '#1c2e26', '#22382e', '#121e1a'], hedgeHi: '#9fb4c4' };
const ICECLIFF = { border: 'cliff', rockBase: '#2c3644', rocks: ['#4a5868', '#56667a', '#3e4a5a', '#64748a'], rockHi: '#e8f2fa' };
const NORTHSEA = { border: 'sea', sea: ['#16324a', '#22486a', '#346488', '#e8f2fa'] };
const LONGWALL = { border: 'wall', wallBase: '#24170e', wall: ['#5a3e26', '#4e3420'], wallHi: '#7a5838', frieze: '#c9a032' };
const SNOW = o => ({ floor: 'snow', base: '#dfe8ef', shades: ['#d2dde6', '#e9f0f5', '#c8d4de'], drift: '#f7fbff', shadow: '#b4c4d2', pebble: '#6f7780', crack: '#454c54',
                     iceCols: ['#a8cde6', '#bcdcf0', '#9cc4e0'], ...o });
Object.assign(THEMES, {
  fjord:     SNOW({ ice: 5, tufts: 40, tuft: '#7a8a5a', ...NORTHSEA, weather: 'snow' }),
  ford:      SNOW({ ice: 14, ...ICECLIFF, weather: 'snow' }),
  bifrost:   SNOW({ base: '#e6edf4', shades: ['#dde6ee', '#eef3f8', '#d4dee8'], rainbow: ['#f6c8c8', '#f8dcc0', '#f6eebc', '#cfeec8', '#c4e8e6', '#c8d8f2', '#dccbf0'], border: 'clouds' }),
  folkvang:  { floor: 'grass', base: '#6f9448', shades: ['#64873f', '#7da352', '#5a7a39'], flowers: 260, flowerCols: ['#ffffff', '#ffd463', '#f2a7c0', '#c8b8ff'], patches: ['#8a7a4a', '#7c6c40'], ...PINES, weather: 'petals' },
  snowwood:  SNOW({ ice: 2, tufts: 30, tuft: '#5a6a4a', ...SNOWPINES, weather: 'snow' }),
  longhall:  { floor: 'planks', base: '#5a3e26', planks: ['#7a5232', '#6e4a2c', '#86593a'], seam: '#2e1c10', grain: '#5a3a22', ...LONGWALL, colLook: 'wood' },
  warcamp:   SNOW({ ice: 2, patches: ['#8a7a64', '#7a6a54', '#6e5e4a'], ...SNOWPINES, weather: 'snow' }),
  gnipa:     { floor: 'rock', base: '#3a3640', shades: ['#34303a', '#423e48', '#2e2a34', '#4a4652'], crack: '#1e1a22', pebble: '#5a5664', puddles: '#3a1414', ...ICECLIFF, rockBase: '#14121a', night: true },
  thing:     { floor: 'grass', base: '#7a8a4c', shades: ['#6e7d44', '#869656', '#647240'], flowers: 60, flowerCols: ['#ffffff', '#ffd463'], patches: ['#9a8a5a', '#8a7a4c'],
               border: 'drystone', stoneBase: '#3e3a34', stone: ['#8a8478', '#9a9488', '#7a7468', '#a49e92'], stoneHi: '#c8c2b6' },
  barrow:    { floor: 'grass', base: '#4e5a48', shades: ['#465240', '#566250', '#3e4a3a'], flowers: 30, flowerCols: ['#d8dcd0', '#9fd0ff'], patches: ['#3a3a30', '#44443a'],
               border: 'drystone', stoneBase: '#1e1e22', stone: ['#3e3e46', '#48484f', '#36363e', '#52525a'], stoneHi: '#6a6a72', weather: 'fog', night: true },
  ironwood:  { floor: 'grass', base: '#2e3a2a', shades: ['#283424', '#344230', '#222e20'], flowers: 10, patches: ['#3a2e22', '#2e2418'], ...DARKPINES, weather: 'fog', night: true },
  venomcave: { floor: 'rock', base: '#2c3a34', shades: ['#26342e', '#32403a', '#202e28', '#384640'], crack: '#141e1a', pebble: '#4a5a52', puddles: '#3a6a2a', moss: '#4e8a3a',
               border: 'cliff', rockBase: '#0e1612', rocks: ['#1e2a24', '#24322a', '#18221c', '#2a3830'], rockHi: '#3e6a4a', night: true },
  thrudvang: { floor: 'rock', base: '#6a6a62', shades: ['#60605a', '#74746c', '#58584f', '#7c7c74'], crack: '#3a3a34', pebble: '#8a8a80', moss: '#6b7d3a', ...ICECLIFF, weather: 'storm' },
  jotunheim: SNOW({ base: '#d8e4ee', ice: 26, iceCols: ['#94bcdc', '#a8cde6', '#86b0d2'], ...ICECLIFF, weather: 'snow' }),
  thorhall:  { floor: 'marble', light: '#6a6258', dark: '#5e564c', fleck: ['#726a60', '#564e44'], grout: '#3a342c', crack: '#2e2822', cracks: .15, medallion: ['#1e1a16', '#57c2b0'], runner: '#7f2618',
               ...LONGWALL, frieze: '#57c2b0', colLook: 'wood', weather: 'storm' },
  ravenwood: SNOW({ base: '#b8c4d0', shades: ['#aebac6', '#c2ccd8', '#a4b0bc'], drift: '#d8e2ec', shadow: '#8a98a8', ice: 3, ...DARKPINES, weather: 'snow', night: true }),
  valhalla:  { floor: 'marble', light: '#e8d8a8', dark: '#dccb94', fleck: ['#e2d29e', '#d2c088'], grout: '#a8842a', crack: '#b89a5a', cracks: .05, medallion: ['#5a4410', '#ffd463'], runner: '#7f2618',
               ...LONGWALL, frieze: '#ffd463', colLook: 'gold' },
  highseat:  { floor: 'marble', light: '#2a3452', dark: '#232c48', fleck: ['#2e3858', '#1e2640'], grout: '#141a30', crack: '#3a4870', cracks: .04, stars: 200, medallion: ['#0e1428', '#9fd0ff'], border: 'void', night: true },
  lyngvi:    SNOW({ base: '#c8d4e0', shades: ['#becad6', '#d2dce6', '#b4c0cc'], drift: '#e2eaf2', shadow: '#94a4b4', ice: 8, ...NORTHSEA, weather: 'snow', night: true }),
  vindheim:  SNOW({ ice: 3, tufts: 50, tuft: '#6a7a4a', ...NORTHSEA }),
});

/* ---- props ---- */
// soft: walk over it. Sizes are the footprint you bump into; the art stands up from the bottom of it.
Object.assign(OBST, {
  runestone: { w: 10, h: 6 }, eirstone: { w: 10, h: 6 }, snowpine: { w: 8, h: 6 }, icecrystal: { w: 10, h: 6 }, logpile: { w: 20, h: 8 }, meadbarrel: { w: 10, h: 6 },
  longhouse: { w: 96, h: 40 }, smallhouse: { w: 60, h: 32 }, norsestall: { w: 30, h: 10 }, forgefire: { w: 24, h: 10 }, longship: { w: 8, h: 4, soft: true }, pier: { w: 8, h: 4, soft: true }, rowboat: { w: 8, h: 4, soft: true }, harborlamp: { w: 4, h: 4 },
});
for (const k of ['runestone', 'snowpine', 'logpile', 'meadbarrel']) STATIC_PROPS.add(k);
const onSnow = () => !!(sc && THEMES[sc.theme] && THEMES[sc.theme].floor === 'snow');
const NORSE_PROPS = {
  // a standing stone with a serpent carved round it and runes inside, painted red
  runestone(o, sx, sy) {
    const K = OUTLINE;
    pxEllipse(sx + 1, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 6, sy - 22, 12, 23); ctx.fillRect(sx - 5, sy - 24, 10, 2); ctx.fillRect(sx - 3, sy - 25, 6, 1);
    ctx.fillStyle = '#8a8a86'; ctx.fillRect(sx - 5, sy - 22, 10, 22); ctx.fillRect(sx - 4, sy - 23, 8, 1); ctx.fillRect(sx - 2, sy - 24, 4, 1);
    ctx.fillStyle = '#a8a8a2'; ctx.fillRect(sx - 5, sy - 22, 2, 22); ctx.fillStyle = '#6e6e6a'; ctx.fillRect(sx + 3, sy - 22, 2, 22);
    ctx.fillStyle = '#a8301f'; for (let y = sy - 20; y < sy - 3; y++) { ctx.fillRect(sx - 3 + ((y >> 2) % 2), y, 1, 1); ctx.fillRect(sx + 2 - ((y >> 2) % 2), y, 1, 1); }
    const R = mulberry(o.seed); ctx.fillStyle = '#3e3e3a';
    for (let i = 0; i < 4; i++) { const y = sy - 18 + i * 4; ctx.fillRect(sx - 1, y, 1, 3); ctx.fillRect(R() < .5 ? sx : sx - 2, y + (R() < .5 ? 0 : 1), 1, 1); }
    if (onSnow()) { ctx.fillStyle = '#f2f7fb'; ctx.fillRect(sx - 3, sy - 25, 6, 2); ctx.fillRect(sx - 5, sy - 23, 2, 1); }
  },
  // Eir's stone in Vindheim: a runestone like the others, with a soft green glow around it (brighter while her blessing is on you).
  eirstone(o, sx, sy) {
    const mine = G.save && G.save.blessing && G.save.blessGod === 'eir', pulse = .5 + .5 * Math.sin(G.time * 2.2);
    pxEllipse(sx, sy - 11, 13 + pulse * 2, 15 + pulse * 2, `rgba(127,224,138,${(mine ? .2 : .1) + pulse * .06})`);
    NORSE_PROPS.runestone(o, sx, sy);
  },
  // a pine with snow along every tier
  snowpine(o, sx, sy) {
    pxEllipse(sx, sy + 1, 10, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 2, sy - 6, 4, 7); ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 1, sy - 6, 2, 6);
    for (let i = 0; i < 4; i++) {
      const y = sy - 6 - i * 7, w = 11 - i * 2;
      ctx.fillStyle = '#0e160a'; for (let k = 0; k < 9; k++) { const ww = Math.round(w * (k + 1) / 9); ctx.fillRect(sx - ww - 1, y - 9 + k, ww * 2 + 2, 1); }
      for (let k = 0; k < 8; k++) {
        const ww = Math.round(w * (k + 1) / 9);
        ctx.fillStyle = k < 2 ? '#f2f7fb' : k < 3 ? '#cfe0ee' : '#22391c'; ctx.fillRect(sx - ww, y - 8 + k, ww * 2, 1);
        if (k >= 3) { ctx.fillStyle = '#2b4724'; ctx.fillRect(sx - ww, y - 8 + k, ww, 1); }
      }
      ctx.fillStyle = '#f2f7fb'; ctx.fillRect(sx - w + 1, y - 1, 3, 1); ctx.fillRect(sx + w - 4, y - 1, 3, 1);
    }
  },
  // shards of blue ice that catch the light
  icecrystal(o, sx, sy) {
    pxEllipse(sx, sy + 1, 8, 2, 'rgba(0,0,0,.3)');
    for (const [dx, h, w] of [[-5, 11, 3], [-2, 17, 4], [2, 13, 3], [5, 7, 2]]) {
      ctx.fillStyle = OUTLINE; ctx.fillRect(sx + dx - 1, sy - h - 1, w + 2, h + 2); ctx.fillRect(sx + dx, sy - h - 2, w - 1, 1);
      ctx.fillStyle = '#6fa2cc'; ctx.fillRect(sx + dx, sy - h, w, h); ctx.fillStyle = '#a8d4f2'; ctx.fillRect(sx + dx, sy - h, Math.max(1, w - 2), h);
      ctx.fillStyle = '#e6f6ff'; ctx.fillRect(sx + dx, sy - h, 1, h); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + dx, sy - h - 1, w - 1, 1);
    }
    if (Math.floor(G.time * 3 + o.seed) % 5 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy - 16, 1, 3); ctx.fillRect(sx - 1, sy - 15, 3, 1); }
  },
  // split logs stacked for the winter, with snow on top
  logpile(o, sx, sy) {
    pxEllipse(sx, sy + 1, 12, 3, 'rgba(0,0,0,.3)');
    const log = (x, y) => { pxEllipse(x, y, 4, 4, OUTLINE); pxEllipse(x, y, 3, 3, '#8a5a34'); pxEllipse(x, y, 2, 2, '#c09a63'); ctx.fillStyle = '#8a6b42'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
    for (const [x, y] of [[-8, -4], [0, -4], [8, -4], [-4, -11], [4, -11], [0, -17]]) log(sx + x, sy + y);
    if (onSnow()) { ctx.fillStyle = '#f2f7fb'; ctx.fillRect(sx - 2, sy - 21, 5, 2); ctx.fillRect(sx - 7, sy - 15, 4, 1); ctx.fillRect(sx + 4, sy - 15, 4, 1); }
  },
  // a mead barrel with iron hoops
  meadbarrel(o, sx, sy) {
    pxEllipse(sx, sy + 1, 7, 2, 'rgba(0,0,0,.3)');
    ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 6, sy - 14, 12, 15);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 5, sy - 13, 10, 13); ctx.fillStyle = '#6b4528'; ctx.fillRect(sx + 2, sy - 13, 3, 13); ctx.fillStyle = '#a3713f'; ctx.fillRect(sx - 4, sy - 13, 1, 13);
    ctx.fillStyle = '#4b4f57'; ctx.fillRect(sx - 5, sy - 11, 10, 1); ctx.fillRect(sx - 5, sy - 4, 10, 1);
    pxEllipse(sx, sy - 14, 5, 2, OUTLINE); pxEllipse(sx, sy - 14, 4, 1, '#a3713f'); ctx.fillStyle = '#e9c04f'; ctx.fillRect(sx - 1, sy - 15, 2, 1);
  },
  // Vindheim: a longhouse seen from the front, a turf roof heavy with snow and crossed boards at the gable ends
  longhouse(o, sx, sy) { drawLonghouse(o, sx, sy, 96, 18, 32); },
  smallhouse(o, sx, sy) { drawLonghouse(o, sx, sy, 60, 14, 22); },
  // Åsa's stall: a table of furs, fish and jars under a hide awning
  norsestall(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx, sy + 1, 16, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 15, sy - 11, 30, 12); ctx.fillStyle = '#6b4528'; ctx.fillRect(sx - 14, sy - 10, 28, 10); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 14, sy - 10, 28, 2);
    const goods = [['#c9bda4', 4], ['#8f8f8f', 4], ['#9fd0ff', 2], ['#e9c04f', 2], ['#a7998a', 4], ['#57c2b0', 2]];
    let gx = sx - 13; for (const [c, w] of goods) { ctx.fillStyle = K; ctx.fillRect(gx - 1, sy - 14, w + 2, 4); ctx.fillStyle = c; ctx.fillRect(gx, sy - 13, w, 2); gx += w + 2; }
    ctx.fillStyle = K; ctx.fillRect(sx - 14, sy - 30, 2, 20); ctx.fillRect(sx + 12, sy - 30, 2, 20); ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 13, sy - 29, 1, 18); ctx.fillRect(sx + 13, sy - 29, 1, 18);
    ctx.fillStyle = K; ctx.fillRect(sx - 17, sy - 33, 34, 6);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 3 === 0 ? '#8a7a64' : '#a39478'; ctx.fillRect(sx - 16 + i * 2, sy - 32, 2, 4); }
    ctx.fillStyle = '#f2f7fb'; ctx.fillRect(sx - 16, sy - 33, 32, 1);
  },
  // Brokk's forge: a stone hearth with the fire showing and an iron hood over it
  forgefire(o, sx, sy) {
    const K = OUTLINE; pxEllipse(sx, sy + 1, 13, 3, 'rgba(0,0,0,.3)');
    ctx.fillStyle = K; ctx.fillRect(sx - 12, sy - 14, 24, 15);
    for (let y = 0; y < 13; y += 4) for (let x = (y / 4 % 2) * 3; x < 22; x += 6) { ctx.fillStyle = (x + y) % 3 ? '#7a7468' : '#8a8478'; ctx.fillRect(sx - 11 + x, sy - 13 + y, 5, 3); }
    ctx.fillStyle = '#1a0e08'; ctx.fillRect(sx - 6, sy - 11, 12, 8); flame(sx, sy - 4, 10, 6, o.seed);
    ctx.fillStyle = '#ff8a2b'; ctx.fillRect(sx - 5, sy - 4, 10, 1);
    ctx.fillStyle = K; ctx.fillRect(sx - 8, sy - 24, 16, 10); ctx.fillRect(sx - 3, sy - 34, 6, 10);
    ctx.fillStyle = '#4b4f57'; ctx.fillRect(sx - 7, sy - 23, 14, 8); ctx.fillRect(sx - 2, sy - 33, 4, 10); ctx.fillStyle = '#6b7078'; ctx.fillRect(sx - 7, sy - 23, 14, 1);
    if (Math.random() < .25 && sc && sc.parts) sc.parts.push({ x: o.x + rand(-2, 2), y: o.y - 34, vx: rand(2, 6), vy: rand(-14, -8), g: 0, life: 1.6, max: 1.6, c: Math.random() < .5 ? '#8f8a82' : '#b5b0a6', s: 2 });
  },
  // the longship you sail north in, lying beside Vindheim's jetty with her sail set
  longship(o, sx, sy) { drawLongship(sx, sy, 1, G.time); },
  // The jetty's boards are painted into the ground (85_vindheim.js). These are the things on it that stand up or move:
  // two mooring posts with their lines up to the ship, and the water working round the piles underneath.
  pier(o, sx, sy) {
    const K = OUTLINE, t = G.time, X = wx => sx + wx - JETTY.hx0, Y = wy => sy + wy - JETTY.hy0 - 2;
    for (const [n, wx] of jettyPiles().entries()) { const f = Math.floor(t * 1.5 + n * .7) % 3, y = Y(JETTY.hy1 + 10); ctx.fillStyle = f ? '#4f86ad' : '#8fc0de'; ctx.fillRect(X(wx) - 4 - f, y, 2, 1); ctx.fillRect(X(wx) + 3 + f, y, 2, 1); }
    for (const [wx, tx, ty] of JETTY_LINES) {              // a post, and where its line is made fast aboard
      const bx = X(wx), n = sy - 6 - Y(ty);
      for (let i = 0; i <= n; i++) { const k = i / n; ctx.fillStyle = i % 3 ? '#c9b48e' : '#8a7a64'; ctx.fillRect(Math.round(lerp(bx, X(tx), k) + Math.sin(k * Math.PI) * 2), sy - 6 - i, 1, 1); }
      ctx.fillStyle = K; ctx.fillRect(bx - 3, sy - 9, 6, 10); ctx.fillStyle = '#5a4430'; ctx.fillRect(bx - 2, sy - 8, 4, 8); ctx.fillStyle = '#7c5e40'; ctx.fillRect(bx - 2, sy - 8, 1, 8);
      ctx.fillStyle = '#f2f7fb'; ctx.fillRect(bx - 2, sy - 9, 4, 2); ctx.fillStyle = '#cfdbe6'; ctx.fillRect(bx, sy - 8, 2, 1); ctx.fillStyle = '#c9b48e'; ctx.fillRect(bx - 3, sy - 5, 6, 1); ctx.fillStyle = '#8a7a64'; ctx.fillRect(bx - 3, sy - 4, 6, 1);
    }
  },
  // a small boat tied up on the jetty's other side
  rowboat(o, sx, sy) {
    const K = OUTLINE, y = sy + Math.round(Math.sin(G.time * 1.9 + 1)), top = i => 5 + Math.round(Math.pow(Math.abs(i) / 13, 2) * 4), bot = i => Math.round(Math.pow(Math.abs(i) / 13, 3) * 5);
    pxEllipse(sx, sy + 1, 11, 1, 'rgba(6,14,28,.38)');
    for (let i = -13; i <= 13; i++) {
      const tp = top(i), bt = bot(i), ins = Math.abs(i) < 9 ? 2 : 0, from = Math.max(0, bt - 1);
      ctx.fillStyle = K; ctx.fillRect(sx + i, y - tp - ins, 1, tp - from + 1 + ins);
      ctx.fillStyle = '#6b4528'; ctx.fillRect(sx + i, y - tp + 1, 1, tp - bt); ctx.fillStyle = '#a3713f'; ctx.fillRect(sx + i, y - tp + 1, 1, 1);
      if (tp - bt > 3) { ctx.fillStyle = '#4e321d'; ctx.fillRect(sx + i, y - tp + 3, 1, 1); }
      if (ins) { ctx.fillStyle = ((i % 6) + 6) % 6 === 0 ? '#8a5a34' : '#2a1a10'; ctx.fillRect(sx + i, y - tp, 1, 1); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx + i, y - tp - 1, 1, 1); }
    }
    ctx.fillStyle = K; ctx.fillRect(sx - 14, y - top(13), 1, 6); ctx.fillRect(sx + 14, y - top(13), 1, 6);
    pxLine(sx - 7, y - 8, sx + 8, y - 6, '#c9b48e');       // the oars, shipped
    for (let i = 0; i <= 10; i++) { ctx.fillStyle = i % 3 ? '#c9b48e' : '#8a7a64'; ctx.fillRect(sx + 14 + i, Math.round(y - 8 - i * .9 + Math.sin(i / 10 * Math.PI) * 2), 1, 1); }   // its painter, up to a post
  },
  // a lantern on a post at the corner of the jetty, to steer home by
  harborlamp(o, sx, sy) {
    const K = OUTLINE, fl = mulberry(Math.floor(G.time * 8) + o.seed)(), lx = sx - 8, ly = sy - 27;
    pxEllipse(sx, sy + 1, 4, 1, 'rgba(0,0,0,.3)'); pxEllipse(lx, sy + 3, 12, 4, 'rgba(255,190,90,.1)');
    ctx.fillStyle = K; ctx.fillRect(sx - 2, sy - 32, 4, 33); ctx.fillRect(sx - 10, sy - 32, 9, 3);
    ctx.fillStyle = '#5a4430'; ctx.fillRect(sx - 1, sy - 31, 2, 31); ctx.fillRect(sx - 9, sy - 31, 8, 1); ctx.fillStyle = '#7c5e40'; ctx.fillRect(sx - 1, sy - 31, 1, 31);
    ctx.fillStyle = '#f2f7fb'; ctx.fillRect(sx - 10, sy - 33, 12, 1);
    ctx.fillStyle = K; ctx.fillRect(lx, ly - 2, 1, 2); ctx.fillRect(lx - 3, ly, 7, 9); ctx.fillStyle = '#4b4f57'; ctx.fillRect(lx - 2, ly + 1, 5, 1); ctx.fillRect(lx - 2, ly + 7, 5, 1);
    ctx.fillStyle = fl < .3 ? '#ffd463' : '#ffb347'; ctx.fillRect(lx - 2, ly + 2, 5, 5); ctx.fillStyle = '#fff3c4'; ctx.fillRect(lx - 1 + (fl < .5 ? 0 : 1), ly + 3, 2, 3);
    pxEllipse(lx, ly + 4, 11, 11, 'rgba(255,190,90,.09)'); pxEllipse(lx, ly + 4, 6, 6, 'rgba(255,200,110,.12)');
  },
};
function drawLonghouse(o, sx, sy, W, wallH, roofH) {
  const K = OUTLINE, half = W / 2, top = sy - wallH - roofH;
  pxEllipse(sx + 4, sy + 2, half + 4, 4, 'rgba(0,0,0,.3)');
  ctx.fillStyle = K; ctx.fillRect(sx - half - 1, sy - wallH - 1, W + 2, wallH + 2);
  for (let x = -half; x < half; x += 4) { ctx.fillStyle = ((x + half) / 4) % 2 ? '#6b4528' : '#7a5232'; ctx.fillRect(sx + x, sy - wallH, 4, wallH); ctx.fillStyle = '#4e321d'; ctx.fillRect(sx + x, sy - wallH, 1, wallH); }
  // the doorway, warm light inside
  ctx.fillStyle = K; ctx.fillRect(sx - 6, sy - 13, 12, 13); ctx.fillStyle = '#3a2416'; ctx.fillRect(sx - 5, sy - 12, 10, 12);
  ctx.fillStyle = '#c9792a'; ctx.fillRect(sx - 3, sy - 10, 6, 10); ctx.fillStyle = '#ffb347'; ctx.fillRect(sx - 2, sy - 8, 4, 8);
  if (o.variant) {                                    // a sign beside the door: a mug for the Mead Hall, an anvil for the Smithy
    const gx = sx - 24, gy = sy - wallH + 2;
    ctx.fillStyle = K; ctx.fillRect(gx - 1, gy - 1, 16, 12); ctx.fillStyle = '#c09a63'; ctx.fillRect(gx, gy, 14, 10); ctx.fillStyle = '#a07e4c'; ctx.fillRect(gx, gy + 9, 14, 1);
    if (o.variant === 'meadhall') { ctx.fillStyle = K; ctx.fillRect(gx + 3, gy + 2, 7, 7); ctx.fillRect(gx + 10, gy + 4, 2, 3); ctx.fillStyle = '#8a5a34'; ctx.fillRect(gx + 4, gy + 4, 5, 4); ctx.fillStyle = '#f3e9d4'; ctx.fillRect(gx + 4, gy + 3, 5, 1); }
    else { ctx.fillStyle = K; ctx.fillRect(gx + 2, gy + 2, 11, 4); ctx.fillRect(gx + 5, gy + 6, 5, 2); ctx.fillRect(gx + 3, gy + 8, 9, 1); ctx.fillStyle = '#6b7078'; ctx.fillRect(gx + 3, gy + 3, 9, 2); ctx.fillStyle = '#9aa0a6'; ctx.fillRect(gx + 3, gy + 3, 9, 1); }
  }
  // the roof: turf under deep snow, wider at the eaves
  for (let y = 0; y <= roofH; y++) {
    const k = y / roofH, ins = Math.round((1 - k) * 12), x0 = sx - half - 4 + ins, x1 = sx + half + 4 - ins;
    ctx.fillStyle = K; ctx.fillRect(x0 - 1, top + y, x1 - x0 + 2, 1);
    ctx.fillStyle = y < 2 ? '#4e321d' : y > roofH - 3 ? '#8a98a8' : y % 5 === 0 ? '#d8e4ee' : '#eef4f9'; ctx.fillRect(x0, top + y, x1 - x0, 1);
  }
  ctx.fillStyle = '#5a6e3a'; for (let x = sx - half - 2; x < sx + half + 2; x += 7) ctx.fillRect(x, top + roofH - 2, 3, 1);       // turf showing under the eaves
  // the ridge, and the crossed boards at both ends that end in carved heads
  ctx.fillStyle = '#4e321d'; ctx.fillRect(sx - half + 10, top - 1, W - 20, 2);
  for (const d of [-1, 1]) { const gx = sx + d * (half - 10); pxLine(gx - 5, top - 7, gx + 4, top + 2, '#4e321d'); pxLine(gx + 5, top - 7, gx - 4, top + 2, '#4e321d'); ctx.fillStyle = '#c9a032'; ctx.fillRect(gx - 6, top - 8, 2, 2); ctx.fillRect(gx + 5, top - 8, 2, 2); }
  // (no smoke off the roof: there's no chimney to come from)
}
/* ---- the longship ---- */
// Seen from the side, the way the houses are: a clinker hull that curves up to a dragon's head at the bow and a curled tail
// at the stern, shields along the rail, a steering oar, a mast with its stays, the striped sail set. Everything is measured
// from the keel: dx along it (the bow is +), and rows up from the water. The hull never changes, so it is drawn once and
// stamped; the sail, the pennant and the water are drawn over it every frame.
const SHIP_L = 56, SHIP_HW = SHIP_L + 14, SHIP_UP = 54, SHIP_MAST = 48, SHIP_CACHE = {};
const shipTop = i => 12 + Math.round(Math.pow(Math.abs(i) / SHIP_L, 2.2) * 9), shipBot = i => Math.round(Math.pow(Math.abs(i) / SHIP_L, 3.2) * 13);
function shipBody(dir) {
  if (SHIP_CACHE[dir]) return SHIP_CACHE[dir];
  const c = mkCanvas(SHIP_HW * 2 + 1, SHIP_UP + 4);
  if (dir < 0) { const x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(shipBody(1), 0, 0); return SHIP_CACHE[dir] = c; }
  const main = ctx; ctx = c.getContext('2d');
  try {
    const K = OUTLINE, L = SHIP_L, ox = SHIP_HW, oy = SHIP_UP, mh = SHIP_MAST, n0 = shipTop(L) - 2, WOOD = '#6b4528', LITE = '#a3713f', DARK = '#4e321d', GOLD = '#c9a032';
    const px = (dx, up, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(ox + dx, oy - up - h + 1, w, h); };
    const shapes = list => { for (const [dx, up, w, h] of list) px(dx - 1, up - 1, w + 2, h + 2, K); for (const [dx, up, w, h, col] of list) px(dx, up, w, h, col || WOOD); };
    // the stays, and the mast
    pxLine(ox + 2, oy - mh + 3, ox + L + 3, oy - n0 - 5, '#2a1a10'); pxLine(ox + 2, oy - mh + 3, ox - L - 3, oy - n0 - 5, '#2a1a10');
    px(1, 8, 3, mh - 7, K); px(2, 8, 1, mh - 8, '#8a5a34');
    // the hull: strakes that follow the rail, and a glimpse over it of the benches and the far side
    for (let i = -L; i <= L; i++) {
      const tp = shipTop(i), bt = shipBot(i), a = Math.abs(i), ins = a < 42 ? 2 : a < 46 ? 1 : 0, from = Math.max(0, bt - 1);
      px(i, from, 1, tp - from + 1 + ins, K);
      for (let r = bt; r < tp; r++) { const d = tp - 1 - r; px(i, r, 1, 1, d === 0 ? LITE : d < 4 ? '#7a5232' : d === 4 ? DARK : d < 8 ? WOOD : d === 8 ? DARK : '#5a3a22'); }
      if (ins === 2) { px(i, tp, 1, 1, ((i % 9) + 9) % 9 === 4 ? WOOD : '#2a1a10'); px(i, tp + 1, 1, 1, '#8a5a34'); } else if (ins) px(i, tp, 1, 1, '#8a5a34');
    }
    const eb = shipBot(L), eh = shipTop(L) - eb; px(L + 1, eb - 1, 1, eh + 2, K); px(-L - 1, eb - 1, 1, eh + 2, K);
    // the cargo aboard: a sea chest, a barrel, a sack
    shapes([[-19, 13, 6, 4, '#8a5a34'], [13, 13, 4, 5, '#7a5232'], [24, 14, 5, 3, '#a39478']]);
    px(-19, 15, 6, 1, DARK); px(-17, 14, 2, 1, GOLD); px(13, 14, 4, 1, '#4b4f57'); px(13, 16, 4, 1, '#4b4f57');
    // the stern: a post that rises and curls back over the deck
    const stern = []; for (let j = 0; j < 10; j++) stern.push([-(L + 2 + Math.round(j * .4)), n0 + j, 3, 1]);
    stern.push([-L - 6, n0 + 10, 5, 2], [-L - 2, n0 + 8, 2, 2], [-L - 1, n0 + 8, 1, 1, GOLD]); shapes(stern);
    // the bow: the neck, a gold collar, and the dragon's head with its jaw open
    const bow = []; for (let j = 0; j < 12; j++) bow.push([L + Math.round(j * .4), n0 + j, 3, 1]);
    bow.push([L + 3, n0 + 12, 6, 3], [L + 9, n0 + 12, 3, 2], [L + 7, n0 + 10, 4, 1], [L + 8, n0 + 9, 1, 1], [L + 2, n0 + 15, 3, 1], [L + 1, n0 + 16, 2, 1]); shapes(bow);
    for (let j = 0; j < 12; j++) px(L + 2 + Math.round(j * .4), n0 + j, 1, 1, LITE);
    px(L + 2, n0 + 6, 3, 1, GOLD); px(L + 3, n0 + 14, 6, 1, LITE); px(L + 7, n0 + 13, 1, 1, '#ffd463'); px(L + 8, n0 + 11, 2, 1, '#c0412e'); px(L + 11, n0 + 11, 1, 1, '#f3e9d4');
    // shields hung along the rail: a painted face, a shaded lower edge, an iron boss
    const SH = [['#c0412e', '#8f2c1f'], ['#e9c04f', '#b98f2c'], ['#3f72a0', '#2c5684'], ['#e6e0d0', '#b5ad98']];
    for (let i = -40, n = 0; i <= 40; i += 10, n++) {
      const cx = ox + i, cy = oy - shipTop(i) + 4, [face, shade] = SH[n % 4];
      pxEllipse(cx, cy, 3, 3, K); pxEllipse(cx, cy, 2, 2, face); ctx.fillStyle = shade; ctx.fillRect(cx - 1, cy + 2, 3, 1); ctx.fillRect(cx + 2, cy, 1, 1); ctx.fillStyle = n % 4 === 3 ? '#4b4f57' : '#d5dbe5'; ctx.fillRect(cx, cy, 1, 1);
    }
    // the steering oar at the stern quarter, with its tiller
    for (const [o, col] of [[-1, K], [1, K], [0, '#8a5a34']]) pxLine(ox - 44 + o, oy - 17, ox - 50 + o, oy - 2, col);
    px(-53, 0, 5, 5, K); px(-52, 0, 3, 4, '#8a5a34'); px(-45, 17, 6, 1, K); px(-44, 17, 4, 1, LITE);
  } finally { ctx = main; }
  return SHIP_CACHE[dir] = c;
}
// dir: 1 faces right. o.sea: under way (a bow wave, spray, a deeper shadow). o.crew: who stands aboard, as [frames, dx, flip].
function drawLongship(sx, sy, dir, t, o = {}) {
  const K = OUTLINE, mh = SHIP_MAST, base = sy + Math.round(Math.sin(t * 1.6)), X = dx => sx + dir * dx;
  const px = (dx, up, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dir > 0 ? sx + dx : sx - dx - w + 1, base - up - h + 1, w, h); };
  pxEllipse(sx, sy + (o.sea ? 2 : 1), SHIP_L - 4, o.sea ? 3 : 1, 'rgba(6,14,28,.38)');
  for (const [frames, dx, flip] of o.crew || []) drawSpr(frames, 0, X(dx), base - shipTop(dx) + 1, dir > 0 ? !!flip : !flip);   // (the rail hides their feet)
  ctx.drawImage(shipBody(dir), sx - SHIP_HW, base - SHIP_UP);
  // the sail: red and white, bellied out by the wind, its foot rippling
  const w = 36, x0 = -16;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < w; i++) {
    const foot = 23 - Math.round(Math.sin(i / (w - 1) * Math.PI) * 4 + Math.sin(t * 2.2 + i * .35) * .7), h = mh - 6 - foot, red = Math.floor(i / 6) % 2 === 0;
    if (!pass) { px(x0 + i - 1, foot - 1, 3, h + 2, K); continue; }
    px(x0 + i, foot, 1, h, red ? '#b0382a' : '#f3e9d4'); px(x0 + i, foot, 1, Math.round(h * .3), red ? '#96301f' : '#d9cdb4');
    if (i === w - 1) px(x0 + i, foot, 1, h, red ? '#96301f' : '#d9cdb4');
  }
  px(x0 - 3, mh - 6, w + 6, 3, K); px(x0 - 2, mh - 5, w + 4, 1, '#8a5a34');                   // the yard
  pxLine(X(x0), base - 22, X(-34), base - shipTop(-34) - 1, '#c9b48e'); pxLine(X(x0 + w - 1), base - 22, X(30), base - shipTop(30) - 1, '#c9b48e');   // the sheets
  if (o.sea) {                                             // the bow wave, and spray off it
    const R = mulberry(Math.floor(t * 9));
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#cfe3f5'; ctx.fillRect(X(24 + i * 3) - (dir < 0 ? 2 : 0), sy + 1 - ((i + Math.floor(t * 5)) % 2), 3, 1); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(X(28 + R() * 14)), Math.round(sy - 1 - R() * 5), 1, 1); }
  }
  // the pennant at the masthead, and the water working along the hull
  const fl = Math.floor(t * 5) % 2;
  px(-3, mh - 3, 6, 4, K); px(-7, mh - 3 - fl, 5, 4, K); px(-2, mh - 2, 4, 2, '#c0412e'); px(-6, mh - 2 - fl, 4, 2, '#c0412e'); px(-2, mh - 1, 4, 1, '#e9c04f');
  for (let i = -30; i <= 30; i += 3) if (((i * 7 + Math.floor(t * 2.5) * 13) % 11 + 11) % 11 < 3) { ctx.fillStyle = '#cfe3f5'; ctx.fillRect(sx + i, sy + 1, 2, 1); }
}
