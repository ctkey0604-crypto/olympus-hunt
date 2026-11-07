/* ============================== THE COMMUNITY BOARD ============================== */
// One General discussion from the title screen: start a post, reply to one, or take your own down. Anyone can read; signing in
// lets you write. The server filters what's posted (no rude words, no links) and the owner can take anything down.
let fmList = null, fmThread = null, fmView = 'list', fmBusy = false, fmMsg = '', fmDraft = { title: '', text: '', reply: '' };
const fmAgo = at => fmtAgo(Math.max(60000, Date.now() - at));
const fmBody = s => esc(s).replace(/\n/g, '<br>');
const fmCan = o => o.yours || isOwner();
function renderForum() {
  const box = $('forumBody'), signed = !!Store.user, busy = fmBusy ? 'disabled' : '';
  const err = fmMsg ? `<p class="sg-err">${esc(fmMsg)}</p>` : '';
  const sign = `<div class="row"><button class="btn" type="button" data-fm="sign">Sign in to post</button></div>`;
  if (!Store.api) { box.innerHTML = '<p class="vote-lead">The community board needs the online version of the game.</p>'; return; }
  if (fmView === 'new') {
    box.innerHTML = `<p class="vote-lead">Start a post. Everyone can read it, so keep it friendly.</p>${err}
      <form class="fm-form" id="fmNew" autocomplete="off"><input id="fmTitle" maxlength="60" placeholder="Title" value="${esc(fmDraft.title)}" aria-label="Title">
      <textarea id="fmText" maxlength="600" rows="6" placeholder="What do you want to say?" aria-label="Your post">${esc(fmDraft.text)}</textarea>
      <div class="row"><button class="btn" type="submit" ${busy}>Post</button><button class="btn ghost" type="button" data-fm="list">Cancel</button></div></form>`;
    return;
  }
  if (fmView === 'thread') {
    const d = fmThread;
    if (!d) { box.innerHTML = `${err}<p class="vote-lead">${fmMsg ? '' : 'Looking…'}</p><div class="row"><button class="btn ghost small" type="button" data-fm="list">All posts</button></div>`; return; }
    const T = d.thread, del = (o, rid) => fmCan(o) ? `<button class="fm-del" type="button" data-fmdel="${esc(T.id)}"${rid ? ` data-rid="${esc(rid)}"` : ''} ${busy}>Delete</button>` : '';
    box.innerHTML = `<div class="row"><button class="btn ghost small" type="button" data-fm="list">All posts</button></div>
      <article class="fm-post fm-op"><h3>${esc(T.title)}</h3><p>${fmBody(T.text)}</p><div class="fm-meta"><span>${esc(T.name)} · ${fmAgo(T.at)}</span>${del(T)}</div></article>
      <h4 class="fm-count">${d.replies.length ? `${d.replies.length} ${d.replies.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}</h4>
      ${d.replies.map(r => `<article class="fm-post"><p>${fmBody(r.text)}</p><div class="fm-meta"><span>${esc(r.name)} · ${fmAgo(r.at)}</span>${del(r, r.id)}</div></article>`).join('')}
      ${err}${signed ? `<form class="fm-form" id="fmReply" autocomplete="off"><textarea id="fmReplyText" maxlength="300" rows="3" placeholder="Write a reply" aria-label="Your reply">${esc(fmDraft.reply)}</textarea>
      <div class="row"><button class="btn" type="submit" ${busy}>Reply</button></div></form>` : sign}`;
    return;
  }
  const d = fmList;
  box.innerHTML = `<p class="vote-lead">Talk about the game, ask for help, or tell us about a bug. Posts are public, so be kind.</p>${err}
    ${signed ? `<div class="row"><button class="btn" type="button" data-fm="new">New post</button></div>` : sign}
    ${!d ? (fmMsg ? '' : '<p class="muted">Looking…</p>') : d.threads.length ? `<div class="fm-list">${d.threads.map(t => `<button class="fm-row" type="button" data-fmopen="${esc(t.id)}">
      <b>${esc(t.title)}</b><span>${esc(t.name)} · ${t.n} ${t.n === 1 ? 'reply' : 'replies'} · ${fmAgo(t.last)}</span></button>`).join('')}</div>` : '<p class="muted">No posts yet. Start the first one!</p>'}`;
}
async function fmCall(fn) {
  if (fmBusy) return; fmBusy = true; fmMsg = ''; renderForum();
  try { await Store.ready; await fn(); } catch (e) { fmMsg = e.message || 'That didn’t go through. Try again.'; }
  fmBusy = false; renderForum();
}
const fmLoadList = () => { fmView = 'list'; fmList = null; return fmCall(async () => { fmList = await Store.call('GET', 'forum'); }); };
const fmOpen = id => { fmView = 'thread'; fmThread = null; fmDraft.reply = ''; return fmCall(async () => { fmThread = await Store.call('GET', 'forum/t/' + id); }); };
function openForum() { G.mode = 'forum'; show('scrForum'); fmLoadList(); }
function forumBack() {
  Sound.play('click'); fmMsg = '';
  if (fmView !== 'list') { fmLoadList(); return; }
  G.mode = 'title'; show('scrTitle');
}
$('btnForum').onclick = () => { Sound.init(); Sound.play('click'); openForum(); };
$('btnForumBack').onclick = forumBack;
$('btnForumRefresh').onclick = () => { Sound.play('click'); if (fmView === 'thread' && fmThread) fmOpen(fmThread.thread.id); else if (fmView === 'list') fmLoadList(); };
$('forumBody').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  const a = b.dataset.fm;
  if (a === 'new') { Sound.play('click'); fmView = 'new'; fmMsg = ''; renderForum(); const t = $('fmTitle'); if (t) t.focus(); }
  else if (a === 'list') { Sound.play('click'); fmLoadList(); }
  else if (a === 'sign') { Sound.play('click'); G.mode = 'slots'; show('scrSlots'); renderSlots(); }
  else if (b.dataset.fmopen) { Sound.play('click'); fmOpen(b.dataset.fmopen); }
  else if (b.dataset.fmdel) {
    const rid = b.dataset.rid || ''; Sound.play('click');
    if (!confirm(rid ? 'Delete this reply?' : 'Delete this whole post and its replies?')) return;
    fmCall(async () => { const d = await Store.call('POST', 'forum/delete', { id: b.dataset.fmdel, rid }); if (rid) fmThread = d; else { fmList = d; fmView = 'list'; } });
  }
});
$('forumBody').addEventListener('input', ev => {
  if (ev.target.id === 'fmTitle') fmDraft.title = ev.target.value;
  else if (ev.target.id === 'fmText') fmDraft.text = ev.target.value;
  else if (ev.target.id === 'fmReplyText') fmDraft.reply = ev.target.value;
});
$('forumBody').addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.id === 'fmNew') {
    if (!fmDraft.title.trim() || !fmDraft.text.trim()) { fmMsg = 'Give your post a title and a few words.'; renderForum(); return; }
    Sound.play('click');
    fmCall(async () => { fmThread = await Store.call('POST', 'forum', { title: fmDraft.title, text: fmDraft.text }); fmDraft.title = fmDraft.text = ''; fmView = 'thread'; Sound.play('jingle'); });
  } else if (ev.target.id === 'fmReply' && fmThread) {
    if (!fmDraft.reply.trim()) return;
    Sound.play('click');
    fmCall(async () => { fmThread = await Store.call('POST', 'forum/reply', { id: fmThread.thread.id, text: fmDraft.reply }); fmDraft.reply = ''; });
  }
});
