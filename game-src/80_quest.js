/* ============================== QUEST FLOW =============================== */
function isUnlocked(qd, save = G.save) {
  if ((save.rank || 0) < qd.rank) return false;
  if (qd.titan && !save.stairs) return false;                  // the Titans wait until the stairway under the temple opens
  return qd.requires.every(r => save.cleared[r]);
}
function questMonsters(qd) { const set = new Set(); qd.waves.forEach(w => Object.keys(w).forEach(t => set.add(t))); return [...set]; }
function questParts(qd) {
  const set = new Set();
  questMonsters(qd).forEach(t => ENEMIES[t].loot.forEach(l => set.add(l[0])));
  if (qd.boss) BOSSES[qd.boss].loot.forEach(l => set.add(l[0]));
  return [...set].map(id => rid(id, qd.rank));
}
// How much of the arena can be full at once. Heavies take more room, so big waves arrive in a steady stream.
const WEIGHT = { fodder: 1, medium: 2, heavy: 4 };
const BUDGET = 12;

function startQuest(id) {
  const def = typeof id === 'object' ? id : QUEST_BY_ID[id]; if (!def || (!def.prologue && !isUnlocked(def))) return;
  G.rebinding = null;
  if (def.prologue) Music.play('road'); else if (def.titan) Music.play(def.boss, 0); else Music.play(Music.huntTrack(def.god));
  const A = ARENAS[def.arena], T = THEMES[A.theme];
  setWorldSize(A.wt || 40, A.ht || 26);
  const obstacles = A.obstacles.map(([k, tx, ty, v]) => mkObstacle(k, tx, ty, v));
  const layers = genLayers(A.theme, A.secret, { seed: def.arena });
  if (A.paint) A.paint(layers.ground.getContext('2d'), mulberry(hashStr(def.arena + ':paint')));
  const s = A.secret;
  q = { def, arena: A, theme: A.theme, ground: layers.ground, cover: layers.cover, coverRect: layers.rect, obstacles,
        world: makeWorld(obstacles.map(o => o.box), s ? [s] : []), weather: T.weather || null, night: !!T.night, fog: [],
        player: null, enemies: [], projs: [], pickups: [], parts: [], texts: [], fx: [], hazards: [], pspikes: [],
        chest: s ? { x: tc(s.chest[0]), y: tc(s.chest[1]) + 4, open: false } : null, chestMoney: 0, chestFound: false,
        waveIdx: -1, pending: [], spawnT: 0, phase: 'intro', timer: 1.6, elapsed: 0, loot: {}, boss: null, endT: 0, nextIsBoss: false, flashT: rand(4, 8),
        tokUse: { melee: 0, ranged: 0 }, blessed: !!G.save.blessing, usedBlessing: false, seenBones: false,
        stats: { kills: 0, dealt: 0, taken: 0, perfect: 0 }, timeStop: 0, ghosts: [], mem: null, current: null, onPlayerAct: null };
  sc = q;
  q.player = makePlayer();
  if (T.weather === 'fog') for (let i = 0; i < 9; i++) q.fog.push({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), r: rand(30, 60), v: rand(4, 10) });
  G.cam.x = clamp(q.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W); G.cam.y = clamp(q.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  G.mode = 'quest'; G.paused = false; G.slowmo = 1; G.hitstop = 0; G.shake = 0; G.flash = 0; G.dialog = null;
  hideScreens(); $('stage').hidden = false; $('pause').hidden = true; resize();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  Input.down.clear(); Input.endFrame();
  hudMode('quest'); hudReset();
  banner(def.name, (def.rank ? RANKS[def.rank].name + ' · ' : '') + A.name + (q.blessed ? ' · Hestia watches over you' : ''));
  tutStart();
  if (!tutOn() && !Object.keys(G.save.cleared).length) showHint(touchMode ? 'Attack, dodge and use your skill with the buttons on the right' : `${kbd(Input.bind.attack[0])} attack · ${kbd(Input.bind.dodge[0])} dash · hold to keep swinging`, 7);
  CG.gameplay(true);
}
function startWave(i) {
  q.waveIdx = i; const w = q.def.waves[i], light = [], heavy = [];
  for (const [t, n] of Object.entries(w)) for (let k = 0; k < n; k++) (ENEMIES[t].cls === 'heavy' ? heavy : light).push(t);
  shuffle(light);
  // a heavy shows up a little way into the wave, once the first rush is moving
  const list = light.slice(); heavy.forEach(t => list.splice(Math.min(list.length, 3 + Math.floor(Math.random() * 3)), 0, t));
  q.pending = list.map(type => ({ type })); q.spawnT = .2;
  q.phase = 'fight';
  if (q.def.prologue) proWaveBanner(i); else banner(`Wave ${i + 1}`, Object.entries(w).map(([t, n]) => monsterCount(t, n)).join(' · ')); Sound.play('wave');
}
function pickSpawnPoint() {
  const p = q.player;
  const all = spawnTiles().map(([tx, ty]) => ({ x: tc(tx), y: tc(ty) }));
  const pts = all.filter(s => Math.hypot(s.x - p.x, s.y - p.y) > 110 && !pointBlocked(s.x, s.y));
  const list = pts.length ? pts : all;
  return list[(Math.random() * list.length) | 0];
}
function aliveWeight() { let n = 0; for (const e of q.enemies) if (!e.dead && !e.boss) n += WEIGHT[e.def.cls] || 1; return n; }
const budget = () => BUDGET + 2 * (q.def.rank || 0);
function startBoss() {
  q.phase = 'boss';
  if (q.def.titan) Music.level(1); else if (Music.songs[q.def.god]) Music.play(q.def.god, 1);
  const titan = BOSSES[q.def.boss].titan, p = q.player, top = { x: WORLD_W / 2, y: IPX.minY + (titan ? 110 : 50) }, bottom = { x: WORLD_W / 2, y: IPX.maxY - 30 };
  const spot = Math.hypot(top.x - p.x, top.y - p.y) > Math.hypot(bottom.x - p.x, bottom.y - p.y) ? top : bottom;
  q.boss = makeBoss(q.def.boss, spot.x, spot.y);
  q.enemies.push(q.boss);
  const d = BOSSES[q.def.boss];
  if (d.titan) { q.onPlayerAct = k => { if (q.boss && !q.boss.dead) titanAct(q.boss, k); }; q.mem = []; q.memAtk = []; q.ghosts = []; }
  banner(d.name, d.title, true); Sound.play('roar'); addShake(d.titan ? 7 : 4);
  $('bossName').textContent = d.name; $('bossTitle').textContent = d.title; $('bossBar').hidden = false;
  $('bossBar').classList.toggle('titan', !!d.titan); $('bossBar').dataset.rank = q.def.rank;
  for (let i = 0; i < (d.arrivalHeals || 0); i++) spawnPickup(p.x + rand(-24, 24), p.y + rand(-14, 14), '@heal');
}
function bossDefeated() {
  G.slowmo = .25; q.hazards = [];
  for (const e of q.enemies) if (!e.dead && !e.boss) killEnemy(e, { final: true });
  for (const pr of q.projs) if (pr.team === 'enemy') pr.dead = true;
  questVictory();
}
function questVictory() {
  if (q.phase === 'victory' || q.phase === 'defeat') return;
  q.phase = 'victory'; q.endT = 2.8; Sound.play('win'); Music.sting('win'); q.timeStop = 0;
  if (q.def.boss && !G.save.cleared[q.def.id]) CG.happy();
  q.hazards = []; q.player.fx.charm = q.player.fx.confuse = q.player.fx.sleep = 0;
  banner('Quest complete', `Reward: ${fmtMoney(q.def.reward)} drachmae`);
}
function playerDie() {
  if (q.phase === 'victory') return;
  const p = q.player; p.dead = true; q.phase = 'defeat'; Music.sting('lose'); q.endT = 2.6; G.slowmo = .35;
  Sound.play('lose'); burst(p.x, p.y - 6, 20, ['#c0412e', '#e9c04f', '#f3e9d4'], 100);
  banner('You fell', 'Quest failed');
}
// Hidden chest rewards are tied to the quest's pay and its parts: a big first find, a small restock after that.
function chestReward(qd, first) {
  const parts = questParts(qd).filter(id => ITEMS[id].rarity <= 3);
  if (!parts.length) return { money: Math.round(qd.reward * (first ? .4 : .12) / 10) * 10, items: [] };
  const weight = id => ({ 1: 3, 2: 2, 3: 1 })[ITEMS[id].rarity];
  const pickW = list => { const tot = list.reduce((a, id) => a + weight(id), 0); let r = Math.random() * tot; for (const id of list) { r -= weight(id); if (r <= 0) return id; } return list[0]; };
  if (first) {
    const items = [pickW(parts), pickW(parts), pickW(parts)];
    const rares = parts.filter(id => ITEMS[id].rarity === 3);
    if (rares.length && Math.random() < .6) items.push(rares[(Math.random() * rares.length) | 0]);
    return { money: Math.round(qd.reward * .4 / 10) * 10, items };
  }
  const commons = parts.filter(id => ITEMS[id].rarity <= 2);
  return { money: Math.round(qd.reward * .12 / 5) * 5, items: [pickW(commons.length ? commons : parts)] };
}
function openChest() {
  const c = q.chest; if (!c || c.open) return;
  c.open = true; q.chestFound = true;
  const first = !G.save.chests[q.def.id], rw = chestReward(q.def, first);
  q.chestMoney += rw.money;
  rw.items.forEach(id => spawnPickup(c.x, c.y - 4, id)); spawnPickup(c.x, c.y - 4, '@heal');
  addText(c.x, c.y - 18, '+' + rw.money, '#ebc152');
  burst(c.x, c.y - 6, 18, ['#ebc152', '#fff6d8', '#cf6a2f'], 80); Sound.play('chest');
  banner(first ? 'Hidden cache!' : 'Cache restocked', `+${rw.money} drachmae${first ? ' and a stash of parts' : ''}`);
}
function inCover(x, y) { const r = q.coverRect; return r && x > r.x - 4 && x < r.x + r.w + 4 && y > r.y - 4 && y < r.y + r.h + 6; }
function updateQuestFlow(dt) {
  if (q.def.prologue) proFlow();
  if (q.phase === 'intro') { q.timer -= dt; if (q.timer <= 0) startWave(0); }
  if (q.pending.length && (q.phase === 'fight')) {
    q.spawnT -= dt;
    if (q.spawnT <= 0) {
      const next = q.pending[0], w = WEIGHT[ENEMIES[next.type].cls] || 1, alive = aliveWeight();
      if (alive === 0 || alive + w <= budget()) {
        q.pending.shift();
        const pt = pickSpawnPoint();
        q.enemies.push(makeEnemy(next.type, clamp(pt.x + rand(-10, 10), IPX.minX + 8, IPX.maxX - 8), clamp(pt.y + rand(-8, 8), IPX.minY + 8, IPX.maxY - 8)));
        q.spawnT = .38;
      } else q.spawnT = .25;
    }
  }
  if (q.phase === 'fight' && !q.pending.length && q.enemies.every(e => e.dead)) {
    const p = q.player;
    if (q.waveIdx < q.def.waves.length - 1) { q.phase = 'between'; q.timer = 1.8; q.nextIsBoss = false; banner('Wave cleared', 'Next wave incoming'); spawnPickup(p.x + rand(-20, 20), p.y + rand(-14, 14), '@heal'); }
    else if (q.def.boss) { q.phase = 'between'; q.timer = 2.4; q.nextIsBoss = true; banner('The air goes still', 'Something is coming'); }
    else if (q.def.prologue) proWalkout();
    else questVictory();
  }
  if (q.phase === 'between') { q.timer -= dt; if (q.timer <= 0) { if (q.nextIsBoss) startBoss(); else startWave(q.waveIdx + 1); } }
  if (q.phase === 'victory' || q.phase === 'defeat') { q.endT -= dt; if (q.endT <= 0) { finishQuest(q.phase === 'victory'); return; } }
  if (q.chest && !q.chest.open && !q.player.dead && dist(q.player, q.chest) < 13) openChest();
}
function tickParticles(dt) {
  for (const pt of sc.parts) { pt.life -= dt; pt.vy += (pt.g || 0) * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= .96; }
  sc.parts = sc.parts.filter(pt => pt.life > 0);
  if (sc.parts.length > 500) sc.parts.splice(0, sc.parts.length - 500);
  for (const t of sc.texts) { t.life -= dt; t.y -= 18 * dt; }
  sc.texts = sc.texts.filter(t => t.life > 0);
  for (const f of sc.fx) f.life -= dt;
  sc.fx = sc.fx.filter(f => f.life > 0);
}
function followCam(p, dt) {
  // In a Titan fight the camera leans toward the Titan so you can see all of it, while keeping you well inside the view.
  let fx = p.x + Math.cos(p.face) * 10, fy = p.y - 8 + Math.sin(p.face) * 6;
  const b = q && q.boss;
  if (b && b.def.titan && !b.dead && !b.hidden) {
    fx = clamp(lerp(fx, b.x, .32), p.x - VIEW_W / 2 + 60, p.x + VIEW_W / 2 - 60);
    fy = clamp(lerp(fy, b.y - b.h * .45, .32), p.y - VIEW_H / 2 + 46, p.y + VIEW_H / 2 - 30);
  }
  const tx = clamp(fx - VIEW_W / 2, 0, WORLD_W - VIEW_W), ty = clamp(fy - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 7); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 7);
}
function tick(dt) {
  G.time += dt;
  if (G.save) G.save.playtime += dt;
  G.flash = Math.max(0, G.flash - dt);
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  G.slowmo = Math.min(1, G.slowmo + dt * (q.phase !== 'victory' && q.phase !== 'defeat' ? 1.5 : .35));
  const sdt = dt * G.slowmo;
  q.elapsed += q.phase === 'victory' || q.phase === 'defeat' ? 0 : sdt;
  updatePlayer(sdt); tutHunt(sdt);
  if (q.boss && q.boss.def.titan && !q.boss.dead) titanTick(q.boss, sdt);
  const frozen = q.timeStop > 0; if (frozen) q.timeStop -= sdt;    // Stop Time: monsters freeze, gods and Titans slow down
  q.tokUse.melee = q.tokUse.ranged = 0;
  for (const e of q.enemies) { if (e.tok && TOK_STATES.has(e.state) && !e.dead) q.tokUse[e.tok]++; else e.tok = null; }
  for (const e of q.enemies) if (!e.dead) { if (e.boss) updateBoss(e, sdt); else if (!frozen) updateEnemy(e, sdt); else e.flash = 0; }
  q.enemies = q.enemies.filter(e => !e.dead);
  updateProjs(sdt); if (!frozen) updateHazards(sdt); updatePSpikes(sdt); updatePickups(sdt);
  if (q.weather === 'embers' && Math.random() < .5) q.parts.push({ x: G.cam.x + rand(0, VIEW_W), y: G.cam.y + VIEW_H + 4, vx: rand(-8, 8), vy: rand(-40, -20), g: 0, life: 3, max: 3, c: Math.random() < .5 ? '#ff7a2b' : '#ffd463', s: 1 });
  if (q.weather === 'petals' && Math.random() < .35) q.parts.push({ x: G.cam.x + rand(0, VIEW_W + 40), y: G.cam.y - 4, vx: rand(-24, -8), vy: rand(14, 26), g: 0, life: 6, max: 6, c: Math.random() < .5 ? '#f2a7c0' : '#ffffff', s: 1 });
  if (q.weather === 'storm') { q.flashT -= dt; if (q.flashT <= 0) { q.flashT = rand(5, 10); G.flash = .12; } }
  for (const f of q.fog) { f.x += f.v * dt; if (f.x - f.r > WORLD_W) f.x = -f.r; }
  tickParticles(sdt);
  updateQuestFlow(sdt);
  if (!q) { Input.endFrame(); return; }      // the quest just ended
  followCam(q.player, dt);
  G.shake = Math.max(0, G.shake - dt * 18);
  Input.endFrame();
}


