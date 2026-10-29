/* ============================== COMBAT =================================== */
// Everything your gear adds up to: four armor pieces, their set bonuses, weapon and shield.
function setCounts(eq) { const c = {}; for (const sl of SLOTS) c[eq[sl]] = (c[eq[sl]] || 0) + 1; return c; }
function playerStats(save = G.save) {
  // refined gear (+1 to +5 at the smith) works from a copy with the bigger numbers and the + in its name
  const w0 = WEAPONS[save.weapon], wl = refineLevel(save.weapon, save), K = KINDS[w0.kind], eq = save.equip;
  const w = wl ? { ...w0, dmg: Math.round(w0.dmg * (1 + REFINE_GAIN.weapon * wl)), name: `${w0.name} +${wl}`, refine: wl } : w0;
  let def = 0, hp = 0; const perks = {};
  const add = (k, v) => { perks[k] = (perks[k] || 0) + v; };
  for (const sl of SLOTS) {
    const P = PIECES[eq[sl] + ':' + sl], rl = refineLevel(eq[sl], save); def += Math.round(P.def * (1 + REFINE_GAIN.armor * rl)); hp += Math.round(P.hp * (1 + .04 * rl));
    for (const [k, v] of Object.entries(P.job)) if (v) add(k, v);
  }
  const bonuses = [];
  for (const [sid, n] of Object.entries(setCounts(eq))) {
    const set = ARMOR_SETS[sid];
    if (set.two && n >= 2) { for (const [k, v] of Object.entries(set.two)) add(k, v); bonuses.push({ set: sid, n: 2 }); }
    if (set.four && n >= 4) { for (const [k, v] of Object.entries(set.four)) add(k, v); bonuses.push({ set: sid, n: 4 }); }
  }
  def += perks.def || 0; hp += perks.hp || 0;
  const sh0 = save.shield && K.oneHand ? SHIELDS[save.shield] : null, shl = sh0 ? refineLevel(save.shield, save) : 0;
  const shield = shl ? { ...sh0, meter: Math.round(sh0.meter * (1 + REFINE_GAIN.shield * shl)), block: Math.min(.97, sh0.block + .01 * shl) } : sh0;
  return {
    weapon: w, kind: K, shield, perks, bonuses, maxHp: 100 + hp, def, doubleDash: PIECES[eq.feet + ':feet'].perk === 'doubleDash',
    mul: 1 + (perks.dmg || 0) + (w.kind === 'bow' ? perks.bowDmg || 0 : 0),
    projRes: Math.min(.6, perks.projRes || 0), kbRes: perks.unflinching ? 1 : Math.min(.6, perks.kbRes || 0),
    speed: 80 * (1 + (perks.speed || 0)),
    dodgeCd: Math.max(.3, .6 * (1 - (perks.dodgeCd || 0))) + (shield ? shield.weight : 0),
    dodgeDist: 1 + (perks.dodgeDist || 0), abilityCd: Math.min(.5, perks.abilityCd || 0),
    guardMax: shield ? shield.meter * 10 * (1 + (perks.guard || 0)) : 0,
  };
}
function makePlayer(save = G.save) {
  const st = playerStats(save);
  const [sx, sy] = playerStart();
  return { x: tc(sx), y: tc(sy), r: 4, st, hp: st.maxHp, face: -Math.PI / 2, vx: 0, vy: 0, kbx: 0, kby: 0,
           invuln: 0, flash: 0, atkCd: 0, dodgeCd: 0, dashes: st.doubleDash ? 2 : 1, abilCd: 0, dodgeT: 0, dashT: 0, aegisT: 0, dvx: 0, dvy: 0, swing: null, swingSide: 1,
           bufAtk: 0, bufDodge: 0, bufAbil: 0, bufMouse: false, walkT: 0, moving: false, dead: false, dashHit: new Set(),
           guarding: false, guard: st.guardMax, guardDelay: 0, guardBreak: 0, guardPress: 0, guardTapCd: 0, guardFlash: 0,
           fx: { heavy: 0, echo: 0, foresight: 0, slow: 0, confuse: 0, charm: 0, sleep: 0, drowsy: 0, poison: 0, burn: 0, frenzy: 0, heart: 0, spin: 0, killRush: 0, strike: 0, riposte: 0, str: 0, spd: 0 },
           charmFrom: null, spinTicks: 0, hits: 0, regenAcc: 0, revived: false, look: { ...save.equip },
           shieldT: 0, blockKick: 0, bashT: 0, bashCd: 0, comboT: 0, potionCd: 0,
           wardT: 0, lastStandUsed: false, recent: [], echoes: [], flurryT: 0, flurryAcc: 0, foresightN: 0, strikes: 0 };
}
function moveVector() {
  let x = 0, y = 0;
  if (Input.is('left')) x -= 1; if (Input.is('right')) x += 1; if (Input.is('up')) y -= 1; if (Input.is('down')) y += 1;
  if (Input.stick.x || Input.stick.y) { x = Input.stick.x; y = Input.stick.y; }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  return { x, y };
}
function targetable(e) { return !e.dead && e.state !== 'spawn' && !e.hidden && !e.air && !e.untargetable; }
// Titans are tall: anything that touches their body counts, not only their feet. body = how tall the hit area is.
function bodyPt(e, x, y) { return e.body ? { x: e.x, y: clamp(y, e.y - e.body, e.y) } : e; }
function edist(a, e) { const b = bodyPt(e, a.x, a.y); return Math.hypot(a.x - b.x, a.y - b.y); }
function eang(a, e) { const b = bodyPt(e, a.x, a.y); return Math.atan2(b.y - a.y, b.x - a.x); }
function mouseAim(p) { return Math.atan2(p.in.wy - (p.y - 6), p.in.wx - p.x); }   // in.wx/wy: where the mouse points in the world
function aimAssist(p, aim, K) {
  let best = null, bestScore = 1e9;
  const range = K.melee ? K.reach + 16 : 220, cone = K.melee ? 1.2 : .45;
  for (const e of q.enemies) {
    if (!targetable(e)) continue;
    const d = edist(p, e); if (d - e.r > range) continue;
    const a = eang(p, e), ad = Math.abs(angDiff(aim, a)); if (ad > cone) continue;
    const score = ad * 40 + d; if (score < bestScore) { bestScore = score; best = a; }
  }
  return best === null ? aim : best;
}
// Auto-aim: keyboard attacks turn toward the closest enemy in range, so you never need the touchpad to aim.
function autoTarget(p, range) {
  let best = null, bd = 1e9;
  for (const e of q.enemies) {
    if (!targetable(e)) continue;
    const d = edist(p, e) - e.r;
    if (d < range && d < bd) { bd = d; best = eang(p, e); }
  }
  return best;
}
const tierNow = () => q ? q.def.mt : 1;
function healHunter(p, n, show = true) {
  const before = p.hp; p.hp = Math.min(p.st.maxHp, p.hp + n);
  const got = Math.round(p.hp - before);
  if (show && got > 0) addText(p.x, p.y - 18, '+' + got, '#9bbb55');
  return got;
}
const healPlayer = (n, show = true) => healHunter(q.player, n, show);
// One step for one hunter. Everything it does comes from p.in (its controls this step), never straight from the keyboard.
function updateHunter(p, dt) {
  const st = p.st, K = st.kind, F = p.fx, I = p.in, me = isLocal(p);
  p.invuln = Math.max(0, p.invuln - dt); p.flash = Math.max(0, p.flash - dt); p.aegisT = Math.max(0, p.aegisT - dt);
  p.atkCd = Math.max(0, p.atkCd - dt); tickDashes(p, dt); p.abilCd = Math.max(0, p.abilCd - dt);
  p.guardPress = Math.max(0, p.guardPress - dt); p.guardTapCd = Math.max(0, p.guardTapCd - dt); p.guardFlash = Math.max(0, p.guardFlash - dt);
  p.blockKick = Math.max(0, p.blockKick - dt); p.bashT = Math.max(0, p.bashT - dt); p.bashCd = Math.max(0, p.bashCd - dt); p.comboT = Math.max(0, p.comboT - dt); p.potionCd = Math.max(0, p.potionCd - dt);
  p.shieldT = clamp(p.shieldT + (p.guarding ? dt / .08 : -dt / .12), 0, 1);
  for (const k in F) F[k] = Math.max(0, F[k] - dt);
  const decay = Math.pow(.0006, dt); p.kbx *= decay; p.kby *= decay;
  if (p.dead) return;
  if (st.perks.ward && p.wardT > 0) { p.wardT -= dt; if (p.wardT <= 0) { burst(p.x, p.y - 8, 8, ['#e6f2ff', '#5b9bd5'], 50); Sound.play('block'); } }
  // Echo: a ghost of you repeats each swing a moment later. Flurry: a quick run of stabs.
  for (const ec of p.echoes) { ec.t -= dt; if (ec.t <= 0) { meleeHit(p, ec.aim, ec.dmg, false, true); q.fx.push({ t: 'after', frames: heroFrames(p.look), flip: Math.cos(ec.aim) < 0, x: p.x - Math.cos(ec.aim) * 4, y: p.y, life: .3, max: .3 }); } }
  p.echoes = p.echoes.filter(ec => ec.t > 0);
  if (p.flurryT > 0) {
    p.flurryT -= dt; p.flurryAcc += dt;
    while (p.flurryAcc >= .05) { p.flurryAcc -= .05; const a = p.face + rand(-.35, .35); meleeHit(p, a, st.weapon.dmg * dmgMul(p) * .45, false, true, { reach: 24, arc: 1.4, knock: 30 }); q.fx.push({ t: 'slash', x: p.x + Math.cos(a) * 6, y: p.y - 6 + Math.sin(a) * 4, a, life: .1, max: .1 }); Sound.play('swing'); }
  }
  // health over time: set regen, poison and burns
  if (st.perks.regen && q.phase !== 'victory') { p.regenAcc += st.perks.regen * dt; if (p.regenAcc >= 1) { const n = Math.floor(p.regenAcc); p.regenAcc -= n; healHunter(p, n, false); } }
  if (F.poison > 0 || F.burn > 0) { p.dotAcc = (p.dotAcc || 0) + dt * st.maxHp * (F.burn > 0 ? .03 : .02); if (p.dotAcc >= 1) { const n = Math.floor(p.dotAcc); p.dotAcc -= n; tickDamage(n, p); if (p.dead) return; } }
  // guard meter
  if (st.shield) {
    if (p.guardBreak > 0) { p.guardBreak -= dt; if (p.guardBreak <= 0) p.guard = st.guardMax * .4; }
    else if (!p.guarding) { p.guardDelay -= dt; if (p.guardDelay <= 0) p.guard = Math.min(st.guardMax, p.guard + st.guardMax * .35 * dt); }
  }
  if (I.atk) { p.bufAtk = .16; p.bufMouse = I.mouseAtk; }
  if (I.dodge) p.bufDodge = .16;
  if (I.abil) p.bufAbil = .16;
  if (I.dodge && q.onPlayerAct) q.onPlayerAct('dodge', p);
  if (p.bufAtk <= 0 && (I.atkHeld || I.mouseHeld)) { p.bufAtk = .02; p.bufMouse = I.mouseHeld; }
  const dashing = p.dodgeT > 0 || p.dashT > 0, winding = p.swing && !p.swing.fired;
  if (!dashing) { p.bufAtk -= dt; p.bufAbil -= dt; }
  if (!winding) p.bufDodge -= dt;
  for (const id of I.pots) drinkPotion(id, p);
  let mv = { x: I.mx, y: I.my };
  if (F.confuse > 0) mv = { x: -mv.x, y: -mv.y };
  // asleep or guard broken: you can't do anything until it passes
  if (F.sleep > 0 || p.guardBreak > 0) { p.guarding = false; p.swing = null; p.moving = false; moveEntity(p, p.kbx * dt, p.kby * dt); if (I.atk || I.dodge) F.sleep = Math.max(0, F.sleep - .15); return; }
  if (p.dodgeT > 0) {
    p.dodgeT -= dt; moveEntity(p, p.dvx * dt, p.dvy * dt);
    if (st.perks.dashDodge) dashCuts(p, .6);
    if (Math.random() < .5) dust(p.x, p.y, 1);
    if (p.dodgeT <= 0 && st.perks.dodgeStrike) F.strike = 1;
    return;
  }
  if (p.dashT > 0) {
    p.dashT -= dt; moveEntity(p, p.dvx * dt, p.dvy * dt);
    dashCuts(p, p.dashMult || 2.6);
    q.fx.push({ t: 'after', frames: heroFrames(p.look), flip: Math.cos(p.face) < 0, x: p.x, y: p.y, life: .22, max: .22 });
    if (Math.random() < .5) q.parts.push({ x: p.x + rand(-4, 4), y: p.y - rand(2, 12), vx: rand(-20, 20), vy: rand(-30, 0), life: .5, max: .5, c: '#f3e9d4', s: 1 });
    return;
  }
  // charmed: your feet carry you toward whoever charmed you. Dashing breaks it.
  if (F.charm > 0 && p.charmFrom) {
    if (p.bufDodge > 0 && canDash(p)) { F.charm = 0; startDodge(p, mv); p.bufDodge = 0; return; }
    const a = Math.atan2(p.charmFrom.y - p.y, p.charmFrom.x - p.x);
    p.face = a; p.moving = true; p.walkT += dt; p.guarding = false; p.swing = null;
    moveEntity(p, Math.cos(a) * 44 * dt + p.kbx * dt, Math.sin(a) * 44 * dt + p.kby * dt);
    return;
  }
  // guard (needs a shield and a one-handed weapon)
  const wantGuard = !!st.shield && I.guardHeld && !p.swing;
  if (st.shield && I.guard && p.guardTapCd <= 0) { p.guardPress = .2; p.guardTapCd = .55; }
  p.guarding = wantGuard;
  if (p.guarding) {
    const t = I.autoAim ? autoTarget(p, 160) : null;
    if (t !== null) p.face = t; else if (mv.x || mv.y) p.face = Math.atan2(mv.y, mv.x);
    p.guardDelay = .8;
  }
  if (!p.swing && !p.guarding) {
    if (p.bufDodge > 0 && canDash(p)) { startDodge(p, mv); p.bufDodge = 0; return; }
    if (p.bufAbil > 0 && p.abilCd <= 0 && st.weapon.ability) { useAbility(p, mv); p.bufAbil = 0; return; }
    if (p.bufAtk > 0 && p.atkCd <= 0) { startAttack(p); p.bufAtk = 0; }
  } else if (p.guarding && p.bufDodge > 0 && canDash(p)) { p.guarding = false; startDodge(p, mv); p.bufDodge = 0; return; }
  else if (p.guarding && p.bufAtk > 0 && p.bashCd <= 0) { shieldBash(p); p.bufAtk = 0; }
  else if (p.swing && p.bufDodge > 0 && canDash(p) && p.swing.t >= p.swing.windup) { p.swing = null; startDodge(p, mv); p.bufDodge = 0; return; }
  let spd = st.speed * (p.swing ? K.moveMul : 1) * (p.guarding ? .65 : 1) * (F.slow > 0 ? (F.heavy > 0 ? .45 : .6) : 1);
  p.vx = mv.x * spd; p.vy = mv.y * spd;
  p.moving = !!(mv.x || mv.y);
  if (p.moving) { if (!p.swing && !p.guarding) p.face = Math.atan2(mv.y, mv.x); p.walkT += dt; }
  moveEntity(p, (p.vx + p.kbx) * dt, (p.vy + p.kby) * dt);
  if (p.swing) {
    const s = p.swing; s.t += dt;
    if (!s.fired && s.t >= s.windup) { s.fired = true; releaseAttack(p, s); }
    if (s.t >= s.windup + s.active) p.swing = null;
  }
  if (F.spin > 0) {                                     // Whirlwind keeps spinning while you move
    const ticks = 3 - Math.ceil(F.spin / .2);
    while (p.spinTicks < ticks + 1 && p.spinTicks < 3) { p.spinTicks++; spinHit(p); }
  }
}
function dashCuts(p, mult) {
  for (const e of q.enemies) {
    if (!targetable(e) || p.dashHit.has(e.id)) continue;
    if (edist(p, e) < e.r + p.r + 9) { p.dashHit.add(e.id); damageEnemy(e, p.st.weapon.dmg * mult * dmgMul(p), Math.atan2(p.dvy, p.dvx), 160); if (isLocal(p)) G.hitstop = Math.max(G.hitstop, .03); }
  }
}
// Shield bash: attack while guarding to shove whatever is in front of you.
function shieldBash(p) {
  p.bashT = .2; p.bashCd = .6; p.guard = Math.max(0, p.guard - p.st.guardMax * .06);
  Sound.play('guard'); const W = p.st.weapon.dmg * dmgMul(p);
  let hit = 0;
  for (const e of q.enemies) {
    if (!targetable(e)) continue;
    const d = edist(p, e), a = eang(p, e);
    if (d - e.r > 20 || Math.abs(angDiff(p.face, a)) > .9) continue;
    damageEnemy(e, W * .4, a, 230, true); if (!e.boss && !e.dead) e.stun = Math.max(e.stun, .5); hit++;
  }
  if (hit) { if (isLocal(p)) { G.hitstop = Math.max(G.hitstop, .05); addShake(2); } burst(p.x + Math.cos(p.face) * 9, p.y - 7, 6, ['#ebc152', '#fff6d8'], 70); }
}
// Potions bought at the market. Keys 1, 2 and 3 by default, or tap them at the top of the screen.
function drinkPotion(id, p = q && q.player) {
  const s = p && p.save || G.save, P = POTIONS[id];
  if (!p || p.dead || q.phase === 'victory' || p.potionCd > 0) return;
  if (!(s.potions[id] > 0)) { Sound.play('clink'); return; }
  if (id === 'health' && p.hp >= p.st.maxHp) { addText(p.x, p.y - 20, '+0', '#9bbb55'); return; }
  s.potions[id]--; p.potionCd = .4; Sound.play(id === 'health' ? 'heal' : 'ability');
  if (id === 'health') healHunter(p, Math.round(p.st.maxHp * .4));
  else if (id === 'strength') p.fx.str = 60;
  else { const had = maxDashes(p); p.fx.spd = 60; if (maxDashes(p) > had) p.dashes = Math.min(2, p.dashes + 1); }   // the second dash is ready right away
  burst(p.x, p.y - 8, 12, [P.col[0], P.col[2]], 60);
  p.stats.potions = (p.stats.potions || 0) + 1;
}
function dmgMul(p) {
  let m = p.st.mul * (p.fx.str > 0 ? 1.25 : 1);
  if (p.st.perks.berserk && p.hp < p.st.maxHp * .4) m *= 1 + p.st.perks.berserk;
  return m;
}
function startAttack(p) {
  const K = p.st.kind;
  let aim;
  if (p.bufMouse) aim = aimAssist(p, mouseAim(p), K);
  else if (p.in.autoAim) { const t = autoTarget(p, K.melee ? K.reach + 26 : 215); aim = t === null ? aimAssist(p, p.face, K) : t; }
  else aim = aimAssist(p, p.face, K);
  p.face = aim; p.swingSide = -p.swingSide;
  const fast = (p.fx.frenzy > 0 ? .71 : 1) * (p.fx.killRush > 0 ? .77 : 1);
  p.swing = { t: 0, windup: K.windup * fast, active: K.active, aim, fired: false, side: p.swingSide };
  p.atkCd = K.cooldown * fast;
}
function releaseAttack(p, s) {
  const K = p.st.kind, w = p.st.weapon;
  let dmg = w.dmg * dmgMul(p);
  if (p.fx.strike > 0) { dmg *= 1 + p.st.perks.dodgeStrike; p.fx.strike = 0; }
  const riposte = p.fx.riposte > 0; if (riposte) { dmg *= 2; p.fx.riposte = 0; }
  if (K.melee && p.comboT > 0) dmg *= 1.12;                 // melee follow-up: chained hits land harder
  Sound.play(K.sfx);
  p.strikes++; if (q.onPlayerAct) q.onPlayerAct('attack', p);
  if (p.fx.echo > 0) p.echoes.push({ t: .32, aim: s.aim, dmg: dmg * .45 });
  if (!K.melee) { spawnProj(p.x + Math.cos(s.aim) * 6, p.y + Math.sin(s.aim) * 6, s.aim, K.projSpeed, dmg, 'arrow', 'player', { r: 2.5, life: .95, pierce: w.pierce || 0 }); return; }
  const hits = meleeHit(p, s.aim, dmg, riposte);
  if (hits) p.comboT = .8;
  if (riposte && hits) { burst(p.x + Math.cos(s.aim) * 12, p.y - 6 + Math.sin(s.aim) * 8, 10, ['#ffffff', '#ebc152'], 90); if (isLocal(p)) addShake(2); }
  if (w.kind === 'hammer') { q.fx.push({ t: 'ring', x: p.x + Math.cos(s.aim) * 15, y: p.y + Math.sin(s.aim) * 15, r0: 2, r1: 14, life: .22, max: .22, c: '#d8ccb4' }); dust(p.x + Math.cos(s.aim) * 15, p.y + Math.sin(s.aim) * 15, 6); if (isLocal(p)) addShake(2); }
}
// One melee swing's worth of hits in an arc. Used by attacks, echoes and the flurry.
function meleeHit(p, aim, dmg, riposte = false, quiet = false, o = {}) {
  const K = p.st.kind, reach = o.reach || K.reach || 22, arc = o.arc || K.arc || 2;
  let hits = 0;
  for (const e of q.enemies) {
    if (!targetable(e)) continue;
    const d = edist(p, e);
    if (d - e.r > reach) continue;
    const a = eang(p, e);
    if (d > e.r + 5 && Math.abs(angDiff(aim, a)) > arc / 2) continue;
    if (damageEnemy(e, dmg, a, (o.knock ?? K.knock ?? 80) * (1 + (p.st.perks.knock || 0)))) { hits++; if (riposte && !e.boss && !e.dead) e.stun = Math.max(e.stun, .7); }
  }
  if (hits && !quiet) { if (isLocal(p)) { G.hitstop = Math.max(G.hitstop, K.hitstop || .03); addShake((K.shake || 0) + (hits > 2 ? 1 : 0)); } Sound.play('hit'); }
  else if (hits) Sound.play('hit');
  return hits;
}
// Dodge charges. Normally one. Double dash (the speed potion, or boots that have it) gives a second one, so you can dash
// twice back to back, but each charge comes back half again as slowly. That keeps dashes
// from chaining forever. Boots and potion don't stack: with both, you keep two charges and they recharge at the normal speed.
const SWIFT_RECHARGE = 1.5;
const potionDash = p => !!(p.fx && p.fx.spd > 0);
const maxDashes = p => p.st.doubleDash || potionDash(p) ? 2 : 1;
const dashRecharge = p => p.st.dodgeCd * (maxDashes(p) > 1 && !(p.st.doubleDash && potionDash(p)) ? SWIFT_RECHARGE : 1);
const canDash = p => p.dashes > 0;
function tickDashes(p, dt) {
  const m = maxDashes(p);
  if (p.dashes > m) p.dashes = m;
  if (p.dashes >= m) { p.dodgeCd = 0; return; }
  p.dodgeCd -= dt;
  if (p.dodgeCd <= 0) { p.dashes++; p.dodgeCd = p.dashes < m ? dashRecharge(p) : 0; }
}
function useDash(p) {
  p.dashes = Math.max(0, p.dashes - 1);
  if (p.dodgeCd <= 0) p.dodgeCd = dashRecharge(p);
  if (maxDashes(p) > 1) burst(p.x, p.y - 6, 5, ['#57c2b0', '#e6fffa'], 50);
}
function startDodge(p, mv) {
  const a = (mv.x || mv.y) ? Math.atan2(mv.y, mv.x) : p.face, d = p.st.dodgeDist, dash = !!p.st.perks.dashDodge;
  const sp = 235 * (dash ? 1.5 : 1) * Math.sqrt(d), time = .22 * Math.sqrt(d) * (p.st.perks.phase ? 1.15 : 1);
  p.dvx = Math.cos(a) * sp; p.dvy = Math.sin(a) * sp; p.dodgeT = time; useDash(p); p.swing = null; p.guarding = false;
  p.fx.charm = 0; p.fx.drowsy = 0; p.dashHit = new Set();
  if (dash) burst(p.x, p.y - 6, 6, ['#f3e9d4', '#ebc152'], 60);
  Sound.play('dodge');
}
function spinHit(p) {
  const R = 30, dmg = p.st.weapon.dmg * .8 * dmgMul(p);
  q.fx.push({ t: 'ring', x: p.x, y: p.y - 4, r0: 8, r1: R, life: .18, max: .18, c: '#c0412e' });
  Sound.play('swing');
  for (const e of q.enemies) if (targetable(e) && edist(p, e) < R + e.r) damageEnemy(e, dmg, eang(p, e), 120);
}
function useAbility(p, mv) {
  const w = p.st.weapon, id = w.ability, ab = ABILITIES[id], W = w.dmg * dmgMul(p);
  const T = w.dmg / KINDS[w.kind].dmgM * dmgMul(p), cast = new Set();   // T: the tier's hit, for spell-like skills; cast: who this use already hit
  const me = isLocal(p), hs = n => { if (me) G.hitstop = Math.max(G.hitstop, n); }, shake = n => { if (me) addShake(n); }, flash = n => { if (me) G.flash = Math.max(G.flash, n); };
  p.abilCd = ab.cd * (1 - p.st.abilityCd) * (w.cdMul || 1); Sound.play('ability');
  if (q.onPlayerAct) q.onPlayerAct('skill', p);
  const aim = () => { const t = p.in.autoAim ? autoTarget(p, 240) : null; return t !== null ? t : p.face; };
  const near = (r, n) => q.enemies.filter(e => targetable(e) && edist(p, e) < r).sort((a, b) => edist(p, a) - edist(p, b)).slice(0, n);
  if (id === 'winged_step' || id === 'impale') {
    const a = id === 'impale' ? aim() : (mv.x || mv.y) ? Math.atan2(mv.y, mv.x) : p.face, sp = id === 'impale' ? 340 : 430;
    p.face = a; p.dvx = Math.cos(a) * sp; p.dvy = Math.sin(a) * sp; p.dashT = id === 'impale' ? .24 : .2; p.dashHit = new Set(); p.swing = null; p.dashMult = id === 'impale' ? 2 : 2.6;
    burst(p.x, p.y - 6, 10, id === 'impale' ? ['#ffffff', '#c7ccd1'] : ['#f3e9d4', '#ebc152'], 70);
  } else if (id === 'stampede' || id === 'aegis') {
    const R = id === 'stampede' ? 52 : 40;
    hs(.08); shake(id === 'stampede' ? 6 : 3); Sound.play('thud');
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 4, r1: R, life: .35, max: .35, c: id === 'stampede' ? '#ebc152' : '#5b9bd5' });
    dust(p.x, p.y, 12);
    for (const e of q.enemies) {
      if (!targetable(e) || edist(p, e) > R + e.r) continue;
      damageEnemy(e, W * (id === 'stampede' ? .8 : .5), eang(p, e), 260, true);
      if (!e.boss && !e.dead) e.stun = Math.max(e.stun, id === 'stampede' ? 1.3 : .6);
    }
    if (id === 'aegis') p.aegisT = 1.5;
  } else if (id === 'chain') {
    let from = { x: p.x, y: p.y - 8 }; const targets = near(150, 5);
    for (const e of targets) { const b = bodyPt(e, from.x, from.y); q.fx.push({ t: 'zap', x0: from.x, y0: from.y, x1: b.x, y1: b.y - 6, life: .3, max: .3, seed: e.id }); damageEnemy(e, W * 1.5, Math.atan2(b.y - from.y, b.x - from.x), 120, true); from = { x: b.x, y: b.y - 6 }; }
    Sound.play('zap'); flash(.06);
    if (!targets.length) q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 2, r1: 20, life: .25, max: .25, c: '#57c2b0' });
  } else if (id === 'volley') {
    const a0 = aim(); p.face = a0;
    const grp = new Map();
    for (let i = 0; i < 7; i++) { spawnProj(p.x, p.y, a0 + (i / 6 - .5) * 1.0, 260, W * .95, 'arrow', 'player', { r: 2.5, life: 1, pierce: 1 }); q.projs[q.projs.length - 1].group = grp; }
    Sound.play('arrow');
  } else if (id === 'sunburst') {
    for (let i = 0; i < 14; i++) spawnProj(p.x, p.y, i / 14 * Math.PI * 2, 210, W * .9, 'sunbolt', 'player', { r: 3, life: .9, pierce: 1 });
    flash(.05); Sound.play('beam');
  } else if (id === 'frenzy') { p.fx.frenzy = 5; burst(p.x, p.y - 8, 12, ['#9a6bc0', '#7fa548'], 60); }
  else if (id === 'soulsteal') { p.fx.heart = 5; burst(p.x, p.y - 8, 12, ['#f2a7c0', '#c0412e'], 60); Sound.play('charm'); }
  else if (id === 'whirlwind') { p.fx.spin = .6; p.spinTicks = 0; }
  else if (id === 'tidal') {
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 90, life: .45, max: .45, c: '#57c2b0' }); Sound.play('splash'); shake(3);
    for (const e of q.enemies) if (targetable(e) && edist(p, e) < 90 + e.r) { damageEnemy(e, W * .6, eang(p, e), 420, true); }
  } else if (id === 'quake') {
    shake(5); Sound.play('thud');
    [[26, 8, 0], [46, 12, .12], [66, 16, .24]].forEach(([r, n, d]) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; q.pspikes.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, t: -d, dmg: W * 1.1, hit: false, owner: p }); } });
  } else if (id === 'eruption') {
    const targets = near(150, 5);
    for (const e of targets) q.pspikes.push({ x: e.x, y: e.y, t: -.35, dmg: T * 2.8, hit: false, fire: true, r: 16, cast, owner: p });
    if (!targets.length) q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 2, r1: 20, life: .25, max: .25, c: '#ff8a2b' });
    Sound.play('explode');
  } else if (id === 'deathmark') {
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 90, life: .4, max: .4, c: '#7fe08a' });
    for (const e of q.enemies) if (targetable(e) && edist(p, e) < 90 + e.r) e.markT = 6;
  }
  // ---- High and God Rank skills ----
  else if (id === 'crescent') {
    const a = aim(); p.face = a;
    spawnProj(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, a, 250, W * 1.6, 'crescent', 'player', { r: 7, life: .85, pierce: 99 });
    p.swing = { t: 0, windup: 0, active: .14, aim: a, fired: true, side: p.swingSide = -p.swingSide }; Sound.play('swing');
  } else if (id === 'shockwave') {
    shake(4); Sound.play('thud');
    [[0, 30], [.22, 52], [.44, 74]].forEach(([d, r]) => q.pspikes.push({ x: p.x, y: p.y, t: -d - .01, dmg: W * .9, ring: true, r, hit: false, owner: p }));
  } else if (id === 'flurry') { p.flurryT = .5; p.flurryAcc = 0; p.face = aim(); }
  else if (id === 'hydra') {                                 // Fang of Typhon: fire-serpents breathe a wide cone of flame
    const a = aim(); p.face = a;
    for (let i = 0; i < 9; i++) { const b = a + (i - 4) * .12; spawnProj(p.x + Math.cos(b) * 6, p.y + Math.sin(b) * 6, b, 220 + (i % 3) * 35, W * 1.1, 'typhonfire', 'player', { r: 4, life: .8, pierce: 2 }); }
    hs(.04); shake(2); Sound.play('ability');
  }
  else if (id === 'piercer') {
    const a = aim(); p.face = a;
    spawnProj(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, a, 340, W * 2.4, 'piercer', 'player', { r: 3, life: 1.1, pierce: 99 });
    hs(.04); Sound.play('arrow');
  }
  // ---- Titan weapons ----
  else if (id === 'skyfall') {
    const targets = near(200, 6);
    if (!targets.length) targets.push({ x: p.x + Math.cos(p.face) * 40, y: p.y + Math.sin(p.face) * 40 });
    targets.forEach((e, i) => q.pspikes.push({ x: e.x, y: e.y, t: -.55 - i * .08, dmg: T * 4.2, hit: false, sky: true, r: 18, cast, owner: p }));
    Sound.play('telegraph');
  } else if (id === 'solar_lance') {
    const a = aim(), len = 230, x0 = p.x, y0 = p.y - 6, x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; p.face = a;
    q.fx.push({ t: 'beamfx', x: x0, y: y0, a, len, life: .35, max: .35, c: '#ffd463' }); flash(.06); Sound.play('beam');
    for (const e of q.enemies) { if (!targetable(e)) continue; const b = bodyPt(e, x0, y0); if (distToSeg(b.x, b.y - 4, x0, y0, x1, y1) < e.r + 7) { damageEnemy(e, W * 2, a, 140, true); e.burnT = Math.max(e.burnT || 0, 2); e.burnBy = p; } }
  } else if (id === 'riptide') {
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 120, r1: 8, life: .35, max: .35, c: '#57c2b0' }); Sound.play('splash');
    for (const e of q.enemies) if (targetable(e) && edist(p, e) < 130 && !e.boss) { const a = Math.atan2(p.y - e.y, p.x - e.x), k = Math.min(380, edist(p, e) * 4.5) * (e.kbRes ?? 1); e.kbx += Math.cos(a) * k; e.kby += Math.sin(a) * k; e.stun = Math.max(e.stun, .6); }
    q.pspikes.push({ x: p.x, y: p.y, t: -.4, dmg: T * 2.2, hit: false, water: true, r: 46, owner: p });
  } else if (id === 'foresight') { p.fx.foresight = 5; p.foresightN = 2; burst(p.x, p.y - 8, 12, ['#e6f2ff', '#5b9bd5'], 60); Sound.play('charm'); }
  else if (id === 'echo') { p.fx.echo = 5; burst(p.x, p.y - 8, 12, ['#c8b8ff', '#ffffff'], 60); Sound.play('charm'); }
  else if (id === 'verdict') {
    const since = G.time - 8, hurt = p.recent.filter(r => r.t > since).reduce((a, r) => a + r.n, 0), R = 60 + Math.min(40, hurt / p.st.maxHp * 80);
    const dmg = W * 1.2 + hurt * 2.5;
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: R, life: .4, max: .4, c: '#e9c04f' }); q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 4, r1: R - 6, life: .4, max: .4, c: '#ffffff' });
    flash(.08); shake(4); Sound.play('perfect'); p.recent = [];
    for (const e of q.enemies) if (targetable(e) && edist(p, e) < R + e.r) damageEnemy(e, dmg, eang(p, e), 200, true);
  } else if (id === 'pride') {
    for (const side of [-1, 1]) spawnProj(p.x + side * 8, p.y, p.face + side * .6, 175, T * 2.2, 'lion', 'player', { r: 6, life: 4, pierce: 2, homing: 5 });
    Sound.play('roar');
  } else if (id === 'timestop') { q.timeStop = 2.5; flash(.15); Sound.play('blessing'); q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 160, life: .5, max: .5, c: '#e9c04f' }); }
}
// Player ground attacks (Earthquake spikes, Eruption fire).
function updatePSpikes(dt) {
  for (const s of q.pspikes) {
    const before = s.t; s.t += dt;
    if (before < 0 && s.t >= 0) {
      const R = s.r || 10, me = isLocal(s.owner); q.actor = s.owner || q.player;
      if (s.fire) { burst(s.x, s.y - 6, 10, ['#ff8a2b', '#ffd463', '#d9493b'], 90); q.fx.push({ t: 'ring', x: s.x, y: s.y, r0: 2, r1: R, life: .25, max: .25, c: '#ff8a2b' }); }
      else if (s.sky) { q.fx.push({ t: 'bolt', x: s.x, y: s.y, life: .2, max: .2, seed: (s.x * 3) | 0, col: '#9fb8ff' }); burst(s.x, s.y - 6, 14, ['#e6f2ff', '#3c4a78', '#ffd463'], 110); q.fx.push({ t: 'ring', x: s.x, y: s.y, r0: 2, r1: R, life: .3, max: .3, c: '#9fb8ff' }); if (me) addShake(3); Sound.play('thud'); }
      else if (s.water) { burst(s.x, s.y - 6, 18, ['#e6f2ff', '#57c2b0', '#ffffff'], 120); q.fx.push({ t: 'ring', x: s.x, y: s.y, r0: 4, r1: R, life: .3, max: .3, c: '#57c2b0' }); Sound.play('splash'); }
      else if (s.ring) { q.fx.push({ t: 'ring', x: s.x, y: s.y, r0: R - 10, r1: R, life: .25, max: .25, c: '#ebc152' }); dust(s.x + rand(-R, R), s.y + rand(-R, R) * .5, 6); if (me) addShake(2); Sound.play('thud'); }
      else dust(s.x, s.y, 3);
      for (const e of q.enemies) {
        if (!targetable(e)) continue;
        const d = edist(s, e);
        if (s.ring ? Math.abs(d - R) > 14 + e.r : d > R + e.r) continue;
        if (s.cast) { if (s.cast.has(e)) continue; s.cast.add(e); }
        damageEnemy(e, s.dmg, eang(s, e), s.water ? 260 : 120, true);
        if (s.fire) { e.burnT = 3; e.burnBy = q.actor; } else if (!e.boss && !e.dead) e.stun = Math.max(e.stun, s.ring ? .9 : .8);
      }
      q.actor = null;
    }
  }
  q.pspikes = q.pspikes.filter(s => s.t < .35);
}

// Damage to you. o.proj: a projectile; o.unblockable: ground attacks your shield can't stop; o.src: who hit you.
function hurtHunter(p, dmg, ang, knock = 140, o = {}) {
  const st = p.st, me = isLocal(p);
  if (p.dead || p.invuln > 0 || p.aegisT > 0 || q.phase === 'victory') return 0;   // dashing doesn't make you untouchable: dash away from attacks, not through them
  // Foresight (Spear of the Axis): you step out of the way on your own.
  if (p.fx.foresight > 0 && p.foresightN > 0) {
    p.foresightN--; p.invuln = .35; const a = ang + (Math.random() < .5 ? 1 : -1) * Math.PI / 2;
    q.fx.push({ t: 'after', frames: heroFrames(p.look), flip: Math.cos(p.face) < 0, x: p.x, y: p.y, life: .3, max: .3 });
    moveEntity(p, Math.cos(a) * 20, Math.sin(a) * 20); Sound.play('dodge'); addText(p.x, p.y - 20, '0', '#e6f2ff');
    return 2;
  }
  // Ward (Starseer armor): every so often a hit just bounces off.
  if (st.perks.ward && p.wardT <= 0) {
    p.wardT = st.perks.ward; p.invuln = .3; Sound.play('block');
    q.fx.push({ t: 'ring', x: p.x, y: p.y - 6, r0: 4, r1: 14, life: .25, max: .25, c: '#e6f2ff' }); addText(p.x, p.y - 20, '0', '#e6f2ff');
    return 2;
  }
  if (p.guarding && st.shield && !o.unblockable) {
    const from = ang + Math.PI;
    if (Math.abs(angDiff(p.face, from)) < 1.3) {
      if (p.guardPress > 0) { perfectBlock(p, o, ang); return 2; }
      const small = o.src && o.src.def && o.src.def.cls === 'fodder';
      const cost = dmg / rawDmg(1, tierNow()) * 100 * (small ? .5 : .75);
      p.guard -= cost; p.guardDelay = .8; p.guardFlash = .12; p.blockKick = .15;
      const taken = small ? 0 : Math.round(dmg * (1 - st.shield.block) * 20 / (20 + st.def) * (o.proj ? 1 - st.projRes : 1));
      p.kbx += Math.cos(ang) * knock * .35; p.kby += Math.sin(ang) * knock * .35;
      Sound.play('guard'); burst(p.x + Math.cos(p.face) * 6, p.y - 7, 4, ['#ebc152', '#fff6d8'], 60);
      p.invuln = .2;
      if (taken > 0) { p.hp -= taken; p.stats.taken += taken; p.recent.push({ t: G.time, n: taken }); addText(p.x, p.y - 18, '-' + taken, '#a7adb3'); }
      if (p.guard <= 0) guardBreak(p);
      if (p.hp <= 0) checkDown(p);
      return 2;
    }
  }
  if (o.proj) dmg *= 1 - st.projRes;
  const taken = Math.max(1, Math.round(dmg * 20 / (20 + st.def)));
  p.hp -= taken; p.invuln = .8; p.flash = .15;
  const k = knock * (1 - st.kbRes);
  p.kbx += Math.cos(ang) * k; p.kby += Math.sin(ang) * k;
  p.fx.sleep = 0; p.fx.drowsy = 0;
  if (me) { addShake(4); G.hitstop = Math.max(G.hitstop, .06); Sound.play('hurt'); }
  addText(p.x, p.y - 18, '-' + taken, '#ff6b5a');
  burst(p.x, p.y - 6, 6, ['#d9493b', '#f0e4cc'], 70);
  p.stats.taken += taken; p.recent.push({ t: G.time, n: taken }); if (p.recent.length > 40) p.recent.shift();
  if (o.src && o.melee && st.perks.thorns && !o.src.dead) { const was = q.actor; q.actor = p; damageEnemy(o.src, st.weapon.dmg * st.perks.thorns, ang + Math.PI, 60, true, false); q.actor = was; }
  if (p.hp <= 0) checkDown(p);
  return 1;
}
const hurtPlayer = (dmg, ang, knock, o) => hurtHunter(q.player, dmg, ang, knock, o);
// Titanmother armor: once per hunt, a hit that would drop you leaves you standing on 1 health.
function checkDown(p) {
  if (q && q.def.prologue) { proSave(p); return; }           // nobody falls on the road to Akros
  if (p.st.perks.lastStand && !p.lastStandUsed) {
    p.lastStandUsed = true; p.hp = 1; p.invuln = 1.4; Sound.play('blessing');
    burst(p.x, p.y - 8, 18, ['#7fa548', '#e9c04f', '#ffffff'], 90);
    if (isLocal(p)) { G.slowmo = .5; banner('Last stand', 'The Titanmother keeps you on your feet'); }
    return;
  }
  p.hp = 0; downed(p);
}
// Damage over time (puddles, poison, burns). No knockback and no flinch.
function tickDamage(n, p = q.player) {
  if (p.dead || q.phase === 'victory' || n <= 0) return;
  p.hp -= n; p.stats.taken += n; p.flash = Math.max(p.flash, .05);
  if (p.hp <= 0) checkDown(p);
}
function perfectBlock(p, o, ang) { const was = q.actor; q.actor = p; perfectBlockHit(p, o, ang); q.actor = was; }
function perfectBlockHit(p, o, ang) {
  const sh = p.st.shield, W = p.st.weapon.dmg * dmgMul(p);
  p.guard = Math.min(p.st.guardMax, p.guard + p.st.guardMax * .1); p.invuln = .3; p.guardFlash = .3; p.blockKick = .1; p.fx.riposte = 1;
  q.fx.push({ t: 'ring', x: p.x + Math.cos(p.face) * 7, y: p.y - 4 + Math.sin(p.face) * 4, r0: 3, r1: 16, life: .25, max: .25, c: '#ffffff' });
  Sound.play('perfect'); if (isLocal(p)) { G.hitstop = Math.max(G.hitstop, .08); G.flash = Math.max(G.flash, .04); }
  burst(p.x + Math.cos(p.face) * 7, p.y - 7, 12, ['#ffffff', '#ebc152', '#5b9bd5'], 90);
  addText(p.x, p.y - 20, '!', '#ffffff');
  p.stats.perfect = (p.stats.perfect || 0) + 1;
  const pr = o.projObj;
  if (pr) { if (sh.perk === 'reflect' || p.st.perks.reflectPerfect) reflectProj(pr, p); return; }
  const src = o.src;
  if (src && !src.dead) {
    if (!src.boss) { src.stun = Math.max(src.stun, sh.perk === 'bash' ? 1.4 : .8); src.state = 'move'; }
    const kb = src.boss ? 60 : sh.perk === 'bash' ? 320 : 180, a = Math.atan2(src.y - p.y, src.x - p.x);
    src.kbx += Math.cos(a) * kb * (src.kbRes ?? 1); src.kby += Math.sin(a) * kb * (src.kbRes ?? 1);
    if (sh.perk === 'bash') damageEnemy(src, W * .5, a, 0, true);
    if (sh.perk === 'lightning') { q.fx.push({ t: 'bolt', x: src.x, y: src.y, life: .25, max: .25, seed: src.id }); damageEnemy(src, W, a, 0, true); Sound.play('zap'); }
  }
  if (sh.perk === 'timeslow') {
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 64, life: .35, max: .35, c: '#e9c04f' });
    for (const e of q.enemies) if (targetable(e) && !e.boss && edist(p, e) < 64 + e.r) e.stun = Math.max(e.stun, 1.3);
  }
  if (sh.perk === 'wave') {
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 50, life: .3, max: .3, c: '#57c2b0' });
    for (const e of q.enemies) if (targetable(e) && !e.boss && dist(p, e) < 50 + e.r) { const a = Math.atan2(e.y - p.y, e.x - p.x); e.kbx += Math.cos(a) * 260 * (e.kbRes ?? 1); e.kby += Math.sin(a) * 260 * (e.kbRes ?? 1); }
  }
}
function guardBreak(p) {
  p.guard = 0; p.guarding = false; p.guardBreak = .9;
  Sound.play('break'); if (isLocal(p)) addShake(3); burst(p.x, p.y - 10, 10, ['#a7adb3', '#636a72'], 80);
  addText(p.x, p.y - 22, '-0', '#ff6b5a');
}
// You hit 0 health: Hestia's blessing gets you back up once. In a party you're down until a teammate gets you up,
// and the quest is lost only when everyone is down (or the party is out of faints). Alone, the quest is lost.
function downed(p = q.player) {
  if (isLocal(p) && q.blessed && !p.revived) {
    p.revived = true; q.blessed = false; q.usedBlessing = true;
    p.hp = Math.round(p.st.maxHp * .5); p.invuln = 2.2; p.fx.poison = p.fx.burn = p.fx.sleep = 0;
    Sound.play('blessing'); G.flash = .2; G.slowmo = .4;
    burst(p.x, p.y - 8, 30, ['#ffd463', '#ff8a2b', '#fff6d8'], 120);
    q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 6, r1: 70, life: .5, max: .5, c: '#ffd463' });
    for (const e of q.enemies) if (targetable(e) && dist(p, e) < 70) { const a = Math.atan2(e.y - p.y, e.x - p.x); e.kbx += Math.cos(a) * 300 * (e.kbRes ?? 1); e.kby += Math.sin(a) * 300 * (e.kbRes ?? 1); if (!e.boss) e.stun = Math.max(e.stun, 1); }
    banner('Hestia’s blessing', 'You rise again');
    return;
  }
  if (q.hunters.length > 1 && q.hunters.some(h => h !== p && !h.dead) && (q.faints == null || q.faints > 1)) { knockDown(p); return; }
  playerDie(p);
}
// Shields: hoplites, automatons (while not mid-attack) and Athena (while watching you) block hits from the front.
function shieldBlocks(e, ang) {
  const guarding = e.boss ? e.guard : (e.def.shield && (e.state === 'move' || e.state === 'windup') && e.stun <= 0);
  if (!guarding) return false;
  return Math.abs(angDiff(e.face, ang + Math.PI)) < 1.15;
}
function damageEnemy(e, dmg, ang, knock, unblockable = false, fromPlayer = true) {
  if (e.dead || e.state === 'spawn' || e.hidden || e.air) return false;
  if (e.state === 'bones') { if (fromPlayer) finishBones(e); return true; }
  if (e.boss && e.invuln > 0) { burst(e.x, e.y - 10, 3, ['#ebc152'], 50); Sound.play('clink'); return false; }
  const p = q.actor || q.player;                           // who's hitting: the hunter whose attack this is (you, alone)
  if (e.boss && e.reflectT > 0 && fromPlayer) {           // Nemesis: your hit comes back at you
    burst(e.x, e.y - 10, 6, ['#ffffff', '#c9bda4'], 70); Sound.play('block');
    hurtHunter(p, rawDmg(.08, e.tier), ang + Math.PI, 120, { src: e });
    return false;
  }
  let blocked = false;
  if (!unblockable && shieldBlocks(e, ang)) {
    blocked = true; Sound.play('block');
    burst(e.x + Math.cos(e.face) * 6, e.y - 8, 5, ['#ebc152', '#fff6d8'], 60);
    if (e.boss) { e.kbx += Math.cos(ang) * 30; e.kby += Math.sin(ang) * 30; return false; }
    dmg *= .15; knock *= .3;
  }
  if (e.markT > 0) dmg *= 1.3;
  if (e.vuln) dmg *= e.vuln;
  if (e.ward) dmg *= e.ward;                                // Typhon, while his serpent heads still live
  if (e.boss && fromPlayer && p.st.perks.godBane) dmg *= 1 + p.st.perks.godBane;
  dmg = Math.max(1, Math.round(dmg * rand(.9, 1.1)));
  if (e.stun > 0 && !e.boss) dmg = Math.round(dmg * 1.25);
  e.hp -= dmg; e.flash = .12;
  const k = knock * (e.kbRes ?? 1); e.kbx += Math.cos(ang) * k; e.kby += Math.sin(ang) * k;
  addText(e.x, e.y - e.h - 2, String(dmg), blocked ? '#85735d' : dmg >= p.st.weapon.dmg * 1.6 ? '#ebc152' : '#f0e4cc');
  if (!blocked) {                                           // sparks fly the way the hit went; big hits get more, and a beat of hitstop
    const big = fromPlayer && dmg >= p.st.weapon.dmg * 1.6, n = big ? 9 : 5, hy = e.y - Math.min(e.h * .5, e.body ? 30 : 8);
    for (let i = 0; i < n; i++) { const a = ang + rand(-.7, .7), sp = rand(70, big ? 190 : 140); sc.parts.push({ x: e.x, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, g: 120, life: rand(.12, .26), max: .26, c: i % 3 ? '#ffd463' : '#fff6d8', s: i % 4 ? 1 : 2 }); }
    if (big) { if (isLocal(p)) G.hitstop = Math.max(G.hitstop, .04); q.fx.push({ t: 'ring', x: e.x, y: e.y, r0: 2, r1: 10, life: .15, max: .15, c: '#ffd463' }); }
  }
  p.stats.dealt += dmg; e.lastBy = p;
  if (e.boss) addThreat(e, p, dmg);
  if (fromPlayer && !blocked) onPlayerHit(e, dmg);
  if (e.boss && e.def.titan) titanOnHit(e, dmg);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
  return true;
}
// Set bonuses and skills that trigger when you land a hit.
function onPlayerHit(e, dmg) {
  const p = q.actor || q.player, P = p.st.perks;
  const steal = (P.lifesteal || 0) + (p.fx.heart > 0 ? .12 : 0);
  if (steal) { p.stealAcc = (p.stealAcc || 0) + Math.min(dmg * steal, p.st.maxHp * .05); if (p.stealAcc >= 1) { const n = Math.floor(p.stealAcc); p.stealAcc -= n; healHunter(p, n, false); } }
  if (P.burn) { e.burnT = 2; e.burnBy = p; }
  if (P.stunHit && !e.boss && Math.random() < P.stunHit) e.stun = Math.max(e.stun, .5);
  if (P.lightning) {
    p.hits++;
    if (p.hits % P.lightning === 0) {
      q.fx.push({ t: 'bolt', x: e.x, y: e.y, life: .25, max: .25, seed: e.id + p.hits }); Sound.play('zap'); if (isLocal(p)) G.flash = Math.max(G.flash, .05);
      for (const o of q.enemies) if (o !== e && targetable(o) && dist(o, e) < 26) damageEnemy(o, p.st.weapon.dmg * .6, 0, 40, true, false);
      if (!e.dead) damageEnemy(e, p.st.weapon.dmg * .6, 0, 40, true, false);
    }
  }
}
function killEnemy(e, o = {}) {
  if (e.dead) return;
  if (e.def.revive && !e.revived && !o.final) {            // the dead fall into a pile of bones and get back up
    e.state = 'bones'; e.st = 3.2; e.revived = true; e.hp = 1; e.stun = 0; e.vx = e.vy = 0; e.tok = null;
    Sound.play('bones'); burst(e.x, e.y - 6, 8, ['#f3e9d4', '#c2b293'], 70);
    if (!q.seenBones) { q.seenBones = true; banner('Smash the bones', 'Hit the pile before it gets back up'); }
    return;
  }
  e.dead = true; e.hp = 0;
  const by = q.actor || e.lastBy || q.player;                // who gets the kill
  if (e.onDeath) { e.onDeath(e); return; }
  Sound.play('kill');
  burst(e.x, e.y - 6, e.boss ? 40 : 14, e.def.colors, e.boss ? 140 : 90);
  if (!e.boss) {
    q.fx.push({ t: 'pop', spr: e.def.sprite, flip: e.flip, x: e.x, y: e.y - (e.fly ? 10 : 0), life: .2, max: .2, scale: e.scale || 1 });
    if (e.def.cls === 'heavy') { if (isLocal(by)) { G.hitstop = Math.max(G.hitstop, .06); addShake(3); } dust(e.x, e.y, 12); Sound.play('thud'); }
  }
  q.fx.push({ t: 'ring', x: e.x, y: e.y, r0: 2, r1: e.boss ? 40 : 12, life: .3, max: .3, c: '#f0e4cc' });
  if (!o.noLoot) rollLoot(e, by);
  if (e.def.puddle === 'poison' && e.def.role === 'exploder' && !o.exploded) addPuddle(e.x, e.y, 12, 3, 'poison', .02);
  if (!e.boss) { by.stats.kills++; if (by.st.perks.killFrenzy) by.fx.killRush = 3; }
  if (e.boss) bossDefeated(e);
}
function finishBones(e) {
  e.hidden = false; burst(e.x, e.y - 4, 12, ['#f3e9d4', '#c2b293', '#85735d'], 90); Sound.play('hit');
  killEnemy(e, { final: true });
}
function rollLoot(e, by = q.player) {
  for (const [item, chance, min, max] of e.def.loot) if (Math.random() <= chance) { const n = randi(min || 1, max || 1); for (let i = 0; i < n; i++) spawnPickup(e.x, e.y, rid(item, e.rank || 0)); }
  if (e.boss) return;
  const heal = (CLASS[e.def.cls] || CLASS.fodder).heal + (by.st.perks.healDrops || 0);
  if (Math.random() < heal) spawnPickup(e.x, e.y, '@heal');
}

/* ---- projectiles, hazards, pickups, particles ---- */
function spawnProj(x, y, ang, speed, dmg, kind, team, o = {}) {
  q.projs.push({ x, y, px: x, py: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg, kind, team, r: o.r || 2.5, life: o.life || 3,
                 pierce: o.pierce || 0, homing: o.homing || 0, split: o.split || null, charm: o.charm || 0, knock: o.knock || 90, src: o.src || null, hit: new Set(), t: 0, dead: false,
                 ghost: !!o.ghost, bounce: o.bounce || 0, big: o.big || 0, delay: o.delay || 0, launch: o.launch || 0, boom: o.boom || null,
                 owner: team === 'player' ? o.owner || q.actor || q.player : null });
}
function killProj(pr) {
  if (pr.dead) return; pr.dead = true;
  if (pr.split) { const s = pr.split; for (let i = 0; i < s.n; i++) spawnProj(pr.px, pr.py, i / s.n * Math.PI * 2, s.speed, s.dmg, s.kind, pr.team, { r: 2, life: 1.6 }); burst(pr.px, pr.py - 6, 10, ['#ffd463', '#ffffff'], 90); Sound.play('zap'); }
}
function reflectProj(pr, p = q.player) {
  pr.team = 'player'; pr.owner = p; pr.vx *= -1.3; pr.vy *= -1.3; pr.dmg = p.st.weapon.dmg * 1.5; pr.homing = 0; pr.split = null; pr.hit = new Set(); pr.life = 1.5; pr.charm = 0;
  Sound.play('block');
}
// Enemy shots that steer or launch go after the nearest hunter still standing (you, alone).
function projTarget(pr) { return q.hunters.length === 1 ? q.player : nearestHunter(pr.x, pr.y) || q.player; }
function updateProjs(dt) {
  for (const pr of q.projs) {
    if (pr.dead) continue;
    if (pr.team === 'enemy' && q.timeStop > 0) continue;       // Stop Time: their shots hang in the air
    if (pr.delay > 0) {                                           // frozen in the air, then launched at you
      pr.delay -= dt; pr.t += dt;
      if (pr.delay <= 0) { const p = projTarget(pr), a = Math.atan2(p.y - pr.y, p.x - pr.x); pr.vx = Math.cos(a) * pr.launch; pr.vy = Math.sin(a) * pr.launch; Sound.play('swing'); }
      continue;
    }
    pr.t += dt; pr.life -= dt; pr.px = pr.x; pr.py = pr.y;
    const p = pr.homing && pr.team === 'enemy' ? projTarget(pr) : null;
    if (pr.homing && pr.team === 'enemy' && !p.dead) {
      const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(p.y - pr.y, p.x - pr.x), sp = Math.hypot(pr.vx, pr.vy);
      const na = cur + clamp(angDiff(cur, want), -pr.homing * dt, pr.homing * dt); pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
    } else if (pr.homing && pr.team === 'player') {
      let best = null, bd = 220; for (const e of q.enemies) { if (!targetable(e) || pr.hit.has(e.id)) continue; const d = edist(pr, e); if (d < bd) { bd = d; best = e; } }
      if (best) { const b = bodyPt(best, pr.x, pr.y), cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(b.y - pr.y, b.x - pr.x), sp = Math.hypot(pr.vx, pr.vy);
        const na = cur + clamp(angDiff(cur, want), -pr.homing * dt, pr.homing * dt); pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp; }
    }
    if (pr.kind === 'godweapon' && pr.boom && pr.t > pr.boom.t) {          // a thrown god weapon turns round and flies back to its owner
      const s = pr.boom.src, a = Math.atan2(s.y - 6 - pr.y, s.x - pr.x), sp = Math.min(380, Math.hypot(pr.vx, pr.vy) + 520 * dt);
      pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; pr.life = Math.max(pr.life, .5);
      if (s.dead || Math.hypot(s.x - pr.x, s.y - 6 - pr.y) < 12) { pr.dead = true; s.tossOut = false; continue; }
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.life <= 0) { killProj(pr); continue; }
    if (pr.bounce > 0 && pointBlocked(pr.x, pr.y)) {               // Atlas' sky bounces off walls
      if (pointBlocked(pr.x, pr.py)) pr.vx = -pr.vx; else pr.vy = -pr.vy;
      pr.x = pr.px; pr.y = pr.py; pr.bounce--; addShake(3); Sound.play('thud'); dust(pr.x, pr.y, 8); continue;
    }
    if (pr.kind !== 'goat' && pr.kind !== 'wave' && !pr.ghost && pointBlocked(pr.x, pr.y)) { burst(pr.x, pr.y - 6, 3, ['#d8ccb4', '#85735d'], 40); killProj(pr); continue; }
    if ((pr.kind === 'goat' || pr.kind === 'wave') && (pr.x < IPX.minX - 20 || pr.x > IPX.maxX + 20 || pr.y < IPX.minY - 20 || pr.y > IPX.maxY + 20)) { pr.dead = true; continue; }
    if (pr.team === 'enemy') {
      for (const h of q.hunters) {                                // every hunter it touches (just you, alone)
        if (h.dead) continue;
        const d = Math.hypot(pr.x - h.x, pr.y - h.y);
        if (h.aegisT > 0 && d < pr.r + h.r + 9) { reflectProj(pr, h); break; }
        if (d < pr.r + h.r + 1) {
          const r = hurtHunter(h, pr.dmg, Math.atan2(pr.vy, pr.vx), pr.knock, { proj: pr.kind !== 'goat' && pr.kind !== 'wave', projObj: pr, src: pr.src, unblockable: pr.kind === 'globe' });
          if (r === 1 && pr.charm && pr.src && !pr.src.dead) { h.fx.charm = pr.charm; h.charmFrom = pr.src; Sound.play('charm'); }
          if (r && pr.team === 'enemy' && pr.kind !== 'goat' && pr.kind !== 'wave' && pr.kind !== 'globe' && pr.kind !== 'sickle' && pr.kind !== 'godweapon') { killProj(pr); break; }
          if (pr.team !== 'enemy') break;                          // a perfect block just sent it back
        }
      }
    } else {
      q.actor = pr.owner || q.player;
      for (const e of q.enemies) {
        if (!targetable(e) || pr.hit.has(e.id)) continue;
        if (edist(pr, e) < pr.r + e.r + 1) {
          if (pr.group) { const n = pr.group.get(e.id) || 0; if (n >= 3) continue; pr.group.set(e.id, n + 1); }   // a volley hits one target with at most 3 arrows
          pr.hit.add(e.id); damageEnemy(e, pr.dmg * (pr.fall || 1), Math.atan2(pr.vy, pr.vx), KINDS.bow.knock); Sound.play('hit');
          if (pr.kind === 'arrow' || pr.kind === 'piercer') pr.fall = (pr.fall || 1) * (pr.kind === 'piercer' ? .8 : .7);   // each enemy it goes through takes less
          if (pr.pierce-- <= 0) { killProj(pr); break; }
        }
      }
      q.actor = null;
    }
  }
  q.projs = q.projs.filter(pr => !pr.dead);
}
// Hazards: telegraphed ground circles, expanding rings, lingering puddles and marked lanes.
function addCircleHazard(x, y, r, delay, dmg, kind, extra = {}) {
  x = clamp(x, IPX.minX + 6, IPX.maxX - 6); y = clamp(y, IPX.minY + 6, IPX.maxY - 6);
  q.hazards.push({ type: 'circle', x, y, r, delay: Math.max(.3, delay), dmg, kind, t: 0, fired: false, ...extra });
}
function addRing(x, y, speed, max, dmg, col, extra = {}) { q.hazards.push({ type: 'ring', x, y, r: 6, speed, max, dmg, col, hit: false, ...extra }); }
// dps = share of your max health lost per second while you stand in it.
function addPuddle(x, y, r, life, kind, dps) {
  x = clamp(x, IPX.minX + 4, IPX.maxX - 4); y = clamp(y, IPX.minY + 4, IPX.maxY - 4);
  q.hazards.push({ type: 'puddle', x, y, r, life, max: life, kind, dps: dps || 0, t: 0 });
}
const PUDDLE = {
  wine:   { col: '#7a2f5a', hi: '#a8507a', slow: true },
  poison: { col: '#4e6e2b', hi: '#8ab04a', dot: true },
  water:  { col: '#2c6a8a', hi: '#5aa3c0', slow: true },
  lava:   { col: '#a8261a', hi: '#ff8a2b', dot: true, burn: true },
  void:   { col: '#2a1f3a', hi: '#7fe08a', dot: true, slow: true },
  witch:  { col: '#1f3a5a', hi: '#57c2b0', dot: true },
  sleep:  { col: '#6b5a8a', hi: '#c8b8ff', slow: true, sleep: true },
  lethe:  { col: '#3a2f5a', hi: '#c8b8ff', slow: true, dot: true, confuse: true },
  time:   { col: '#4a3a14', hi: '#e9c04f', slow: true, heavy: true },
};
// Hazards hurt every hunter in them. acc: the damage-over-time counter, one per hunter (key 'acc' for you).
const accKey = p => p.hid ? 'acc' + p.hid : 'acc';
function updateHazards(dt) {
  for (const h of q.hazards) {
    h.t += dt;
    if (h.type === 'circle') {
      if (!h.fired && h.t >= h.delay) {
        h.fired = true;
        for (const p of q.hunters) {
          const inside = !p.dead && Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r;
          if (inside && h.dmg) hurtHunter(p, h.dmg, Math.atan2(p.y - h.y, p.x - h.x), 150, { unblockable: true });
        }
        if (h.kind === 'bolt') { q.fx.push({ t: 'bolt', x: h.x, y: h.y, life: .25, max: .25, seed: (h.x * 7 + h.y) | 0 }); G.flash = Math.max(G.flash, .08); Sound.play('zap'); addShake(2); }
        else if (h.kind === 'spear' || h.kind === 'arrow' || h.kind === 'sunfire') { q.fx.push({ t: 'spear', x: h.x, y: h.y, life: .5, max: .5, col: h.kind === 'sunfire' ? '#ffd463' : null }); dust(h.x, h.y, 6); Sound.play('thud'); }
        else if (h.kind === 'geyser') { burst(h.x, h.y - 8, 16, ['#e6f2ff', '#5aa3c0', '#ffffff'], 120); Sound.play('splash'); }
        else if (h.kind === 'lob') { burst(h.x, h.y - 4, 10, [PUDDLE[h.puddle].hi, PUDDLE[h.puddle].col], 70); Sound.play('splash'); addPuddle(h.x, h.y, h.r, h.life || 5, h.puddle, h.dps || 0); }
        else if (h.kind === 'apple') { burst(h.x, h.y - 6, 16, ['#e9c04f', '#fff6d8', '#c0412e'], 110); Sound.play('explode'); q.fx.push({ t: 'ring', x: h.x, y: h.y, r0: 2, r1: h.r, life: .25, max: .25, c: '#e9c04f' }); }
        else if (h.kind === 'sky' || h.kind === 'judgment') { q.fx.push({ t: 'bolt', x: h.x, y: h.y, life: .22, max: .22, seed: (h.x * 7 + h.y) | 0, col: h.kind === 'sky' ? '#9fb8ff' : '#ffd463' }); burst(h.x, h.y - 6, 12, h.kind === 'sky' ? ['#e6f2ff', '#3c4a78', '#ffd463'] : ['#ffd463', '#ffffff'], 100); Sound.play(h.kind === 'sky' ? 'thud' : 'zap'); addShake(h.r > 40 ? 6 : 2); }
        else if (h.kind === 'axis' || h.kind === 'memory') { burst(h.x, h.y - 6, 14, h.kind === 'axis' ? ['#e6f2ff', '#5b9bd5', '#ffffff'] : ['#c8b8ff', '#ffffff'], 100); Sound.play('zap'); q.fx.push({ t: 'ring', x: h.x, y: h.y, r0: 2, r1: h.r, life: .25, max: .25, c: hazardCol(h.kind) }); }
        else if (h.kind === 'star') { burst(h.x, h.y - 4, 6, ['#ffffff', '#e6f2ff'], 50); }
        else if (h.kind === 'stone' || h.kind === 'etna') { dust(h.x, h.y, 10); burst(h.x, h.y - 6, 10, ['#c9bda4', '#8f846c'], 90); Sound.play('thud'); addShake(2); }
        else if (h.kind === 'shadow') { burst(h.x, h.y - 8, 18, ['#2a1f3a', '#7fe08a', '#140d0b'], 110); Sound.play('swing'); q.fx.push({ t: 'ring', x: h.x, y: h.y, r0: 4, r1: h.r, life: .25, max: .25, c: '#7fe08a' }); }
        else { burst(h.x, h.y - 6, 12, [hazardCol(h.kind), '#fff6d8'], 90); Sound.play('thud'); }
        if (h.then) h.then(h);
      }
      if (h.fired && h.t > h.delay + .05) h.dead = true;
    } else if (h.type === 'ring') {
      h.r += h.speed * dt;
      for (const p of q.hunters) {                                 // each hunter can be caught by a ring once
        if (h.hits && h.hits.has(p)) continue;
        if (!p.dead && Math.abs(Math.hypot(p.x - h.x, p.y - h.y) - h.r) < 6) {
          const r = hurtHunter(p, h.dmg, Math.atan2(p.y - h.y, p.x - h.x), 220, { unblockable: !h.blockable });
          if (r) { h.hit = true; (h.hits = h.hits || new Set()).add(p); if (h.confuse && r === 1) { p.fx.confuse = h.confuse; Sound.play('charm'); } }
        }
      }
      if (h.r > h.max) h.dead = true;
    } else if (h.type === 'puddle') {
      h.life -= dt; if (h.life <= 0) { h.dead = true; continue; }
      for (const p of q.hunters) {
        if (p.dead) continue;
        if (Math.hypot(p.x - h.x, (p.y - h.y) * 1.6) < h.r + 2) {
          const P = PUDDLE[h.kind], ak = accKey(p);
          if (P.slow) p.fx.slow = .3;
          if (P.heavy) p.fx.heavy = .3;
          if (P.confuse && !(p.fx.confuse > 0)) { p.fx.confuse = .9; Sound.play('charm'); }
          if (P.dot) { if (P.burn) p.fx.burn = Math.max(p.fx.burn, .6); else p.fx.poison = Math.max(p.fx.poison, 1.5); h[ak] = (h[ak] || 0) + h.dps * p.st.maxHp * dt; if (h[ak] >= 1) { const n = Math.floor(h[ak]); h[ak] -= n; tickDamage(n, p); } }
          if (P.sleep) { p.fx.drowsy += dt * 2; if (p.fx.drowsy > 1.6) { p.fx.drowsy = 0; p.fx.sleep = 1.1; Sound.play('charm'); addText(p.x, p.y - 20, '-0', '#c8b8ff'); } }
        }
      }
    } else if (h.type === 'whirl') {                             // Oceanus' whirlpool pulls you toward its middle
      if (h.t < h.delay) continue;
      h.life -= dt; if (h.life <= 0) { h.dead = true; continue; }
      for (const p of q.hunters) {
        if (p.dead || p.dodgeT > 0 || p.dashT > 0) continue;
        const d = Math.hypot(p.x - h.x, p.y - h.y);
        if (d < h.r) {
          const a = Math.atan2(h.y - p.y, h.x - p.x), f = h.pull * (1 - d / h.r * .5), ak = accKey(p);
          moveEntity(p, (Math.cos(a) + Math.cos(a + 1.4) * .5) * f * dt, (Math.sin(a) + Math.sin(a + 1.4) * .5) * f * dt);
          p.fx.slow = Math.max(p.fx.slow, .2);
          if (d < 14) { h[ak] = (h[ak] || 0) + h.dps * p.st.maxHp * dt; if (h[ak] >= 1) { const n = Math.floor(h[ak]); h[ak] -= n; tickDamage(n, p); } }
        }
      }
    } else if (h.type === 'lane') {
      if (!h.fired && h.t >= h.delay) {
        h.fired = true;
        const sp = h.speed || 210;
        if (h.kind === 'bolt') {
          q.fx.push({ t: 'laneBolt', x0: h.x0, y0: h.y0, x1: h.x1, y1: h.y1, life: .3, max: .3, seed: (h.y0 + h.x0) | 0, col: h.col }); Sound.play('zap'); G.flash = Math.max(G.flash, .08);
          for (const p of q.hunters) if (!p.dead && distToSeg(p.x, p.y, h.x0, h.y0, h.x1, h.y1) < 9) hurtHunter(p, h.dmg, Math.atan2(h.y1 - h.y0, h.x1 - h.x0) + Math.PI / 2, 150, { unblockable: true });
        } else {
          const a = Math.atan2(h.y1 - h.y0, h.x1 - h.x0);
          spawnProj(h.x0, h.y0, a, sp, h.dmg, h.kind === 'wave' ? 'wave' : 'goat', 'enemy', { r: h.kind === 'wave' ? 8 : 5, life: 6, knock: h.kind === 'wave' ? 260 : 200 });
          Sound.play(h.kind === 'wave' ? 'splash' : 'pounce');
        }
      }
      if (h.fired) h.dead = true;
    }
  }
  q.hazards = q.hazards.filter(h => !h.dead);
}
function hazardCol(kind) { return { curse: '#3f9a8a', soulfire: '#7fe08a', witchfire: '#57c2b0', note: '#7fa548', sky: '#9fb8ff', axis: '#e6f2ff', memory: '#c8b8ff', judgment: '#ffd463', stone: '#c9a46b', star: '#ffffff' }[kind] || '#ff5a3c'; }
function distToSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}
function spawnPickup(x, y, item) {
  const a = rand(0, Math.PI * 2), s = rand(25, 65);
  q.pickups.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 0, vz: rand(60, 100), item, t: 0, dead: false, home: false });
}
// Pickups fly to the nearest hunter who wants them (you, alone). Once one starts flying to someone it keeps going to them.
function pickupFor(k, heal) {
  if (q.hunters.length === 1) return q.player;
  if (k.to && !k.to.dead) return k.to;
  return nearestHunter(k.x, k.y, h => !heal || h.hp < h.st.maxHp) || nearestHunter(k.x, k.y) || q.player;
}
function updatePickups(dt) {
  for (const k of q.pickups) {
    k.t += dt; k.vz -= 320 * dt; k.z += k.vz * dt;
    if (k.z < 0) { k.z = 0; k.vz = -k.vz * .4; if (Math.abs(k.vz) < 20) k.vz = 0; }
    const fr = Math.pow(.03, dt); k.vx *= fr; k.vy *= fr;
    const heal = k.item === '@heal';
    if (heal && q.phase === 'victory') { k.dead = true; continue; }
    const p = pickupFor(k, heal);
    const dx = p.x - k.x, dy = p.y - 3 - k.y, d = Math.hypot(dx, dy) || 1;
    const range = (q.phase === 'victory' || q.phase === 'between' || q.phase === 'walkout') ? 9999 : heal ? 34 : 64;
    const wants = !heal || p.hp < p.st.maxHp;
    if (k.t > .45 && !p.dead && wants && (k.home || d < range)) { if (!heal) k.home = true; k.to = p; const sp = Math.min(320, 70 + (k.t - .45) * 420); k.vx = dx / d * sp; k.vy = dy / d * sp; }
    const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
    if (k.home || !pointBlocked(nx, ny)) { k.x = nx; k.y = ny; } else { k.vx = k.vy = 0; }
    if (d < 8 && k.t > .3 && wants && !p.dead) collect(k, p);
  }
  q.pickups = q.pickups.filter(k => !k.dead);
}
function collect(k, p = q.player) {
  k.dead = true;
  if (k.item === '@heal') {
    healHunter(p, Math.max(12, Math.round(p.st.maxHp * .12))); Sound.play('heal');
    burst(p.x, p.y - 6, 6, ['#ebc152', '#9bbb55'], 40);
    return;
  }
  for (const h of SHARED_LOOT ? q.hunters : [p]) h.loot[k.item] = (h.loot[k.item] || 0) + 1;   // each hunter's own haul (q.loot is yours)
  Sound.play('pickup'); if (SHARED_LOOT || isLocal(p)) feed(k.item);
}
function burst(x, y, n, colors, speed) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(speed * .3, speed);
    sc.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, g: 140, life: rand(.25, .6), max: .6, c: colors[i % colors.length], s: Math.random() < .3 ? 2 : 1 });
  }
}
function dust(x, y, n) { for (let i = 0; i < n; i++) sc.parts.push({ x: x + rand(-3, 3), y: y + rand(-1, 1), vx: rand(-25, 25), vy: rand(-18, -2), g: 0, life: rand(.25, .5), max: .5, c: Math.random() < .5 ? '#c9b48e' : '#a08b68', s: Math.random() < .4 ? 2 : 1 }); }
function addText(x, y, s, c) { sc.texts.push({ x, y, s, c, life: .7, max: .7 }); }
function addShake(n) { G.shake = Math.max(G.shake, n); }


