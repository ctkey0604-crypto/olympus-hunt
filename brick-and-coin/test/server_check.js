#!/usr/bin/env node
/* Brick & Coin server check (v0.07): talks to a running copy of server/index.js and checks accounts, saves, the shared
   market and the players' leaderboard.

     Run the server locally first, with the test login switched on (any name, password "secret1") and no OH binding:
       npx wrangler dev -c <a config without "services", with "vars": { "DEV_LOGIN": "1", "DEV_FAST": "1" }>   (DEV_FAST: hour-long waits take 4 s)
     then:  node brick-and-coin/test/server_check.js [http://127.0.0.1:8787]

   It makes its own players (random names), so it can run against the same local database again and again.
   Never point it at brickncoin.com: there the test login doesn't exist. */
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const problems = [];
function check(ok, msg) { console.log((ok ? '  ok    ' : '  FAIL  ') + msg); if (!ok) problems.push(msg); }
async function call(path, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + '/api' + path, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const tag = Math.random().toString(36).slice(2, 7);
  // goods with made-up names, so earlier runs (still fading on the server) don't mix in. The server takes any lowercase name.
  const L = () => Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
  const wood = 'w' + L(), flour = 'f' + L(), nails = 'n' + L();
  const h = await call('/health'); check(h.status === 200 && h.d.game === 'brick-and-coin', 'health');

  // accounts
  const bad = await call('/login', { name: 'x' + tag, password: 'wrongpw' }); check(bad.status === 401, 'a wrong password is refused');
  const short = await call('/register', { name: 'ab', password: 'secret1' }); check(short.status === 400, 'a 2-letter name is refused');
  const A = (await call('/register', { name: 'Alice_' + tag, password: 'secret1' })).d, B = (await call('/login', { name: 'Bob_' + tag, password: 'secret1' })).d;
  check(A.token && A.name === 'Alice_' + tag, 'Alice creates an account (name kept as typed)');
  check(B.token && B.name === 'Bob_' + tag, 'Bob logs in');
  check((await call('/me', null, 'nonsense')).status === 401, 'a made-up session is refused');
  const me = await call('/me', null, A.token); check(me.status === 200 && me.d.name === A.name && !me.d.company, 'Alice: /me, no company yet');

  // saves
  const save = JSON.stringify({ company: 'Alice Mills', start: 'wood', level: 2, cash: 1234, lots: [], savedAt: Date.now() });
  const sv = await call('/save', { save, company: 'Alice Mills', nw: 15000, level: 2 }, A.token); check(sv.status === 200 && sv.d.savedAt > 0, 'Alice saves');
  const got = await call('/save', null, A.token); check(got.d.save === save, 'the save comes back exactly');
  check((await call('/save', null, B.token)).d.save === null, 'Bob has no save');
  check((await call('/save', { save: 'x'.repeat(400001) }, A.token)).status === 413, 'a huge save is refused');

  // the shared market: Alice sells 100 building-level minutes of wood, Bob 50 of wood and buys 20 of flour
  const s1 = await call('/sync', { company: 'Alice Mills', nw: 15000, level: 2, flow: { [wood]: [100, 0] } }, A.token);
  check(s1.status === 200 && !(s1.d.crowd[wood] && s1.d.crowd[wood][0] > 1), 'Alice syncs: her own selling isn’t in what “others” do');
  const s2 = await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: { [wood]: [50, 0], [flour]: [0, 20], BAD: [9, 9], wheat: 'x' } }, B.token);
  // the totals are worked out at most every 20 s, so the first look may not have Alice yet: wait for a fresh one
  let others = s2.d.crowd;
  if (!(others[wood] && others[wood][0] > 1)) { await new Promise(r => setTimeout(r, 21000)); others = (await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: {} }, B.token)).d.crowd; }
  check(others[wood] && near(others[wood][0], 100, 6), `Bob sees Alice's wood selling (${others[wood] && others[wood][0]}), not his own`);
  check(!others.BAD && !others[flour], 'bad product names are ignored; Bob’s own flour buying isn’t in his “others”');
  await new Promise(r => setTimeout(r, 21000));
  const s3 = await call('/sync', { company: 'Alice Mills', nw: 15000, level: 2, flow: {} }, A.token);
  check(s3.d.crowd[wood] && near(s3.d.crowd[wood][0], 50, 8) && s3.d.crowd[flour] && near(s3.d.crowd[flour][1], 20, 3), `Alice sees Bob's wood and flour, fading with a 5-minute half-life (${JSON.stringify(s3.d.crowd)})`);
  const mk = await call('/market'); check(mk.d.crowd[wood] && near(mk.d.crowd[wood][0], 150, 22), `a player with no account sees everyone: wood ${mk.d.crowd[wood] && mk.d.crowd[wood][0]} (150, faded a little)`);
  check(mk.d.online >= 2, `online count (${mk.d.online})`);

  // reports are capped: one sync can't report more than 400 per minute (5 minutes' worth at most)
  await new Promise(r => setTimeout(r, 16000));
  await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: { [nails]: [1e9, 0] } }, B.token);
  await new Promise(r => setTimeout(r, 21000));
  const capped = (await call('/market')).d.crowd[nails];
  check(capped && capped[0] <= 400 * 5 + 1, `a doctored report is capped (nails ${capped && capped[0]})`);

  // the leaderboard
  const board = mk.d.board || [];
  const a = board.find(r => r[0] === A.name), b = board.find(r => r[0] === B.name);
  check(a && a[1] === 'Alice Mills' && a[2] === 15000 && a[4] === 1, 'Alice is on the players’ leaderboard, online');
  check(b && board.indexOf(a) < board.indexOf(b), 'richer players come first');

  // v0.08, going public. Alice: worth $150k, $1,000/min steady profit. Investors value her at 150k + 15 minutes of profit
  // = $165k (v0.10; at most 25% over her worth), $1.65 a share over her 100,000; she sells 25% in new shares at a 10%
  // discount ($1.485), less the bank's 5%.
  const wait = ms => new Promise(r => setTimeout(r, ms));
  check((await call('/ipo', { f: .25, company: 'Bob Foods', book: 50000, profit: 100 }, B.token)).status === 400, 'a company worth under $100k can’t go public');
  check((await call('/ipo', { f: .95, company: 'Alice Mills', book: 150000, profit: 1000 }, A.token)).status === 400, 'selling more than 90% is refused');
  const ip = await call('/ipo', { f: .25, company: 'Alice Mills', book: 150000, profit: 1000 }, A.token);
  const T = ip.d.ticker, issued = 1e5 * .25 / .75;
  check(ip.status === 200 && /^AMLI\d*$/.test(T), `Alice goes public as ${T}`);
  check(near(ip.d.issued, issued, .01) && near(ip.d.price, 1.485, .001) && near(ip.d.raised, issued * 1.485 * .95, 1), `25% sold: ${Math.round(ip.d.issued)} new shares at $${ip.d.price}, raising $${ip.d.raised}`);
  check(ip.d.mine.own === 1e5 && near(ip.d.mine.total, 1e5 + issued, .01), 'she keeps her 100,000 shares, 75% of the company');
  check((await call('/ipo', { f: .1, company: 'Alice Mills', book: 150000, profit: 1000 }, A.token)).status === 409, 'a company can only go public once');
  // Bob buys 1,000 shares at about today's price; a made-up price and a too-big order are refused; Alice can't trade her own
  const fair = (150000 + ip.d.raised + 60000) / (1e5 + issued);
  const by = await call('/shares', { ticker: T, side: 'buy', shares: 1000, price: fair }, B.token);
  check(by.status === 200 && by.d.holding && by.d.holding[1] === 1000, `Bob buys 1,000 ${T} at $${fair.toFixed(2)}`);
  check((await call('/shares', { ticker: T, side: 'buy', shares: 10, price: fair * 3 }, B.token)).status === 409, 'a price far from the real one is refused');
  check((await call('/shares', { ticker: T, side: 'buy', shares: 40000, price: fair }, B.token)).status === 400, 'you can’t buy more shares than investors hold');
  check((await call('/shares', { ticker: T, side: 'buy', shares: 10, price: fair }, A.token)).status === 400, 'an owner can’t trade her own company as an investor');
  check((await call('/shares', { ticker: T, side: 'sell', shares: 5000, price: fair }, B.token)).status === 400, 'you can’t sell shares you don’t have');
  // v0.17: a trade pays the price it makes: buying a lot and selling it straight back loses money, however it's split up
  const move = (F, fb, fs) => { const D = .05 * F * (1e5 + issued); return Math.min(1.6, Math.max(.6, Math.sqrt((1 + fb / D) / (1 + fs / D)))); };
  const tf = (150000 + ip.d.raised + 15000) / (1e5 + issued); let fb = by.d.price * 1000, fs = 0, net = 0;
  for (const [side, n] of [['buy', 9000], ['buy', 9000], ['sell', 4500], ['sell', 4500], ['sell', 9000], ['buy', 18000], ['sell', 18000]]) {
    const t = await call("/shares", { ticker: T, side, shares: n, price: tf * move(tf, fb, fs) }, B.token); if (t.status !== 200) { check(false, `trade refused: ${t.d.error}`); break; }
    const v = n * t.d.price; net += side === 'buy' ? -v : v; if (side === 'buy') fb += v; else fs += v;
  }
  check(net < 0, `buying and selling straight back makes nothing ($${Math.round(net)} before fees)`);
  let own = 0; for (let k = 0; k < 3; k++) for (const f of [.4, .25]) { if (f === .4) await wait(4200); own += (await call('/float', { f, book: 210000 + own, profit: 1000 }, A.token)).d.cash; }   // the cash comes into (and goes out of) the company, so into its value
  check(own < 0, `an owner issuing and buying back makes nothing ($${Math.round(own)})`);
  // dividends: Alice's game reports $300 paid to outside shareholders; Bob's part is 1,000 of the 33,333 outside shares
  await wait(16000);
  const ds = await call('/sync', { company: 'Alice Mills', nw: 140000, level: 3, book: 210000, profit: 1000, div: 300, flow: {} }, A.token);
  check(ds.status === 200 && ds.d.mine && ds.d.mine.ticker === T, 'Alice’s sync carries her listing');
  const bs = await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: {} }, B.token);
  check(near(bs.d.credit, 300 * 1000 / issued, .05), `Bob gets his part of the dividends: $${bs.d.credit}`);
  check(bs.d.holdings.length === 1 && bs.d.holdings[0][0] === T, 'and his holding comes back with the sync');
  check(near((await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: {} }, B.token)).d.credit, 0, .001), 'paid once, not twice');
  // more shares, then a buyback (Bob's 1,000 can't be bought back)
  const up = await call('/float', { f: .49, book: 210000, profit: 1000 }, A.token);
  check((await call('/float', { f: .6, book: 310000, profit: 1000 }, A.token)).status === 429, 'one sale of new shares an hour');
  check(up.status === 200 && up.d.cash > 0 && near((up.d.mine.total - up.d.mine.own) / up.d.mine.total, .49, .001), `Alice sells more, to 49% outside: +$${up.d.cash}`);
  check((await call('/float', { f: .95 }, A.token)).status === 400, 'never more than 90% outside');
  const back = await call('/float', { f: 0, book: 260000, profit: 1000 }, A.token);
  check(back.status === 200 && back.d.cash < 0 && back.d.mine && near(back.d.mine.total - back.d.mine.own, 1000, .01), `buying everything back leaves Bob's 1,000 shares (cost $${-back.d.cash})`);
  await wait(21000);
  const lst = ((await call('/market')).d.listings || []).find(r => r[0] === T);
  check(lst && lst[12] === 1000 && lst[13] === 1, `${T} is listed, with Bob's 1,000 shares and one player holding`);
  // v0.18: the dividend
  check((await call('/dividend', { rate: .9 }, A.token)).status === 400 && (await call('/dividend', { rate: .5 }, B.token)).status === 400, 'a dividend over 80%, or of a company that isn’t public, is refused');
  const dv = await call('/dividend', { rate: .8 }, A.token); check(dv.status === 200 && dv.d.mine.divr === .8 && near(dv.d.mine.divp, .3, .01), 'Alice sets an 80% dividend; investors still believe in 30% for now');
  check((await call('/dividend', { rate: 0 }, A.token)).status === 429, 'once an hour');
  // an offer to the players who hold her shares (Bob's 1,000)
  const mk2 = ((await call('/market')).d.listings || []).find(r => r[0] === T), px2 = mk2 ? (mk2[5] + Math.min(.25 * mk2[5], 15 * mk2[6])) / mk2[3] : 1;
  check((await call('/tender', { prem: 1.4, price: px2, shares: 1000 }, A.token)).status === 400, 'an offer can’t be more than 25% over the price');
  check((await call('/tender/sell', { ticker: T, shares: 100 }, B.token)).status === 409, 'no offer yet, so nothing to sell into');
  const tn = await call('/tender', { prem: 1.2, price: px2, shares: 5000 }, A.token);
  check(tn.status === 200 && near(tn.d.mine.tn, 1000, .01) && near(tn.d.cost, 1000 * px2 * 1.2 * 1.005, 1), `Alice offers ${tn.d.mine && tn.d.mine.tp} a share for the 1,000 players hold, paying $${tn.d.cost} up front`);
  const ts = await call('/tender/sell', { ticker: T, shares: 400 }, B.token); check(ts.status === 200 && near(ts.d.cash, 400 * px2 * 1.2, 1) && near(ts.d.holding[1], 600, .01), `Bob sells 400 into it: +$${ts.d.cash}, 600 left`);
  const cx = await call('/tender', { cancel: true }, A.token); check(cx.status === 200 && near(cx.d.refund, 600 * px2 * 1.2 * 1.005, 1), `Alice calls it off and gets the rest back: $${cx.d.refund}`);
  check((await call('/tender/sell', { ticker: T, shares: 10 }, B.token)).status === 409, 'a called-off offer is over');
  check((await call('/tender', { prem: 1, price: px2, shares: 10 }, A.token)).status === 429, 'one offer a day');
  await wait(4200);
  await call('/tender', { prem: 1.1, price: px2, shares: 600 }, A.token); await wait(4400);
  const en = await call('/sync', { company: 'Alice Mills', nw: 1e5, level: 3, book: 260000, profit: 1000, flow: {} }, A.token); check(en.d.refund > 0 && near(en.d.refund, 600 * px2 * 1.1 * 1.005, 1.5), `an offer that ends gives back what wasn’t used: $${en.d.refund}`);
  check(!(await call('/sync', { company: 'Alice Mills', nw: 1e5, level: 3, book: 260000, profit: 1000, flow: {} }, A.token)).d.refund, 'once, not twice');
  // two sellers racing for the last of an offer: never more than it's for
  let rt = await call('/tender', { prem: 1, price: px2, shares: 600 }, A.token); if (rt.d.price) rt = await call('/tender', { prem: 1, price: rt.d.price, shares: 600 }, A.token);   // her value has changed since: the server says the price
  check(rt.status === 200, `a new offer once the last has ended ${rt.d.error || ''}`);
  const race = await Promise.all([1, 2, 3, 4].map(() => call('/tender/sell', { ticker: T, shares: 140 }, B.token))), sold = race.filter(r => r.status === 200).reduce((a, r) => a + r.d.shares, 0);
  const hb = (await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: {} }, B.token)).d.holdings.find(x => x[0] === T);
  check(sold >= 140 && sold <= 560.01 && near((hb ? hb[1] : 0) + sold, 600, .01), `four sells at once by a player with 600: ${sold} sold, ${hb ? hb[1] : 0} left (${race.map(r => r.status).join(' ')})`);
  await call('/tender', { cancel: true }, A.token); await call('/shares', { ticker: T, side: 'buy', shares: 1000, price: px2 }, B.token);
  // a freer IPO, by Cat: her own price, ticker and dividend
  const K = (await call('/login', { name: 'Cat_' + tag, password: 'secret1' })).d; await call('/save', { save, company: 'Cat Cars', nw: 4e5, level: 3 }, K.token);
  const ipo = o => call('/ipo', { f: .5, m: .9, div: .3, company: 'Cat Cars', book: 400000, profit: 2000, growth: 1, ...o }, K.token);
  check((await ipo({ m: 1.5 })).status === 400 && (await ipo({ m: .5 })).status === 400 && (await ipo({ div: .95 })).status === 400, 'a price or a dividend out of range is refused');
  check((await ipo({ ticker: '1AB' })).status === 400 && (await ipo({ ticker: 'TOOLONG' })).status === 400 && (await ipo({ ticker: 'MB10' })).status === 400 && (await ipo({ ticker: T })).status === 409, 'a bad, reserved or taken ticker is refused');
  const tick = 'C' + tag.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4), ci = await ipo({ m: 1.1, div: .6, ticker: tick });
  check(ci.status === 200 && ci.d.ticker === tick && near(ci.d.taken, .5, .001) && near(ci.d.issued, 5e4, 1), `10% over: investors take half of it, and Cat is ${ci.d.ticker}`);
  const pre = (400000 + Math.min(100000, 15 * 2000 * (.6 + .4 * 2))) / 1e5; check(near(ci.d.raised, 5e4 * pre * 1.1 * .95, 5) && ci.d.mine.divr === .6 && near(ci.d.mine.raised, ci.d.raised, .1), `raising $${ci.d.raised} at $${ci.d.price}, with a 60% dividend`);
  check((await ipo({})).status === 409, 'only once');
  // Dan sells 5%, Bob buys all of it, and Dan's offer takes the lot: the company is private again and the rest of the offer is Dan's
  const D = (await call('/login', { name: 'Dan_' + tag, password: 'secret1' })).d; await call('/save', { save, company: 'Dan Docks', nw: 4e5, level: 3 }, D.token);
  const di = await call('/ipo', { f: .05, m: .9, div: .3, company: 'Dan Docks', book: 400000, profit: 0, growth: 1 }, D.token), T2 = di.d.ticker, n5 = di.d.issued, px5 = (400000 + di.d.raised) / (1e5 + n5);
  const b5 = await call('/shares', { ticker: T2, side: 'buy', shares: n5, price: px5 }, B.token); check(b5.status === 200 && b5.d.holding[1] > n5 - .01, `Bob buys all ${Math.round(n5)} shares Dan sold`);
  const t5 = await call('/tender', { prem: 1.05, price: px5, shares: n5 }, D.token), s5 = await call('/tender/sell', { ticker: T2, shares: n5 }, B.token);
  check(t5.status === 200 && s5.status === 200 && s5.d.holding === null, `and sells them all into Dan's offer: +$${s5.d.cash} ${t5.d.error || ''}`);
  const d5 = await call('/sync', { company: 'Dan Docks', nw: 4e5, level: 3, book: 400000, profit: 0, flow: {} }, D.token); check(d5.d.mine === null, 'Dan Docks is private again');
  check((await call('/ipo', { f: .1, m: .9, div: 0, company: 'Dan Docks', book: 400000, profit: 0, growth: 1 }, D.token)).status === 200, 'and can go public again, paying no dividend');
  // Alice closes her company: Bob is bought out at today's price on his next sync
  check((await call('/save', { clear: true }, A.token)).status === 200, 'Alice starts over, her company public');
  const out = await call('/sync', { company: 'Bob Foods', nw: 9000, level: 1, flow: {} }, B.token);
  check(out.d.paidOut && out.d.paidOut.length === 1 && out.d.credit > 20 && !out.d.holdings.length, `Bob is bought out: +$${out.d.credit}`);
  await wait(21000);
  check(!((await call('/market')).d.listings || []).some(r => r[0] === T), 'the closed company leaves the listings');

  // log out
  check((await call('/save', { clear: true }, A.token)).status === 200, 'starting over twice is fine');
  check((await call('/save', null, A.token)).d.save === null, 'her save is gone from the server');
  check((await call('/logout', {}, A.token)).status === 200 && (await call('/me', null, A.token)).status === 401, 'logging out ends the session');

  console.log(problems.length ? `\n${problems.length} FAILED` : '\nall server checks passed');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
