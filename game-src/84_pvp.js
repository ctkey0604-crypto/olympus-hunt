/* ============================== THE COLISEUM: PLAYER AGAINST PLAYER ============================== */
// A fight is a hunt with no monsters, so it runs on everything co-op already has: the room's post, ready and depart, the host's
// game running the match, reconnecting and takeover. The rank of a fight only limits equipment, and real gear counts.
// Every game keeps a stand-in "monster" for each hunter (q.pvpT), and the opponents of your own hunter sit in q.enemies, so
// swings, arrows, skills and auto-aim all work unchanged. A hit on a stand-in becomes a hit on that hunter, judged by their own
// game (blocks, dodges). No potions, meals, blessings or revives. Best of three rounds; the last side standing takes a round.
const PVP_WINS = 2, PVP_READY = 3, PVP_ROUND_END = 2.5, PVP_ROUND_MAX = 90, PVP_DONE = 3;
const PVP_GUARD = .25, PVP_STAGGER = .6, PVP_KNOCK = .6;                // protection after a hit (.8 in hunts), a parried attacker's stagger
const PVP_STUN = .7, PVP_STUN_GAP = 2;                                  // the longest a stun lasts, and the time before another can land
const PVP_DMG = [1, 1, 1];                                              // damage in fights, by rank of gear
const PVP_MAX_HIT = .2;                                                 // no one hit takes more than this share of your health, so nobody gets flattened
const PVP_BOW_DUEL = 1.5;                                               // bow on bow only: two archers at range would take too long otherwise
const PVP_MODES = { duel: 'Duel', team: 'Team fight' }, PVP_TEAMS = ['Red', 'Blue'];
const PVP_LOOK = { name: 'Player', cls: 'medium', colors: ['#d9493b', '#f0e4cc'], loot: [] };
const pvpId = (mode, r) => `pvp_${mode}_${r}`;
for (const mode of Object.keys(PVP_MODES)) RANKS.forEach((R, r) => {
  const id = pvpId(mode, r);
  QUEST_BY_ID[id] = { id, base: id, pvp: true, mode, name: PVP_MODES[mode], god: 'ares', arena: 'coliseum', rank: r, tier: 13 + R.off, mt: 13 + R.off, waves: [{}], requires: [], reward: 0, stars: 1, desc: '' };
});
let shotHit = false;                                                     // the hit being handled came from a shot, not a swing

// Who ends up on which side of a team fight. Players pick from the room box; anyone who hasn't goes to the smaller side, and
// neither side is ever left empty. Every game works this out from the same list, so they all agree.
function pvpSides(picks) {
  const teams = picks.map(s => s === 0 || s === 1 ? s : null), n = [0, 0];
  teams.forEach(t => { if (t !== null) n[t]++; });
  teams.forEach((t, i) => { if (t === null) { const s = n[1] < n[0] ? 1 : 0; teams[i] = s; n[s]++; } });
  if (teams.length > 1 && (!n[0] || !n[1])) teams[teams.length - 1] = n[0] ? 1 : 0;
  return teams;
}
// The two sides in the room box. Click one to join it; you can change until the fight starts.
function pvpSideBox(R) {
  const poster = netPoster(R), list = [...R.members].sort((a, b) => (b.id === poster) - (a.id === poster)), teams = pvpSides(list.map(m => m.gear && m.gear.side));
  const mine = teams[list.findIndex(m => m.id === R.me)], names = s => list.filter((m, i) => teams[i] === s).map(m => esc(m.name)).join(', ');
  return `<div class="mp-sides">${PVP_TEAMS.map((name, s) => `<button type="button" data-mp="side${s}" class="side${s}${mine === s ? ' on' : ''}"><b>${name}</b>${names(s)}</button>`).join('')}</div>`;
}
function pvpSetup() {
  const P = q.pv = { round: 1, wins: {}, ph: 'ready', t: PVP_READY, kd: q.hunters.map(() => [0, 0]), log: [], last: null, champ: null };
  q.blessed = false; q.phase = 'pvp'; q.pvpT = new Map();
  const sides = pvpSides(q.hunters.map(h => h.side));
  for (const [i, h] of q.hunters.entries()) {
    h.team = q.def.mode === 'team' ? sides[i] : h.hid; P.wins[h.team] = 0;
    h.st = playerStats({ ...(h.save || G.save), meal: null }); h.hp = h.st.maxHp;
    const e = { id: -(h.hid + 1), pvp: h, type: 'pvp', def: PVP_LOOK, x: h.x, y: h.y, r: 5, h: 14, hp: 1, maxHp: 1, state: 'move', st: 0, stun: 0, flash: 0, kbx: 0, kby: 0, kbRes: 1, markT: 0, burnT: 0, face: 0, dead: false, alpha: 1 };
    q.pvpT.set(e.id, e);
  }
  for (const e of q.pvpT.values()) if (e.pvp.team !== q.player.team) q.enemies.push(e);
  pvpSpawn(); pvpSync();
  netUi();
}
// Everyone back to their corner, at full health. On a guest's game this comes as a message from the host.
function pvpSpawn() {
  const n = q.hunters.length, cx = WORLD_W / 2, cy = WORLD_H / 2, teams = q.def.mode === 'team', count = [0, 0];
  for (const h of q.hunters) {
    const a = h.hid / n * Math.PI * 2 + Math.PI, i = teams ? count[h.team]++ : 0;
    const x = teams ? cx + (h.team ? 190 : -190) : cx + Math.cos(a) * 190, y = teams ? cy - 40 + i * 40 : cy + Math.sin(a) * 110;
    if (h === q.player || !q.net || q.net === 'host') pvpReset(h, x, y);
    if (h.remote) { netTo(h, 'rs', [Math.round(x), Math.round(y)]); h.reviveHold = performance.now() + 1500; }
  }
}
function pvpReset(h, x, y) {
  Object.assign(h, { x, y, vx: 0, vy: 0, kbx: 0, kby: 0, dead: false, downed: false, hp: h.st.maxHp, invuln: 1.2, swing: null, dodgeT: 0, dashT: 0, abilCd: 0, mom: 0, scored: false, lastBy: null, echoes: [], flurryT: 0, guarding: false, guardBreak: 0, guard: h.st.guardMax });
  for (const k in h.fx) h.fx[k] = 0;
}
function pvpSync(dt = 0) {
  const open = q.pv.ph === 'fight', host = q.net !== 'guest';
  for (const e of q.pvpT.values()) {
    const h = e.pvp;
    if (host && open && !h.dead && !h.left) pvpEffects(e, h);          // what skills did to the stand-in happens to the hunter
    e.x = h.x; e.y = h.y; e.untargetable = !open || h.dead || !!h.left;
    e.stun = 0; e.burnT = 0; e.kbx = e.kby = 0; e.markT = Math.max(0, (e.markT || 0) - dt);
  }
}
// Stuns are short and can't be chained, so a skill opens a window instead of ending the fight.
function pvpEffects(e, h) {
  if (e.stun > 0) pvpStun(h, e.stun);
  if (e.burnT > 0) pvpFx(h, { burn: Math.min(2, e.burnT) });
  if (e.kbx || e.kby) {
    const k = PVP_KNOCK * (1 - h.st.kbRes), x = Math.round(e.kbx * k), y = Math.round(e.kby * k);
    if (h.remote) netTo(h, 'kb', [x, y]); else { h.kbx += x; h.kby += y; }
  }
}
function pvpFx(h, o) {
  if (h.remote) { const P = h.patch || (h.patch = {}); P.fx = { ...P.fx, ...o }; return; }
  for (const k in o) h.fx[k] = Math.max(h.fx[k], o[k]);
}
function pvpStun(h, t) {
  if (h.stunAt > G.time - PVP_STUN_GAP) return;
  h.stunAt = G.time; pvpFx(h, { sleep: Math.min(PVP_STUN, t) });
}
// Stop Time holds the other side still for a moment.
function pvpFreeze(by) { for (const h of q.hunters) if (h.team !== by.team && !h.dead && !h.left) pvpStun(h, PVP_STUN); }
// A hit landed on a hunter's stand-in. The host applies it (a guest's game sent it here); the hunter's own game judges it.
function pvpHit(e, dmg, ang, knock, ub, fp) {
  const t = e.pvp, by = q.actor || q.player;
  if (q.pv.ph !== 'fight' || t.dead || t.left || by.dead || by === t || by.team === t.team) return false;
  if (Math.hypot(by.x - t.x, by.y - t.y) > 340) return false;           // nothing reaches that far: a game that says so is lying
  const bows = shotHit && by.st.kind.draw && t.st.kind.draw ? PVP_BOW_DUEL : 1;
  dmg = Math.max(1, Math.round(dmg * PVP_DMG[q.def.rank] * bows * (e.markT > 0 ? 1.3 : 1) * rand(.9, 1.1)));
  const r = hurtHunter(t, dmg, ang, knock * PVP_KNOCK, { src: q.pvpT.get(-(by.hid + 1)), melee: !shotHit, proj: shotHit, unblockable: ub });
  if (!r) return false;
  t.lastBy = by; by.stats.dealt += dmg;
  hitSparks(t.x, t.y - 8, ang, false);
  if (isLocal(by)) pvpShowHit(t, dmg);
  if (fp) onPlayerHit(e, dmg);
  return true;
}
const pvpShotTest = (e, dmg, by) => { shotHit = true; q.actor = by; const r = pvpHit(e, dmg, 0, 0, false, false); q.actor = null; shotHit = false; return r; };   // for the tests
// The number you see when your hit lands: what it'll do after their armor.
function pvpShowHit(t, dmg) {
  const was = NET.replay; NET.replay = true;
  addText(t.x, t.y - 22, String(Math.max(1, Math.round(dmg * 20 / (20 + t.st.def)))), '#f0e4cc');
  NET.replay = was;
}
// A perfect block staggers whoever swung, so timing beats gear.
function pvpParried(src) {
  if (q.net === 'guest') { NET.out.q.push(['pv', src.id]); return; }
  const h = src.pvp; if (h) pvpFx(h, { sleep: PVP_STAGGER });
}
const pvpSideName = T => q.def.mode === 'team' ? PVP_TEAMS[T] : (q.hunters.find(h => h.team === +T) || {}).name || 'Player';
function pvpScore() {
  const P = q.pv, sides = Object.keys(P.wins);
  return `Round ${P.round} · ` + sides.map(T => `${pvpSideName(T)} ${P.wins[T]}`).join(', ');
}
// The match, on the host: rounds start, kills count, the last side standing takes the round.
function pvpHostTick(dt) {
  pvpSync(dt);
  if (q.timeStop > 0) { q.timeStop = 0; pvpFreeze(q.player); }           // your own Stop Time (a guest's comes in its report)
  const P = q.pv; P.t -= dt;
  if (P.ph === 'ready') { if (P.t <= 0) { P.ph = 'fight'; P.t = PVP_ROUND_MAX; pvpSync(); banner('Fight!', ''); Sound.play('roar'); netUi(); } return; }
  if (P.ph === 'fight') {
    for (const h of q.hunters) if (h.dead && !h.scored && !h.left) {
      h.scored = true; P.kd[h.hid][1]++;
      if (h.lastBy) { P.kd[h.lastBy.hid][0]++; P.log.push([h.lastBy.hid, h.hid]); banner(`${h.lastBy.name} took down ${h.name}`, ''); }
    }
    const standing = q.hunters.filter(h => !h.dead && !h.left), sides = new Set(standing.map(h => h.team));
    if (sides.size > 1 && P.t > 0) return;
    let w = sides.size === 1 ? [...sides][0] : null;
    if (P.t <= 0) {                                                     // out of time: the side with the most health left takes it
      const hp = {}; for (const h of standing) hp[h.team] = (hp[h.team] || 0) + h.hp / h.st.maxHp;
      w = Object.keys(hp).sort((a, b) => hp[b] - hp[a]).map(Number)[0] ?? null;
    }
    P.last = w; if (w !== null) P.wins[w]++;
    P.ph = 'end'; P.t = PVP_ROUND_END; G.slowmo = .4;
    banner(w === null ? 'Nobody stands' : `${pvpSideName(w)} takes the round`, pvpScore());
    netUi(); return;
  }
  if (P.ph === 'end' && P.t <= 0) {
    const sides = new Set(q.hunters.filter(h => !h.left).map(h => h.team)), champ = Object.keys(P.wins).map(Number).find(T => P.wins[T] >= PVP_WINS);
    if (champ !== undefined || sides.size < 2) {
      P.champ = champ !== undefined ? champ : sides.size ? [...sides][0] : null; P.ph = 'done'; P.t = PVP_DONE;
      banner(P.champ === null ? 'The fight is over' : `${pvpSideName(P.champ)} wins the fight`, '', true); Sound.play('win');
    } else { P.round++; P.ph = 'ready'; P.t = PVP_READY; pvpSpawn(); banner(`Round ${P.round}`, ''); }
    netUi(); return;
  }
  if (P.ph === 'done' && P.t <= 0) pvpFinish();
}
// One step on a guest's game: the stand-ins follow the hunters, and if the host's last word never comes, the fight still ends.
function pvpGuestTick(dt) {
  pvpSync(dt);
  if (q.pv.ph === 'done') { q.pv.t -= dt; if (q.pv.t < -2) { pvpFinish(); return true; } }
  return false;
}
// For the board: each game reports only its own losses, who took it down and who beat it. Nobody can report their own wins,
// and walking out counts as a loss.
function pvpReport(quit) {
  const P = q.pv, me = q.player, idOf = h => h === me ? NET.me : h.remote || h.mirror, tally = {};
  for (const [k, v] of P.log) if (v === me.hid && k !== me.hid) { const id = q.hunters[k] && idOf(q.hunters[k]); if (id) tally[id] = (tally[id] || 0) + 1; }
  const won = !quit && P.champ === me.team, beat = won ? [] : q.hunters.filter(h => h.team !== me.team && !h.left && (quit || h.team === P.champ)).map(idOf).filter(Boolean);
  netSend({ t: 'pvpres', deaths: Object.entries(tally).map(([id, n]) => [+id, n]), beat });
}
// The end of the fight on your screen. quit: you walked out of it.
function pvpFinish(quit = false) {
  if (!q || !q.pv) return;
  const P = q.pv, me = q.player, wonIt = !quit && P.ph === 'done' && P.champ === me.team, mine = P.kd[me.hid] || [0, 0];
  if (quit || P.ph === 'done') pvpReport(quit);
  if (q.net === 'host') netHostEnd(P.ph === 'done'); else if (q.net === 'guest' && quit) netSend({ t: 'leave' });
  CG.gameplay(false);
  $('resQuest').innerHTML = `<span style="color:${RANKS[q.def.rank].col}">${RANKS[q.def.rank].name} gear</span> · ${esc(PVP_MODES[q.def.mode])}`;
  const title = $('resTitle'); title.textContent = quit ? 'You left the fight' : wonIt ? 'Victory' : 'Defeat'; title.className = 'res-title ' + (wonIt ? 'win' : 'lose');
  $('resStats').innerHTML = `<div><span>Rounds won</span><b>${P.wins[me.team] || 0}</b></div><div><span>Kills</span><b>${mine[0]}</b></div><div><span>Deaths</span><b>${mine[1]}</b></div><div><span>Damage dealt</span><b>${Math.round(q.stats.dealt)}</b></div>`;
  $('resUnlock').innerHTML = ''; $('resLoot').innerHTML = `<div class="muted">Fights pay nothing. They’re for the glory.</div>`; $('resNote').textContent = '';
  $('btnResAgain').hidden = true; G.lastQuest = null; G.arenaBack = true;
  G.mode = 'results'; q = null; show('scrResults');
  setTimeout(() => { if (G.mode === 'results') $('btnResContinue').focus({ preventScroll: true }); }, 900);
}
/* ---- Agon's panel ---- */
function renderArena() {
  const R = NET.room;
  if (!netOn() || R.members.length < 2) return `<div class="empty-note">You need a room with at least two players. Talk to the Oracle in the square.</div>`;
  const rows = Object.entries(PVP_MODES).map(([mode, label]) => `<div class="opt"><h3>${label}</h3><p>${mode === 'duel' ? 'Everyone for themselves. With two players, it’s one on one.' : 'Two sides. Pick yours from the room box once the fight is posted. You can’t hurt your own side.'}</p><div class="stack">`
    + RANKS.map((Rk, r) => `<button class="btn${r ? ' ghost' : ''}" type="button" data-ar="${pvpId(mode, r)}" ${R.phase === 'town' ? '' : 'disabled'}>${esc(Rk.name)} gear</button>`).join('') + `</div></div>`).join('');
  return `<p class="muted">Best of three rounds. Pick the highest gear rank allowed: anything stronger has to come off first. No potions or meals. Then everyone readies up from the room box.</p><div class="opts">${rows}</div>`;
}
$('hubBody').addEventListener('click', ev => { const b = ev.target.closest('[data-ar]'); if (b) netPost(b.dataset.ar); });
/* ---- the fight board ---- */
const pvpKd = p => (p.d ? p.k / p.d : p.k).toFixed(2);
function renderFightBoard() {
  return `<div class="fb" id="pvpBoard"><p class="fb-note">Looking…</p></div>
    <p class="fb-how">Everyone starts at 1000. Win a fight to gain score, lose one to drop it: 12 points in an even fight, up to 24 for beating someone far above you. The same two players only count for 10 wins and 30 kills a day.</p>`;
}
async function pvpBoardLoad() {
  try {
    const list = (await Store.call('GET', 'pvp/board')).board || [], box = $('pvpBoard'); if (!box) return;
    const me = String(Store.user || '').toLowerCase();
    box.innerHTML = !list.length ? `<p class="fb-note">Nobody has fought here yet.</p>` : `<div class="fb-row fb-head"><span></span><span>Player</span><span>K/D</span><span>Score</span></div>`
      + list.map((p, i) => `<div class="fb-row${p.name.toLowerCase() === me ? ' me' : ''}"><b>${i + 1}</b><span class="fb-name">${esc(p.name)}</span><span>${pvpKd(p)}</span><b class="fb-score">${p.r}</b></div>`).join('');
  } catch (e) { if ($('pvpBoard')) $('pvpBoard').innerHTML = `<p class="fb-note">The board can’t be read right now. Check your connection.</p>`; }
}
/* ---- drawing ---- */
// In a fight the stand-ins aren't drawn, and a small arrow marks who's on which side.
function renderQuest() {
  if (!q) return;
  if (!q.pv) { renderQuest0(); return; }
  const E = q.enemies; q.enemies = [];
  try { renderQuest0(); } finally { q.enemies = E; }
  const [cx, cy] = camOffset();
  for (const h of q.hunters) {
    if (h === q.player || h.dead || h.left) continue;
    const x = Math.round(h.x - cx), y = Math.round(h.y - cy) - 30;
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 2, y + 2, 5, 1);
    ctx.fillStyle = h.team === q.player.team ? '#7fe08a' : '#ff5a3c'; ctx.fillRect(x - 2, y, 5, 2); ctx.fillRect(x - 1, y + 2, 3, 1);
  }
}
