/* ============================== BOSSES =================================== */
// The three hand-made fights were tuned for an earlier point in the game; dm scales their hits to the tier they sit at now.
const BOSS_REF = { hermes: 1, athena: 2.5, zeus: 5.5 };
// Low Rank Titans hit a little softer than their tier says: their fights are long and their attacks cover a lot of ground.
// In High and God Rank they hit at full strength, like the gods there.
const TITAN_DMG = [.88, 1, 1];
// dmgScale sets how hard each god and Titan hits so the climb is steady: every god a little harder than the last,
// Zeus the hardest god, Cronus the hardest Titan (checked with the balance sim at every rank).
// High Rank: one new move per god (God Rank: two), the harder phase-2 version of every move from the start,
// and faster thinking. God Rank gods also go berserk below 30% health.
const RANK_MOVES = {
  artemis:    [{ id: 'dash', w: 2, p1: { count: 2, speed: 340, dmg: .14 } }, { id: 'ring', w: 1, p1: { n: 12, speed: 95, dmg: .09, kind: 'arrowE' } }],
  dionysus:   [{ id: 'wave', w: 2, p1: { dmg: .14, speed: 150, max: 140, col: '#9a6bc0' }, p2: { count: 2 } }, { id: 'ring', w: 1, p1: { n: 10, speed: 90, dmg: .08, kind: 'grape' } }],
  aphrodite:  [{ id: 'rain', w: 2, p1: { n: 6, r: 14, delay: .9, dmg: .14, kind: 'curse' }, p2: { n: 9 } }, { id: 'dash', w: 1, p1: { count: 2, speed: 330, dmg: .15 } }],
  apollo:     [{ id: 'ring', w: 2, p1: { n: 14, speed: 100, dmg: .1, kind: 'sunbolt' } }, { id: 'dash', w: 1, p1: { count: 2, speed: 350, dmg: .16 } }],
  ares:       [{ id: 'rain', w: 2, p1: { n: 7, r: 13, delay: .85, dmg: .16, kind: 'spear' }, p2: { n: 10 } }, { id: 'ring', w: 1, p1: { n: 12, speed: 110, dmg: .11, kind: 'blade' } }],
  poseidon:   [{ id: 'dash', w: 2, p1: { count: 2, speed: 330, dmg: .17 } }, { id: 'quake', w: 1, p1: { dmg: .17 } }],
  hera:       [{ id: 'wave', w: 2, p1: { dmg: .15, speed: 160, max: 150, col: '#3f9a8a' }, p2: { count: 2 } }, { id: 'ring', w: 1, p1: { n: 14, speed: 95, dmg: .1, kind: 'plume' } }],
  hephaestus: [{ id: 'rain', w: 2, p1: { n: 7, r: 15, delay: .9, dmg: .18, kind: 'sunfire' }, p2: { n: 10 } }, { id: 'dash', w: 1, p1: { count: 2, speed: 300, dmg: .19 } }],
  hades:      [{ id: 'dash', w: 2, p1: { count: 3, speed: 360, dmg: .17 } }, { id: 'wave', w: 1, p1: { dmg: .16, speed: 150, max: 150, col: '#7fe08a' } }],
  pan:        [{ id: 'dash', w: 2, p1: { count: 2, speed: 340, dmg: .14 } }, { id: 'rain', w: 1, p1: { n: 6, r: 14, delay: .9, dmg: .13, kind: 'note' } }],
  hecate:     [{ id: 'wave', w: 2, p1: { dmg: .14, speed: 150, max: 150, col: '#57c2b0' } }, { id: 'vanish', w: 1, p1: { time: 1.8, dmg: .16 } }],
  nemesis:    [{ id: 'rain', w: 2, p1: { n: 6, r: 14, delay: .9, dmg: .15, kind: 'spear' } }, { id: 'ring', w: 1, p1: { n: 12, speed: 110, dmg: .1, kind: 'blade' } }],
  eris:       [{ id: 'dash', w: 2, p1: { count: 2, speed: 340, dmg: .15 } }, { id: 'wave', w: 1, p1: { dmg: .14, speed: 160, max: 140, col: '#e9c04f' } }],
  hypnos:     [{ id: 'vanish', w: 2, p1: { time: 2, dmg: .15 } }, { id: 'wave', w: 1, p1: { dmg: .13, speed: 120, max: 150, col: '#c8b8ff' } }],
};
function makeBoss(type, x, y, rank = q ? q.def.rank : 0) {
  const d = BOSSES[type], fr = SPR[d.sprite][0], R = RANKS[rank] || RANKS[0], tier = d.tier + R.off;
  const tune = k => (d.tune && d.tune[k] && d.tune[k][rank]) || 1;          // per-boss, per-rank balance from the bot runs (BOSS_TUNE)
  const hp = Math.round(d.hits * tierW(tier) * R.hp * tune('hp') * partyScale().bossHp);
  return { id: EID++, boss: true, type, def: d, tier, rank, tempo: R.tempo, attacks: d.attacks ? d.attacks.concat((RANK_MOVES[type] || []).slice(0, rank)) : null,
           dm: rawDmg(1, tier) / rawDmg(1, BOSS_REF[type] || d.tier) * R.dmg * (d.dmgScale || 1) * tune('dmg'), dmgMul: R.dmg * (d.titan ? TITAN_DMG[rank] || 1 : 1) * (d.dmgScale || 1) * tune('dmg'),
           x, y, r: d.titan ? 15 : d.r, h: d.titan ? fr.h * TITAN_SCALE : fr.h + 4, body: d.titan ? Math.round(fr.h * TITAN_SCALE * .74) : 0, hp, maxHp: hp, vx: 0, vy: 0, kbx: 0, kby: 0,
           state: 'intro', st: 1.6, phase: 1, flash: 0, stun: 0, flip: true, walkT: 0, invuln: 1.6, alpha: 0, orbit: 1, last: null, lastCount: 0,
           dashEnd: null, count: 0, lockAt: .2, summons: 0, kbRes: .06, dead: false, contactCd: 0, face: Math.PI / 2, guard: false, stormT: 3, aim: 0,
           reflectT: 0, hidden: false, air: false, z: 0, markT: 0, burnT: 0, burnAcc: 0 };
}
// The first gods are still teaching you: in Low Rank they call one fewer helper than they do in High and God Rank.
function summonFor(b, types) { return b.rank === 0 && b.def.tier <= 3 && types.length > 2 ? types.slice(0, -1) : types; }
function bossCommon(b, dt) {
  b.invuln = Math.max(0, b.invuln - dt); b.contactCd = Math.max(0, b.contactCd - dt); b.markT = Math.max(0, b.markT - dt);
  if (b.burnT > 0) { const by = b.burnBy || q.player; b.burnT -= dt; b.burnAcc += dt * by.st.weapon.dmg * .35; if (b.burnAcc >= 4) { const n = Math.floor(b.burnAcc); b.burnAcc -= n; b.hp -= n; by.stats.dealt += n; b.lastBy = by; addThreat(b, by, n); addText(b.x, b.y - b.h - 2, String(n), '#ff8a2b'); if (b.hp <= 0) { killEnemy(b); return true; } } }
  if (b.state === 'intro') {
    b.st -= dt; b.alpha = Math.min(1, 1 - b.st / 1.6 + .2);
    if (Math.random() < .5) sc.parts.push({ x: b.x + rand(-12, 12), y: b.y - rand(0, 30), vx: rand(-10, 10), vy: rand(10, 30), g: 0, life: .7, max: .7, c: '#f3e9d4', s: 1 });
    if (b.st <= 0) { b.state = 'idle'; b.st = .8; b.alpha = 1; }
    return true;
  }
  return false;
}
function bossEnrage(b, title, sub) {
  if (b.phase === 1 && b.hp <= b.maxHp * .5) {
    b.phase = 2; Music.level(2); b.state = 'enrage'; b.st = 1.3; b.invuln = 1.3; b.vx = b.vy = 0; b.guard = false; b.reflectT = 0; b.hidden = false; b.air = false; b.alpha = 1; b.beam = null;
    banner(title, sub, true); Sound.play('roar'); addShake(5);
    return true;
  }
  return false;
}
function bossContact(b, dmg) {
  if (b.hidden || b.air || b.state === 'intro') return;
  for (const p of q.hunters)
    if (b.state !== 'dash' && b.state !== 'lunge' && b.contactCd <= 0 && !p.dead && dist(b, p) < b.r + p.r) { if (hurtHunter(p, dmg, Math.atan2(p.y - b.y, p.x - b.x), 160, { src: b, melee: true })) b.contactCd = .6; }
}
function pickAttack(b, opts) {
  let pick = opts[(Math.random() * opts.length) | 0];
  if (pick === b.last && b.lastCount >= 1) pick = opts.find(o => o !== b.last) || pick;
  b.lastCount = pick === b.last ? b.lastCount + 1 : 0; b.last = pick;
  return pick;
}
function summonAround(b, types, text, o = {}) {
  types = partyHelpers(types);                                // a party gets a few more of the small ones
  types.forEach((t, i) => {
    const a = i / types.length * Math.PI * 2;
    const e = makeEnemy(t, clamp(b.x + Math.cos(a) * 26, IPX.minX + 8, IPX.maxX - 8), clamp(b.y + Math.sin(a) * 26, IPX.minY + 8, IPX.maxY - 8));
    e.st = .9; if (o.wild) e.spdMul *= 1.3; q.enemies.push(e);
  });
  banner(text, 'Deal with them, or keep your eyes on the god');
}
function dashTowardEnd(b, sp, dmg) {
  const dx = b.dashEnd.x - b.x, dy = b.dashEnd.y - b.y, d = Math.hypot(dx, dy);
  if (!b.hitDone) { let hit = false; for (const p of q.hunters) if (dist(b, p) < b.r + p.r + 3) { if (hurtHunter(p, dmg, b.aim, 220, { src: b, melee: true })) hit = true; } if (hit) b.hitDone = true; }
  // a wall or a crowd can stop a dash short, and a slow frame can carry it past the end: either way the dash is over
  const moved = b.dashPrev ? Math.hypot(b.x - b.dashPrev.x, b.y - b.dashPrev.y) : 1;
  b.dashStall = moved < .25 ? (b.dashStall || 0) + 1 : 0; b.dashPrev = { x: b.x, y: b.y };
  const passed = b.vx * dx + b.vy * dy < 0, stuck = b.dashStall > 6;
  if (d < sp * (1 / 60) + 1 || passed || stuck) {
    if (!stuck && !pointBlocked(b.dashEnd.x, b.dashEnd.y)) { b.x = b.dashEnd.x; b.y = b.dashEnd.y; }
    b.vx = b.vy = 0; b.dashPrev = null; b.dashStall = 0; return true;
  }
  b.vx = dx / d * sp; b.vy = dy / d * sp; return false;
}
function farSpot(p) {
  let best = null, bd = -1;
  for (const [tx, ty] of SPAWN_TILES) { const x = tc(tx), y = tc(ty), d = Math.hypot(x - p.x, y - p.y) + rand(0, 60); if (d > bd && !pointBlocked(x, y)) { bd = d; best = { x, y }; } }
  return best;
}
const BOSS_AI = {
  hermes(b, dt, c) {
    const p = b.tgt, P2 = b.phase === 2, D = n => n * b.dm;
    if (bossCommon(b, dt)) return;
    if (bossEnrage(b, 'Hermes speeds up', 'Double dashes and feather rings')) return;
    const thresholds = [.72, .3];
    if (b.summons < thresholds.length && b.hp <= b.maxHp * thresholds[b.summons] && b.state === 'idle') { b.summons++; b.state = 'blinkOut'; b.st = .4; b.invuln = 1.2; Sound.play('dodge'); return; }
    switch (b.state) {
      case 'enrage': b.st -= dt; if (Math.random() < .7) burst(b.x, b.y - 12, 1, ['#f3e9d4', '#ebc152'], 90); if (b.st <= 0) { b.state = 'idle'; b.st = .4; } break;
      case 'idle': {
        const want = 95, sp = P2 ? 76 : 72;              // never faster than you (you move at 80)
        const mx = c.ux * (c.d - want) / 40 - c.uy * b.orbit * .9, my = c.uy * (c.d - want) / 40 + c.ux * b.orbit * .9, m = Math.hypot(mx, my) || 1;
        b.vx = mx / m * sp; b.vy = my / m * sp; b.flip = c.dx < 0;
        if (Math.random() < dt * .4) b.orbit *= -1;
        b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, c.d > 170 ? ['dash', 'dash', 'fan'] : P2 || b.rank >= 1 ? ['dash', 'fan', 'ring', 'dash'] : ['dash', 'fan', 'dash']);
          // aim stops following you 0.3-0.35s before he goes, so you can react instead of guessing
          if (pick === 'dash') { b.state = 'dashAim'; b.st = P2 ? .65 : .75; b.lockAt = P2 ? .35 : .3; b.count = (P2 ? 2 : 1) + (b.rank >= 1 ? 1 : 0); Sound.play('telegraph'); }
          else if (pick === 'fan') { b.state = 'fanWind'; b.st = .55; b.count = 1; }
          else { b.state = 'ringWind'; b.st = .6; b.count = 1; }
        }
        break;
      }
      case 'dashAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st > b.lockAt) { const a = Math.atan2(c.dy, c.dx); b.aim = a; b.flip = c.dx < 0; const len = raycast(b.x, b.y, a, 280, b.r + 2); b.dashEnd = { x: b.x + Math.cos(a) * len, y: b.y + Math.sin(a) * len }; }
        if (b.st <= 0) { b.state = 'dash'; b.hitDone = false; Sound.play('dodge'); }
        break;
      case 'dash':
        q.fx.push({ t: 'after', spr: 'hermes', flip: b.flip, x: b.x, y: b.y - 4, life: .25, max: .25, gold: true });
        if (dashTowardEnd(b, P2 ? 400 : 380, D(16))) {
          b.count--; dust(b.x, b.y, 6);
          if (b.count > 0) { b.state = 'dashAim'; b.st = .65; b.lockAt = .35; } else { b.state = 'winded'; b.st = .8; }
        }
        break;
      case 'winded':                                     // stands still and catches his breath: your time to hit him
        b.vx = b.vy = 0; b.st -= dt;
        if (Math.random() < .25) sc.parts.push({ x: b.x + rand(-4, 4), y: b.y - 18, vx: rand(-6, 6), vy: -12, g: 0, life: .5, max: .5, c: '#f3e9d4', s: 1 });
        if (b.st <= 0) { b.state = 'idle'; b.st = P2 ? .95 : 1.1; }
        break;
      case 'fanWind':
        b.vx = b.vy = 0; b.st -= dt; b.flip = c.dx < 0;
        if (b.st <= 0) {
          const n = P2 ? 6 : 5, spread = P2 ? 1 : .9, base = Math.atan2(c.dy, c.dx);
          for (let i = 0; i < n; i++) spawnProj(b.x, b.y, base + (i / (n - 1) - .5) * spread, 95, D(9), 'snake', 'enemy', { r: 3, life: 3.2 });
          Sound.play('shoot'); b.count--;
          if (b.count > 0) b.st = .4; else { b.state = 'idle'; b.st = P2 ? .95 : 1.2; }
        }
        break;
      case 'ringWind':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const n = 12, off = rand(0, .5);
          for (let i = 0; i < n; i++) spawnProj(b.x, b.y, i / n * Math.PI * 2 + off, 80, D(7), 'feather', 'enemy', { r: 2.5, life: 3.5 });
          Sound.play('ability'); b.count--;
          if (b.count > 0) b.st = .45; else { b.state = 'idle'; b.st = .95; }
        }
        break;
      case 'blinkOut':
        b.vx = b.vy = 0; b.st -= dt; b.alpha = Math.max(0, b.st / .4);
        if (b.st <= 0) {
          const best = farSpot(p); b.x = best.x; b.y = best.y; b.state = 'blinkIn'; b.st = .4;
          burst(b.x, b.y - 10, 16, ['#f3e9d4', '#ebc152'], 80);
          summonAround(b, P2 ? ['bandit', 'bandit', 'slinger'] : ['bandit', 'bandit', 'bandit'], 'Hermes calls for help');
        }
        break;
      case 'blinkIn': b.st -= dt; b.alpha = 1 - Math.max(0, b.st / .4); if (b.st <= 0) { b.alpha = 1; b.invuln = 0; b.state = 'idle'; b.st = .9; } break;
    }
    bossContact(b, D(9));
  },
  // Athena: shield up while she watches you. Lunges with her spear, sends out aegis shockwaves, calls down spears.
  athena(b, dt, c) {
    const p = b.tgt, P2 = b.phase === 2, D = n => n * b.dm;
    if (bossCommon(b, dt)) return;
    if (bossEnrage(b, 'Athena takes the field', 'Faster turns and a rain of spears')) return;
    const want = Math.atan2(c.dy, c.dx), turn = (P2 ? 3.4 : 2.5) * dt;
    if (b.state === 'idle' || b.state === 'lungeAim' && b.st > b.lockAt) b.face += clamp(angDiff(b.face, want), -turn, turn);
    b.flip = Math.cos(b.face) < 0;
    b.guard = b.state === 'idle';
    const thresholds = [.7, .35];
    if (b.summons < thresholds.length && b.hp <= b.maxHp * thresholds[b.summons] && b.state === 'idle') { b.summons++; b.state = 'summon'; b.st = .8; return; }
    switch (b.state) {
      case 'enrage': b.st -= dt; if (Math.random() < .7) burst(b.x, b.y - 12, 1, ['#a7adb3', '#4f8fc7'], 90); if (b.st <= 0) { b.state = 'idle'; b.st = .4; } break;
      case 'idle': {
        const sp = P2 ? 62 : 50, wantD = 70;
        const mx = Math.cos(b.face) * (c.d - wantD) / 30 - c.uy * b.orbit * .5, my = Math.sin(b.face) * (c.d - wantD) / 30 + c.ux * b.orbit * .5, m = Math.hypot(mx, my) || 1;
        b.vx = mx / m * sp; b.vy = my / m * sp;
        if (Math.random() < dt * .3) b.orbit *= -1;
        b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, P2 ? ['lunge', 'aegis', 'spears', 'lunge'] : ['lunge', 'aegis', 'spears']);
          if (pick === 'lunge') { b.state = 'lungeAim'; b.st = P2 ? .6 : .7; b.lockAt = .3; b.count = (P2 ? 2 : 1) + (b.rank >= 1 ? 1 : 0); Sound.play('telegraph'); }
          else if (pick === 'aegis') { b.state = 'aegisWind'; b.st = .8; b.count = P2 ? 2 : 1; Sound.play('telegraph'); }
          else { b.state = 'spearsWind'; b.st = .5; }
        }
        break;
      }
      case 'lungeAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st > b.lockAt) { b.aim = b.face; const len = raycast(b.x, b.y, b.aim, 130, b.r + 2); b.dashEnd = { x: b.x + Math.cos(b.aim) * len, y: b.y + Math.sin(b.aim) * len }; }
        if (b.st <= 0) { b.state = 'lunge'; b.hitDone = false; Sound.play('swing'); }
        break;
      case 'lunge':
        if (dashTowardEnd(b, 320, D(24))) {
          b.count--; dust(b.x, b.y, 6);
          if (b.count > 0) { b.state = 'lungeAim'; b.st = .55; b.lockAt = .3; b.face = Math.atan2(p.y - b.y, p.x - b.x); }
          else { b.state = 'recover'; b.st = .9; }
        }
        break;
      case 'aegisWind':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          addRing(b.x, b.y, 170, 130, D(18), '#ebc152');
          Sound.play('thud'); addShake(3); b.count--;
          if (b.count > 0) b.st = .45; else { b.state = 'recover'; b.st = .8; }
        }
        break;
      case 'spearsWind':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const n = (P2 ? 9 : 5) + 2 * b.rank, at = aoeAt(p);
          addCircleHazard(at.x, at.y, 12, .85, D(20), 'spear');
          for (let i = 1; i < n; i++) { const a = rand(0, Math.PI * 2), r = rand(20, 70); addCircleHazard(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 12, .85 + i * .05, D(20), 'spear'); }
          b.state = 'recover'; b.st = 1;
        }
        break;
      case 'summon':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) { summonAround(b, P2 ? ['owl', 'owl', 'hoplite'] : ['owl', 'owl'], 'Athena calls her owls'); b.state = 'idle'; b.st = 1; }
        break;
      case 'recover': b.vx = b.vy = 0; b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = P2 ? .6 : .9; } break;
    }
    bossContact(b, D(10));
  },
  // Zeus: lightning strikes on marked ground, thunderbolts that burst, homing storm orbs. Below a fifth of his health he changes form.
  zeus(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2, P3 = b.phase === 3, D = n => n * b.dm;
    if (bossCommon(b, dt)) return;
    if (bossEnrage(b, 'Zeus unleashes the storm', 'Lightning falls on its own now')) return;
    if (b.phase === 2 && b.hp <= b.maxHp * .22 && b.state !== 'enrage') {
      b.phase = 3; Music.level(3); b.state = 'ascend'; b.st = 1.8; b.invuln = 1.8; b.vx = b.vy = 0;
      banner('Zeus takes his true form', 'The whole sky is falling', true); Sound.play('roar'); addShake(7); G.flash = .25;
      for (const pr of q.projs) if (pr.team === 'enemy') pr.dead = true;
      return;
    }
    const thresholds = [.65, .38];
    if (b.summons < thresholds.length && b.hp <= b.maxHp * thresholds[b.summons] && b.state === 'idle') { b.summons++; b.state = 'summon'; b.st = .9; return; }
    if ((P2 || b.rank >= 1) && !p.dead && b.state !== 'ascend') {
      b.stormT -= dt;
      if (b.stormT <= 0) { b.stormT = P3 ? rand(1.5, 2) : rand(2.2, 3); const at = aoeAt(p); for (let i = 0; i < (P3 ? 3 : 2) + b.rank; i++) addCircleHazard(at.x + rand(-44, 44), at.y + rand(-32, 32), 13, 1, D(18), 'bolt'); }
    }
    b.flip = c.dx < 0;
    switch (b.state) {
      case 'enrage': b.st -= dt; G.flash = Math.max(G.flash, Math.random() < .1 ? .1 : 0); if (b.st <= 0) { b.state = 'idle'; b.st = .4; } break;
      case 'ascend': b.st -= dt; if (Math.random() < .5) G.flash = Math.max(G.flash, .06); if (Math.random() < .6) burst(b.x, b.y - 20, 2, ['#ffd463', '#ffffff', '#57c2b0'], 120); if (b.st <= 0) { b.state = 'idle'; b.st = .3; } break;
      case 'idle': {
        const sp = P3 ? 66 : P2 ? 60 : 45, wantD = 110;
        const mx = c.ux * (c.d - wantD) / 40 - c.uy * b.orbit * .7, my = c.uy * (c.d - wantD) / 40 + c.ux * b.orbit * .7, m = Math.hypot(mx, my) || 1;
        b.vx = mx / m * sp; b.vy = my / m * sp;
        if (Math.random() < dt * .3) b.orbit *= -1;
        b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, P3 ? ['strikes', 'bolt', 'lanes', 'orbs', 'lanes'] : ['strikes', 'bolt', 'orbs', 'strikes']);
          if (pick === 'strikes') { b.state = 'strikesWind'; b.st = .5; }
          else if (pick === 'bolt') { b.state = 'boltAim'; b.st = .6; b.lockAt = .3; b.count = P2 ? 2 : 1; Sound.play('telegraph'); }
          else if (pick === 'lanes') { b.state = 'lanesWind'; b.st = .5; }
          else { b.state = 'orbWind'; b.st = .7; }
        }
        break;
      }
      case 'strikesWind':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const n = (P3 ? 11 : P2 ? 9 : 6) + 2 * b.rank, at = aoeAt(p);
          addCircleHazard(at.x, at.y, 14, .85, D(24), 'bolt');
          for (let i = 1; i < n; i++) { const a = rand(0, Math.PI * 2), r = rand(24, 80); addCircleHazard(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 14, .85 + i * .07, D(24), 'bolt'); }
          b.state = 'recover'; b.st = P3 ? .7 : 1;
        }
        break;
      case 'lanesWind':                                   // third form: whole lines of lightning across the summit
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const horiz = Math.random() < .5, n = 3, gaps = shuffle([0, 1, 2, 3, 4]).slice(0, n);
          gaps.forEach((g, i) => {
            if (horiz) { const y = IPX.minY + 24 + g * ((IPX.maxY - IPX.minY - 48) / 4); q.hazards.push({ type: 'lane', kind: 'bolt', x0: IPX.minX, y0: y, x1: IPX.maxX, y1: y, t: 0, delay: 1 + i * .25, dmg: D(26) }); }
            else { const x = IPX.minX + 30 + g * ((IPX.maxX - IPX.minX - 60) / 4); q.hazards.push({ type: 'lane', kind: 'bolt', x0: x, y0: IPX.minY, x1: x, y1: IPX.maxY, t: 0, delay: 1 + i * .25, dmg: D(26) }); }
          });
          Sound.play('telegraph'); b.state = 'recover'; b.st = 1.1;
        }
        break;
      case 'boltAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st > b.lockAt) { b.aim = Math.atan2(c.dy, c.dx); const len = raycast(b.x, b.y, b.aim, 300, 4); b.dashEnd = { x: b.x + Math.cos(b.aim) * len, y: b.y + Math.sin(b.aim) * len }; }
        if (b.st <= 0) {
          spawnProj(b.x, b.y, b.aim, 270, D(22), 'thunder', 'enemy', { r: 5.5, life: 2, src: b, split: P2 ? { n: 6, kind: 'zspark', speed: 110, dmg: D(10) } : { n: 4, kind: 'zspark', speed: 95, dmg: D(9) } });
          Sound.play('zap'); b.count--;
          if (b.count > 0) { b.st = .55; b.lockAt = .3; } else { b.state = 'recover'; b.st = .7; }
        }
        break;
      case 'orbWind':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const n = P3 ? 5 : P2 ? 4 : 3, base = Math.atan2(c.dy, c.dx);
          for (let i = 0; i < n; i++) spawnProj(b.x, b.y, base + (i / Math.max(1, n - 1) - .5) * 1.6, 70, D(16), 'orb', 'enemy', { r: 4, life: 4.5, homing: 1.5, src: b });
          Sound.play('ability'); b.state = 'recover'; b.st = .8;
        }
        break;
      case 'summon':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) { summonAround(b, P2 ? ['harpy', 'harpy', 'acolyte'] : ['harpy', 'eagle', 'eagle'], 'Zeus calls the storm'); b.state = 'idle'; b.st = 1; }
        break;
      case 'recover': b.vx = b.vy = 0; b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = P3 ? .45 : P2 ? .6 : 1; } break;
    }
    bossContact(b, D(12));
  },
  // Every other god: a list of attacks from the library below, tuned per god in BOSSES.
  generic(b, dt, c) {
    const d = b.def, p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, T = b.tier, dm = pct => rawDmg(pct * b.dmgMul, T);
    if (bossCommon(b, dt)) return;
    if (bossEnrage(b, d.phase2.title, d.phase2.sub)) return;
    const S = d.summons || [];
    if (b.summons < S.length && b.hp <= b.maxHp * S[b.summons].at && b.state === 'idle') { b.summonTypes = summonFor(b, S[b.summons].types); b.summons++; b.state = 'summon'; b.st = .8; Sound.play('telegraph'); return; }
    const A = b.cur, P = A ? (P2 ? { ...A.p1, ...(A.p2 || {}) } : A.p1) : null;
    if (b.state !== 'charmAim' && b.state !== 'dashAim') b.flip = c.dx < 0;
    switch (b.state) {
      case 'enrage': b.st -= dt; if (Math.random() < .7) burst(b.x, b.y - 12, 1, d.colors, 90); if (b.st <= 0) { b.state = 'idle'; b.st = .4; } break;
      case 'idle': {
        let sp = d.speed * (P2 ? 1.1 : 1);
        if (d.rage && P2) sp = d.speed * (1 + (1 - b.hp / b.maxHp) * .25);
        sp = Math.min(sp, 78);
        const want = d.keep;
        const mx = c.ux * clamp((c.d - want) / 40, -1, 1) - c.uy * b.orbit * .7, my = c.uy * clamp((c.d - want) / 40, -1, 1) + c.ux * b.orbit * .7, m = Math.hypot(mx, my) || 1;
        b.vx = mx / m * sp; b.vy = my / m * sp;
        if (Math.random() < dt * .35) b.orbit *= -1;
        b.st -= dt;
        if (b.st <= 0 && !p.dead) startBossAttack(b, c);
        break;
      }
      case 'recover': b.vx = b.vy = 0; b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = P2 ? .55 : .85; } break;
      case 'summon':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) { summonAround(b, b.summonTypes, `${d.name} calls for help`, { wild: P2 && b.type === 'eris' }); b.state = 'idle'; b.st = 1; }
        break;
      case 'fan':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const base = Math.atan2(c.dy, c.dx), n = P.n;
          for (let i = 0; i < n; i++) spawnProj(b.x, b.y - 4, base + (n > 1 ? (i / (n - 1) - .5) * P.spread : 0), P.speed, dm(P.dmg), P.kind, 'enemy', { r: 3, life: 3.5, src: b });
          Sound.play('shoot'); b.count--;
          if (b.count > 0) b.st = .38; else { b.state = 'recover'; b.st = .6; }
        }
        break;
      case 'rain':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const at = aoeAt(p);
          addCircleHazard(at.x, at.y, P.r, P.delay, dm(P.dmg), P.kind);
          for (let i = 1; i < P.n; i++) { const a = rand(0, Math.PI * 2), r = rand(22, 85); addCircleHazard(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, P.r, P.delay + i * .06, dm(P.dmg), P.kind); }
          b.state = 'recover'; b.st = .9;
        }
        break;
      case 'tossAim': {                                           // takes aim along the marked line, then throws the weapon
        b.vx = b.vy = 0; b.st -= dt; const R = P.range || 230;
        if (b.st > b.lockAt) { b.aim = Math.atan2(c.dy, c.dx); b.dashEnd = { x: b.x + Math.cos(b.aim) * R, y: b.y + Math.sin(b.aim) * R }; }
        if (b.st <= 0) {
          spawnProj(b.x + Math.cos(b.aim) * 6, b.y - 6, b.aim, P.speed, dm(P.dmg), 'godweapon', 'enemy', { r: 5, life: 6, src: b, ghost: true, boom: { t: R / P.speed, src: b } });
          q.projs[q.projs.length - 1].weapon = GOD_HELD[b.type] || ['spear', '#c7ccd1'];
          b.tossOut = true; b.dashEnd = null; b.state = 'tossWait'; b.st = 3.5; Sound.play('swing'); Sound.play('heavy');
        }
        break;
      }
      case 'tossWait': b.vx = b.vy = 0; b.st -= dt; if (!b.tossOut || b.st <= 0) { b.tossOut = false; b.state = 'recover'; b.st = .45; } break;   // empty-handed until it comes back
      case 'leapAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st > .3) { b.tx = clamp(p.x, IPX.minX + 10, IPX.maxX - 10); b.ty = clamp(p.y, IPX.minY + 10, IPX.maxY - 10); }
        if (b.st <= 0) { b.state = 'leap'; b.st = .55; b.sx = b.x; b.sy = b.y; b.air = true; Sound.play('pounce'); }
        break;
      case 'leap': {
        b.vx = b.vy = 0; b.st -= dt; const k = 1 - Math.max(0, b.st / .55);
        b.x = lerp(b.sx, b.tx, k); b.y = lerp(b.sy, b.ty, k); b.z = Math.sin(k * Math.PI) * 40;
        if (b.st <= 0) {
          b.air = false; b.z = 0; addShake(5); Sound.play('thud'); dust(b.x, b.y, 14);
          q.fx.push({ t: 'ring', x: b.x, y: b.y, r0: 4, r1: P.r, life: .3, max: .3, c: '#d8ccb4' });
          for (const h of q.hunters) if (dist(b, h) < P.r + h.r) hurtHunter(h, dm(P.dmg), Math.atan2(h.y - b.y, h.x - b.x), 240, { unblockable: true, src: b });
          b.state = 'recover'; b.st = .8;
        }
        break;
      }
      case 'confuse':
        b.vx = b.vy = 0; b.st -= dt;
        if (Math.random() < .5) sc.parts.push({ x: b.x + rand(-8, 8), y: b.y - rand(6, 20), vx: 0, vy: -16, g: 0, life: .4, max: .4, c: '#9a6bc0', s: 1 });
        if (b.st <= 0) { addRing(b.x, b.y, 110, 150, dm(P.dmg), '#9a6bc0', { confuse: P.time }); Sound.play('charm'); b.state = 'recover'; b.st = .7; }
        break;
      case 'puddles':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const at = aoeAt(p);
          for (let i = 0; i < P.n; i++) {
            const a = rand(0, Math.PI * 2), r = i === 0 ? 0 : rand(30, 110);
            addCircleHazard(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, P.r, .8 + i * .08, 0, 'lob', { puddle: P.kind, life: P.life, dps: P.dmg, from: { x: b.x, y: b.y - 14 } });
          }
          Sound.play('swing'); b.state = 'recover'; b.st = .7;
        }
        break;
      case 'charmAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st > .3) { b.aim = Math.atan2(c.dy, c.dx); b.flip = c.dx < 0; }
        if (b.st <= 0) {
          q.fx.push({ t: 'beamfx', x: b.x, y: b.y - 10, a: b.aim, len: P.range, life: .25, max: .25, c: '#f2a7c0' });
          for (const h of q.hunters) {                            // everyone standing in the beam
            const hx = h.x - b.x, hy = h.y - b.y, a = Math.atan2(hy, hx), hd = Math.hypot(hx, hy) || 1;
            if (hd < P.range && Math.abs(angDiff(b.aim, a)) < .2) {
              const r = hurtHunter(h, dm(P.dmg), b.aim, 40, { src: b });
              if (r === 1) { h.fx.charm = P.time; h.charmFrom = b; Sound.play('charm'); }
            }
          }
          b.state = 'recover'; b.st = .6;
        }
        break;
      case 'blinkOut':
        b.vx = b.vy = 0; b.st -= dt; b.alpha = Math.max(0, b.st / .35);
        if (b.st <= 0) { const s = farSpot(p); b.x = s.x; b.y = s.y; b.state = 'blinkIn'; b.st = .3; burst(b.x, b.y - 10, 14, d.colors, 80); }
        break;
      case 'blinkIn': b.st -= dt; b.alpha = 1 - Math.max(0, b.st / .3); if (b.st <= 0) { b.alpha = 1; b.state = 'idle'; b.st = .35; } break;
      case 'wave':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          addRing(b.x, b.y, P.speed, P.max, dm(P.dmg), P.col); Sound.play('thud'); addShake(2); b.count--;
          if (b.count > 0) b.st = .45; else { b.state = 'recover'; b.st = .6; }
        }
        break;
      case 'beamAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) { b.state = 'beam'; b.st = P.time; Sound.play('beam'); }
        break;
      case 'beam': {
        b.vx = b.vy = 0; b.st -= dt;
        const k = 1 - Math.max(0, b.st / P.time); b.beam.a = b.beam.a0 + b.beam.dir * P.sweep * k;
        const ex = b.x + Math.cos(b.beam.a) * P.len, ey = b.y - 8 + Math.sin(b.beam.a) * P.len;
        for (const h of q.hunters) if (!h.dead && distToSeg(h.x, h.y - 4, b.x, b.y - 8, ex, ey) < 6) hurtHunter(h, dm(P.dmg), b.beam.a + Math.PI / 2 * b.beam.dir, 140, { src: b });
        if (b.st <= 0) { b.beam = null; b.state = 'recover'; b.st = .8; }
        break;
      }
      case 'dashAim':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st > .3) { const a = Math.atan2(c.dy, c.dx); b.aim = a; b.flip = c.dx < 0; const len = raycast(b.x, b.y, a, 260, b.r + 2); b.dashEnd = { x: b.x + Math.cos(a) * len, y: b.y + Math.sin(a) * len }; }
        if (b.st <= 0) { b.state = 'dash'; b.hitDone = false; Sound.play('dodge'); }
        break;
      case 'dash':
        q.fx.push({ t: 'after', spr: b.def.sprite, flip: b.flip, x: b.x, y: b.y, life: .2, max: .2, gold: true });
        if (dashTowardEnd(b, P.speed, dm(P.dmg))) {
          b.count--; dust(b.x, b.y, 6);
          if (b.count > 0) { b.state = 'dashAim'; b.st = .55; } else { b.state = 'recover'; b.st = .85; }
        }
        break;
      case 'quake':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          [[30, 8, .5], [55, 11, .75], [80, 14, 1]].forEach(([r, n, del]) => { const off = rand(0, 1); for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; addCircleHazard(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 10, del, dm(P.dmg), 'spike'); } });
          addShake(4); Sound.play('thud'); b.state = 'recover'; b.st = 1;
        }
        break;
      case 'ring':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const off = rand(0, 1);
          for (let i = 0; i < P.n; i++) spawnProj(b.x, b.y - 4, off + i / P.n * Math.PI * 2, P.speed, dm(P.dmg), P.kind, 'enemy', { r: 3, life: 4, homing: P.homing || 0, src: b });
          Sound.play('ability'); b.count--;
          if (b.count > 0) b.st = .5; else { b.state = 'recover'; b.st = .6; }
        }
        break;
      case 'vanishOut':
        b.vx = b.vy = 0; b.st -= dt; b.alpha = Math.max(0, b.st / .4);
        if (b.st <= 0) { b.hidden = true; b.state = 'vanished'; b.st = P.time; }
        break;
      case 'vanished': {                                  // only a shadow on the floor gives him away
        b.st -= dt; const sp = c.d > 12 ? 64 : 0;
        b.vx = c.ux * sp; b.vy = c.uy * sp;
        if (b.st <= 0) { b.vx = b.vy = 0; addCircleHazard(b.x, b.y, 26, .5, dm(P.dmg), 'shadow'); b.state = 'vanishStrike'; b.st = .5; }
        break;
      }
      case 'vanishStrike': b.vx = b.vy = 0; b.st -= dt; if (b.st <= 0) { b.hidden = false; b.alpha = 1; b.state = 'recover'; b.st = .9; } break;
      case 'stampede':
        b.vx = b.vy = 0; b.st -= dt;
        if (b.st <= 0) {
          const ys = shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, P.n + (P2 ? 2 : 0));
          ys.forEach((g, i) => {
            const y = IPX.minY + 14 + g * ((IPX.maxY - IPX.minY - 28) / 6), right = i % 2 === 0;
            q.hazards.push({ type: 'lane', kind: 'goat', x0: right ? IPX.minX - 8 : IPX.maxX + 8, y0: y, x1: right ? IPX.maxX + 8 : IPX.minX - 8, y1: y, t: 0, delay: .9 + i * .18, dmg: dm(.12), speed: 230 });
          });
          Sound.play('telegraph'); b.state = 'recover'; b.st = 1.1;
        }
        break;
      case 'reflect':
        b.vx = b.vy = 0; b.st -= dt; b.reflectT = b.st;
        if (b.st <= 0) { b.reflectT = 0; b.state = 'recover'; b.st = .3; }
        break;
    }
    bossContact(b, dm(d.contact));
  },
};
function startBossAttack(b, c) {
  const d = b.def, P2 = b.phase >= 2;
  const list = b.attacks || d.attacks, opts = []; for (const A of list) for (let i = 0; i < A.w; i++) opts.push(A.id);
  const id = pickAttack(b, opts), A = list.find(a => a.id === id), P = P2 || b.rank >= 1 ? { ...A.p1, ...(A.p2 || {}) } : A.p1;
  b.cur = A;
  switch (id) {
    case 'fan': b.state = 'fan'; b.st = .55; b.count = (P.volleys || 1) + (b.rage3 ? 1 : 0); break;
    case 'rain': b.state = 'rain'; b.st = .45; break;
    case 'leap': b.state = 'leapAim'; b.st = .65; Sound.play('telegraph'); break;
    case 'toss': b.state = 'tossAim'; b.st = .75; b.lockAt = .25; Sound.play('telegraph'); break;
    case 'confuse': b.state = 'confuse'; b.st = .6; break;
    case 'puddles': b.state = 'puddles'; b.st = .5; break;
    case 'charm': b.state = 'charmAim'; b.st = .75; Sound.play('telegraph'); break;
    case 'blink': b.state = 'blinkOut'; b.st = .35; Sound.play('dodge'); break;
    case 'wave': b.state = 'wave'; b.st = .7; b.count = P.count || 1; Sound.play('telegraph'); break;
    case 'beam': {
      const dir = Math.random() < .5 ? 1 : -1, a = Math.atan2(c.dy, c.dx) - dir * P.sweep / 2;
      b.beam = { a0: a, a, dir }; b.state = 'beamAim'; b.st = .8; Sound.play('telegraph'); break;
    }
    case 'dash': b.state = 'dashAim'; b.st = .7; b.count = P.count || 1; Sound.play('telegraph'); break;
    case 'quake': b.state = 'quake'; b.st = .6; Sound.play('telegraph'); break;
    case 'ring': b.state = 'ring'; b.st = .6; b.count = P.rings || 1; break;
    case 'vanish': b.state = 'vanishOut'; b.st = .4; Sound.play('dodge'); break;
    case 'stampede': b.state = 'stampede'; b.st = .5; break;
    case 'reflect': b.state = 'reflect'; b.st = P.time; Sound.play('perfect'); break;
  }
}
function updateBoss(b, dt) {
  b.flash = Math.max(0, b.flash - dt);
  const p = bossTarget(b, dt), dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;   // who it's after (you, alone)
  b.tgt = p;
  // God Rank: below 30% health every god and Titan goes berserk.
  if (b.rank >= 2 && !b.rage3 && b.hp <= b.maxHp * .3 && b.state !== 'intro') {
    b.rage3 = true; b.tempo *= 1.15; banner(`${b.def.name} goes berserk`, 'Faster, and nothing held back', true); Sound.play('roar'); addShake(5); G.flash = .15;
  }
  if (b.rage3 && Math.random() < .3) sc.parts.push({ x: b.x + rand(-b.r, b.r), y: b.y - rand(4, b.h), vx: 0, vy: -24, g: 0, life: .4, max: .4, c: Math.random() < .5 ? '#b48cff' : '#ffffff', s: 1 });
  const tdt = dt * (b.tempo || 1) * (q.timeStop > 0 ? .5 : 1);
  (b.def.titan ? TITAN_AI[b.type] : BOSS_AI[b.type] || BOSS_AI.generic)(b, tdt, { dx, dy, d, ux: dx / d, uy: dy / d });
  if (b.dead) return;
  b.walkT += dt;
  const mdt = dt * (q.timeStop > 0 ? .5 : 1);
  if (!b.air) moveEntity(b, (b.vx + b.kbx) * mdt, (b.vy + b.kby) * mdt, b.type === 'zeus' || b.state === 'vanished' || b.ghostMove);
  if (b.def.titan) b.y = Math.max(b.y, IPX.minY + 52);            // keep a Titan's head inside the arena
  const decay = Math.pow(.002, dt); b.kbx *= decay; b.kby *= decay;
}



// Gods who carry a weapon also throw it: it flies out along the marked line and comes back to their hand,
// and they stand empty-handed (open to hits) until it's back.
for (const id of ['ares', 'poseidon', 'hera', 'hephaestus', 'hades', 'dionysus', 'nemesis'])
  if (BOSSES[id] && BOSSES[id].attacks) BOSSES[id].attacks.push({ id: 'toss', w: 2, p1: { dmg: .15, speed: 230, range: 230 }, p2: { speed: 285 } });
