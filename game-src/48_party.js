/* ============================== PARTY ==================================== */
// Co-op groundwork. q.hunters is everyone in the hunt; q.player is always YOUR hunter (camera, HUD, results, saves).
// Single player is a party of one and plays exactly as before. For now the other hunters are bots
// (OlympusHunt.addBotHunter); later they are the other people in an online room.
//
// How a hunt grows with the party (index = number of hunters). Tuned with bot parties (Oct 29): a full party of four
// clears a hunt or a god in about 0.65-0.8 of the time one hunter takes, depending on the weapons they bring.
//   bossHp   gods and Titans          mobs    monsters per wave (mostly the small ones)
//   mobHp    every monster's health   helpers monsters a boss calls in
//   arena    width and height         budget  how many monsters can be out at once
//   spawn    how fast new monsters walk in
const PARTY_SCALE = [null,
  { bossHp: 1,    mobs: 1,    mobHp: 1, helpers: 1,    arena: 1,    budget: 1,    spawn: 1 },
  { bossHp: 1.7,  mobs: 1.35, mobHp: 1, helpers: 1.25, arena: 1,    budget: 1.35, spawn: 1.3 },
  { bossHp: 2.35, mobs: 1.65, mobHp: 1, helpers: 1.5,  arena: 1.15, budget: 1.7,  spawn: 1.6 },
  { bossHp: 3,    mobs: 1.9,  mobHp: 1, helpers: 1.75, arena: 1.3,  budget: 2,    spawn: 1.9 },
];
const PARTY_MAX = 4;
const partyScale = () => PARTY_SCALE[clamp((q && q.partyN) || 1, 1, PARTY_MAX)];
const REVIVE_TIME = 3, REVIVE_R = 22;            // stand this close to a downed teammate for this long to get them up
// Faints. null: no limit, the hunt fails only when everyone is down at once. A number: a shared pool per hunt.
const PARTY_FAINTS = null;
// true: a part one hunter picks up goes into every hunter's own haul. false: only the one who grabbed it gets it.
const SHARED_LOOT = true;
const BOT_NAMES = ['Nikias', 'Thalia', 'Damon', 'Ione'];

const isLocal = p => !q || !p || p === q.player;   // screen shake, hitstop, flashes and banners are only for your own hunter
function nearestHunter(x, y, pred) {
  let best = null, bd = 1e9;
  for (const h of q.hunters) { if (h.dead || (pred && !pred(h))) continue; const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
  return best;
}

/* ---- making hunters ---- */
function blankInput() { return { mx: 0, my: 0, atk: false, atkHeld: false, mouseAtk: false, mouseHeld: false, dodge: false, abil: false, guard: false, guardHeld: false, pots: [], wx: 0, wy: 0, autoAim: true }; }
// Your controls this step, read once from the keyboard, mouse, touch stick and buttons.
function localInput() {
  const mv = moveVector(), pots = [];
  for (const [id, P] of Object.entries(POTIONS)) if (Input.hit(P.key)) pots.push(id);
  return { mx: mv.x, my: mv.y, atk: Input.hit('attack'), atkHeld: Input.is('attack'), mouseAtk: Input.mouseAttack, mouseHeld: Input.mouse.held,
           dodge: Input.hit('dodge'), abil: Input.hit('ability'), guard: Input.hit('guard'), guardHeld: Input.is('guard'), pots,
           wx: G.cam.x + Input.mouse.x, wy: G.cam.y + Input.mouse.y, autoAim: Settings.data.autoAim };
}
function makeHunter(o = {}) {
  const save = o.save || G.save, p = makePlayer(save);
  p.hid = o.hid || 0; p.local = !!o.local; p.bot = o.bot || null; p.name = o.name || ''; p.save = save;
  p.in = blankInput(); p.stats = { kills: 0, dealt: 0, taken: 0, perfect: 0 }; p.loot = {}; p.tok = { melee: 0, ranged: 0 };
  if (p.hid) { const a = -Math.PI / 2 + p.hid * Math.PI * 2 / PARTY_MAX; p.x += Math.round(Math.cos(a) * 20); p.y += Math.round(Math.sin(a) * 14); }
  return p;
}
// A bot teammate carries your armor and shield (if its weapon takes one) with the weapon you give it.
function botSave(wid) {
  const s = G.save, w = WEAPONS[wid] ? wid : s.weapon;
  return { ...s, weapon: w, shield: KINDS[WEAPONS[w].kind].oneHand ? s.shield : null, equip: { ...s.equip }, potions: { health: 1, strength: 0, speed: 0 } };
}
function addHunter(o) {
  if (!q || q.hunters.length >= PARTY_MAX) return null;
  const h = makeHunter({ ...o, hid: q.hunters.length });
  q.hunters.push(h);
  return h;
}

/* ---- who monsters and gods go after ---- */
// Monsters spread out over the party: each sticks with one hunter for a few seconds, and picks whoever is close
// and has the fewest others already on them. Nobody switches in the middle of an attack.
function targetFor(e, dt) {
  const H = q.hunters;
  if (H.length === 1) return H[0];
  e.tgtT = (e.tgtT || 0) - dt;
  const cur = e.tgt && !e.tgt.dead && H.includes(e.tgt) ? e.tgt : null;
  if (cur && (e.state !== 'move' || e.tgtT > 0)) return cur;
  let best = null, bs = 1e9;
  for (const h of H) {
    if (h.dead) continue;
    let n = 0; for (const o of q.enemies) if (o !== e && !o.dead && !o.boss && o.tgt === h) n++;
    const s = Math.hypot(h.x - e.x, h.y - e.y) + n * 45 - (h === cur ? 30 : 0);
    if (s < bs) { bs = s; best = h; }
  }
  e.tgt = best || e.tgt || H[0]; e.tgtT = 2 + (e.id % 7) * .25;
  return e.tgt;
}
// In a party, monsters that walk up to hit you curve in from the sides instead of queueing behind each other.
const FLANKERS = new Set(['fodder', 'leaper', 'exploder', 'teleporter', 'tank']);
function flankSteer(e, c) {
  if (e.state !== 'move' || !FLANKERS.has(e.def.role) || c.d < 36) return;
  const f = (((e.id * .618) % 1) - .5) * 2.2 * clamp((c.d - 36) / 80, 0, 1), cs = Math.cos(f), sn = Math.sin(f);
  const vx = e.vx * cs - e.vy * sn, vy = e.vx * sn + e.vy * cs; e.vx = vx; e.vy = vy;
}
// Gods and Titans keep a threat table: damage dealt to them (as a share of their health), fading over time, plus a
// little for standing close. They pick a new target every 5-8 s, or sooner when someone else is clearly the bigger threat.
function addThreat(b, p, dmg) {
  if (!p || q.hunters.length === 1) return;
  b.threat = b.threat || new Map(); b.threat.set(p, (b.threat.get(p) || 0) + dmg / b.maxHp);
}
function bossTarget(b, dt) {
  const H = q.hunters;
  if (H.length === 1) return H[0];
  b.threat = b.threat || new Map();
  const fade = Math.pow(.5, dt / 6); for (const [h, v] of b.threat) b.threat.set(h, v * fade);
  if (b.tgtT === undefined) b.tgtT = rand(5, 8);
  b.tgtT -= dt;
  const cur = b.tgt && !b.tgt.dead && H.includes(b.tgt) ? b.tgt : null;
  if (cur && b.state !== 'idle') return cur;                      // never mid-attack
  const due = !cur || b.tgtT <= 0;
  // when it's time to switch, whoever it's on now counts for half, so it usually moves on unless they're far ahead
  const score = h => ((b.threat.get(h) || 0) + Math.max(0, 1 - Math.hypot(h.x - b.x, h.y - b.y) / 160) * .02) * (due && h === cur ? .5 : 1);
  let best = null, bs = -1;
  for (const h of H) { if (h.dead) continue; const s = score(h); if (s > bs) { bs = s; best = h; } }
  if (!best) return cur || b.tgt || H[0];                         // everyone is down
  if (due || (best !== cur && bs > score(cur) * 1.5 + .03)) { b.tgt = best; b.tgtT = rand(5, 8); }
  return b.tgt;
}
// Big ground attacks land where hunters bunch up: the middle of the group around the target, if two or more stand close.
function aoeAt(p) {
  if (q.hunters.length === 1 || !p) return p;
  let n = 0, sx = 0, sy = 0;
  for (const h of q.hunters) if (!h.dead && Math.hypot(h.x - p.x, h.y - p.y) < 56) { n++; sx += h.x; sy += h.y; }
  return n >= 2 ? { x: sx / n, y: sy / n, vx: p.vx, vy: p.vy, dead: p.dead } : p;
}
// More helpers when a boss calls for help in a party: extra copies of the smallest monsters on its list.
function partyHelpers(types) {
  const m = partyScale().helpers; if (m === 1 || !types.length) return types;
  const extra = Math.round(types.length * (m - 1)), rank = t => ({ fodder: 0, medium: 1, heavy: 2 })[ENEMIES[t].cls] ?? 1;
  const small = types.slice().sort((a, b) => rank(a) - rank(b));
  const out = types.slice(); for (let i = 0; i < extra; i++) out.push(small[i % Math.max(1, Math.ceil(small.length / 2))]);
  return out;
}
// More monsters per wave in a party, mostly the small ones.
function partyCount(type, n) {
  const m = partyScale().mobs; if (m === 1) return n;
  const cls = ENEMIES[type].cls;
  return Math.max(n, Math.round(n * (cls === 'heavy' ? 1 + (m - 1) * .3 : cls === 'medium' ? 1 + (m - 1) * .55 : m)));
}
// Bigger arenas for 3-4 hunters: the same layout stretched to fit, worked out once per size.
const ARENA_CACHE = {};
function partyArena(id, A, s) {
  if (s === 1 || A.paint) return A;
  const key = id + ':' + s; if (ARENA_CACHE[key]) return ARENA_CACHE[key];
  const wt0 = A.wt || 40, ht0 = A.ht || 26, wt = Math.round(wt0 * s), ht = Math.round(ht0 * s), dW = wt - wt0, dH = ht - ht0;
  const mx = x => Math.round(3 + (x - 3) * (wt - 7) / (wt0 - 7)), my = y => Math.round(3 + (y - 3) * (ht - 7) / (ht0 - 7));
  let secret = A.secret;
  if (secret) {
    const S0 = secret, east = S0.x > wt0 - 4, west = S0.x + S0.w - 1 < 3, north = !east && !west && S0.y < 3;
    const x = east ? S0.x + dW : west ? S0.x : mx(S0.x), y = east || west ? my(S0.y) : north ? S0.y : S0.y + dH;
    secret = { ...S0, x, y, chest: [S0.chest[0] + x - S0.x, S0.chest[1] + y - S0.y] };
  }
  return (ARENA_CACHE[key] = { ...A, wt, ht, secret, obstacles: A.obstacles.map(([k, x, y, v]) => [k, mx(x), my(y), v]) });
}

/* ---- down, not out ---- */
function knockDown(p) {
  p.dead = true; p.downed = true; p.reviveT = 0; p.swing = null; p.guarding = false; p.dodgeT = p.dashT = 0; p.fx.charm = 0; p.flurryT = 0; p.echoes = [];
  if (q.faints !== null && q.faints !== undefined) q.faints--;
  burst(p.x, p.y - 6, 14, ['#c0412e', '#e9c04f', '#f3e9d4'], 80); Sound.play('hurt');
  if (isLocal(p)) banner('You’re down', 'A teammate can get you back up'); else addText(p.x, p.y - 22, '!', '#ff6b5a');
}
function reviveHunter(p) {
  p.dead = false; p.downed = false; p.reviveT = 0; p.hp = Math.round(p.st.maxHp * .4); p.invuln = 2; p.fx.poison = p.fx.burn = p.fx.sleep = p.fx.confuse = 0;
  burst(p.x, p.y - 8, 16, ['#ffd463', '#9bbb55', '#fff6d8'], 90); Sound.play('blessing');
  q.fx.push({ t: 'ring', x: p.x, y: p.y, r0: 4, r1: 26, life: .4, max: .4, c: '#9bbb55' });
  if (isLocal(p)) banner('Back on your feet', 'Your party pulled you up');
}
function updateRevives(dt) {
  if (q.phase === 'victory' || q.phase === 'defeat') return;
  for (const p of q.hunters) {
    if (!p.downed) continue;
    const helper = q.hunters.some(h => !h.dead && Math.hypot(h.x - p.x, h.y - p.y) < REVIVE_R);
    p.reviveT = helper ? p.reviveT + dt : Math.max(0, p.reviveT - dt * .5);
    if (p.reviveT >= REVIVE_TIME) reviveHunter(p);
  }
}

/* ---- bot teammates ---- */
// Walks up to the nearest monster (the god or Titan once it's out), keeps swinging, dashes off marked ground and away
// from shots, uses its skill when it's ready, drinks a potion when low, and goes to get downed teammates back up.
const BOT_DANGER = new Set(['dashAim', 'lungeAim', 'charmAim', 'leapAim', 'tossAim', 'boltAim', 'sweepAim', 'breathAim', 'throwAim']);
function botThink(p, dt) {
  const I = blankInput(), B = p.bot = p.bot || {}; if (p.dead) return I;
  B.t = (B.t || 0) + dt; B.dodgeCd = Math.max(0, (B.dodgeCd || 0) - dt);
  const K = p.st.kind, melee = K.melee;
  let goX = null, goY = null, want = 0, tgt = null;
  const down = q.hunters.find(h => h.downed);
  if (down && !q.enemies.some(e => !e.dead && !e.boss && e.state !== 'spawn' && Math.hypot(e.x - down.x, e.y - down.y) < 30)) { goX = down.x; goY = down.y; want = 6; }
  else {
    const b = q.boss && !q.boss.dead && !q.boss.hidden && !q.boss.untargetable && q.boss.state !== 'intro' ? q.boss : null;
    let bd = 1e9;
    if (b && !q.enemies.some(e => !e.dead && !e.boss && e.state !== 'spawn' && Math.hypot(e.x - p.x, e.y - p.y) < 40)) tgt = b;
    else {                                                      // spread out: prefer monsters nobody else in the party is on
      if (B.tgt && targetable(B.tgt) && !B.tgt.boss && B.t < B.keep) tgt = B.tgt;
      else {
        for (const e of q.enemies) {
          if (!targetable(e)) continue;
          let d = Math.hypot(e.x - p.x, e.y - p.y);
          for (const h of q.hunters) if (h !== p && h.bot && h.bot.tgt === e) d += 60;
          if (d < bd) { bd = d; tgt = e; }
        }
        B.tgt = tgt; B.keep = B.t + 1.2;
      }
    }
    if (tgt) {
      const orbit = B.t * .5 + p.hid * 1.7, R = melee ? tgt.r + K.reach * .55 + 2 : 105;
      goX = tgt.x + Math.cos(orbit) * R; goY = tgt.y + Math.sin(orbit) * R * .8; want = 3;
    }
  }
  if (goX !== null) {
    const dx = goX - p.x, dy = goY - p.y, d = Math.hypot(dx, dy);
    if (d > want) { I.mx = dx / d; I.my = dy / d; }
  } else { const c = q.player; if (c && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) > 40) { const a = Math.atan2(c.y - p.y, c.x - p.x); I.mx = Math.cos(a); I.my = Math.sin(a); } }
  if (tgt) {
    const d = edist(p, tgt) - tgt.r;
    I.atkHeld = d < (melee ? K.reach + 8 : 220); I.atk = I.atkHeld && !B.held; B.held = I.atkHeld;
    if (p.abilCd <= 0 && p.st.weapon.ability && d < (melee ? 60 : 180) && Math.random() < .03) I.abil = true;
  }
  // danger: marked ground about to go off under you, shots about to land, a god lining up a dash at you
  let fx = 0, fy = 0, threat = false;
  for (const h of q.hazards) {
    if (h.type === 'circle' && !h.fired && h.dmg && h.delay - h.t < .5 && Math.hypot(p.x - h.x, p.y - h.y) < h.r + 8) { const a = Math.atan2(p.y - h.y, p.x - h.x); fx += Math.cos(a); fy += Math.sin(a); threat = true; }
    else if (h.type === 'ring' && !(h.hits && h.hits.has(p)) && Math.abs(Math.hypot(p.x - h.x, p.y - h.y) - h.r) < 18 && Math.hypot(p.x - h.x, p.y - h.y) > h.r) threat = true;
  }
  for (const pr of q.projs) {
    if (pr.team !== 'enemy' || pr.dead || pr.delay > 0) continue;
    const dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy), sp = Math.hypot(pr.vx, pr.vy) || 1;
    if (d < 34 && (dx * pr.vx + dy * pr.vy) / (d * sp) > .8) { fx += -pr.vy / sp; fy += pr.vx / sp; threat = true; }
  }
  const b = q.boss;
  if (b && !b.dead && b.tgt === p && BOT_DANGER.has(b.state) && b.st < .4) { const a = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2; fx += Math.cos(a); fy += Math.sin(a); threat = true; }
  if (threat && B.dodgeCd <= 0 && p.dashes > 0) {
    if (fx || fy) { const m = Math.hypot(fx, fy); I.mx = fx / m; I.my = fy / m; }
    I.dodge = true; B.dodgeCd = .5 + Math.random() * .4;
  }
  if (p.hp < p.st.maxHp * .35 && p.save.potions && p.save.potions.health > 0 && Math.random() < .02) I.pots = ['health'];
  return I;
}

// Runs every hunter for one step: you from the keyboard, bots from their brains, others from the network later.
function updateHunters(dt) {
  for (const p of q.hunters) {
    p.in = p.local ? (G.botLocal ? botThink(p, dt) : localInput()) : p.bot ? botThink(p, dt) : (p.netIn || blankInput());
    q.actor = p; updateHunter(p, dt); q.actor = null;
  }
  if (q.hunters.length > 1) updateRevives(dt);
}
