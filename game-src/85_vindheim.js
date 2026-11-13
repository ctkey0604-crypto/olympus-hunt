/* ============================== THE NORTH: Vindheim, the map and the story ============================== */
// After Typhon's credits a stranger walks in through Akros' gate: Sigrun, from Vindheim in the far North. Once she has told
// you about it (save.north 2) the gate leads to the harbor, where the map takes you north. The first trip is a voyage you
// watch; after that it's a fade. Vindheim is small: Sigrun hands out the hunts, Brokk forges the North's gear, Åsa trades
// (and buys parts, like Melita now), and your chest is there too. Akros stays the main town (the Oracle, rooms, the Coliseum).
// save.north: 0 nothing yet · 1 Sigrun waits at Akros' gate · 2 she has told you (the map is open) · 3 you have sailed north.
Object.assign(PROP_ART, NORSE_PROPS);
Object.assign(PANEL_INFO, { map: { title: 'The Map' } });
const atVindheim = () => !!(V && V.id === 'vindheim');

/* ---- Akros: Sigrun at the gate, and the harbor road ---- */
// She waits just inside the gate, to the left of it.
const sigrunSpot = () => ({ x: tc(VILLAGE_MID - 1.5), y: IPX.maxY - 20 });
function sigrunAkros() {
  const at = sigrunSpot();
  return { id: 'sigrun', name: 'Sigrun', sprite: 'sigrun', x: at.x, y: at.y, r: 4, flip: false, walkT: 0, moving: false, talkT: 0,
           opens: () => { if (G.save.north < 2) northToldYou(); } };
}
// Every time you walk into Akros: Sigrun is there until you've sailed with her, and the gate is a way out once you know.
function northAkros(P) {
  const s = G.save;
  P.gateK = 0;                                                 // the gate is shut whenever you come in
  P.npcs = P.npcs.filter(n => n.id !== 'sigrun');
  if (s.north >= 1 && s.north < 3 && !(G.cutscene && G.cutscene.kind === 'stranger')) P.npcs.push(sigrunAkros());
  P.spots = P.spots.filter(sp => sp.id !== 'harbor');
  if (northOpen(s)) P.spots.push({ id: 'harbor', name: 'the harbor road', kind: 'harbor', opens: 'map', x: tc(VILLAGE_MID), y: IPX.maxY - 4 });
}
// After Typhon (and his credits): she arrives. Saves that beat Typhon before 1.1 see it the next time they're in Akros.
function northStory() {
  const s = G.save;
  if (!s || s.north || !s.cleared[TYPHON_Q] || !s.legend || V.id !== 'village' || G.cutscene) return;
  const n = sigrunAkros(); n.x = tc(VILLAGE_MID) - 6; n.y = WORLD_H - 8; n.flip = false; V.npcs.push(n);     // she starts out on the road, beyond the gate
  const p = V.player; p.x = tc(VILLAGE_MID) + 10; p.y = IPX.maxY - 50; p.face = Math.PI / 2; p.moving = false;   // and you step back to watch her come in
  G.cutscene = { kind: 'stranger', t: 0, npc: n }; Music.play('vindheim');
}
function northToldYou() {
  const s = G.save; s.north = Math.max(s.north, 2); persist(true);
  northAkros(V); Sound.play('blessing'); CG.happy();
  banner('The North is open', 'Walk out through Akros’ gate to sail north with Sigrun', true);
}

/* ---- Vindheim ---- */
// 40 x 30 tiles, but the village itself stops at row 21: below it is the harbor, deep enough for the longship to lie in.
const VIND_W = 40, VIND_H = 30, VIND_IN = { x0: 3, y0: 3, x1: 36, y1: 21 }, VIND_PX = { minX: 48, maxX: 592, minY: 48, maxY: 352 };
const VIND_PROPS = [
  ['longhouse', 20, 6.4], ['smallhouse', 7.5, 19.6], ['forgefire', 8.2, 12.2], ['anvil', 10.8, 13.4], ['norsestall', 31, 13.4], ['chestbox', 12.4, 19.8],
  ['statue', 5.5, 7.2, 'heimdall'], ['statue', 8.5, 7.2, 'freyja'], ['statue', 11.5, 7.2, 'tyr'], ['statue', 28.5, 7.2, 'loki'], ['statue', 31.5, 7.2, 'thor'], ['statue', 34.5, 7.2, 'odin'],
  ['tstatue', 20, 15.8, 'fenrir'], ['runestone', 23.4, 10], ['brazier', 15.6, 10.2], ['brazier', 24.6, 11], ['brazier', 17, 16.2], ['brazier', 23, 16.2],
  ['snowpine', 4, 4], ['snowpine', 36, 4], ['snowpine', 4, 13], ['snowpine', 36.2, 10.6], ['snowpine', 35.6, 20.2], ['snowpine', 4.4, 20.6], ['snowpine', 28.2, 20.6],
  ['logpile', 14, 13.6], ['logpile', 26.4, 19.4], ['meadbarrel', 16.6, 9.8], ['meadbarrel', 34, 13], ['meadbarrel', 28.6, 13.6], ['rock', 31, 18.8], ['stump', 15.4, 20.6],
  ['crate', 27.9, 25.5], ['meadbarrel', 27.3, 25], ['harborlamp', 29, 24.75], ['pier', 19, 24.5], ['rowboat', 17.375, 23.375], ['longship', 25.375, 24.1875],
];
// The jetty: a boardwalk out over the water (x0..x1), then a landing that runs east from its end (hx0..hx1, hy0..hy1). The
// longship lies in the pocket between the landing and the shore, so you stand in front of her and she hides nobody.
// You can walk all of it: JETTY_OPEN are the tiles opened in the sea, JETTY_EDGE trims them to the boards.
const JETTY = { x0: 312, x1: 344, hx0: 312, hx1: 476, hy0: 400, hy1: 424 }, SHIP_AT = { x: 414, y: 397 };
const JETTY_OPEN = [{ x: 19, y: 22, w: 3, h: 3 }, { x: 19, y: 25, w: 11, h: 2 }];
const JETTY_EDGE = [{ x: 304, y: 352, w: 8, h: 80 }, { x: 344, y: 352, w: 8, h: 48 }, { x: 476, y: 400, w: 4, h: 32 }, { x: 304, y: 424, w: 176, h: 8 }];
const JETTY_LINES = [[362, SHIP_AT.x - 48, SHIP_AT.y - 16], [440, SHIP_AT.x + 40, SHIP_AT.y - 14]];   // each mooring post, and where its line is made fast aboard
const jettyPiles = () => [10, 46, 82, 118, 154].map(d => JETTY.hx0 + d);
const VIND_NPCS = [
  { id: 'sigrun', name: 'Sigrun', sprite: 'sigrun', tx: 20, ty: 10.4, opens: () => openPanel('quests', 'Hunts in the North') },
  { id: 'brokk', name: 'Brokk the Smith', sprite: 'brokk', tx: 10, ty: 15.2, opens: () => openPanel('armory', 'Brokk’s Forge') },
  { id: 'asa', name: 'Åsa the Trader', sprite: 'asa', tx: 31, ty: 11.9, behind: true, opens: () => openPanel('market', 'Åsa’s Trading Post') },
];
function buildVindheim() {
  const props = VIND_PROPS.map(([k, tx, ty, v]) => { const o = mkObstacle(k, tx, ty, v); if (k === 'statue' || k === 'tstatue') o.trophy = true; return o; });
  const layers = genLayers('vindheim', null, { seed: 'vindheim', inner: VIND_PX }), gx = layers.ground.getContext('2d');
  paintVindheim(gx, mulberry(hashStr('vindheim:paint')));
  const npcs = VIND_NPCS.map(n => ({ ...n, x: tc(n.tx), y: tc(n.ty), r: 4, flip: n.tx > 20, walkT: 0, moving: false, talkT: 0 }));
  const spots = [{ id: 'chest', name: 'your sea chest', kind: 'chest', opens: 'stash', x: tc(12.4), y: tc(19.8) + 14 },
                 { id: 'dock', name: 'the longship', kind: 'dock', opens: 'map', x: SHIP_AT.x, y: JETTY.hy0 + 6 }];
  for (const n of npcs) if (n.behind) spots.push({ id: n.id + '_stall', kind: 'npc', npc: n, name: n.name, x: n.x, y: n.y + 26 });   // talk to Åsa from in front of her stall
  for (const o of props) if (o.kind === 'statue' || o.kind === 'tstatue') spots.push({ id: 'statue_' + o.variant, name: 'the statue', kind: 'statue', god: o.variant, x: o.x, y: o.y + 10 });
  return { id: 'vindheim', name: 'Vindheim', theme: 'vindheim', music: 'vindheim', exitTo: null, tick: vindheimTick,
           world: makeWorld([...props.filter(o => !OBST[o.kind].soft).map(o => o.box), ...JETTY_EDGE], JETTY_OPEN, VIND_IN), ground: layers.ground, buildings: [], props, npcs, spots, parts: [], fx: [], texts: [], player: null, target: null, smokeT: 0 };
}
// Trodden paths through the snow, and the pier out to the longship.
function paintVindheim(x, R) {
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); };
  const path = (pts, w) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let k = 0; k <= n; k++) { const px = lerp(ax, bx, k / n), py = lerp(ay, by, k / n); for (let j = 0; j < 6; j++) dot(px + (R() - .5) * w * 2, py + (R() - .5) * w, R() < .5 ? '#c8d4de' : '#bccad6', 2, 1); }
    }
  };
  path([[tc(20), VIND_PX.maxY], [tc(20), tc(17.5)], [tc(20), tc(11)]], 12);
  path([[tc(20), tc(13)], [tc(14), tc(14.5)], [tc(10), tc(16)]], 9);
  path([[tc(20), tc(13)], [tc(26), tc(14.5)], [tc(31), tc(15.5)]], 9);
  path([[tc(18), tc(19)], [tc(13), tc(20.6)]], 8);
  paintJetty(x, R);
}
// Weathered boards on piles: a walkway from the shore, a landing across its end, snow lying where nobody treads.
function paintJetty(x, R) {
  const { x0, x1, hx0, hx1, hy0, hy1 } = JETTY, y0 = VIND_PX.maxY - 8, K = OUTLINE, GAP = '#3a2a1c', WOOD = ['#8a6a4a', '#7c5e40', '#96764f', '#84643f'];
  const box = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(px), Math.round(py), w, h); }, pick = () => WOOD[(R() * WOOD.length) | 0];
  // its shadow on the water, and the piles the landing stands on
  box(x0 - 3, VIND_PX.maxY + 1, x1 - x0 + 6, hy0 - VIND_PX.maxY, 'rgba(6,14,28,.4)'); box(hx0 - 3, hy0 + 1, hx1 - hx0 + 6, hy1 - hy0 + 10, 'rgba(6,14,28,.4)');
  for (const px of jettyPiles()) { box(px - 2, hy1 + 4, 5, 7, '#150f0c'); box(px - 1, hy1 + 4, 3, 6, '#46331f'); box(px - 1, hy1 + 4, 1, 6, '#5a4430'); }
  // the walkway: boards laid across it, two to a row, nailed at both ends
  box(x0 - 1, y0 - 1, x1 - x0 + 2, hy0 - y0 + 1, K);
  for (let py = y0; py < hy0; py += 4) {
    const cut = x0 + 6 + ((R() * (x1 - x0 - 12)) | 0);
    box(x0, py, x1 - x0, 4, GAP); box(x0, py, cut - x0, 3, pick()); box(cut + 1, py, x1 - cut - 1, 3, pick()); box(x0 + 1, py + 1, 1, 1, GAP); box(x1 - 2, py + 1, 1, 1, GAP);
  }
  // the landing: boards the other way, and the front edge of it facing you
  box(hx0 - 1, hy0 - 1, hx1 - hx0 + 2, hy1 - hy0 + 6, K);
  for (let px = hx0; px < hx1; px += 4) {
    const cut = hy0 + 6 + ((R() * (hy1 - hy0 - 12)) | 0);
    box(px, hy0, 4, hy1 - hy0, GAP); box(px, hy0, 3, cut - hy0, pick()); box(px, cut + 1, 3, hy1 - cut - 1, pick()); box(px + 1, hy0 + 1, 1, 1, GAP); box(px + 1, hy1 - 2, 1, 1, GAP);
    box(px, hy1, 3, 3, '#5a4430'); box(px, hy1 + 3, 4, 1, '#46331f'); box(px + 3, hy1, 1, 3, '#46331f');
  }
  box(x0, hy0 - 1, x1 - x0, 1, GAP);                       // (the walkway runs straight onto it)
  // posts down both sides and at the landing's corners, each with a cap of snow
  const post = (px, py) => { box(px - 2, py - 8, 5, 10, K); box(px - 1, py - 7, 3, 8, '#5a4430'); box(px - 1, py - 7, 1, 8, '#7c5e40'); box(px - 1, py - 8, 3, 2, '#f2f7fb'); box(px, py - 7, 2, 1, '#cfdbe6'); };
  for (const py of [VIND_PX.maxY + 2, 376, 398]) { post(x0 - 3, py); post(x1 + 2, py); }   // (the lantern post stands at the landing's far corner)
  // snow: drifted against the shore end, and dusted along the edges
  for (const px of [x0 - 6, x1 + 1]) { box(px, y0 - 2, 6, 3, '#f2f7fb'); box(px + 1, y0 + 1, 4, 1, '#cfdbe6'); }
  const snow = (px, py) => { box(px, py, 2 + ((R() * 3) | 0), 1, '#eef4f9'); if (R() < .5) box(px + 1, py + 1, 2, 1, '#cfdbe6'); };
  for (let i = 0; i < 10; i++) snow(R() < .5 ? x0 + R() * 4 : x1 - 6 + R() * 3, y0 + 3 + R() * (hy0 - y0 - 8));
  for (let i = 0; i < 26; i++) { const side = R(); snow(side < .15 ? hx0 + R() * 5 : side < .4 ? hx1 - 7 + R() * 4 : hx0 + 3 + R() * (hx1 - hx0 - 10), side < .4 ? hy0 + 2 + R() * (hy1 - hy0 - 6) : R() < .35 ? hy0 + R() * 2 : hy1 - 3 + R() * 2); }
}
function vindheimTick(dt) {
  if (Math.random() < .35) V.parts.push({ x: G.cam.x + rand(-10, VIEW_W + 40), y: G.cam.y - 4, vx: rand(-14, -4), vy: rand(14, 26), g: 0, life: 9, max: 9, c: Math.random() < .7 ? '#ffffff' : '#cfe3f5', s: Math.random() < .25 ? 2 : 1 });
}
function vindheimArrive(p) { p.x = SHIP_AT.x; p.y = JETTY.hy0 + 9; p.face = Math.PI; }   // stepping off the ship onto the landing, looking toward the village
function vindheimBanner(from) {
  if (from === 'ship') banner('Vindheim', G.save.north >= 3 ? 'Sigrun’s village, at the edge of the world' : '');
  else banner('Vindheim', 'Back from the hunt');
}

/* ---- what they say ---- */
function northLines(n) {
  const s = G.save, c = s.cleared, done = base => !!c[nid(base)];
  switch (n.id) {
    case 'sigrun':
      if (V.id === 'village') {
        if (s.north < 2) return ['You’re the one who slew Typhon? Good. I sailed a long way to find you.',
          'My name is Sigrun. I come from Vindheim, a village in the far North, past the edge of every map you have.',
          'Our gods have gone wild. Heimdall turns everyone back from the rainbow bridge, and the wolf Fenrir is pulling at his chain.',
          'If that chain breaks, Fenrir swallows the sun. We need a hunter, and every story says it’s you.',
          'My ship is at the harbor below the gate. Walk out through the gate when you’re ready, and we sail north.'];
        return ['The ship is ready at the harbor, just past the gate. Walk out and we sail.'];
      }
      if (c[FENRIR_Q]) return ['Fenrir is down, and the sun still rises over Vindheim. Skál, hunter.', 'The hunts are still here if you want the parts. The North never really sleeps.'];
      if (isUnlocked(QUEST_BY_ID[FENRIR_Q])) return ['Every god of the North has fallen to you. Only the wolf is left.', 'Gleipnir is fraying. Go to Lyngvi before it snaps on its own.'];
      if (!done('heimdall_hunt')) return ['Welcome to Vindheim. It’s small, but it’s warm.', 'Brokk forges gear from what the North drops. Åsa trades, and she’ll buy whatever you don’t need.',
        'Start with the bridge. Heimdall has been turning everyone back.'];
      return ['Pick a hunt. Every god you put down is one less thing pulling at Fenrir’s chain.'];
    case 'brokk': return [Object.keys(s.inv).some(k => ITEMS[k] && ITEMS[k].north) ? 'Northern parts. Now we’re talking. Bring enough of them and I’ll forge you something that doesn’t crack in the cold.'
                                                                                 : 'You’re the Greek. Bring me what the North drops, and drachmae, and I’ll forge you something that doesn’t crack in the cold.'];
    case 'asa': return ['Potions for the cold, parts from any hunt up here you’ve cleared, and I’ll buy whatever you’re tired of carrying.'];
  }
  return null;
}

/* ---- the North's hunts on the board ---- */
// God by god like the Olympus board, the next god's name showing as locked, then Fenrir once all six have fallen.
function northBoardList(mine) {
  const s = G.save; let html = '', shownLock = false, hidden = 0;
  for (const g of NORSE_GODS) {
    const qs = mine.filter(qd => qd.god === g.id);
    if (!qs.some(qd => isUnlocked(qd))) {
      if (!shownLock) { shownLock = true; const prev = NORSE_GODS[NORSE_GODS.indexOf(g) - 1]; html += `<div class="qlock">${esc(g.name)} · ${prev ? 'beat ' + esc(prev.name) + ' to unlock' : 'locked'}</div>`; }
      else hidden++;
      continue;
    }
    html += `<p class="chapter">${esc(g.name)}</p>` + qs.map(questCard).join('');
  }
  if (hidden) html += `<div class="qlock">${hidden} more god${hidden > 1 ? 's' : ''} further north</div>`;
  const fq = QUEST_BY_ID[FENRIR_Q];
  if (isUnlocked(fq) || s.cleared[FENRIR_Q]) html += `<p class="rank titans final">The last hunt of the North</p>` + questCard(fq);
  else if (s.cleared[nid('heimdall_hunt')]) html += `<div class="qlock">Something on Lyngvi is pulling at its chain · hunt every god of the North first</div>`;
  return html;
}
// Forge tabs: Brokk only forges the North's gear. Dion shows the North's tab only for wearing what you already own.
const northOwned = s => s.weapons.some(id => WEAPONS[id] && WEAPONS[id].north) || s.shields.some(id => SHIELDS[id] && SHIELDS[id].north) || s.pieces.some(id => PIECES[id] && ARMOR_SETS[PIECES[id].set].north);
const gearTag = d => d.north ? `<span class="rk" data-rank="${NORTH_TAB}">${NORDIC_NAME}</span>` : rankTag(d.rank);

/* ---- the map, and sailing ---- */
// The map is the whole screen: point at a place and it lights up, click (or tap) it and you sail there. No money shown here.
const MAP_PLACES = [{ id: 'akros', x: 70, y: 140, name: 'AKROS', go: 'SAIL HOME TO AKROS', col: '#c35f2a', lab: '#ffd463' },
                    { id: 'vindheim', x: 222, y: 40, name: 'VINDHEIM', go: 'SAIL NORTH', col: '#9fd0ff', lab: '#e6f2ff' }];
let mapHover = null;
function renderMap() {
  const first = G.save.north < 3;
  return `<div class="map-box"><canvas id="mapCanvas" width="320" height="180" tabindex="0" aria-label="A map of the sea between Akros and Vindheim. Press Enter to sail to the other one."></canvas></div>
    <p class="muted map-tip">${touchMode ? 'Tap' : 'Click'} a place to sail there.${first ? ' The first crossing takes a while; after that the longship knows the way.' : ''}</p>`;
}
const mapHere = () => atVindheim() ? 'vindheim' : 'akros';
function mapHit(ev) {
  const c = $('mapCanvas'), r = c.getBoundingClientRect(), x = (ev.clientX - r.left) * c.width / r.width, y = (ev.clientY - r.top) * c.height / r.height;
  return MAP_PLACES.find(p => Math.hypot(p.x - x, p.y - y) < 26) || null;
}
function drawMap() {
  const c = $('mapCanvas'); if (!c) return;
  if (!c.dataset.on) {                                     // pointing, clicking, and Enter for the keyboard
    c.dataset.on = '1'; mapHover = null;
    c.addEventListener('pointermove', ev => { const h = mapHit(ev), id = h && h.id !== mapHere() ? h.id : null; c.style.cursor = id ? 'pointer' : 'default'; if (id !== mapHover) { mapHover = id; drawMap(); } });
    c.addEventListener('pointerleave', () => { if (mapHover) { mapHover = null; drawMap(); } });
    c.addEventListener('click', ev => { const h = mapHit(ev); if (h && h.id !== mapHere()) { Sound.play('click'); travelTo(h.id); } });
    c.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); travelTo(mapHere() === 'akros' ? 'vindheim' : 'akros'); } });
  }
  const x = c.getContext('2d'), W = c.width, H = c.height, R = mulberry(7), here = mapHere();
  x.imageSmoothingEnabled = false;
  for (let y = 0; y < H; y++) { const k = y / H; x.fillStyle = `rgb(${Math.round(26 + k * 24)},${Math.round(56 + k * 56)},${Math.round(92 + k * 56)})`; x.fillRect(0, y, W, 1); }
  for (let i = 0; i < 220; i++) { x.fillStyle = R() < .5 ? '#5a90b8' : '#3f72a0'; x.fillRect((R() * W) | 0, (R() * H) | 0, 3, 1); }
  const blob = (cx, cy, rx, ry, cols) => { for (let py = -ry; py <= ry; py++) { const w = rx * Math.sqrt(Math.max(0, 1 - (py / ry) ** 2)); for (let px = -w; px <= w; px++) if (R() < .95) { x.fillStyle = cols[(R() * cols.length) | 0]; x.fillRect((cx + px) | 0, (cy + py) | 0, 1, 1); } } };
  // the North along the top: snow, ice and mountains, with a fjord where Vindheim sits
  for (let px = 0; px < W; px++) { const h = 34 + Math.sin(px / 19) * 7 + Math.sin(px / 7) * 3 - Math.max(0, 9 - Math.abs(px - 222) * .7); x.fillStyle = '#e6eef5'; x.fillRect(px, 0, 1, h); x.fillStyle = '#9fb4c8'; x.fillRect(px, h - 2, 1, 2); }
  for (let i = 0; i < 11; i++) { const mx = 10 + i * 30 + R() * 8, mh = 10 + R() * 13; for (let k = 0; k < mh; k++) { x.fillStyle = k < 4 ? '#ffffff' : '#7a8a9e'; x.fillRect((mx - k * .8) | 0, (5 + k) | 0, Math.max(1, (k * 1.6) | 0), 1); } }
  for (let i = 0; i < 9; i++) { const fx = 30 + R() * 260, fy = 46 + R() * 22; x.fillStyle = OUTLINE; x.fillRect(fx | 0, fy | 0, 6, 3); x.fillStyle = '#e6f6ff'; x.fillRect((fx + 1) | 0, (fy + 1) | 0, 4, 1); }   // ice floes
  // Greece along the bottom: Akros' island and its neighbours
  blob(66, 148, 36, 14, ['#7a9a48', '#8aa856', '#c9b48e']); blob(150, 164, 20, 8, ['#7a9a48', '#c9b48e']); blob(252, 154, 30, 11, ['#6f9040', '#8aa856', '#c9b48e']); blob(300, 172, 14, 6, ['#7a9a48', '#c9b48e']);
  // the route between them, a compass, and the longship where you are
  const [A, B] = MAP_PLACES, hot = mapHover && MAP_PLACES.find(p => p.id === mapHover);
  for (let i = 0; i <= 40; i++) { const k = i / 40, px = lerp(A.x, B.x, k) + Math.sin(k * 6) * 14, py = lerp(A.y, B.y, k); if (i % 2 === 0) { x.fillStyle = hot ? '#ffd463' : '#f3e9d4'; x.fillRect(px | 0, py | 0, 2, 1); } }
  { const cx = 290, cy = 96; x.fillStyle = '#c9d0dc'; x.fillRect(cx, cy - 9, 1, 19); x.fillRect(cx - 9, cy, 19, 1); x.fillStyle = '#ffd463'; x.fillRect(cx - 1, cy - 9, 3, 4); x.drawImage(pixelText('N', '#ffd463', tagGlyph), cx - 1, cy - 18); }
  for (const P of MAP_PLACES) {
    const on = P === hot, cur = P.id === here, sz = on ? 5 : 3;
    if (on) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + G.time * 2; x.fillStyle = P.lab; x.fillRect((P.x + Math.cos(a) * 11) | 0, (P.y + Math.sin(a) * 8) | 0, 1, 1); }
    x.fillStyle = OUTLINE; x.fillRect(P.x - sz - 1, P.y - sz - 1, sz * 2 + 3, sz * 2 + 3); x.fillStyle = P.col; x.fillRect(P.x - sz, P.y - sz, sz * 2 + 1, sz * 2 + 1); x.fillStyle = '#ffffff'; x.fillRect(P.x - 1, P.y - 1, 2, 2);
    const name = pixelText(P.name, on ? '#ffffff' : P.lab, tagGlyph), up = P.id === 'vindheim';
    x.drawImage(name, Math.round(P.x - name.width / 2), up ? P.y + 9 : P.y - 17);
    const note = cur ? pixelText('YOU ARE HERE', '#c2b293', tagGlyph) : on ? pixelText(P.go, '#ffd463', tagGlyph) : null;
    if (note) x.drawImage(note, Math.round(P.x - note.width / 2), up ? P.y + 17 : P.y + 9);
  }
  const sp = here === 'akros' ? A : B; drawMapShip(x, sp.x + (here === 'akros' ? 24 : -17), sp.y + (here === 'akros' ? -4 : 3));   // moored beside the marker, clear of its name
}
// a tiny longship on the map
function drawMapShip(x, sx, sy) {
  x.fillStyle = OUTLINE; x.fillRect(sx - 6, sy - 1, 13, 4); x.fillStyle = '#6b4528'; x.fillRect(sx - 5, sy, 11, 2); x.fillRect(sx - 6, sy - 1, 1, 1); x.fillRect(sx + 6, sy - 2, 1, 2);
  x.fillStyle = OUTLINE; x.fillRect(sx - 3, sy - 9, 7, 8); for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f3e9d4' : '#b0382a'; x.fillRect(sx - 2 + i, sy - 8, 1, 6); }
}
function travelTo(dest) {
  const s = G.save;
  if (dest === 'vindheim') {
    if (!northOpen(s)) return;
    Sound.play('door');
    if (s.north < 3) { fadeTo(startVoyage); return; }
    fadeTo(() => enterPlace('vindheim', 'ship'));
  } else { Sound.play('door'); fadeTo(() => enterVillage('gate')); }
}
// The first crossing: the longship heads north out of the warm sea, past ice, under the northern lights.
function startVoyage() {
  if (!V) enterVillage('gate');
  resumeVillage(); G.cutscene = { kind: 'voyage', t: 0 }; Music.play('voyage'); document.body.classList.add('voyaging');   // (hides the town's place name and purse)
}
// No words on the way: the sea, the ice and the northern lights tell it.
function tickVoyage(cs, dt) {
  cs.t += dt;
  if (cs.t > 1.2 && interactPressed()) cs.t = Math.max(cs.t, 8.8);       // seen it before? Skip ahead
  if (cs.t > 9) { G.cutscene = null; G.save.north = 3; persist(true); enterPlace('vindheim', 'ship'); }
}
function drawVoyage(cs) {
  const t = cs.t, k = clamp(t / 9, 0, 1), W = VIEW_W, H = VIEW_H, horizon = 92, R = mulberry(Math.floor(t * 6));
  // the sky goes from a warm blue to a cold night
  for (let y = 0; y < horizon; y++) { const a = y / horizon; const c0 = [lerp(120, 12, k), lerp(170, 22, k), lerp(220, 48, k)], c1 = [lerp(230, 40, k), lerp(220, 60, k), lerp(190, 96, k)];
    ctx.fillStyle = `rgb(${Math.round(lerp(c0[0], c1[0], a))},${Math.round(lerp(c0[1], c1[1], a))},${Math.round(lerp(c0[2], c1[2], a))})`; ctx.fillRect(0, y, W, 1); }
  if (k > .55) for (let i = 0; i < 40; i++) { const r = mulberry(i * 13); ctx.fillStyle = r() < .3 ? '#ffd463' : '#ffffff'; ctx.globalAlpha = clamp((k - .55) * 4, 0, 1); ctx.fillRect((r() * W) | 0, (r() * horizon * .7) | 0, 1, 1); }
  ctx.globalAlpha = 1;
  if (k > .62) {                                            // the northern lights, rippling
    ctx.globalAlpha = clamp((k - .62) * 3, 0, .7);
    for (let px = 0; px < W; px += 2) { const y0 = 14 + Math.sin(px / 30 + t * .8) * 8 + Math.sin(px / 11 + t * 1.7) * 3, h = 14 + Math.sin(px / 19 + t) * 6; for (let yy = 0; yy < h; yy += 2) { ctx.fillStyle = yy < h * .4 ? '#7fe08a' : yy < h * .75 ? '#57c2b0' : '#b48cff'; ctx.fillRect(px, Math.round(y0 + yy), 2, 2); } }
    ctx.globalAlpha = 1;
  }
  // far shores: a green island behind you at first, snowy mountains ahead later
  const isl = W * .1 - t * 14;
  if (isl > -60) { ctx.fillStyle = '#6f9040'; for (let i = -30; i <= 30; i++) ctx.fillRect(Math.round(isl + i), horizon - Math.round(8 * Math.sqrt(1 - (i / 30) ** 2)), 1, 9); }
  const mt = W + 40 - t * 26;
  for (let i = 0; i < 6; i++) { const mx = mt + i * 34, mh = 18 + (i * 7) % 13; for (let y = 0; y < mh; y++) { ctx.fillStyle = y < 5 ? '#f2f7fb' : '#5a6a7e'; ctx.fillRect(Math.round(mx - y), horizon - mh + y, y * 2 + 1, 1); } }
  // the sea, moving past
  for (let y = horizon; y < H; y++) { const a = (y - horizon) / (H - horizon); ctx.fillStyle = `rgb(${Math.round(lerp(lerp(60, 14, k), lerp(30, 8, k), a))},${Math.round(lerp(lerp(120, 40, k), lerp(70, 26, k), a))},${Math.round(lerp(lerp(170, 72, k), lerp(120, 52, k), a))})`; ctx.fillRect(0, y, W, 1); }
  for (let i = 0; i < 70; i++) { const r = mulberry(i * 31), y = horizon + 3 + r() * (H - horizon - 3), sp = 20 + (y - horizon) * 1.2, px = ((r() * W * 2 - t * sp) % (W + 20) + W + 20) % (W + 20) - 10; ctx.fillStyle = r() < .3 ? '#e6f2ff' : k > .5 ? '#3a6a8a' : '#7fb8d8'; ctx.fillRect(Math.round(px), Math.round(y), 3 + ((r() * 4) | 0), 1); }
  // ice floes: flat slabs, small near the horizon and bigger close by. The ones nearer than the ship pass in front of her.
  const shipY = horizon + 64, floes = near => {
    if (k > .35) for (let i = 0; i < 6; i++) {
      const iy = horizon + 20 + (i * 37) % 80, d = (iy - horizon) / (H - horizon), ix = Math.round(W + 30 + i * 70 - t * (22 + d * 26)), rx = Math.round(4 + d * 9);
      if ((iy > shipY) !== near || Math.abs(iy - shipY) < 5 || ix < -20 || ix > W + 20) continue;
      pxEllipse(ix, iy + 2, rx, 2, '#5f8fb5'); pxEllipse(ix, iy, rx, 2, '#e6f6ff'); ctx.fillStyle = '#ffffff'; ctx.fillRect(ix - (rx >> 1), iy - 1, rx, 1);
    }
  };
  floes(false);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 3 ? '#e6f2ff' : '#a8d4f2'; ctx.fillRect(Math.round(W / 2 - 30 - i * 7 + R() * 4), horizon + 65 + (i % 3) - (i > 6 ? 1 : 0), 4 - (i > 8 ? 2 : 0), 1); }   // the wake
  drawLongship(Math.round(W / 2), shipY, 1, t * 2, { sea: true, crew: [['sigrun', -36, false], [heroFrames(V.player.look), 34, false]] });   // Sigrun at the steering oar, you at the bow
  floes(true);
  if (k > .3) for (let i = 0; i < Math.round(60 * (k - .3)); i++) { const r = mulberry(i * 7 + 1), px = ((r() * W - t * 20 * (1 + r())) % W + W) % W, py = ((r() * H + t * (18 + r() * 14)) % H); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); }   // snow
  if (!vignette) vignette = makeVignette();
  ctx.drawImage(vignette, 0, 0);
  if (t > 1.2) { const w = pixelText(touchMode ? 'TAP TO SKIP' : 'PRESS ' + codeLabel(Input.bind.guard[0]).toUpperCase() + ' TO SKIP', '#c2b293', tagGlyph); ctx.globalAlpha = .7; ctx.drawImage(w, W - w.width - 6, H - 12); ctx.globalAlpha = 1; }
}
// Sigrun walks up to Akros' gate, pushes its doors open, comes through and stops just inside it. The doors swing shut
// behind her. V.gateK is how far open they are (0 shut, as painted into the ground; drawn by drawAkrosGate).
function tickStranger(cs, dt) {
  cs.t += dt; const n = cs.npc, at = sigrunSpot(), p = V.player, sp = 32 * dt, g = V.gate && V.gate.at;
  if (!g) cs.opened = true;
  const tx = clamp((n.x + p.x) / 2 - VIEW_W / 2, 0, WORLD_W - VIEW_W), ty = clamp((n.y + p.y) / 2 - 10 - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 3); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 3);
  // up the road to the doors, open them, through the gate, then a step to the side of it
  n.moving = false;
  if (cs.t > .8) {
    const stop = cs.opened ? at.y : Math.max(at.y, g.by + 12);
    if (n.y > stop) { n.y = Math.max(stop, n.y - sp); n.moving = true; }
    else if (!cs.opened) { if (!cs.push) { cs.push = true; Sound.play('door'); } V.gateK = Math.min(1, (V.gateK || 0) + dt / .8); if (V.gateK >= 1) cs.opened = true; }
    else if (n.x > at.x) { n.x = Math.max(at.x, n.x - sp); n.moving = true; n.flip = true; }
    else n.flip = false;
    if (n.moving) n.walkT += dt;
  }
  if (g && cs.opened && n.y < g.y0 - 8 && V.gateK > 0) {         // she's through: the doors swing shut
    if (!cs.shut) { cs.shut = true; Sound.play('door'); }
    V.gateK = Math.max(0, V.gateK - dt / .8);
  }
  p.face = Math.atan2(n.y - p.y, n.x - p.x);                   // you watch her come in
  if (cs.t > .6 && !cs.b1) { cs.b1 = true; banner('A stranger at the gate', 'She has come a long way to find you', true); }
  if (cs.t > 1.5 && !n.moving && n.y <= at.y && n.x <= at.x && !V.gateK && !cs.done) { cs.done = true; cs.end = cs.t + 1.2; }
  if (cs.done && cs.t > cs.end) {
    G.cutscene = null; G.save.north = 1; persist(true); n.moving = false; n.flip = false; Music.play('akros');
    banner('Sigrun is waiting by the gate', 'Go and talk to her');
  }
}
// Akros' gate while it stands open: the passage without its painted doors, then the doors at their angle (40_world.js).
function drawAkrosGate(cx, cy) {
  const g = V.gate, a = g && g.at; if (!a || !(V.gateK > 0)) return;
  ctx.drawImage(g.clean, a.x0 - cx, a.y0 - cy);
  ctx.save(); ctx.translate(-cx, -cy); drawGateDoors(ctx, a.x0, a.x1, a.by, V.gateK); ctx.restore();
}
const NORTH_CUTSCENES = { voyage: tickVoyage, stranger: tickStranger };
const CUTSCENE_DRAW = { voyage: drawVoyage };

/* ---- trading: buying parts, and selling them ---- */
// Melita (Akros) and Åsa (Vindheim) both buy any part you carry, for a tenth of what they'd charge you for it. Each has
// stock from the hunts you've cleared in her part of the world. They always have the drachmae: there's no purse.
const trader = () => atVindheim() ? 'asa' : 'melita';
function sellPrice(id) { return Math.max(1, Math.round(partCost(id) * SELL_SHARE)); }
// Gear you haven't forged yet that this part goes into (so the sell list can warn you).
function partWanted(id) {
  const s = G.save;
  for (const [wid, w] of Object.entries(WEAPONS)) if (w.recipe && w.recipe.items[id] && !s.weapons.includes(wid)) return true;
  for (const P of Object.values(PIECES)) if (P.recipe && P.recipe.items[id] && !s.pieces.includes(P.id)) return true;
  for (const [sid, sh] of Object.entries(SHIELDS)) if (sh.recipe && sh.recipe.items[id] && !s.shields.includes(sid)) return true;
  return false;
}
// The account server turns away a save whose drachmae climb faster than hunting pays (Store.room, 30_core.js). A sale
// bigger than that is paid in steps, sending the save between them; it only stops early if the account can't be reached.
let selling = false;
async function sellPart(id, n) {
  const s = G.save, price = sellPrice(id), want = Math.min(n, s.inv[id] || 0);
  let left = want, got = 0;
  while (left > 0 && G.save === s) {
    let room = Store.room(G.slot, s);
    if (room < price) { await Store.syncNow(G.slot, s); room = Store.room(G.slot, s); if (room < price || G.save !== s) break; }
    const k = Math.min(left, Math.floor(room / price), s.inv[id] || 0); if (k <= 0) break;
    s.inv[id] -= k; if (s.inv[id] <= 0) delete s.inv[id];
    s.money += k * price; left -= k; got += k * price;
  }
  if (got && G.save === s) persist();
  return { n: want - left, got, left };
}
function renderSell() {
  const s = G.save, who = trader() === 'asa' ? 'Åsa' : 'Melita';
  const tabs = chestTabs(), tab = tabs.includes(G.sellTab) ? G.sellTab : tabs[tabs.length - 1]; G.sellTab = tab;
  const ids = Object.keys(ITEMS).filter(id => s.inv[id] > 0 && northTab(ITEMS[id]) === tab).sort((a, b) => ITEMS[a].rarity - ITEMS[b].rarity || ITEMS[a].name.localeCompare(ITEMS[b].name));
  const seg = tabs.length > 1 ? `<div class="board-top"><div class="seg">${tabs.map(r => `<button type="button" data-selltab="${r}" data-rank="${r}" aria-pressed="${tab === r}">${tabName(r)}<span class="n">${Object.keys(s.inv).filter(id => s.inv[id] > 0 && ITEMS[id] && northTab(ITEMS[id]) === r).length}</span></button>`).join('')}</div></div>` : '';
  const head = `<p class="muted" style="margin:0 0 10px">${who} buys any part for a tenth of what she sells it for.</p>`;
  if (!ids.length) return head + seg + `<div class="empty-note">Nothing to sell here. Parts you bring home from hunts show up here.</div>`;
  return head + seg + `<div class="stash shop">${ids.map(id => {
    const it = ITEMS[id], n = s.inv[id], price = sellPrice(id), want = partWanted(id);
    return `<div class="mat"><img class="px-icon" alt="" src="${icon(id)}"><div><b class="r${it.rarity}">${esc(it.name)}</b><p>You have ${n}</p>${want ? '<p class="warn-soft">Needed for gear</p>' : ''}</div>
      <div class="sell-btns"><button class="btn small" type="button" data-sell="${id}:1">Sell 1 · ${fmtMoney(price)} dr</button>${n > 1 ? `<button class="btn ghost small" type="button" data-sell="${id}:all">Sell all · ${fmtMoney(n * price)} dr</button>` : ''}</div></div>`;
  }).join('')}</div>`;
}
// The tabs the chest and the sell list use: each rank you've reached, and the North once anything from it is yours.
function chestTabs(s = G.save) {
  const tabs = s.rank > 0 ? RANKS.slice(0, s.rank + 1).map(R => R.id) : [0];
  if (northOpen(s) || Object.keys(s.inv).some(id => ITEMS[id] && ITEMS[id].north)) tabs.push(NORTH_TAB);
  return tabs;
}
const tabName = r => r === NORTH_TAB ? NORDIC_NAME : RANKS[r].name;
$('scrHub').addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t || !G.save) return;
  if (t.dataset.travel) { travelTo(t.dataset.travel); return; }
  if (t.dataset.shoptab) { G.shopTab = t.dataset.shoptab; Sound.play('click'); renderHub(); return; }
  if (t.dataset.selltab) { G.sellTab = +t.dataset.selltab; Sound.play('click'); renderHub(); return; }
  if (t.dataset.sell && !selling) {
    const [id, n] = t.dataset.sell.split(':'), name = ITEMS[id].name; selling = true;
    sellPart(id, n === 'all' ? 1e9 : +n || 1).then(r => {
      selling = false; if (G.mode === 'panel' && G.panel === 'market') renderHub();
      if (r.n) Sound.play('coin');
      if (r.left) toast(r.n ? `Sold ${r.n}. Your account can’t be reached right now, so you kept the rest. Try again in a moment.` : 'Your account can’t be reached right now. Try again in a moment.', 6000);
      else toast(`Sold ${r.n > 1 ? r.n + ' × ' : ''}${name} for ${fmtMoney(r.got)} dr`);
    }, () => { selling = false; });
  }
});
