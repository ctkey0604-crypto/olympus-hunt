/* ============================== THE OWNER'S DASHBOARD ============================== */
// Where players are and how recently they played, for the account named Theowner. This page only hides a button: the server is what
// decides, and it refuses everyone else. It shows game progress, never anything about signing in.
const isOwner = () => String(Store.user || '').toLowerCase() === 'theowner';
const DAY_MS = 86400000;
let ownerData = null, ownerVote = null, ownerSg = null, ownerMsg = '', ownerSort = 'saved', ownerFind = '', ownerBusy = false;
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
    by.set(key, { key, name: r.display, joined: r.created || 0, saved, rank, play: r.play || 0, money: r.money || 0, wave: r.wave || 0, finish: r.finish || 0, hunts: Object.keys(cleared).length, done,
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
    ${ownerActivityHTML(ownerData.activity || [])}
    <div class="ow-split"><div class="opt"><h3>Where they are</h3>${bars(ranks, all.length)}</div>
    <div class="opt"><h3>Where quiet players stopped</h3>${stops.length ? bars(stops, stops[0][1]) : '<p class="muted">Nobody has gone quiet for a week yet.</p>'}</div>
    <div class="opt"><h3>Update 1.1 vote (closed)</h3>${votes.length ? bars(votes, voteAll) : '<p class="muted">No votes to show.</p>'}</div></div>
    ${ownerSgHTML()}
    <input class="ow-find" id="ownerFind" placeholder="Find a player or a hunt" value="${esc(ownerFind)}" autocomplete="off" spellcheck="false" aria-label="Find a player or a hunt">
    <div class="ow-scroll"><table class="ow-table"><thead><tr>${th('name', 'Player')}${th('rank', 'Rank')}<th>Next up</th>${th('hunts', 'Hunts')}${th('play', 'Played')}${th('saved', 'Last played')}${th('joined', 'Joined')}<th></th></tr></thead>
    <tbody>${list.map(p => `<tr><td>${esc(p.name)}</td><td>${p.saved ? esc(RANKS[p.rank] ? RANKS[p.rank].name : '') : ''}</td><td>${esc(p.where)}</td><td>${p.hunts}</td><td>${fmtHours(p.play)}</td><td>${fmtAgo(p.saved ? now - p.saved : 0)}</td><td>${fmtAgo(p.joined ? now - p.joined : 0)}</td><td>${p.key === 'theowner' ? '' : `<button type="button" data-owdel="${esc(p.key)}" data-name="${esc(p.name)}" ${ownerBusy ? 'disabled' : ''}>Delete</button>`}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Nobody matches that.</td></tr>'}</tbody></table></div>
    <p class="muted" style="font-size:.85rem">Last played means the last time a save reached the server. Showing up to 200 players, newest save first.</p>`;
}
async function ownerLoad() {
  ownerMsg = ''; ownerData = null; renderOwner();
  try {
    await Store.ready;
    const [players, vote, sg] = await Promise.all([Store.call('GET', 'owner/players'), Store.call('GET', 'vote').catch(() => null), Store.call('POST', 'owner/suggest', { do: 'list' }).catch(() => null)]);
    ownerData = players; ownerVote = vote; ownerSg = sg;
  } catch (e) { ownerMsg = e.status === 404 ? 'This is only for the owner account.' : e.message || 'The dashboard can’t be reached right now.'; }
  renderOwner();
}
function openOwner() { G.mode = 'owner'; show('scrOwner'); ownerLoad(); }
function closeOwner() { Sound.play('click'); G.mode = 'title'; show('scrTitle'); }
$('btnOwner').onclick = () => { Sound.init(); Sound.play('click'); openOwner(); };
$('btnOwnerBack').onclick = closeOwner;
$('btnOwnerRefresh').onclick = () => { Sound.play('click'); ownerLoad(); };
$('ownerBody').addEventListener('click', ev => {
  const b = ev.target.closest('[data-owsort]'); if (b) { ownerSort = b.dataset.owsort; Sound.play('click'); renderOwner(); return; }
  const d = ev.target.closest('[data-owdel]');
  if (d && !d.disabled) {
    Sound.play('click');
    if (!confirm(`Delete the account “${d.dataset.name}”? Its saves are gone for good, and it comes off the leaderboards and votes. This can’t be undone.`)) return;
    ownerBusy = true; renderOwner();
    Store.call('POST', 'owner/delete', { name: d.dataset.owdel }).then(r => { toast(`Deleted ${r.name}.`); ownerBusy = false; ownerLoad(); })
      .catch(e => { toast(e.message || 'That didn’t go through.'); ownerBusy = false; renderOwner(); });
    return;
  }
  const s = ev.target.closest('[data-owsg]'); if (!s || s.disabled) return;
  const act = s.dataset.owsg, sure = { on: 'Open community voting? Players can post ideas, vote and comment again.',
    off: 'Close community ideas? Players won’t be able to post or vote until you open them again.', round: 'Start a new round? Every idea and vote on the board now is cleared for good.',
    delete: 'Take this idea down? Its votes go with it.' }[act];
  Sound.play('click'); if (sure && !confirm(sure)) return;
  ownerSgAct(act, s.dataset.id || '');
});
// Everyone who plays, guests included: anonymous daily counts (93_stats.js). Each browser counts once a day for visits, playing and the road.
function ownerActivityHTML(rows) {
  const n = (r, k) => r[k] || 0, week = rows.slice(0, 7), sum = k => week.reduce((a, r) => a + n(r, k), 0);
  const day = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  const card = (label, value) => `<div class="ow-card"><b>${value}</b><span>${esc(label)}</span></div>`;
  return `<div class="opt ow-sg"><h3>Everyone who plays, guests included</h3>
    <div class="ow-cards">${card('Visitors, 7 days', sum('visit'))}${card('From Reddit', sum('visit:reddit'))}${card('Played', sum('play'))}${card('Played, from Reddit', sum('play:reddit'))}${card('Hunts cleared', sum('clear'))}${card('Came back', sum('visit:ret'))}</div>
    ${rows.length ? `<div class="ow-scroll"><table class="ow-table"><thead><tr><th>Day</th><th>Visitors</th><th>Reddit</th><th>Guests</th><th>Phone</th><th>Came back</th><th>Played</th><th>Reddit players</th><th>Road done</th><th>Hunts</th><th>Cleared</th></tr></thead><tbody>${rows.slice(0, 14).map(r =>
      `<tr><td>${esc(day(r.day))}</td><td>${n(r, 'visit')}</td><td>${n(r, 'visit:reddit')}</td><td>${n(r, 'visit:guest')}</td><td>${n(r, 'visit:phone')}</td><td>${n(r, 'visit:ret')}</td><td>${n(r, 'play')}</td><td>${n(r, 'play:reddit')}</td><td>${n(r, 'road')}</td><td>${n(r, 'hunt')}</td><td>${n(r, 'clear')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No counts yet. They start with the next visit.</p>'}
    <p class="muted" style="font-size:.85rem">Counts only, Chicago time. Each browser counts once a day as a visitor and once as a player. Reddit means the visit came from a Reddit link, or a link tagged ?from=reddit. Browsers signed in as Theowner aren’t counted.</p></div>
    ${ownerPlacesHTML(week, card)}`;
}
// Where visitors are, 7 days: a US state, or the country elsewhere, from Cloudflare's lookup of each visit. Home is Oklahoma.
const US_STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, D.C.',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
function ownerPlace(code) {
  const [c, r] = code.split('-');
  if (c === 'US') return US_STATES[r] || 'United States';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch (e) { return c; }
}
function ownerPlacesHTML(week, card) {
  const all = {}, red = {};
  for (const r of week) for (const [k, v] of Object.entries(r)) {
    if (k.startsWith('visit:at:')) all[k.slice(9)] = (all[k.slice(9)] || 0) + v;
    else if (k.startsWith('visit:rat:')) red[k.slice(10)] = (red[k.slice(10)] || 0) + v;
  }
  const list = Object.keys(all).sort((a, b) => all[b] - all[a] || ownerPlace(a).localeCompare(ownerPlace(b)));
  const total = o => Object.values(o).reduce((a, v) => a + v, 0), away = o => total(o) - (o['US-OK'] || 0);
  return `<div class="opt ow-sg"><h3>Where visitors are, 7 days</h3>
    ${list.length ? `<div class="ow-cards">${card('Outside Oklahoma', away(all))}${card('From Reddit, outside Oklahoma', away(red))}</div>
    <div class="ow-scroll"><table class="ow-table"><thead><tr><th>Place</th><th>Visitors</th><th>From Reddit</th></tr></thead><tbody>${list.map(k =>
      `<tr><td>${esc(ownerPlace(k))}</td><td>${all[k]}</td><td>${red[k] || 0}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No places yet. They start with the next visit.</p>'}
    <p class="muted" style="font-size:.85rem">Roughly where each visitor’s connection is, by state in the US and by country elsewhere. Phones on mobile data or a VPN can show up in the wrong state.</p></div>`;
}
// Community ideas: open or close them (opening ends the 1.1 vote), take a post down, or clear the board for a new round.
function ownerSgHTML() {
  const d = ownerSg; if (!d) return '<div class="opt ow-sg"><h3>Community ideas</h3><p class="muted">Couldn’t load the ideas.</p></div>';
  const b = (act, label, ghost = true, id = '') => `<button class="btn${ghost ? ' ghost' : ''} small" type="button" data-owsg="${act}"${id ? ` data-id="${esc(id)}"` : ''} ${ownerBusy ? 'disabled' : ''}>${label}</button>`;
  return `<div class="opt ow-sg"><h3>Community voting · round ${d.round}</h3>
    <p class="${d.on ? '' : 'muted'}">${d.on ? `Open. ${d.total} ${d.total === 1 ? 'idea' : 'ideas'} posted.` : 'Closed. Players can read the ideas but can’t post, vote or comment.'}</p>
    <div class="row">${d.on ? b('off', 'Close voting') : b('on', 'Open voting', false)}${d.total ? b('round', 'New round') : ''}</div>
    ${d.posts.length ? `<div class="ow-scroll"><table class="ow-table"><thead><tr><th>Votes</th><th>Idea</th><th>By</th><th></th></tr></thead><tbody>${d.posts.map(p =>
      `<tr><td>${p.n}</td><td class="ow-wrap">${esc(p.text)}</td><td>${esc(p.name)}</td><td>${b('delete', 'Take down', true, p.id)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
}
async function ownerSgAct(act, id) {
  if (ownerBusy) return;
  ownerBusy = true; renderOwner();
  try { ownerSg = await Store.call('POST', 'owner/suggest', { do: act, id }); }
  catch (e) { toast(e.message || 'That didn’t go through.'); }
  ownerBusy = false; renderOwner();
}
$('ownerBody').addEventListener('input', ev => {
  if (ev.target.id !== 'ownerFind') return;
  ownerFind = ev.target.value; const at = ev.target.selectionStart; renderOwner();
  const inp = $('ownerFind'); if (inp) { inp.focus(); inp.setSelectionRange(at, at); }
});
