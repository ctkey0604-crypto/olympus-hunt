/* ============================== THE OWNER'S DASHBOARD ============================== */
// Where players are and how recently they played, for the account named Theowner. This page only hides a button: the server is what
// decides, and it refuses everyone else. It shows game progress, never anything about signing in.
const isOwner = () => String(Store.user || '').toLowerCase() === 'theowner';
const DAY_MS = 86400000;
let ownerData = null, ownerVote = null, ownerMsg = '', ownerSort = 'saved', ownerFind = '';
const fmtHours = t => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return h ? `${h}h ${m}m` : `${m}m`; };
function fmtAgo(ms) {
  if (!ms) return 'never';
  const m = Math.floor(ms / 60000); if (m < 60) return m < 2 ? 'just now' : `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return d < 60 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}
// One line per account: its most recently played save, and what it's up to.
function ownerPlayers(d) {
  const by = new Map();
  for (const r of d.rows) {
    const key = r.name; if (by.has(key) && !(r.saved_at > by.get(key).saved)) continue;
    let cleared = {}; try { cleared = r.cleared ? JSON.parse(r.cleared) : {}; } catch (e) {}
    const rank = r.rank || 0, done = !!cleared[TYPHON_Q], saved = r.saved_at || 0;
    const next = saved && !done ? nextQuest({ rank, cleared, stairs: !!r.stairs }) : null;
    by.set(key, { name: r.display, joined: r.created || 0, saved, rank, play: r.play || 0, money: r.money || 0, wave: r.wave || 0, finish: r.finish || 0, hunts: Object.keys(cleared).length, done,
                  where: !saved ? 'No save yet' : done ? 'Beat Typhon' : next ? next.name : 'Ready for the next rank' });
  }
  return [...by.values()];
}
function renderOwner() {
  const box = $('ownerBody');
  if (!ownerData) { box.innerHTML = `<p class="vote-lead">${esc(ownerMsg || 'Looking…')}</p>`; return; }
  const now = ownerData.now, all = ownerPlayers(ownerData), seen = n => all.filter(p => p.saved && now - p.saved < n * DAY_MS).length;
  const saved = all.filter(p => p.saved), played = saved.reduce((a, p) => a + p.play, 0), done = all.filter(p => p.done).length;
  const card = (label, value) => `<div class="ow-card"><b>${esc(String(value))}</b><span>${esc(label)}</span></div>`;
  const bars = (rows, total) => rows.map(([name, n]) => `<div class="ow-bar"><span>${esc(name)}</span><i><u style="width:${total ? Math.round(n / total * 100) : 0}%"></u></i><b>${n}</b></div>`).join('');
  const ranks = [...RANKS.map((R, i) => [R.name, saved.filter(p => !p.done && p.rank === i).length]), ['Beat Typhon', done], ['No save yet', all.length - saved.length]];
  const stuck = new Map(); for (const p of saved) if (!p.done && now - p.saved > 7 * DAY_MS) stuck.set(p.where, (stuck.get(p.where) || 0) + 1);   // gone quiet for a week: where they stopped
  const stops = [...stuck.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), votes = ownerVote && ownerVote.counts ? VOTE.map(o => [o.name, ownerVote.counts[o.id] || 0]) : [];
  const voteAll = votes.reduce((a, v) => a + v[1], 0), find = ownerFind.toLowerCase();
  const KEYS = { saved: p => -p.saved, name: p => p.name.toLowerCase(), rank: p => -(p.done ? 9 : p.rank), hunts: p => -p.hunts, play: p => -p.play, joined: p => -p.joined };
  const list = all.filter(p => !find || p.name.toLowerCase().includes(find) || p.where.toLowerCase().includes(find)).sort((a, b) => { const x = KEYS[ownerSort](a), y = KEYS[ownerSort](b); return x < y ? -1 : x > y ? 1 : 0; }).slice(0, 200);
  const th = (k, name) => `<th><button type="button" data-owsort="${k}" class="${ownerSort === k ? 'on' : ''}">${name}</button></th>`;
  box.innerHTML = `<div class="ow-cards">${card('Accounts', all.length)}${card('Played today', seen(1))}${card('This week', seen(7))}${card('This month', seen(30))}${card('Beat Typhon', done)}${card('Average play', saved.length ? fmtHours(played / saved.length) : '0m')}</div>
    <div class="ow-split"><div class="opt"><h3>Where they are</h3>${bars(ranks, all.length)}</div>
    <div class="opt"><h3>Where quiet players stopped</h3>${stops.length ? bars(stops, stops[0][1]) : '<p class="muted">Nobody has gone quiet for a week yet.</p>'}</div>
    <div class="opt"><h3>Vote for update 1.1</h3>${votes.length ? bars(votes, voteAll) : '<p class="muted">No votes to show.</p>'}</div></div>
    <input class="ow-find" id="ownerFind" placeholder="Find a player or a hunt" value="${esc(ownerFind)}" autocomplete="off" spellcheck="false" aria-label="Find a player or a hunt">
    <div class="ow-scroll"><table class="ow-table"><thead><tr>${th('name', 'Player')}${th('rank', 'Rank')}<th>Next up</th>${th('hunts', 'Hunts')}${th('play', 'Played')}${th('saved', 'Last played')}${th('joined', 'Joined')}</tr></thead>
    <tbody>${list.map(p => `<tr><td>${esc(p.name)}</td><td>${p.saved ? esc(RANKS[p.rank] ? RANKS[p.rank].name : '') : ''}</td><td>${esc(p.where)}</td><td>${p.hunts}</td><td>${fmtHours(p.play)}</td><td>${fmtAgo(p.saved ? now - p.saved : 0)}</td><td>${fmtAgo(p.joined ? now - p.joined : 0)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nobody matches that.</td></tr>'}</tbody></table></div>
    <p class="muted" style="font-size:.85rem">Last played means the last time a save reached the server. Showing up to 200 players, newest save first.</p>`;
}
async function ownerLoad() {
  ownerMsg = ''; ownerData = null; renderOwner();
  try {
    await Store.ready;
    const [players, vote] = await Promise.all([Store.call('GET', 'owner/players'), Store.call('GET', 'vote').catch(() => null)]);
    ownerData = players; ownerVote = vote;
  } catch (e) { ownerMsg = e.status === 404 ? 'This is only for the owner account.' : e.message || 'The dashboard can’t be reached right now.'; }
  renderOwner();
}
function openOwner() { G.mode = 'owner'; show('scrOwner'); ownerLoad(); }
function closeOwner() { Sound.play('click'); G.mode = 'title'; show('scrTitle'); }
$('btnOwner').onclick = () => { Sound.init(); Sound.play('click'); openOwner(); };
$('btnOwnerBack').onclick = closeOwner;
$('btnOwnerRefresh').onclick = () => { Sound.play('click'); ownerLoad(); };
$('ownerBody').addEventListener('click', ev => { const b = ev.target.closest('[data-owsort]'); if (b) { ownerSort = b.dataset.owsort; Sound.play('click'); renderOwner(); } });
$('ownerBody').addEventListener('input', ev => {
  if (ev.target.id !== 'ownerFind') return;
  ownerFind = ev.target.value; const at = ev.target.selectionStart; renderOwner();
  const inp = $('ownerFind'); if (inp) { inp.focus(); inp.setSelectionRange(at, at); }
});
