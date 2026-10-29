/* ============================== MENUS ==================================== */
function hideScreens() { document.querySelectorAll('.screen').forEach(s => { s.hidden = true; }); }
function show(id) { if (id === 'scrTitle' || id === 'scrSlots') Music.play('title'); $('stage').hidden = true; document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; }); $(id).scrollTop = 0; }
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }
function persist(urgent = false) { if (G.save) Store.save(G.slot, G.save, urgent); }
// A short fade to black between places, hunts and menus.
let fading = false;
function fadeTo(fn) {
  const f = $('fader');
  if (fading || matchMedia('(prefers-reduced-motion: reduce)').matches) { fn(); return; }
  fading = true; f.classList.add('on'); Input.down.clear();
  setTimeout(() => { try { fn(); } finally { requestAnimationFrame(() => { f.classList.remove('on'); fading = false; }); } }, 190);
}

function drawTitleArt() {
  const c = $('titleArt'), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#cf6a2f'; x.fillRect(0, 40, 272, 1); x.fillRect(0, 42, 272, 1);
  const put = (frames, fi, px, py, flip) => { const fr = (typeof frames === 'string' ? SPR[frames] : frames)[fi]; x.drawImage(flip ? fr.f : fr.n, Math.round(px - fr.w / 2), Math.round(py - fr.h + 1)); };
  put(heroFrames({ head: 'hoplite', chest: 'hoplite', legs: 'hoplite', feet: 'hoplite' }), 0, 14, 39, false);
  x.fillStyle = '#e9c04f'; for (let i = 0; i < 6; i++) x.fillRect(21 + i, 31 - i, 1, 1);
  put('bandit', 0, 36, 39, true); put('wolf', 0, 52, 39, true); put('satyr', 0, 66, 39, true); put('owl', 0, 80, 26, true);
  put('crab', 0, 94, 39, true); put('skeleton', 0, 107, 39, true); put('cyclops', 0, 126, 39, true);
  const gods = ['hermes', 'artemis', 'athena', 'ares', 'poseidon', 'hades', 'zeus'];
  gods.forEach((g, i) => put(g, 0, 148 + i * 14, g === 'zeus' || g === 'hermes' ? 36 : 39, true));
  put('atlas', 2, 256, 41, true);
  const gx = 256, gy = 6; x.fillStyle = '#0a0d1e'; for (let yy = -6; yy <= 6; yy++) { const w = Math.round(Math.sqrt(36 - yy * yy)); x.fillRect(gx - w, gy + yy, w * 2 + 1, 1); }
  x.fillStyle = '#2c3a78'; for (let yy = -5; yy <= 5; yy++) { const w = Math.round(Math.sqrt(25 - yy * yy)); x.fillRect(gx - w, gy + yy, w * 2 + 1, 1); }
  x.fillStyle = '#e9c04f'; x.fillRect(gx - 5, gy, 11, 1); x.fillStyle = '#ffffff'; x.fillRect(gx - 2, gy - 3, 1, 1); x.fillRect(gx + 2, gy + 2, 1, 1);
}
// Play: straight back into the last save (or a new hunter in the first free slot). Saves: the full list.
async function playNow() {
  await Store.ready; if (Store.user) await Store.refresh();
  let n = Settings.data.lastSlot, s = n ? await Store.load(n) : null;
  if (!s) { n = 0; for (let k = 1; k <= 3; k++) { const t = await Store.load(k); if (t) { n = k; s = t; break; } } }
  if (!n) n = 1;
  G.slot = n; G.save = s || newSave(); G.selQuest = null; G.boardRank = G.forgeRank = G.stashRank = null;
  if (!s) persist(true);
  rememberSlot(n);
  fadeTo(() => enterVillage('start'));
}
function rememberSlot(n) { Settings.data.lastSlot = n; Settings.save(); }
async function updateTitleSub() {
  await Store.ready;
  const n = Settings.data.lastSlot, s = n ? await Store.load(n) : null;
  $('titleSub').textContent = s ? `Continues save ${n} · ${GODS.filter(g => godRank(g.id, s) >= 0).length} of 12 gods hunted${s.rank ? ' · ' + RANKS[s.rank].name : ''}` : '';
}

async function renderSlots() {
  const list = $('slotList'); list.innerHTML = '';
  $('saveStatus').textContent = 'Loading saves…';
  await Store.ready;
  if (Store.user) await Store.refresh();
  renderAccount();
  $('saveStatus').textContent = Store.user ? 'Saves sync to your account and also stay in this browser.'
    : CG.data ? 'CrazyGames keeps your saves. Sign in to CrazyGames and they follow you to any device.'
    : Store.cloud ? 'Saves sync to your Claude account and also stay in this browser.'
    : Store.api && Store.localOk ? 'Saves stay in this browser on this device until you sign in.'
    : Store.localOk ? 'Saves stay in this browser on this device. To move a save, use Show save code at your home in the village.'
    : 'This browser is blocking storage, so progress is lost when you close the page. Copy your save code from your home in the village to keep it.';
  const saves = [];
  for (let n = 1; n <= 3; n++) saves.push(await Store.load(n));
  list.innerHTML = '';
  saves.forEach((sv, i) => list.appendChild(slotCard(i + 1, sv)));
}
/* ---- accounts (only on your own website) ---- */
let acctMode = null, acctMsg = '', acctBusy = false;
function accountHTML() {
  if (!Store.api) return '';
  const msg = acctMsg ? `<p class="acct-msg">${esc(acctMsg)}</p>` : '';
  if (Store.user) return `<div class="acct-row"><span>Signed in as <b>${esc(Store.user)}</b></span><button class="btn ghost small" type="button" data-acct="out">Sign out</button></div>${msg}`;
  if (!acctMode) return `<div class="acct-row"><span>Sign in to keep your saves on any device.</span><button class="btn small" type="button" data-acct="in">Sign in</button><button class="btn ghost small" type="button" data-acct="new">Create account</button></div>${msg}`;
  const create = acctMode === 'new';
  return `<form class="acct-form" data-acctform="${acctMode}" novalidate>
      <label>Name<input name="name" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20"></label>
      <label>Password<input name="password" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" maxlength="100"></label>
      <button class="btn small" type="submit" ${acctBusy ? 'disabled' : ''}>${acctBusy ? 'One moment…' : create ? 'Create account' : 'Sign in'}</button>
      <button class="btn ghost small" type="button" data-acct="cancel">Cancel</button>
    </form>
    ${create ? '<p class="acct-note">Names are 3 to 20 letters, numbers or underscores. There\u2019s no email, so a forgotten password can\u2019t be reset.</p>' : ''}${msg}`;
}
function renderAccount() {
  const box = $('acctBox'); box.hidden = !Store.api; box.innerHTML = accountHTML();
  const home = $('acctHome'); if (home) home.innerHTML = accountHTML();
  const f = document.querySelector('[data-acctform] input[name="name"]'); if (f && !acctBusy && document.activeElement !== f && !f.value) f.focus();
}
// Signing in or out while playing takes you back to the save list, since your saves change.
// The save in memory always belongs to whoever was signed in before, so drop it: otherwise it could be written into the new account.
function afterAccountChange() { const playing = G.mode === 'panel' || G.mode === 'village' || G.mode === 'quest'; q = null; G.save = null; G.slot = null; if (playing) { G.mode = 'slots'; G.paused = false; $('pause').hidden = true; show('scrSlots'); } renderSlots(); }
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-acct]'); if (!b || acctBusy) return;
  const a = b.dataset.acct; Sound.init(); Sound.play('click');
  if (a === 'in' || a === 'new') { acctMode = a; acctMsg = ''; renderAccount(); }
  else if (a === 'cancel') { acctMode = null; acctMsg = ''; renderAccount(); }
  else if (a === 'out') {
    acctBusy = true; if (G.save) persist(true);
    await Store.signOut(); acctBusy = false; acctMode = null; acctMsg = 'Signed out. These are the saves kept in this browser.';
    afterAccountChange();
  }
});
document.addEventListener('submit', async ev => {
  const f = ev.target.closest('[data-acctform]'); if (!f) return;
  ev.preventDefault(); if (acctBusy) return;
  const name = f.elements.name.value.trim(), password = f.elements.password.value, create = f.dataset.acctform === 'new';
  if (!name || !password) { acctMsg = 'Enter a name and a password.'; renderAccount(); return; }
  acctBusy = true; acctMsg = ''; renderAccount();
  const ff = document.querySelector('[data-acctform]'); if (ff) { ff.elements.name.value = name; ff.elements.password.value = password; }
  try {
    if (G.save) persist(true);
    const r = await Store.signIn(name, password, create);
    acctMode = null;
    acctMsg = (create ? 'Account made. ' : 'Signed in. ') + (r.moved.length ? `Save ${r.moved.join(' and ')} from this browser moved into your account. ` : '') +
      (r.kept.length ? `Your account already had something in save ${r.kept.join(' and ')}, so this browser\u2019s copy stays here for when you\u2019re signed out.` : '');
    acctBusy = false; afterAccountChange();
  } catch (e) {
    acctBusy = false; acctMsg = e.message; renderAccount();
    const f2 = document.querySelector('[data-acctform]'); if (f2) { f2.elements.name.value = name; f2.elements.password.focus(); }
  }
});
function armorLabel(eq) {
  const sets = new Set(SLOTS.map(s => eq[s]));
  return sets.size === 1 ? `${ARMOR_SETS[eq.chest].name} armor` : 'Mixed armor';
}
function slotCard(n, s) {
  const el = document.createElement('article'); el.className = 'slot' + (s ? '' : ' empty');
  const head = `<div class="slot-n">${n}</div>`;
  if (s) {
    const base = QUESTS.filter(qd => qd.rank === 0), cleared = base.filter(qd => s.cleared[qd.id]).length, gods = [...GODS, ...SIDE_GODS].filter(g => godRank(g.id, s) >= 0).length, titans = TITANS.filter(t => godRank(t.id, s) >= 0).length;
    el.innerHTML = `${head}<div class="slot-main"><b>${fmtMoney(s.money)} dr${s.rank ? `<span class="rank-tag" data-rank="${s.rank}">${RANKS[s.rank].name}</span>` : ''}</b><span>${gods} of ${GODS.length + SIDE_GODS.length} gods hunted${s.stairs ? ` · ${titans} of 8 Titans` : ''}${s.cleared[TYPHON_Q] ? ' · Typhon slain' : ''} · ${cleared} of ${base.length} quests cleared · ${fmtPlay(s.playtime)} played</span><span class="muted">${esc(WEAPONS[s.weapon].name)} · ${esc(armorLabel(s.equip))} · saved ${relTime(s.savedAt)}</span></div>
      <div class="slot-actions"><button class="btn" type="button" data-a="continue">Continue</button><button class="btn ghost" type="button" data-a="delete">Delete</button></div>`;
  } else {
    el.innerHTML = `${head}<div class="slot-main"><b style="color:var(--bone-dim)">Empty</b><span class="muted">Start a new hunter here.</span></div><div class="slot-actions"><button class="btn" type="button" data-a="new">New game</button></div>`;
  }
  el.addEventListener('click', async ev => {
    const btn = ev.target.closest('button'); if (!btn) return;
    const a = btn.dataset.a; Sound.init(); Sound.play('click');
    if (a === 'continue') { G.slot = n; G.save = s; G.selQuest = null; G.boardRank = G.forgeRank = G.stashRank = null; rememberSlot(n); fadeTo(() => enterVillage('start')); }
    else if (a === 'new') { G.slot = n; G.save = newSave(); persist(true); G.selQuest = null; G.boardRank = G.forgeRank = G.stashRank = null; rememberSlot(n); fadeTo(() => enterVillage('start')); }
    else if (a === 'delete') { el.querySelector('.slot-actions').innerHTML = `<span class="warn">Delete save ${n} for good?</span><button class="btn danger" type="button" data-a="confirmdel">Delete</button><button class="btn ghost" type="button" data-a="canceldel">Keep it</button>`; }
    else if (a === 'confirmdel') { await Store.del(n); renderSlots(); }
    else if (a === 'canceldel') renderSlots();
  });
  return el;
}

function renderHub() {
  const s = G.save, info = PANEL_INFO[G.panel] || PANEL_INFO.quests;
  $('hubTitle').textContent = G.panelTitle || (G.panel === 'quests' && netOn() ? 'Multiplayer quests' : info.title);
  $('hubMoney').textContent = fmtMoney(s.money);
  const eqBox = $('hubEquip');
  eqBox.hidden = G.panel !== 'armory';
  if (G.panel === 'armory') {
    const st = playerStats(), w = st.weapon, sh = s.shield ? SHIELDS[s.shield] : null;
    const bonus = st.bonuses.map(b => { const set = ARMOR_SETS[b.set], perks = b.n === 4 ? set.four : set.two; return `${set.name} ${b.n}: ${Object.entries(perks).map(([k, v]) => PERK_TEXT[k](v)).join(', ')}`; });
    eqBox.innerHTML = `
      <div class="preview"><canvas id="pvCanvas" width="24" height="32" aria-label="Your hunter"></canvas>
        <div><div class="stats"><span>Health <b>${st.maxHp}</b></span><span>Defense <b>${st.def}</b></span><span>Damage <b>${Math.round(w.dmg * st.mul)}</b></span><span>Speed <b>${Math.round(st.speed / 80 * 100)}%</b></span></div>
        <div class="setbonus" style="margin-top:6px">${bonus.length ? bonus.map(b => `<span class="on">${esc(b)}</span>`).join('') : '<span class="off">No set bonus. Wear 2 or 4 pieces of one set.</span>'}</div></div></div>
      <div class="equip-card"><img class="px-icon" alt="" src="${icon(s.weapon)}"><div><span class="lbl">Weapon</span><b>${esc(w.name)}</b><span>${KINDS[w.kind].label} · ${Math.round(w.dmg * st.mul)} damage${w.ability ? ' · ' + ABILITIES[w.ability].name : ''}</span></div></div>
      <div class="equip-card">${sh ? `<img class="px-icon" alt="" src="${icon(s.shield)}">` : '<span class="px-icon"></span>'}<div><span class="lbl">Shield</span><b>${sh ? esc(sh.name) : 'None'}</b><span>${sh ? (st.shield ? `Blocks ${Math.round(sh.block * 100)}% from the front` : 'Not usable with a two-handed weapon') : 'Craft one in the Shields tab'}</span></div></div>`;
    drawPreview($('pvCanvas'), s.equip, s.shield, s.weapon);
  }
  const body = $('hubBody');
  if (G.panel === 'armory') body.innerHTML = renderArmory();
  else if (G.panel === 'stash') body.innerHTML = renderStash();
  else if (G.panel === 'options') body.innerHTML = renderOptions();
  else if (G.panel === 'shrine') body.innerHTML = renderShrine();
  else if (G.panel === 'market') body.innerHTML = renderMarket();
  else if (G.panel === 'oracle') { body.innerHTML = renderOracle(); orLoad(); }
  else body.innerHTML = renderBoard();
}
function questCard(qd) {
  const s = G.save, un = isUnlocked(qd), done = s.cleared[qd.id];
  const status = !un ? `<span class="chip">Locked</span>` : done ? `<span class="chip done">Cleared ×${done}</span>` : qd.final ? `<span class="chip urgent">Final</span>` : qd.titan ? `<span class="chip urgent">Titan</span>` : qd.urgent ? `<span class="chip urgent">God</span>` : qd.side ? `<span class="chip urgent">Side god</span>` : `<span class="chip new">New</span>`;
  return `<button type="button" class="qcard ${qd.id === G.selQuest ? 'sel' : ''} ${un ? '' : 'locked'}" data-quest="${qd.id}" data-rank="${qd.rank}">
    <span class="god">${esc(ARENAS[qd.arena].name)}</span><span class="stars">${'★'.repeat(qd.stars)}</span>
    <span class="name">${esc(qd.name)}</span><span class="st">${s.chests[qd.id] ? '<span class="chip" title="Hidden cache found">Cache ✓</span>' : ''}${status}</span></button>`;
}
// The quest board. Ranks only show as tabs once High Rank is open; before that there's no rank talk at all.
function renderBoard() {
  const s = G.save;
  if (G.boardRank === null || G.boardRank > s.rank) G.boardRank = s.rank;
  const r = G.boardRank, mine = QUESTS.filter(qd => qd.rank === r);
  if (G.boardTitans) { G.boardTitans = false; const t = mine.find(qd => qd.titan && isUnlocked(qd) && !s.cleared[qd.id]) || mine.filter(qd => qd.titan && isUnlocked(qd)).pop(); if (t) G.selQuest = t.id; }
  if (!G.selQuest || !QUEST_BY_ID[G.selQuest] || QUEST_BY_ID[G.selQuest].rank !== r || !isUnlocked(QUEST_BY_ID[G.selQuest])) G.selQuest = (mine.find(x => isUnlocked(x) && !s.cleared[x.id]) || mine.filter(x => isUnlocked(x)).pop() || mine[0]).id;
  let html = '', shownLock = false, hidden = 0;
  for (const g of GODS) {
    const qs = mine.filter(qd => qd.god === g.id), open = qs.some(qd => isUnlocked(qd));
    if (!open) {
      if (!shownLock) { shownLock = true; const prev = GODS[GODS.indexOf(g) - 1]; html += `<div class="qlock">${esc(g.name)} · ${prev ? 'beat ' + esc(prev.name) + ' to unlock' : 'locked'}</div>`; }
      else hidden++;
      continue;
    }
    html += `<p class="chapter">${esc(g.name)}</p>` + qs.map(questCard).join('');
    const bq = qs.find(qd => qd.boss);
    for (const side of mine.filter(qd => qd.side && qd.requires.includes(bq.id))) if (isUnlocked(side) || s.cleared[bq.id]) html += `<p class="chapter">${esc(godName(side.god))}</p>` + questCard(side);
  }
  if (hidden) html += `<div class="qlock">${hidden} more god${hidden > 1 ? 's' : ''} further up the mountain</div>`;
  // The Titans: only once the stairway under the temple has opened.
  const titans = mine.filter(qd => qd.titan && !qd.final), fin = mine.find(qd => qd.final);
  if (s.stairs && titans.some(qd => isUnlocked(qd))) {
    html += `<p class="rank titans">Beneath the temple</p>`;
    let lockShown = false;
    for (const qd of titans) { if (isUnlocked(qd) || s.cleared[qd.id]) html += questCard(qd); else if (!lockShown) { lockShown = true; html += `<div class="qlock">${esc(godName(qd.god))} · beat the Titan before to unlock</div>`; } }
  } else if (s.stairs && r > 0) html += `<div class="qlock">The Titans · hunt every god on this rank first</div>`;
  // Typhon: God Rank only, once every god and Titan on it has fallen
  if (fin && (isUnlocked(fin) || s.cleared[fin.id])) html += `<p class="rank titans final">The last hunt</p>` + questCard(fin);
  else if (fin && s.stairs) html += `<div class="qlock">Something older than the Titans is stirring · hunt every god and Titan on God Rank first</div>`;
  const qd = QUEST_BY_ID[G.selQuest], un = isUnlocked(qd);
  const mons = questMonsters(qd).map(t => `<span class="chip">${esc(ENEMIES[t].name)}</span>`).join('') + (qd.boss ? `<span class="chip urgent">${esc(BOSSES[qd.boss].name)}</span>` : '');
  const parts = questParts(qd).map(id => `<span class="chip"><img alt="" src="${icon(id)}"><span class="r${ITEMS[id].rarity}">${esc(ITEMS[id].name)}</span></span>`).join('');
  const needs = qd.requires.filter(x => !s.cleared[x]).map(x => QUEST_BY_ID[x].name);
  const needText = qd.final ? 'every god and Titan on God Rank' : needs.length > 3 ? 'every god on this rank' : needs.map(esc).join(' and ');
  const tabs = s.rank > 0 ? `<div class="board-top"><div class="seg">${RANKS.slice(0, s.rank + 1).map(R => `<button type="button" data-boardrank="${R.id}" data-rank="${R.id}" aria-pressed="${r === R.id}">${R.name}</button>`).join('')}</div>${r > 0 ? `<span class="muted">${r === 1 ? 'Everything hits harder and moves faster. New gear forms drop here.' : 'The gods stop holding back. Below 30% health they go berserk.'}</span>` : ''}</div>` : '';
  return `${tabs}<div class="board"><div class="qlist">${html}</div>
    <div class="qdetail">
      <div><p class="eyebrow">${r > 0 ? `<span style="color:${RANKS[r].col}">${RANKS[r].name}</span> · ` : ''}${esc(qd.final ? 'The last hunt' : qd.titan ? 'Titan' : godName(qd.god))} · ${'★'.repeat(qd.stars)}</p><h3>${esc(qd.name)}</h3></div>
      <p>${esc(qd.desc)}</p>
      <div class="facts"><div><span>Reward</span><b class="gold">${fmtMoney(qd.reward)} dr</b></div><div><span>Waves</span><b>${qd.waves.length}${qd.boss ? ' + ' + (qd.final ? 'Typhon' : qd.titan ? 'Titan' : 'boss') : ''}</b></div><div><span>Best time</span><b>${s.best[qd.id] ? fmtTime(s.best[qd.id]) : '—'}</b></div><div><span>Hidden cache</span><b class="${s.chests[qd.id] ? 'good' : ''}">${s.chests[qd.id] ? 'Found' : 'Not found'}</b></div></div>
      <div><p class="sub">Monsters</p><div class="chips">${mons}</div></div>
      <div><p class="sub">Parts you can find</p><div class="chips">${parts}</div></div>
      <div class="row">${un ? `<button class="btn${tutOn() && s.tut === TUT.DEPART ? ' pulse' : ''}" type="button" data-depart="${qd.id}"${netOn() && !netHost() ? ' disabled' : ''}>${netOn() ? (netHost() ? 'Post to the room' : 'The host picks the hunt') : 'Depart'}</button>${s.blessing ? '<span class="muted">Hestia is watching over you.</span>' : ''}` : `<button class="btn" type="button" disabled>Locked</button><span class="muted">${qd.titan && !s.stairs ? 'Something under the temple has to wake first.' : `Clear ${needText} first.`}</span>`}</div>
    </div></div>`;
}
function canCraft(rec) { return G.save.money >= rec.cost && Object.entries(rec.items).every(([id, n]) => (G.save.inv[id] || 0) >= n); }
function recipeChips(rec) {
  const parts = Object.entries(rec.items).map(([id, n]) => { const have = G.save.inv[id] || 0; return `<span class="chip ${have >= n ? 'ok' : 'short'}"><img alt="" src="${icon(id)}">${esc(ITEMS[id].name)} <b>${have}/${n}</b></span>`; }).join('');
  return parts + `<span class="chip ${G.save.money >= rec.cost ? 'ok' : 'short'}"><b>${fmtMoney(rec.cost)}</b> dr</span>`;
}
// The smith's refinement: what the next + costs, or a note that it's maxed out.
const refineTag = lv => lv ? ` <span class="refine-tag">+${lv}</span>` : '';
function refineRow(kind, id) {
  const lv = refineLevel(id), what = kind === 'weapon' ? 'damage' : kind === 'shield' ? 'guard' : 'defense for every piece';
  if (lv >= REFINE_MAX) return `<div class="refine"><div class="refine-top"><b>Fully refined</b><span>+${Math.round(REFINE_GAIN[kind] * 100 * lv)}% ${what}</span></div></div>`;
  const rec = refineRecipe(kind, id, lv);
  return `<div class="refine"><div class="refine-top"><b>Refine to +${lv + 1}</b><span>+${Math.round(REFINE_GAIN[kind] * 100)}% ${what} each step, up to +${REFINE_MAX}</span></div>
    <div class="chips">${recipeChips(rec)}</div><button class="btn ghost small" type="button" data-refine="${kind}:${id}" ${canCraft(rec) ? '' : 'disabled'}>Refine</button></div>`;
}
function delta(v, base) { const d = Math.round(v - base); if (!d) return ''; return ` <span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`; }
// Gear shows up in the forge as you reach its tier, so the list doesn't start out a wall of locked stuff.
// Gear shows up in the forge once you've cleared hunts that drop every part in its recipe (its monsters, god or Titan,
// summons included), so the list only holds things you've actually fought for.
let PART_SRC = null;
function partSources() {
  if (PART_SRC) return PART_SRC;
  PART_SRC = {};
  const add = (id, qid) => (PART_SRC[id] = PART_SRC[id] || []).push(qid);
  for (const qd of QUESTS) {
    for (const id of questParts(qd)) add(id, qd.id);
    const B = qd.boss && BOSSES[qd.boss];
    if (B && B.summons) for (const S of B.summons) for (const t of S.types) for (const l of (ENEMIES[t] ? ENEMIES[t].loot : [])) add(rid(l[0], qd.rank), qd.id);
  }
  return PART_SRC;
}
const partKnown = id => { const src = partSources()[id]; return !src || src.some(qid => G.save.cleared[qid]); };
function gearVisible(rec, owned) { return owned || !rec || Object.keys(rec.items).every(partKnown); }
const rankTag = r => r ? `<span class="rk" data-rank="${r}">${RANKS[r].name}</span>` : '';
// Which gear the forge shows: the chosen rank, and optionally only what you can forge right now or already own.
function forgeShows(rank, owned, craftable) { return rank === G.forgeRank && (G.forgeFilter === 'all' || (G.forgeFilter === 'owned' ? owned : !owned && craftable)); }
function renderArmory() {
  const s = G.save, tab = G.armoryTab;
  if (G.forgeRank === null || G.forgeRank > s.rank) G.forgeRank = s.rank;
  const ranks = s.rank > 0 ? `<div class="seg">${RANKS.slice(0, s.rank + 1).map(R => `<button type="button" data-forgerank="${R.id}" data-rank="${R.id}" aria-pressed="${G.forgeRank === R.id}">${R.name}</button>`).join('')}</div>` : '';
  const filters = `<div class="seg">${[['all', 'All'], ['craft', 'Can forge'], ['owned', 'Owned']].map(([k, l]) => `<button type="button" data-forgefilter="${k}" aria-pressed="${G.forgeFilter === k}">${l}</button>`).join('')}</div>`;
  const seg = `<div class="row" style="justify-content:space-between"><div class="seg">${['weapons', 'armor', 'shields'].map(t => `<button type="button" data-armtab="${t}" aria-pressed="${tab === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>${ranks}${filters}</div>`;
  let cards = '', hidden = 0;
  if (tab === 'weapons') {
    const cur = playerStats().weapon;
    for (const [id, w] of Object.entries(WEAPONS).sort((a, b) => b[1].wt - a[1].wt)) {
      const owned = s.weapons.includes(id);
      if (!forgeShows(w.rank, owned, w.recipe && canCraft(w.recipe))) continue;
      if (!gearVisible(w.recipe, owned)) { hidden++; continue; }
      const eq = s.weapon === id, K = KINDS[w.kind], lv = owned ? refineLevel(id) : 0, dmg = Math.round(w.dmg * (1 + REFINE_GAIN.weapon * lv));
      const act = eq ? `<button class="btn ghost small" type="button" disabled>Equipped</button>` : owned ? `<button class="btn small" type="button" data-equip="weapon:${id}">Equip</button>` : `<button class="btn small" type="button" data-craft="weapon:${id}" ${canCraft(w.recipe) ? '' : 'disabled'}>Craft</button>`;
      cards += `<article class="gear ${eq ? 'equipped' : ''}">
        <div class="gear-head"><img class="px-icon" alt="" src="${icon(id)}"><div><b>${esc(w.name)}${refineTag(lv)}</b><span>${K.label}${owned ? ' · owned' : ''}${rankTag(w.rank)}</span></div></div>
        <div class="stats"><span>Damage <b>${dmg}</b>${eq ? '' : delta(dmg, cur.dmg)}</span><span>Speed <b>${K.cooldown <= .2 ? 'Very fast' : K.cooldown <= .35 ? 'Fast' : K.cooldown <= .5 ? 'Medium' : 'Slow'}</b></span><span>Reach <b>${K.melee ? (K.reach >= 30 ? 'Long' : K.reach >= 20 ? 'Medium' : 'Short') : 'Ranged'}</b></span></div>
        <p class="desc">${esc(w.desc)} ${esc(K.blurb)}</p>
        ${w.ability ? `<div class="ability"><b>${esc(ABILITIES[w.ability].name)}</b> · ${esc(ABILITIES[w.ability].desc)} (${Math.round(ABILITIES[w.ability].cd * (w.cdMul || 1) * 10) / 10}s cooldown)</div>` : ''}
        ${owned ? refineRow('weapon', id) : `<div class="chips">${recipeChips(w.recipe)}</div>`}
        <div class="actions">${act}</div></article>`;
    }
  } else if (tab === 'armor') {
    const counts = setCounts(s.equip);
    for (const [sid, set] of Object.entries(ARMOR_SETS).sort((a, b) => b[1].ch - a[1].ch || !!b[1].god - !!a[1].god)) {
      const ownedAny = SLOTS.some(sl => s.pieces.includes(sid + ':' + sl));
      const craftAny = SLOTS.some(sl => { const P = PIECES[sid + ':' + sl]; return P.recipe && !s.pieces.includes(P.id) && canCraft(P.recipe); });
      if (!forgeShows(set.rank, ownedAny, craftAny)) continue;
      if (!gearVisible(set.recipe, ownedAny)) { hidden++; continue; }
      const rl = refineLevel(sid), rdef = (P, l) => Math.round(P.def * (1 + REFINE_GAIN.armor * l)), rhp = (P, l) => Math.round(P.hp * (1 + .04 * l));
      const rows = SLOTS.map(sl => {
        const P = PIECES[sid + ':' + sl], owned = s.pieces.includes(P.id), eq = s.equip[sl] === sid, cur = PIECES[s.equip[sl] + ':' + sl], cl = refineLevel(s.equip[sl]);
        const act = eq ? `<button class="btn ghost small" type="button" disabled>Equipped</button>` : owned ? `<button class="btn small" type="button" data-equip="piece:${P.id}">Equip</button>` : `<button class="btn small" type="button" data-craft="piece:${P.id}" ${canCraft(P.recipe) ? '' : 'disabled'}>Craft</button>`;
        return `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border-top:1px solid var(--line);padding-top:8px">
          <img class="px-icon" alt="" src="${icon(P.id)}" style="width:32px;height:32px">
          <div><span class="piece-slot">${SLOT_LABEL[sl]}</span><div class="stats"><span>Defense <b>${rdef(P, rl)}</b>${eq ? '' : delta(rdef(P, rl), rdef(cur, cl))}</span>${P.hp || cur.hp ? `<span>Health <b>${rhp(P, rl)}</b>${eq ? '' : delta(rhp(P, rl), rhp(cur, cl))}</span>` : ''}</div>
          ${P.perk === 'doubleDash' ? `<div class="setbonus" style="margin-top:4px"><span class="on">Double dash · dash twice in a row, but dashes recharge slower</span></div>` : ''}${owned || !P.recipe ? '' : `<div class="chips" style="margin-top:4px">${recipeChips(P.recipe)}</div>`}</div>${act}</div>`;
      }).join('');
      const n = counts[sid] || 0, allOwned = SLOTS.every(sl => s.pieces.includes(sid + ':' + sl));
      const lines = [];
      if (set.two) lines.push(`<span class="${n >= 2 ? 'on' : 'off'}">2 pieces: ${esc(Object.entries(set.two).map(([k, v]) => PERK_TEXT[k](v)).join(', '))}</span>`);
      if (set.four) lines.push(`<span class="${n >= 4 ? 'on' : 'off'}">4 pieces: ${esc(Object.entries(set.four).map(([k, v]) => PERK_TEXT[k](v)).join(', '))}</span>`);
      cards += `<article class="gear ${n === 4 ? 'equipped' : ''}">
        <div class="gear-head"><img class="px-icon" alt="" src="${icon(sid + ':chest')}"><div><b>${esc(set.name)} set${refineTag(rl)}</b><span>${set.god ? 'Made from ' + esc(godName(set.god)) : 'Armor'} · ${set.def} defense${set.hp ? ' · +' + set.hp + ' health' : ''} for all 4${rankTag(set.rank)}</span></div></div>
        <p class="desc">${esc(set.desc)}</p>
        ${lines.length ? `<div class="setbonus">${lines.join('')}</div>` : ''}
        ${rows}
        ${ownedAny && !set.start ? refineRow('armor', sid) : ''}
        ${allOwned && n < 4 ? `<div class="actions"><button class="btn small" type="button" data-wearset="${sid}">Equip the whole set</button></div>` : ''}</article>`;
    }
  } else {
    const oneHand = KINDS[WEAPONS[s.weapon].kind].oneHand;
    if (!oneHand) cards += `<div class="empty-note" style="grid-column:1/-1">Your ${esc(WEAPONS[s.weapon].name)} needs both hands. Shields work with swords and spears.</div>`;
    for (const [id, sh] of Object.entries(SHIELDS).sort((a, b) => b[1].ch - a[1].ch)) {
      const owned = s.shields.includes(id);
      if (!forgeShows(sh.rank, owned, canCraft(sh.recipe))) continue;
      if (!gearVisible(sh.recipe, owned)) { hidden++; continue; }
      const eq = s.shield === id, shl = owned ? refineLevel(id) : 0;
      const act = eq ? `<button class="btn ghost small" type="button" data-equip="shield:">Take off</button>` : owned ? `<button class="btn small" type="button" data-equip="shield:${id}">Equip</button>` : `<button class="btn small" type="button" data-craft="shield:${id}" ${canCraft(sh.recipe) ? '' : 'disabled'}>Craft</button>`;
      const perk = { reflect: 'Perfect blocks send projectiles back.', bash: 'Perfect blocks knock attackers flying.', wave: 'Perfect blocks push out a wave of water.', lightning: 'Perfect blocks call lightning down on the attacker.', timeslow: 'Perfect blocks freeze everything close to you for a moment.' }[sh.perk];
      cards += `<article class="gear ${eq ? 'equipped' : ''}">
        <div class="gear-head"><img class="px-icon" alt="" src="${icon(id)}"><div><b>${esc(sh.name)}${refineTag(shl)}</b><span>Shield${owned ? ' · owned' : ''}${rankTag(sh.rank)}</span></div></div>
        <div class="stats"><span>Blocks <b>${Math.round(Math.min(.97, sh.block + .01 * shl) * 100)}%</b></span><span>Guard <b>${Math.round(sh.meter * (1 + REFINE_GAIN.shield * shl)) * 10}</b></span><span>Dash recovery <b>+${sh.weight.toFixed(2)}s</b></span></div>
        <p class="desc">${esc(sh.desc)} Hold guard to block from the front. Ground attacks go under it.</p>
        ${perk ? `<div class="ability"><b>Perk</b> · ${esc(perk)}</div>` : ''}
        ${owned ? refineRow('shield', id) : `<div class="chips">${recipeChips(sh.recipe)}</div>`}
        <div class="actions">${act}</div></article>`;
    }
  }
  if (!cards) cards = `<div class="empty-note" style="grid-column:1/-1">${G.forgeFilter === 'craft' ? 'Nothing you can forge right now. Bring home more parts.' : G.forgeFilter === 'owned' ? 'You don’t own anything here yet.' : 'Nothing here yet.'}</div>`;
  return tutForgeNote() + seg + `<div class="grid" style="margin-top:12px">${cards}</div>` + (hidden ? `<p class="muted" style="margin:12px 0 0">More gear shows up here once you’ve fought the monsters and gods that drop its parts.</p>` : '');
}
function renderStash() {
  const s = G.save;
  if (G.stashRank === null || G.stashRank > s.rank) G.stashRank = s.rank;
  const all = Object.keys(ITEMS).filter(id => s.inv[id] > 0), ids = all.filter(id => ITEMS[id].rank === G.stashRank);
  const tabs = s.rank > 0 ? `<div class="board-top"><div class="seg">${RANKS.slice(0, s.rank + 1).map(R => `<button type="button" data-stashrank="${R.id}" data-rank="${R.id}" aria-pressed="${G.stashRank === R.id}">${R.name}<span class="n">${all.filter(id => ITEMS[id].rank === R.id).length}</span></button>`).join('')}</div></div>` : '';
  if (!ids.length) return tabs + `<div class="empty-note">${G.stashRank ? `No ${RANKS[G.stashRank].name} parts yet. ${RANKS[G.stashRank].name} monsters drop them.` : 'No parts yet. Monsters drop parts when they die; walk near them to pick them up.'}</div>`;
  const droppers = id => [...Object.values(ENEMIES), ...Object.values(BOSSES)].filter(e => e.loot.some(l => l[0] === baseId(id))).map(e => e.name);
  const usedIn = id => {
    const out = Object.values(WEAPONS).filter(g => g.recipe && g.recipe.items[id]).map(g => g.name);
    for (const [sid, set] of Object.entries(ARMOR_SETS)) if (set.recipe && set.recipe.items[id]) out.push(set.name + ' armor');
    for (const sh of Object.values(SHIELDS)) if (sh.recipe.items[id]) out.push(sh.name);
    return out;
  };
  return tabs + `<div class="stash">${ids.map(id => { const it = ITEMS[id]; return `<div class="mat"><img class="px-icon" alt="" src="${icon(id)}"><div><b class="r${it.rarity}">${esc(it.name)}</b><p>${esc(it.desc)}</p><p>From: ${esc([...new Set(droppers(id))].join(', '))}</p><p>Used in: ${esc(usedIn(id).join(', ') || (it.trophy ? 'nothing. It’s a trophy from the last hunt' : 'nothing yet'))}</p></div><span class="qty">${s.inv[id]}</span></div>`; }).join('')}</div>`;
}
// Market: potions have one fixed price per rank; it steps up at High and God Rank, the same way forge costs do.
const POTION_PRICE = { health: 150, strength: 200, speed: 175 };
const rankPrice = n => Math.round(n * ((RANKS[G.save.rank] || RANKS[0]).cost || 1) / 10) * 10;
function potionCost(id) { return rankPrice(POTION_PRICE[id] || 100); }
// Melita's parts: anything from a hunt you've cleared in your rank. Each part has one fixed price, set by the
// earliest hunt it drops in (a share of that hunt's pay, by rarity), so hunting for it always pays better.
const PART_SHARE = [0, .15, .35, .8, 2];
const partItem = id => ITEMS[id] || ITEMS[baseId(id)];
let PART_TIER = null;
function partCost(id) {
  if (!PART_TIER) { PART_TIER = {}; for (const qd of QUESTS) for (const p of questParts(qd)) PART_TIER[p] = Math.min(PART_TIER[p] ?? 99, Math.floor(qd.tier)); }
  return Math.max(20, Math.round(huntPay(PART_TIER[id] ?? 1) * PART_SHARE[partItem(id).rarity || 1] / 10) * 10);
}
function shopParts() {
  const s = G.save, set = new Set();
  for (const qd of QUESTS) if (s.cleared[qd.id] && qd.rank === s.rank) for (const id of questParts(qd)) if (partItem(id) && !partItem(id).trophy) set.add(id);   // your current rank's parts (trophies aren't for sale)
  return [...set].sort((a, b) => (rankOf(a) - rankOf(b)) || (partItem(a).rarity - partItem(b).rarity) || partItem(a).name.localeCompare(partItem(b).name));
}
function renderParts() {
  const s = G.save, ids = shopParts();
  if (!ids.length) return `<p class="muted" style="margin:16px 0 0">Clear a hunt and Melita will stock its parts here.</p>`;
  return `<p class="sub" style="margin:18px 0 6px">Parts</p><p class="muted" style="margin:0 0 10px">Parts from hunts you've cleared. Hunting them is cheaper, but this saves a trip.</p><div class="stash">${ids.map(id => {
    const it = partItem(id), cost = partCost(id);
    return `<div class="mat"><img class="px-icon" alt="" src="${icon(id)}"><div><b class="r${it.rarity}">${esc(it.name)}</b><p>You have ${s.inv[id] || 0}</p></div><button class="btn small" type="button" data-part="${id}" ${s.money < cost ? 'disabled' : ''}>${fmtMoney(cost)} dr</button></div>`;
  }).join('')}</div>`;
}
function renderMarket() {
  const s = G.save;
  const cards = Object.entries(POTIONS).map(([id, P]) => {
    const have = s.potions[id] || 0, cost = potionCost(id), full = have >= POTION_MAX;
    return `<article class="gear">
      <div class="gear-head"><img class="px-icon" alt="" src="${icon('potion:' + id)}"><div><b>${esc(P.name)}</b><span>${touchMode ? 'Tap it in the corner during a hunt' : 'Key ' + esc(codeLabel(Input.bind[P.key][0])) + ' in a hunt'}</span></div></div>
      <p class="desc">${esc(P.desc)}</p>
      <div class="stats"><span>You have <b>${have} / ${POTION_MAX}</b></span><span>Price <b class="gold">${fmtMoney(cost)} dr</b></span></div>
      <div class="actions"><button class="btn small" type="button" data-buy="${id}" ${full || s.money < cost ? 'disabled' : ''}>${full ? 'Bag full' : 'Buy'}</button></div></article>`;
  }).join('');
  return `<p class="muted" style="margin:0 0 12px">You can carry ${POTION_MAX} of each. ${touchMode ? 'Tap them in the corner of the screen during a hunt.' : 'Drink them during a hunt with the keys shown, or tap them in the corner of the screen.'}</p><div class="grid">${cards}</div>` + renderParts();
}
// The potions you're carrying, shown at the top of the screen during a hunt.
function updatePotionBar(p) {
  const s = G.save, F = p.fx;
  // only the potions you carry (or one still working), as small icons in the corner
  const html = Object.entries(POTIONS).map(([id, P]) => {
    const n = s.potions[id] || 0, t = id === 'strength' ? F.str : id === 'speed' ? F.spd : 0;
    if (!n && !(t > 0)) return '';
    return `<button type="button" class="pot ${n ? '' : 'empty'}" data-pot="${id}" aria-label="Drink ${esc(P.name)}" title="${esc(P.name)}"><kbd>${esc(codeLabel(Input.bind[P.key][0]))}</kbd><img alt="" src="${icon('potion:' + id)}"><b>${n}</b>${t > 0 ? `<i style="width:${(t / 60 * 100).toFixed(0)}%"></i>` : ''}</button>`;
  }).join('');
  setHTML('potionBar', html);
}
$('potionBar').addEventListener('pointerdown', ev => { const b = ev.target.closest('[data-pot]'); if (!b || !q || G.paused) return; ev.preventDefault(); drinkPotion(b.dataset.pot); });
function renderShrine() {
  const s = G.save, cost = offeringCost();
  return `<div class="opts"><div class="opt wide">
    <p>Make an offering and Hestia saves you once: the next time you fall in a hunt, you get back up with half your health. It lasts until it’s used.</p>
    <div class="row">${s.blessing ? `<button class="btn" type="button" disabled>Blessing active</button><span class="muted">Hestia is already watching over you.</span>`
      : `<button class="btn" type="button" data-offer="1" ${s.money >= cost ? '' : 'disabled'}>Make an offering (${fmtMoney(cost)} dr)</button>${s.money >= cost ? '' : '<span class="muted">Not enough drachmae.</span>'}`}</div>
  </div></div>`;
}
const volRow = (k, label) => { const v = Math.round((Settings.data[k] ?? 1) * 100); return `<div class="vol"><input type="range" min="0" max="100" step="5" value="${v}" data-vol="${k}" aria-label="${label}"><b>${v}%</b></div>`; };
function renderOptions() {
  const where = Store.user ? 'Your progress saves automatically to your account and to this browser.' : CG.data ? 'Your progress saves automatically with CrazyGames.' : Store.cloud ? 'Your progress saves automatically to your Claude account and to this browser.' : Store.localOk ? 'Your progress saves automatically to this browser.' : 'This browser blocks storage. Copy your save code before closing the page.';
  return `<div class="opts">
    ${Store.api ? `<div class="opt wide"><h3>Account</h3><div class="acct" id="acctHome">${accountHTML()}</div></div>` : ''}
    <div class="opt wide"><h3>Controls</h3>
      ${touchMode ? '' : `<p>Each action can have up to 3 keys. Click a key to remove it, or Add key and press the one you want. <kbd>Esc</kbd> <kbd>P</kbd> <kbd>F</kbd> <kbd>M</kbd> <kbd>Enter</kbd> are taken, and so are Search, Ctrl and Alt.</p>
      <div class="binds">${Object.keys(DEFAULT_BINDS).map(a => `<div class="bind-row"><span>${ACTION_LABELS[a]}</span><div class="bind-keys">${Input.bind[a].map(c => `<button class="keycap" type="button" data-unbind="${a}:${c}" aria-label="Remove ${esc(codeLabel(c))} from ${ACTION_LABELS[a]}">${esc(codeLabel(c))}<i>×</i></button>`).join('')}<button class="btn ghost small ${G.rebinding === a ? 'listening' : ''}" type="button" data-bind="${a}">${G.rebinding === a ? 'Press a key… (Esc cancels)' : 'Add key'}</button></div></div>`).join('')}</div>`}
      <div class="toggle"><span>Auto-aim: attacks turn toward the nearest enemy</span><button class="btn ghost small" type="button" data-opt="autoAim">${Settings.data.autoAim ? 'On' : 'Off'}</button></div>
      ${touchMode ? '' : `<div class="toggle"><span>Mouse and touchpad clicks attack and dodge</span><button class="btn ghost small" type="button" data-opt="mouse">${Settings.data.mouse ? 'On' : 'Off'}</button></div>`}
      ${touchMode ? '' : `<div class="row"><button class="btn ghost small" type="button" data-opt="resetkeys">Reset all controls</button><span class="muted" id="bindNote">${esc(bindNote)}</span></div>`}</div>
    <div class="opt"><h3>Sound and screen</h3>
      <div class="toggle"><span>Sound effects</span><button class="btn ghost small" type="button" data-opt="sound">${Settings.data.sound ? 'On' : 'Off'}</button></div>
      ${volRow('sfxVol', 'Sound effects volume')}
      <div class="toggle"><span>Music</span><button class="btn ghost small" type="button" data-opt="music">${Settings.data.music !== false ? 'On' : 'Off'}</button></div>
      ${volRow('musicVol', 'Music volume')}
      <div class="toggle"><span>Tips for new hunters</span><button class="btn ghost small" type="button" data-opt="tips">${Settings.data.tips !== false ? 'On' : 'Off'}</button></div>
      <div class="toggle"><span>Screen shake</span><button class="btn ghost small" type="button" data-opt="shake">${Settings.data.shake ? 'On' : 'Off'}</button></div>
      <div class="toggle"><span>Fullscreen${touchMode ? '' : ' <kbd>F</kbd>'}</span><button class="btn ghost small" type="button" data-opt="fullscreen">${document.fullscreenElement ? 'Exit' : 'Enter'}</button></div></div>
    <div class="opt"><h3>Your save</h3><p>${where}</p>
      <div class="row"><button class="btn small" type="button" data-opt="export">Show save code</button><button class="btn ghost small" type="button" data-opt="import">Load a save code</button></div>
      <div id="codeBox" hidden><textarea id="saveCode" readonly aria-label="Save code"></textarea><div class="row" style="margin-top:8px"><button class="btn small" type="button" data-opt="copy">Copy</button><span class="muted" id="copyNote"></span></div></div>
      <div id="importBox" hidden><textarea id="importCode" aria-label="Paste a save code" placeholder="Paste a save code here"></textarea><div class="row" style="margin-top:8px" id="importRow"><button class="btn small" type="button" data-opt="doimport">Load into save ${G.slot}</button><span class="muted" id="importNote"></span></div></div>
    </div>
    <div class="opt"><h3>Leave</h3><p>Your progress is already saved.</p><div class="row"><button class="btn ghost small" type="button" data-opt="title">Back to the save list</button>${G.save.legend ? '<button class="btn ghost small" type="button" data-opt="credits">Watch the credits</button>' : ''}</div></div>
  </div>`;
}
function encodeSave(s) { return 'OH1.' + btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
function decodeSave(str) { try { str = str.trim(); if (str.startsWith('OH1.')) str = str.slice(4); return sanitize(JSON.parse(decodeURIComponent(escape(atob(str))))); } catch (e) { return null; } }
let pendingImport = null;
let bindNote = '';
function saveBinds(b) { Settings.data.binds = b; Settings.save(); applyBinds(); renderTitleControls(); }
function captureBind(code) {
  const a = G.rebinding;
  if (code === 'Escape') { G.rebinding = null; bindNote = ''; renderHub(); return; }
  if (RESERVED.has(code)) { bindNote = `${codeLabel(code)} can't be used. Pick another key.`; renderHub(); return; }
  const b = JSON.parse(JSON.stringify(Input.bind));
  let moved = '';
  for (const [k, list] of Object.entries(b)) {
    const i = list.indexOf(code);
    if (i >= 0 && k !== a) {
      if (list.length === 1) { bindNote = `${codeLabel(code)} is the only key for ${ACTION_LABELS[k]}. Give that a different key first.`; G.rebinding = null; renderHub(); return; }
      list.splice(i, 1); moved = ` (taken from ${ACTION_LABELS[k]})`;
    }
  }
  let replaced = '';
  if (!b[a].includes(code)) { if (b[a].length >= 3) replaced = ` It replaced ${codeLabel(b[a].pop())}.`; b[a].push(code); }
  G.rebinding = null; saveBinds(b);
  bindNote = `${codeLabel(code)} now does ${ACTION_LABELS[a]}${moved}.${replaced}`;
  renderHub();
}
function payRecipe(rec) {
  G.save.money -= rec.cost;
  for (const [it, n] of Object.entries(rec.items)) { G.save.inv[it] -= n; if (G.save.inv[it] <= 0) delete G.save.inv[it]; }
}
// volume sliders: change as you drag, save when you let go
$('scrHub').addEventListener('input', ev => {
  const k = ev.target.dataset && ev.target.dataset.vol; if (!k) return;
  Settings.data[k] = Math.max(0, Math.min(1, +ev.target.value / 100)); Sound.refresh();
  const lab = ev.target.nextElementSibling; if (lab) lab.textContent = ev.target.value + '%';
});
$('scrHub').addEventListener('change', ev => { const k = ev.target.dataset && ev.target.dataset.vol; if (!k) return; Settings.save(); if (k === 'sfxVol') Sound.play('click'); });
$('scrHub').addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  Sound.init();
  const s = G.save;
  if (t.id === 'btnPanelBack') { closePanel(); return; }
  if (t.dataset.quest) { G.selQuest = t.dataset.quest; Sound.play('click'); renderHub(); return; }
  if (t.dataset.boardrank) { G.boardRank = +t.dataset.boardrank; G.selQuest = null; Sound.play('click'); renderHub(); return; }
  if (t.dataset.forgerank) { G.forgeRank = +t.dataset.forgerank; Sound.play('click'); renderHub(); return; }
  if (t.dataset.forgefilter) { G.forgeFilter = t.dataset.forgefilter; Sound.play('click'); renderHub(); return; }
  if (t.dataset.stashrank) { G.stashRank = +t.dataset.stashrank; Sound.play('click'); renderHub(); return; }
  if (t.dataset.depart) { Sound.play('click'); const id = t.dataset.depart; if (netOn()) { if (netHost()) netPost(id); return; } fadeTo(() => startQuest(id)); return; }
  if (t.dataset.armtab) { G.armoryTab = t.dataset.armtab; Sound.play('click'); renderHub(); return; }
  if (t.dataset.part) {
    const id = t.dataset.part, cost = partCost(id); if (s.money < cost) return;
    s.money -= cost; s.inv[id] = (s.inv[id] || 0) + 1; Sound.play('pickup'); persist(); renderHub(); toast(`Bought ${partItem(id).name}`); return;
  }
  if (t.dataset.buy) {
    const id = t.dataset.buy, cost = potionCost(id);
    if ((s.potions[id] || 0) >= POTION_MAX || s.money < cost) return;
    s.money -= cost; s.potions[id] = (s.potions[id] || 0) + 1; Sound.play('pickup'); persist(); renderHub(); toast(`Bought a ${POTIONS[id].name}`); return;
  }
  if (t.dataset.offer) {
    const cost = offeringCost(); if (s.blessing || s.money < cost) return;
    s.money -= cost; s.blessing = true; Sound.play('blessing'); persist(); renderHub(); toast('Hestia will watch over you'); return;
  }
  if (t.dataset.wearset) { const sid = t.dataset.wearset; SLOTS.forEach(sl => { if (s.pieces.includes(sid + ':' + sl)) s.equip[sl] = sid; }); Sound.play('click'); persist(); renderHub(); toast(`Equipped the ${ARMOR_SETS[sid].name} set`); return; }
  if (t.dataset.equip) {
    const [k, id] = t.dataset.equip.split(/:(.*)/s);
    if (k === 'weapon') { s.weapon = id; toast(`Equipped ${WEAPONS[id].name}`); }
    else if (k === 'shield') { s.shield = id || null; toast(id ? `Equipped ${SHIELDS[id].name}` : 'Shield off'); }
    else { const P = PIECES[id]; s.equip[P.slot] = P.set; toast(`Equipped ${P.name}`); }
    Sound.play('click'); persist(); renderHub(); return;
  }
  if (t.dataset.refine) {
    const [k, id] = t.dataset.refine.split(/:(.*)/s), def = refineDef(k, id), lv = refineLevel(id);
    if (!def || lv >= REFINE_MAX) return;
    const rec = refineRecipe(k, id, lv); if (!canCraft(rec)) return;
    payRecipe(rec); s.refine[id] = lv + 1;
    Sound.play('craft'); Sound.play('perfect'); persist(); renderHub(); toast(`${def.name}${k === 'armor' ? ' set' : ''} is now +${lv + 1}`);
    return;
  }
  if (t.dataset.craft) {
    const [k, id] = t.dataset.craft.split(/:(.*)/s);
    const def = k === 'weapon' ? WEAPONS[id] : k === 'shield' ? SHIELDS[id] : PIECES[id];
    if (!def || !def.recipe || !canCraft(def.recipe)) return;
    payRecipe(def.recipe);
    if (k === 'weapon') s.weapons.push(id); else if (k === 'shield') s.shields.push(id); else s.pieces.push(id);
    Sound.play('craft'); persist(); renderHub(); toast(`Crafted ${def.name}`);
    return;
  }
  if (t.dataset.bind) { G.rebinding = t.dataset.bind; bindNote = ''; renderHub(); if (document.activeElement) document.activeElement.blur(); return; }
  if (t.dataset.unbind) {
    const [a, code] = t.dataset.unbind.split(':'), b = JSON.parse(JSON.stringify(Input.bind));
    if (b[a].length <= 1) { bindNote = `${ACTION_LABELS[a]} needs at least one key.`; renderHub(); return; }
    b[a] = b[a].filter(c => c !== code); saveBinds(b); bindNote = `Removed ${codeLabel(code)} from ${ACTION_LABELS[a]}.`; renderHub(); return;
  }
  const o = t.dataset.opt; if (!o) return;
  if (o === 'autoAim' || o === 'mouse') { Settings.data[o] = !Settings.data[o]; Settings.save(); renderTitleControls(); renderHub(); return; }
  if (o === 'resetkeys') { G.rebinding = null; saveBinds(null); bindNote = 'Controls reset to the defaults.'; renderHub(); return; }
  if (o === 'fullscreen') { toggleFullscreen(); return; }
  if (o === 'music') { Settings.data.music = Settings.data.music === false; Settings.save(); Music.refresh(); Sound.play('click'); renderHub(); return; }
  if (o === 'sound') { Settings.data.sound = !Settings.data.sound; Sound.setOn(Settings.data.sound); Settings.save(); Sound.play('click'); renderHub(); }
  else if (o === 'tips') { Settings.data.tips = Settings.data.tips === false; Settings.save(); renderHub(); }
  else if (o === 'shake') { Settings.data.shake = !Settings.data.shake; Settings.save(); renderHub(); }
  else if (o === 'credits') { showCredits(() => { enterVillage('road'); openPanel('options'); }); }
  else if (o === 'title') { persist(true); G.mode = 'slots'; q = null; show('scrSlots'); renderSlots(); }
  else if (o === 'export') { $('importBox').hidden = true; $('codeBox').hidden = false; $('saveCode').value = encodeSave(G.save); }
  else if (o === 'copy') {
    const ta = $('saveCode'), note = $('copyNote');
    const fallback = () => { ta.focus(); ta.select(); note.textContent = 'Selected. Press Ctrl+C (or Cmd+C) to copy.'; };
    try { navigator.clipboard.writeText(ta.value).then(() => { note.textContent = 'Copied.'; }, fallback); } catch (e) { fallback(); }
  }
  else if (o === 'import') { $('codeBox').hidden = true; $('importBox').hidden = false; $('importCode').focus(); }
  else if (o === 'doimport') {
    const ns = decodeSave($('importCode').value);
    if (!ns) { $('importNote').textContent = 'That code didn’t work. Paste the whole code, starting with OH1.'; return; }
    pendingImport = ns;
    $('importRow').innerHTML = `<span class="warn">Replace save ${G.slot} with this one?</span><button class="btn danger small" type="button" data-opt="importyes">Replace</button><button class="btn ghost small" type="button" data-opt="importno">Cancel</button>`;
  }
  else if (o === 'importyes') { if (pendingImport) { G.save = pendingImport; pendingImport = null; persist(true); renderHub(); toast('Save loaded'); } }
  else if (o === 'importno') { pendingImport = null; renderHub(); }
});

function finishQuest(win) {
  const s = G.save, d = q.def, wasNet = q.net;
  if (q.net === 'host') netHostEnd(win); else if (q.net === 'guest' && q.phase !== 'victory' && q.phase !== 'defeat') netSend({ t: 'leave' });
  const before = new Set(QUESTS.filter(x => isUnlocked(x)).map(x => x.id));
  const statueWas = d.boss ? godRank(d.boss) : 9, readyWas = rankReady(), allGodsWas = allGodsDone(0), finaleWas = finaleReady(), typhonWas = typhonReady();
  G.lastQuest = d.id; CG.gameplay(false); tutEnd(win);
  if (win) for (const k of q.pickups) if (k.item !== '@heal') q.loot[k.item] = (q.loot[k.item] || 0) + 1;
  for (const [k, v] of Object.entries(q.loot)) s.inv[k] = (s.inv[k] || 0) + v;
  s.money += q.chestMoney;
  if (q.chestFound) s.chests[d.id] = true;
  if (q.usedBlessing) s.blessing = false;
  let best = false;
  if (win) {
    s.money += d.reward; s.cleared[d.id] = (s.cleared[d.id] || 0) + 1;
    const t = Math.max(1, Math.round(q.elapsed)); if (!s.best[d.id] || t < s.best[d.id]) { best = !!s.best[d.id]; s.best[d.id] = t; }
  }
  persist(true);
  const unlocked = QUESTS.filter(x => isUnlocked(x) && !before.has(x.id));
  $('resQuest').innerHTML = `${d.rank ? `<span style="color:${RANKS[d.rank].col}">${RANKS[d.rank].name}</span> · ` : ''}${esc(d.titan ? 'Titan' : godName(d.god))} · ${esc(d.name)}`;
  const title = $('resTitle'); title.textContent = win ? 'Quest complete' : 'Quest failed'; title.className = 'res-title ' + (win ? 'win' : 'lose');
  $('resStats').innerHTML = `<div><span>Time</span><b>${fmtTime(q.elapsed)}${best ? ' ★' : ''}</b></div><div><span>Reward</span><b style="color:var(--gold)">${win ? fmtMoney(d.reward) : 0} dr</b></div><div><span>Hidden cache</span><b style="color:${q.chestFound ? 'var(--gold)' : 'var(--bone-mute)'}">${q.chestFound ? '+' + fmtMoney(q.chestMoney) + ' dr' : 'Not found'}</b></div><div><span>Monsters slain</span><b>${q.stats.kills}</b></div><div><span>Damage taken</span><b>${q.stats.taken}</b></div>${q.stats.perfect ? `<div><span>Perfect blocks</span><b>${q.stats.perfect}</b></div>` : ''}`;
  const notes = [];
  if (win && d.boss && godRank(d.boss) > statueWas) notes.push(`${godName(d.boss)}’s statue in the ${d.titan ? 'Hall of the Titans' : 'Temple of the Gods'} is now ${['gold', 'diamond', 'amethyst'][godRank(d.boss)]}.`);
  if (q.usedBlessing) notes.push('Hestia’s blessing was used up. Visit her hearth in the temple to ask again.');
  if (d.id === 'zeus_hunt' && s.cleared.zeus_hunt === 1 && win) notes.push('You’ve hunted all twelve gods of Olympus.');
  if (win && !allGodsWas && allGodsDone(0) && !s.stairs) notes.push('Every god has fallen. Something stirs beneath the Temple of the Gods.');
  if (win && !readyWas && rankReady()) notes.push('Every god and Titan on this rank has fallen. Kleon the Herald wants a word.');
  if (win && !typhonWas && typhonReady()) notes.push('Every god and Titan on God Rank has fallen. The ground is shaking under Mount Etna. Kleon the Herald wants a word.');
  if (win && !finaleWas && finaleReady()) notes.push('You slew Typhon. Kleon the Herald wants a word.');
  if (unlocked.length <= 4) unlocked.forEach(u => notes.push(`New quest on the board: ${u.name}`));
  else notes.push(`${unlocked.length} new quests on the board.`);
  $('resUnlock').innerHTML = notes.map(n => `<div class="unlock">${esc(n)}</div>`).join('');
  // a lost hunt: point at the two things that make the next try easier
  if (!win && Settings.data.tips !== false && ((s.potions.health || 0) < POTION_MAX || !s.blessing))
    $('resUnlock').innerHTML += `<p class="tutnote">Tough one? <b>Melita the Trader</b> sells health potions (${touchMode ? 'tap one in the corner' : 'press ' + esc(codeLabel(Input.bind.potion1[0]))} during a hunt to drink it). An offering at <b>Hestia’s hearth</b> in the temple gets you back on your feet once if you fall. Better armor from the forge helps too.</p>`;
  const loot = Object.entries(q.loot);
  $('resLoot').innerHTML = loot.length ? loot.map(([id, n]) => `<div class="res-item"><img alt="" src="${icon(id)}"><span class="r${ITEMS[id].rarity}">${esc(ITEMS[id].name)}</span><b>×${n}</b></div>`).join('') : `<div class="muted">Nothing this time.</div>`;
  $('resNote').textContent = win ? 'Parts and drachmae are in the storehouse. Visit Dion at the forge to see what you can craft.' : 'You keep the parts you picked up and anything from the hidden cache. A failed quest pays no reward.';
  $('btnResAgain').textContent = win ? 'Quest again' : 'Try again'; $('btnResAgain').hidden = !!wasNet || netOn();
  G.mode = 'results'; q = null;
  show('scrResults');
  setTimeout(() => { if (G.mode === 'results') $('btnResContinue').focus({ preventScroll: true }); }, 900);   // don't scroll the title off a short phone screen
}

/* ---- the Oracle: hunting with others ---- */
function renderOracle() {
  if (!Store.api) return `<div class="empty-note">Hunting with others works on olympushunt.com.</div>`;
  if (!Store.user) return `<div class="opt"><h3>Sign in to hunt together</h3><p>Online hunts use your account name. Signing in takes you back to the save list.</p><div id="acctHome">${accountHTML()}</div></div>`;
  const R = NET.room, msg = G.orMsg ? `<p class="acct-msg">${esc(G.orMsg)}</p>` : '';
  if (R) return `<div class="opt"><h3>Room ${esc(R.code)}</h3><p>${R.members.map(m => esc(m.name) + (m.id === R.host ? ' (host)' : '')).join(' · ')} · ${R.members.length}/4</p>
    <p class="muted">Friends join with the code ${esc(R.code)}. ${netHost() ? 'Post a hunt from Kleon’s board.' : 'The host posts the hunts.'}</p>
    <div class="row"><button class="btn ghost" type="button" data-or="leave">Leave the room</button><button class="btn ghost" type="button" data-or="hints">Ask about hidden caches</button></div></div>${msg}`;
  return `${msg}<div class="opts"><div class="opt"><h3>Host a room</h3><p>Up to 4 hunters. Hunts grow tougher with more of you.</p>
      <label class="toggle-row"><input type="checkbox" id="orPub" checked> Show it in the room list</label><button class="btn" type="button" data-or="host">Host a room</button></div>
    <div class="opt"><h3>Join by code</h3><form class="acct-form" data-orjoin novalidate><label>Room code<input name="code" maxlength="5" autocapitalize="characters" autocomplete="off" spellcheck="false"></label><button class="btn" type="submit">Join</button></form></div>
    <div class="opt wide"><h3>Open rooms</h3><div id="orList" class="muted">Looking…</div><button class="btn ghost small" type="button" data-or="refresh">Refresh</button></div>
    <div class="opt"><h3>Hidden caches</h3><p>She still sees where the hunting grounds hide their caches.</p><button class="btn ghost" type="button" data-or="hints">Ask about hidden caches</button></div></div>`;
}
async function orLoad() {
  const box = $('orList'); if (!box) return;
  try {
    const d = await Store.call('GET', 'rooms'), rooms = d.rooms || [];
    if (!$('orList')) return;
    $('orList').innerHTML = rooms.length ? rooms.map(r => `<div class="or-row"><b>${esc(r.host)}</b><span>${r.n}/${r.max}</span><span>${RANKS[r.rank] ? RANKS[r.rank].name : ''}</span><span class="muted">${r.phase === 'hunt' ? 'Hunting' + (r.quest ? ': ' + esc(r.quest) : '') : 'In Akros'}</span><span class="muted" data-ping="${r.code}">…</span><button class="btn small" type="button" data-or="join" data-code="${r.code}" ${r.n >= r.max ? 'disabled' : ''}>Join</button></div>`).join('') : 'No open rooms right now. Host one!';
    for (const r of rooms) { const t0 = performance.now(); fetch(`/api/rooms/${r.code}/ping`, { cache: 'no-store' }).then(() => { const el = document.querySelector(`[data-ping="${r.code}"]`); if (el) el.textContent = Math.round(performance.now() - t0) + ' ms'; }).catch(() => {}); }
  } catch (e) { if ($('orList')) $('orList').textContent = 'Can’t reach the other hunters. Check your connection.'; }
}
async function orDo(a, code) {
  G.orMsg = '';
  try {
    if (a === 'host') { await netHostRoom($('orPub') ? $('orPub').checked : true); closePanel(); toast(`Room ${NET.code} is open. Friends join with that code.`); }
    else if (a === 'join') { await netJoinRoom(code); closePanel(); toast('You joined the room.'); }
    else if (a === 'leave') { netLeave(); renderHub(); }
    else if (a === 'refresh') orLoad();
    else if (a === 'hints') { G.oracleHints = true; closePanel(); const n = V && V.npcs.find(x => x.id === 'oracle'); if (n) startInteract({ kind: 'npc', npc: n, name: n.name, x: n.x, y: n.y }); }
  } catch (e) { G.orMsg = e.message; if (G.panel === 'oracle') renderHub(); }
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-or]'); if (b && !b.disabled) { Sound.play('click'); orDo(b.dataset.or, b.dataset.code); } });
document.addEventListener('submit', ev => { const f = ev.target.closest('[data-orjoin]'); if (!f) return; ev.preventDefault(); orDo('join', f.elements.code.value); });
$('mpBox').addEventListener('click', ev => { const b = ev.target.closest('[data-mp]'); if (b) netBannerAction(b.dataset.mp); });

/* ---- pause ---- */
function setPaused(v) {
  if (G.mode !== 'quest' && G.mode !== 'village') return;
  if (v && q && (q.phase === 'victory' || q.phase === 'defeat')) return;
  G.paused = v; Music.duck(v); $('pause').hidden = !v; $('pauseMain').hidden = false; $('pauseConfirm').hidden = true;
  const inQuest = G.mode === 'quest';
  $('btnAbandon').hidden = !inQuest; $('btnQuit').hidden = inQuest; $('btnPauseOptions').hidden = inQuest;
  const road = !!(inQuest && q && q.def.prologue);
  $('btnAbandon').textContent = road ? 'Skip the tutorial' : 'Abandon quest';
  $('abandonText').textContent = road ? 'Skip ahead to the village? You keep the parts and potions you have.' : 'Leave now? You keep the parts you picked up, but you get no reward.';
  $('btnAbandonYes').textContent = road ? 'Go to the village' : 'Leave the quest';
  $('btnPauseSound').textContent = 'Sound effects: ' + (Settings.data.sound ? 'on' : 'off');
  $('btnPauseMusic').textContent = 'Music: ' + (Settings.data.music !== false ? 'on' : 'off');
  $('btnPauseFs').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  const k = a => codeLabel(Input.bind[a][0]);
  $('pauseKeys').textContent = `Move ${moveKeysHTML().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()} · Attack ${k('attack')} · Dash ${k('dodge')} · Skill ${k('ability')} · Guard/use ${k('guard')} · Potions ${k('potion1')} ${k('potion2')} ${k('potion3')}`;
  Input.down.clear(); Input.virt = {}; Input.mouse.held = false;
  if (v) setTimeout(() => $('btnResume').focus(), 0); else if (document.activeElement) document.activeElement.blur();
}
$('btnResume').onclick = () => setPaused(false);
$('btnPauseSound').onclick = () => { Settings.data.sound = !Settings.data.sound; Sound.setOn(Settings.data.sound); Settings.save(); $('btnPauseSound').textContent = 'Sound effects: ' + (Settings.data.sound ? 'on' : 'off'); };
$('btnPauseMusic').onclick = () => { Settings.data.music = Settings.data.music === false; Settings.save(); Music.refresh(); $('btnPauseMusic').textContent = 'Music: ' + (Settings.data.music !== false ? 'on' : 'off'); Sound.play('click'); };
$('btnAbandon').onclick = () => { $('pauseMain').hidden = true; $('pauseConfirm').hidden = false; $('btnAbandonNo').focus(); };
$('btnAbandonNo').onclick = () => { $('pauseMain').hidden = false; $('pauseConfirm').hidden = true; };
$('btnAbandonYes').onclick = () => { G.paused = false; $('pause').hidden = true; if (q && q.def.prologue) proFinish(true); else finishQuest(false); };
$('btnPauseOptions').onclick = () => { G.paused = false; $('pause').hidden = true; openPanel('options'); };
$('btnQuit').onclick = () => { G.paused = false; $('pause').hidden = true; persist(true); G.mode = 'slots'; show('scrSlots'); renderSlots(); };
$('tPause').onclick = () => setPaused(true);
$('goalHide').onclick = ev => { ev.stopPropagation(); Settings.data.tips = false; Settings.save(); tutGoal(); toast('Tips hidden. Turn them back on in Options.'); };
$('btnPauseFs').onclick = () => toggleFullscreen();
$('dialog').addEventListener('click', () => { if (G.mode === 'village' && G.dialog) advanceDialog(); });

/* ---- fullscreen (Chromebooks also have a fullscreen key on the top row) ---- */
let fsByUs = false;
function toggleFullscreen() {
  if (!document.fullscreenEnabled) { toast(touchMode ? 'Fullscreen is blocked here.' : 'Fullscreen is blocked here. Use your keyboard’s fullscreen key instead.'); return; }
  if (document.fullscreenElement) { fsByUs = true; document.exitFullscreen().catch(() => {}); }
  else document.documentElement.requestFullscreen().catch(() => toast(touchMode ? 'Fullscreen is blocked here.' : 'Fullscreen is blocked here. Use your keyboard’s fullscreen key instead.'));
}
document.addEventListener('fullscreenchange', () => {
  resize();
  if (!document.fullscreenElement && !fsByUs && (G.mode === 'quest' || G.mode === 'village') && !G.paused) setPaused(true);
  fsByUs = false;
  $('btnPauseFs').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  if (G.mode === 'panel' && G.panel === 'options') renderHub();
});

/* ---- top-level buttons ---- */
$('btnPlay').onclick = () => { Sound.init(); Sound.play('click'); playNow(); };
$('btnSaves').onclick = () => { Sound.init(); Sound.play('click'); G.mode = 'slots'; show('scrSlots'); renderSlots(); };
$('btnSlotsBack').onclick = () => { Sound.play('click'); G.mode = 'title'; show('scrTitle'); };
$('btnResContinue').onclick = () => {
  Sound.play('click');
  // Typhon just fell for the first time: roll the credits before going home
  if (G.lastQuest === TYPHON_Q && G.save.cleared[TYPHON_Q] && !G.save.legend) { fadeTo(() => showCredits(() => enterVillage('gate'))); return; }
  CG.midgameAd(() => fadeTo(() => enterVillage('gate')));
};
/* ---- the end credits: after Typhon falls for the first time, and from your home after that ---- */
let creditsAfter = null, creditsRaf = 0;
function showCredits(after) {
  creditsAfter = after; G.mode = 'credits'; G.paused = false; CG.gameplay(false);
  show('scrCredits'); Music.play('credits');
  const s = G.save, dot = ' · ', names = ids => ids.map(id => esc(godName(id))).join(dot);
  const hunts = QUESTS.filter(qd => s.cleared[qd.id]).length, caches = Object.keys(s.chests).length;
  $('creditsRoll').innerHTML = `<h1 class="logo">Olympus<br>Hunt</h1>
    <p class="lede">You slew Typhon, the father of monsters. Olympus is safe, thanks to you.</p>
    <h3>Gods hunted</h3><p>${names([...GODS, ...SIDE_GODS].map(g => g.id))}</p>
    <h3>Titans hunted</h3><p>${names(TITANS.map(t => t.id))}</p>
    <h3>The father of monsters</h3><p>Typhon</p>
    <h3>Your hunt</h3><p>${fmtPlay(s.playtime)} played${dot}${hunts} hunts cleared${dot}${caches} hidden caches found${dot}${fmtMoney(s.money)} drachmae in the bank</p>
    <h3>Created by</h3><p>Connor Key</p>
    <h3>Creative</h3><p>Ben Watkins</p>
    <h3>Code and pixel art</h3><p>Built with Claude</p>
    <h3>Music</h3><p>A tiny NES-style band, made out of code</p>
    <h3>Playtesters</h3><p>Nick Miller${dot}Caleb Key${dot}and more</p>
    <h3>And you</h3><p>for hunting all the way to the end</p>
    <p class="thanks">Thank you for playing</p>`;
  $('btnCreditsDone').hidden = true; $('btnCreditsSkip').hidden = false;
  const roll = $('creditsRoll'), view = roll.parentElement, art = $('creditsArt'), x = art.getContext('2d'); x.imageSmoothingEnabled = false;
  // a parade of everything you hunted walks across the top
  const parade = [...[...GODS, ...SIDE_GODS].map(g => ({ spr: BOSSES[g.id].sprite, s: 2 })), ...TITANS.map(t => ({ spr: t.id, s: 1 })), { spr: 'typhon', s: 1 }];
  let px = 0; const widths = parade.map(p => SPR[p.spr][0].w * p.s + 12), total = widths.reduce((a, b) => a + b, 0);
  let off = 0, last = performance.now();
  cancelAnimationFrame(creditsRaf);
  const step = now => {
    if (G.mode !== 'credits') return;
    const dt = Math.min(.1, (now - last) / 1000); last = now; off += dt * 34; px += dt * 22;
    const H = view.clientHeight, end = roll.offsetHeight + H;
    roll.style.transform = `translateY(${Math.round(H - Math.min(off, end - H * .45))}px)`;
    if (off >= end - H * .45) { $('btnCreditsDone').hidden = false; $('btnCreditsSkip').hidden = true; }
    x.fillStyle = '#0b0706'; x.fillRect(0, 0, art.width, art.height);
    x.fillStyle = '#2a1e19'; x.fillRect(0, art.height - 6, art.width, 6);
    let cx = art.width - (px % total);
    for (let rep = 0; rep < 2; rep++) parade.forEach((p, i) => {
      const fr = SPR[p.spr], f = fr[Math.floor(now / 160 + i) % Math.min(2, fr.length)], w = f.w * p.s, h = f.h * p.s;
      const xx = Math.round(cx - total * rep), bob = Math.floor(now / 160 + i) % 2;
      if (xx > -w && xx < art.width) x.drawImage(f.n, xx, art.height - 6 - h + bob, w, h);
      cx += widths[i];
    });
    creditsRaf = requestAnimationFrame(step);
  };
  creditsRaf = requestAnimationFrame(step);
}
function endCredits() {
  if (G.mode !== 'credits') return;
  cancelAnimationFrame(creditsRaf); G.mode = 'slots';
  if (G.save && !G.save.legend) { G.save.legend = true; persist(true); }
  const f = creditsAfter || (() => enterVillage('gate')); creditsAfter = null;
  fadeTo(f);
}
$('btnCreditsSkip').onclick = () => { Sound.play('click'); endCredits(); };
$('btnCreditsDone').onclick = () => { Sound.play('click'); endCredits(); };
$('btnResAgain').onclick = () => { Sound.play('click'); const id = G.lastQuest; if (id && isUnlocked(QUEST_BY_ID[id])) CG.midgameAd(() => fadeTo(() => startQuest(id))); };

/* ============================== EVENTS =================================== */
addEventListener('keydown', e => {
  if (G.rebinding) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) captureBind(e.code); return; }
  if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;            // leave browser and ChromeOS shortcuts alone
  if (e.code === 'KeyM' && !e.repeat) { Settings.data.sound = !Settings.data.sound; Sound.setOn(Settings.data.sound); Settings.save(); if (G.mode === 'quest' || G.mode === 'village') toast(Settings.data.sound ? 'Sound on' : 'Sound off'); }
  if (e.code === 'KeyF' && !e.repeat) { e.preventDefault(); toggleFullscreen(); return; }
  if (G.mode === 'credits') { if ((e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); endCredits(); } return; }
  if (G.mode === 'panel') { if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); closePanel(); } return; }
  if (G.mode !== 'quest' && G.mode !== 'village') return;
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    e.preventDefault();
    if (G.mode === 'village' && G.dialog && e.code === 'Escape') { closeDialog(); return; }
    setPaused(!G.paused); return;
  }
  if (G.paused) return;
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && G.mode === 'village') { e.preventDefault(); if (!e.repeat) Input.enter = true; return; }
  if (GAME_KEYS.has(e.code)) {
    e.preventDefault();
    setTouchMode(false);
    if (!e.repeat) Input.pressed.add(e.code);
    Input.down.add(e.code);
  }
});
addEventListener('keyup', e => { Input.down.delete(e.code); });
addEventListener('blur', () => { Input.down.clear(); Input.mouse.held = false; if ((G.mode === 'quest' || G.mode === 'village') && !G.paused) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'quest' || G.mode === 'village') && !G.paused) setPaused(true); });

function canvasPoint(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * VIEW_W, y: (ev.clientY - r.top) / r.height * VIEW_H }; }
cv.addEventListener('mousemove', ev => { const pt = canvasPoint(ev); Input.mouse.x = pt.x; Input.mouse.y = pt.y; });
cv.addEventListener('mousedown', ev => {
  if ((G.mode !== 'quest' && G.mode !== 'village') || G.paused || !Settings.data.mouse) return;
  const pt = canvasPoint(ev); Input.mouse.x = pt.x; Input.mouse.y = pt.y;
  if (ev.button === 0) { Input.virtPressed.attack = true; Input.mouseAttack = true; if (G.mode === 'quest') Input.mouse.held = true; }
  if (ev.button === 2) Input.virtPressed.dodge = true;
});
addEventListener('mouseup', ev => { if (ev.button === 0) Input.mouse.held = false; });
cv.addEventListener('contextmenu', ev => ev.preventDefault());

// Touch controls only appear once you actually touch the screen, and hide again when you use
// the keyboard or touchpad. That keeps them out of the way on touchscreen Chromebooks.
let touchMode = false;
function setTouchMode(v) { if (touchMode === v) return; touchMode = v; $('touch').hidden = !v; $('stage').classList.toggle('touch', v); document.body.classList.toggle('touch', v); renderTitleControls(); hudCache.prompt = null; if (!v) { Input.stick.x = Input.stick.y = 0; Input.virt = {}; } }
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) setTouchMode(true);
addEventListener('pointerdown', ev => { if (ev.pointerType === 'touch') setTouchMode(true); else if (ev.pointerType === 'mouse') setTouchMode(false); }, true);
{
  const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob');
  let sid = null, ox = 0, oy = 0;
  zone.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') return;
    ev.preventDefault(); sid = ev.pointerId; zone.setPointerCapture(sid);
    const r = zone.getBoundingClientRect(); ox = ev.clientX; oy = ev.clientY;
    base.style.left = (ev.clientX - r.left) + 'px'; base.style.top = (ev.clientY - r.top) + 'px'; base.classList.add('on');
    knob.style.transform = 'translate(0,0)';
  });
  zone.addEventListener('pointermove', ev => {
    if (ev.pointerId !== sid) return;
    let dx = ev.clientX - ox, dy = ev.clientY - oy; const m = Math.hypot(dx, dy), R = 40;
    if (m > R) { dx = dx / m * R; dy = dy / m * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const k = Math.hypot(dx, dy) / R;
    Input.stick.x = k > .2 ? dx / R : 0; Input.stick.y = k > .2 ? dy / R : 0;
  });
  const endStick = ev => { if (ev.pointerId !== sid) return; sid = null; Input.stick.x = Input.stick.y = 0; base.classList.remove('on'); };
  zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
  document.querySelectorAll('#touchBtns button').forEach(b => {
    const act = b.dataset.act;
    b.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse') return; ev.preventDefault(); Sound.init(); Input.virt[act] = true; Input.virtPressed[act] = true; b.classList.add('on'); });
    const up = () => { Input.virt[act] = false; b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
}

function resize() {
  const app = $('app'), cs = getComputedStyle(app);
  const aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let s = Math.min(aw / VIEW_W, ah / VIEW_H);
  // Whole-number scaling keeps pixels perfectly even, but on laptop and Chromebook screens it can
  // waste a third of the screen. Only snap down when that costs less than 10% of the size.
  if (s >= 2 && Math.floor(s) / s >= .9) s = Math.floor(s);
  s = Math.max(.5, Math.floor(s * 100) / 100);
  const st = $('stage'); st.style.width = Math.floor(VIEW_W * s) + 'px'; st.style.height = Math.floor(VIEW_H * s) + 'px'; st.style.setProperty('--px', s + 'px');
}
addEventListener('resize', resize);

/* ============================== LOOP ===================================== */
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
const DEBUG = { speed: 1 };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  netFrame(dt);
  CG.gameplay((G.mode === 'quest' || G.mode === 'village') && !G.paused && !document.hidden);
  if (G.mode === 'quest' && q) {
    if (!G.paused || q.net) { acc += dt * DEBUG.speed; let n = 0; while (acc >= STEP && n < 6 * DEBUG.speed) { acc -= STEP; (q.net === 'guest' ? guestTick : tick)(STEP); n++; if (G.mode !== 'quest' || !q) break; } }
    if (G.mode === 'quest' && q) { renderQuest(); updateHud(); }
  } else if (G.mode === 'village' && V) {
    if (!G.paused) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { acc -= STEP; tickVillage(STEP); n++; if (G.mode !== 'village') break; } }
    if (G.mode === 'village') { renderVillage(); updateVillageHud(); }
  } else {
    acc = 0;
    if (G.save && (G.mode === 'panel' || G.mode === 'results')) G.save.playtime += dt;
  }
}

/* ============================== BOOT ===================================== */
(function meander() {
  const g = ['######', '....#.', '###.#.', '#.#.#.', '#...#.', '#####.', '......', '######'];
  let r = ''; g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') r += `<rect x="${x * 2}" y="${y * 2}" width="2" height="2"/>`; }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" shape-rendering="crispEdges"><g fill="#cf6a2f">${r}</g></svg>`;
  document.documentElement.style.setProperty('--meander', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
})();
Settings.load();
Store.init();
renderTitleControls();
drawTitleArt();
resize();
requestAnimationFrame(frame);
updateTitleSub();
// On CrazyGames players land straight in the game: no title screen, no save list.
Store.ready.then(() => { if (CG.on && G.mode === 'title') playNow(); });

// Handy for testing from the browser console.
window.OlympusHunt = { Music, Store, tick, Sound, resetEID: () => { EID = 1; },
  NET, netHostRoom, netJoinRoom, netBannerAction, netPost,
  // co-op testing: bot teammates join your next hunts (and the one you're in, though its scaling was set when it started)
  setBots: list => { G.partyBots = (list || []).filter(w => WEAPONS[w]).slice(0, PARTY_MAX - 1); },
  addBotHunter: wid => {
    if (!WEAPONS[wid]) return false;
    const list = G.partyBots = G.partyBots || []; if (list.length >= PARTY_MAX - 1) return false; list.push(wid);
    if (q && !q.def.prologue) addHunter({ save: botSave(wid), bot: {}, name: BOT_NAMES[(q.hunters.length - 1) % BOT_NAMES.length] });
    return true;
  },
  clearBots: () => { G.partyBots = []; }, PARTY_SCALE, botLocal: v => { G.botLocal = !!v; },   // botLocal: your own hunter plays itself (for bot parties)
  G, q: () => q, V: () => V, startQuest, enterVillage, enterPlace, openPanel, ITEMS, WEAPONS, ARMOR_SETS, PIECES, SHIELDS, QUESTS, BOSSES, ENEMIES, ARENAS,
  playerStats, sanitize, newSave, heroFrames, makeEnemy, makeBoss, isUnlocked, SPR, statueImg, RANKS, TITANS, rid, godRank, rankReady, Input,
  killAll: () => { if (q) q.enemies.forEach(e => { if (e.state !== 'spawn') { e.hidden = false; e.air = false; killEnemy(e, { final: true }); } }); },
  godMode: () => { if (q) { q.player.invuln = 9999; q.player.hp = 1e6; } },
  DEBUG,
  unlockAll: () => { QUESTS.forEach(qd => { G.save.cleared[qd.id] = G.save.cleared[qd.id] || 1; }); persist(); },
  richer: () => { G.save.money += 100000; for (const id of Object.keys(ITEMS)) G.save.inv[id] = 99; persist(); },
};

})();
