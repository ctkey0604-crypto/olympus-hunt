'use strict';
/* ============================================================================
   AUDIO — every sound effect and all the music are synthesized here with
   WebAudio, so the game stays one self-contained page. Nothing plays until the
   first tap (browsers block autoplay), and it all pauses while the tab is hidden.
   ========================================================================== */
const AUDIO_DEFAULT = { music: .5, sfx: .7, musicOn: true, sfxOn: true };
const AUD = { ctx: null, out: null, mus: null, fx: null, set: { ...AUDIO_DEFAULT }, prev: null, waves: {}, noise: null,
  playing: false, timer: 0, song: -1, want: 1, cand: 1, candT: 0, bar: 0, step: 0, loop: 0, nextT: 0, last: {} };

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(n) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); return 12 * (+m[3] + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const nhz = n => hz(midi(n));

/* ---------- setup ---------- */
function pulseWave(c, d) {   // NES-style pulse with duty d (0.125, 0.25, 0.5)
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * d);
  return c.createPeriodicWave(re, im);
}
function audioUnlock() {
  if (!AUD.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let c; try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    AUD.ctx = c;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(c.destination);
    AUD.out = c.createGain(); AUD.out.gain.value = .9; AUD.out.connect(comp);
    AUD.mus = c.createGain(); AUD.mus.gain.value = 0; AUD.mus.connect(AUD.out);
    AUD.fx = c.createGain(); AUD.fx.gain.value = 0; AUD.fx.connect(AUD.out);
    for (const d of [.125, .25, .5]) AUD.waves[d] = pulseWave(c, d);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), ch = nb.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    AUD.noise = nb;
    AUD.timer = setInterval(musicTick, 50);
    audioLevels();
  }
  if (AUD.ctx.state === 'suspended' && !document.hidden) AUD.ctx.resume().catch(() => {});
}
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) document.addEventListener(ev, audioUnlock, true);
document.addEventListener('visibilitychange', () => {
  if (!AUD.ctx) return;
  if (document.hidden) AUD.ctx.suspend().catch(() => {}); else AUD.ctx.resume().catch(() => {});
});

/* ---------- volume ---------- */
const MUSIC_GAIN = .55, SFX_GAIN = 1.2;   // overall loudness at full volume; kept low so phones aren't annoying (check with test/audio_levels.py)
function musicLevel() { return AUD.playing && AUD.set.musicOn ? AUD.set.music * AUD.set.music * MUSIC_GAIN : 0; }
function sfxLevel() { return AUD.set.sfxOn ? AUD.set.sfx * AUD.set.sfx * SFX_GAIN : 0; }
function setParam(p, v, tc) { const t = AUD.ctx.currentTime; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); p.setTargetAtTime(v, t, tc); }
function audioLevels() { if (!AUD.ctx) return; setParam(AUD.mus.gain, musicLevel(), .25); setParam(AUD.fx.gain, sfxLevel(), .03); }
function applyAudioSettings(s) {
  const o = { ...AUDIO_DEFAULT };
  if (s) for (const k in o) if (typeof s[k] === typeof o[k]) o[k] = typeof o[k] === 'number' ? clamp(s[k], 0, 1) : s[k];
  AUD.set = o; audioLevels();
}
function soundOn() { return AUD.set.musicOn || AUD.set.sfxOn; }
function toggleAllSound() {
  if (soundOn()) { AUD.prev = { m: AUD.set.musicOn, s: AUD.set.sfxOn }; AUD.set.musicOn = AUD.set.sfxOn = false; }
  else { const p = AUD.prev || { m: true, s: true }; AUD.set.musicOn = p.m; AUD.set.sfxOn = p.s; }
  audioLevels();
}
function duckMusic(t, dur) {
  if (!AUD.playing || !AUD.set.musicOn) return;
  const g = AUD.mus.gain, v = musicLevel();
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
  g.setTargetAtTime(v * .25, t, .05); g.setTargetAtTime(v, t + dur, .4);
}

/* ---------- instruments ---------- */
function voice(t, f, dur, o = {}) {
  const c = AUD.ctx, osc = c.createOscillator(), g = c.createGain();
  if (o.duty) osc.setPeriodicWave(AUD.waves[o.duty]); else osc.type = o.type || 'triangle';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
  const a = o.a != null ? o.a : .004, v = o.v != null ? o.v : .2, rel = o.rel != null ? o.rel : .05, sus = o.sus != null ? o.sus : .8;
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(v * sus, .0001), t + Math.max(a + .002, dur));
  g.gain.linearRampToValueAtTime(0, t + dur + rel);
  let head = osc;
  if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; osc.connect(f2); head = f2; }
  head.connect(g); g.connect(o.dest || AUD.fx);
  if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t + .1); l.stop(t + dur + rel + .05); }
  osc.start(t); osc.stop(t + dur + rel + .05);
}
function noise(t, dur, o = {}) {
  const c = AUD.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AUD.noise; s.loop = true;
  f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 6000, t); if (o.q) f.Q.value = o.q;
  if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
  const v = o.v != null ? o.v : .1;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(o.dest || AUD.fx);
  s.start(t, Math.random() * .9); s.stop(t + dur + .05);
}
function kick(t, v, dest) { voice(t, 150, .13, { type: 'sine', to: 45, glide: .11, v, a: .002, sus: .05, rel: .03, dest }); }

/* ---------- sound effects: short and retro ---------- */
const SFX = {
  tap(t) { voice(t, 1320, .025, { duty: .25, v: .1, sus: .3, rel: .02 }); },
  select(t) { voice(t, 660, .03, { duty: .5, v: .07, rel: .02 }); voice(t + .035, 990, .04, { duty: .5, v: .06, rel: .03 }); },
  build(t) {
    noise(t, .09, { type: 'lowpass', f: 900, v: .22 }); voice(t, 110, .08, { duty: .5, v: .12, to: 70 });
    noise(t + .11, .08, { type: 'lowpass', f: 1100, v: .18 }); voice(t + .11, 131, .07, { duty: .5, v: .1, to: 80 });
    ['C5', 'E5', 'G5', 'C6'].forEach((n, k) => voice(t + .24 + k * .055, nhz(n), .06, { duty: .25, v: .1, rel: .05 }));
  },
  upgrade(t) {
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, k) => voice(t + k * .05, nhz(n), .055, { duty: .125, v: .1 }));
    voice(t + .26, nhz('G6'), .25, { duty: .25, v: .06, sus: .2, vib: .01, rel: .15 }); noise(t + .26, .25, { f: 9000, v: .035 });
  },
  cash(t) { const k = [0, 2, 4][Math.floor(Math.random() * 3)]; voice(t, hz(83 + k), .045, { duty: .5, v: .045 }); voice(t + .05, hz(88 + k), .11, { duty: .5, v: .045, sus: .3, rel: .08 }); },
  buy(t) { noise(t, .05, { f: 5000, v: .07 }); voice(t, nhz('G5'), .05, { duty: .25, v: .09 }); voice(t + .06, nhz('D5'), .09, { duty: .25, v: .09, sus: .4 }); },
  sell(t) { noise(t, .04, { type: 'bandpass', f: 3000, q: 2, v: .18 }); voice(t + .05, nhz('E6'), .06, { duty: .5, v: .07 }); voice(t + .11, nhz('A6'), .2, { duty: .5, v: .07, sus: .25, rel: .12 }); },
  unlock(t) {
    ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'].forEach((n, k) => voice(t + k * .035, nhz(n), .05, { type: 'triangle', v: .12 }));
    voice(t + .3, nhz('G6'), .3, { type: 'triangle', v: .08, sus: .2, vib: .015 });
  },
  goal(t) {
    duckMusic(t, 1.1);
    [['G5', 0], ['C6', .09], ['E6', .18]].forEach(([n, d]) => voice(t + d, nhz(n), .08, { duty: .25, v: .1 }));
    ['C6', 'E6', 'G6'].forEach(n => voice(t + .3, nhz(n), .45, { duty: .5, v: .04, sus: .3, rel: .2, vib: .008 }));
  },
  level(t) {
    duckMusic(t, 2.4);
    [['C5', 0, .1], ['E5', .12, .1], ['G5', .24, .1], ['C6', .36, .22], ['A5', .62, .1], ['C6', .74, .1], ['E6', .86, .55]]
      .forEach(([n, d, l]) => voice(t + d, nhz(n), l, { duty: .25, v: .11, rel: .06, vib: l > .3 ? .01 : 0 }));
    [['C3', 0, .5], ['F3', .62, .2], ['C3', .86, .6]].forEach(([n, d, l]) => voice(t + d, nhz(n), l, { type: 'triangle', v: .3 }));
    ['C6', 'E6', 'G6', 'C7'].forEach((n, k) => voice(t + .86 + k * .06, nhz(n), .5, { duty: .125, v: .035, sus: .3, rel: .3 }));
    noise(t + .86, .6, { f: 8000, v: .045 });
  },
  error(t) { voice(t, 196, .08, { duty: .5, v: .09, lp: 1200 }); voice(t + .1, 147, .14, { duty: .5, v: .09, lp: 1200, sus: .5 }); },
  demolish(t) { noise(t, .45, { type: 'lowpass', f: 1600, sweep: 200, v: .28 }); voice(t, 90, .3, { duty: .5, v: .1, to: 40, lp: 600 }); },
  coach(t) { voice(t, nhz('E6'), .07, { type: 'triangle', v: .13 }); voice(t + .08, nhz('A6'), .14, { type: 'triangle', v: .11, sus: .3 }); },
};
const SFX_GAP = { cash: .45, tap: .04 };
function sfx(name) {
  const c = AUD.ctx;
  if (!c || c.state !== 'running' || !AUD.set.sfxOn || AUD.set.sfx <= 0 || !SFX[name]) return;
  const now = c.currentTime;
  if (now - (AUD.last[name] || -9) < (SFX_GAP[name] || .05)) return;
  AUD.last[name] = now;
  try { SFX[name](now + .005); } catch (e) {}
}

/* ---------- music: one looping chiptune per area of town ----------
   bars: one chord per bar. mel: 8th notes ("-" holds, "." rests). bass/arp/drums: 16 steps per bar.
   bass: R root, 3 third, 5 fifth, 8 octave. arp: index into the chord's notes. */
const SONGS = [
  { name: 'Market Row', bpm: 100, swing: .3, leadDuty: .25, leadLp: 3400, arpDuty: .25, bassLen: 3,
    bars: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'],
    mel: `C5 . F5 . A5 . G5 F5  D5 - . F5 A5 - . .  Bb4 . D5 . F5 . D5 Bb4  C5 - E5 - G5 - . .
          A5 . A5 G5 F5 . C5 .  D5 - F5 - A5 - G5 F5  G5 . Bb5 . A5 . G5 .  E5 - - - C5 . . .`,
    bass: 'R...5...8...5...', arp: '0.2.1.2.0.2.1.2.',
    drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' } },
  { name: 'Main Street', bpm: 84, swing: 0, leadDuty: .5, leadLp: 1900, arpDuty: .25, bassLen: 7,
    bars: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'],
    mel: `G4 - C5 - E5 - D5 C5  E5 - - - A4 - . .  A4 - C5 - F5 - E5 D5  D5 - - - . . G4 .
          G4 - C5 - E5 - G5 -  G5 - E5 - B4 - . .  A4 - C5 - F5 - A5 -  G5 - F5 - D5 - B4 -`,
    bass: 'R.......5.......', arp: '0.1.2.1.0.1.2.1.',
    drums: { k: 'x.......x.......', s: '................', h: '....x.......x...' } },
  { name: 'Industrial Park', bpm: 92, swing: 0, leadDuty: .125, leadLp: 2800, arpDuty: .125, bassLen: 1.6,
    bars: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E'],
    mel: `E5 - . E5 D5 - C5 -  A4 - - - . . C5 D5  E5 - . E5 F5 - E5 D5  D5 - - - B4 - . .
          E5 - . E5 G5 - E5 -  A5 - - - G5 - E5 -  F5 - E5 - D5 - C5 -  B4 - - - G#4 - . .`,
    bass: 'R.R.R.R.R.R.5.8.', arp: '0120012001200120',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' } },
];
function parseChord(s) {
  const m = /^([A-G])(#|b)?(m7|maj7|m|7|dim)?$/.exec(s), q = m[3] || '';
  const root = 48 + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root, iv: q === 'm' ? [0, 3, 7] : q === '7' ? [0, 4, 7, 10] : q === 'maj7' ? [0, 4, 7, 11] : q === 'm7' ? [0, 3, 7, 10] : q === 'dim' ? [0, 3, 6] : [0, 4, 7] };
}
for (const s of SONGS) { s.ch = s.bars.map(parseChord); s.mel = s.mel.trim().split(/\s+/); }

function playStep(sg, bar, st, t, dur) {
  const ch = sg.ch[bar], d = AUD.mus, T = t + (st % 4 === 2 ? sg.swing * dur : 0);
  const dr = sg.drums;
  if (dr.k[st] === 'x') kick(T, .3, d);
  if (dr.s[st] === 'x') { noise(T, .11, { type: 'bandpass', f: 1800, q: .7, v: .11, dest: d }); voice(T, 190, .05, { type: 'triangle', v: .08, to: 120, dest: d }); }
  if (dr.h[st] === 'x') noise(T, .03, { f: 7500, v: .045, dest: d });
  const b = sg.bass[st];
  if (b !== '.') { const iv = b === 'R' ? 0 : b === '5' ? 7 : b === '8' ? 12 : ch.iv[1]; voice(T, hz(ch.root - 12 + iv), dur * sg.bassLen, { type: 'triangle', v: .28, sus: .7, rel: .03, dest: d }); }
  const a = sg.arp[st];
  if (a !== '.') { const k = +a, n = ch.iv.length; voice(T, hz(ch.root + 12 + ch.iv[k % n] + 12 * Math.floor(k / n)), dur * .9, { duty: sg.arpDuty, v: .03, sus: .5, rel: .04, lp: 2400, dest: d }); }
  if (st % 2 === 0 && AUD.loop % 3 !== 2) {   // every third time round the lead rests, so it doesn't wear thin
    const i = bar * 8 + st / 2, tok = sg.mel[i];
    if (tok && tok !== '.' && tok !== '-') {
      let n = 1; while (sg.mel[i + n] === '-') n++;
      voice(T, nhz(tok), n * dur * 2 * .92, { duty: sg.leadDuty, v: .085, a: .01, sus: .55, rel: .08, vib: n > 1 ? .006 : 0, lp: sg.leadLp, dest: d });
    }
  }
}
function musicTick() {
  const c = AUD.ctx;
  if (!c || c.state !== 'running') return;
  if (!AUD.playing || !AUD.set.musicOn || AUD.set.music <= 0) { AUD.nextT = 0; return; }
  const now = c.currentTime;
  if (!AUD.nextT) { AUD.nextT = now + .1; AUD.step = 0; AUD.bar = 0; AUD.loop = 0; AUD.song = -1; }   // start from the top
  else if (AUD.nextT < now - .05) AUD.nextT = now + .05;   // fell behind (busy page): skip ahead, keep our place in the tune
  while (AUD.nextT < now + .2) {
    if (AUD.step === 0 && AUD.song !== AUD.want) { AUD.song = AUD.want; AUD.bar = 0; AUD.loop = 0; }   // change tune on a bar line
    const sg = SONGS[AUD.song], dur = 60 / sg.bpm / 4;
    try { playStep(sg, AUD.bar, AUD.step, AUD.nextT, dur); } catch (e) {}
    AUD.nextT += dur;
    if (++AUD.step >= 16) { AUD.step = 0; if (++AUD.bar >= sg.bars.length) { AUD.bar = 0; AUD.loop++; } }
  }
}
function musicStart() { AUD.playing = true; AUD.nextT = 0; audioLevels(); }
function musicStop() { AUD.playing = false; audioLevels(); }
// which area's tune to play: the one in view, once the view has settled there for a moment
function setMusicArea(b) {
  const now = performance.now();
  if (b !== AUD.cand) { AUD.cand = b; AUD.candT = now; }
  else if (AUD.want !== b && now - AUD.candT > 1500) AUD.want = b;
}

