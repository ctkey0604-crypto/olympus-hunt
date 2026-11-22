#!/usr/bin/env node
/* Brick & Coin online check (v0.07): the real game in a browser, against a local server (see server_check.js for how to
   run one with the test login: any name, password "secret1").

     node brick-and-coin/test/online_check.js [http://127.0.0.1:8787]

   1. Play Online: create an account on the starting menu, start a company, and it reaches the server.
   2. Another player (straight through the API) dumps Wood: the game's Wood price drops for everyone, the Market says
      "players", and the news says so.
   3. The leaderboard: real players only (you, and the other with a green "online" dot), never the simulated ones.
   3b. Going public (v0.08): Carol sells 25% of her company; Dave buys some; Dave goes public and Carol buys his shares.
   4. A second device logs in and Continue opens the company saved on the server. Log out from the Menu.
   Screenshots go to brick-and-coin/test/out/online_*.png. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const problems = [];
function check(ok, msg) { console.log((ok ? '  ok    ' : '  FAIL  ') + msg); if (!ok) problems.push(msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(p, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + '/api' + p, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
async function untilTrue(page, fn, ms = 30000) { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(fn)) return true; await sleep(500); } return false; }

(async () => {
  const tag = Math.random().toString(36).slice(2, 6), me = 'Carol_' + tag, other = 'Dave_' + tag;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/?nosplash');
  await page.waitForSelector('.tmenu');

  // 1. create an account, start a company
  check(await page.locator('.tbtn', { hasText: 'Play Online' }).count() === 1, 'the starting menu offers Play Online');
  await page.locator('.tbtn', { hasText: 'Play Online' }).click();
  await page.fill('#acName', me); await page.fill('#acPw', 'wrong!!');
  await page.click('#acGo'); await sleep(800);
  check(/Wrong name or password/.test(await page.textContent('#acErr')), 'a wrong password says so');
  await page.fill('#acPw', 'secret1'); await page.click('#acNew');
  await page.waitForSelector('.tacct', { timeout: 10000 });
  check((await page.textContent('.tacct')).includes(me), `logged in: the menu says "Online as ${me}"`);
  await page.screenshot({ path: path.join(OUT, 'online_title.png') });
  await page.locator('.tbtn', { hasText: 'New Company' }).click();
  await page.fill('#coInput', 'Carol Timber'); await page.click('#tgo');
  await page.waitForFunction(() => window.__game.S && window.__game.S.company === 'Carol Timber');
  const tok = await page.evaluate(() => window.__game.NET.token);
  check(!!tok, 'the game holds a session');
  check(await untilTrue(page, () => window.__game.NET.lastSave > 0, 15000), 'the new company is sent to the server');
  const meApi = await api('/me', null, tok);
  check(meApi.company === 'Carol Timber', `the server has the company (${meApi.company})`);

  // 2. another player dumps Wood: the price drops for everyone
  const D = (await api('/register', { name: other, password: 'secret1' })).token;
  const before = await page.evaluate(() => ({ m: window.__game.crowdOthersMult('wood'), p: window.__game.price('wood') }));
  await api('/sync', { company: 'Dave Lumber', nw: 5e6 + Math.floor(Math.random() * 1e6), level: 4, flow: { wood: [2000, 0] } }, D);
  await page.evaluate(() => { window.__game.NET.lastSync = 0; });   // sync now instead of in a minute
  // wait for a server total worked out after Dave's report (it's on the leaderboard then), not one left from an earlier run
  const dropped = await page.evaluate(n => { window.__other = n; }, other).then(() => untilTrue(page, () => { const g = window.__game, ok = g.crowdOthersMult('wood') < .9 && g.NET.board.some(r => r[0] === window.__other); if (!ok) g.NET.lastSync = 0; return ok; }, 60000));
  const after = await page.evaluate(() => ({ m: window.__game.crowdOthersMult('wood'), p: window.__game.price('wood') }));
  check(dropped && after.m > .69 && after.m < .8, `another player dumping Wood moves its price ${((after.m - 1) * 100).toFixed(0)}% (capped at −30%)`);
  check(after.p < before.p * .85, `the Wood price you get falls too ($${before.p.toFixed(2)} → $${after.p.toFixed(2)})`);
  const news = await page.evaluate(() => window.__game.S.news.map(n => n.text).join(' | '));
  check(/Players are selling a lot of Wood/.test(news), 'the news says players are selling Wood');
  await page.keyboard.press('m'); await page.waitForSelector('.mrow');
  const crowdTxt = await page.locator('[data-live="crowd:wood"]').textContent();
  check(/players −\d+%/.test(crowdTxt), `the Market shows it: "${crowdTxt.trim()}"`);
  await page.screenshot({ path: path.join(OUT, 'online_market.png') });
  await page.keyboard.press('Escape');

  // 3. the leaderboard: real players only (no simulated companies, no made-up tycoons)
  await page.keyboard.press('l'); await page.waitForSelector('.lb-row');
  const pl = await page.textContent('.lb');
  const fake = await page.evaluate(() => [...RIVALS.map(r => r.name), ...window.__game.simBoard(WT).map(s => s.name)]);
  check(pl.includes(other) && pl.includes('Carol Timber') && !/SIM/.test(pl) && !fake.some(n => pl.includes(n)), `the leaderboard has only real players (${other} and you), none of the ${fake.length} simulated ones`);
  if (!pl.includes(other) || /SIM/.test(pl)) console.log('    board: ' + JSON.stringify(pl.replace(/\s+/g, ' ').slice(0, 700)));
  check(await page.locator('.lb .dot').count() >= 1, 'an online player has a green dot');
  await page.screenshot({ path: path.join(OUT, 'online_board_players.png') });
  await page.keyboard.press('Escape');

  // 3b. v0.08, going public: Carol (given $200k to reach Level 3) sells 25% through Invest → Your company
  await page.keyboard.press('s'); await page.waitForSelector('[data-act="itab"][data-v="mine"]');
  await page.click('[data-act="itab"][data-v="mine"]'); await sleep(300);
  check(/Reach Level 3/.test(await page.textContent('.sheet')), 'a small company is told to reach Level 3 first');
  await page.evaluate(() => { const g = window.__game; g.S.cash += 200000; g.step(1.1); g.step(1.1); });
  check(await page.evaluate(() => window.__game.S.level) >= 3, 'with $200k more Carol reaches Level 3');
  await sleep(600);
  await page.click('[data-act="ipof"][data-v="0.25"]'); await sleep(300);
  const quote = await page.evaluate(() => ({ cash: window.__game.S.cash, cv: window.__game.companyValue() }));
  await page.click('[data-act="ipo"]'); await sleep(300);
  check(/Tap again/.test(await page.textContent('[data-act="ipo"]')), 'going public asks for a second tap');
  await page.screenshot({ path: path.join(OUT, 'online_ipo.png') });
  await page.click('[data-act="ipo"]');
  check(await untilTrue(page, () => !!window.__game.S.pub, 10000), 'Carol’s company goes public');
  const pub = await page.evaluate(() => { const g = window.__game; return { pub: g.S.pub, cash: g.S.cash, own: g.ownFrac(), nw: g.netWorth(), cv: g.companyValue() }; });
  check(pub.cash > quote.cash + 50000 && Math.abs(pub.own - .75) < .001, `she raises ${Math.round(pub.cash - quote.cash)} and keeps 75%`);
  check(Math.abs(pub.nw - pub.cv * .75) < 1, `her net worth is her 75% of the company ($${Math.round(pub.nw)} of $${Math.round(pub.cv)})`);
  // Dave buys 500 of her shares (straight through the API) and she sees it after a sync
  let L = null;   // the listings are worked out every 20 s: wait for hers
  for (let k = 0; k < 30 && !L; k++) { L = ((await api('/market')).listings || []).find(r => r[0] === pub.pub.ticker); if (!L) await sleep(1000); }
  const fairC = L ? (L[5] + Math.min(.25 * L[5], 15 * Math.max(0, L[6]))) / L[3] : 0;   // v0.10 valuation
  const dv = await api('/shares', { ticker: pub.pub.ticker, side: 'buy', shares: 500, price: fairC }, D);
  check(dv.ok, `Dave buys 500 ${pub.pub.ticker} shares at $${fairC.toFixed(2)}`);
  await page.evaluate(() => { window.__game.NET.lastSync = 0; });
  check(await untilTrue(page, () => { const g = window.__game, x = g.pubListing(g.S.pub.ticker); if (!(x && x.held >= 500)) g.NET.lastSync = 0; return x && x.held >= 500; }, 60000), 'Your company shows Dave’s 500 shares');
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'online_public.png') });
  // Dave takes his company public too, and Carol buys $1,000 of it in Invest → Players
  await api('/sync', { company: 'Dave Lumber', nw: 5e6, level: 4, book: 500000, profit: 3000, flow: {} }, D);
  const dip = await api('/ipo', { f: .4, company: 'Dave Lumber', book: 500000, profit: 3000 }, D);
  check(!!dip.ticker, `Dave goes public as ${dip.ticker}`);
  await page.evaluate(t => { window.__game.NET.lastSync = 0; window.__dave = t; }, dip.ticker);
  check(await untilTrue(page, () => { const g = window.__game, ok = g.NET.listings.some(x => x.ticker === window.__dave); if (!ok) g.NET.lastSync = 0; return ok; }, 60000), 'Dave Lumber shows up in Invest → Players');
  await page.click('[data-act="itab"][data-v="players"]'); await sleep(400);
  await page.click(`[data-act="pubsel"][data-t="${dip.ticker}"]`); await sleep(300);
  const before2 = await page.evaluate(() => window.__game.S.cash);
  await page.click('[data-act="pubbuy"][data-v="1000"]');
  check(await page.waitForFunction(t => !!window.__game.S.pubHold[t], dip.ticker, { timeout: 10000 }).then(() => true, () => false), `Carol buys ${dip.ticker} shares`);
  const after2 = await page.evaluate(t => ({ cash: window.__game.S.cash, h: window.__game.S.pubHold[t] }), dip.ticker);
  check(after2.h && Math.abs(before2 - after2.cash - 1000) < 1, `$1,000 spent on ${after2.h ? after2.h.q.toFixed(1) : 0} shares`);
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, 'online_players.png') });
  await page.keyboard.press('Escape');

  // 4. a second device: log in, Continue opens the online company
  await page.keyboard.press('Escape'); await page.waitForSelector('.mnav');
  await page.click('[data-act="mtab"][data-v="online"]'); await sleep(300);
  check((await page.textContent('.mpane')).includes('Inspirapixel account as ' + me), 'Menu → Online shows the Inspirapixel account');
  await page.click('[data-act="mainmenu"]'); await page.waitForSelector('.tmenu');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }), p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push('device 2: ' + e.message));
  await p2.goto(BASE + '/?nosplash'); await p2.waitForSelector('.tmenu');
  check(await p2.locator('[data-act="continue"]').count() === 0, 'a new device has nothing to continue before logging in');
  await p2.locator('.tbtn', { hasText: 'Play Online' }).click();
  await p2.fill('#acName', me.toLowerCase()); await p2.fill('#acPw', 'secret1'); await p2.click('#acGo');
  await p2.waitForSelector('[data-act="continue"]', { timeout: 10000 });
  check((await p2.textContent('[data-act="continue"]')).includes('Carol Timber'), 'after logging in (name in any case), Continue shows the online company');
  await p2.click('[data-act="continue"]');
  await p2.waitForFunction(() => window.__game.S && window.__game.S.company === 'Carol Timber');
  check(true, 'the second device plays the online company');
  await p2.keyboard.press('Escape'); await p2.waitForSelector('.mnav');
  await p2.click('[data-act="mtab"][data-v="online"]'); await sleep(200);
  await p2.click('[data-act="logout"]'); await sleep(800);
  check(await p2.evaluate(() => !window.__game.NET.token), 'Log out works');
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(problems.length ? `\n${problems.length} FAILED` : '\nall online checks passed');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
