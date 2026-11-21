#!/usr/bin/env node
/* Brick & Coin playtest: boots the built game in a headless browser and plays it.

     python3 brick-and-coin/build.py && node brick-and-coin/test/playtest.js [--minutes 60] [--shots DIR]

   1. Desktop: new company, the whole tutorial by clicking, every menu, market, stocks, real estate,
      save code export/import, every sprite at every level.
   2. A simple bot plays --minutes of game time (default 60) while the economy is checked every
      game minute (no NaN cash, no negative stock, no broken prices). Prints when it reached each level,
      so you can compare pacing before and after a balance change. The bot is a rough player, not a
      perfect one: use it to compare versions, not as the real time-to-level.
   3. Save, close for an hour, reopen: Continue works and offline earnings are paid.
   4. Phone on its side (844x390, touch), phone upright (rotate screen), short laptop window.
   Screenshots go to brick-and-coin/test/out/ (or --shots DIR). Exits 1 if anything failed. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = +arg('--minutes', 60);
const SHOTS = path.resolve(arg('--shots', path.join(__dirname, 'out')));
const PAGE = path.join(__dirname, '..', 'dist', 'brick-and-coin.html');
if (!fs.existsSync(PAGE)) { console.error('No build found. Run: python3 brick-and-coin/build.py'); process.exit(1); }
fs.mkdirSync(SHOTS, { recursive: true });

const problems = [];
function check(ok, msg) { console.log((ok ? '  ok    ' : '  FAIL  ') + msg); if (!ok) problems.push(msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(browser, name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log(`  FAIL  [${name}] page error: ${e.message}`); problems.push(`[${name}] page error: ${e.message}`); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log(`  console error [${name}]: ${m.text()}`); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#start .title');
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
async function newCompany(page, name, pick = 'wood') {
  await page.fill('#coInput', name);
  await page.click(`.pick[data-p=${pick}]`);
  await page.click('#startForm button[type=submit]');
  await page.waitForSelector('#app:not([hidden])');
}
// screen point at the middle of a lot (i < 36) or property plot (100 + k), moving the camera there first
async function spot(page, i) {
  return page.evaluate(i => {
    const p = spotXY(i), sz = i >= 100 ? PLOT : LOT;
    centerOn(TX + p.x + sz / 2, TY + p.y + sz / 2);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (p.x + sz / 2 + offX()) * CAM.s, y: r.top + (p.y + sz / 2 + offY()) * CAM.s };
  }, i);
}
async function tapLot(page, i, touch) { const p = await spot(page, i); if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await sleep(150); }
const play = (page, sec) => page.evaluate(n => { for (let k = 0; k < n; k++) step(.2); }, Math.round(sec / .2));   // fast-forward game time
const coach = page => page.evaluate(() => $('#coach').hidden ? '' : $('#coach .c-txt').textContent);
async function coachSays(page, re) { await page.waitForFunction(re => !$('#coach').hidden && new RegExp(re).test($('#coach .c-txt').textContent), re.source, { timeout: 4000 }).catch(() => {}); return re.test(await coach(page)); }

// in-page: the economy must stay sane
const INVARIANTS = () => {
  const bad = [];
  if (!Number.isFinite(S.cash)) bad.push('cash is ' + S.cash);
  if (!Number.isFinite(netWorth())) bad.push('net worth is ' + netWorth());
  for (const p in S.inv) if (!(S.inv[p] >= -1e-6) || !Number.isFinite(S.inv[p])) bad.push(`stock of ${p} is ${S.inv[p]}`);
  if (whUsed() > whMax() + 1e-6) bad.push(`warehouse ${whUsed()} over ${whMax()}`);
  for (const p of PIDS) { const v = price(p); if (!(v > 0) || !Number.isFinite(v)) bad.push(`price of ${p} is ${v}`); }
  for (const a of ASSETS) { const v = S.assets[a.t].p; if (!(v > 0) || !Number.isFinite(v)) bad.push(`${a.t} price is ${v}`); }
  if (!(S.house.i > 0)) bad.push('housing index is ' + S.house.i);
  for (const r of S.rivals) if (!Number.isFinite(r.nw)) bad.push(`${r.name} net worth is ${r.nw}`);
  for (const l of S.lots) if (l && l.b !== 'hq' && !(l.lv >= 1 && l.lv <= MAX_BLD_LV)) bad.push(`building level ${l.lv}`);
  return bad;
};

// in-page: a rough player. It follows the goals like a new player would, and otherwise builds or upgrades
// whatever earns the most per dollar. One decision every 2 game seconds.
const BOT = () => {
  const free = () => { for (let i = 0; i < 36; i++) if (!S.lots[i] && lotUnlocked(i)) return i; return -1; };
  const act = activeProducts(), roomFor = p => act.has(p) || act.size < MAX_ACTIVE_PRODUCTS;
  const canGet = p => S.unlocked[p] || /^$|^Not enough cash$/.test(canUnlock(p));
  // profit per minute of one Lv1 building, paying the market's buy price for inputs we don't make ourselves
  const gain = p => { const P = PRODUCTS[p]; let v = P.out * price(p); for (const q in P.rec) v -= P.rec[q] * (act.has(q) ? price(q) : buyPrice(q)); return v * 60 / P.sec * lotMult() - UPKEEP[tierOf(p)]; };
  const ratio = p => gain(p) / buildCost(p), best = list => list.sort((a, b) => ratio(b) - ratio(a))[0];
  const get = p => {   // unlock it (saving up if needed), then build it
    if (!S.unlocked[p]) return S.cash >= researchCost(p) + buildCost(p) ? unlock(p) || 'unlock ' + p : '';
    return free() >= 0 && S.cash >= buildCost(p) ? build(free(), p) || 'build ' + p : '';
  };
  for (const l of S.lots) if (l && l.b !== 'hq' && l.stall && l.stall !== 'storage full') l.autoBuy = true;   // never sit idle waiting for inputs
  // goals that ask for something new: a stock, a home, a new product, a factory, a Level 2 or 3 product
  const G = S.goal, ring = { 3: 0, 4: 1, 8: 2, 12: 3 }[G];
  if (G === 7 && S.cash >= 1000) return buyAsset('MB10', 500) || 'stock';
  if (G === 9) { const k = S.props.findIndex((_, k) => canBuyProp(k) === ''); if (k >= 0 && S.cash >= propBuyPrice(k) + 1000) return buyProp(k) || 'home'; }
  if (capUsed() >= capMax()) return S.hqLv < HQ_COST.length && S.cash >= hqUpgradeCost() ? upgradeHQ() || 'hq' : '';   // more slots before anything else
  if (ring === 0) { const p = best(PIDS.filter(p => !S.unlocked[p] && canGet(p))); if (p) return get(p); }
  if (ring) { const p = best(PIDS.filter(p => PRODUCTS[p].ring === ring && !PRODUCTS[p].raw && roomFor(p) && canGet(p))); if (p) return get(p); }
  // a much better product within reach: save up for it
  const have = PIDS.filter(p => S.unlocked[p]), next = best(PIDS.filter(p => !S.unlocked[p] && canGet(p) && roomFor(p)));
  if (next && ratio(next) > 1.3 * Math.max(...have.map(ratio))) return get(next);
  // build the best product we can afford, or upgrade the best building (each level adds one more building's worth)
  const lot = free(), opts = have.filter(p => roomFor(p) && S.cash >= buildCost(p)).sort((a, b) => ratio(b) - ratio(a));
  let up = -1, ub = 0;
  S.lots.forEach((l, i) => { if (l && l.b !== 'hq' && l.lv < MAX_BLD_LV) { const g = gain(l.b) / upgradeCost(l); if (g > ub) { ub = g; up = i; } } });
  if (lot >= 0 && opts.length && (up < 0 || ratio(opts[0]) >= ub || S.cash < upgradeCost(S.lots[up]))) return build(lot, opts[0]) || 'build ' + opts[0];
  if (up >= 0 && S.cash >= upgradeCost(S.lots[up])) return upgrade(up) || 'upgrade';
  if (whUsed() > whMax() * .8 && S.whLv < WH_COST.length && S.cash >= whUpgradeCost() * 3) return upgradeWH() || 'warehouse';
  return '';
};

let URL;
(async () => {
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(PAGE).pipe(r); }).listen(0);
  URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();

  /* ---------------- 1. desktop: tutorial, menus, every feature ---------------- */
  console.log('Desktop 1280x720');
  let { ctx, page } = await open(browser, 'desktop', { viewport: { width: 1280, height: 720 } });
  check(await page.isVisible('[data-act=continue]') === false, 'fresh browser shows no Continue button');
  await shot(page, '01-start');
  await page.click('#startForm button[type=submit]');
  check(/name/i.test(await page.textContent('#startErr')), 'an empty company name is refused');
  await newCompany(page, 'Playtest Lumber');
  check(await page.evaluate(() => S.company === 'Playtest Lumber' && S.cash === START_CASH && S.unlocked.wood), 'new company starts with its cash and Wood unlocked');
  check(await coachSays(page, /flashing lot/), 'tutorial 1: points at the flashing lot');
  await shot(page, '02-tutorial');
  await tapLot(page, await page.evaluate(() => tutLot()));
  check(/Empty lot/.test(await page.textContent('#side')), 'tapping the lot opens it');
  await page.waitForSelector('#side [data-act=build].coach-hi', { timeout: 3000 }).catch(() => {});
  await page.click('#side [data-act=build].coach-hi');
  check(await page.evaluate(() => countBuildings() === 1), 'Build puts up the first building');
  check(await coachSays(page, /cash/), 'tutorial 2: watch your cash');
  await play(page, 20);
  check(await page.evaluate(() => S.stats.sales > 0), 'goods sell on their own');
  check(await coachSays(page, /tap your building|Upgrade/), 'tutorial 3: asks for the building');
  await tapLot(page, await page.evaluate(() => firstBld()));
  await page.waitForSelector('#side [data-act=upgrade]');
  await page.click('#side [data-act=upgrade]');
  check(await page.evaluate(() => S.lots[firstBld()].lv === 2), 'Upgrade raises the building to Lv 2');
  check(await coachSays(page, /Production/), 'tutorial 4: points at Production');
  await page.keyboard.press('p');
  check(await page.textContent('#mTitle') === 'Production', 'P opens Production');
  await page.waitForFunction(() => S.tut === 4, null, { timeout: 3000 }).catch(() => {});
  await shot(page, '03-production');
  await page.keyboard.press('Escape');
  check(await coachSays(page, /basics/), 'tutorial 5: wraps up');
  await page.click('[data-act=tutdone]');
  check(await page.evaluate(() => S.tut === TUT_DONE && $('#coach').hidden), 'Got it ends the tutorial');
  check(await page.evaluate(() => S.goal >= 1 && S.cash > START_CASH - 500), 'first goal is complete and paid');

  // output: keep the goods, then sell them from the market
  await tapLot(page, await page.evaluate(() => firstBld()));
  await page.click('#side [data-act=flow][data-v=keep]');
  await play(page, 30);
  const kept = await page.evaluate(() => S.inv.wood || 0);
  check(kept > 0, `Keep stores the goods (${kept} wood)`);
  await page.keyboard.press('m');
  await page.click('[data-act=sell][data-p=wood][data-q=all]');
  check(await page.evaluate(() => !(S.inv.wood > 0)), 'Market: Sell all empties storage');
  await page.click('[data-act=buy][data-p=wood]');
  check(await page.evaluate(() => S.inv.wood === 10), 'Market: Buy 10 adds 10');
  await page.click('[data-act=mktf][data-v=all]');
  await shot(page, '04-market');
  await page.keyboard.press('Escape');

  // stocks and real estate
  await page.keyboard.press('s');
  await page.click('[data-act=stsel][data-t=PXC]');
  await page.click('[data-act=stbuy][data-v="100"]');
  check(await page.evaluate(() => S.hold.PXC && S.hold.PXC.q > 0), 'Invest: buying $100 of PixCoin');
  await shot(page, '05-stocks');
  await page.click('[data-act=stsell][data-v="1"]');
  check(await page.evaluate(() => S.hold.PXC.q === 0), 'Invest: selling it all');
  await page.evaluate(() => { S.cash += 20000; });
  await page.click('[data-act=itab][data-v=re]');
  await shot(page, '06-real-estate');
  await page.click('[data-act=pshow][data-k="0"]');
  await page.waitForFunction(() => UI.sel && UI.sel.i === 100);
  await page.click('#side [data-act=pbuy]');
  check(await page.evaluate(() => S.props[0].own), 'Real estate: buying the cottage');
  await page.click('#side [data-act=preno]');
  check(await page.evaluate(() => S.props[0].reno === 2), 'Real estate: renovating it');
  await page.keyboard.press('l');
  check(await page.textContent('#mTitle') === 'Leaderboard', 'L opens the Leaderboard');
  await page.keyboard.press('Escape');
  await page.click('[data-act=hq]');
  check(/HQ/.test(await page.textContent('#side h2')), 'HQ button opens the HQ');

  // save code out and back in
  await page.click('[data-act=menu]');
  await shot(page, '07-menu');
  await page.click('[data-act=copysave]');
  const code = await page.inputValue('#loadBox');
  check(code.length > 100, 'Menu: export fills in a save code');
  await page.evaluate(() => { S.cash = 1; });
  await page.click('[data-act=loadsave]');
  check(await page.evaluate(() => S.cash > 1 && S.company === 'Playtest Lumber'), 'Menu: importing the save code restores the company');

  // every sprite, icon and background draws
  const art = await page.evaluate(() => {
    const bad = [];
    const t = (what, f) => { try { f(); } catch (e) { bad.push(what + ': ' + e.message); } };
    for (const b in BUILD) for (let lv = 1; lv <= 5; lv++) t(`${b} Lv${lv}`, () => buildingPreview(b, lv));
    for (const h in PROPS) for (let r = 1; r <= PROP_MAX_RENO; r++) t(`${h} reno ${r}`, () => housePreview(h, r));
    for (const n of [...Object.keys(ICONS), ...Object.keys(PROC_ICONS)]) t('icon ' + n, () => iconURL(n));
    for (let L = 1; L <= MAX_LEVEL; L++) t('town Lv' + L, () => drawBackground(L));
    drawBackground(S.level);
    for (const p of PIDS) for (const k of ['bld', 'name']) if (!PRODUCTS[p][k]) bad.push(`${p} has no ${k}`);
    for (const p of PIDS) { if (!ICONS[p] && !PROC_ICONS[p]) bad.push(`${p} has no icon`); if (!BUILD[p]) bad.push(`${p} has no building`); if (!WEBPOS[p]) bad.push(`${p} has no spot on the Production web`); if (!BLURB[p]) bad.push(`${p} has no blurb`); }
    return bad;
  });
  check(!art.length, 'every building, house, icon and town background draws' + (art.length ? ': ' + art.join('; ') : ''));

  /* ---------------- 2. a bot plays for a while ---------------- */
  console.log(`Bot plays ${MINUTES} game minutes`);
  await page.evaluate(() => { closeModal(); selectLot(-1); newGame('Bot Co', 'wood'); S.tut = TUT_DONE; S.settings = AUD.set; afterLoad(); });
  const levelAt = {}, broken = [];
  for (let m = 1; m <= MINUTES; m++) {
    const r = await page.evaluate(({ bot, inv }) => {
      const B = eval('(' + bot + ')'), I = eval('(' + inv + ')'), did = [];
      for (let k = 0; k < 300; k++) { step(.2); if (k % 10 === 0) { const a = B(); if (a) did.push(a); } }
      const mix = {}; for (const l of S.lots) if (l && l.b !== 'hq') mix[l.b] = (mix[l.b] || 0) + l.lv;
      return { bad: I(), lv: S.level, cash: S.cash, nw: netWorth(), bld: countBuildings(), cap: `${capUsed()}/${capMax()}`, ppm: profitPerMin(), rank: playerRank(), goal: S.goal, did,
        mix: Object.entries(mix).map(([p, n]) => `${p} ${n}`).join(', '), stalled: S.lots.filter(l => l && l.stall).map(l => `${l.b} (${l.stall})`).join(', ') };
    }, { bot: BOT.toString(), inv: INVARIANTS.toString() });
    if (r.bad.length) broken.push(`minute ${m}: ${r.bad.join(', ')}`);
    if (!levelAt[r.lv]) levelAt[r.lv] = m;
    if (m % 10 === 0 || m === MINUTES) console.log(`    min ${String(m).padStart(3)}  Lv ${r.lv}  cash $${Math.round(r.cash).toLocaleString()}  net worth $${Math.round(r.nw).toLocaleString()}  ${r.bld} buildings (${r.cap} slots)  $${Math.round(r.ppm).toLocaleString()}/min  rank #${r.rank}  goal ${r.goal}`);
    if (m % 10 === 0 && process.argv.includes('--verbose')) console.log(`             levels per product: ${r.mix}${r.stalled ? '  stalled: ' + r.stalled : ''}`);
  }
  check(!broken.length, 'economy stays sane every game minute' + (broken.length ? ': ' + broken.slice(0, 5).join(' | ') : ''));
  console.log('    reached ' + Object.entries(levelAt).filter(([L]) => L > 1).map(([L, m]) => `Level ${L} at about minute ${m}`).join(', ') || '    stayed at Level 1');
  await page.evaluate(() => camHome());
  await sleep(400);
  await shot(page, '08-town-after-bot');
  await tapLot(page, await page.evaluate(() => S.lots.reduce((b, l, i) => l && l.b !== 'hq' && (b < 0 || l.lv > S.lots[b].lv) ? i : b, -1)));
  await shot(page, '09-building');

  /* ---------------- 3. close for an hour, come back ---------------- */
  const before = await page.evaluate(() => ({ cash: S.cash, bld: countBuildings() }));
  await page.evaluate(() => { saveLocal(); running = false; const o = JSON.parse(localStorage.getItem(SAVE_KEY)); o.savedAt = Date.now() - 3600e3; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-act=continue]');
  check(true, 'reopening the page offers Continue');
  await page.click('[data-act=continue]');
  await page.waitForSelector('#app:not([hidden])');
  const toastText = await page.waitForSelector('.toast', { timeout: 3000 }).then(e => e.textContent()).catch(() => '');
  check(/While you were away \(60 min\)/.test(toastText), `offline earnings are reported (${toastText || 'no toast'})`);
  check(await page.evaluate(b => countBuildings() === b.bld && S.company === 'Bot Co', before), 'Continue brings back the same company');
  await ctx.close();

  /* ---------------- 4. other screens ---------------- */
  console.log('Phone on its side 844x390 (touch)');
  ({ ctx, page } = await open(browser, 'phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }));
  const btn = await page.locator('#startForm button[type=submit]').boundingBox();
  check(btn && btn.y + btn.height <= 390, 'start button fits on screen without scrolling');
  await newCompany(page, 'Pocket Farms', 'wheat');
  // On phones the closed side panel sits off to the right, so Playwright's click/tap (which scrolls things into view first)
  // can slide the whole app sideways, something a real finger never does. Buttons here get a plain click event instead.
  const press = sel => page.dispatchEvent(sel, 'click');
  await press('[data-act=tutdone]');
  await tapLot(page, await page.evaluate(() => tutLot()), true);
  check(await page.evaluate(() => $('#side').classList.contains('open')), 'tapping a lot slides the panel in');
  await sleep(300);
  await shot(page, '10-phone-lot');
  await press('#side [data-act=sheetclose]');
  await press('#nav [data-act=stocks]');
  check(await page.evaluate(() => $('#app').scrollLeft === 0 && $('#bottom').getBoundingClientRect().left >= 0), 'the app stays put (nav column on screen)');
  check(await page.textContent('#mTitle') === 'Invest', 'nav button opens Invest');
  await shot(page, '11-phone-invest');
  await ctx.close();

  console.log('Phone upright 390x844');
  ({ ctx, page } = await open(browser, 'portrait', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
  check(await page.isVisible('#rotate'), 'asks you to turn the phone sideways');
  await ctx.close();

  console.log('Short laptop window 880x456');
  ({ ctx, page } = await open(browser, 'short', { viewport: { width: 880, height: 456 } }));
  const b2 = await page.locator('#startForm button[type=submit]').boundingBox();
  check(b2 && b2.y + b2.height <= 456, 'start button fits on screen without scrolling');
  await newCompany(page, 'Short Screen Co');
  await shot(page, '12-short-window');
  await ctx.close();

  await browser.close(); server.close();
  console.log(problems.length ? `\n${problems.length} problem(s):\n - ` + problems.join('\n - ') : '\nAll good.');
  console.log('Screenshots: ' + SHOTS);
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
