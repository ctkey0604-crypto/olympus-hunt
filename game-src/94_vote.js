/* ============================== THE COMMUNITY VOTE ============================== */
// Players pick what update 1.1 will be, from the banner on the title screen. One vote per account, and it can be changed while the vote is
// open. The totals show once you've voted, so nobody just follows the leader. The server keeps the count (Lobby.vote), and its
// POLL lists these same ids.
const VOTE = [
  { id: 'egypt',  name: 'Egypt',        col: '#e9c04f', desc: 'Sail to a new land with its own gods and a new rank. Hunt Set, Anubis and Ra along the Nile.' },
  { id: 'norse',  name: 'The North',    col: '#8fc4f5', desc: 'Cross the frozen sea to Asgard. Hunt Thor, Loki and the frost giants.' },
  { id: 'harder', name: 'Cursed Hunts', col: '#ff8a7a', desc: 'Stronger versions of the gods you know, with new attacks, plus a New Game+ for your old saves.' },
];
let voteData = null, voteBusy = false, voteMsg = '';
function renderVote() {
  const d = voteData, mine = d && d.mine, n = id => (d && d.counts[id]) || 0, total = VOTE.reduce((a, o) => a + n(o.id), 0);
  const pct = id => total ? Math.round(n(id) / total * 100) : 0, votes = c => `${c} ${c === 1 ? 'vote' : 'votes'}`;
  const lead = !Store.api ? '' : voteMsg || (!d ? 'Looking…' : mine ? `Thanks for voting! ${votes(total)} so far. You can change yours while the vote is open.`
    : Store.user ? 'Pick the one you want most. You can change your mind while the vote is open.' : 'Sign in to vote. Each account gets one vote.');
  const card = o => `<article class="vote-card${mine === o.id ? ' on' : ''}" style="--c:${o.col}"><h3>${esc(o.name)}</h3><p>${esc(o.desc)}</p>
    ${mine ? `<div class="vote-bar"><i style="width:${pct(o.id)}%"></i></div><div class="vote-row"><span>${pct(o.id)}% · ${votes(n(o.id))}</span>${mine === o.id ? '<b>Your vote</b>' : `<button class="btn ghost small" type="button" data-vote="${o.id}" ${voteBusy ? 'disabled' : ''}>Change to this</button>`}</div>`
      : d && Store.user ? `<button class="btn" type="button" data-vote="${o.id}" ${voteBusy ? 'disabled' : ''}>Vote</button>` : ''}</article>`;
  $('voteBody').innerHTML = `${lead ? `<p class="vote-lead">${esc(lead)}</p>` : ''}<div class="vote-grid">${VOTE.map(card).join('')}</div>
    ${Store.api && d && !Store.user ? '<div class="row" style="margin-top:14px"><button class="btn" type="button" data-votesign="1">Sign in to vote</button></div>' : ''}`;
}
async function voteLoad() {
  voteData = null; voteMsg = ''; renderVote();
  await Store.ready; if (!Store.api) { renderVote(); return; }
  try { voteData = await Store.call('GET', 'vote'); } catch (e) { voteMsg = 'The vote can’t be reached right now. Check your connection.'; }
  renderVote();
}
async function voteCast(id) {
  if (voteBusy) return;
  voteBusy = true; voteMsg = ''; renderVote();
  try { voteData = await Store.call('POST', 'vote', { choice: id }); Sound.play('jingle'); } catch (e) { voteMsg = e.message || 'Your vote didn’t go through. Try again.'; }
  voteBusy = false; renderVote();
}
function openVote() { G.mode = 'vote'; show('scrVote'); voteLoad(); }
function closeVote() { Sound.play('click'); G.mode = 'title'; show('scrTitle'); }
$('btnVote').onclick = () => { Sound.init(); Sound.play('click'); openVote(); };
$('btnVoteBack').onclick = closeVote;
$('voteBody').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.vote) { Sound.play('click'); voteCast(b.dataset.vote); }
  else if (b.dataset.votesign) { Sound.play('click'); G.mode = 'slots'; show('scrSlots'); renderSlots(); }
});
