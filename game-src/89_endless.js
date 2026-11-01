/* ============================== THE ENDLESS HUNT ============================== */
// God Rank, once Typhon has fallen: the fire under Etna keeps spitting out monsters. Wave after wave, each one bigger and
// stronger than the last, with a god every fifth wave, until the whole party is down. It pays for every wave cleared
// (more the deeper you get). The save keeps the best wave reached and the last run's (save.endless).
// Hooks: startQuest (music), startWave, the spawner and the wave-cleared step (80_quest.js), bossDefeated, tierNow
// (50_combat.js, so everything spawned in a run, a god's helpers too, gets stronger), the HUD, the board and finishQuest.
const ENDLESS_Q = 'gr_endless_hunt', ENDLESS_BOSS_EVERY = 5;
// Per wave past the first: monster strength (tiers on the balance curve), extra room for monsters at once, faster attacks.
const ENDLESS_TIER = .55, ENDLESS_TEMPO = .012, ENDLESS_TEMPO_MAX = 1.3;
{
  const ty = QUEST_BY_ID[TYPHON_Q];
  // every monster that turns up in a God Rank hunt, by class
  const pool = { fodder: [], medium: [], heavy: [] }, seen = new Set();
  for (const qd of QUESTS) if (qd.rank === 2 && !qd.prologue) for (const w of qd.waves) for (const t of Object.keys(w))
    if (!seen.has(t) && ENEMIES[t] && pool[ENEMIES[t].cls] && ENEMIES[t].speed !== 0) { seen.add(t); pool[ENEMIES[t].cls].push(t); }
  // the gods it can send: every god and side god with a God Rank hunt of their own (no Titans)
  const gods = [...new Set(QUESTS.filter(qd => qd.rank === 2 && qd.boss && !qd.titan && !qd.final).map(qd => qd.boss))].filter(b => BOSSES[b] && !BOSSES[b].titan);
  // it starts a little gentler than Typhon's own waves and passes them around wave 6
  const def = { id: ENDLESS_Q, base: 'endless_hunt', god: 'typhon', endless: true, rank: 2, tier: ty.tier, mt: ty.tier - 3, boss: null, stars: 10, urgent: false,
    name: 'The Endless Hunt', arena: 'etna', requires: [TYPHON_Q], pool, gods,
    desc: 'Typhon is gone, but the fire under Etna keeps spitting out monsters. Hold out as long as you can: every wave is bigger and stronger than the last, and a god comes for you every fifth wave. Each wave you clear pays, and the deeper you go the more it pays.',
    waves: [Object.fromEntries([...seen].map(t => [t, 1]))] };          // only used to list its monsters and parts
  def.perWave = Math.round(huntPay(Math.floor(def.tier)) * .08 / 10) * 10;
  def.reward = def.perWave * 10;                                           // what the hidden cache in here is worth
  QUESTS.push(def); QUEST_BY_ID[ENDLESS_Q] = def;
}
const endlessPay = (n, boss) => Math.round(QUEST_BY_ID[ENDLESS_Q].perWave * (1 + .06 * (n - 1)) * (boss ? 4 : 1) / 10) * 10;
const endlessBossWave = n => n % ENDLESS_BOSS_EVERY === 0;
// Music grows with the run: Typhon's theme, quiet at first, full from wave 10, all-out from wave 20.
const endlessLevel = n => n >= 20 ? 2 : n >= 10 ? 1 : 0;

// Wave n (1, 2, 3...): its monsters, and the strength everything spawned from now on gets.
function endlessWave(i) {
  const D = q.def, n = i + 1, L = i, R = Math.random, pick = a => a[(R() * a.length) | 0];
  q.endMt = D.mt + L * ENDLESS_TIER;
  q.endBudget = Math.min(16, Math.floor(L / 2));
  q.endTempo = Math.min(ENDLESS_TEMPO_MAX, 1 + L * ENDLESS_TEMPO);
  const boss = endlessBossWave(n);
  // a few kinds per wave, more as it goes on; big ones from wave 3, more of them later
  const kinds = [], want = Math.min(5, 2 + Math.floor(n / 4));
  const take = cls => { const t = pick(D.pool[cls]); if (t && !kinds.includes(t)) kinds.push(t); };
  take('fodder'); take('medium'); if (n >= 3) take('heavy');
  for (let k = 0; kinds.length < want && k < 20; k++) take(R() < .5 ? 'fodder' : R() < .7 ? 'medium' : n >= 3 ? 'heavy' : 'medium');
  let weight = (12 + 3 * L) * (boss ? .5 : 1);
  const w = {};
  while (weight > 0) { const t = pick(kinds); w[t] = (w[t] || 0) + 1; weight -= WEIGHT[ENEMIES[t].cls] || 1; }
  if (boss) q.endBossNext = true;
  Music.level(endlessLevel(n));
  return w;
}
// The god for a boss wave: none twice until every one has had a turn. Scaled from their own God Rank strength up to
// this wave's, so each one takes about as many hits as their usual fight with matching gear.
function endlessBoss() {
  q.endBossNext = false;
  const D = q.def;
  if (!q.endBag || !q.endBag.length) { q.endBag = D.gods.slice(); shuffle(q.endBag); }
  const type = q.endBag.pop(), p = q.player;
  const top = { x: WORLD_W / 2, y: IPX.minY + 50 }, bottom = { x: WORLD_W / 2, y: IPX.maxY - 30 };
  const spot = Math.hypot(top.x - p.x, top.y - p.y) > Math.hypot(bottom.x - p.x, bottom.y - p.y) ? top : bottom;
  const b = makeBoss(type, spot.x, spot.y), t = q.endMt;
  const hpF = tierW(t) / tierW(b.tier), dmF = rawDmg(1, t) / rawDmg(1, b.tier);
  b.hp = b.maxHp = Math.round(b.maxHp * Math.max(1, hpF)); b.dm *= Math.max(1, dmF); b.dmgMul *= Math.max(1, dmF);
  q.boss = b; q.enemies.push(b);
  if (Music.songs[type]) Music.play(type, 1); else Music.level(Math.max(1, endlessLevel(q.waveIdx + 1)));
  const d = BOSSES[type];
  banner(d.name, `${d.title} · wave ${q.waveIdx + 1}`, true); Sound.play('roar'); addShake(4);
  $('bossName').textContent = d.name; $('bossTitle').textContent = d.title; $('bossBar').hidden = false;
  $('bossBar').classList.remove('titan'); $('bossBar').dataset.rank = D.rank;
}
// A god down mid-run: the same send-off as a normal hunt, then the run goes on (its helpers stay to be cleaned up).
function endlessBossDown(b) {
  G.slowmo = .5; G.flash = Math.max(G.flash, .25); addShake(6); Sound.play('roar'); Sound.play('thud');
  [[.35, 50], [.55, 80], [.8, 115]].forEach(([life, r]) => q.fx.push({ t: 'ring', x: b.x, y: b.y, r0: 4, r1: r, life, max: life, c: b.def.colors[0] }));
  burst(b.x, b.y - 12, 36, [...b.def.colors, '#ffffff'], 150);
  for (const pr of q.projs) if (pr.team === 'enemy') pr.dead = true;
  q.hazards = []; q.boss = null; $('bossBar').hidden = true;
  Music.play('typhon', endlessLevel(q.waveIdx + 1));
  banner(`${b.def.name} falls`, 'The fire keeps burning');
}
// A wave cleared: count it and pay for it.
function endlessCleared() {
  const n = q.waveIdx + 1, pay = endlessPay(n, endlessBossWave(n));
  q.endCleared = n; q.endPay = (q.endPay || 0) + pay;
  banner(`Wave ${n} cleared`, `+${fmtMoney(pay)} drachmae · wave ${n + 1}${endlessBossWave(n + 1) ? ' brings a god' : ' is coming'}`);
}
