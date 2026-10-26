/* ============================== VILLAGE ================================== */
// Two walkable places: the village of Akros, and the Temple of the Gods inside it.
const BUILDINGS = [
  { id: 'temple', name: 'Temple of the Gods', kind: 'temple', x: 14.5, y: 3, w: 12, h: 5, goes: 'temple' },   // centred on the path, the fountain and the gate
  { id: 'forge',  name: 'The Forge',            kind: 'forge',  x: 4,  y: 8, w: 7,  h: 5, opens: 'armory' },
  { id: 'hall',   name: 'Herald’s Hall',   kind: 'hall',   x: 29, y: 8, w: 7,  h: 5, opens: 'quests' },
  { id: 'store',  name: 'Storehouse',           kind: 'store',  x: 4,  y: 16, w: 6, h: 4, opens: 'stash' },
  { id: 'home',   name: 'Your Home',            kind: 'home',   x: 30, y: 16, w: 6, h: 4, opens: 'options' },
];
const VILLAGE_PROPS = [
  ['fountain', 20, 14], ['anvil', 12, 11], ['board', 35, 14], ['stall', 14, 18], ['stall', 26, 18], ['crate', 11, 17], ['amphora', 12, 17],
  ['amphora', 28, 20], ['crate', 29, 21], ['olive', 5, 5], ['olive', 35, 5], ['olive', 13, 21], ['olive', 27, 22], ['olive', 6, 22], ['olive', 34, 22],
];
const NPCS = [
  { id: 'smith',  name: 'Dion the Smith',   sprite: 'smith',  tx: 12, ty: 13, opens: 'armory' },
  { id: 'herald', name: 'Kleon the Herald', sprite: 'herald', tx: 28, ty: 13, opens: 'quests' },
  { id: 'keeper', name: 'Phaedra',          sprite: 'keeper', tx: 11, ty: 19, opens: 'stash' },
  { id: 'oracle', name: 'The Oracle',       sprite: 'oracle', tx: 22, ty: 10 },
  { id: 'merchant', name: 'Melita the Trader', sprite: 'merchant', tx: 14, ty: 19.4, opens: 'market' },
];
const PANEL_INFO = {
  quests:  { title: 'Quests' },
  market:  { title: 'Market' },
  armory:  { title: 'The Forge' },
  stash:   { title: 'Storehouse' },
  options: { title: 'Your Home' },
  shrine:  { title: 'Hestia’s Hearth' },
};
// Rank progress. A rank is done when every god (side gods too) and every Titan has been hunted on it.
const rankDone = (r, save = G.save) => [...ALL_GOD_QUESTS, ...TITANS.map(t => t.quest)].every(id => save.cleared[rid(id, r)]);
const allGodsDone = (r, save = G.save) => ALL_GOD_QUESTS.every(id => save.cleared[rid(id, r)]);
// The rank the herald is waiting to open (shown as a ! over his head), or 0.
function rankReady(save = G.save) { return save && save.rank < RANKS.length - 1 && rankDone(save.rank, save) ? save.rank + 1 : 0; }
// Everything hunted on the last rank: Kleon has a word for you (for now, the end of the game).
// God Rank done: Typhon climbs out from under Etna, and Kleon has to tell you. Typhon down: Kleon's last word.
function typhonReady(save = G.save) { return !!save && save.rank === RANKS.length - 1 && rankDone(save.rank, save) && !save.cleared[TYPHON_Q] && !save.typhonTold; }
function finaleReady(save = G.save) { return !!save && !!save.cleared[TYPHON_Q] && !save.finale; }
const heraldNews = () => !!(rankReady() || typhonReady() || finaleReady());
function finishGame() {
  const s = G.save; if (s.finale) return;
  s.finale = true; persist(true);
  banner('Thank you for playing', 'Olympus Hunt', true); Sound.play('blessing'); CG.happy(); Music.play('credits');
}
function unlockRank(r) {
  const s = G.save; if (s.rank >= r) return;
  s.rank = r; G.boardRank = r; G.forgeRank = r; persist(true);
  banner(`${RANKS[r].name} unlocked`, r === 1 ? 'Every hunt starts over, harder' : 'The gods stop holding back', true);
  Sound.play('blessing'); CG.happy();
}
function npcLines(n) {
  const s = G.save, c = s.cleared;
  switch (n.id) {
    case 'herald': {
      const ready = rankReady();
      if (ready === 1) return ['Hunter. Sit down a moment.', 'You’ve beaten every god on Olympus and every Titan under it. Word got around, and not the good kind.',
        'The gods are back, and they’re angry. Faster, meaner, hitting harder. Their beasts too.', 'High Rank is open. Every hunt on the board starts over, and none of it will go easy.'];
      if (ready === 2) return ['You did it again. Every god and every Titan, even the angry ones.', 'There’s one thing left. Until now the gods held back. Not anymore.',
        'God Rank is open. Good luck. I mean that.'];
      if (typhonReady()) return ['Hunter. Every god and every Titan, on every rank. Even God Rank. I thought that was the end of it.',
        'Then Mount Etna split open. Zeus buried Typhon under it once, the father of every monster you’ve ever hunted.',
        'He’s out. A hundred serpent heads, wings like a storm, and he throws the mountain itself.', 'His hunt is on the board. This is the last one. Go finish it.'];
      if (finaleReady()) return ['You slew Typhon. The father of monsters, gone for good.', 'Every god, every Titan, and the father of monsters himself. Nobody has ever hunted like you.',
        'Congratulations, hunter. You finished Olympus Hunt. Thank you for playing.', 'The board still has work and the forge still has fire, whenever you want them.'];
      if (s.cleared[TYPHON_Q]) return ['They’re still singing about how you slew Typhon. The board still has work, and the smith says your gear can always be sharper.'];
      if (s.typhonTold) return ['Typhon’s hunt is on the board. The last one. Go finish it.'];
      if (s.finale) return ['You’ve hunted everything there is, on every rank. More is coming. Until then, the board still has work.'];
      if (!c.road_bandits) return ['You’re the new hunter? Good. Bandits are robbing travelers on the Delphi road.', 'Pick a hunt from the board and I’ll send you out.'];
      if (s.rank === 0 && allGodsDone(0) && !s.stairs) return ['Every god on Olympus, beaten. The priests say the temple floor shook last night.', 'Something under it wants out. Go and see.'];
      if (s.rank === 0 && s.stairs && !rankDone(0)) return ['The Titans. I never thought I’d post their names on this board.', 'Their hunts are up. Be careful down there.'];
      if (s.rank > 0) return [`${RANKS[s.rank].name} work’s on the board. Everything out there hits harder now.`];
      if (c.zeus_hunt) {                                 // the twelve are down, but the temple waits on every god
        const left = ALL_GOD_QUESTS.filter(id => !c[id]).map(id => godName(QUEST_BY_ID[id].boss));
        if (left.length) return ['You’ve hunted all twelve gods of Olympus. The priests say the temple won’t settle until ' + (left.length > 1 ? left.slice(0, -1).join(', ') + ' and ' + left[left.length - 1] : left[0]) + (left.length > 1 ? ' are' : ' is') + ' hunted too.'];
        return ['You’ve hunted every god there is. The board still has work if you want parts.'];
      }
      return ['Work’s on the board. Pick a hunt and I’ll send you out.'];
    }
    case 'smith': return [Object.keys(s.inv).length ? 'Let’s see what you dragged home. Parts and drachmae, and I’ll make you something worth swinging.' : 'Bring me monster parts and drachmae and I’ll forge you something better than that bronze stick.'];
    case 'keeper': return ['Everything you carry home goes in the storehouse. Counted twice.'];
    case 'merchant': return ['Potions for the road. Health, strength and speed, brewed this morning.'];
    case 'oracle': {
      const unfound = QUESTS.filter(qd => isUnlocked(qd) && !s.chests[qd.id]);
      if (!unfound.length) return [QUESTS.every(qd => s.chests[qd.id]) ? 'Every hidden cache I can see has been opened. You have sharp eyes.' : 'I see no unopened caches on the paths you can walk. Unlock new hunts and ask me again.'];
      const pick = unfound[G.oracleIdx++ % unfound.length], A = ARENAS[pick.arena];
      return ['Every hunting ground hides a cache. Walk into the right wall and it gives way.', A.secret.hint || nookHint(A.name, A.theme, A.secret)];
    }
  }
  return ['…'];
}
function godName(id) { return (BOSSES[id] || {}).name || id; }
// Under the temple: eight Titans along the walls and the gate their hunts start from.
function buildHall() {
  const props = [];
  TITANS.forEach((t, i) => { const left = i < 4, o = mkObstacle('tstatue', left ? 9.5 : 29.5, 7.6 + (i % 4) * 4.1, t.id); props.push(o); });
  [[5, 6], [34, 6], [5, 14], [34, 14], [5, 21], [34, 21]].forEach(([tx, ty]) => props.push(mkObstacle('brazier', tx, ty)));
  [[14, 9], [25, 9], [14, 18], [25, 18]].forEach(([tx, ty]) => { const o = mkObstacle('column', tx, ty); o.variant = 'dark'; props.push(o); });
  const layers = genLayers('titanhall', null, { seed: 'hall' }), gx = tc(20) - 8;
  paintTartarusGate(layers.ground.getContext('2d'), mulberry(hashStr('tgate')), gx - 24, gx + 24, IPX.maxY, WORLD_H);
  const spots = [{ id: 'upstairs', name: 'the stairs', kind: 'stairs', goes: 'temple', x: tc(20) - 8, y: IPX.minY + 10 },
                 { id: 'tgate', name: 'the Gate of Tartarus', kind: 'tgate', opens: 'quests', x: gx, y: IPX.maxY - 4 }];
  for (const o of props) if (o.kind === 'tstatue') spots.push({ id: 'statue_' + o.variant, name: 'the statue', kind: 'statue', god: o.variant, x: o.x, y: o.y + 10 });
  return { id: 'hall', name: 'Hall of the Titans', theme: 'titanhall', night: true, world: makeWorld(props.map(o => o.box)),
           ground: layers.ground, buildings: [], props, npcs: [], spots, parts: [], fx: [], texts: [], player: null, target: null, smokeT: 0 };
}
function buildVillage() {
  const buildings = BUILDINGS.map(b => ({ ...b, box: { x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE } }));
  const props = VILLAGE_PROPS.map(([k, tx, ty, v]) => mkObstacle(k, tx, ty, v));
  const layers = genLayers('village', null, { gate: { x: 19, y: 23, w: 3 }, gateRoad: true });
  const npcs = NPCS.map(n => ({ ...n, x: tc(n.tx), y: tc(n.ty), r: 4, flip: n.tx > 20, walkT: 0, moving: false, talkT: 0 }));
  const spots = [];
  for (const b of buildings) {
    const door = { id: b.id + '_door', name: b.goes ? 'the ' + b.name : b.name, kind: 'door', x: b.kind === 'temple' ? (b.x + b.w / 2) * TILE : tc(b.x + Math.floor(b.w / 2)), y: (b.y + b.h) * TILE + 6 };
    if (b.opens) door.opens = b.opens; if (b.goes) door.goes = b.goes;
    spots.push(door);
  }
  for (const o of props) if (o.kind === 'board') spots.push({ id: 'board', name: 'the notice board', kind: 'board', opens: 'quests', x: o.x, y: o.y + 8 });
  return { id: 'village', name: 'Akros', theme: 'village', world: makeWorld([...buildings.map(b => b.box), ...props.filter(o => o.kind !== 'gatedoors').map(o => o.box), { x: 19 * TILE, y: IPX.maxY - 6, w: 3 * TILE, h: 6 }]),
           ground: layers.ground, buildings, props, npcs, spots, parts: [], fx: [], texts: [], player: null, target: null, smokeT: 0 };
}
// Inside the temple: the twelve gods along the back wall, the side-hunt gods along the walls, Hestia's hearth in the middle.
function buildTemple() {
  const props = [];
  GODS.forEach((g, i) => { const o = mkObstacle('statue', 4.6 + i * 2.8, 4.4, g.id); o.trophy = true; props.push(o); });
  [[5, 9.5], [5, 13.5], [5, 17.5], [35, 9.5], [35, 13.5]].forEach(([tx, ty], i) => { const o = mkObstacle('statue', tx, ty, SIDE_GODS[i].id); o.trophy = true; props.push(o); });
  [[10, 9], [30, 9], [10, 18], [30, 18]].forEach(([tx, ty]) => props.push(mkObstacle('column', tx, ty)));
  props.push(mkObstacle('hearth', 20, 13));
  [[14.5, 20], [25.5, 20]].forEach(([tx, ty]) => props.push(mkObstacle('brazier', tx, ty)));
  // Everything in here lines up on the doorway: carpet, hearth, braziers, stairway, columns and statues.
  const layers = genLayers('hall', null, { gate: { x: 19, y: 23, w: 3 }, seed: 'temple', axis: tc(20) });
  const spots = [];
  // The stairway down to the Titans, behind Hestia's hearth. Only there once it has opened.
  const boxes = props.map(o => o.box);
  if (G.save && G.save.stairs) { boxes.push({ x: STAIRS.x, y: STAIRS.y, w: STAIRS.w, h: STAIRS.h - 4 }); spots.push({ id: 'downstairs', name: 'the stairs', kind: 'stairs', goes: 'hall', x: STAIRS.x + STAIRS.w / 2, y: STAIRS.y + STAIRS.h + 4 }); }
  for (const o of props) {
    if (o.kind === 'statue') spots.push({ id: 'statue_' + o.variant, name: 'the statue', kind: 'statue', god: o.variant, x: o.x, y: o.y + 10 });
    if (o.kind === 'hearth') spots.push({ id: 'hearth', name: 'Hestia’s hearth', kind: 'hearth', opens: 'shrine', x: o.x, y: o.y + 9 });
  }
  return { id: 'temple', name: 'Temple of the Gods', theme: 'hall', world: makeWorld(boxes, [{ x: 19, y: 23, w: 3, h: 2 }]), stairsOpen: !!(G.save && G.save.stairs),
           ground: layers.ground, buildings: [], props, npcs: [], spots, parts: [], fx: [], texts: [], player: null, target: null, smokeT: 0 };
}
const STAIRS = { x: 19 * 16, y: 7 * 16, w: 48, h: 30 };   // centred on the doorway, like the carpet
// The Gate of Tartarus, set into the hall's south wall like Akros' gate: the wall's cut ends on both sides, black stone
// steps going down into the dark, and heavy bronze doors shut across the top of them, with Tartarus' light at the seam.
function paintTartarusGate(x, R, x0, x1, yTop, yBot) {
  const dot = (px, py, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, w, h); }, len = yBot - yTop;
  for (let i = 0; i < len; i++) { const k = i / len, v = Math.round(58 * (1 - k) + 6); dot(x0, yTop + i, `rgb(${v},${Math.round(v * .86)},${Math.round(v * 1.12)})`, x1 - x0, 1); }
  for (let py = yTop + 12; py < yBot; py += 6) { const k = (py - yTop) / len; dot(x0 + 3, py, `rgba(120,100,150,${.35 * (1 - k)})`, x1 - x0 - 6, 1); dot(x0 + 3, py + 1, 'rgba(0,0,0,.5)', x1 - x0 - 6, 1); }   // step edges
  for (let i = 0; i < 26; i++) { const k = R(); dot(x0 + 4 + R() * (x1 - x0 - 8), yTop + 14 + k * (len - 16), `rgba(180,140,255,${.15 + k * .3})`); }   // the glow from below
  dot(x0 + 3, yBot - 10, 'rgba(140,90,220,.18)', x1 - x0 - 6, 10);
  for (const [fx, lit] of [[x0, true], [x1 - 3, false]]) { dot(fx, yTop, lit ? '#56525e' : '#1e1c22', 3, len); for (let py = yTop + 3; py < yBot; py += 7) dot(fx, py, lit ? '#3a3640' : '#141218', 3, 1); dot(lit ? fx + 3 : fx - 1, yTop, '#0a090c', 1, len); }
  dot(x0 + 3, yTop, '#a8842a', x1 - x0 - 6, 1);                                       // a bronze threshold
  const by = yTop + 3, w = x1 - x0 - 6;                                               // the doors, shut
  dot(x0 + 3, by + 8, 'rgba(0,0,0,.45)', w, 3);
  dot(x0 + 3, by - 1, '#0a090c', w, 10); dot(x0 + 4, by, '#4a3a24', w - 2, 8); dot(x0 + 4, by, '#7a5a2a', w - 2, 1); dot(x0 + 4, by + 7, '#2e2416', w - 2, 1);
  for (let px = x0 + 9; px < x1 - 6; px += 6) dot(px, by + 1, '#3a2e1c', 1, 6);
  const mid = Math.round((x0 + x1) / 2); dot(mid - 1, by - 1, '#0a090c', 2, 10); dot(mid - 1, by + 1, '#8a5ad8', 2, 6); dot(mid - 1, by + 3, '#b48cff', 2, 2);   // the seam, lit from below
  for (const px of [x0 + 8, x0 + 16, x1 - 10, x1 - 18]) { dot(px, by + 3, '#140d0b', 2, 2); dot(px, by + 3, '#e9c04f'); }
}
function enterPlace(id, from) {
  // a brand-new hunter starts on the road outside the gate, where the controls are taught
  if (id === 'village' && G.save.tut === TUT.ROAD) { if (Settings.data.tips !== false) { startPrologue(); return; } G.save.tut = TUT.TALK; }
  setWorldSize(40, 26);
  // the temple is rebuilt when the stairway has opened since it was last built
  if (id === 'temple' && PLACES.temple && PLACES.temple.stairsOpen !== !!G.save.stairs) delete PLACES.temple;
  if (!PLACES[id]) PLACES[id] = id === 'temple' ? buildTemple() : id === 'hall' ? buildHall() : buildVillage();
  V = PLACES[id]; sc = V; q = null; V.parts = []; V.fx = []; V.texts = [];
  Music.play(id === 'village' ? 'akros' : id);
  const p = makePlayer();
  if (id === 'hall') { p.x = tc(20) - 8; p.y = IPX.minY + 24; p.face = Math.PI / 2; }
  else if (id === 'temple' && from === 'hall') { p.x = STAIRS.x + STAIRS.w / 2; p.y = STAIRS.y + STAIRS.h + 10; p.face = Math.PI / 2; }
  else if (id === 'temple') { p.x = tc(20); p.y = IPX.maxY - 14; p.face = -Math.PI / 2; }
  else if (from === 'gate' || from === 'road') { p.x = tc(20); p.y = IPX.maxY - 14; p.face = -Math.PI / 2; }
  else if (from === 'temple') { p.x = tc(20); p.y = 8 * TILE + 14; p.face = Math.PI / 2; }
  else { p.x = tc(20); p.y = tc(17); }
  V.player = p;
  G.cam.x = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W); G.cam.y = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  resumeVillage();
  $('vPlace').textContent = V.name;
  if (id === 'village' && !G.save.seenIntro) {
    G.save.seenIntro = true; persist(); banner('Akros', 'Talk to Kleon the Herald, east of the fountain');
    showHint(touchMode ? 'Drag on the left to walk · tap Use to talk' : `${moveKeysHTML()} to walk · ${kbd(Input.bind.guard[0])} to talk and open doors`, 9);
  }
  if (id === 'village' && heraldNews()) banner('Akros', 'Kleon the Herald wants a word');
  if (id === 'temple' && from !== 'hall' && from !== 'stairs') {
    if (!G.save.stairs && allGodsDone(0)) G.cutscene = { kind: 'stairs', t: 0 };   // every god is down: the floor opens
    else banner('Temple of the Gods', 'Every god you hunt is gilded here');
  }
  if (id === 'hall') {
    if (!G.save.seenHall) { G.save.seenHall = true; persist(); banner('Hall of the Titans', 'Their hunts start at the gate at the far end'); }
    else banner('Hall of the Titans', '');
  }
}
function enterVillage(from) { enterPlace('village', from); }
function resumeVillage() {
  sc = V; G.mode = 'village'; G.paused = false; G.dialog = null; G.panel = null;
  G.slowmo = 1; G.hitstop = 0; G.shake = 0; G.flash = 0;
  if (V.player) { V.player.st = playerStats(); V.player.look = { ...G.save.equip }; }
  hideScreens(); $('stage').hidden = false; $('pause').hidden = true; resize();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  Input.down.clear(); Input.endFrame();
  hudMode('village'); tutGoal();
}
function interactPressed() { return Input.hit('guard') || Input.hit('attack') || Input.enter; }
function nearestInteract(p) {
  let best = null, bd = 22;
  for (const n of V.npcs) { const d = dist(p, n); if (d < bd) { bd = d; best = { kind: 'npc', npc: n, name: n.name, x: n.x, y: n.y }; } }
  for (const s of V.spots) { const d = dist(p, s); if (d < bd) { bd = d; best = s; } }
  return best;
}
function startInteract(t) {
  Sound.play('click');
  if (t.kind === 'npc') {
    const n = t.npc; n.talkT = 4; n.flip = V.player.x < n.x;
    const ready = n.id === 'herald' ? rankReady() : 0, ty = n.id === 'herald' && typhonReady(), fin = n.id === 'herald' && finaleReady();
    const after = ready ? () => unlockRank(ready) : ty ? () => { G.save.typhonTold = true; persist(true); G.boardRank = 2; G.selQuest = TYPHON_Q; openPanel('quests'); } : fin ? finishGame : n.opens;
    openDialog(n.name, npcLines(n), after, n.sprite);
  } else if (t.kind === 'statue') { const r = godRank(t.god); openDialog('Statue', [r >= 0 ? `${STATUE_WORD[r]} statue of ${godName(t.god)}.` : `Statue of ${godName(t.god)}.`], null); }
  else if (t.goes) { Sound.play('door'); fadeTo(() => enterPlace(t.goes, V.id)); }
  else if (t.kind === 'tgate') { G.boardTitans = true; openPanel('quests'); }
  else if (t.opens) openPanel(t.opens);
}
function openDialog(who, lines, after, face = null) {
  G.dialog = { who, lines, i: 0, chars: 0, after };
  $('dlgWho').textContent = who; $('dialog').hidden = false; $('prompt').hidden = true;
  // a small portrait of whoever is talking
  const c = $('dlgFace'), x = c.getContext('2d'); c.hidden = !face;
  if (face && SPR[face]) { const fr = SPR[face][0]; x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height); x.drawImage(fr.n, Math.round((c.width - fr.w) / 2), 1); }
  renderDialog();
}
function renderDialog() {
  const d = G.dialog; if (!d) return;
  const line = d.lines[d.i], shown = line.slice(0, Math.floor(d.chars));
  $('dlgLine').textContent = shown;
  const last = d.i >= d.lines.length - 1, done = d.chars >= line.length;
  $('dlgMore').innerHTML = done ? `${touchMode ? 'Tap:' : kbd(Input.bind.guard[0])} ${last ? (d.after ? 'Go in' : 'Close') : 'Next'}` : '';
}
function advanceDialog() {
  const d = G.dialog; if (!d) return;
  const line = d.lines[d.i];
  if (d.chars < line.length) { d.chars = line.length; renderDialog(); return; }
  d.i++;
  if (d.i >= d.lines.length) { const after = d.after; closeDialog(); if (typeof after === 'function') after(); else if (after) openPanel(after); return; }
  d.chars = 0; renderDialog();
}
function closeDialog() { G.dialog = null; $('dialog').hidden = true; }
function updateNpcs(dt) { for (const n of V.npcs) n.talkT = Math.max(0, n.talkT - dt); }
function villageMove(p, dt) {
  p.invuln = Math.max(0, p.invuln - dt); tickDashes(p, dt);
  const mv = moveVector();
  if (p.dodgeT > 0) { p.dodgeT -= dt; moveEntity(p, p.dvx * dt, p.dvy * dt); if (Math.random() < .5) dust(p.x, p.y, 1); return; }
  if (Input.hit('dodge') && canDash(p)) { startDodge(p, mv); return; }
  p.moving = !!(mv.x || mv.y);
  if (p.moving) { p.face = Math.atan2(mv.y, mv.x); p.walkT += dt; }
  moveEntity(p, mv.x * p.st.speed * dt, mv.y * p.st.speed * dt);
}
function tickVillage(dt) {
  G.time += dt;
  if (G.save) G.save.playtime += dt;
  const p = V.player;
  if (G.cutscene) { tickCutscene(dt); tickParticles(dt); Input.endFrame(); return; }
  if (G.dialog) {
    const d = G.dialog, before = Math.floor(d.chars);
    d.chars = Math.min(d.lines[d.i].length, d.chars + 55 * dt);
    if (Math.floor(d.chars) !== before) { renderDialog(); if (Math.floor(d.chars) % 3 === 0) Sound.play('talk'); }
    if (interactPressed()) advanceDialog();
  } else {
    villageMove(p, dt);
    V.target = nearestInteract(p);
    if (V.target && interactPressed()) startInteract(V.target);
    else if (p.y > IPX.maxY + 6 && V.id === 'temple') { Sound.play('door'); fadeTo(() => enterPlace('village', 'temple')); Input.endFrame(); return; }
  }
  updateNpcs(dt);
  if (V.id === 'hall' && Math.random() < .25) V.parts.push({ x: tc(20) - 8 + rand(-18, 18), y: IPX.maxY + rand(10, 44), vx: rand(-3, 3), vy: rand(-16, -7), g: 0, life: 1.4, max: 1.4, c: Math.random() < .5 ? '#b48cff' : '#8a5ad8', s: 1 });   // Tartarus' light drifting up from the gate
  if (V.id === 'village') {
    V.smokeT -= dt;
    if (V.smokeT <= 0) { V.smokeT = .14; const b = V.buildings.find(b => b.kind === 'forge'); V.parts.push({ x: b.box.x + b.box.w - 18 + rand(-1, 1), y: b.box.y - 7 + rand(-1, 0),   // out of the forge chimney's mouth (drawn in drawBuilding)
      vx: rand(4, 10), vy: rand(-16, -10), g: 0, life: 2.2, max: 2.2, c: Math.random() < .5 ? '#8f8a82' : '#b5b0a6', s: 2 }); }
  }
  tickParticles(dt);
  followCam(p, dt);
  Input.endFrame();
}
// The floor of the temple opens: the camera goes to the slab behind the hearth, the ground shakes, the slab slides away.
function tickCutscene(dt) {
  const cs = G.cutscene, p = V.player; cs.t += dt;
  const tx = STAIRS.x + STAIRS.w / 2, ty = STAIRS.y + STAIRS.h / 2;
  G.cam.x += (clamp(tx - VIEW_W / 2, 0, WORLD_W - VIEW_W) - G.cam.x) * Math.min(1, dt * 3); G.cam.y += (clamp(ty - VIEW_H / 2, 0, WORLD_H - VIEW_H) - G.cam.y) * Math.min(1, dt * 3);
  if (cs.t > .6 && cs.t < 3.4) { G.shake = Math.max(G.shake, 1 + cs.t); if (Math.random() < .4) dust(tx + rand(-30, 30), ty + rand(-10, 16), 2); }
  if (cs.t > .6 && !cs.rumble) { cs.rumble = true; Sound.play('roar'); banner('The temple trembles', ''); }
  if (cs.t > 1.6 && !cs.crack) { cs.crack = true; Sound.play('break'); }
  cs.open = clamp((cs.t - 1.8) / 1.4, 0, 1);
  if (cs.t > 1.8 && Math.random() < .5) V.parts.push({ x: tx + rand(-20, 20), y: STAIRS.y + rand(0, STAIRS.h), vx: rand(-8, 8), vy: rand(-30, -10), g: 0, life: 1, max: 1, c: Math.random() < .5 ? '#b48cff' : '#8f8470', s: 1 });
  if (cs.t > 3.4 && !cs.done) { cs.done = true; Sound.play('blessing'); banner('A stairway opens', 'Down to the Titans, beneath the temple', true); }
  if (cs.t > 4.6) {
    G.save.stairs = true; persist(true); G.cutscene = null;
    delete PLACES.temple; const pos = { x: p.x, y: p.y, face: p.face }; enterPlace('temple', 'stairs');
    Object.assign(V.player, pos);
  }
}
function openPanel(kind, title = null) {
  closeDialog();
  G.panel = kind; G.panelTitle = title; G.mode = 'panel'; G.rebinding = null; bindNote = '';
  Sound.play('door');
  show('scrHub'); tutPanel(kind); renderHub();
}
function closePanel() { if (G.mode !== 'panel') return; Sound.play('door'); resumeVillage(); }
// Hestia's blessing: one offering, and the next time you fall in a hunt you get back up.
function highestTier() { let t = 1; for (const qd of QUESTS) if (isUnlocked(qd)) t = Math.max(t, Math.floor(qd.tier)); return t; }
function offeringCost() { return rankPrice(400); }      // fixed per rank, like the potions


