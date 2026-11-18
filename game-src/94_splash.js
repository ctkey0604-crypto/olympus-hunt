// Inspirapixel splash: Connor's dev logo flashes before the title screen. The wordmark is drawn from its own pixel
// glyphs; the two lowercase i's have no dots, and three loose gold pixels rain down into each dot's place.
// Any click, tap or key skips it.
(() => {
  const el = $('splash'), cv = $('splashArt');
  if (!el || !cv) return;
  // [top row, rows]: 9 rows in all, baseline under row 6, the p descends to row 8
  const GLYPH = {
    I: [0, ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###']],
    n: [2, ['#.##.', '##..#', '#...#', '#...#', '#...#']],
    s: [2, ['.####', '#....', '.###.', '....#', '####.']],
    p: [2, ['#.##.', '##..#', '#...#', '##..#', '#.##.', '#....', '#....']],
    i: [2, ['#', '#', '#', '#', '#']],
    r: [2, ['#.##', '##..', '#...', '#...', '#...']],
    a: [2, ['.###.', '....#', '.####', '#...#', '.####']],
    x: [2, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']],
    e: [2, ['.###.', '#...#', '#####', '#....', '.###.']],
    l: [0, ['#', '#', '#', '#', '#', '#', '#']],
  };
  const PAD = 4, ROWS = PAD + 9;                     // empty rows above the word for the dot pixels to fall through
  const glyphs = [], dots = [];
  let x = 0;
  for (const ch of 'Inspirapixel') {
    const [top, rows] = GLYPH[ch];
    glyphs.push({ x, top, rows });
    if (ch === 'i') dots.push(x);
    x += rows[0].length + 1;
  }
  const W = x - 1;
  let s = Math.max(2, Math.min(12, Math.floor(Math.min(innerWidth * 0.72 / W, innerHeight * 0.3 / ROWS))));
  s -= s % 2;                                        // the dot pixels are half a letter pixel, so keep s even
  const h = s / 2;
  cv.width = W * s; cv.height = ROWS * s;
  const c = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  // Each i's dot: three loose gold pixels (half size), a different spread on each i. a gold, b deep gold, c pale gold.
  const DOT = [['..c.', 'a...', '.a..'], ['.a..', '...c', '..b.']];
  const GOLD = { a: '#ebc152', b: '#c98f2a', c: '#fbe3a0' };
  const bits = [];
  dots.forEach((dx, di) => DOT[di].forEach((row, ry) => [...row].forEach((ch, cx) => {
    if (ch !== '.') bits.push({ di, col: GOLD[ch], x: dx * s + (cx - 1) * h, y: PAD * s + (ry - 1) * h, r: Math.random(), seed: Math.random() });
  })));

  function draw(t) {
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#f0e4cc';
    glyphs.forEach((g, i) => {
      c.globalAlpha = still ? 1 : clamp((t - 250 - i * 55) / 160);
      g.rows.forEach((r, y) => { for (let k = 0; k < r.length; k++) if (r[k] === '#') c.fillRect((g.x + k) * s, (PAD + g.top + y) * s, s, s); });
    });
    c.globalAlpha = 1;
    for (const b of bits) {                          // pixel rain: each one drops in on its own, in a random order
      const p = still ? 1 : clamp((t - 950 - b.di * 250 - b.r * 450) / 320);
      if (p <= 0) continue;
      const y0 = -2 * h, twinkle = !still && t > 1900 && ((t / 110 + b.seed * 40) | 0) % 7 === 0;
      c.fillStyle = twinkle ? '#fff8e0' : b.col;
      c.fillRect(b.x, Math.round(y0 + (b.y - y0) * p * p), h, h);
    }
  }

  let done = false, t0 = 0;
  const finish = () => {
    if (done) return; done = true;
    el.classList.add('out');
    for (const t of EVS) removeEventListener(t, skip, true);
    setTimeout(() => el.remove(), 480);              // keeps catching taps while it fades, so none land on the menu
  };
  const EVS = ['keydown', 'pointerdown', 'touchstart'];
  const skip = e => { e.stopPropagation(); if (e.type === 'keydown') e.preventDefault(); finish(); };
  for (const t of EVS) addEventListener(t, skip, true);

  const HOLD = still ? 1500 : 3100;
  const frame = now => {
    if (done) return;
    if (!t0) t0 = now;
    const t = now - t0;
    draw(t);
    if (t >= HOLD) finish(); else requestAnimationFrame(frame);
  };
  draw(0);
  requestAnimationFrame(frame);
})();
