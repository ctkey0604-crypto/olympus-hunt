'use strict';
/* ============================================================================
   PUBLIC COMPANIES (v0.08): going public, and owning part of other players'
   companies. The server (server/index.js) keeps the share register; cash stays
   in each game, like everything else about a company.
   - A share's price: the company's value plus up to an hour of its profit (at most
     twice its value), over all its shares (pubFair); moved by players buying and
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
// a listing from the server: [ticker, company, owner, shares, owner's shares, value, profit/min, buying $, selling $, at, dividends paid, listed, players' shares, holders, owner online]
function pubParse(r) { return { ticker: r[0], co: r[1], owner: r[2], total: +r[3], own: +r[4], book: +r[5], profit: +r[6], fb: +r[7], fs: +r[8], ft: +r[9], paid: +r[10], listed: +r[11], held: +r[12], holders: +r[13], online: !!r[14] }; }
function pubListing(t) { return NET.listings.find(L => L.ticker === t) || null; }
function ownFrac() { return S && S.pub && S.pub.total > 0 ? clamp(S.pub.own / S.pub.total, 0, 1) : 1; }
function tickerSeed(t) { let h = 7; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0; return h; }
function pubFair(L) { const b = Math.max(0, L.book); return Math.max(.01, (b + Math.min(2 * b, PUB_PREMIUM * Math.max(0, L.profit))) / L.total); }
function pubPressure(L) { const k = Math.pow(.5, Math.max(0, nowMs() - L.ft) / 1000 / PUB_HALF); return [L.fb * k, L.fs * k]; }
function pubImpact(L) { const [fb, fs] = pubPressure(L), D = PUB_DEPTH * pubFair(L) * L.total; return clamp(Math.sqrt((1 + fb / D) / (1 + fs / D)), PUB_MOVE[0], PUB_MOVE[1]); }
function pubMood() { const A = WS.assets.MB10, a = A.h60 && A.h60.length ? A.h60[0] : 0; return a ? clamp(Math.pow(A.p / a, 1.2), .85, 1.18) : 1; }
function pubWander(L) { return Math.exp(fbm(950 + tickerSeed(L.ticker) % 97, WT, .02 / 60, OCT_ID)); }
function pubPrice(L) { return pubFair(L) * pubImpact(L) * pubMood() * pubWander(L); }
// this company's own listing, with its value and profit right now (the server's copy is up to a minute old)
function pubMineL() {
  if (!S || !S.pub) return null;
  const L = pubListing(S.pub.ticker) || { ticker: S.pub.ticker, fb: 0, fs: 0, ft: 0, held: 0, holders: 0, paid: 0 };
  return { ...L, total: S.pub.total, own: S.pub.own, book: companyValue(), profit: profitPerMin() };
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
  if (d.credit > 0) { S.cash += d.credit; addProfit(d.credit); S.pubDivIn = (S.pubDivIn || 0) + d.credit; }
  for (const [t, co, cash] of d.paidOut || []) pushNews(`${co} (${t}) has closed: your shares were bought out for ${money(cash, false)}`, 'info');
}

/* ---------- actions (each returns a promise of a message, or throws one) ---------- */
function ipoQuote(f) {
  const cv = companyValue(), fair = cv + Math.min(2 * cv, PUB_PREMIUM * Math.max(0, profitPerMin())), raised = fair * f / (1 - f) * IPO_DISCOUNT * (1 - IPO_FEE);
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
  const d = await netCall('/ipo', { f, company: S.company, book: Math.round(companyValue()), profit: profitPerMin() });
  NET.pubAt = Date.now();
  S.cash += d.raised; S.pub = { ...d.mine, paid: 0 };
  pushNews(`${S.company} goes public as ${d.ticker}: ${Math.round(f * 100)}% sold to investors for ${money(d.raised, false)}`, 'up');
  saveLocal(); netSaveNow();
  return `${S.company} is public as ${d.ticker}! +${money(d.raised, false)}`;
}
async function pubFloat(target) {
  const q = floatQuote(target); if (!q) throw new Error(`${S.company} isn’t public`);
  if (q.cash < 0 && S.cash < -q.cash) throw new Error(`Not enough cash: buying back costs about ${money(-q.cash, false)}`);
  const d = await netCall('/float', { f: target, book: Math.round(companyValue()), profit: profitPerMin() });
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
  const k = Math.pow(.5, Math.max(0, nowMs() - L.ft) / 1000 / PUB_HALF);   // show the move at once, before the next sync
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
  pubimp(t) { const L = pubListing(t); if (!L) return { text: '', cls: '' }; const m = pubImpact(L) - 1; return Math.abs(m) < .005 ? { text: 'steady', cls: 'muted' } : { text: 'players ' + pctTxt(m), cls: m >= 0 ? 'olive' : 'red' }; },
  pubcap(t) { const L = pubListing(t); return L ? money(pubPrice(L) * L.total, false) : '—'; },
  pubfree(t) { const L = pubListing(t); return L ? qty(Math.max(0, L.total - L.own - L.held)) + ' shares' : '—'; },
  pubhq: t => { const h = S.pubHold[t]; return h ? qty(h.q) : '0'; },
  pubhv: t => { const h = S.pubHold[t], L = pubListing(t); return money(h && L ? h.q * pubPrice(L) : 0); },
  pubhpl(t) { const h = S.pubHold[t], L = pubListing(t); if (!h || !L || h.q <= 0) return { text: '—', cls: 'muted' }; const v = h.q * pubPrice(L) - h.cost; return { text: (v >= 0 ? '+' : '') + money(v) + ' (' + pctTxt(v / h.cost) + ')', cls: v >= 0 ? 'olive' : 'red' }; },
  mypx() { const L = pubMineL(); return L ? money(pubPrice(L)) : '—'; },
  mycap() { const L = pubMineL(); return L ? money(pubPrice(L) * L.total, false) : '—'; },
  mynw: () => money(netWorth(), false), mycv: () => money(companyValue(), false),
  ipoval: () => money(ipoQuote(UI.ipoF).fair, false),
  iporaise: () => '+' + money(ipoQuote(UI.ipoF).raised, false),
  iponw: () => money(ipoQuote(UI.ipoF).nwAfter, false),
  floatq(v) { const q = floatQuote(+v); return q ? (q.cash >= 0 ? '+' : '−') + money(Math.abs(q.cash), false) : '—'; },
});
function pubStat(k, v, live) { return `<div class="stat"><span>${k}</span><b${live ? ` data-live="${live}"` : ''}>${v || ''}</b></div>`; }
function pubPlayersView(tabs) {
  const list = NET.listings.filter(L => !(S.pub && L.ticker === S.pub.ticker));
  if (!list.find(L => L.ticker === UI.pubSel)) UI.pubSel = list.length ? list[0].ticker : null;
  const L = pubListing(UI.pubSel), sig = `pub|${list.map(x => x.ticker + x.held).join()}|${UI.pubSel}|${NET.token ? 1 : 0}|${Object.keys(S.pubHold).join()}`;
  const intro = `<p class="m-sub">Real players’ companies that have gone public. A share’s price follows its company’s value and profit, the market’s mood, and players buying and selling it. Each company pays 30% of its profit as dividends, and you get your part while you hold its shares, even while you’re away.${NET_API ? '' : ' Open the game at brickncoin.com to see them.'}</p>`;
  if (!L) return { sig, title: 'Invest', html: tabs + intro + `<section class="card"><h3>No player companies yet</h3><p class="muted" style="font-size:13px">When a player takes their company public, it shows up here. Reach Level ${PUB_LEVEL} and yours could be the first: see Your company.</p></section>` };
  const rows = list.map(x => `<button type="button" class="st-row ${x.ticker === UI.pubSel ? 'sel' : ''}" data-act="pubsel" data-t="${x.ticker}">${iconImg('house', 36)}
      <span class="nm"><b>${esc(x.co)}</b><small>${x.online ? '<i class="dot" title="online now"></i>' : ''}by ${esc(x.owner)} · ${x.ticker}</small></span>
      <span class="px2"><b data-live="pubp:${x.ticker}"></b><small data-live="pubimp:${x.ticker}" data-base=""></small></span></button>`).join('');
  const t = L.ticker, buy = [100, 1000, 10000].map(v => `<button class="btn small" type="button" data-act="pubbuy" data-v="${v}" data-cost="${v}">${money(v, false)}</button>`).join('');
  const sell = [[.25, '25%'], [.5, '50%'], [1, 'All']].map(([v, l]) => `<button class="btn ghost small" type="button" data-act="pubsell" data-v="${v}">${l}</button>`).join('');
  return { sig, title: 'Invest', html: tabs + intro + `<div class="st-wrap"><div class="st-list">${rows}</div><div class="st-detail">
      <div class="side-head">${iconImg('house', 54)}<div style="flex:1"><h2>${esc(L.co)}</h2><span class="muted">by <b>${esc(L.owner)}</b> · ${t} · public since ${new Date(L.listed).toLocaleDateString()}</span></div>
        <div style="text-align:right"><b class="num gold" style="font-size:30px;line-height:1" data-live="pubp:${t}"></b><br><span data-live="pubimp:${t}" data-base=""></span></div></div>
      <div class="stat-grid">${pubStat('Market value', '', 'pubcap:' + t)}${pubStat('Owner keeps', Math.round(L.own / L.total * 100) + '%')}${pubStat('Profit', money(L.profit) + '/min')}
        ${pubStat('Dividends paid', money(L.paid, false))}${pubStat('Players hold', `${qty(L.held)} · ${L.holders} player${L.holders === 1 ? '' : 's'}`)}${pubStat('For sale', '', 'pubfree:' + t)}
        ${pubStat('You own', '', 'pubhq:' + t)}${pubStat('Worth', '', 'pubhv:' + t)}${pubStat('Profit / loss', '', 'pubhpl:' + t)}</div>
      <section class="card"><h3>Trade <span class="muted">cash <b data-live="cash"></b> · ${FEE.stock * 100}% fee</span></h3>
        ${NET.token ? `<div class="trade"><span class="muted" style="font-size:13px">Buy</span>${buy}</div><div class="trade"><span class="muted" style="font-size:13px">Sell</span>${sell}</div>`
          : '<p class="muted" style="font-size:13px">Log in (Menu → Online) to buy and sell players’ shares.</p>'}</section>
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
        <div class="stat-grid">${pubStat('Company value', '', 'mycv')}${pubStat('Profit', '', 'ppm')}${pubStat('Investors value it at', '', 'ipoval')}</div>
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
    <div class="stat-grid">${pubStat('Market value', '', 'mycap')}${pubStat('Company value', '', 'mycv')}${pubStat('You own', Math.round(ownFrac() * 1000) / 10 + '%')}
      ${pubStat('Your net worth', '', 'mynw')}${pubStat('Players hold', `${qty(L.held || 0)} shares · ${L.holders || 0}`)}${pubStat('Dividends paid', money(S.pub.paid || 0, false))}</div>
    <section class="card"><h3>Shares</h3><p class="muted" style="font-size:13px">Outside shareholders own ${Math.round(out * 1000) / 10}% (players and Millbrook’s investors). You pay them ${Math.round(PUB_DIV * out * 100)}% of your profit as dividends.
      Selling new shares raises cash at today’s price (5% fee); buying back from investors costs today’s price (players keep theirs).</p>
      <div class="trade">${canUp ? fbtn(up, `Sell more (to ${Math.round(up * 100)}% outside)`) : ''}${canDown ? fbtn(down, down === 0 ? 'Buy all back (go private)' : `Buy back (to ${Math.round(down * 100)}% outside)`) : ''}</div></section>` };
}
