/* ============================== TITAN FIGHTS ============================= */
// Each Titan has one rule of its own on top of its attacks:
//   Atlas carries the sky and throws it      Hyperion's flare burns anything it can see
//   Oceanus' current drags you around         Coeus strikes where you're about to be
//   Mnemosyne's echoes replay your own moves  Themis lays down laws you must keep
//   Rhea hides among swaddled stones          Cronus turns back time if you're too slow
const tD = (b, pct) => rawDmg(pct * b.dmgMul, b.tier);
function titanWalk(b, c, want, sp, dt) {
  const k = clamp((c.d - want) / 40, -1, 1);
  const mx = c.ux * k - c.uy * b.orbit * .55, my = c.uy * k + c.ux * b.orbit * .55, m = Math.hypot(mx, my) || 1;
  b.vx = mx / m * sp; b.vy = my / m * sp; b.walking = true;
  if (Math.random() < dt * .3) b.orbit *= -1;
}
function titanStill(b) { b.vx = b.vy = 0; b.walking = false; }
// Common start of every Titan's think: intro, burning, half-health phase. Returns true if nothing else should run.
function titanCommon(b, dt, title, sub) {
  b.walking = false;
  if (bossCommon(b, dt)) return true;
  if (b.vulnT > 0) { b.vulnT -= dt; if (b.vulnT <= 0) b.vuln = 0; }
  if (bossEnrage(b, title, sub)) return true;
  if (b.state === 'enrage') { titanStill(b); b.st -= dt; if (Math.random() < .7) burst(b.x, b.y - 24, 1, b.def.colors, 90); if (b.st <= 0) { b.state = 'idle'; b.st = .5; } return true; }
  if (b.state === 'recover') { titanStill(b); b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = b.phase >= 2 ? .55 : .85; } return true; }
  return false;
}
function titanSummon(b, at, types, text) {
  if (b.summons < 1 && b.hp < b.maxHp * at && b.state === 'idle') { b.summons++; summonAround(b, types, text); b.state = 'recover'; b.st = .8; return true; }
  return false;
}
function setVuln(b, mul, t) { b.vuln = mul; b.vulnT = t; }
function hasLOS(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 3);
  for (let i = 1; i < n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); for (const bx of sc.world.boxes) if (x >= bx.x && x <= bx.x + bx.w && y >= bx.y && y <= bx.y + bx.h) return false; }
  return true;
}
function quakeRings(b, D, rings = [[34, 10, .3], [60, 14, .55], [88, 18, .8]]) {
  addShake(5); Sound.play('thud'); dust(b.x, b.y, 16);
  rings.forEach(([r, n, del]) => { const off = rand(0, 1); for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; addCircleHazard(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 11, del, D(.18), 'spike'); } });
}
function rainAround(p, n, r, delay, dmg, kind, spread = 100) {
  addCircleHazard(p.x, p.y, r, delay, dmg, kind);
  for (let i = 1; i < n; i++) { const a = rand(0, Math.PI * 2), d = rand(26, spread); addCircleHazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r, delay + i * .08, dmg, kind); }
}
const LAWS = {
  stillness: ['Law of Stillness', 'Do not dash'],
  peace:     ['Law of Peace', 'Do not strike'],
  motion:    ['Law of Motion', 'Keep moving'],
  measure:   ['Law of Measure', 'No more than 3 strikes in a row'],
};

const TITAN_AI = {
  /* ---- Atlas: holds the sky. Throws it, and is open to punishment while his arms are empty. ---- */
  atlas(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (b.globe === undefined) b.globe = true;
    if (titanCommon(b, dt, 'Atlas buckles', 'The sky falls on its own now')) return;
    if (titanSummon(b, .6, ['earthborn', 'earthborn', 'earthborn', 'earthborn'], 'Atlas calls the earthborn')) return;
    if (b.phase >= 2) { b.skyT = (b.skyT ?? 3) - dt; if (b.skyT <= 0 && !p.dead) { b.skyT = rand(2.4, 3.4); const at = aoeAt(p); for (let i = 0; i < 2 + b.rank; i++) addCircleHazard(at.x + rand(-70, 70), at.y + rand(-44, 44), 15, 1.1, D(.15), 'sky'); } }
    b.flip = c.dx < 0;
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 95, P2 ? 40 : 34, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const opts = b.globe ? ['skyfall', 'stomp', 'throw', 'throw'] : ['skyfall', 'stomp'];
          if (b.phase >= 2 && b.globe) opts.push('crush');
          const pick = pickAttack(b, opts);
          if (pick === 'skyfall') { b.state = 'skyfall'; b.st = .6; }
          else if (pick === 'stomp') { b.state = 'stomp'; b.st = .9; Sound.play('telegraph'); }
          else if (pick === 'throw') { b.state = 'throwAim'; b.st = 1.05; b.lockAt = .35; Sound.play('telegraph'); }
          else { b.state = 'crush'; b.st = 1.4; addCircleHazard(b.x, b.y, 70, 1.3, D(.32), 'sky'); Sound.play('telegraph'); }
        }
        break;
      case 'skyfall':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) { rainAround(aoeAt(p), (P2 ? 9 : 6) + 2 * b.rank, 16, 1, D(.17), 'sky'); b.state = 'recover'; b.st = 1; }
        break;
      case 'stomp':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) { quakeRings(b, D); b.state = 'recover'; b.st = 1.1; }
        break;
      case 'throwAim':
        titanStill(b); b.st -= dt;
        if (b.st > b.lockAt) { b.aim = Math.atan2(c.dy, c.dx); b.flip = c.dx < 0; }
        if (b.st <= 0) {
          spawnProj(b.x + Math.cos(b.aim) * 20, b.y + Math.sin(b.aim) * 20, b.aim, 180 + 20 * b.rank, D(.3), 'globe', 'enemy', { r: 16, life: 4.2, knock: 320, src: b, bounce: 2 + b.rank });
          b.globe = false; Sound.play('roar'); addShake(4);
          b.state = 'unburdened'; b.st = 2.6; setVuln(b, 1.3, 2.6);
        }
        break;
      case 'unburdened':                                           // arms empty, breathing hard: hit him now
        titanStill(b); b.st -= dt;
        if (Math.random() < .2) sc.parts.push({ x: b.x + rand(-10, 10), y: b.y - 72, vx: rand(-6, 6), vy: -12, g: 0, life: .5, max: .5, c: '#f3e9d4', s: 1 });
        if (b.st <= 0) { b.state = 'reform'; b.st = 1; }
        break;
      case 'reform':                                               // a new sky gathers over his hands
        titanStill(b); b.st -= dt;
        if (Math.random() < .6) sc.parts.push({ x: b.x + rand(-26, 26), y: b.y - 96 + rand(-16, 16), vx: 0, vy: 0, g: 0, life: .4, max: .4, c: Math.random() < .5 ? '#ffffff' : '#9fb8ff', s: 1 });
        if (b.st <= 0) { b.globe = true; burst(b.x, b.y - 96, 16, ['#ffffff', '#9fb8ff', '#ffd463'], 70); b.state = 'idle'; b.st = .6; }
        break;
      case 'crush': titanStill(b); b.st -= dt; if (b.st <= 0) { addShake(7); b.state = 'recover'; b.st = 1.3; } break;
    }
    b.frame = b.globe || b.state === 'reform' || b.state === 'stomp' ? 2 : null;
    bossContact(b, D(.1));
  },

  /* ---- Hyperion: sweeping beams, and a flare you can only survive behind an obelisk. ---- */
  hyperion(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (titanCommon(b, dt, 'Hyperion blazes', 'More beams, faster flares')) return;
    if (titanSummon(b, .6, ['sky_harpy', 'sky_harpy', 'earthborn', 'earthborn'], 'Hyperion calls the harpies of dawn')) return;
    b.flip = c.dx < 0; b.frame = null;
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 125, 36, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, P2 ? ['beams', 'flare', 'orbs', 'beams', 'blink'] : ['beams', 'flare', 'orbs', 'beams']);
          if (pick === 'beams') { const n = (P2 ? 3 : 2) + (b.rank >= 2 ? 1 : 0); b.beams = { a: Math.atan2(c.dy, c.dx) + Math.PI / n, dir: Math.random() < .5 ? 1 : -1, n, w: P2 ? 1.05 : .8 }; b.state = 'beamsAim'; b.st = 1; Sound.play('telegraph'); }
          else if (pick === 'flare') { b.state = 'flare'; b.st = P2 ? 2 : 2.4; b.flareMax = b.st; Sound.play('beam'); if (!q.seenFlare) { q.seenFlare = true; banner('Hyperion gathers the dawn', 'Get an obelisk between you and him'); } }
          else if (pick === 'orbs') { b.state = 'orbs'; b.st = .7; b.count = P2 ? 2 : 1; }
          else { b.state = 'blinkOut'; b.st = .4; Sound.play('dodge'); }
        }
        break;
      case 'beamsAim': titanStill(b); b.st -= dt; if (b.st <= 0) { b.state = 'beams'; b.st = 3.2; b.beamCd = 0; Sound.play('beam'); } break;
      case 'beams': {
        titanStill(b); b.st -= dt; b.beamCd = Math.max(0, b.beamCd - dt); b.frame = 2;
        const B = b.beams; B.a += B.dir * B.w * dt;
        for (let i = 0; i < B.n; i++) {
          const a = B.a + i / B.n * Math.PI * 2, len = raycast(b.x, b.y, a, 360, 12) + 12;
          if (b.beamCd <= 0) { let hit = false; for (const h of q.hunters) if (!h.dead && distToSeg(h.x, h.y, b.x, b.y, b.x + Math.cos(a) * len, b.y + Math.sin(a) * len) < 7) { if (hurtHunter(h, D(.16), a + Math.PI / 2 * B.dir, 160, { src: b })) hit = true; } if (hit) b.beamCd = .5; }
          if (Math.random() < .25) burst(b.x + Math.cos(a) * len, b.y + Math.sin(a) * len - 4, 1, ['#ffd463', '#ffffff'], 40);
        }
        if (b.st <= 0) { b.beams = null; b.state = 'recover'; b.st = .9; }
        break;
      }
      case 'flare':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          G.flash = .4; addShake(6); Sound.play('explode');
          for (const h of q.hunters) if (!h.dead && hasLOS(b.x, b.y, h.x, h.y)) hurtHunter(h, D(.38), Math.atan2(h.y - b.y, h.x - b.x), 260, { unblockable: true, src: b });
          for (const e of q.enemies) if (!e.boss && !e.dead && e.state !== 'spawn' && hasLOS(b.x, b.y, e.x, e.y)) e.burnT = 2;   // his own minions burn too
          b.state = 'recover'; b.st = 1.6; setVuln(b, 1.2, 1.6);                // the flare leaves him dim for a moment
        }
        break;
      case 'orbs':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) {
          const n = 16 + 2 * b.rank, off = rand(0, 1);
          for (let i = 0; i < n; i++) spawnProj(b.x, b.y - 16, off + i / n * Math.PI * 2, 78, D(.11), 'sunbolt', 'enemy', { r: 3, life: 4.5, src: b });
          Sound.play('ability'); b.count--;
          if (b.count > 0) b.st = .55; else { b.state = 'recover'; b.st = .7; }
        }
        break;
      case 'blinkOut':
        titanStill(b); b.st -= dt; b.alpha = Math.max(0, b.st / .4);
        if (b.st <= 0) { rainAround({ x: b.x, y: b.y }, 5, 15, .7, D(.16), 'sunfire', 60); const s2 = farSpot(p); b.x = s2.x; b.y = s2.y; b.state = 'blinkIn'; b.st = .35; burst(b.x, b.y - 20, 18, ['#ffd463', '#ffffff'], 90); }
        break;
      case 'blinkIn': titanStill(b); b.st -= dt; b.alpha = 1 - Math.max(0, b.st / .35); if (b.st <= 0) { b.alpha = 1; b.state = 'idle'; b.st = .5; } break;
    }
    bossContact(b, D(.1));
  },

  /* ---- Oceanus: the current never stops. Waves, whirlpools and geysers. ---- */
  oceanus(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (!q.current) q.current = { a: rand(0, Math.PI * 2), s: 26, next: null, t: 6 };
    const C = q.current; C.s = (b.phase >= 2 ? 38 : 26) + 6 * b.rank;
    C.t -= dt;
    if (C.t <= 1.6 && C.next === null) { C.next = C.a + (Math.random() < .5 ? 1 : -1) * rand(1.6, 2.6); Sound.play('splash'); }
    if (C.t <= 0) { C.a = C.next; C.next = null; C.t = b.phase >= 2 ? 6 : 8; }
    if (titanCommon(b, dt, 'The river floods', 'Stronger current, rising tides')) return;
    if (titanSummon(b, .6, ['triton', 'triton', 'crab', 'crab', 'crab'], 'Oceanus calls the deep')) return;
    b.flip = c.dx < 0; b.frame = null;
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 100, 38, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, P2 ? ['waves', 'whirl', 'geysers', 'tide', 'waves'] : ['waves', 'whirl', 'geysers', 'waves']);
          if (pick === 'waves') { b.state = 'waves'; b.st = .8; b.count = 2 + (b.phase >= 2 ? 1 : 0); Sound.play('telegraph'); }
          else if (pick === 'whirl') { b.state = 'whirl'; b.st = .6; }
          else if (pick === 'geysers') { b.state = 'geysers'; b.st = .5; }
          else { b.state = 'tide'; b.st = .6; }
        }
        break;
      case 'waves':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) { addRing(b.x, b.y, 140, 190, D(.16), '#57c2b0'); Sound.play('splash'); addShake(2); b.count--; if (b.count > 0) b.st = .5; else { b.state = 'recover'; b.st = .7; } }
        break;
      case 'whirl':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          q.hazards.push({ type: 'whirl', x: clamp(p.x, IPX.minX + 30, IPX.maxX - 30), y: clamp(p.y, IPX.minY + 30, IPX.maxY - 30), r: 58 + 6 * b.rank, t: 0, delay: .8, life: 4.5, max: 4.5, pull: 62 + 18 * b.rank, dps: .06, dmg: D(.06) });
          Sound.play('splash'); b.state = 'recover'; b.st = .8;
        }
        break;
      case 'geysers':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) { rainAround(aoeAt(p), (P2 ? 9 : 7) + 2 * b.rank, 15, .9, D(.17), 'geyser', 110); b.state = 'recover'; b.st = .9; }
        break;
      case 'tide': {                                               // walls of water roll across the arena, with gaps
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const horiz = Math.random() < .5, lanes = 7, gaps = new Set(shuffle([...Array(lanes).keys()]).slice(0, 2 + (b.rank >= 2 ? 0 : 1)));
          for (let i = 0; i < lanes; i++) {
            if (gaps.has(i)) continue;
            if (horiz) { const y = IPX.minY + 14 + i * ((IPX.maxY - IPX.minY - 28) / (lanes - 1)), right = Math.random() < .5;
              q.hazards.push({ type: 'lane', kind: 'wave', x0: right ? IPX.minX - 8 : IPX.maxX + 8, y0: y, x1: right ? IPX.maxX + 8 : IPX.minX - 8, y1: y, t: 0, delay: 1, dmg: D(.16), speed: 190 }); }
            else { const x = IPX.minX + 14 + i * ((IPX.maxX - IPX.minX - 28) / (lanes - 1)), down = Math.random() < .5;
              q.hazards.push({ type: 'lane', kind: 'wave', x0: x, y0: down ? IPX.minY - 8 : IPX.maxY + 8, x1: x, y1: down ? IPX.maxY + 8 : IPX.minY - 8, t: 0, delay: 1, dmg: D(.16), speed: 190 }); }
          }
          Sound.play('telegraph'); b.state = 'recover'; b.st = 1.2;
        }
        break;
      }
    }
    bossContact(b, D(.1));
  },

  /* ---- Coeus: aims where you're going. Dodging the same way twice gets read. ---- */
  coeus(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (titanCommon(b, dt, 'Coeus sees everything', 'Longer constellations, sharper predictions')) return;
    if (titanSummon(b, .6, ['chrono_wraith', 'chrono_wraith', 'sky_harpy', 'sky_harpy'], 'Coeus calls the watchers')) return;
    b.flip = c.dx < 0; b.frame = null; b.readT = Math.max(0, (b.readT || 0) - dt);
    const predict = lead => ({ x: clamp(p.x + p.vx * lead, IPX.minX + 10, IPX.maxX - 10), y: clamp(p.y + p.vy * lead, IPX.minY + 10, IPX.maxY - 10) });
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 115, 40, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, ['foresee', 'stars', 'lance', 'foresee']);
          if (pick === 'foresee') { b.state = 'foresee'; b.st = .45; b.count = 3 + b.rank + (b.readT > 0 ? 1 : 0); }
          else if (pick === 'stars') { b.state = 'stars'; b.st = .6; }
          else { b.state = 'lance'; b.st = .5; b.count = P2 ? 3 : 1; }
        }
        break;
      case 'foresee':                                              // each mark lands where you'll be, not where you are
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const t = predict(b.readT > 0 ? 1.25 : .9); addCircleHazard(t.x, t.y, 18, .95, D(.2), 'axis');
          Sound.play('telegraph'); b.count--;
          if (b.count > 0) b.st = .32; else { b.state = 'recover'; b.st = .9; }
        }
        break;
      case 'stars': {                                              // stars appear, then light joins them up
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const n = (P2 ? 6 : 5) + b.rank, pts = [];
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rand(-.3, .3), r = rand(40, 110); pts.push({ x: clamp(p.x + Math.cos(a) * r, IPX.minX + 8, IPX.maxX - 8), y: clamp(p.y + Math.sin(a) * r * .8, IPX.minY + 8, IPX.maxY - 8) }); }
          pts.forEach((s, i) => addCircleHazard(s.x, s.y, 6, 1.35, 0, 'star'));
          const links = P2 ? n : n - 1;
          for (let i = 0; i < links; i++) { const a = pts[i], z = pts[(i + 2) % n]; q.hazards.push({ type: 'lane', kind: 'bolt', col: '#e6f2ff', x0: a.x, y0: a.y, x1: z.x, y1: z.y, t: 0, delay: 1.4 + i * .1, dmg: D(.19) }); }
          Sound.play('charm'); b.state = 'recover'; b.st = 1.2;
        }
        break;
      }
      case 'lance':                                                // a line of light across the field, aimed ahead of you
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const t = predict(.6), base = Math.atan2(t.y - b.y, t.x - b.x);
          for (let i = 0; i < b.count; i++) { const a = base + (b.count > 1 ? (i - 1) * .32 : 0), len = 700; q.hazards.push({ type: 'lane', kind: 'bolt', col: '#9fd0ff', x0: b.x, y0: b.y, x1: b.x + Math.cos(a) * len, y1: b.y + Math.sin(a) * len, t: 0, delay: .75, dmg: D(.24) }); }
          Sound.play('telegraph'); b.state = 'recover'; b.st = 1;
        }
        break;
    }
    bossContact(b, D(.1));
  },

  /* ---- Mnemosyne: remembers your path and your swings, and sends echoes to repeat them. ---- */
  mnemosyne(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (titanCommon(b, dt, 'Mnemosyne remembers more', 'Two echoes at once, and she can call you back')) return;
    if (titanSummon(b, .6, ['chrono_wraith', 'chrono_wraith', 'shade', 'shade'], 'Mnemosyne calls the forgotten')) return;
    b.flip = c.dx < 0; b.frame = null;
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 120, 36, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, P2 ? ['echo', 'mist', 'orbs', 'echo', 'recall'] : ['echo', 'mist', 'orbs', 'echo']);
          if (pick === 'echo' && p.mem && p.mem.length > 30) { b.state = 'echo'; b.st = .9; Sound.play('charm'); }
          else if (pick === 'mist') { b.state = 'mist'; b.st = .5; }
          else if (pick === 'recall' && p.mem && p.mem.length > 30) { b.state = 'recall'; b.st = 1.15; b.recallFrom = G.time; Sound.play('telegraph'); }
          else { b.state = 'orbs'; b.st = .6; }
        }
        break;
      case 'echo':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const ago = P2 ? [3, 4.5] : [3]; if (b.rank >= 2) ago.push(6);
          for (const a of ago) q.ghosts.push({ from: G.time - a, clock: -.6, dur: 3, x: 0, y: 0, face: 0, dmg: D(.12), fired: new Set(), dead: false, cd: 0, who: p });   // echoes of the hunter she's after
          b.state = 'recover'; b.st = .8;
        }
        break;
      case 'mist':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) {
          const at = aoeAt(p);
          for (let i = 0; i < (P2 ? 6 : 4) + b.rank; i++) { const a = rand(0, Math.PI * 2), r = i === 0 ? 0 : rand(30, 110); addCircleHazard(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 18, .8 + i * .08, 0, 'lob', { puddle: 'lethe', life: 6, dps: .02, from: { x: b.x, y: b.y - 30 } }); }
          Sound.play('swing'); b.state = 'recover'; b.st = .7;
        }
        break;
      case 'orbs':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) { const n = 9 + b.rank * 2, off = rand(0, 1); for (let i = 0; i < n; i++) spawnProj(b.x, b.y - 16, off + i / n * Math.PI * 2, 70, D(.11), 'dream', 'enemy', { r: 3, life: 4.5, homing: .9, src: b }); Sound.play('ability'); b.state = 'recover'; b.st = .8; }
        break;
      case 'recall':                                               // she pulls you back to where you were a moment ago
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const back = memAt(G.time - 2.4, p);
          if (back && !p.dead) {
            q.fx.push({ t: 'after', frames: heroFrames(p.look), flip: Math.cos(p.face) < 0, x: p.x, y: p.y, life: .4, max: .4 });
            p.x = back.x; p.y = back.y; p.dodgeT = 0; p.dashT = 0; G.flash = .15; Sound.play('charm');
            addCircleHazard(p.x, p.y, 22, .75, D(.2), 'memory');
          }
          b.state = 'recover'; b.st = .9;
        }
        break;
    }
    bossContact(b, D(.1));
  },

  /* ---- Themis: lays down laws. Keep each one and she's left open; break it and judgment falls on you. ---- */
  themis(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (titanCommon(b, dt, 'Themis raises the scales', 'Laws come faster now')) return;
    if (titanSummon(b, .6, ['obsidian_guard', 'obsidian_guard', 'earthborn', 'earthborn'], 'Themis calls her bailiffs')) return;
    b.flip = c.dx < 0; b.frame = null;
    b.lawT = (b.lawT ?? 4) - dt;
    const L = b.law;
    if (L) {
      L.t -= dt;
      if (L.id === 'motion') for (const h of q.hunters) {           // every hunter has to keep moving (key 'still' for you)
        if (h.dead || !b.law) continue; const k = h.hid ? 'still' + h.hid : 'still';
        if (h.moving || h.dodgeT > 0) L[k] = 0; else { L[k] = (L[k] || 0) + dt; if (L[k] > 1) themisJudge(b, h); }
      }
      if (b.law && L.t <= 0) {                                     // the law was kept: her scales favour you
        b.law = null; b.lawT = P2 ? 7 : 9; b.label = null;
        banner('The law is kept', 'Themis is open. Strike her now'); Sound.play('blessing');
        titanStill(b); b.state = 'favor'; b.st = 1.8; setVuln(b, 1.25, 4); b.beams = null;
      }
    }
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 105, 38, dt); b.st -= dt;
        if (!b.law && b.lawT <= 0 && !p.dead) { b.state = 'proclaim'; b.st = .9; Sound.play('telegraph'); break; }
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, b.law ? ['waves', 'swords'] : ['dash', 'waves', 'swords', 'dash']);   // no lunges while a law is up
          if (pick === 'dash') { b.state = 'dashAim'; b.st = .75; b.count = (P2 ? 3 : 2) + (b.rank >= 2 ? 1 : 0); Sound.play('telegraph'); }
          else if (pick === 'waves') { b.state = 'waves'; b.st = .7; b.count = P2 ? 2 : 1; }
          else { b.state = 'swords'; b.st = .55; }
        }
        break;
      case 'proclaim': {
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const ids = Object.keys(LAWS).filter(k => k !== b.lastLaw), id = ids[(Math.random() * ids.length) | 0];
          b.lastLaw = id; b.law = { id, t: P2 ? 5.5 : 5, still: 0, count: 0 };
          banner(LAWS[id][0], LAWS[id][1], true); Sound.play('perfect');
          b.state = 'recover'; b.st = .6;
        }
        break;
      }
      case 'favor': titanStill(b); b.st -= dt; if (Math.random() < .3) burst(b.x, b.y - 30, 1, ['#e9c04f', '#ffffff'], 40); if (b.st <= 0) { b.state = 'idle'; b.st = .6; } break;
      case 'dashAim':
        titanStill(b); b.st -= dt;
        if (b.st > .3) { const a = Math.atan2(c.dy, c.dx); b.aim = a; b.flip = c.dx < 0; const len = raycast(b.x, b.y, a, 280, b.r + 2); b.dashEnd = { x: b.x + Math.cos(a) * len, y: b.y + Math.sin(a) * len }; }
        if (b.st <= 0) { b.state = 'dash'; b.hitDone = false; Sound.play('swing'); }
        break;
      case 'dash':
        q.fx.push({ t: 'after', spr: 'themis', flip: b.flip, x: b.x, y: b.y, life: .2, max: .2, gold: true, scale: TITAN_SCALE });
        if (dashTowardEnd(b, 330, D(.2))) { b.count--; dust(b.x, b.y, 8); if (b.count > 0) { b.state = 'dashAim'; b.st = .55; } else { b.state = 'recover'; b.st = .9; } }
        break;
      case 'waves':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) { addRing(b.x, b.y, 150, 170, D(.16), '#e9c04f'); Sound.play('thud'); b.count--; if (b.count > 0) b.st = .5; else { b.state = 'recover'; b.st = .7; } }
        break;
      case 'swords':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) { rainAround(aoeAt(p), (P2 ? 8 : 6) + 2 * b.rank, 14, .9, D(.17), 'judgment', 90); b.state = 'recover'; b.st = .9; }
        break;
    }
    if (b.law) { const Lw = LAWS[b.law.id]; b.label = `${Lw[0]}: ${Lw[1].toLowerCase()} · ${Math.ceil(b.law.t)}s`; }
    bossContact(b, D(.1));
  },

  /* ---- Rhea: hides among swaddled stones. Find the one that breathes; the others burst. ---- */
  rhea(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (b.state === 'hiding') { rheaHide(b, dt); return; }
    if (titanCommon(b, dt, 'Rhea stops playing', 'More bundles, faster shuffles')) return;
    b.flip = c.dx < 0; b.frame = null;
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 95, 40, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const lions = q.enemies.filter(e => !e.dead && e.type === 'lion').length;
          const pick = pickAttack(b, lions < 2 ? ['hide', 'lions', 'quake', 'stones', 'hide'] : ['hide', 'quake', 'stones', 'hide']);
          if (pick === 'hide') { b.state = 'wrap'; b.st = .8; Sound.play('charm'); }
          else if (pick === 'lions') { b.state = 'lions'; b.st = .8; Sound.play('roar'); }
          else if (pick === 'quake') { b.state = 'quake'; b.st = .85; Sound.play('telegraph'); }
          else { b.state = 'stones'; b.st = .5; }
        }
        break;
      case 'wrap':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) rheaStartHide(b, (P2 ? 6 : 4) + b.rank);
        break;
      case 'lions':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) { summonAround(b, ['lion', 'lion'], 'Rhea calls her lions'); b.state = 'recover'; b.st = .7; }
        break;
      case 'quake': titanStill(b); b.st -= dt; if (b.st <= 0) { quakeRings(b, D); b.state = 'recover'; b.st = 1.1; } break;
      case 'stones':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) { rainAround(aoeAt(p), (P2 ? 9 : 7) + 2 * b.rank, 15, 1, D(.17), 'stone', 110); b.state = 'recover'; b.st = .9; }
        break;
      case 'dazed': titanStill(b); b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = .5; } break;
    }
    bossContact(b, D(.1));
  },

  /* ---- Cronus: turns back time unless you break his hourglass. A sickle with a long reach. ---- */
  cronus(b, dt, c) {
    const p = b.tgt, P2 = b.phase >= 2 || b.rank >= 1, D = pct => tD(b, pct);
    if (titanCommon(b, dt, 'Cronus remembers his throne', 'The hourglass turns more often')) return;
    if (titanSummon(b, .6, ['chrono_wraith', 'chrono_wraith', 'chrono_wraith'], 'Cronus calls the hours')) return;
    b.flip = c.dx < 0; b.frame = null;
    // the hourglass
    b.hgT = (b.hgT ?? 5) - dt;
    if (b.hg) {
      b.hg.t -= dt;
      if (b.hg.t <= 0) {                                           // too slow: every wound from this hourglass heals
        const healed = Math.max(0, b.hg.hp0 - b.hp);
        b.hp = Math.max(b.hp, b.hg.hp0); b.x = b.hg.x; b.y = b.hg.y; b.hg = null; b.hgT = P2 ? 10 : 13;
        G.flash = .25; Sound.play('revive'); banner('Time turns back', healed ? `Cronus healed ${fmtMoney(healed)}` : 'Strike harder next time');
        for (let i = 0; i < 6; i++) q.fx.push({ t: 'after', spr: 'cronus', flip: b.flip, x: b.x + rand(-30, 30), y: b.y + rand(-20, 20), life: .5, max: .5, gold: true, scale: TITAN_SCALE });
      }
    } else if (b.hgT <= 0 && b.state === 'idle' && !p.dead) {
      b.hg = { t: P2 ? 6 : 7, max: P2 ? 6 : 7, need: b.maxHp * (.07 + .01 * b.rank), dealt: 0, hp0: b.hp, x: b.x, y: b.y };
      banner('Cronus turns the hourglass', 'Hit him hard before the sand runs out'); Sound.play('telegraph');
    }
    b.label = b.hg ? `Hourglass: ${Math.min(100, Math.round(b.hg.dealt / b.hg.need * 100))}% broken · ${Math.ceil(b.hg.t)}s` : null;
    switch (b.state) {
      case 'idle':
        titanWalk(b, c, 70, 42, dt); b.st -= dt;
        if (b.st <= 0 && !p.dead) {
          const pick = pickAttack(b, ['sweep', 'throw', 'blades', 'field', 'sweep']);
          if (pick === 'sweep') { b.state = 'sweepAim'; b.st = P2 ? .75 : .9; b.count = P2 ? 2 : 1; Sound.play('telegraph'); }
          else if (pick === 'throw') { b.state = 'throw'; b.st = .6; }
          else if (pick === 'blades') { b.state = 'blades'; b.st = .5; }
          else { b.state = 'field'; b.st = .5; }
        }
        break;
      case 'sweepAim':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st > .3) { b.aim = Math.atan2(c.dy, c.dx); b.flip = c.dx < 0; }
        if (b.st <= 0) {
          if (c.d > 64) { const step = Math.min(40, c.d - 48); moveEntity(b, Math.cos(b.aim) * step, Math.sin(b.aim) * step); }   // he steps into it
          q.fx.push({ t: 'sweep', x: b.x, y: b.y - 10, a: b.aim, r: 76, life: .2, max: .2 });
          for (const h of q.hunters) { const a = Math.atan2(h.y - b.y, h.x - b.x), d = Math.hypot(h.x - b.x, h.y - b.y); if (!h.dead && d < 78 && Math.abs(angDiff(b.aim, a)) < 1.15) hurtHunter(h, D(.27), a, 260, { src: b, melee: true }); }
          Sound.play('heavy'); addShake(3); b.count--;
          if (b.count > 0) { b.st = .55; } else { b.state = 'recover'; b.st = 1; }
        }
        break;
      case 'throw':
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const n = P2 ? 2 : 1;
          for (let i = 0; i < n; i++) spawnProj(b.x, b.y - 4, Math.atan2(c.dy, c.dx) + (n > 1 ? (i - .5) * .5 : 0), 230, D(.2), 'sickle', 'enemy', { r: 8, life: 3, src: b, ghost: true, boom: { t: .7, src: b } });
          b.sickleOut = true; Sound.play('swing'); b.state = 'recover'; b.st = 1.2;
        }
        break;
      case 'blades': {                                             // blades stop in the air around you, then all fly at once
        titanStill(b); b.st -= dt; b.frame = 2;
        if (b.st <= 0) {
          const n = 10 + 2 * b.rank, off = rand(0, 1);
          for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2, x = p.x + Math.cos(a) * 74, y = p.y + Math.sin(a) * 74 * .8; spawnProj(x, y, a + Math.PI, 0, D(.13), 'blade', 'enemy', { r: 3, life: 4, src: b, ghost: true, delay: 1.1, launch: 210 }); }
          Sound.play('perfect'); b.state = 'recover'; b.st = 1.1;
        }
        break;
      }
      case 'field':
        titanStill(b); b.st -= dt;
        if (b.st <= 0) { const at = aoeAt(p); for (let i = 0; i < (P2 ? 4 : 3) + b.rank; i++) { const a = rand(0, Math.PI * 2), r = i === 0 ? 10 : rand(40, 100); addPuddle(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 26, 7, 'time', 0); } Sound.play('charm'); b.state = 'recover'; b.st = .7; }
        break;
      case 'shattered': titanStill(b); b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = .5; } break;
    }
    bossContact(b, D(.1));
  },
};

/* ---- the parts of the Titan fights that run outside their think step ---- */
function themisJudge(b, p = b.tgt || q.player) {      // judgment falls on whoever broke the law
  if (!b.law) return;
  b.law = null; b.lawT = b.phase >= 2 || b.rank >= 1 ? 6 : 8; b.label = null;
  banner('Judgment', 'You broke the law', true); Sound.play('zap');
  const D = pct => tD(b, pct);
  addCircleHazard(p.x, p.y, 22, .5, D(.26), 'judgment');
  addCircleHazard(p.x + rand(-30, 30), p.y + rand(-20, 20), 22, .95, D(.2), 'judgment');
}
function memAt(t, who = q.player) {
  const m = who.mem; if (!m || !m.length || t < m[0].t) return m && m[0];
  for (let i = m.length - 1; i >= 0; i--) if (m[i].t <= t) { const a = m[i], z = m[i + 1] || a, k = z.t > a.t ? (t - a.t) / (z.t - a.t) : 0; return { x: lerp(a.x, z.x, k), y: lerp(a.y, z.y, k), face: a.face }; }
  return m[0];
}
function rheaStartHide(b, n) {
  b.state = 'hiding'; b.hidden = true; b.untargetable = true; b.vx = b.vy = 0; b.hideT = 9;
  const real = (Math.random() * n) | 0, cx = clamp(b.x, IPX.minX + 80, IPX.maxX - 80), cy = clamp(b.y, IPX.minY + 60, IPX.maxY - 60);
  b.decoys = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, e = makeEnemy('bundle', cx + Math.cos(a) * 20, cy + Math.sin(a) * 14, b.tier, 0);
    e.hp = e.maxHp = 1; e.real = i === real; e.rhea = b; e.st = .4; e.dmg = tD(b, .18);
    e.onDeath = rheaBundleBroken; e.tx = null;
    q.enemies.push(e); b.decoys.push(e);
  }
  b.shuffle = 1.4 + .3 * b.rank; b.label = 'Find the one that breathes';
  burst(cx, cy - 10, 20, ['#c9bda4', '#7fa548', '#ffffff'], 90); Sound.play('dodge');
}
function rheaHide(b, dt) {
  b.hideT -= dt; b.label = 'Find the one that breathes';
  if (b.shuffle > 0) {                                         // the bundles shuffle around before they settle
    b.shuffle -= dt;
    for (const e of b.decoys) if (!e.dead && (e.tx === null || Math.hypot(e.tx - e.x, e.ty - e.y) < 4)) { e.tx = clamp(e.x + rand(-90, 90), IPX.minX + 20, IPX.maxX - 20); e.ty = clamp(e.y + rand(-60, 60), IPX.minY + 20, IPX.maxY - 20); }
  } else for (const e of b.decoys) e.tx = null;
  const real = b.decoys.find(e => e.real && !e.dead);
  if (real) { b.x = real.x; b.y = real.y; }
  if (b.hideT <= 0 || !real) rheaReveal(b, false);
}
function rheaBundleBroken(e) {
  const b = e.rhea; if (!b || b.dead) return;
  if (e.real) { rheaReveal(b, true); return; }
  // a fake one bursts after a short fuse
  addCircleHazard(e.x, e.y, 30, .4, e.dmg, 'stone');
  burst(e.x, e.y - 6, 12, ['#c9bda4', '#8f846c'], 80);
}
function rheaReveal(b, found) {
  for (const e of b.decoys || []) if (!e.dead && e.real !== true) { e.dead = true; burst(e.x, e.y - 6, 8, ['#c9bda4', '#ffffff'], 60); if (!found) addCircleHazard(e.x, e.y, 30, .45, e.dmg, 'stone'); }
  for (const e of b.decoys || []) e.dead = true;
  b.decoys = []; b.hidden = false; b.untargetable = false; b.alpha = 1; b.label = null;
  burst(b.x, b.y - 20, 24, ['#7fa548', '#e9c04f', '#ffffff'], 100);
  if (found) { b.state = 'dazed'; b.st = 2.2; setVuln(b, 1.3, 3); banner('Found her', 'Rhea is dazed'); Sound.play('perfect'); }
  else { b.state = 'quake'; b.st = .5; banner('Rhea rises', 'Too slow'); Sound.play('roar'); }
}
// Runs every tick while a Titan fight is on: currents, memories, ghosts, laws.
// Mnemosyne remembers each hunter's own path and swings (q.mem and q.memAtk are yours).
function titanTick(b, dt) {
  if (b.type === 'typhon') typhonTick(b, dt);
  if (b.type === 'oceanus' && q.current && q.phase === 'boss') for (const p of q.hunters) if (!p.dead && p.dodgeT <= 0 && p.dashT <= 0) moveEntity(p, Math.cos(q.current.a) * q.current.s * dt, Math.sin(q.current.a) * q.current.s * dt);
  if (b.type === 'mnemosyne') {
    q.mem = q.mem || []; q.memAtk = q.memAtk || []; q.ghosts = q.ghosts || [];
    q.player.mem = q.mem; q.player.memAtk = q.memAtk;
    q.memT = (q.memT || 0) - dt;
    if (q.memT <= 0) { q.memT = .08; for (const p of q.hunters) { const m = p.mem = p.mem || []; m.push({ t: G.time, x: p.x, y: p.y, face: p.face }); if (m.length > 110) m.shift(); } }
    for (const p of q.hunters) { const A = p.memAtk = p.memAtk || []; while (A.length && A[0].t < G.time - 9) A.shift(); }
    for (const gh of q.ghosts) {
      const who = gh.who || q.player;
      gh.clock += dt; if (gh.clock < 0) { const s = memAt(gh.from, who); if (s) { gh.x = s.x; gh.y = s.y; gh.face = s.face; } continue; }
      const s = memAt(gh.from + gh.clock, who); if (s) { gh.x = s.x; gh.y = s.y; gh.face = s.face; }
      gh.cd -= dt;
      for (const atk of who.memAtk) {
        if (gh.fired.has(atk) || atk.t < gh.from || atk.t > gh.from + gh.clock) continue;
        gh.fired.add(atk); if (gh.cd > 0) continue; gh.cd = .3;             // an echo swings at most about three times a second
        q.fx.push({ t: 'slash', x: gh.x, y: gh.y - 5, a: atk.aim, life: .15, max: .15, col: '#c8b8ff' });
        for (const p of q.hunters) {                                        // it cuts anyone standing there
          const a = Math.atan2(p.y - gh.y, p.x - gh.x), d = Math.hypot(p.x - gh.x, p.y - gh.y);
          if (!p.dead && d < 26 && Math.abs(angDiff(atk.aim, a)) < 1.2) hurtHunter(p, gh.dmg, a, 160, {});
        }
      }
      if (gh.clock >= gh.dur) gh.dead = true;
    }
    q.ghosts = q.ghosts.filter(g => !g.dead);
  }
  if (b.type === 'cronus') for (const pr of q.projs) {
    if (pr.kind === 'sickle' && pr.boom && pr.t > pr.boom.t) {
      const s = pr.boom.src, a = Math.atan2(s.y - pr.y, s.x - pr.x), sp = Math.min(360, Math.hypot(pr.vx, pr.vy) + 300 * dt);
      pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; pr.life = Math.max(pr.life, .5);
      if (Math.hypot(s.x - pr.x, s.y - pr.y) < 16) { pr.dead = true; s.sickleOut = false; }
    }
  }
}
// What you do, for the Titans that care: Coeus reads your dodges, Mnemosyne remembers your swings, Themis judges both.
function titanAct(b, kind, p = q.player) {
  if (b.type === 'coeus' && kind === 'dodge') { b.dodges = (b.dodges || []).filter(t => t > G.time - 2.2); b.dodges.push(G.time); if (b.dodges.length >= 2 && !b.readT) { b.readT = 4; addText(b.x, b.y - b.h - 6, '!', '#e6f2ff'); } }
  if (b.type === 'mnemosyne' && (kind === 'attack' || kind === 'skill')) {
    if (p === q.player) (q.memAtk = q.memAtk || []).push({ t: G.time, aim: p.swing ? p.swing.aim : p.face });
    else (p.memAtk = p.memAtk || []).push({ t: G.time, aim: p.swing ? p.swing.aim : p.face });
  }
  if (b.type === 'themis' && b.law) {
    const L = b.law, k = p.hid ? 'count' + p.hid : 'count';      // each hunter's own strikes in a row
    if (L.id === 'stillness' && kind === 'dodge') themisJudge(b, p);
    else if (L.id === 'peace' && (kind === 'attack' || kind === 'skill')) themisJudge(b, p);
    else if (L.id === 'measure') { if (kind === 'attack') { L[k] = (L[k] || 0) + 1; if (L[k] > 3) themisJudge(b, p); } else L[k] = 0; }
  }
}
// Cronus' hourglass counts the damage you deal while it runs.
function titanOnHit(b, dmg) {
  if (b.type === 'cronus' && b.hg) {
    b.hg.dealt += dmg;
    if (b.hg.dealt >= b.hg.need) {
      b.hg = null; b.hgT = b.phase >= 2 ? 11 : 14; b.label = null;
      b.state = 'shattered'; b.st = 2.4; b.vx = b.vy = 0; setVuln(b, 1.25, 2.4);
      banner('The hourglass shatters', 'Cronus is stunned'); Sound.play('break'); G.flash = .15;
      burst(b.x, b.y - 112, 24, ['#e9c04f', '#fff6d8', '#8f6c1c'], 110);
    }
  }
}
