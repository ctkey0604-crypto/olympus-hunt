/* ============================== THE NORTH: skills and set bonuses ============================== */
// The weapon skills forged from the North's gods, and what its armor and shields do. 50_combat.js calls in here from
// useAbility (skills, the Watchman's horn), releaseAttack (Tyr's Judgment), onPlayerHit (frost), hurtHunter0 (trick),
// startDodge (thunderDash), killEnemy (devour), perfectBlockHit (frostblock), updateHunter (ravens, the falcon's second cut)
// and playerStats (onehand). 80_quest.js slows chilled monsters with chillK.

// Chilled: a monster moves and thinks a quarter slower, a god or Titan a tenth.
function chillK(e, dt) {
  if (!(e.chillT > 0)) return 1;
  e.chillT -= dt;
  if (Math.random() < dt * 5) sc.parts.push({ x: e.x + rand(-e.r, e.r), y: e.y - rand(2, e.h || 10), vx: 0, vy: -10, g: 0, life: .5, max: .5, c: Math.random() < .5 ? '#cdeeff' : '#ffffff', s: 1 });
  return e.boss ? .9 : .75;
}
const chill = (e, t) => { if (!e.dead) e.chillT = Math.max(e.chillT || 0, t); };

// k: what useAbility already worked out (W: a weapon hit, T: the tier's hit, aim(), near(), hs/shake/flash for your own screen, mv)
const NORSE_SKILLS = {
  // Hofund: a beam of the rainbow bridge burns a long line, blinds what it hits, and carries you to the far end of it
  bifrost(p, k) {
    const a = k.aim(), x0 = p.x, y0 = p.y - 6, len = Math.max(24, raycast(p.x, p.y, a, 190, 6)), x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; p.face = a;
    q.fx.push({ t: 'rainbow', x0, y0, x1, y1, life: .45, max: .45 }); k.flash(.06); Sound.play('beam');
    for (const e of q.enemies) {
      if (!targetable(e)) continue;
      const b = bodyPt(e, x0, y0);
      if (distToSeg(b.x, b.y - 4, x0, y0, x1, y1) < e.r + 8) { damageEnemy(e, k.W * 2.2, a, 120, true); if (!e.boss && !e.dead) e.stun = Math.max(e.stun, 1.2); else chill(e, 2); }
    }
    q.fx.push({ t: 'after', frames: heroFrames(p.look), look: p.look, flip: Math.cos(a) < 0, x: p.x, y: p.y, life: .3, max: .3 });
    const to = { x: p.x + Math.cos(a) * (len - 12), y: p.y + Math.sin(a) * (len - 12) };
    if (len > 30 && !pointBlocked(to.x, to.y)) { p.x = to.x; p.y = to.y; }
    p.invuln = Math.max(p.invuln, .35);
  },
  // Falcon Talons: fly through everything ahead as a falcon; each thing you pass is cut on the way in and again on the way out
  falcon(p, k) {
    const a = (k.mv.x || k.mv.y) ? Math.atan2(k.mv.y, k.mv.x) : k.aim(); p.face = a;
    p.dvx = Math.cos(a) * 400; p.dvy = Math.sin(a) * 400; p.dashT = .3; p.dashHit = new Set(); p.swing = null; p.dashMult = 1.5;
    p.falconT = .3; p.falconHalf = false; p.invuln = Math.max(p.invuln, .4);
    burst(p.x, p.y - 6, 12, ['#ffb347', '#f3e9d4', '#c9792a'], 80); Sound.play('dodge');
  },
  // Tyr's Oathblade: the next three hits land twice as hard and stun (releaseAttack spends them)
  judgment(p) {
    p.judgeN = 3; Sound.play('perfect');
    burst(p.x, p.y - 8, 14, ['#d5dbe5', '#c0412e', '#ffffff'], 70); q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 4, r1: 22, life: .3, max: .3, c: '#c0412e' });
  },
  // Lævateinn: three likenesses of you leap out and hunt the nearest enemies
  mirror(p, k) {
    for (let i = 0; i < 3; i++) {
      const a = p.face + (i - 1) * .7;
      spawnProj(p.x + Math.cos(a) * 8, p.y, a, 170, k.T * 2, 'likeness', 'player', { r: 6, life: 4, pierce: 2, homing: 5 }); q.projs[q.projs.length - 1].look = p.look;
    }
    burst(p.x, p.y - 8, 14, ['#7fe08a', '#e9c04f'], 70); Sound.play('charm');
  },
  // Mjölnir: thrown like a trident (it's one under the hood, so it comes back and your hand is empty until it does),
  // but where it turns, lightning comes down instead of a wave
  mjolnir(p, k) {
    const a = k.aim(); p.face = a; Sound.play('swing');
    spawnProj(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8, a, 290, k.W * 1.5, 'trident', 'player', { r: 6, life: 2.4, pierce: 99, ghost: true, boom: { t: TRIDENT_OUT, src: p } });
    const pr = q.projs[q.projs.length - 1]; tridentDress(pr, p); pr.hammer = true; pr.ca = '#57c2b0';
  },
  // Gungnir: it never misses. It finds the nearest enemy, goes through, and seeks out four more
  gungnir(p, k) {
    const a = k.aim(); p.face = a;
    spawnProj(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, a, 300, k.W * 2, 'gungnir', 'player', { r: 4, life: 2.2, pierce: 4, homing: 9 });
    k.hs(.03); Sound.play('arrow');
  },
  // Jaws of Fenrir: a howl freezes everything near you, and two spirit wolves run down the nearest enemies
  howl(p, k) {
    k.shake(3); Sound.play('roar'); q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 70, life: .45, max: .45, c: '#9fd0ff' });
    for (const e of q.enemies) if (targetable(e) && edist(p, e) < 70 + e.r) { damageEnemy(e, k.W * .6, eang(p, e), 160, true); if (!e.boss && !e.dead) e.stun = Math.max(e.stun, 1.6); chill(e, 4); }
    for (const side of [-1, 1]) spawnProj(p.x + side * 8, p.y, p.face + side * .6, 185, k.T * 2.2, 'spiritwolf', 'player', { r: 6, life: 4, pierce: 2, homing: 5 });
  },
};
// Where Mjölnir turns for home: lightning on that spot, then it jumps to two more things close by.
function hammerCrash(pr) {
  const by = pr.owner || q.player, was = q.actor; q.actor = by;
  q.fx.push({ t: 'bolt', x: pr.x, y: pr.y, life: .25, max: .25, seed: (pr.x * 3) | 0, col: '#57c2b0' }); q.fx.push({ t: 'ring', x: pr.x, y: pr.y, r0: 4, r1: 44, life: .3, max: .3, c: '#57c2b0' });
  burst(pr.x, pr.y - 4, 12, ['#ffffff', '#57c2b0', '#ffd463'], 100); Sound.play('zap'); if (isLocal(by)) { addShake(4); G.flash = Math.max(G.flash, .08); }
  const hit = q.enemies.filter(e => targetable(e) && edist(pr, e) < 44 + e.r);
  for (const e of hit) damageEnemy(e, pr.dmg * .7, Math.atan2(e.y - pr.y, e.x - pr.x), 200, true);
  let from = { x: pr.x, y: pr.y - 6 };
  for (const e of q.enemies.filter(e => targetable(e) && !hit.includes(e) && edist(pr, e) < 120).sort((a, b) => edist(pr, a) - edist(pr, b)).slice(0, 2)) {
    q.fx.push({ t: 'zap', x0: from.x, y0: from.y, x1: e.x, y1: e.y - 6, life: .3, max: .3, seed: e.id }); damageEnemy(e, pr.dmg * .5, 0, 80, true); from = { x: e.x, y: e.y - 6 };
  }
  q.actor = was;
}
// The Watchman's horn: whenever you use your weapon skill, a blast hurls back and stuns everything close to you.
function hornBlast(p, W) {
  const R = 46; Sound.play('roar'); q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 4, r1: R, life: .35, max: .35, c: '#ffd463' }); q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 2, r1: R - 8, life: .35, max: .35, c: '#57c2b0' });
  for (const e of q.enemies) if (targetable(e) && edist(p, e) < R + e.r) { damageEnemy(e, W * .4, eang(p, e), 300, true); if (!e.boss && !e.dead) e.stun = Math.max(e.stun, 1); }
}
// Every step, for every hunter: the falcon's second cut, and the Allfather's two ravens.
function norseHunterTick(p, dt) {
  if (p.falconT > 0) { p.falconT -= dt; if (p.falconT < .15 && !p.falconHalf) { p.falconHalf = true; p.dashHit = new Set(); } }
  if (!p.st.perks.ravens || p.dead || q.pv || q.phase === 'victory' || q.def.practice) return;
  p.ravenT = (p.ravenT || 0) + dt;
  if (p.ravenT < 2) return;
  let best = null, bd = 150;
  for (const e of q.enemies) { if (!targetable(e)) continue; const d = edist(p, e); if (d < bd) { bd = d; best = e; } }
  if (!best) { p.ravenT = 2; return; }                       // they go the moment something comes close
  p.ravenT = 0;
  for (const side of [-1, 1]) { const a = eang(p, best) + side * .9; spawnProj(p.x + side * 8, p.y - 12, a, 200, p.st.weapon.dmg * .45, 'raven', 'player', { r: 4, life: 1.6, homing: 8, owner: p }); }
  Sound.play('swing');
}
// The Trickster's set: some hits go through the spot you just left (not in fights between players).
function trickMiss(p) {
  if (!p.st.perks.trick || q.pv || Math.random() >= p.st.perks.trick) return false;
  p.invuln = .25; addText(p.x, p.y - 20, 'MISS', '#7fe08a'); Sound.play('dodge');
  q.fx.push({ t: 'after', frames: heroFrames(p.look), look: p.look, flip: Math.cos(p.face) < 0, x: p.x, y: p.y, life: .3, max: .3 });
  return true;
}
// The Thunderer's set: lightning strikes the spot you dash away from.
function thunderDash(p) {
  if (!q || q.pv || !p.st.perks.thunderDash || q.phase === 'victory') return;
  q.pspikes.push({ x: p.x, y: p.y, t: -.3, dmg: p.st.weapon.dmg * 1.2 * dmgMul(p) / p.st.mul, hit: false, sky: true, r: 22, owner: p });
}
// The Rime Shield: a perfect block freezes everything close to you.
function frostBlock(p) {
  q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 60, life: .35, max: .35, c: '#9fd0ff' }); burst(p.x, p.y - 6, 12, ['#cdeeff', '#ffffff'], 80);
  for (const e of q.enemies) if (targetable(e) && edist(p, e) < 60 + e.r) { if (!e.boss) e.stun = Math.max(e.stun, 1.2); chill(e, 3); }
}
