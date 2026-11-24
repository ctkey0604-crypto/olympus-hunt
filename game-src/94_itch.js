/* ============================== ITCH.IO ============================== */
// The itch.io copy has no accounts of its own: every game on itch.io shares one storage area, so a login kept there could be
// read by any other game. Play online opens olympushunt.com in the same frame instead, where logins are safe, and brings the
// saves in this browser along. Everything else in the itch.io copy works without the server, as before.
const ITCH = /(^|\.)itch\.(io|zone)$/.test(location.hostname), ITCH_SITE = 'https://olympushunt.com';
let itchBusy = false, itchMoved = [];
// this browser's saves, as save codes: "1.OH1…,3.OH1…"
function itchBundle() {
  const out = [];
  for (let n = 1; n <= 3; n++) { const s = sanitize(Store.readLocal(n, null)); if (s) out.push(n + '.' + encodeURIComponent(encodeSave(s))); }
  return out.join(',');
}
async function itchGoOnline() {
  if (itchBusy) return; itchBusy = true;
  if (G.save && G.slot) persist(true);
  try {   // is it up? (no-cors: only whether it answers)
    const c = new AbortController(), t = setTimeout(() => c.abort(), 6000);
    await fetch(ITCH_SITE + '/api/health', { mode: 'no-cors', cache: 'no-store', signal: c.signal }); clearTimeout(t);
  } catch (e) { itchBusy = false; toast('Can’t reach olympushunt.com right now. Try again in a moment.', 6000); return; }
  const b = itchBundle();
  location.href = ITCH_SITE + '/?from=itch' + (b ? '#itch=' + b : '#itch=');
}
// On olympushunt.com, inside the itch.io page: take the saves that came along. They go in the signed-out slots, so making an
// account moves them into it, and logging into an account that has saves leaves that account's saves alone. A save already
// here is only replaced by a later copy of the same game.
function itchTakeSaves() {
  if (ITCH || !/^#itch=/.test(location.hash)) return;
  const raw = location.hash.slice(6);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (window.top === window) return;
  G.fromItch = true;
  for (const part of raw.split(',')) {
    const m = part.match(/^([123])\.(.+)$/); if (!m) continue;
    let s = null; try { s = decodeSave(decodeURIComponent(m[2])); } catch (e) {} if (!s) continue;
    const n = +m[1], mine = sanitize(Store.readLocal(n, null));
    if (mine && (mine.createdAt !== s.createdAt || (mine.playtime || 0) >= (s.playtime || 0))) continue;
    if (mine) try { localStorage.setItem(Store.key(n, null) + '.bak', JSON.stringify(mine)); } catch (e) {}
    if (Store.writeLocal(n, s, null)) itchMoved.push(n);
  }
}
// just arrived from itch.io: straight to the saves, where the log in box is
async function itchArrive() {
  await Store.ready; if (!G.fromItch || G.mode !== 'title') return;
  if (Store.user) { toast(`You’re online as ${Store.user}.`, 5000); return; }
  if (!Store.api) return;
  acctMsg = 'You’re online now. Log in, or create an account.' + (itchMoved.length ? ` Your itch.io ${itchMoved.length > 1 ? 'saves' : 'save'} came along, and a new account keeps ${itchMoved.length > 1 ? 'them' : 'it'}.` : '');
  G.mode = 'slots'; show('scrSlots'); renderSlots();
}
const itchCard = text => `<div class="acct-row"><span>${text}</span><button class="btn small" type="button" data-itch="1">Play online</button></div>`;
document.addEventListener('click', ev => { if (ev.target.closest('[data-itch]')) { Sound.init(); Sound.play('click'); itchGoOnline(); } });
