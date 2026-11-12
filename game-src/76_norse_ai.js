/* ============================== THE NORTH: the fights ============================== */
// The six gods use the shared boss engine (BOSS_AI.generic, 70_bosses.js) plus moves of their own: startBossAttack hands
// any move it doesn't know to NORSE_MOVES, and the generic state switch hands any state it doesn't know to NORSE_STATES.
// north2 (18b_norse.js) lists moves that only join a god's list at half health: God Rank already plays every move's harder
// form from the start, so this is how the North's gods still change at half health. Fenrir has a fight of his own.
const RAINBOW = ['#ff5a5a', '#ffb347', '#ffd463', '#7fe08a', '#57c2b0', '#5b9bd5', '#b48cff'];
const NORSE_MOVES = {
  bridge(b) { b.state = 'bridge'; b.st = .55; Sound.play('telegraph'); },
  cross(b) { b.state = 'cross'; b.st = .45; Sound.play('telegraph'); },
  gaze(b, c, P) { b.state = 'gaze'; b.st = .45; b.count = P.n || 5; Sound.play('telegraph'); },
  blinkstab(b, c, P) { b.state = 'stabOut'; b.st = .3; b.count = P.count || 1; Sound.play('dodge'); },
  decoys(b) { b.state = 'decoys'; b.st = .6; Sound.play('charm'); },
  ravens(b) { b.state = 'ravens'; b.st = .55; Sound.play('telegraph'); },
};
const NORSE_STATES = {
  // Heimdall's bridge, or Thor's lightning: lanes right across the floor, one of them through you. Stand between them.
  bridge(b, dt, c, P, dm) {
    b.vx = b.vy = 0; b.st -= dt; if (b.st > 0) return;
    const p = b.tgt, n = P.n || 3, vert = P.dir === 'v', span = vert ? IPX.maxX - IPX.minX : IPX.maxY - IPX.minY;
    const gap = Math.max(34, span / (n + 1.5)), at = vert ? p.x : p.y, lo = (vert ? IPX.minX : IPX.minY) + 12, hi = (vert ? IPX.maxX : IPX.maxY) - 12;
    const lanes = [clamp(at, lo, hi)];
    for (let i = 1; lanes.length < n && i < 12; i++) for (const s of [1, -1]) { const v = lanes[0] + s * i * gap; if (v > lo && v < hi && lanes.length < n) lanes.push(v); }
    lanes.forEach((v, i) => {
      const L = vert ? { x0: v, y0: IPX.minY, x1: v, y1: IPX.maxY } : { x0: IPX.minX, y0: v, x1: IPX.maxX, y1: v };
      q.hazards.push({ type: 'lane', kind: 'bolt', ...L, t: 0, delay: (P.delay || 1) + i * .12, dmg: dm(P.dmg), col: P.col || RAINBOW[i % RAINBOW.length] });
    });
    b.state = 'recover'; b.st = 1;
  },
  // Tyr: sword strokes along lines that all cross near your feet. Get out from where they meet.
  cross(b, dt, c, P, dm) {
    b.vx = b.vy = 0; b.st -= dt; if (b.st > 0) return;
    const p = b.tgt, n = P.n || 3, L = (P.len || 150) / 2, off = rand(0, Math.PI);
    for (let i = 0; i < n; i++) {
      const a = off + i / n * Math.PI, cx = p.x + rand(-1, 1) * (n > 3 ? 22 : 8), cy = p.y + rand(-1, 1) * (n > 3 ? 14 : 5);
      q.hazards.push({ type: 'lane', kind: 'bolt', fx: 'laneSlash', w: 7, x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L,
                       t: 0, delay: (P.delay || .85) + i * .1, dmg: dm(P.dmg), col: '#d5dbe5' });
    }
    Sound.play('swing'); b.state = 'recover'; b.st = .8;
  },
  // Heimdall at half health: strikes of light that keep landing where you're about to be. Keep moving.
  gaze(b, dt, c, P, dm) {
    b.vx = b.vy = 0; b.st -= dt; if (b.st > 0) return;
    const p = b.tgt; addCircleHazard(p.x + p.vx * .15, p.y + p.vy * .15, P.r || 13, .55, dm(P.dmg), 'judgment');
    b.count--; if (b.count > 0) b.st = P.gap || .32; else { b.state = 'recover'; b.st = .7; }
  },
  // Loki steps out of sight and comes back behind you. The green mark at your back is where.
  stabOut(b, dt, c, P, dm) {
    b.vx = b.vy = 0; b.st -= dt; b.alpha = Math.max(0, b.st / .3); if (b.st > 0) return;
    b.hidden = true; b.alpha = 0;
    const p = b.tgt, a = p.face + Math.PI, x = clamp(p.x + Math.cos(a) * 22, IPX.minX + 10, IPX.maxX - 10), y = clamp(p.y + Math.sin(a) * 22, IPX.minY + 10, IPX.maxY - 10);
    addCircleHazard(x, y, 18, .6, dm(P.dmg), 'lokistab', { then: h => { b.x = h.x; b.y = h.y; b.hidden = false; b.alpha = 1; burst(h.x, h.y - 10, 12, ['#7fe08a', '#e9c04f'], 90); } });
    b.state = 'stabWait'; b.st = .7;
  },
  stabWait(b, dt) {
    b.vx = b.vy = 0; b.st -= dt; if (b.st > 0) return;
    if (b.hidden) { b.hidden = false; b.alpha = 1; }             // (the mark went off without him: a guest's screen, or the hunt ended)
    b.count--; if (b.count > 0) { b.state = 'stabOut'; b.st = .3; } else { b.state = 'recover'; b.st = .8; }
  },
  // Loki's likenesses: they shoot, but one hit pops them. Then the real one is somewhere else.
  decoys(b, dt, c, P) {
    b.vx = b.vy = 0; b.st -= dt;
    if (Math.random() < .4) sc.parts.push({ x: b.x + rand(-8, 8), y: b.y - rand(6, 20), vx: 0, vy: -16, g: 0, life: .4, max: .4, c: '#7fe08a', s: 1 });
    if (b.st > 0) return;
    const live = q.enemies.filter(e => e.type === 'loki_image' && !e.dead).length, n = Math.max(0, Math.min(P.n || 3, 6 - live));
    for (let i = 0; i < n; i++) {
      const a = i / Math.max(1, n) * Math.PI * 2 + rand(0, 1), e = makeEnemy('loki_image', clamp(b.x + Math.cos(a) * 30, IPX.minX + 8, IPX.maxX - 8), clamp(b.y + Math.sin(a) * 30, IPX.minY + 8, IPX.maxY - 8));
      e.st = .4; q.enemies.push(e);
    }
    burst(b.x, b.y - 10, 16, ['#7fe08a', '#2f8a4a', '#e9c04f'], 90);
    b.state = 'blinkOut'; b.st = .35; Sound.play('dodge');
  },
  // Odin's ravens: they follow you, but they can't turn sharply. Dash sideways at the last moment.
  ravens(b, dt, c, P, dm) {
    b.vx = b.vy = 0; b.st -= dt; if (b.st > 0) return;
    const n = P.n || 2, base = Math.atan2(c.dy, c.dx);
    for (let i = 0; i < n; i++) { const a = base + (i % 2 ? 1 : -1) * (.8 + Math.floor(i / 2) * .5); spawnProj(b.x, b.y - 10, a, 115, dm(P.dmg), 'raven', 'enemy', { r: 4, life: 4.5, homing: 2.4, src: b, ghost: true }); }
    Sound.play('swing'); b.state = 'recover'; b.st = .7;
  },
};
// The six gods: the shared engine, and their half-health moves join the list once.
for (const g of NORSE_GODS) BOSS_AI[g.id] = (b, dt, c) => {
  if (b.phase >= 2 && !b.n2) { b.n2 = true; b.attacks = (b.attacks || b.def.attacks).concat(b.def.north2 || []); }
  BOSS_AI.generic(b, dt, c);
};

/* ---- Fenrir: bound, loose, then Ragnarök ---- */
// While Gleipnir holds he can't get past the ring of stones in the middle of Lyngvi: his bite stops at the ring, but his
// howl and his frost breath reach you anywhere. At 60% the ribbon snaps and he hunts you all over the island. At 25% he
// swallows the sun: the island goes dark, fire falls on whoever is still standing, and he lunges through it.
function fenrirRing() {                       // the middle of the stones and how far Gleipnir reaches, for whatever size the island is
  const st = q.obstacles.filter(o => o.kind === 'runestone'), n = st.length;
  return { cx: n ? st.reduce((a, o) => a + o.x, 0) / n : WORLD_W / 2, cy: n ? st.reduce((a, o) => a + o.y, 0) / n : WORLD_H / 2,
           rx: GLEIPNIR.rx * WORLD_W / 768, ry: GLEIPNIR.ry * WORLD_H / 480 };
}
function inRing(b, x, y) {
  const dx = x - b.gcx, dy = y - b.gcy, e = (dx / b.grx) ** 2 + (dy / b.gry) ** 2;
  if (e <= 1) return [x, y];
  const k = 1 / Math.sqrt(e); return [b.gcx + dx * k, b.gcy + dy * k];
}
const FENRIR_PACK = [{ at: .8, types: ['fenriswolf', 'fenriswolf', 'fenriswolf', 'fenriswolf'] }, { at: .45, types: ['garm', 'fenriswolf', 'fenriswolf'] }];
BOSS_AI.fenrir = (b, dt, c) => {
  const p = b.tgt, dm = pct => rawDmg(pct * b.dmgMul, b.tier);
  if (!b.grx) { const R = fenrirRing(); b.gcx = R.cx; b.gcy = R.cy; b.grx = R.rx; b.gry = R.ry; b.x = R.cx; b.y = R.cy; b.stage = 'bound'; b.h = SPR.fenrir[0].h * 2 + 2; b.fireT = 1.5; }
  if (bossCommon(b, dt)) return;
  const bound = b.stage === 'bound', rag = b.stage === 'ragnarok';
  if (bound) [b.x, b.y] = inRing(b, b.x, b.y);
  if (b.state === 'idle' && bound && b.hp <= b.maxHp * .6) {
    b.state = 'snap'; b.st = 1.5; b.invuln = 1.5; b.vx = b.vy = 0; Music.level(2);
    banner('Gleipnir snaps', 'Fenrir is loose', true); Sound.play('break'); Sound.play('roar'); addShake(8); burst(b.x, b.y - 12, 30, ['#e6f2ff', '#ffffff', '#9fd0ff'], 140);
    return;
  }
  if (b.state === 'idle' && b.stage === 'loose' && b.hp <= b.maxHp * .25) {
    b.state = 'eclipse'; b.st = 2; b.invuln = 2; b.vx = b.vy = 0; Music.level(3); q.night = true; q.ragnarok = true; G.flash = .3;
    banner('The sun goes dark', 'Ragnarök. Don’t stop moving', true); Sound.play('roar'); addShake(10);
    return;
  }
  if (b.summons < FENRIR_PACK.length && b.hp <= b.maxHp * FENRIR_PACK[b.summons].at && b.state === 'idle') { b.summonTypes = FENRIR_PACK[b.summons].types; b.summons++; b.state = 'summon'; b.st = .8; Sound.play('roar'); return; }
  if (rag) {                                                    // fire falls near whoever is still standing
    b.fireT -= dt;
    if (b.fireT <= 0) { b.fireT = rand(.4, .7); const up = q.hunters.filter(h => !h.dead), h = up[(Math.random() * up.length) | 0] || p; addCircleHazard(h.x + rand(-50, 50), h.y + rand(-34, 34), 16, 1.1, dm(.13), 'etna', { small: true }); }
  }
  if (!/Aim$/.test(b.state) && !['bite', 'charge', 'devour'].includes(b.state)) b.flip = c.dx < 0;
  switch (b.state) {
    case 'snap': b.st -= dt; if (b.st <= 0) { b.stage = 'loose'; b.state = 'idle'; b.st = .5; } break;
    case 'eclipse': b.st -= dt; if (Math.random() < .6) burst(b.x, b.y - 14, 2, ['#ff5a3c', '#ffd463', '#2a2a34'], 120); if (b.st <= 0) { b.stage = 'ragnarok'; b.state = 'idle'; b.st = .4; } break;
    case 'summon': b.vx = b.vy = 0; b.st -= dt; if (b.st <= 0) { summonAround(b, b.summonTypes, 'Fenrir calls his pack'); b.state = 'idle'; b.st = .9; } break;
    case 'idle': {
      const sp = bound ? 46 : rag ? 74 : 66, want = bound ? 0 : 54;
      const mx = c.ux * clamp((c.d - want) / 40, -1, 1) - c.uy * b.orbit * .6, my = c.uy * clamp((c.d - want) / 40, -1, 1) + c.ux * b.orbit * .6, m = Math.hypot(mx, my) || 1;
      b.vx = mx / m * sp; b.vy = my / m * sp; if (Math.random() < dt * .3) b.orbit *= -1;
      b.st -= dt;
      if (b.st <= 0 && !p.dead) {
        const id = pickAttack(b, bound ? ['bite', 'bite', 'howl', 'frost', 'claw'] : rag ? ['pounce', 'charge', 'devour', 'devour', 'howl', 'frost'] : ['pounce', 'pounce', 'charge', 'howl', 'frost', 'claw']);
        if (id === 'bite') { b.state = 'biteAim'; b.st = .6; Sound.play('telegraph'); }
        else if (id === 'howl') { b.state = 'howl'; b.st = .7; b.count = bound ? 1 : 2; Sound.play('telegraph'); }
        else if (id === 'frost') { b.state = 'frost'; b.st = .55; b.count = bound ? 1 : 2; }
        else if (id === 'claw') { b.state = 'claw'; b.st = .5; Sound.play('telegraph'); }
        else if (id === 'pounce') { b.state = 'pounceAim'; b.st = .6; b.count = rag ? 3 : 2; Sound.play('telegraph'); }
        else if (id === 'charge') { b.state = 'chargeAim'; b.st = .7; b.count = 2; Sound.play('telegraph'); }
        else { b.state = 'devourAim'; b.st = .85; Sound.play('telegraph'); }
      }
      break;
    }
    case 'recover': b.vx = b.vy = 0; b.st -= dt; if (b.st <= 0) { b.state = 'idle'; b.st = bound ? .8 : rag ? .4 : .55; } break;
    // a lunge along the marked line: the bite stops at Gleipnir's reach; loose, he charges, and in Ragnarök he leaves fire behind
    case 'biteAim': case 'chargeAim': case 'devourAim': {
      b.vx = b.vy = 0; b.st -= dt;
      if (b.st > .3) {
        const a = Math.atan2(c.dy, c.dx), len = raycast(b.x, b.y, a, b.state === 'biteAim' ? Math.min(c.d + 24, 160) : 300, b.r + 2);
        let ex = b.x + Math.cos(a) * len, ey = b.y + Math.sin(a) * len;
        if (bound) [ex, ey] = inRing(b, ex, ey);
        b.aim = a; b.dashEnd = { x: ex, y: ey }; b.flip = Math.cos(a) < 0;
      }
      if (b.st <= 0) { b.state = b.state === 'biteAim' ? 'bite' : b.state === 'chargeAim' ? 'charge' : 'devour'; b.hitDone = false; b.trailD = 0; Sound.play('pounce'); }
      break;
    }
    case 'bite': case 'charge': case 'devour': {
      const was = b.state, sp = was === 'bite' ? 330 : was === 'charge' ? 360 : 400;
      q.fx.push({ t: 'after', spr: 'fenrir', flip: b.flip, x: b.x, y: b.y, life: .2, max: .2, gold: was === 'devour', scale: 2 });
      if (was === 'devour') { b.trailD += sp * dt; if (b.trailD > 22) { b.trailD = 0; addPuddle(b.x, b.y, 11, 3.5, 'lava', .03); } }
      if (dashTowardEnd(b, sp, dm(was === 'devour' ? .26 : .2))) {
        dust(b.x, b.y, 8); b.dashEnd = null;
        if (was === 'charge' && --b.count > 0) { b.state = 'chargeAim'; b.st = .5; }
        else { b.state = 'recover'; b.st = was === 'bite' ? .7 : .9; }
      }
      break;
    }
    case 'howl':
      b.vx = b.vy = 0; b.st -= dt;
      if (b.st <= 0) { addRing(b.x, b.y, 150, 230, dm(.15), '#9fd0ff'); Sound.play('roar'); addShake(3); if (--b.count > 0) b.st = .5; else { b.state = 'recover'; b.st = .6; } }
      break;
    case 'frost':
      b.vx = b.vy = 0; b.st -= dt;
      if (b.st <= 0) {
        const base = Math.atan2(c.dy, c.dx);
        for (let i = 0; i < 7; i++) spawnProj(b.x, b.y - 8, base + (i / 6 - .5) * 1.1, 150, dm(.1), 'frost', 'enemy', { r: 3, life: 3, src: b });
        Sound.play('shoot'); if (--b.count > 0) b.st = .4; else { b.state = 'recover'; b.st = .6; }
      }
      break;
    case 'claw':
      b.vx = b.vy = 0; b.st -= dt;
      if (b.st <= 0) { const a = Math.atan2(c.dy, c.dx); for (let i = -2; i <= 2; i++) addCircleHazard(b.x + Math.cos(a + i * .45) * 30, b.y + Math.sin(a + i * .45) * 30, 13, .45 + Math.abs(i) * .05, dm(.17), 'claw'); Sound.play('swing'); b.state = 'recover'; b.st = .75; }
      break;
    case 'pounceAim':
      b.vx = b.vy = 0; b.st -= dt;
      if (b.st > .3) { b.tx = clamp(p.x, IPX.minX + 14, IPX.maxX - 14); b.ty = clamp(p.y, IPX.minY + 14, IPX.maxY - 14); }
      if (b.st <= 0) { b.state = 'pounce'; b.st = .5; b.sx = b.x; b.sy = b.y; b.air = true; Sound.play('pounce'); }
      break;
    case 'pounce': {
      b.vx = b.vy = 0; b.st -= dt; const k = 1 - Math.max(0, b.st / .5);
      b.x = lerp(b.sx, b.tx, k); b.y = lerp(b.sy, b.ty, k); b.z = Math.sin(k * Math.PI) * 44;
      if (b.st <= 0) {
        b.air = false; b.z = 0; addShake(6); Sound.play('thud'); dust(b.x, b.y, 16);
        q.fx.push({ t: 'ring', x: b.x, y: b.y, r0: 4, r1: 30, life: .3, max: .3, c: '#9fd0ff' });
        for (const h of q.hunters) if (!h.dead && dist(b, h) < 30 + h.r) hurtHunter(h, dm(.2), Math.atan2(h.y - b.y, h.x - b.x), 260, { unblockable: true, src: b });
        if (--b.count > 0) { b.state = 'pounceAim'; b.st = .42; } else { b.state = 'recover'; b.st = .8; }
      }
      break;
    }
  }
  bossContact(b, dm(.1));
};
