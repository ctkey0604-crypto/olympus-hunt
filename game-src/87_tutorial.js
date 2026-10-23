/* ============================== FIRST STEPS ============================== */
// The soft tutorial. A new save starts on the road outside Akros (86_prologue.js), where the controls are taught.
// In the village a goal line under the place name and an arrow point the way: talk to Kleon, take a hunt, forge
// gear, take the next hunt. It never stops the game. Saved per save (save.tut); old saves that already have hunts
// behind them skip it, and Options can turn tips off. One-time hints also explain a weapon skill or a shield the
// first time you carry one.
const TUT = { ROAD: 0, TALK: 1, DEPART: 2, HUNT: 3, FORGE: 4, NEXT: 5, DONE: 6 };
const tutOn = () => !!G.save && G.save.tut < TUT.DONE && Settings.data.tips !== false;
function tutSet(n) {
  if (!G.save || n <= G.save.tut) return;
  G.save.tut = n; persist(); tutGoal();
}
// The village goal line, under the place name.
function tutGoal() {
  const el = $('goal'), s = G.save;
  const show = tutOn() && s.tut >= TUT.TALK && G.mode === 'village' && V && V.id === 'village';
  el.hidden = !show; if (!show) return;
  $('goalText').textContent = s.tut === TUT.TALK ? 'Talk to Kleon the Herald'
    : s.tut === TUT.FORGE ? 'Forge new gear at Dion the Smith'
    : s.tut === TUT.NEXT ? 'Take your next hunt from Kleon'
    : 'Pick a hunt from Kleon or the notice board';
}
function tutTargetNpc() {
  if (!tutOn() || G.save.tut < TUT.TALK || !V || V.id !== 'village') return null;
  return V.npcs.find(n => n.id === (G.save.tut === TUT.FORGE ? 'smith' : 'herald')) || null;
}
// A bobbing gold arrow over a spot, or on the edge of the screen pointing its way when it's off screen.
function drawPointer(S, x, y, lift) {
  const [sx, sy] = S(x, y), bob = Math.floor(G.time * 3) % 2, M = 12;
  if (sx > M && sx < VIEW_W - M && sy - lift > M && sy < VIEW_H - M) {
    const top = sy - lift - bob;
    ctx.fillStyle = OUTLINE; ctx.fillRect(sx - 4, top - 1, 9, 7);
    ctx.fillStyle = '#ebc152'; ctx.fillRect(sx - 3, top, 7, 2); ctx.fillRect(sx - 2, top + 2, 5, 1); ctx.fillRect(sx - 1, top + 3, 3, 1); ctx.fillRect(sx, top + 4, 1, 1);
    return;
  }
  const px = VIEW_W / 2, py = VIEW_H / 2, a = Math.atan2(sy - 14 - py, sx - px);
  const k = Math.min((VIEW_W / 2 - M) / Math.abs(Math.cos(a) || 1e-6), (VIEW_H / 2 - M) / Math.abs(Math.sin(a) || 1e-6));
  const ex = px + Math.cos(a) * (k - bob), ey = py + Math.sin(a) * (k - bob);
  const tri = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r); ctx.lineTo(ex + Math.cos(a + 2.4) * r, ey + Math.sin(a + 2.4) * r); ctx.lineTo(ex + Math.cos(a - 2.4) * r, ey + Math.sin(a - 2.4) * r); ctx.closePath(); ctx.fill(); };
  tri(8, OUTLINE); tri(6, '#ebc152');
}
function tutDraw(S) {
  const n = tutTargetNpc(); if (!n || G.dialog || G.cutscene) return;
  if (V.target && V.target.id === n.id) return;                          // the normal "talk" marker is already showing
  drawPointer(S, n.x, n.y, 32);
}
// Called when a panel opens and when a hunt starts or ends.
function tutPanel(kind) {
  if (!G.save) return;
  if (kind === 'quests' && G.save.tut === TUT.TALK) tutSet(TUT.DEPART);
  if (kind === 'armory' && G.save.tut === TUT.FORGE) tutSet(TUT.NEXT);
}
function tutStart() {
  if (!G.save || q.def.prologue) return;
  const first = tutOn() && G.save.tut <= TUT.DEPART;
  if (G.save.tut >= TUT.TALK && G.save.tut <= TUT.DEPART) tutSet(TUT.HUNT);
  else if (G.save.tut >= TUT.FORGE && G.save.tut < TUT.DONE && Object.keys(G.save.cleared).length) tutSet(TUT.DONE);
  if (first) { showHint('Clear every wave to finish the hunt. The parts you pick up go home with you', 7); $('hint').classList.add('tut'); }
  tutH = { t: 0 };
}
function tutEnd(win) {
  if (!G.save || (q && q.def.prologue)) return;
  if (G.save.tut === TUT.HUNT) { if (win) tutSet(TUT.FORGE); else { G.save.tut = TUT.DEPART; persist(); } }
  tutPulse(null);
}
function tutPulse(id) { for (const b of document.querySelectorAll('#touchBtns button')) b.classList.toggle('pulse', b.id === id || (id === 'dodge' && b.dataset.act === 'dodge')); }
// In any hunt: the road's lessons, or a one-time word about a weapon skill or a shield the first time you carry one.
let tutH = { t: 0 };
function tutHunt(dt) {
  if (!q || q.phase === 'victory' || q.phase === 'defeat') return;
  if (q.def.prologue) { if (Settings.data.tips !== false) proTick(dt); return; }
  if (Settings.data.tips === false) return;
  const s = G.save, p = q.player, h = s.hints;
  tutH.t += dt; if (tutH.t < 3 || !$('hint').hidden) return;
  const ab = p.st.weapon.ability;
  if (ab && !h.skill) {
    h.skill = true; persist(); tutPulse(touchMode ? 'tAbil' : null); setTimeout(() => tutPulse(null), 6000);
    showHint(touchMode ? `Tap <b>Skill</b> for your weapon’s skill: ${esc(ABILITIES[ab].name)}` : `${kbd(Input.bind.ability[0])} <b>${esc(ABILITIES[ab].name)}</b> · your weapon’s skill. It recharges after each use`, 7);
    $('hint').classList.add('tut');
  } else if (p.st.shield && !h.guard) {
    h.guard = true; persist(); tutPulse(touchMode ? 'tGuard' : null); setTimeout(() => tutPulse(null), 6000);
    showHint(touchMode ? 'Hold <b>Guard</b> to block with your shield. Tap it just as a hit lands for a perfect block' : `Hold ${kbd(Input.bind.guard[0])} to <b>block</b> with your shield · tap it just as a hit lands for a perfect block`, 8);
    $('hint').classList.add('tut');
  }
}
// The forge's first visit: say what it's for.
function tutForgeNote() {
  return tutOn() && G.save.tut === TUT.NEXT ? `<p class="tutnote">Parts from your hunts become gear here. Anything you have the parts and drachmae for has a <b>Craft</b> button. Better armor means monsters hurt less.</p>` : '';
}
