'use strict';
/* ============================================================================
   PUBLIC COMPANIES (v0.08): going public, and owning part of other players'
   companies. The server (server/index.js) keeps the share register; cash stays
   in each game, like everything else about a company.
   - A share's price: the company's value plus 15 minutes of its steady profit (at
     most 25% more, v0.10), over all its shares (pubFair); moved by players buying and
     selling it (pubImpact: the square-root law, fading over half an hour), by the
     market's mood (pubMood: the Millbrook 10 over 4 hours) and by the company's own
     wander (pubWander). The last two come from the shared world, so every player
     sees the same price.
   - Going public issues new shares: the cash goes into the company, and the owner's
     part of it shrinks to match. The owner's net worth is their part of the company
     (netWorth = companyValue × ownFrac); areas of town open with the whole company.
   - A public company pays 30% of its profit as dividends, split by who owns it. The
     outside shareholders' part leaves the company; players' part reaches them
     through the server (pubTake), even while they're away.
   ========================================================================== */
// a listing from the server: [ticker, company, owner, shares, owner's shares, value, profit/min, buying $, selling $, at, dividends paid, listed, players' shares, holders, owner online, profit trend (v0.11)]
function pubParse(r) { return { ticker: r[0], co: r[1], owner: r[2], total: +r[3], own: +r[4], book: +r[5], profit: +r[6], fb: +r[7], fs: +r[8], ft: +r[9], paid: +r[10], listed: +r[11], held: +r[12], holders: +r[13], online: !!r[14], growth: r[15] != null ? +r[15] : 1 }; }
function pubListing(t) { return NET.listings.find(L => L.ticker === t) || null; }
function ownFrac() { return S && S.pub && S.pub.total > 0 ? clamp(S.pub.own / S.pub.total, 0, 1) : 1; }
function tickerSeed(t) { let h = 7; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0; return h; }
// what investors add for profit: 15 minutes of steady profit, scaled by its trend (v0.11), at most 25% of the company's value
function pubPremium(book, profit, growth = 1) { return Math.min(PUB_PREM_CAP * Math.max(0, book), PUB_PREMIUM * Math.max(0, profit) * clamp(growth || 1, GROWTH_MIN, GROWTH_MAX)); }
function pubFair(L) { const b = Math.max(0, L.book); return Math.max(.01, (b + pubPremium(b, L.profit, L.growth)) / L.total); }
// players' trading pressure on a share and what's left of it now: it fades with a 30-minute half-life, faster the further it
// had pushed the price (v0.11: Millbrook's investors buy the dips and sell the spikes). The server works it out the same way.
function pubMove(L, fb, fs) { const D = PUB_DEPTH * pubFair(L) * L.total; return clamp(Math.sqrt((1 + fb / D) / (1 + fs / D)), PUB_MOVE[0], PUB_MOVE[1]); }
function pubKeep(L, now) { const s = Math.abs(Math.log(pubMove(L, L.fb, L.fs))) / Math.log(PUB_MOVE[1]); return Math.pow(.5, Math.max(0, now - L.ft) / 1000 / (PUB_HALF / (1 + PUB_REVERT * Math.min(1, s)))); }
function pubPressure(L) { const k = pubKeep(L, nowMs()); return [L.fb * k, L.fs * k]; }
function pubImpact(L) { const [fb, fs] = pubPressure(L); return pubMove(L, fb, fs); }
function pubMood() { const A = WS.assets.MB10, a = A.h60 && A.h60.length ? A.h60[0] : 0; return a ? clamp(Math.pow(A.p / a, 1.2), .85, 1.18) : 1; }
function pubWander(L, t = WT) { return Math.exp(fbm(950 + tickerSeed(L.ticker) % 97, t, .02 / 60, OCT_ID)); }
/* v0.12: price charts for players' companies. The server keeps each listing's share price every 5 minutes for a day
   (before the market's mood and the company's own wander); the game adds those for each moment, as it does for today's. */
const PUBH = {};
function pubMoodAt(t) { const a = marketAt(t - 14400, WS.evs).p.MB10, b = marketAt(t, WS.evs).p.MB10; return a ? clamp(Math.pow(b / a, 1.2), .85, 1.18) : 1; }
async function pubHistLoad(tk) {
  const H = PUBH[tk] || (PUBH[tk] = { at: 0, pts: [], busy: false });
  if (!NET_API || H.busy || Date.now() - H.at < 60e3) return;
  H.busy = true;
  try {
    const d = await (await fetch(NET_API + '/pubhist?t=' + encodeURIComponent(tk), { cache: 'no-store' })).json(), L = pubListing(tk) || { ticker: tk };
    H.pts = (d.pts || []).map(([ms, px]) => { const t = ms / 1000 - WORLD.epoch; return [ms, px * pubMoodAt(t) * pubWander(L, t)]; });
  } catch (e) {}
  H.at = Date.now(); H.busy = false;
}
// v0.13: the game also notes every player company's price every 10 seconds while it runs (kept in this browser for 4 hours),
// so a chart moves as you watch and its recent part is fine-grained; the server's 5-minute prices fill in the rest of the day.
const PUBL = {}, PUBL_EVERY = 10e3, PUBL_KEEP = 4 * 3600e3, PUBL_KEY = 'brick-and-coin/share-prices';
let PUBL_AT = 0, PUBL_SAVED = 0;
try { const o = JSON.parse(localStorage.getItem(PUBL_KEY) || '{}'); for (const k in o) if (Array.isArray(o[k])) PUBL[k] = o[k]; } catch (e) {}
function pubSampleTick() {
  const now = Date.now(); if (now - PUBL_AT < PUBL_EVERY || !NET.listings.length) return; PUBL_AT = now;
  for (const L of NET.listings) { const a = PUBL[L.ticker] || (PUBL[L.ticker] = []); a.push([now, +pubPrice(L).toPrecision(6)]); while (a.length && a[0][0] < now - PUBL_KEEP) a.shift(); }
  if (now - PUBL_SAVED > 60e3) { PUBL_SAVED = now; try { localStorage.setItem(PUBL_KEY, JSON.stringify(PUBL)); } catch (e) {} }
}
// the chart's prices, as [time, price]: the server's 5-minute prices up to where this browser's 10-second ones start, then now
function pubSeries(tk, tf) {
  const L = pubListing(tk); if (!L) return [];
  pubHistLoad(tk);
  const now = Date.now(), from = now - (tf === '4h' ? 4 : 24) * 3600e3, live = (PUBL[tk] || []).filter(p => p[0] >= from), first = live.length ? live[0][0] : now;
  const old = ((PUBH[tk] || {}).pts || []).filter(p => p[0] >= from && p[0] < first - 60e3);
  return old.concat(live, [[now, pubPrice(L)]]);
}
// a smooth, full-resolution chart of [time, price] points (the players' charts): a line through every point, joined straight
// across any gap, stretched to fill the width from the first point to now
function drawSmoothChart(c, pts) {
  const k = Math.min(2, window.devicePixelRatio || 1), W = Math.max(160, Math.floor(c.clientWidth * k)), H = Math.max(80, Math.floor(c.clientHeight * k));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, H);
  if (pts.length < 2) return;
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1, vs = pts.map(p => p[1]);
  let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * .12 || hi * .01; lo -= pad; hi += pad;
  const X = t => 3 * k + (t - t0) / Math.max(1, t1 - t0) * (W - 6 * k), Y = v => H - 4 * k - (v - lo) / (hi - lo) * (H - 8 * k);
  const up = vs[vs.length - 1] >= vs[0], col = up ? '#9bbb55' : '#ff8a7a';
  ctx.fillStyle = '#2a1e19'; for (let g = 1; g < 4; g++) { const y = Math.round(H * g / 4); for (let x = 0; x < W; x += 3 * k) ctx.fillRect(x, y, k, k); }
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])));
  ctx.lineTo(X(t1), H); ctx.lineTo(X(t0), H); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, up ? 'rgba(155,187,85,.32)' : 'rgba(255,138,122,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])));
  ctx.strokeStyle = col; ctx.lineWidth = 2 * k; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  const y0 = Y(vs[0]); ctx.fillStyle = '#85735d'; for (let x = 0; x < W; x += 6 * k) ctx.fillRect(x, y0, 3 * k, k);
  const last = pts[pts.length - 1]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 3.5 * k, 0, Math.PI * 2); ctx.fill();
}
function pubPrice(L) { return pubFair(L) * pubImpact(L) * pubMood() * pubWander(L); }
// this company's own listing, with its value and profit right now (the server's copy is up to a minute old)
function pubMineL() {
  if (!S || !S.pub) return null;
  const L = pubListing(S.pub.ticker) || { ticker: S.pub.ticker, fb: 0, fs: 0, ft: 0, held: 0, holders: 0, paid: 0 };
  return { ...L, total: S.pub.total, own: S.pub.own, book: companyValue(), profit: profitSteady(), growth: profitGrowth() };
}
// shares this company holds in other players' companies, at today's prices (the last known one if a company drops off the list)
function pubHoldValue() {
  if (!S || !S.pubHold) return 0;
  let v = 0; for (const t in S.pubHold) { const h = S.pubHold[t], L = pubListing(t); if (L) h.p = pubPrice(L); v += h.q * (h.p || 0); }
  return v;
}
// dividends: 30% of profit, the outside shareholders' part leaves the company (every 10 s, from step())
function pubPayDividends(dtMin) {
  if (!S.pub) return;
  const out = 1 - ownFrac(), p = profitPerMin(); if (out <= 0 || p <= 0) return;
  const d = PUB_DIV * p * dtMin * out; S.cash -= d; S.pub.paid = (S.pub.paid || 0) + d; if (NET.token) NET.div += d;
}
// what the server says about this company's listing and holdings, dividends received and buyouts (from netTake)
function pubTake(d) {
  if (!('mine' in d) || (d._t0 || 0) < (NET.pubAt || 0)) return;   // not a sync, or one that started before a trade
  S.pub = d.mine ? { ...d.mine, paid: Math.max(S.pub && S.pub.ticker === d.mine.ticker ? S.pub.paid || 0 : 0, d.mine.paid || 0) } : null;
  if (Array.isArray(d.holdings)) {
    const old = S.pubHold || {}; S.pubHold = {};
    for (const [t, q, cost] of d.holdings) { const L = pubListing(t); S.pubHold[t] = { q, cost, p: L ? pubPrice(L) : old[t] ? old[t].p : 0 }; }
  }
  // dividends from players' companies count as profit as they come in, but not a pile that built up while you were away (v0.11)
  if (d.credit > 0) { S.cash += d.credit; if (d.credit <= Math.max(100, 3 * Math.abs(profitSteady()))) addProfit(d.credit); S.pubDivIn = (S.pubDivIn || 0) + d.credit; }
  for (const [t, co, cash] of d.paidOut || []) pushNews(`${co} (${t}) has closed: your shares were bought out for ${money(cash, false)}`, 'info');
}

/* ---------- actions (each returns a promise of a message, or throws one) ---------- */
function ipoQuote(f) {
  const cv = companyValue(), fair = cv + pubPremium(cv, profitSteady(), profitGrowth()), raised = fair * f / (1 - f) * IPO_DISCOUNT * (1 - IPO_FEE);
  return { fair, raised, nwAfter: (cv + raised) * (1 - f) };
}
function floatQuote(target) {
  const L = pubMineL(); if (!L) return null;
  const price = pubFair(L) * pubImpact(L), out = L.total - L.own;
  if (target > out / L.total) { const n = (target * L.total - out) / (1 - target); return { n, cash: n * price * (1 - ISSUE_FEE) }; }
  const n = Math.max(0, Math.min(out - (L.held || 0), (out - target * L.total) / (1 - target)));
  return { n, cash: -n * price * (1 + BUYBACK_FEE) };
}
async function pubGoPublic(f) {
  if (S.pub) throw new Error(`${S.company} is already public`);
  if (S.level < PUB_LEVEL) throw new Error(`Reach Level ${PUB_LEVEL} (${LEVELS[PUB_LEVEL].name}) first`);
  if (!NET.token) throw new Error('Log in first (Menu → Online): going public needs the server');
  if (!PUB_STEPS.includes(f)) throw new Error('Pick how much to sell');
  if (!NET.lastSave) await netSync(true);   // the server needs the company before it can list it
  const d = await netCall('/ipo', { f, company: S.company, book: Math.round(companyValue()), profit: profitSteady(), growth: profitGrowth() });
  NET.pubAt = Date.now();
  S.cash += d.raised; S.pub = { ...d.mine, paid: 0 };
  pushNews(`${S.company} goes public as ${d.ticker}: ${Math.round(f * 100)}% sold to investors for ${money(d.raised, false)}`, 'up');
  saveLocal(); netSaveNow();
  return `${S.company} is public as ${d.ticker}! +${money(d.raised, false)}`;
}
async function pubFloat(target) {
  const q = floatQuote(target); if (!q) throw new Error(`${S.company} isn’t public`);
  if (q.cash < 0 && S.cash < -q.cash) throw new Error(`Not enough cash: buying back costs about ${money(-q.cash, false)}`);
  const d = await netCall('/float', { f: target, book: Math.round(companyValue()), profit: profitSteady(), growth: profitGrowth() });
  NET.pubAt = Date.now();
  S.cash += d.cash; const paid = S.pub.paid || 0; S.pub = d.mine ? { ...d.mine, paid } : null;
  saveLocal(); netSaveNow();
  return d.cash >= 0 ? `Sold new shares: +${money(d.cash, false)}` : d.mine ? `Bought shares back for ${money(-d.cash, false)}` : `${S.company} is private again`;
}
async function pubTrade(t, side, v) {
  const L = pubListing(t); if (!L) throw new Error('Pick a company first');
  if (!NET.token) throw new Error('Log in first (Menu → Online) to trade players’ shares');
  const price = pubPrice(L), fee = FEE.stock;
  let shares;
  if (side === 'buy') {
    const dollars = Math.min(v, S.cash); if (dollars < 1) throw new Error('Not enough cash');
    shares = Math.min(dollars / (price * (1 + fee)), L.total - L.own - L.held);
    if (shares < 1e-3) throw new Error('No shares for sale right now: players hold them all');
  } else {
    const h = S.pubHold[t]; if (!h || h.q <= 0) throw new Error('You own none');
    shares = h.q * v;
  }
  const d = await netCall('/shares', { ticker: t, side, shares, price });
  NET.pubAt = Date.now();
  const amt = shares * d.price;
  if (side === 'buy') S.cash -= amt * (1 + fee); else S.cash += amt * (1 - fee);
  if (d.credit > 0) { S.cash += d.credit; S.pubDivIn = (S.pubDivIn || 0) + d.credit; }
  const had = !!S.pubHold[t];
  if (d.holding) S.pubHold[t] = { q: d.holding[1], cost: d.holding[2], p: d.price }; else delete S.pubHold[t];
  L.holders += (S.pubHold[t] ? 1 : 0) - (had ? 1 : 0);
  const k = pubKeep(L, nowMs());   // show the move at once, before the next sync
  L.fb *= k; L.fs *= k; L.ft = nowMs(); if (side === 'buy') { L.fb += amt; L.held += shares; } else { L.fs += amt; L.held -= shares; }
  saveLocal();
  return side === 'buy' ? `Bought ${qty(shares)} ${t} shares` : `Sold ${qty(shares)} ${t} shares: +${money(amt * (1 - fee), false)}`;
}
async function pubAct(promise, kind) {
  try { const msg = await promise; if (msg) toast(msg, kind === 'ipo' ? 'big' : 'good', kind === 'ipo' ? 4200 : 2600); sfx(kind === 'sell' ? 'sell' : kind === 'buy' ? 'buy' : 'goal'); }
  catch (e) { toast(e.message, 'bad'); sfx('error'); }
  UI.modalSig = ''; UI.sideSig = ''; if (running) { renderModal(); renderSide(); updateTop(); }
}

/* ---------- Invest → Players and Invest → Your company ---------- */
Object.assign(LIVE, {
  pubp(t) { const L = pubListing(t); return L ? money(pubPrice(L)) : '—'; },
  pubchg(t) { const h = pubSeries(t, UI.pubTF || '1d'); if (h.length < 2) return { text: '', cls: '' }; const m = h[h.length - 1][1] / h[0][1] - 1; return { text: pctTxt(m), cls: m >= 0 ? 'olive' : 'red' }; },
  pubimp(t) { const L = pubListing(t); if (!L) return { text: '', cls: '' }; const m = pubImpact(L) - 1; return Math.abs(m) < .005 ? { text: 'steady', cls: 'muted' } : { text: 'players ' + pctTxt(m), cls: m >= 0 ? 'olive' : 'red' }; },
  pubcap(t) { const L = pubListing(t); return L ? money(pubPrice(L) * L.total, false) : '—'; },
  pubfree(t) { const L = pubListing(t); return L ? qty(Math.max(0, L.total - L.own - L.held)) + ' shares' : '—'; },
  pubhq: t => { const h = S.pubHold[t]; return h ? qty(h.q) : '0'; },
  pubhv: t => { const h = S.pubHold[t], L = pubListing(t); return money(h && L ? h.q * pubPrice(L) : 0); },
  pubhpl(t) { const h = S.pubHold[t], L = pubListing(t); if (!h || !L || h.q <= 0) return { text: '—', cls: 'muted' }; const v = h.q * pubPrice(L) - h.cost; return { text: (v >= 0 ? '+' : '') + money(v) + ' (' + pctTxt(v / h.cost) + ')', cls: v >= 0 ? 'olive' : 'red' }; },
  mypx() { const L = pubMineL(); return L ? money(pubPrice(L)) : '—'; },
  mycap() { const L = pubMineL(); return L ? money(pubPrice(L) * L.total, false) : '—'; },
  mynw: () => money(netWorth(), false), mycv: () => money(companyValue(), false), mysteady: () => money(profitSteady()) + '/min',
  mytrend: () => trendTxt(profitGrowth()), pubtrend: t => { const L = pubListing(t); return L ? trendTxt(L.growth) : '—'; },
  myprem() { const L = pubMineL(); if (!L) return '—'; const v = pubPrice(L) * L.total / Math.max(1, companyValue()) - 1; return (v >= 0 ? '+' : '−') + Math.round(Math.abs(v) * 100) + '%'; },
  ipoval: () => money(ipoQuote(UI.ipoF).fair, false),
  iporaise: () => '+' + money(ipoQuote(UI.ipoF).raised, false),
  iponw: () => money(ipoQuote(UI.ipoF).nwAfter, false),
  floatq(v) { const q = floatQuote(+v); return q ? (q.cash >= 0 ? '+' : '−') + money(Math.abs(q.cash), false) : '—'; },
});
// v0.11: a profit trend in words: climbing, steady or sliding, with how much investors make of it
function trendTxt(g) { return { text: Math.abs(g - 1) < .05 ? 'steady' : (g > 1 ? 'climbing +' : 'sliding −') + Math.round(Math.abs(g - 1) * 100) + '%', cls: Math.abs(g - 1) < .05 ? '' : g > 1 ? 'olive' : 'red' }; }
function pubStat(k, v, live) { return `<div class="stat"><span>${k}</span><b${live ? ` data-live="${live}"` : ''}>${v || ''}</b></div>`; }
function pubPlayersView(tabs) {
  // v0.11: your own company is in the list too, marked YOU, just as other players see it (the server's copy: up to a minute old)
  const mine = S.pub ? S.pub.ticker : null, list = NET.listings.slice();
  if (!list.find(L => L.ticker === UI.pubSel)) UI.pubSel = (list.find(L => L.ticker !== mine) || list[0] || {}).ticker || null;
  const L = pubListing(UI.pubSel), sig = `pub|${list.map(x => x.ticker + x.held).join()}|${UI.pubSel}|${NET.token ? 1 : 0}|${Object.keys(S.pubHold).join()}|${mine}|${UI.pubTF}`;
  const intro = `<p class="m-sub">Real players’ companies that have gone public (yours too, marked YOU, as other players see it). A share’s price follows its company’s value and profit, the market’s mood, and players buying and selling it. Each company pays 30% of its profit as dividends, and you get your part while you hold its shares, even while you’re away.${NET_API ? '' : ' Open the game at brickncoin.com to see them.'}</p>`;
  if (!L) return { sig, title: 'Invest', html: tabs + intro + `<section class="card"><h3>No player companies yet</h3><p class="muted" style="font-size:13px">When a player takes their company public, it shows up here. Reach Level ${PUB_LEVEL} and yours could be the first: see Your company.</p></section>` };
  const rows = list.map(x => `<button type="button" class="st-row ${x.ticker === UI.pubSel ? 'sel' : ''}" data-act="pubsel" data-t="${x.ticker}">${iconImg('house', 36)}
      <span class="nm"><b>${esc(x.co)}${x.ticker === mine ? ' <span class="chip gold">YOU</span>' : ''}</b><small>${x.online ? '<i class="dot" title="online now"></i>' : ''}by ${esc(x.owner)} · ${x.ticker}</small></span>
      <span class="px2"><b data-live="pubp:${x.ticker}"></b><small data-live="pubimp:${x.ticker}" data-base=""></small></span></button>`).join('');
  const t = L.ticker, buy = [100, 1000, 10000].map(v => `<button class="btn small" type="button" data-act="pubbuy" data-v="${v}" data-cost="${v}">${money(v, false)}</button>`).join('');
  const sell = [[.25, '25%'], [.5, '50%'], [1, 'All']].map(([v, l]) => `<button class="btn ghost small" type="button" data-act="pubsell" data-v="${v}">${l}</button>`).join('');
  return { sig, title: 'Invest', html: tabs + intro + `<div class="st-wrap"><div class="st-list">${rows}</div><div class="st-detail">
      <div class="side-head">${iconImg('house', 54)}<div style="flex:1"><h2>${esc(L.co)}</h2><span class="muted">by <b>${esc(L.owner)}</b> · ${t} · public since ${new Date(L.listed).toLocaleDateString()}</span></div>
        <div style="text-align:right"><b class="num gold" style="font-size:30px;line-height:1" data-live="pubp:${t}"></b><br><span data-live="pubchg:${t}" data-base=""></span> <span class="muted" style="font-size:12px">${UI.pubTF || '1d'}</span> <span data-live="pubimp:${t}" data-base=""></span></div></div>
      <div style="display:flex;justify-content:flex-end"><div class="seg" role="group" aria-label="Chart range">${['4h', '1d'].map(v => `<button type="button" data-act="pubtf" data-v="${v}" aria-pressed="${(UI.pubTF || '1d') === v}">${v}</button>`).join('')}</div></div>
      <canvas id="stChart" class="st-chart smooth" role="img" aria-label="${esc(L.co)} share price chart"></canvas>
      <p class="muted" style="font-size:12px;margin:-4px 0 8px">Every 10 seconds while you play, and every 5 minutes before that. A company that’s just gone public fills its chart in as the day goes on.</p>
      <div class="stat-grid">${pubStat('Market value', '', 'pubcap:' + t)}${pubStat('Owner keeps', Math.round(L.own / L.total * 100) + '%')}${pubStat('Profit', money(L.profit) + '/min')}${pubStat('Profit trend', '', 'pubtrend:' + t)}
        ${pubStat('Dividends paid', money(L.paid, false))}${pubStat('Players hold', `${qty(L.held)} · ${L.holders} player${L.holders === 1 ? '' : 's'}`)}${pubStat('For sale', '', 'pubfree:' + t)}
        ${t === mine ? '' : pubStat('You own', '', 'pubhq:' + t) + pubStat('Worth', '', 'pubhv:' + t) + pubStat('Profit / loss', '', 'pubhpl:' + t)}</div>
      ${t === mine ? `<section class="card"><h3>This is your company</h3><p class="muted" style="font-size:13px">This is how ${esc(L.co)} looks to other players: what investors see, from the server, up to a minute old. You can’t trade your own shares here. To sell more of the company or buy shares back, go to Your company.</p>
        <div class="trade"><button class="btn small" type="button" data-act="itab" data-v="mine">Your company</button></div></section>`
      : `<section class="card"><h3>Trade <span class="muted">cash <b data-live="cash"></b> · ${FEE.stock * 100}% fee</span></h3>
        ${NET.token ? `<div class="trade"><span class="muted" style="font-size:13px">Buy</span>${buy}</div><div class="trade"><span class="muted" style="font-size:13px">Sell</span>${sell}</div>`
          : '<p class="muted" style="font-size:13px">Log in (Menu → Online) to buy and sell players’ shares.</p>'}</section>`}
      <p class="muted" style="font-size:12px">Dividends you’ve had from players’ companies: ${money(S.pubDivIn || 0, false)}.</p></div></div>` };
}
function pubMineView(tabs) {
  const conf = UI.confirm;
  if (!S.pub) {
    const f = PUB_STEPS.includes(UI.ipoF) ? UI.ipoF : (UI.ipoF = .25), ok = S.level >= PUB_LEVEL;
    const why = !ok ? `Reach Level ${PUB_LEVEL} (${LEVELS[PUB_LEVEL].name}: a company worth ${money(LEVELS[PUB_LEVEL].nw, false)}) to go public.`
      : !NET_API ? 'Open the game at brickncoin.com to go public.' : !NET.token ? 'Log in (Menu → Online) to go public: the server keeps the share register.' : '';
    const steps = PUB_STEPS.map(x => `<button type="button" data-act="ipof" data-v="${x}" aria-pressed="${f === x}">${Math.round(x * 100)}%</button>`).join('');
    return { sig: `mine|ipo|${f}|${ok}|${NET.token ? 1 : 0}|${conf}`, title: 'Invest', html: tabs + `
      <p class="m-sub">Going public sells part of ${esc(S.company)} to investors in new shares. The cash goes straight into the company to grow with, and you keep the rest of it. Players can then buy your shares, and the company pays 30% of its profit as dividends, split by who owns it.</p>
      <section class="card"><h3>Go public</h3>
        <div class="stat-grid">${pubStat('Company value', '', 'mycv')}${pubStat('Steady profit (10 min)', '', 'mysteady')}${pubStat('Profit trend (vs the last hour)', '', 'mytrend')}${pubStat('Investors value it at', '', 'ipoval')}</div>
        <p class="muted" style="font-size:12px">Investors pay what ${esc(S.company)} is worth plus ${PUB_PREMIUM} minutes of its steady profit (more if profit is climbing, less if it’s sliding), at most ${PUB_PREM_CAP * 100}% more.</p>
        <div class="trade"><span class="muted" style="font-size:13px">Sell</span><div class="seg" role="group" aria-label="How much to sell">${steps}</div></div>
        <div class="kv"><span>You raise (10% IPO discount, 5% bank fee)</span><b class="olive" data-live="iporaise"></b>
          <span>You keep</span><b>${Math.round((1 - f) * 100)}% of ${esc(S.company)}</b>
          <span>Your net worth right after</span><b data-live="iponw"></b>
          <span>Dividends to outside shareholders</span><b>${Math.round(PUB_DIV * f * 100)}% of your profit</b></div>
        ${why ? `<p class="why">${why}</p>` : `<button class="btn ${conf === 'ipo' ? 'danger' : 'gold'}" type="button" data-act="ipo" style="align-self:flex-start">${conf === 'ipo' ? `Tap again to sell ${Math.round(f * 100)}% of ${esc(S.company)}` : `Go public: sell ${Math.round(f * 100)}%`}</button>`}
        <p class="muted" style="font-size:12px">Your net worth on the leaderboard becomes your part of the company. Areas of town still open with the whole company’s value. You can sell more later (up to ${PUB_MAX * 100}% outside), or buy shares back.</p></section>` };
  }
  const L = pubMineL(), out = 1 - ownFrac(), t = S.pub.ticker;
  const up = Math.min(PUB_MAX, Math.round((out + .1) * 100) / 100), down = Math.max(0, Math.round((out - .1) * 100) / 100);
  const canUp = out < PUB_MAX - .005, canDown = (L.total - L.own) - (L.held || 0) > 1e-3;
  const fbtn = (v, label) => `<button class="btn ${conf === 'float' + v ? 'danger' : 'ghost'} small" type="button" data-act="pubfloat" data-v="${v}">${conf === 'float' + v ? 'Tap again: ' : ''}${label} <b data-live="floatq:${v}"></b></button>`;
  return { sig: `mine|pub|${t}|${S.pub.total}|${S.pub.own}|${conf}|${L.held}`, title: 'Invest', html: tabs + `
    <div class="side-head">${iconImg('house', 54)}<div style="flex:1"><h2>${esc(S.company)}</h2><span class="muted">public as <b>${t}</b> since ${new Date(S.pub.listed).toLocaleDateString()}</span></div>
      <div style="text-align:right"><b class="num gold" style="font-size:30px;line-height:1" data-live="mypx"></b><br><span class="muted" style="font-size:12px">a share</span></div></div>
    <div class="stat-grid">${pubStat('Company value', '', 'mycv')}${pubStat('Market value', '', 'mycap')}${pubStat('Market vs company', '', 'myprem')}${pubStat('Profit trend', '', 'mytrend')}
      ${pubStat('You own', Math.round(ownFrac() * 1000) / 10 + '%')}${pubStat('Your net worth', '', 'mynw')}${pubStat('Dividends paid', money(S.pub.paid || 0, false))}</div>
    <p class="muted" style="font-size:12px;margin:8px 0 12px">A share is priced at the company value plus ${PUB_PREMIUM} minutes of steady profit (more while profit climbs, less while it slides; at most ${PUB_PREM_CAP * 100}% more), split over all ${qty(S.pub.total)} shares (you hold ${qty(S.pub.own)}), then moved by the market’s mood and players’ trading (Millbrook’s investors buy the dips and sell the spikes, so a push fades faster the bigger it is). Market value is that price times every share. Your net worth, and the leaderboard, count your ${Math.round(ownFrac() * 1000) / 10}% of the company value.</p>
    <section class="card"><h3>Shares</h3><p class="muted" style="font-size:13px">Outside shareholders own ${Math.round(out * 1000) / 10}%: Millbrook’s investors, and players (${qty(L.held || 0)} shares, ${L.holders || 0} player${(L.holders || 0) === 1 ? '' : 's'}). You pay them ${Math.round(PUB_DIV * out * 100)}% of your profit as dividends.
      Selling new shares raises cash at today’s price (5% fee); buying back from investors costs today’s price (players keep theirs).</p>
      <div class="trade">${canUp ? fbtn(up, `Sell more (to ${Math.round(up * 100)}% outside)`) : ''}${canDown ? fbtn(down, down === 0 ? 'Buy all back (go private)' : `Buy back (to ${Math.round(down * 100)}% outside)`) : ''}</div></section>` };
}

/* ---------- Invest → Portfolio (v0.09): everything you own in one place, what it's worth and what it pays ---------- */
Object.assign(LIVE, {
  pftotal: () => money(portfolioValue() + pubHoldValue() + propertyValue(), false),
  pfstk: () => money(portfolioValue(), false), pfpub: () => money(pubHoldValue(), false), pfre: () => money(propertyValue(), false),
  pfinc() { let d = 0; for (const t in S.hold) d += S.hold[t].q * S.assets[t].p * asset(t).yld * 60; return '+' + money(d + rentPerMin() * 60) + '/hr'; },
  pfshare() { const nw = netWorth(), v = (portfolioValue() + pubHoldValue() + propertyValue()) * ownFrac(); return nw > 0 ? Math.round(v / nw * 100) + '% of your net worth' : ''; },
});
function portfolioView(tabs) {
  const rows = [], row = (ic, name, sub, val, pl, extra, act) => `<button type="button" class="st-row" ${act}>${ic}
      <span class="nm"><b>${name}</b><small>${sub}</small></span>
      <span class="px2"><b data-live="${val}"></b><small data-live="${pl}" data-base=""></small>${extra ? `<small class="olive">${extra}</small>` : ''}</span></button>`;
  for (const a of ASSETS) { const h = S.hold[a.t]; if (!h || h.q <= 0) continue;
    rows.push(row(iconImg(a.icon, 36), a.name, `${a.crypto ? 'Crypto' : a.index ? 'Index fund' : 'Shares'} · ${h.q < 1 ? h.q.toFixed(4) : qty(h.q)} ${a.t}`, 'hval:' + a.t, 'hpl:' + a.t,
      a.yld ? `${money(h.q * S.assets[a.t].p * a.yld * 60)}/hr` : '', `data-act="pfgo" data-v="stocks" data-t="${a.t}"`)); }
  for (const t in S.pubHold) { const h = S.pubHold[t], L = pubListing(t);
    rows.push(row(iconImg('house', 36), L ? esc(L.co) : t, `Player company · ${qty(h.q)} ${t}`, 'pubhv:' + t, 'pubhpl:' + t, 'dividends', `data-act="pfgo" data-v="players" data-t="${t}"`)); }
  S.props.forEach((p, k) => { if (!p.own) return;
    rows.push(row(`<img class="px" src="${housePreview(PLOTS[k].t, p.reno)}" width="36" height="44" alt="" style="margin:-6px 0">`, PROPS[PLOTS[k].t].name, `Property · ${PLOT_SIDE(k)} · renovated ${p.reno - 1}×`, 'pv:' + k, 'pgain:' + k, '', `data-act="pshow" data-k="${k}"`)); });
  const sig = `pf|${rows.length}|${Object.keys(S.hold).filter(t => S.hold[t].q > 0).join()}|${Object.keys(S.pubHold).join()}|${S.props.map(p => p.own ? p.reno : 0).join('')}`;
  const stat = (k, live) => `<div class="stat"><span>${k}</span><b data-live="${live}"></b></div>`;
  return { sig, title: 'Invest', html: tabs + `
    <p class="m-sub">Everything you own besides your factories: what it’s worth now, how it’s done since you bought it, and what it pays you. Tap one to trade it.</p>
    <div class="stat-grid">${stat('All investments', 'pftotal')}${stat('Pays you', 'pfinc')}${stat('Stocks & PixCoin', 'pfstk')}${stat('Players’ companies', 'pfpub')}${stat('Property', 'pfre')}
      <div class="stat"><span>Share of your wealth</span><b data-live="pfshare"></b></div></div>
    ${rows.length ? `<div class="st-list" style="margin-top:12px">${rows.join('')}</div>`
      : `<section class="card" style="margin-top:12px"><h3>Nothing here yet</h3><p class="muted" style="font-size:13px">Spare cash can work for you: shares and the index fund pay dividends, homes pay rent every second, and other players’ companies pay part of their profit. Start in Stocks or Real estate.</p>
        <div class="trade"><button class="btn small" type="button" data-act="itab" data-v="stocks">Stocks</button><button class="btn ghost small" type="button" data-act="itab" data-v="re">Real estate</button></div></section>`}` };
}
