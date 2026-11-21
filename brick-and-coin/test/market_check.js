#!/usr/bin/env node
/* Brick & Coin market check: is the shared world's market lively but not a money machine?

     node brick-and-coin/test/market_check.js [--page FILE] [--days 30]

   Works out 30 days of the shared world (from day 60 after launch) and prints:
   - how much each asset moves (1-hour and 1-minute swings, lowest and highest price), home prices, news per hour;
   - what simply holding pays on average, bought at random times (prices wander around fair values, so the ups outweigh
     the downs a little: this is what parking cash while away earns, before fees);
   - what "buy right after a crash headline, sell later" pays after fees (quick flips must not beat the fees).
   v0.05 targets: holding pays ~1-5% a day (index lowest, PixCoin and Nova highest), quick flips lose to fees,
   home flips lose to the 8% fees, about 45 headlines an hour. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PAGE = path.resolve(arg('--page', path.join(__dirname, '..', 'public', 'index.html'))), DAYS = +arg('--days', 30);
if (!fs.existsSync(PAGE)) { console.error('No build found. Run: python3 brick-and-coin/build.py'); process.exit(1); }
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.goto('file://' + PAGE);
  console.log(await page.evaluate(D => {
    const T0 = 60 * 86400, evs = eventsBetween(T0 - EV_KEEP, T0 + (D + 2) * 86400), cache = new Map(), H = [1, 3, 6, 12, 24], out = [];
    const at = t => { t = Math.floor(t / 60) * 60; if (!cache.has(t)) cache.set(t, marketAt(t, evs)); return cache.get(t); };
    const px = (t, k) => k === 'house' ? at(t).house : at(t).p[k];
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length, sd = a => { const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };
    const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
    out.push(`Market over ${D} days`);
    for (const a of ASSETS) {
      const s = []; for (let t = T0; t < T0 + D * 86400; t += 60) s.push(px(t, a.t));
      const r1h = [], r1m = []; for (let i = 60; i < s.length; i++) r1h.push(Math.log(s[i] / s[i - 60])); for (let i = 1; i < s.length; i++) r1m.push(Math.log(s[i] / s[i - 1]));
      out.push(`  ${a.t.padEnd(5)} ${a.risk.padEnd(8)} 1-hour swing ${pct(sd(r1h)).padStart(6)}   1-minute ${pct(sd(r1m), 2).padStart(6)}   range ${Math.min(...s).toFixed(2)}-${Math.max(...s).toFixed(2)}`);
    }
    const hs = []; for (let t = T0; t < T0 + D * 86400; t += 3600) hs.push(px(t, 'house'));
    const hd = []; for (let i = 24; i < hs.length; i++) hd.push(Math.log(hs[i] / hs[i - 24]));
    out.push(`  homes: index ${Math.min(...hs).toFixed(2)}-${Math.max(...hs).toFixed(2)}, 1-day swing ${pct(sd(hd))}`);
    out.push(`  news: ${(evs.filter(e => e.text && e.t >= T0 && e.t < T0 + 86400).length / 24).toFixed(1)} headlines an hour`);
    out.push('Holding, bought at random times (before fees)');
    for (const a of ASSETS) { const row = H.map(h => { const r = []; for (let t = T0; t < T0 + D * 86400; t += 1800) r.push(px(t + h * 3600, a.t) / px(t, a.t) - 1); return `${h}h ${pct(avg(r)).padStart(6)}`; }); out.push(`  ${a.t.padEnd(5)} ` + row.join('  ')); }
    out.push('Buying right after a crash headline, selling later (after fees)');
    const res = {};
    for (const e of evs) {
      if (e.t < T0 || e.t > T0 + D * 86400 || e.kind !== 'down') continue;
      for (const [k] of e.jumps) {
        const key = k === 'PXC' ? 'PixCoin' : k === 'house' ? 'homes' : k === 'mkt' ? null : 'shares'; if (!key) continue;
        const fee = k === 'PXC' ? FEE.crypto * 2 : k === 'house' ? PROP_BUY_FEE + PROP_SELL_FEE : FEE.stock * 2, p0 = px(e.t + 60, k);
        for (const h of H) (res[key + h] = res[key + h] || []).push(px(e.t + 60 + h * 3600, k) / p0 - 1 - fee);
      }
    }
    for (const k of ['PixCoin', 'shares', 'homes']) if (res[k + 1]) out.push(`  ${k.padEnd(8)} ` + H.map(h => `${h}h ${pct(avg(res[k + h])).padStart(6)}`).join('  ') + `   (${res[k + 1].length} trades)`);
    return out.join('\n');
  }, DAYS));
  await browser.close();
})();
