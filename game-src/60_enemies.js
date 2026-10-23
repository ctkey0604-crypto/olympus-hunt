/* ============================== ENEMIES ================================== */
// Monster stats come from its class and the quest's tier, so the same wolf is fair on any hunt it shows up in.
// High and God Rank monsters are tougher, hit harder and think faster (tempo speeds up every windup and rest).
function makeEnemy(type, x, y, tier = tierNow(), rank = q ? q.def.rank : 0) {
  const d = ENEMIES[type], C = CLASS[d.cls], R = RANKS[rank] || RANKS[0];
  const hp = Math.max(1, Math.round((d.hpM || C.hpM) * tierW(tier) * R.hp));
  const fr = SPR[d.sprite][0], scale = d.scale || 1, fly = d.role === 'flyer' || !!d.fly;
  return { id: EID++, type, def: d, tier, rank, tempo: R.tempo, x, y, r: d.r, h: fr.h * scale + (fly ? 10 : 0), hp, maxHp: hp, dmg: rawDmg((d.dmgP || C.dmgP) * R.dmg, tier),
           vx: 0, vy: 0, kbx: 0, kby: 0, state: 'spawn', st: .8, cd: rand(.3, 1.2), flash: 0, stun: 0, flip: false, walkT: Math.random() * 2, face: 0,
           spdMul: rand(.85, 1.15), strafe: Math.random() < .5 ? 1 : -1, aim: 0, kbRes: d.kbRes ?? 1, dead: false, hitDone: false, owner: 0,
           tok: null, markT: 0, burnT: 0, burnAcc: 0, chainLeft: 0, hidden: false, alpha: 1, fly, scale };
}
// Attack turns: only a few monsters may be mid-attack at once, so a crowd pressures you without a wall of hits.
const TOK_STATES = new Set(['windup', 'attack', 'charge', 'swoop', 'pounce', 'fuse', 'fade', 'gone', 'appear']);
function tokenKind(e) { const r = e.def.role; return r === 'shooter' || r === 'thrower' ? 'ranged' : r === 'summoner' ? null : 'melee'; }
function takeToken(e) {
  const k = tokenKind(e); if (!k) return true;
  const turns = RANKS[q.def.rank].turns, max = k === 'melee' ? turns[0] : turns[1];
  if (q.tokUse[k] >= max) { e.cd = rand(.25, .6); return false; }
  q.tokUse[k]++; e.tok = k; return true;
}
const MELEE = (e, extra = {}) => ({ src: e, melee: true, ...extra });
const ROLES = {
  // Fodder: walks straight at you, telegraphs, lunges. Crabs come in at an angle.
  fodder(e, dt, c) {
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul; let ux = c.ux, uy = c.uy;
        if (e.def.sideways) { const a = Math.atan2(uy, ux) + .8 * (Math.sin(G.time * 1.6 + e.id) > 0 ? 1 : -1); ux = Math.cos(a); uy = Math.sin(a); }
        if (c.d < e.r + q.player.r + 5) { ux *= .15; uy *= .15; }
        e.vx = ux * sp; e.vy = uy * sp; e.flip = c.dx < 0; e.cd -= dt;
        if (c.d < e.r + q.player.r + 11 && e.cd <= 0 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = Math.max(.3, e.def.windup || .42); e.aim = Math.atan2(c.dy, c.dx); }
        break;
      }
      case 'windup': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'attack'; e.st = .14; e.hitDone = false; q.fx.push({ t: 'slash', x: e.x, y: e.y - 5, a: e.aim, life: .15, max: .15 }); } break;
      case 'attack':
        e.vx = Math.cos(e.aim) * 100; e.vy = Math.sin(e.aim) * 100; e.st -= dt;
        if (!e.hitDone && dist(e, q.player) < e.r + q.player.r + 6) { e.hitDone = true; hurtPlayer(e.dmg, e.aim, 140, MELEE(e)); }
        if (e.st <= 0) {
          // High Rank: sometimes follows up with a second lunge
          if (e.rank >= 1 && !e.combo && Math.random() < .3 + .15 * e.rank && !q.player.dead) { e.combo = true; e.state = 'windup'; e.st = .24; e.aim = Math.atan2(c.dy, c.dx); }
          else { e.combo = false; e.state = 'recover'; e.st = .55; }
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(.2, .6); } break;
    }
  },
  // Shooter: keeps its distance, strafes, fires dodgeable shots. Some fire spreads, some charm, some shove.
  shooter(e, dt, c) {
    e.flip = c.dx < 0;
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul; let mx = 0, my = 0;
        if (c.d < e.def.near) { mx = -c.ux; my = -c.uy; } else if (c.d > e.def.far) { mx = c.ux; my = c.uy; }
        else { mx = -c.uy * e.strafe; my = c.ux * e.strafe; if (Math.random() < dt * .5) e.strafe *= -1; }
        e.vx = mx * sp; e.vy = my * sp; e.cd -= dt;
        if (e.cd <= 0 && c.d < 230 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = .5; }
        break;
      }
      case 'windup': e.vx = e.vy = 0; e.st -= dt;
        if (e.st <= 0) {
          const P = e.def.proj, p = q.player, lead = e.rank >= 2 ? c.d / P.speed * .8 : 0;
          const a = Math.atan2(p.y + p.vy * lead - e.y, p.x + p.vx * lead - e.x), n = P.multi || 1;
          for (let i = 0; i < n; i++) spawnProj(e.x + Math.cos(a) * 5, e.y + Math.sin(a) * 5, a + (n > 1 ? (i / (n - 1) - .5) * (P.spread || .3) : 0), P.speed, e.dmg, P.kind, 'enemy', { life: 2.4, charm: P.charm, knock: P.knock, src: e });
          Sound.play('shoot');
          // High Rank shooters fire a quick second shot (God Rank: a third)
          e.shots = (e.shots || 0) + 1;
          if (e.shots <= e.rank) { e.st = .2; } else { e.shots = 0; e.state = 'recover'; e.st = .35; }
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(e.def.cd[0], e.def.cd[1]); } break;
    }
  },
  // Thrower: keeps away and lobs jars that land where you stood and leave a puddle. The landing spot is marked.
  thrower(e, dt, c) {
    e.flip = c.dx < 0;
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul; let mx = 0, my = 0;
        if (c.d < e.def.near) { mx = -c.ux; my = -c.uy; } else if (c.d > e.def.far) { mx = c.ux; my = c.uy; } else { mx = -c.uy * e.strafe; my = c.ux * e.strafe; }
        e.vx = mx * sp; e.vy = my * sp; e.cd -= dt;
        if (e.cd <= 0 && c.d < 210 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = .55; }
        break;
      }
      case 'windup': e.vx = e.vy = 0; e.st -= dt;
        if (e.st <= 0) {
          const p = q.player, lead = .35;
          addCircleHazard(p.x + p.vx * lead, p.y + p.vy * lead, 14, .8, e.dmg, 'lob', { puddle: e.def.puddle, life: 5, dps: 0, from: { x: e.x, y: e.y - 10 } });
          Sound.play('swing'); e.state = 'recover'; e.st = .45;
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(e.def.cd[0], e.def.cd[1]); } break;
    }
  },
  // Charger: paws the ground (telegraph), then charges in a straight line. Stuns itself on walls.
  charger(e, dt, c) {
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul;
        e.vx = c.ux * sp; e.vy = c.uy * sp; e.flip = c.dx < 0; e.cd -= dt;
        if (e.cd <= 0 && c.d < 170 && c.d > 28 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = .85; e.chainLeft = (e.def.chain || 1) - 1 + (e.rank >= 2 ? 1 : 0); e.aim = Math.atan2(c.dy, c.dx); Sound.play('telegraph'); }
        break;
      }
      case 'windup':
        e.vx = e.vy = 0; e.st -= dt;
        if (e.st > .3) { e.aim = Math.atan2(c.dy, c.dx); e.flip = c.dx < 0; }
        if (Math.random() < .3) dust(e.x - Math.cos(e.aim) * 6, e.y, 1);
        if (e.st <= 0) { e.state = 'charge'; e.st = 1.1; e.hitDone = false; e.trampled = new Set(); e.trailD = 0; }
        break;
      case 'charge': {
        const sp = e.def.charge || 215;
        if (e.rank >= 1 && e.st > .5) { const want = Math.atan2(c.dy, c.dx), turn = (e.rank >= 2 ? 1 : .6) * dt; e.aim += clamp(angDiff(e.aim, want), -turn, turn); }   // High Rank: it steers
        e.vx = Math.cos(e.aim) * sp; e.vy = Math.sin(e.aim) * sp; e.st -= dt;
        if (Math.random() < .6) dust(e.x, e.y, 1);
        if (e.def.trail) { e.trailD += sp * dt; if (e.trailD > 20) { e.trailD = 0; addPuddle(e.x, e.y, 9, 3.5, e.def.trail, .025); } }
        if (!e.hitDone && dist(e, q.player) < e.r + q.player.r + 2) { if (hurtPlayer(e.dmg, e.aim, 260, MELEE(e))) e.hitDone = true; }
        for (const o of q.enemies) {
          if (o === e || o.dead || o.boss || o.state === 'spawn' || e.trampled.has(o.id)) continue;
          if (dist(o, e) < o.r + e.r + 2) { e.trampled.add(o.id); damageEnemy(o, o.maxHp * .3, e.aim, 180, true, false); }
        }
        if (e.st <= 0) chargeEnd(e);
        break;
      }
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(.8, 1.6); } break;
    }
  },
  // Flyer: circles above the fight, hovers to telegraph, then swoops in a straight line.
  flyer(e, dt, c) {
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul, want = 72;
        let mx = c.ux * (c.d - want) / 30 - c.uy * e.strafe, my = c.uy * (c.d - want) / 30 + c.ux * e.strafe;
        const m = Math.hypot(mx, my) || 1; e.vx = mx / m * sp; e.vy = my / m * sp; e.flip = c.dx < 0;
        if (Math.random() < dt * .4) e.strafe *= -1;
        e.cd -= dt;
        if (e.cd <= 0 && c.d < 150 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = .55; }
        break;
      }
      case 'windup':
        e.vx = e.vy = 0; e.st -= dt;
        if (e.st > .3) { const p = q.player, lead = e.rank >= 1 ? .25 : 0; e.aim = Math.atan2(p.y + p.vy * lead - e.y, p.x + p.vx * lead - e.x); e.flip = c.dx < 0; }
        if (e.st <= 0) { e.state = 'swoop'; e.st = .6; e.hitDone = false; Sound.play('dodge'); }
        break;
      case 'swoop':
        e.vx = Math.cos(e.aim) * e.def.swoop; e.vy = Math.sin(e.aim) * e.def.swoop; e.st -= dt;
        if (!e.hitDone && dist(e, q.player) < e.r + q.player.r + 3) { if (hurtPlayer(e.dmg, e.aim, 160, MELEE(e))) e.hitDone = true; }
        if (e.st <= 0) {
          if (e.rank >= 2 && !e.combo && !q.player.dead) { e.combo = true; e.state = 'windup'; e.st = .32; }
          else { e.combo = false; e.state = 'recover'; e.st = .5; }
        }
        break;
      case 'recover': e.vx = -Math.cos(e.aim) * 50; e.vy = -Math.sin(e.aim) * 50; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(1.3, 2.2); } break;
    }
  },
  // Leaper: crouches (telegraph), then pounces. Panthers, berserkers and Cerberus pounce again right after.
  leaper(e, dt, c) {
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul, want = 60;
        let mx = c.ux * clamp((c.d - want) / 20, -1, 1) - c.uy * e.strafe * .6, my = c.uy * clamp((c.d - want) / 20, -1, 1) + c.ux * e.strafe * .6;
        const m = Math.hypot(mx, my) || 1; e.vx = mx / m * sp; e.vy = my / m * sp; e.flip = c.dx < 0;
        if (Math.random() < dt * .5) e.strafe *= -1;
        e.cd -= dt;
        if (e.cd <= 0 && c.d < 115 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = .55; e.chainLeft = (e.def.chain || 1) - 1 + (e.rank >= 1 ? 1 : 0); Sound.play('pounce'); }
        break;
      }
      case 'windup':
        e.vx = e.vy = 0; e.st -= dt;
        if (e.st > .3) { e.aim = Math.atan2(c.dy, c.dx); e.flip = c.dx < 0; }
        if (e.st <= 0) { e.state = 'pounce'; e.st = .3; e.hitDone = false; }
        break;
      case 'pounce':
        e.vx = Math.cos(e.aim) * (e.def.pounce || 240); e.vy = Math.sin(e.aim) * (e.def.pounce || 240); e.st -= dt;
        if (!e.hitDone && dist(e, q.player) < e.r + q.player.r + 3) { if (hurtPlayer(e.dmg, e.aim, 180, MELEE(e))) e.hitDone = true; }
        if (e.st <= 0) {
          dust(e.x, e.y, 3);
          if (e.chainLeft > 0 && !q.player.dead) { e.chainLeft--; e.state = 'windup'; e.st = .34; }
          else { e.state = 'recover'; e.st = .7; }
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(1, 1.8); } break;
    }
  },
  // Exploder: runs at you, swells up and bursts. Kill it before the fuse runs out and it just dies.
  exploder(e, dt, c) {
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul;
        e.vx = c.ux * sp; e.vy = c.uy * sp; e.flip = c.dx < 0;
        if (c.d < 24 && !q.player.dead && takeToken(e)) { e.state = 'fuse'; e.st = .7; Sound.play('telegraph'); }
        break;
      }
      case 'fuse': {
        const sp = e.def.speed * .3; e.vx = c.ux * sp; e.vy = c.uy * sp; e.st -= dt;
        if (e.st <= 0) {
          const R = 28;
          addShake(4); Sound.play('explode'); burst(e.x, e.y - 6, 22, e.def.colors, 120);
          q.fx.push({ t: 'ring', x: e.x, y: e.y, r0: 4, r1: R, life: .25, max: .25, c: e.def.colors[0] });
          if (dist(e, q.player) < R + q.player.r) hurtPlayer(e.dmg, Math.atan2(c.dy, c.dx), 220, { src: e });
          if (e.def.puddle || e.rank >= 2) addPuddle(e.x, e.y, 18 + 4 * e.rank, 4, e.def.puddle || 'poison', .03);
          killEnemy(e, { noLoot: true, exploded: true });
        }
        break;
      }
    }
  },
  // Teleporter: fades out, then appears right behind you and strikes. Its landing spot shows on the ground.
  teleporter(e, dt, c) {
    const p = q.player;
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul;
        e.vx = c.ux * sp; e.vy = c.uy * sp; e.flip = c.dx < 0; e.cd -= dt;
        if (c.d < e.r + p.r + 10 && e.cd <= 0 && takeToken(e)) { e.state = 'windup'; e.st = .4; e.aim = Math.atan2(c.dy, c.dx); }
        else if (e.cd <= 0 && c.d < 220 && !p.dead && takeToken(e)) { e.state = 'fade'; e.st = .35; Sound.play('dodge'); }
        break;
      }
      case 'fade': e.vx = e.vy = 0; e.st -= dt; e.alpha = Math.max(0, e.st / .35);
        if (e.st <= 0) {
          let spot = null;
          for (let i = 0; i < 8 && !spot; i++) { const a = p.face + Math.PI + rand(-.8, .8), x = p.x + Math.cos(a) * 26, y = p.y + Math.sin(a) * 26; if (!pointBlocked(x, y)) spot = { x, y }; }
          if (!spot) spot = { x: p.x + rand(-20, 20), y: p.y + rand(-20, 20) };
          e.tx = clamp(spot.x, IPX.minX + 6, IPX.maxX - 6); e.ty = clamp(spot.y, IPX.minY + 6, IPX.maxY - 6);
          e.state = 'gone'; e.st = .5; e.hidden = true;
        }
        break;
      case 'gone': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.x = e.tx; e.y = e.ty; e.hidden = false; e.state = 'appear'; e.st = .3; } break;
      case 'appear': e.vx = e.vy = 0; e.st -= dt; e.alpha = 1 - Math.max(0, e.st / .3); e.flip = c.dx < 0;
        if (e.st <= 0) { e.alpha = 1; e.state = 'windup'; e.st = .35; e.aim = Math.atan2(c.dy, c.dx); }
        break;
      case 'windup': e.vx = e.vy = 0; e.st -= dt; if (e.st > .15) e.aim = Math.atan2(c.dy, c.dx);
        if (e.st <= 0) { e.state = 'attack'; e.st = .14; e.hitDone = false; q.fx.push({ t: 'slash', x: e.x, y: e.y - 5, a: e.aim, life: .15, max: .15 }); }
        break;
      case 'attack':
        e.vx = Math.cos(e.aim) * 110; e.vy = Math.sin(e.aim) * 110; e.st -= dt;
        if (!e.hitDone && dist(e, p) < e.r + p.r + 7) { e.hitDone = true; hurtPlayer(e.dmg, e.aim, 140, MELEE(e)); }
        if (e.st <= 0) {
          if (e.rank >= 1 && !e.combo && Math.random() < .45 && !p.dead) { e.combo = true; e.state = 'fade'; e.st = .3; Sound.play('dodge'); }   // High Rank: blinks again
          else { e.combo = false; e.state = 'recover'; e.st = .7; }
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(1.4, 2.4); } break;
    }
  },
  // Tank: slow, turns slowly. Shield-bearers block from the front and thrust; giants slam the ground; Argus fires from all his eyes.
  tank(e, dt, c) {
    const A = e.def.attack, want = Math.atan2(c.dy, c.dx);
    if (e.state === 'move' || (e.state === 'windup' && A === 'thrust' && e.st > .3)) e.face += clamp(angDiff(e.face, want), -e.def.turn * dt, e.def.turn * dt);
    e.flip = Math.cos(e.face) < 0;
    const reach = A === 'slam' ? 34 * Math.max(1, e.scale * .75) : A === 'volley' ? 150 : 30;
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul, close = A === 'volley' ? c.d > 90 : c.d > reach - 6;
        e.vx = Math.cos(e.face) * sp * (close ? 1 : 0); e.vy = Math.sin(e.face) * sp * (close ? 1 : 0); e.cd -= dt;
        if (e.cd <= 0 && c.d < reach + 4 && !q.player.dead && takeToken(e)) { e.state = 'windup'; e.st = A === 'slam' ? .95 : A === 'volley' ? 1 : .6; if (A !== 'thrust') Sound.play('telegraph'); }
        break;
      }
      case 'windup':
        e.vx = e.vy = 0; e.st -= dt;
        if (e.st <= 0) {
          e.state = 'attack'; e.st = .18;
          if (A === 'slam') {
            addShake(5); Sound.play('thud'); dust(e.x, e.y, 14);
            q.fx.push({ t: 'ring', x: e.x, y: e.y, r0: 4, r1: reach, life: .3, max: .3, c: '#d8ccb4' });
            if (dist(e, q.player) < reach + q.player.r) hurtPlayer(e.dmg, Math.atan2(c.dy, c.dx), 260, MELEE(e, { unblockable: e.def.cls === 'heavy' }));
            if (e.rank >= 1) addRing(e.x, e.y, 120, reach + 40 + 30 * e.rank, e.dmg * .6, '#d8ccb4');   // High Rank: the slam sends out a shockwave
          } else if (A === 'volley') {
            const n = 10, a0 = rand(0, 1);
            for (let i = 0; i < n; i++) spawnProj(e.x, e.y - 6, a0 + i / n * Math.PI * 2, 95, e.dmg * .6, 'eyebolt', 'enemy', { r: 2.5, life: 3, src: e });
            Sound.play('shoot');
          } else {
            Sound.play('swing');
            const p = q.player, a = Math.atan2(p.y - e.y, p.x - e.x);
            if (dist(e, p) < reach + p.r && Math.abs(angDiff(e.face, a)) < .55) hurtPlayer(e.dmg, e.face, 200, MELEE(e));
          }
        }
        break;
      case 'attack': e.st -= dt;
        if (e.st <= 0) {
          if (A === 'thrust' && e.rank >= 1 && !e.combo && !q.player.dead) { e.combo = true; e.state = 'windup'; e.st = .3; }   // High Rank: thrusts twice
          else { e.combo = false; e.state = 'recover'; e.st = A === 'slam' ? 1.1 : A === 'volley' ? 1 : .8; }
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(.4, 1); } break;
    }
  },
  // Rhea's swaddled stones: shuffle about, then sit still. The real one breathes.
  decoy(e, dt, c) {
    if (e.tx !== null && e.tx !== undefined) { const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy) || 1; e.vx = dx / d * e.def.speed; e.vy = dy / d * e.def.speed; }
    else { e.vx = e.vy = 0; }
  },
  // Summoner: hangs back and keeps calling in help. Kill it first.
  summoner(e, dt, c) {
    e.flip = c.dx < 0;
    switch (e.state) {
      case 'move': {
        const sp = e.def.speed * e.spdMul; let mx = 0, my = 0;
        if (c.d < 110) { mx = -c.ux; my = -c.uy; } else if (c.d > 190) { mx = c.ux; my = c.uy; } else { mx = -c.uy * e.strafe; my = c.ux * e.strafe; }
        e.vx = mx * sp; e.vy = my * sp; e.cd -= dt;
        const mine = q.enemies.filter(o => !o.dead && o.owner === e.id).length;
        if (e.cd <= 0 && mine < 3 + e.rank && !q.player.dead) { e.state = 'windup'; e.st = 1; Sound.play('telegraph'); }
        break;
      }
      case 'windup':
        e.vx = e.vy = 0; e.st -= dt;
        if (Math.random() < .5) sc.parts.push({ x: e.x + rand(-6, 6), y: e.y - rand(4, 14), vx: 0, vy: -20, g: 0, life: .4, max: .4, c: e.def.colors[1], s: 1 });
        if (e.st <= 0) {
          for (const side of [-1, 1]) {
            const s = makeEnemy(e.def.summon, clamp(e.x + side * 14, IPX.minX + 8, IPX.maxX - 8), clamp(e.y + 4, IPX.minY + 8, IPX.maxY - 8), e.tier);
            s.st = .5; s.owner = e.id; q.enemies.push(s);
          }
          Sound.play('zap'); e.state = 'recover'; e.st = .6;
        }
        break;
      case 'recover': e.vx = e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cd = rand(3.5, 5); } break;
    }
  },
};
function chargeEnd(e) {
  if (e.chainLeft > 0 && !q.player.dead) { e.chainLeft--; e.state = 'windup'; e.st = .45; Sound.play('telegraph'); }
  else { e.state = 'recover'; e.st = .7; }
}
function updateEnemy(e, dt) {
  e.flash = Math.max(0, e.flash - dt); e.markT = Math.max(0, e.markT - dt);
  if (e.state === 'spawn') { e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.face = Math.atan2(q.player.y - e.y, q.player.x - e.x); } return; }
  if (e.state === 'bones') {
    e.st -= dt; e.vx = e.vy = 0;
    if (e.st <= 0) { e.state = 'move'; e.hp = Math.round(e.maxHp * .5); e.cd = .8; Sound.play('revive'); burst(e.x, e.y - 6, 8, ['#f3e9d4', '#7fe08a'], 50); }
    return;
  }
  if (e.burnT > 0) {
    e.burnT -= dt; e.burnAcc += dt * q.player.st.weapon.dmg * .35;
    if (Math.random() < .3) sc.parts.push({ x: e.x + rand(-4, 4), y: e.y - rand(4, 12), vx: 0, vy: -24, g: 0, life: .35, max: .35, c: Math.random() < .5 ? '#ff8a2b' : '#ffd463', s: 1 });
    if (e.burnAcc >= 4) { const n = Math.floor(e.burnAcc); e.burnAcc -= n; e.hp -= n; q.stats.dealt += n; addText(e.x, e.y - e.h - 2, String(n), '#ff8a2b'); if (e.hp <= 0) { killEnemy(e); return; } }
  }
  const p = q.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  const c = { dx, dy, d, ux: dx / d, uy: dy / d };
  const decay = Math.pow(.002, dt);
  if (e.stun > 0) {
    e.stun -= dt; e.vx = e.vy = 0; e.hidden = false; e.alpha = 1;
    moveEntity(e, e.kbx * dt, e.kby * dt, e.fly); e.kbx *= decay; e.kby *= decay;
    if (e.stun <= 0 && e.state !== 'move') { e.state = 'move'; e.cd = rand(.6, 1.2); }
    return;
  }
  if (p.dead && e.state === 'move') { e.vx *= .9; e.vy *= .9; }
  else ROLES[e.def.role](e, dt * e.tempo, c);
  if (e.dead) return;
  if (e.state !== 'charge' && e.state !== 'swoop' && e.state !== 'pounce') separate(e);
  e.walkT += dt * (Math.hypot(e.vx, e.vy) > 5 || e.fly ? 1 : 0);
  const blocked = moveEntity(e, (e.vx + e.kbx) * dt, (e.vy + e.kby) * dt, e.fly);
  e.kbx *= decay; e.kby *= decay;
  if (e.state === 'charge' && blocked) {
    e.state = 'move'; e.stun = 1.6; e.cd = 1.2; e.vx = e.vy = 0; e.chainLeft = 0;
    addShake(3); Sound.play('thud'); dust(e.x + Math.cos(e.aim) * 8, e.y, 10);
  } else if (e.state === 'pounce' && blocked && !e.fly) { e.state = 'recover'; e.st = .5; e.stun = .5; dust(e.x, e.y, 5); }
}
function separate(e) {
  for (const o of q.enemies) {
    if (o === e || o.dead || o.state === 'spawn' || o.state === 'bones' || o.hidden || o.boss) continue;
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), min = e.r + o.r;
    if (d > 0 && d < min) { const push = (min - d) * .5; e.x += dx / d * push; e.y += dy / d * push; }
  }
}


