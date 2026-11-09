/* ============================== PLAYER COUNTS ============================== */
// Anonymous counts for the owner dashboard: how many people visit, play and clear hunts each day, guests included, and whether
// they came from Reddit. Nothing identifies anyone: no names, no ids, no cookies, and the server keeps only daily totals. Each
// browser remembers on its own (in localStorage, never sent) whether it was already counted today.
const STATS_KEY = 'olympus-hunt/seen', STATS_OFF = 'olympus-hunt/nocount';
let statsSeen = null;
const statsDay = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
// Where this visit came from. A link tagged ?from=reddit counts as Reddit even when the Reddit app hides where it came from.
// The tag then comes off the address, so a copied or bookmarked link doesn't count as Reddit again.
function statsRef() {
  let tag = '';
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('from')) { tag = String(u.searchParams.get('from') || '').trim().toLowerCase() || 'other'; u.searchParams.delete('from'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  } catch (e) {}
  if (tag) return tag === 'reddit' ? 'reddit' : tag === 'google' ? 'google' : 'other';
  let h = ''; try { h = new URL(document.referrer).hostname.toLowerCase(); } catch (e) {}
  return !h || h === location.hostname ? 'direct' : /(^|\.)reddit\.com$|(^|\.)redd\.it$/.test(h) ? 'reddit' : /(^|\.)google\./.test(h) ? 'google' : 'other';
}
const STATS_REF = statsRef();                                        // read once, as the page opens
// The owner's own browsers aren't counted, so the owner's visits and test clicks don't add to the numbers. A browser that has
// been signed in as the owner stays left out, even after signing out.
function statsOff() {
  try { if (String(Store.user || '').toLowerCase() === 'theowner') localStorage.setItem(STATS_OFF, '1'); return localStorage.getItem(STATS_OFF) === '1'; } catch (e) { return false; }
}
// visit, play and road count once a day per browser; hunt and clear count every time.
async function anHit(e) {
  try {
    await Store.ready; if (!Store.api || statsOff()) return;
    const day = statsDay();
    if (!statsSeen) { try { statsSeen = JSON.parse(localStorage.getItem(STATS_KEY)); } catch (err) { statsSeen = null; } }
    if (!statsSeen || statsSeen.day !== day) statsSeen = { day, first: (statsSeen && statsSeen.first) || day, ref: STATS_REF, done: {} };
    if ((e === 'visit' || e === 'play' || e === 'road') && statsSeen.done[e]) return;
    statsSeen.done[e] = 1; try { localStorage.setItem(STATS_KEY, JSON.stringify(statsSeen)); } catch (err) {}
    const body = { e, ref: statsSeen.ref, acct: !!Store.user };
    if (e === 'visit') { body.phone = matchMedia('(pointer: coarse)').matches; body.ret = statsSeen.first !== day; }
    await Store.call('POST', 'hit', body, true);
  } catch (err) {}                                                   // counting never gets in the way of playing
}
