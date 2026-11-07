/* ============================== PLAYER COUNTS ============================== */
// Anonymous counts for the owner dashboard: how many people visit, play and clear hunts each day, guests included, and whether
// they came from Reddit. Nothing identifies anyone: no names, no ids, no cookies, and the server keeps only daily totals. Each
// browser remembers on its own (in localStorage, never sent) whether it was already counted today.
const STATS_KEY = 'olympus-hunt/seen';
let statsSeen = null;
const statsDay = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
function statsRef() {
  let h = ''; try { h = new URL(document.referrer).hostname.toLowerCase(); } catch (e) {}
  return !h || h === location.hostname ? 'direct' : /(^|\.)reddit\.com$|(^|\.)redd\.it$/.test(h) ? 'reddit' : /(^|\.)google\./.test(h) ? 'google' : 'other';
}
// visit, play and road count once a day per browser; hunt and clear count every time.
async function anHit(e) {
  try {
    await Store.ready; if (!Store.api) return;
    const day = statsDay();
    if (!statsSeen) { try { statsSeen = JSON.parse(localStorage.getItem(STATS_KEY)); } catch (err) { statsSeen = null; } }
    if (!statsSeen || statsSeen.day !== day) statsSeen = { day, first: (statsSeen && statsSeen.first) || day, ref: statsRef(), done: {} };
    if ((e === 'visit' || e === 'play' || e === 'road') && statsSeen.done[e]) return;
    statsSeen.done[e] = 1; try { localStorage.setItem(STATS_KEY, JSON.stringify(statsSeen)); } catch (err) {}
    const body = { e, ref: statsSeen.ref, acct: !!Store.user };
    if (e === 'visit') { body.phone = matchMedia('(pointer: coarse)').matches; body.ret = statsSeen.first !== day; }
    await Store.call('POST', 'hit', body, true);
  } catch (err) {}                                                   // counting never gets in the way of playing
}
