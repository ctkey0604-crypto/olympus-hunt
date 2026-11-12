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
function openVote() { openForum('ideas'); }                         // the 1.1 vote is over: the banner leads to Community voting
function closeVote() { Sound.play('click'); G.mode = 'title'; show('scrTitle'); }
$('btnVoteBack').onclick = closeVote;
$('voteBody').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.vote) { Sound.play('click'); voteCast(b.dataset.vote); }
  else if (b.dataset.votesign) { Sound.play('click'); G.mode = 'slots'; show('scrSlots'); renderSlots(); }
});
$('ideasBody').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.sgvote) { Sound.play('click'); sgAct('suggest/vote', { id: b.dataset.sgvote }, 'jingle'); }
  else if (b.dataset.sgcom) { Sound.play('click'); if (sgOpen === b.dataset.sgcom) { sgOpen = null; renderSuggest(); } else sgComLoad(b.dataset.sgcom); }
  else if (b.dataset.sgcdel) { Sound.play('click'); if (confirm('Delete this comment?')) sgComAct('suggest/uncomment', { id: sgOpen, cid: b.dataset.sgcdel }); }
  else if (b.dataset.sgdel) { Sound.play('click'); if (confirm('Take your idea down? Its votes go with it.')) sgAct('suggest/delete', {}); }
  else if (b.dataset.votesign) { Sound.play('click'); G.mode = 'slots'; show('scrSlots'); renderSlots(); }
});

/* ---- community voting, under Community: the banner on the title screen leads here ---- */
// Players post one idea each and vote for someone else's, one vote each that they can change. The one with the most votes when the
// round ends gets made. The server keeps it all (Lobby.suggest) and filters what's posted.
const SG_MAX = 150;
let sgData = null, sgBusy = false, sgMsg = '', sgDraft = '', sgOpen = null, sgCom = null, sgCDraft = '', sgCMsg = '';   // sgCMsg: what went wrong with a comment, shown by its box
function renderSuggest() {
  const d = sgData, votes = c => `${c} ${c === 1 ? 'vote' : 'votes'}`, own = d && d.posts.find(p => p.yours);
  const lead = !Store.api ? 'Community voting needs the online version of the game.' : !d ? (sgMsg ? '' : 'Looking…') : d.on ? 'Update 1.1, the Norse update, is out now! Post one idea for what comes next, and vote for your favorite. When the round ends, the idea with the most votes gets added to Olympus Hunt.'
    : 'Community voting is closed right now. You can still read the ideas.';
  const form = d && d.on && Store.user && !own ? `<form class="sg-form" id="sgForm" autocomplete="off"><input id="sgInput" maxlength="${SG_MAX}" placeholder="Your idea (one per player)" value="${esc(sgDraft)}" spellcheck="true" aria-label="Your idea">
    <button class="btn" type="submit" ${sgBusy ? 'disabled' : ''}>Post</button></form>` : '';
  const item = (p, i) => `<article class="sg-item${p.yours ? ' own' : ''}${d.mine === p.id ? ' on' : ''}"><b class="sg-rank">${i + 1}</b>
    <div class="sg-text"><p>${esc(p.text)}</p><span class="muted">by ${esc(p.name)}</span><button class="sg-cbtn" type="button" data-sgcom="${esc(p.id)}">${sgOpen === p.id ? 'Hide comments' : p.c ? `${p.c} ${p.c === 1 ? 'comment' : 'comments'}` : 'Comment'}</button></div>
    <div class="sg-side"><span class="sg-n">${votes(p.n)}</span>${p.yours ? `<button class="btn ghost small" type="button" data-sgdel="1" ${sgBusy ? 'disabled' : ''}>Take it down</button>`
      : d.mine === p.id ? '<b class="sg-mine">Your vote</b>' : Store.user && d.on ? `<button class="btn${d.mine ? ' ghost' : ''} small" type="button" data-sgvote="${esc(p.id)}" ${sgBusy ? 'disabled' : ''}>${d.mine ? 'Change to this' : 'Vote'}</button>` : ''}</div></article>${sgOpen === p.id ? sgComHTML(p.id) : ''}`;
  $('ideasBody').innerHTML = `${lead ? `<p class="vote-lead">${esc(lead)}</p>` : ''}${sgMsg ? `<p class="sg-err">${esc(sgMsg)}</p>` : ''}${form}
    ${d ? (d.posts.length ? `<div class="sg-list">${d.posts.map(item).join('')}</div>${d.total > d.posts.length ? `<p class="muted">Showing the top ${d.posts.length} of ${d.total} ideas.</p>` : ''}` : '<p class="muted">No ideas yet. Be the first!</p>') : ''}
    ${Store.api && d && !Store.user ? '<div class="row" style="margin-top:14px"><button class="btn" type="button" data-votesign="1">Sign in to post and vote</button></div>' : ''}`;
}
// The comments under one idea, opened from its Comment button.
function sgComHTML(id) {
  const c = sgCom && sgCom.id === id ? sgCom : null, busy = sgBusy ? 'disabled' : '';
  return `<div class="sg-comments">${!c ? '<p class="muted">Looking…</p>' : c.comments.length ? c.comments.map(x => `<div class="sg-com"><p>${esc(x.text).replace(/\n/g, '<br>')}</p>
    <div class="fm-meta"><span>${esc(x.name)} · ${fmAgo(x.at)}</span>${x.yours || isOwner() ? `<button class="fm-del" type="button" data-sgcdel="${esc(x.id)}" ${busy}>Delete</button>` : ''}</div></div>`).join('') : '<p class="muted">No comments yet.</p>'}
    ${sgCMsg ? `<p class="sg-err" style="margin:0">${esc(sgCMsg)}</p>` : ''}${Store.user && sgData && sgData.on ? `<form class="fm-form" id="sgCForm" autocomplete="off"><textarea id="sgCText" maxlength="300" rows="2" placeholder="Write a comment" aria-label="Your comment">${esc(sgCDraft)}</textarea>
    <div class="row"><button class="btn small" type="submit" ${busy}>Comment</button></div></form>` : ''}</div>`;
}
async function sgComLoad(id) {
  sgOpen = id; sgCom = null; sgCMsg = ''; renderSuggest();
  try { sgCom = await Store.call('GET', 'suggest/c/' + id); } catch (e) { sgMsg = e.message || 'The comments can’t be reached right now.'; sgOpen = null; }
  renderSuggest();
}
async function sgComAct(path, body) {
  if (sgBusy) return;
  sgBusy = true; sgMsg = sgCMsg = ''; renderSuggest();
  try { sgCom = await Store.call('POST', path, body); if (path === 'suggest/comment') sgCDraft = ''; const p = sgData && sgData.posts.find(x => x.id === sgCom.id); if (p) p.c = sgCom.comments.length; }
  catch (e) { sgCMsg = e.message || 'That didn’t go through. Try again.'; }      // beside the comment box: the top of the list may be far off screen
  sgBusy = false; renderSuggest();
}
async function sgLoad() {
  sgData = null; sgMsg = sgCMsg = ''; sgOpen = null; renderSuggest();
  await Store.ready; if (!Store.api) { renderSuggest(); return; }
  try { sgData = await Store.call('GET', 'suggest'); } catch (e) { sgMsg = 'The ideas can’t be reached right now. Check your connection.'; }
  renderSuggest();
}
async function sgAct(path, body, sound) {
  if (sgBusy) return;
  sgBusy = true; sgMsg = ''; renderSuggest();
  try { sgData = await Store.call('POST', path, body); if (path === 'suggest') sgDraft = ''; if (sound) Sound.play(sound); }
  catch (e) { sgMsg = e.message || 'That didn’t go through. Try again.'; }
  sgBusy = false; renderSuggest();
}
$('ideasBody').addEventListener('submit', ev => {
  if (ev.target.id === 'sgCForm') { ev.preventDefault(); if (sgCDraft.trim() && sgOpen) { Sound.play('click'); sgComAct('suggest/comment', { id: sgOpen, text: sgCDraft }); } return; }
  if (ev.target.id !== 'sgForm') return;
  ev.preventDefault(); const text = $('sgInput').value.trim(); if (!text) return;
  sgDraft = $('sgInput').value; Sound.play('click'); sgAct('suggest', { text }, 'jingle');
});
$('ideasBody').addEventListener('input', ev => { if (ev.target.id === 'sgInput') sgDraft = ev.target.value; else if (ev.target.id === 'sgCText') sgCDraft = ev.target.value; });
