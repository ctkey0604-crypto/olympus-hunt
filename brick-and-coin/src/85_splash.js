'use strict';
/* ============================================================================
   INSPIRAPIXEL SPLASH (v0.06): the same logo as Olympus Hunt's, before the main menu.
   The wordmark is drawn from its own pixel glyphs; the two lowercase i's have no dots, and three loose gold pixels
   rain down into each dot's place, with a chime. Then "Click anywhere to start" (computers) or "Press anywhere to
   start" (phones) fades in under the logo, and the menu only shows once the player does. Browsers don't let a page
   make any sound before that first press, so it's also what switches sound on: if the chime couldn't play during
   the animation (it can't, on a first visit), it plays on the press instead, and the menu music starts after.
   SPLASH.done resolves when the splash has gone. Ported from Olympus Hunt's game-src/94_splash.js: only the
   sound calls are Brick & Coin's. Add ?nosplash to the address to skip it (automated tests, screenshots).
   ========================================================================== */
const SPLASH = (() => {
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  const el = $('#splash'), cv = $('#splashArt'), tap = $('#splashTap');
  if (!el || !cv || /[?&]nosplash\b/.test(location.search)) { if (el) el.remove(); resolveDone(); return { done }; }
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
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  // Each i's dot: three loose gold pixels (half size), a different spread on each i. a gold, b deep gold, c pale gold.
  const DOT = [['..c.', 'a...', '.a..'], ['.a..', '...c', '..b.']];
  const GOLD = { a: '#ebc152', b: '#c98f2a', c: '#fbe3a0' };
  const bits = [];
  dots.forEach((dx, di) => DOT[di].forEach((row, ry) => [...row].forEach((ch, cx) => {
    if (ch !== '.') bits.push({ di, col: GOLD[ch], x: dx * s + (cx - 1) * h, y: PAD * s + (ry - 1) * h, r: Math.random(), seed: Math.random() });
  })));
  const LANDED = 2000, CHIME_AT = 1400, PROMPT_AT = 2100;

  function draw(t) {
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#f0e4cc';
    glyphs.forEach((g, i) => {
      c.globalAlpha = still ? 1 : clamp01((t - 250 - i * 55) / 160);
      g.rows.forEach((r, y) => { for (let k = 0; k < r.length; k++) if (r[k] === '#') c.fillRect((g.x + k) * s, (PAD + g.top + y) * s, s, s); });
    });
    c.globalAlpha = 1;
    for (const b of bits) {                          // pixel rain: each one drops in on its own, in a random order
      const p = still ? 1 : clamp01((t - 950 - b.di * 250 - b.r * 450) / 320);
      if (p <= 0) continue;
      const y0 = -2 * h, twinkle = !still && t > LANDED && ((t / 110 + b.seed * 40) | 0) % 7 === 0;
      c.fillStyle = twinkle ? '#fff8e0' : b.col;
      c.fillRect(b.x, Math.round(y0 + (b.y - y0) * p * p), h, h);
    }
  }

  // A bright 8-bit sparkle up the scale, with a soft bell under it (the same notes as Olympus Hunt's).
  // tone() mirrors Olympus Hunt's Sound.tone: an oscillator that fades out, at its master volume (0.22).
  const tone = (freq, dur, type, vol, delay) => {
    const a = AUD.ctx, t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol * .22, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(AUD.out); o.start(t); o.stop(t + dur + .02);
  };
  let chimed = false;
  const chime = onPress => {                          // on the press the context is still waking up: the notes wait for it
    if (chimed || !AUD.ctx || !AUD.set.sfxOn || AUD.set.sfx <= 0 || (!onPress && AUD.ctx.state !== 'running')) return false;
    chimed = true;
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, .1, 'square', .05, i * .065));
    tone(1047, .9, 'triangle', .16, .26); tone(1568, .9, 'triangle', .1, .26);
    tone(2637, .5, 'sine', .05, .33);
    return true;
  };

  const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
  tap.textContent = coarse ? 'Press anywhere to start' : 'Click anywhere to start';
  let t0 = 0, skipped = false, ready = false, leaving = false, raf = 0;
  const leave = () => {
    if (leaving) return; leaving = true;
    audioUnlock();                                   // this press is what lets the browser play sound
    const wait = chime(true) ? 650 : 0;              // first sound of the visit: let the chime ring with the logo up
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {                             // keeps swallowing taps and keys until it's gone, so none hit the menu
        cancelAnimationFrame(raf); el.remove();
        for (const ev of EVS) removeEventListener(ev, onInput, true);
        resolveDone();
      }, 480);
    }, wait);
  };
  const EVS = ['keydown', 'pointerdown', 'touchstart'];
  const onInput = e => {
    e.stopPropagation(); if (e.type === 'keydown') e.preventDefault();
    if (leaving || e.repeat) return;
    if (ready) leave(); else skipped = true;        // a press mid-animation jumps to the finished logo and its prompt
  };
  for (const ev of EVS) addEventListener(ev, onInput, true);

  const frame = now => {
    if (!t0) t0 = now;
    let t = now - t0;
    if (skipped && t < PROMPT_AT) { t0 -= PROMPT_AT - t; t = PROMPT_AT; }
    if (t >= CHIME_AT) chime();
    draw(t);
    if (!ready && (still || t >= PROMPT_AT)) { ready = true; tap.classList.add('on'); }
    raf = requestAnimationFrame(frame);             // keeps going so the gold pixels twinkle while it waits
  };
  draw(0);
  raf = requestAnimationFrame(frame);
  return { done };
})();
