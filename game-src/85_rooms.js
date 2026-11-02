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
});
// soft: you can walk over it (stools)
Object.assign(OBST, {
  counter: { w: 72, h: 10 }, table: { w: 26, h: 10 }, stool: { w: 8, h: 4, soft: true }, barrel: { w: 12, h: 8 }, bed: { w: 20, h: 28 },
  chestbox: { w: 18, h: 8 }, furnace: { w: 46, h: 12 }, armorstand: { w: 12, h: 6 }, shelf: { w: 40, h: 6 }, fireplace: { w: 34, h: 10 },
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
    seats: [[83, 131, 0], [125, 131, Math.PI], [259, 131, 0], [301, 131, Math.PI]],
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
};
for (const R of Object.values(ROOMS)) { R.wt = 24; R.ht = 15; }

function buildRoom(id) {
  const D = ROOMS[id];
  const props = D.props.map(([k, tx, ty, v]) => mkObstacle(k, tx, ty, v));
  const layers = genLayers(D.theme, null, { gate: { x: 11, y: 12, w: 2 }, seed: id, axis: WORLD_W / 2 });
  const gx = layers.ground.getContext('2d');
  for (const [x, y, w, h, c1, c2] of D.rugs || []) paintRug(gx, x, y, w, h, c1, c2);
  const npcs = (D.npcs || []).map(n => ({ ...n, r: 4, flip: !!n.flip, walkT: 0, moving: false, talkT: 0 }));
  const spots = (D.spots || []).map(s => ({ ...s }));
  for (const n of npcs) if (n.behind) spots.push({ id: n.id + '_counter', kind: 'npc', npc: n, name: n.name, x: n.x, y: n.y + 24 });   // just in front of the counter
  (D.seats || []).forEach(([x, y, face], i) => spots.push({ id: 'seat' + i, name: 'a seat', kind: 'seat', x, y, face }));
  return { id, name: D.name, theme: D.theme, sub: D.sub, music: Music.songs['room_' + id] ? 'room_' + id : 'akros', exitTo: 'village',
           world: makeWorld(props.filter(o => !OBST[o.kind].soft).map(o => o.box), [{ x: 11, y: 12, w: 2, h: 2 }]),
           ground: layers.ground, buildings: [], props, npcs, spots, parts: [], fx: [], texts: [], player: null, target: null, smokeT: 0 };
}
function paintRug(x, rx, ry, w, h, c1, c2) {
  x.fillStyle = '#1a1210'; x.fillRect(rx - 1, ry - 1, w + 2, h + 2);
  x.fillStyle = c1; x.fillRect(rx, ry, w, h);
  x.fillStyle = c2; x.fillRect(rx + 2, ry + 2, w - 4, 1); x.fillRect(rx + 2, ry + h - 3, w - 4, 1); x.fillRect(rx + 2, ry + 2, 1, h - 4); x.fillRect(rx + w - 3, ry + 2, 1, h - 4);
  for (let px = rx + 6; px < rx + w - 6; px += 8) { x.fillRect(px, ry + Math.floor(h / 2) - 1, 3, 1); x.fillRect(px + 1, ry + Math.floor(h / 2) - 2, 1, 3); }
}
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
  stool(o, sx, sy) { pxEllipse(sx, sy, 5, 2, 'rgba(0,0,0,.3)'); ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 4, sy - 6, 8, 6); ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 3, sy - 5, 6, 2); ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx - 3, sy - 3, 1, 3); ctx.fillRect(sx + 2, sy - 3, 1, 3); },
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
const MEALS = {
  stew:    { name: 'Shepherd’s Stew',   short: 'Stew',       food: true,  art: 'bowl',   price: 120, desc: '+10% health on your next hunt.', hp: .10 },
  skewers: { name: 'Lamb Skewers',      short: 'Skewers',    food: true,  art: 'skewer', price: 160, desc: '+6% damage on your next hunt.', dmg: .06 },
  bread:   { name: 'Olive Bread',       short: 'Olive bread', food: true, art: 'bread',  price: 120, desc: '+10% defense on your next hunt.', def: .10 },
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
    return `<article class="gear${mine ? ' meal-on' : ''}"><div class="gear-head"><div><b>${esc(M.name)}</b><span>${M.food ? 'Food' : 'Drink'}</span></div></div>
      <p class="desc">${esc(M.desc)}</p>
      <div class="stats"><span>Price <b class="gold">${fmtMoney(cost)} dr</b></span></div>
      <div class="actions"><button class="btn small" type="button" data-meal="${id}" ${cur || s.money < cost ? 'disabled' : ''}>${mine ? 'You ate this' : cur ? 'You’ve already eaten' : 'Order'}</button></div></article>`;
  };
  const list = Object.entries(MEALS);
  return `<p class="muted" style="margin:0 0 12px">One meal or drink per hunt. It lasts your next hunt, then you can order again.</p>
    ${cur ? `<div class="unlock" style="margin:0 0 12px">You’ve already ${cur.food ? 'eaten' : 'had'} the ${esc(cur.name)}: ${esc(cur.desc)} Come back after your hunt.</div>` : ''}
    <p class="sub">Food</p><div class="grid">${list.filter(([, M]) => M.food).map(card).join('')}</div>
    <p class="sub" style="margin-top:14px">Drinks</p><div class="grid">${list.filter(([, M]) => !M.food).map(card).join('')}</div>`;
}
// Eating it, right there in the Tavern: a few bites (or sips), crumbs or drops, then a little tune and a sparkle.
// You stand still while you eat. V.eat = { meal, t, dur, bites: times left to play a bite sound }.
const eatState = id => { const M = MEALS[id]; return { meal: id, t: 0, dur: M.food ? 2.2 : 1.8, bites: M.food ? [.35, .95, 1.55] : [.45, 1.15] }; };
function startEating(id) {
  const p = V.player;
  p.face = Math.PI / 2; p.moving = false; V.target = null;
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
  const M = MEALS[e.meal], [sx, sy] = S(p.x, p.y), K = OUTLINE;
  // from the hand (by the hip) up to the mouth and back
  const lift = Math.max(0, Math.sin(e.t * Math.PI / (M.food ? .6 : .7))), x = Math.round(sx + 5 - lift * 3), y = Math.round(sy - 6 - lift * 5);
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  if (M.art === 'bowl') { R(-3, -2, 7, 4, K); R(-2, -1, 5, 2, '#a3713f'); R(-2, -2, 5, 1, '#c35f2a'); if (Math.floor(e.t * 6) % 2) R(-1, -5, 1, 2, '#e6e1d6'); }
  else if (M.art === 'skewer') { R(-5, 0, 11, 1, '#c09a63'); for (const cx of [-4, -1, 2]) { R(cx, -2, 3, 4, K); R(cx + 1, -1, 1, 2, '#a3532a'); } }
  else if (M.art === 'bread') { R(-3, -2, 7, 4, K); R(-2, -1, 5, 2, '#d9a35a'); R(-1, -2, 3, 1, '#e9c27a'); R(0, -1, 1, 1, '#4e5a3a'); }
  else if (M.art === 'cup') { R(-3, -3, 7, 3, K); R(-2, -3, 5, 2, '#c9a032'); R(-2, -3, 5, 1, '#e9a030'); R(0, 0, 1, 2, '#c9a032'); R(-1, 2, 3, 1, '#c9a032'); }
  else { R(-3, -4, 6, 7, K); R(-2, -3, 4, 5, '#9aa0a6'); R(-2, -4, 4, 1, '#c8e6c9'); R(2, -2, 2, 3, K); }
}
