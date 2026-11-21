#!/usr/bin/env node
/* Makes the website's images from the game's own art (run after build.py, and again if the coin icon or title screen changes):

     node brick-and-coin/tools/site_images.js

   public/favicon.svg               the coin icon, pixel for pixel
   public/apple-touch-icon.png      180 px, for iPhone home screens
   public/icon-192.png, icon-512.png           app icons (manifest.webmanifest)
   public/icon-maskable-512.png     Android's shaped icons: the coin sits inside the safe middle
   public/og.png                    1200x630 link preview: the title screen */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.join(PUB, 'index.html'));
  await page.waitForSelector('#start .title');
  // the coin, as an 18x18 grid of colours
  const grid = await page.evaluate(() => iconGrid('coin').map(row => row.map(ch => ch === '.' ? null : ch === 'k' ? K : PAL[ch])));
  let rects = '';
  grid.forEach((row, y) => { for (let x = 0; x < row.length;) { const c = row[x]; let w = 1; while (c && row[x + w] === c) w++; if (c) rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`; x += w; } });
  fs.writeFileSync(path.join(PUB, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" shape-rendering="crispEdges">${rects}</svg>\n`);
  // app icons: the coin on the game's dark background, scaled up in whole pixels
  const png = async (size, frac, name) => {
    const url = await page.evaluate(([size, frac, grid]) => {
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      x.fillStyle = '#130d0b'; x.fillRect(0, 0, size, size);
      const px = Math.floor(size * frac / 18), off = Math.floor((size - px * 18) / 2);
      grid.forEach((row, j) => row.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect(off + i * px, off + j * px, px, px); } }));
      return c.toDataURL('image/png');
    }, [size, frac, grid]);
    fs.writeFileSync(path.join(PUB, name), Buffer.from(url.split(',')[1], 'base64'));
  };
  await png(180, .78, 'apple-touch-icon.png');
  await png(192, .78, 'icon-192.png');
  await png(512, .78, 'icon-512.png');
  await png(512, .56, 'icon-maskable-512.png');
  // link preview: the title screen
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(PUB, 'og.png') });
  await browser.close();
  for (const f of ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og.png']) console.log(`  public/${f}: ${fs.statSync(path.join(PUB, f)).size.toLocaleString()} bytes`);
})();
