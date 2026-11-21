#!/usr/bin/env node
/* Brick & Coin playtest: boots the built game in a headless browser and plays it.

     python3 brick-and-coin/build.py && node brick-and-coin/test/playtest.js [--minutes 60] [--shots DIR]

   0. The Inspirapixel splash, then the starting menu: its pages, settings kept on the device, the live market.
   1. Desktop: new company, the whole tutorial by clicking, every menu, market, stocks, real estate,
      save code export/import, every sprite at every level, the game's Menu, back to the main menu and Continue.
   2. A simple bot plays --minutes of game time (default 60) while the economy is checked every
      game minute (no NaN cash, no negative stock, no broken prices). Prints when it reached each level,
      so you can compare pacing before and after a balance change. The bot is a rough player, not a
      perfect one: use it to compare versions, not as the real time-to-level.
   3. Save, close for an hour, reopen: Continue works and offline earnings are paid.
   4. Gold Hill: a $1M company reaches Level 4, unlocks and builds a Grand Piano, buys a villa, hears the hill's tune.
   5. Real v0.03 and v0.04 saves (test/fixtures/) load through Continue and keep playing.
   6. One shared world: two separate browsers see the same prices, news, rivals and price swings at the same moment, the
      player's own trading doesn't move them, a device with its clock 2 hours out still agrees, and gets no free offline pay.
   6. Phone on its side (844x390, touch), phone upright (rotate screen), short laptop window.
   Screenshots go to brick-and-coin/test/out/ (or --shots DIR). Exits 1 if anything failed.

   Comparing balance between versions: --bot-only runs just the bot (step 2) on a fresh company, and --page FILE
   points it at another build. Build an older version from git into a folder and run both:
     node brick-and-coin/test/playtest.js --bot-only --minutes 600 --page /tmp/old/brick-and-coin.html */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = +arg('--minutes', 60);
const SHOTS = path.resolve(arg('--shots', path.join(__dirname, 'out')));
const PAGE = path.resolve(arg('--page', path.join(__dirname, '..', 'public', 'index.html')));   // --page: test another build, e.g. an older version
if (!fs.existsSync(PAGE)) { console.error('No build found. Run: python3 brick-and-coin/build.py'); process.exit(1); }
fs.mkdirSync(SHOTS, { recursive: true });

const problems = [];
function check(ok, msg) { console.log((ok ? '  ok    ' : '  FAIL  ') + msg); if (!ok) problems.push(msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(browser, name, opts, splash) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log(`  FAIL  [${name}] page error: ${e.message}`); problems.push(`[${name}] page error: ${e.message}`); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log(`  console error [${name}]: ${m.text()}`); });
  await page.goto(URL + (splash ? '' : '?nosplash'), { waitUntil: 'load' });   // the splash waits for a click: skip it, except where it's tested
  await page.waitForSelector('#start .title');
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
async function newCompany(page, name, pick = 'wood') {   // starting menu → New Company → name, material → Open for business
  if (!await page.isVisible('#coInput')) await page.click('[data-act=tpage][data-v=new]');
  await page.fill('#coInput', name);
  await page.click(`.pick[data-p=${pick}]`);
  await page.click('#tgo');
  if (await page.evaluate(() => UI.confirm === 'tnew')) await page.click('#tgo');   // replacing a saved company asks twice
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

// in-page: a rough player. It follows the goals like a new player would, otherwise builds or upgrades whatever earns the
// most per dollar, and once the HQ is full swaps its weakest building for a far better one. One decision every 2 game seconds.
const BOT = () => {
  const cash = S.cash - Math.max(1000, netWorth() * .03);   // keeps a little cash back so "buy missing inputs" never starves
  const free = () => { for (let i = 0; i < S.lots.length; i++) if (!S.lots[i] && lotUnlocked(i)) return i; return -1; };
  const act = activeProducts(), roomFor = p => act.has(p) || act.size < MAX_ACTIVE_PRODUCTS;
  const canGet = p => S.unlocked[p] || /^$|^Not enough cash$/.test(canUnlock(p));
  // profit per minute of one Lv1 building, paying the market's buy price for inputs we don't make ourselves
  const gain = p => { const P = PRODUCTS[p]; let v = P.out * price(p); for (const q in P.rec) v -= P.rec[q] * (act.has(q) ? price(q) : buyPrice(q)); return v * 60 / P.sec * lotMult() - UPKEEP[tierOf(p)]; };
  const ratio = p => gain(p) / buildCost(p), best = (list, f = ratio) => list.sort((a, b) => f(b) - f(a))[0];
  const cost = p => buildCost(p) + (S.unlocked[p] ? 0 : researchCost(p));
  const get = p => {   // unlock it (saving up if needed), then build it
    if (!S.unlocked[p]) return cash >= researchCost(p) + buildCost(p) ? unlock(p) || 'unlock ' + p : '';
    return free() >= 0 && cash >= buildCost(p) ? build(free(), p) || 'build ' + p : '';
  };
  // buy missing inputs only while that still pays (buying pushes the input's price up, so a big line can price itself out)
  const buyPays = p => { const P = PRODUCTS[p]; let v = P.out * price(p); for (const q in P.rec) v -= P.rec[q] * buyPrice(q); return v > 0; };
  for (const l of S.lots) if (l && l.b !== 'hq' && !PRODUCTS[l.b].raw) l.autoBuy = buyPays(l.b);
  // goals that ask for something new: a stock, a home, a new product, a factory, a Level 2, 3 or 4 product
  const G = S.goal, ring = { 3: 0, 4: 1, 8: 2, 12: 3, 14: 4 }[G];
  if (G === 7 && cash >= 1000) return buyAsset('MB10', 500) || 'stock';
  if (G === 9) { const k = S.props.findIndex((_, k) => canBuyProp(k) === ''); if (k >= 0 && cash >= propBuyPrice(k) + 1000) return buyProp(k) || 'home'; }
  if (capUsed() >= capMax()) {   // out of slots: a bigger HQ, or swap the weakest building for a far better product if it pays back within 30 min
    if (S.hqLv < HQ_COST.length && cash >= hqUpgradeCost()) return upgradeHQ() || 'hq';
    const feeds = p => consumersOf(p).some(c => act.has(c));   // never pull down a building that supplies another
    let wi = -1; S.lots.forEach((l, i) => { if (l && l.b !== 'hq' && !feeds(l.b) && (wi < 0 || gain(l.b) < gain(S.lots[wi].b))) wi = i; });
    if (wi < 0) return '';
    const w = S.lots[wi], last = S.lots.filter(l => l && l.b === w.b).length === 1;
    const ownInputs = p => Object.keys(PRODUCTS[p].rec).every(q => act.has(q) && q !== w.b);   // swap in only what it can supply itself
    const top = best(PIDS.filter(p => p !== w.b && canGet(p) && ownInputs(p) && (roomFor(p) || last)), gain), lift = top ? gain(top) - gain(w.b) * w.lv : 0;
    if (top && gain(top) > 3 * gain(w.b) && lift > 0 && cash >= cost(top) && cost(top) / lift < 30) {
      if (!S.unlocked[top]) return unlock(top) || 'unlock ' + top;
      demolish(wi); return build(wi, top) || `swap ${w.b} for ${top}`;
    }
    return '';
  }
  if (ring === 0) { const p = best(PIDS.filter(p => !S.unlocked[p] && canGet(p))); if (p) return get(p); }
  if (ring) {
    const want = PIDS.filter(p => PRODUCTS[p].ring === ring && !PRODUCTS[p].raw && canGet(p)), p = best(want.filter(roomFor));
    if (p) return get(p);
    const q = best(want), w = best([...act], p => -gain(p));   // product limit full: clear out the weakest product to make room
    if (q && w && cash >= cost(q)) { S.lots.forEach((l, i) => { if (l && l.b === w) demolish(i); }); return 'clear ' + w; }
    if (q) return '';
  }
  // a much better product within reach: save up for it
  const have = PIDS.filter(p => S.unlocked[p]), next = best(PIDS.filter(p => !S.unlocked[p] && canGet(p) && roomFor(p)));
  if (next && ratio(next) > 1.3 * Math.max(...have.map(ratio))) return get(next);
  // build the best product we can afford, or upgrade the best building (each level adds one more building's worth)
  const lot = free(), opts = have.filter(p => roomFor(p) && cash >= buildCost(p)).sort((a, b) => ratio(b) - ratio(a));
  let up = -1, ub = 0;
  S.lots.forEach((l, i) => { if (l && l.b !== 'hq' && l.lv < MAX_BLD_LV) { const g = gain(l.b) / upgradeCost(l); if (g > ub) { ub = g; up = i; } } });
  if (lot >= 0 && opts.length && (up < 0 || ratio(opts[0]) >= ub || S.cash < upgradeCost(S.lots[up]))) return build(lot, opts[0]) || 'build ' + opts[0];
  if (up >= 0 && cash >= upgradeCost(S.lots[up])) return upgrade(up) || 'upgrade';
  if (whUsed() > whMax() * .8 && S.whLv < WH_COST.length && cash >= whUpgradeCost() * 3) return upgradeWH() || 'warehouse';
  return '';
};

// the bot plays MINUTES game minutes on the company that's loaded, checking the economy every game minute
async function playBot(page) {
  const levelAt = {}, broken = []; let million = 0;
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
    if (!million && r.nw >= 1e6) million = m;
    if (m % 10 === 0 || m === MINUTES) console.log(`    min ${String(m).padStart(3)}  Lv ${r.lv}  cash $${Math.round(r.cash).toLocaleString()}  net worth $${Math.round(r.nw).toLocaleString()}  ${r.bld} buildings (${r.cap} slots)  $${Math.round(r.ppm).toLocaleString()}/min  rank #${r.rank}  goal ${r.goal}`);
    if (m % 10 === 0 && process.argv.includes('--verbose')) console.log(`             levels per product: ${r.mix}${r.stalled ? '  stalled: ' + r.stalled : ''}`);
  }
  check(!broken.length, 'economy stays sane every game minute' + (broken.length ? ': ' + broken.slice(0, 5).join(' | ') : ''));
  const got = Object.entries(levelAt).filter(([L]) => L > 1).map(([L, m]) => `Level ${L} at about minute ${m}`);
  console.log('    ' + (got.length ? 'reached ' + got.join(', ') : 'stayed at Level 1') + (million ? `; net worth passed $1M at about minute ${million}` : ''));
}

let URL;
(async () => {
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(PAGE).pipe(r); }).listen(0);
  URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  if (process.argv.includes('--bot-only')) {
    console.log(`Bot only: ${MINUTES} game minutes on ${PAGE}`);
    const { page } = await open(browser, 'bot', { viewport: { width: 1280, height: 720 } });
    // start at a random moment in the world's first month: the world is the same for everyone, so games started at the
    // same moment play out the same way, and pacing needs different stretches of market and news
    const start = await page.evaluate(() => { WT = worldNow() + Math.floor(Math.random() * 30 * 86400); worldReset(); newGame('Bot Co', 'wood'); S.tut = TUT_DONE; running = false; return new Date((WT + WORLD.epoch) * 1000).toISOString().slice(0, 16); });
    console.log(`    world time ${start} UTC`);
    await playBot(page);
    await browser.close(); server.close();
    console.log(problems.length ? `\n${problems.length} problem(s):\n - ` + problems.join('\n - ') : '\nAll good.');
    process.exit(problems.length ? 1 : 0);
  }

  /* ---------------- 0. the splash and the starting menu ---------------- */
  console.log('Splash and starting menu');
  let { ctx, page } = await open(browser, 'title', { viewport: { width: 1280, height: 720 } }, true);
  check(await page.isVisible('#splash') && await page.evaluate(() => $('#splashArt').width > 100), 'the Inspirapixel logo shows first');
  await page.waitForSelector('#splashTap.on', { timeout: 5000 });
  check(/anywhere to start/.test(await page.textContent('#splashTap')), `then "${await page.textContent('#splashTap')}"`);
  await shot(page, '00-splash');
  await page.mouse.click(640, 360);
  await page.waitForSelector('#splash', { state: 'detached', timeout: 4000 }).catch(() => {});
  check(!await page.$('#splash') && await page.isVisible('#tbox .tbtn'), 'a click takes it to the starting menu');
  check(await page.evaluate(() => AUD.playing && !!AUD.ctx), 'and switches the sound on (the menu music starts)');
  check(await page.isVisible('[data-act=continue]') === false, 'a fresh browser shows no Continue button');
  await shot(page, '01-start');
  const strip = await page.evaluate(() => ({ text: $('#tmarket').textContent, mb: money(WS.assets.MB10.p), px: money(WS.assets.PXC.p) }));
  check(strip.text.includes(strip.mb) && strip.text.includes(strip.px), `the live market shows the shared prices (MB10 ${strip.mb}, PixCoin ${strip.px})`);
  await page.click('[data-act=tpage][data-v=help]');
  await page.click('[data-act=helppg][data-v="1"]');
  check(await page.evaluate(() => UI.helpPg === 1 && /better goods/.test($('.hpage h3').textContent)), 'How to Play turns its pages');
  await page.keyboard.press('Escape');
  check(await page.isVisible('[data-act=tpage][data-v=settings]'), 'Esc goes back to the main menu');
  await page.click('[data-act=tpage][data-v=settings]');
  await page.click('[data-act=aset][data-k=musicOn][data-v="0"]');
  await page.goto(URL + '?nosplash', { waitUntil: 'load' });   // reopen (the splash would play again: skip it)
  await page.waitForSelector('#tbox .tbtn');
  check(await page.evaluate(() => AUD.set.musicOn === false), 'Settings: music off is remembered on this device');
  await page.click('[data-act=tpage][data-v=settings]');
  await page.click('[data-act=aset][data-k=musicOn][data-v="1"]');
  await page.click('[data-act=tpage][data-v=home]');
  check(await page.isVisible('[data-act=tpage][data-v=news] .tnew'), "What's New shows a NEW badge on a first visit");
  await page.click('[data-act=tpage][data-v=news]');
  check(await page.evaluate(() => $('.wn h3').textContent.startsWith(VERSION)), "What's New opens on this version's notes");
  await shot(page, '01b-whats-new');
  await page.click('[data-act=tpage][data-v=home]');
  check(!await page.isVisible('[data-act=tpage][data-v=news] .tnew'), 'and the badge goes once they are read');
  await ctx.close();

  /* ---------------- 1. desktop: tutorial, menus, every feature ---------------- */
  console.log('Desktop 1280x720');
  ({ ctx, page } = await open(browser, 'desktop', { viewport: { width: 1280, height: 720 } }));
  await page.click('[data-act=tpage][data-v=new]');
  await page.click('#tgo');
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
  const w0 = await page.evaluate(() => S.inv.wood || 0);
  await page.click('[data-act=buy][data-p=wood]');
  check(await page.evaluate(w0 => (S.inv.wood || 0) >= w0 + 10, w0), 'Market: Buy 10 adds 10');
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
  await page.keyboard.press('Escape');   // the HQ panel is open: Esc closes it first
  await page.keyboard.press('Escape');   // nothing open: Esc opens the Menu
  check(await page.evaluate(() => UI.modal === 'menu' && !UI.sel), 'Esc closes what is open, then opens the Menu');
  await shot(page, '07-menu');
  await page.click('[data-act=mtab][data-v=save]');
  await page.click('[data-act=copysave]');
  await page.evaluate(() => { UI.modalSig = ''; renderModal(); });   // anything that redraws the menu (a level-up, a sound toggle) must keep the code
  const code = await page.inputValue('#loadBox');
  check(code.length > 100, 'Menu: export fills in a save code, and it stays when the menu redraws');
  await page.evaluate(() => { S.cash = 1; });
  await page.click('[data-act=loadsave]');
  check(await page.evaluate(() => S.cash > 1 && S.company === 'Playtest Lumber'), 'Menu: importing the save code restores the company');
  // Main Menu: back to the starting menu, which offers Continue with this company; Continue picks it up again
  const bld0 = await page.evaluate(() => countBuildings());
  await page.click('[data-act=menu]');
  await page.click('[data-act=mainmenu]');
  await page.waitForSelector('[data-act=continue]');
  check(/Playtest Lumber/.test(await page.textContent('[data-act=continue]')), 'Main Menu goes to the starting menu, with Continue for this company');
  await page.click('[data-act=continue]');
  await page.waitForSelector('#app:not([hidden])');
  check(await page.evaluate(b => S.company === 'Playtest Lumber' && countBuildings() === b && running, bld0), 'Continue picks the company up where it was');
  // starting a new company over a saved one asks first
  await page.evaluate(() => { saveLocal(); running = false; showTitle('new'); });
  await page.fill('#coInput', 'Second Co');
  await page.click('#tgo');
  check(/replace Playtest Lumber/.test(await page.textContent('#tgo')) && await page.isVisible('#start'), 'a new company over a saved one asks before replacing it');
  await page.click('[data-act=tpage][data-v=home]');
  await page.click('[data-act=continue]');
  await page.waitForSelector('#app:not([hidden])');

  // buttons you can't afford are grey from the first frame a panel or window is drawn, without flashing their colour first
  const flash = await page.evaluate(() => new Promise(done => {
    const cash = S.cash; S.cash = 50; closeModal();
    const lot = S.lots.findIndex((l, i) => !l && lotUnlocked(i)), grey = getComputedStyle(document.documentElement).getPropertyValue('--glaze-3').trim();
    const hex = c => '#' + c.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    selectLot(lot);
    requestAnimationFrame(() => {
      const side = hex(getComputedStyle(document.querySelector('#side [data-act=build]')).backgroundColor);
      UI.investTab = 'stocks'; openModal('stocks');
      requestAnimationFrame(() => {
        const win = hex(getComputedStyle(document.querySelector('#mBody [data-act=stbuy][data-v="10000"]')).backgroundColor);
        closeModal(); selectLot(-1); S.cash = cash; done({ side, win, grey });
      });
    });
  }));
  check(flash.side === flash.grey && flash.win === flash.grey, `buttons you can't afford are grey from the first frame, no flash (panel ${flash.side}, window ${flash.win})`);

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
  await playBot(page);
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

  /* ---------------- 4. Gold Hill ---------------- */
  console.log('Gold Hill (Level 4)');
  ({ ctx, page } = await open(browser, 'goldhill', { viewport: { width: 1280, height: 720 } }));
  await newCompany(page, 'Hilltop Holdings', 'ore');
  await page.click('[data-act=tutdone]');
  const GH = 36;   // the first Gold Hill lot
  await tapLot(page, GH);
  check(/Gold Hill/.test(await page.textContent('#side')) && /Level 4/.test(await page.textContent('#side')), 'before Level 4, a Gold Hill lot says when it opens');
  await page.evaluate(() => { selectLot(-1); S.cash = 1.2e6; S.level = 3; for (const q of ['planks', 'chair', 'charcoal', 'iron', 'sofa', 'steel']) S.unlocked[q] = true; });
  await play(page, 2);
  check(await page.evaluate(() => S.level === 4), 'a $1M company reaches Level 4');
  const banner = await page.waitForSelector('.toast.big', { timeout: 3000 }).then(e => e.textContent()).catch(() => '');
  check(/Gold Hill/.test(banner), `the Level 4 banner names Gold Hill (${banner || 'no banner'})`);
  await sleep(1500);
  check(await page.evaluate(() => CAM.y + CAM.vh / 2 - TY > HILL.y), 'the camera goes to Gold Hill');
  await shot(page, '13-gold-hill-opens');
  await page.keyboard.press('p');
  await page.click('[data-act=webnode][data-p=piano]');
  await page.click('[data-act=unlock][data-p=piano]');
  check(await page.evaluate(() => !!S.unlocked.piano), 'Production: unlocking the Grand Piano');
  await shot(page, '14-production-gold-hill');
  await page.keyboard.press('Escape');
  await tapLot(page, GH);
  await page.click('#side [data-act=build][data-p=piano]');
  check(await page.evaluate(i => S.lots[i] && S.lots[i].b === 'piano', GH), 'building a Piano Workshop on Gold Hill');
  await page.check('#side [data-act=autobuy]');
  // two minutes in a quiet stretch of world time: a live boom on Furniture Sets or Steel can (rightly) make a line that buys
  // them lose money for a few minutes, and this check shouldn't depend on today's headlines
  const piano = await page.evaluate(() => {
    const touches = e => e.mult && ['piano', 'sofa', 'steel'].some(p => e.mult[p]);
    let t = Math.floor(worldNow()); while (eventsBetween(t - 300, t + 180).some(touches)) t += 60;
    WT = t; worldReset();
    const c0 = S.cash; for (let k = 0; k < 600; k++) step(.2);
    const r = { sold: S.market.piano.sat > 0, made: S.cash - c0 };
    WT = worldNow(); worldReset(); return r;
  });
  check(piano.sold, 'it buys its Furniture Sets and Steel and sells pianos');
  check(piano.made > 0, `and makes money doing it (+$${Math.round(piano.made).toLocaleString()} in 2 min)`);
  await page.evaluate(() => { S.cash += propBuyPrice(PLOTS.findIndex(p => p.t === 'villa')) * 1.1; });   // home prices follow the shared housing market
  await tapLot(page, await page.evaluate(() => 100 + PLOTS.findIndex(p => p.t === 'villa')));
  await page.click('#side [data-act=pbuy]');
  check(await page.evaluate(() => S.props[PLOTS.findIndex(p => p.t === 'villa')].own), 'buying a Hilltop Villa');
  await page.evaluate(() => { selectLot(-1); const [x, y] = zoneCenter(3); centerOn(TX + x, TY + y); });
  await sleep(2000);
  check(await page.evaluate(() => AUD.want === 3), 'Gold Hill plays its own tune');
  await shot(page, '15-gold-hill-built');
  await ctx.close();

  /* ---------------- 5. an old v0.03 save ---------------- */
  console.log('A v0.03 save');
  ({ ctx, page } = await open(browser, 'oldsave', { viewport: { width: 1280, height: 720 } }));
  const OLD = fs.readFileSync(path.join(__dirname, 'fixtures', 'v0.03-save.txt'), 'utf8').trim();
  const was = await page.evaluate(code => { const o = decodeSave(code); localStorage.setItem(SAVE_KEY, JSON.stringify(o)); return { company: o.company, level: o.level, lots: o.lots.length, bld: o.lots.filter(l => l && l.b !== 'hq').length, goal: o.goal, cash: o.cash }; }, OLD);
  await page.reload({ waitUntil: 'load' });
  await page.click('[data-act=continue]');
  await page.waitForSelector('#app:not([hidden])');
  const is = await page.evaluate(() => ({ company: S.company, level: S.level, lots: S.lots.length, bld: countBuildings(), goal: S.goal, v: S.v, goalText: GOALS[S.goal].text }));
  check(is.company === was.company && is.level === was.level && is.bld === was.bld, `Continue brings back the v0.03 company whole (${is.company}, Level ${is.level}, ${is.bld} buildings)`);
  check(was.lots === 36 && is.lots === 48 && is.v === 3, 'it gets the 12 Gold Hill lots');
  check(was.goal === 14 && /1,000,000/.test(is.goalText), 'a save that was past "top 5" moves on to the Gold Hill goals first');
  const oldBad = await page.evaluate(inv => { const I = eval('(' + inv + ')'); for (let k = 0; k < 1500; k++) step(.2); return I(); }, INVARIANTS.toString());
  check(!oldBad.length, 'and plays on for 5 game minutes' + (oldBad.length ? ': ' + oldBad.join(', ') : ''));
  await shot(page, '16-old-save');
  const allDone = await page.evaluate(code => { const o = decodeSave(code); o.goal = 15; return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }, OLD);
  await page.click('[data-act=menu]');
  await page.click('[data-act=mtab][data-v=save]');
  await page.fill('#loadBox', allDone);
  await page.click('[data-act=loadsave]');
  check(await page.evaluate(() => S.goal === 13 && S.v === 3), 'a v0.03 save with every goal done picks up the two new Gold Hill goals');
  await ctx.close();

  console.log('A v0.04 save');
  ({ ctx, page } = await open(browser, 'oldsave4', { viewport: { width: 1280, height: 720 } }));
  const OLD4 = fs.readFileSync(path.join(__dirname, 'fixtures', 'v0.04-save.txt'), 'utf8').trim();
  const was4 = await page.evaluate(code => { const o = decodeSave(code); localStorage.setItem(SAVE_KEY, JSON.stringify(o)); return { company: o.company, bld: o.lots.filter(l => l && l.b !== 'hq').length, size: code.length }; }, OLD4);
  await page.reload({ waitUntil: 'load' });
  await page.click('[data-act=continue]');
  await page.waitForSelector('#app:not([hidden])');
  const is4 = await page.evaluate(() => ({ company: S.company, bld: countBuildings(), v: S.v, size: encodeSave().length, keys: Object.keys(JSON.parse(serialize())) }));
  check(is4.company === was4.company && is4.bld === was4.bld && is4.v === 3, `Continue brings back the v0.04 company whole (${is4.company}, ${is4.bld} buildings)`);
  check(!is4.keys.some(k => ['assets', 'house', 'rivals', 'events'].includes(k)), `saves keep only the company now (save code ${Math.round(was4.size / 1000)}k -> ${Math.round(is4.size / 1000)}k characters)`);
  await ctx.close();

  /* ---------------- 6. one shared world ---------------- */
  console.log('One shared world');
  const A = await open(browser, 'worldA', { viewport: { width: 1280, height: 720 } }), B = await open(browser, 'worldB', { viewport: { width: 1280, height: 720 } });
  const snap = (pg, t) => pg.evaluate(t => JSON.stringify(worldSnapshot(t)), t);
  const moments = [await A.page.evaluate(() => Math.floor(worldNow())), 1e6 + 17, 9e6 + 123, 4e7 + 5];   // now, and days, months and a year from launch
  let same = true;
  for (const t of moments) if (await snap(A.page, t) !== await snap(B.page, t)) same = false;
  check(same, 'two separate browsers work out the same prices, news, rivals and goods swings, now and months from now');
  // a live game in A, a fresh page in B: the same second, to the cent
  await newCompany(A.page, 'World Tester');
  await A.page.click('[data-act=tutdone]');
  await sleep(2500);
  const live = await A.page.evaluate(() => ({ t: WS.sec, p: Object.fromEntries(ASSETS.map(a => [a.t, +S.assets[a.t].p.toFixed(2)])), house: +S.house.i.toFixed(5), rivals: S.rivals.map(r => Math.round(r.nw)), news: worldNews(1)[0] }));
  const fresh = JSON.parse(await snap(B.page, live.t));
  const priceDiff = Object.keys(live.p).filter(k => live.p[k] !== fresh.prices[k]);
  check(!priceDiff.length && live.house === fresh.house && JSON.stringify(live.rivals) === JSON.stringify(fresh.rivals), `a live game and a fresh page agree on every price, home prices and rivals (MB10 $${live.p.MB10}, PixCoin $${live.p.PXC})` + (priceDiff.length ? ': differ on ' + priceDiff.join(', ') : ''));
  check(!live.news || fresh.news.includes(live.news.text), `and on the news ("${live.news ? live.news.text : 'none yet'}")`);
  // the player's own trading moves only their own goods prices, never the shared world
  const untouched = await A.page.evaluate(() => JSON.stringify(worldSnapshot(WS.sec)));
  await A.page.evaluate(() => { S.inv.wood = 5000; manualSell('wood', 5000); S.cash += 1e6; buyAsset('PXC', 900000); });
  check(await A.page.evaluate(b => JSON.stringify(worldSnapshot(JSON.parse(b).t)) === b, untouched) && await A.page.evaluate(() => S.market.wood.sat > 0), 'a player dumping goods and buying PixCoin leaves the shared world untouched');
  const sec0 = await A.page.evaluate(() => WS.sec);
  await sleep(1500);
  check(await A.page.evaluate(s0 => WS.sec > s0 && worldNews(5).length > 0, sec0), 'the world runs on: prices tick every second and the news keeps coming');
  await A.ctx.close(); await B.ctx.close();
  // a device whose clock is 2 hours fast: same world (the server's clock wins), and no free offline earnings
  const skewed = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await skewed.addInitScript(() => { const real = Date.now; Date.now = () => real() + 2 * 3600e3; });
  const sp = await skewed.newPage();
  sp.on('pageerror', e => problems.push('[skewed] page error: ' + e.message));
  await sp.goto(URL + '?nosplash', { waitUntil: 'load' }); await sp.waitForSelector('#start .title');
  await sp.evaluate(() => clockReady);
  const drift = await sp.evaluate(() => worldNow() - (performance.timeOrigin + performance.now()) / 1000 + WORLD.epoch);
  check(Math.abs(drift) < 3, `a device with its clock 2 hours fast still runs on world time (off by ${drift.toFixed(1)} s)`);
  // a save stamped by the fast device clock, as a cheater's would be: reopening it on the world clock must not pay out
  await sp.evaluate(() => { newGame('Clock Cheat Co', 'wood'); S.tut = TUT_DONE; build(17, 'wood'); const o = JSON.parse(serialize()); o.savedAt = Date.now() - 60e3; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); });
  await sp.reload({ waitUntil: 'load' }); await sp.click('[data-act=continue]'); await sp.waitForSelector('#app:not([hidden])');
  await sleep(3000);
  const awayToast = await sp.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  check(!/While you were away/.test(awayToast), `moving the device clock doesn't count as time away (${awayToast || 'no offline toast'})`);
  await skewed.close();
  // offline earnings use plain prices: a boom running when you come back doesn't multiply the whole time away
  ({ ctx, page } = await open(browser, 'offline', { viewport: { width: 1280, height: 720 } }));
  const off = await page.evaluate(() => {
    newGame('Away Co', 'wood'); S.tut = TUT_DONE; running = false; S.cash = 1e5; for (let i = 0; i < 6; i++) build(12 + i, 'wood');
    const base = JSON.stringify(S), run = boom => { S = JSON.parse(base); attachWorld(); WS.mult = boom ? { wood: 1.7 } : {}; return offlineCatchUp(3600).earned; };
    return [run(false), run(true)];
  });
  check(Math.abs(off[0] - off[1]) < 1, `an hour away pays the same with or without a boom on ($${Math.round(off[0])} both times)`);
  await ctx.close();
  // left open but untouched, the game runs like it's closed: 25% after 10 minutes idle, then waits after 2 hours more
  ({ ctx, page } = await open(browser, 'idle', { viewport: { width: 1280, height: 720 } }));
  await newCompany(page, 'Idle Co');
  await page.click('[data-act=tutdone]');
  const rates = await page.evaluate(async () => {
    const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))), out = [];
    for (const idleMin of [5, 11, 150]) { lastInput = nowMs() - idleMin * 60e3; await frames(); out.push(AWAY_RATE); }
    return out;
  });
  check(rates.join() === '1,0.25,0', `left untouched: full speed at 5 min, 25% at 11 min, waiting at 2½ hours (${rates.join(', ')})`);
  await page.mouse.move(300, 300); await page.mouse.move(320, 310);
  const back = await page.waitForSelector('.toast >> text=/idle for/', { timeout: 2000 }).then(e => e.textContent()).catch(() => '');
  check(await page.evaluate(() => AWAY_RATE === 1) && /idle for/.test(back), `moving the mouse brings it back to full speed and says so (${back || 'no message'})`);
  await ctx.close();

  /* ---------------- 7. other screens ---------------- */
  console.log('Phone on its side 844x390 (touch)');
  ({ ctx, page } = await open(browser, 'phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }));
  check(await page.evaluate(() => [...document.querySelectorAll('#tbox .tbtn, #tmarket')].every(e => e.getBoundingClientRect().bottom <= innerHeight)), 'the starting menu fits on screen');
  await shot(page, '09-phone-title');
  await page.click('[data-act=tpage][data-v=new]');
  const btn = await page.locator('#tgo').boundingBox();
  check(btn && btn.y + btn.height <= 390, 'Open for business fits on screen without scrolling');
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
  await page.evaluate(() => { UI.sel = null; setSheet(false); closeModal(); });
  await tapLot(page, 36, true);
  check(/Gold Hill/.test(await page.textContent('#side')), 'dragging down to Gold Hill and tapping a lot works on a phone');
  await sleep(300);
  await shot(page, '17-phone-gold-hill');
  check(await page.textContent('#mTitle') === 'Invest', 'nav button opens Invest');
  await shot(page, '11-phone-invest');
  await ctx.close();

  console.log('Phone upright 390x844');
  ({ ctx, page } = await open(browser, 'portrait', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
  check(await page.isVisible('#rotate'), 'asks you to turn the phone sideways');
  await ctx.close();

  console.log('Short laptop window 880x456');
  ({ ctx, page } = await open(browser, 'short', { viewport: { width: 880, height: 456 } }));
  await page.click('[data-act=tpage][data-v=new]');
  const b2 = await page.locator('#tgo').boundingBox();
  check(b2 && b2.y + b2.height <= 456, 'Open for business fits on screen without scrolling');
  await newCompany(page, 'Short Screen Co');
  await shot(page, '12-short-window');
  await ctx.close();

  await browser.close(); server.close();
  console.log(problems.length ? `\n${problems.length} problem(s):\n - ` + problems.join('\n - ') : '\nAll good.');
  console.log('Screenshots: ' + SHOTS);
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
