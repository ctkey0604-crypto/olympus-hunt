/* ============================== MUSIC ============================== */
// A little NES-style band made in code: two pulse leads, a triangle bass and noise drums.
// Every track is a 4-bar theme (A) plus a chord progression. The band turns that into a 16-bar loop:
// the theme, the theme again with its own ending, then a bridge where the second pulse arpeggiates the
// chords. Boss themes have levels: 0 while the waves come in (Titans only), 1 for the fight, 2 and 3 when
// the boss changes phase (faster, crashes on every bar, the lead doubled an octave up).
//
// Melody tokens: degree 1-7 of the mode, ' = octave up, , = octave down, b/# before = flat/sharp,
// :n = length in 16ths (carries over), - = rest, ~ = hold the last note. Bars are split with |.
const Music = (() => {
  const MODES = { ion: [0, 2, 4, 5, 7, 9, 11], dor: [0, 2, 3, 5, 7, 9, 10], phr: [0, 1, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], mix: [0, 2, 4, 5, 7, 9, 10],
                  aeo: [0, 2, 3, 5, 7, 8, 10], hm: [0, 2, 3, 5, 7, 8, 11], pd: [0, 1, 4, 5, 7, 8, 10], hun: [0, 2, 3, 6, 7, 8, 11] };
  const NOTES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const DRUMS = {
    none: {},
    soft:   { k: 'x.......x.......', h: '..x...x...x...x.' },
    soft2:  { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    rock:   { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    gallop: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xx.xxx.xxx.xxx.x' },
    dance:  { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    march:  { k: 'x.......x.......', s: '....x..x....x.xx', h: 'x.x.x.x.x.x.x.x.' },
    syncop: { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    war:    { k: 'x..x..x.x..x....', s: '....x.......x...', t: '......x.....x.xx', h: 'x...x...x...x...' },
    blast:  { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    doom:   { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...' },
    anvil:  { k: 'x.......x.......', s: '....x.......x...', a: 'x.....x...x.....', h: '..x...x...x...x.' },
    slow:   { k: 'x...............', t: '........x.......' },
  };
  const T = (o) => Object.assign({ key: 'C', mode: 'aeo', bpm: 120, oct: 4, bass: 'drive', drums: 'rock', arp: 'up', duty: .25 }, o);
  // ---------------------------------------------------------------- the tracks
  const SONGS = {
    title:  T({ key: 'D', mode: 'aeo', bpm: 120, prog: '1 7 6 7 1 7 4 5', progB: '6 7 1 1 6 7 5 5', arp: 'updown',
                A: '1:4 5:4 4:2 3:2 2:2 3:2 | 1:6 7,:2 1:8 | 3:4 4:2 5:2 6:4 5:4 | 4:3 3:1 2:4 7,:8', E: '5:4 4:2 3:2 2:8' }),
    akros:  T({ key: 'G', mode: 'ion', bpm: 96, prog: '1 4 1 5 6 4 2 5', progB: '4 5 3 6 4 5 1 1', bass: 'walk', drums: 'soft', arp: 'broken8', duty: .125,
                A: '5:4 3:2 4:2 5:4 1\':4 | 6:6 5:2 4:4 3:4 | 3:4 2:2 3:2 5:4 3:4 | 2:8 -:4 5,:4', E: '3:4 2:2 1:2 7,:4 5,:4' }),
    road:   T({ key: 'A', mode: 'mix', bpm: 132, prog: '1 7 4 1 1 7 4 5', progB: '4 5 1 7 4 5 7 7', bass: 'octave', drums: 'rock', arp: 'broken8',
                A: '1:2 1:2 5:2 1\':4 7:2 5:4 | 4:2 5:2 6:4 5:4 4:2 2:2 | 3:4 4:2 3:2 1:4 6,:4 | 7,:6 1:2 1:8', E: '5:4 4:2 2:2 5:8' }),
    temple: T({ key: 'A', mode: 'aeo', bpm: 70, prog: '1 6 3 7 1 4 5 1', progB: '4 1 6 7 4 1 5 5', bass: 'doom', drums: 'none', arp: 'pad', duty: .5,
                A: '1:8 3:4 2:4 | 1:12 7,:4 | 6,:8 1:4 3:4 | 7,:16', E: '3:8 2:4 1:4' }),
    hall:   T({ key: 'D', mode: 'phr', bpm: 64, prog: '1 2 1 7 1 2 7 1', progB: '1 1 2 2 7 7 1 1', bass: 'doom', drums: 'slow', arp: 'pad', duty: .5, oct: 3,
                A: '1:8 2:8 | 1:12 -:4 | 5,:8 6,:4 5,:4 | 2:16', E: '2:8 1:8' }),
    // shared hunt music: every hunt that isn't a god or a Titan fight
    hunt_field: T({ key: 'E', mode: 'dor', bpm: 140, prog: '1 4 1 7 3 4 5 5', progB: '3 4 1 1 3 4 5 5', bass: 'gallop', drums: 'rock', arp: 'up',
                A: '1:2 2:2 3:2 5:4 3:2 5:2 6:2 | 5:4 4:2 3:2 4:8 | 3:2 3:2 5:2 3:2 1\':4 7:4 | 6:6 5:2 4:8', E: '5:4 7:4 6:4 4:4' }),
    hunt_wild:  T({ key: 'A', mode: 'aeo', bpm: 132, prog: '1 6 7 1 1 6 7 5', progB: '6 7 1 1 6 7 5 5', bass: 'gallop', drums: 'gallop', arp: 'updown',
                A: '1:3 1:1 3:2 5:2 1\':4 5:4 | 6:3 5:1 4:2 3:2 4:8 | 5:3 5:1 7:2 5:2 2\':4 7:4 | 1\':8 -:4 5:4', E: '7:4 5:4 4:4 2:4' }),
    hunt_sea:   T({ key: 'B', mode: 'aeo', bpm: 126, prog: '1 6 3 7 1 6 4 5', progB: '6 7 1 1 6 7 4 5', bass: 'pulse', drums: 'soft2', arp: 'updown',
                A: '5:6 4:2 3:4 1:4 | 3:6 2:2 1:8 | 5:6 6:2 5:4 3:4 | 4:8 2:8', E: '5:6 4:2 5:8' }),
    hunt_dark:  T({ key: 'C#', mode: 'phr', bpm: 124, prog: '1 2 1 7 1 2 6 7', progB: '6 7 1 1 6 7 2 2', bass: 'drive', drums: 'rock', arp: 'broken8',
                A: '1:2 1:2 2:2 1:2 5:4 4:4 | 3:4 2:4 1:8 | 1:2 1:2 2:2 1:2 6:4 5:4 | 7:6 6:2 7:8', E: '2\':4 1\':4 7:8' }),
    // the gods
    hermes:     T({ key: 'A', mode: 'mix', bpm: 172, prog: '1 7 4 1 1 7 4 5', bass: 'octave', drums: 'gallop', arp: 'up',
                A: '5:1 -:1 5:1 -:1 1\':2 5:2 3:2 5:2 1\':2 3\':2 | 2\':2 1\':2 7:2 5:2 7:4 -:4 | 4:2 6:2 1\':2 6:2 2\':2 1\':2 6:4 | 5:2 3:2 1:2 3:2 5:8', E: '7:2 5:2 2:2 5:2 7:8' }),
    artemis:    T({ key: 'E', mode: 'aeo', bpm: 150, prog: '1 7 6 7 1 7 6 5', bass: 'gallop', drums: 'gallop', arp: 'up',
                A: '1:4 5,:2 1:2 4:6 5:2 | 5:8 4:4 2:4 | 3:4 1:2 3:2 6:6 5:2 | 4:8 2:8', E: '2:4 4:4 5:8' }),
    dionysus:   T({ key: 'D', mode: 'pd', bpm: 156, prog: '1 1 2 1 1 7 2 1', bass: 'octave', drums: 'dance', arp: 'harm',
                A: '1:2 2:2 3:2 2:2 1:2 2:2 3:4 | 5:2 4:2 3:2 2:2 3:8 | 5:2 6:2 5:2 4:2 3:2 4:2 5:4 | 3:2 2:2 1:4 -:8', E: '5:2 6:2 5:2 3:2 2:2 3:2 1:4' }),
    pan:        T({ key: 'G', mode: 'dor', bpm: 164, prog: '1 4 1 4 7 4 1 1', bass: 'walk', drums: 'dance', arp: 'up', duty: .125,
                A: '5:1 6:1 5:2 3:2 1:2 5:1 6:1 5:2 1\':4 | 6:2 5:2 4:2 6:2 5:8 | 4:2 3:2 4:2 5:2 7:4 5:4 | 1:2 3:2 5:2 3:2 1:8', E: '1:2 3:2 5:2 7:2 1\':8' }),
    athena:     T({ key: 'C', mode: 'hm', bpm: 144, prog: '1 4 5 1 6 4 5 5', bass: 'drive', drums: 'march', arp: 'broken8',
                A: '1:3 1:1 1:2 5:2 5:4 3:4 | 4:3 4:1 6:2 4:2 1\':8 | 7:3 7:1 2\':2 7:2 5:4 4:4 | 3:8 1:8', E: '5:3 5:1 7:2 2\':2 7:8' }),
    aphrodite:  T({ key: 'F', mode: 'hm', bpm: 128, prog: '1 6 4 5 1 6 4 5', bass: 'octave', drums: 'syncop', arp: 'harm',
                A: '5:3 6:3 5:2 3:4 1:4 | 6:3 1\':3 6:2 4:8 | 4:3 6:3 4:2 3:4 1:4 | 7,:3 2:3 3:2 5:8', E: '7,:3 2:3 7,:2 5,:8' }),
    apollo:     T({ key: 'B', mode: 'lyd', bpm: 158, prog: '1 2 1 2 6 5 1 1', bass: 'octave', drums: 'rock', arp: 'up', oct: 3,
                A: '1:2 3:2 5:2 1\':2 7:2 5:2 3:4 | 2:2 4:2 6:2 2\':2 1\':2 6:2 4:4 | 5:2 1\':2 3\':2 1\':2 5:4 3:4 | 2\':4 1\':4 7:4 6:4', E: '5:2 7:2 2\':2 7:2 1\':8' }),
    hecate:     T({ key: 'Eb', mode: 'hun', bpm: 132, prog: '1 5 1 6 1 5 6 5', bass: 'pulse', drums: 'syncop', arp: 'updown',
                A: '1:4 4:4 5:4 3:4 | 2:4 7,:4 1:8 | 5:4 6:4 5:2 4:2 3:4 | 6:8 4:8', E: '4:4 5:4 7,:8' }),
    ares:       T({ key: 'E', mode: 'phr', bpm: 160, prog: '1 2 1 2 1 2 7 1', bass: 'gallop', drums: 'war', arp: 'harm',
                A: '1:2 1:2 1:2 2:2 1:2 1:2 5:4 | 4:2 3:2 2:2 3:2 2:8 | 1:2 1:2 1:2 2:2 1:2 1:2 6:2 5:2 | 2:4 1:4 -:2 1,:2 1:4', E: '5:2 4:2 3:2 2:2 1:8' }),
    nemesis:    T({ key: 'Bb', mode: 'aeo', bpm: 146, prog: '1 1 6 6 4 4 5 5', bass: 'drive', drums: 'rock', arp: 'updown', oct: 3,
                A: '1:2 3:2 5:2 3:2 1:2 3:2 5:4 | 6:2 5:2 4:2 3:2 1:8 | 4:2 6:2 1\':2 6:2 4:2 6:2 1\':4 | 5:4 7:4 2\':8', E: '5:2 7:2 2\':2 7:2 5:8' }),
    poseidon:   T({ key: 'D', mode: 'aeo', bpm: 142, prog: '1 6 7 1 1 6 4 5', bass: 'octave', drums: 'gallop', arp: 'updown',
                A: '1:6 5:6 4:4 | 3:6 4:6 5:4 | 7:6 5:6 2\':4 | 1\':12 -:4', E: '7:6 5:6 1\':4' }),
    hera:       T({ key: 'G', mode: 'hm', bpm: 138, prog: '1 4 5 1 6 4 5 5', bass: 'walk', drums: 'march', arp: 'broken8',
                A: '5:4 1\':4 7:2 1\':2 2\':4 | 3\':6 2\':2 1\':4 6:4 | 5:3 6:1 5:2 4:2 5:4 7:4 | 1\':8 5:8', E: '5:4 7:4 2\':4 7:4' }),
    eris:       T({ key: 'F#', mode: 'hm', bpm: 172, prog: '1 6 4 5 1 6 4 5', bass: 'gallop', drums: 'blast', arp: 'harm',
                A: '1:1 5:1 1\':2 -:1 7:1 1\':2 6:2 5:2 4:2 3:2 | 6:1 1\':1 3\':2 -:1 2\':1 3\':2 1\':2 6:2 4:4 | 4:1 6:1 1\':2 -:1 7:1 1\':2 6:2 4:2 2:4 | 5:2 7:2 2\':2 7:2 5:8',
                E: '5:2 7:2 2\':2 7:2 1\':8' }),
    hephaestus: T({ key: 'C', mode: 'phr', bpm: 134, prog: '1 1 2 1 1 1 7 1', bass: 'drive', drums: 'anvil', arp: 'harm',
                A: '1:3 1:3 1:2 3:4 2:4 | 1:3 1:3 1:2 5:4 4:4 | 2:3 2:3 2:2 4:4 3:4 | 1:8 -:8', E: '5:3 4:3 3:2 2:4 1:4' }),
    hades:      T({ key: 'C#', mode: 'pd', bpm: 128, prog: '1 2 1 2 1 2 7 1', bass: 'doom', drums: 'doom', arp: 'updown', oct: 3,
                A: '1:8 2:4 3:4 | 2:8 1:8 | 5:6 6:2 5:4 4:4 | 3:8 2:4 1:4', E: '5:4 3:4 2:4 1:4' }),
    hypnos:     T({ key: 'A', mode: 'dor', bpm: 108, prog: '1 4 1 4 3 4 5 1', bass: 'pulse', drums: 'soft', arp: 'updown', echo: true,
                A: '5:4 3:4 1\':8 | 6:4 4:4 2:8 | 5:4 3:4 7:8 | 6:8 4:8', E: '5:4 3:4 1:8' }),
    zeus:       T({ key: 'D', mode: 'hm', bpm: 178, prog: '1 1 6 6 4 5 1 5', bass: 'gallop', drums: 'blast', arp: 'harm',
                A: '1:2 5:2 1\':2 3\':2 2\':2 1\':2 5:4 | 1:2 5:2 1\':2 3\':2 5\':4 3\':4 | 6:2 3\':2 1\':2 6:2 4:2 1\':2 6:4 | 4:2 1\':2 6:2 4:2 7:8',
                E: '5:2 7:2 2\':2 7:2 5:4 -:4' }),
    // the Titans: heavier and lower; they play quietly while their waves come in
    atlas:      T({ key: 'G', mode: 'phr', bpm: 110, prog: '1 2 1 2 6 7 1 1', bass: 'doom', drums: 'doom', arp: 'pad', oct: 4, duty: .5,
                A: '1,:4 1,:4 2,:4 1,:4 | 5,:8 4,:8 | 1:4 1:4 2:4 3:4 | 2:16', E: '3:4 2:4 1:8' }),
    hyperion:   T({ key: 'E', mode: 'mix', bpm: 152, prog: '1 7 4 7 1 7 4 5', bass: 'octave', drums: 'blast', arp: 'up', oct: 3,
                A: '1\':2 5:2 3:2 5:2 1\':2 2\':2 3\':4 | 2\':2 7:2 5:2 7:2 2\':8 | 1\':2 6:2 4:2 6:2 1\':2 2\':2 3\':4 | 2\':4 1\':4 7:8', E: '2\':4 7:4 5:8' }),
    oceanus:    T({ key: 'C#', mode: 'aeo', bpm: 136, prog: '1 6 7 1 4 6 5 5', bass: 'octave', drums: 'gallop', arp: 'updown',
                A: '1:8 3:4 5:4 | 6:8 5:4 3:4 | 7:8 6:4 5:4 | 1:16', E: '5:8 7:4 5:4' }),
    coeus:      T({ key: 'B', mode: 'hun', bpm: 126, prog: '1 5 1 6 1 5 6 5', bass: 'pulse', drums: 'syncop', arp: 'harm', oct: 3,
                A: '1:2 3:2 4:2 5:2 6:4 5:4 | 7:4 5:4 2\':8 | 1:2 3:2 4:2 5:2 1\':4 7:4 | 6:8 4:8', E: '7:4 6:4 5:8' }),
    mnemosyne:  T({ key: 'F', mode: 'dor', bpm: 118, prog: '1 4 7 1 1 4 7 1', bass: 'walk', drums: 'soft2', arp: 'updown', echo: true,
                A: '1:4 5:4 4:2 3:2 2:2 3:2 | 1:6 7,:2 1:8 | 3:4 4:2 5:2 6:4 5:4 | 4:3 3:1 2:4 7,:8', E: '5:4 4:2 3:2 1:8' }),
    themis:     T({ key: 'A', mode: 'hm', bpm: 132, prog: '1 4 5 1 6 4 5 5', bass: 'drive', drums: 'march', arp: 'broken8',
                A: '1:4 1:2 2:2 3:4 1:4 | 4:4 4:2 3:2 2:4 4:4 | 5:4 7:4 2\':4 7:4 | 1\':8 5:8', E: '5:4 7:4 2\':8' }),
    rhea:       T({ key: 'E', mode: 'pd', bpm: 140, prog: '1 2 1 7 1 2 6 1', bass: 'gallop', drums: 'war', arp: 'harm',
                A: '1:2 2:2 3:4 2:2 1:2 5,:4 | 4:2 3:2 2:4 1:8 | 1:2 3:2 5:4 6:2 5:2 3:4 | 7:4 6:4 4:8', E: '2:2 3:2 2:2 1:2 1:8' }),
    cronus:     T({ key: 'F#', mode: 'phr', bpm: 184, prog: '1 2 1 2 6 7 1 1', bass: 'gallop', drums: 'blast', arp: 'harm', oct: 3,
                A: '1:1 2:1 3:1 2:1 1:2 5,:2 1:1 2:1 3:1 4:1 5:4 | 2:1 3:1 4:1 3:1 2:2 7,:2 2:4 1:4 | 1:1 2:1 3:1 2:1 1:2 5,:2 1:1 2:1 3:1 4:1 6:4 | 5:4 4:4 2:8',
                E: '5:2 4:2 3:2 2:2 1:8' }),
    // stingers, played once
    win:  T({ key: 'C', mode: 'ion', bpm: 150, once: true, prog: '1 1', bass: 'pulse', drums: 'none', arp: 'none', A: '5,:2 1:2 3:2 5:2 1\':4 5:4 | 1\':16', bars: 2 }),
    lose: T({ key: 'A', mode: 'aeo', bpm: 84, once: true, prog: '1 1', bass: 'doom', drums: 'none', arp: 'none', A: '5:4 4:4 3:4 2:4 | 1:16', bars: 2 }),
  };
  const HUNT = { poseidon: 'hunt_sea', hades: 'hunt_dark', hecate: 'hunt_dark', hypnos: 'hunt_dark', hephaestus: 'hunt_dark', artemis: 'hunt_wild', dionysus: 'hunt_wild', pan: 'hunt_wild' };

  // ---------------------------------------------------------------- turning a track into notes
  function parse(str) {
    const out = []; let len = 2;
    for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
      const m = /^([b#]?)([1-7\-~])([',]*)(?::(\d+))?$/.exec(tok); if (!m) continue;
      if (m[4]) len = +m[4];
      if (m[2] === '-') out.push({ rest: true, len });
      else if (m[2] === '~') { if (out.length) out[out.length - 1].len += len; }
      else out.push({ deg: +m[2], acc: m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0, oct: (m[3].match(/'/g) || []).length - (m[3].match(/,/g) || []).length, len });
    }
    return out;
  }
  // the pitch of degree d (1-based, any size) in a mode above a tonic
  const pitch = (S, base, d, acc = 0) => { const i = d - 1, o = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return base + 12 * o + MODES[S.mode][k] + acc; };
  const tonic = (S, oct) => 12 * (oct + 1) + NOTES[S.key];
  function chordTones(S, base, root) { return [pitch(S, base, root), pitch(S, base, root + 2), pitch(S, base, root + 4), pitch(S, base, root + 7)]; }
  // events[step] = [[channel, midi, steps, vol], ...]
  function build(id, level) {
    const S = SONGS[id], bars = S.bars || 16, steps = bars * 16, ev = Array.from({ length: steps }, () => []);
    const add = (st, e) => { if (st < steps) ev[st].push(e); };
    const prog = S.prog.split(/\s+/).map(Number), progB = (S.progB || S.prog).split(/\s+/).map(Number);
    const chordAt = bar => bar < 8 ? prog[bar % prog.length] : progB[(bar - 8) % progB.length];
    const lead = tonic(S, S.oct), low = tonic(S, 2), mid = tonic(S, 4);
    const A = parse(S.A), E = S.E ? parse(S.E) : null;
    // the theme: bars 0-3 as written, 4-7 again with the ending bar, 8-15 the bridge (16-bar tracks)
    let t = 0;
    const playLine = (notes, from, harm) => {
      let st = from;
      for (const n of notes) {
        if (!n.rest) {
          const m = pitch(S, lead, n.deg + 7 * n.oct, n.acc);
          add(st, ['p1', m, n.len, 1]);
          if (level >= 2) add(st, ['p2', m + 12, n.len, .55]);
          else if (harm) add(st, ['p2', pitch(S, lead, n.deg + 7 * n.oct - 2, n.acc), n.len, .7]);
        }
        st += n.len;
      }
      return st;
    };
    const harm = S.arp === 'harm';
    if (S.once) playLine(A, 0, false);
    else {
      t = playLine(A, 0, harm);
      // second time: the first three bars again, then the ending
      let cut = 0, firstThree = [];
      for (const n of A) { if (cut >= 48) break; firstThree.push(n); cut += n.len; }
      t = playLine(firstThree, 64, harm);
      if (E) playLine(E, 112, harm);
      else { const last = A.slice(firstThree.length).map(n => ({ ...n })); const f = [...last].reverse().find(n => !n.rest); if (f) { f.deg = 1; f.oct = 0; f.acc = 0; } playLine(last, 112, harm); }
    }
    // the bridge melody: the theme's rhythm walked over the bridge chords (bars 8-15), then the band takes over
    if (!S.once && bars > 8) {
      let st = 128, i = 0;
      for (const n of A) {
        if (st >= 192) break;
        if (!n.rest) { const ch = chordTones(S, lead, chordAt(Math.floor(st / 16))), m = ch[i++ % 3] + (i % 6 > 2 ? 12 : 0); add(st, ['p1', m, n.len, .8]); }
        st += n.len;
      }
      st = 192;
      for (const n of A) { if (st >= 256) break; if (!n.rest) { const m = pitch(S, lead, n.deg + 7 * n.oct, n.acc); add(st, ['p1', m, n.len, 1]); if (level >= 2) add(st, ['p2', m + 12, n.len, .5]); } st += n.len; }
    }
    // bass, arpeggios and drums, bar by bar
    const dr = DRUMS[level === 0 && S.drums !== 'none' ? 'soft2' : S.drums] || {};
    for (let bar = 0; bar < bars; bar++) {
      const r = chordAt(bar), b0 = bar * 16, rb = pitch(S, low, r), r5 = pitch(S, low, r + 4), r8 = rb + 12;
      const bassPat = {
        drive: [[0, rb, 2], [2, rb, 2], [4, rb, 2], [6, rb, 2], [8, rb, 2], [10, rb, 2], [12, r8, 2], [14, rb, 2]],
        gallop: [[0, rb, 1], [2, rb, 1], [3, rb, 1], [4, rb, 1], [6, rb, 1], [7, rb, 1], [8, rb, 1], [10, rb, 1], [11, rb, 1], [12, r8, 1], [14, rb, 1], [15, rb, 1]],
        octave: [[0, rb, 2], [2, r8, 2], [4, rb, 2], [6, r8, 2], [8, rb, 2], [10, r8, 2], [12, rb, 2], [14, r8, 2]],
        walk: [[0, rb, 4], [4, r5, 4], [8, r8, 4], [12, r5, 4]],
        pulse: [[0, rb, 4], [4, rb, 4], [8, rb, 4], [12, rb, 4]],
        doom: [[0, rb, 8], [8, r5, 8]],
      }[S.bass] || [];
      if (!(S.once && bar > 0 && S.bass !== 'doom' && S.bass !== 'pulse')) for (const [o, m, l] of bassPat) add(b0 + o, ['tri', m, l, 1]);
      const ch = chordTones(S, mid, r), arpOn = bar >= 8 || (S.arp !== 'harm' && level < 2);
      if (!S.once && arpOn) {
        const a = S.arp === 'up' ? [0, 1, 2, 3] : S.arp === 'updown' ? [0, 1, 2, 3, 2, 1] : null;
        if (a) for (let s = 0; s < 16; s++) add(b0 + s, ['p2', ch[a[s % a.length]], 1, .55]);
        else if (S.arp === 'broken8' || S.arp === 'harm') for (let s = 0; s < 16; s += 2) add(b0 + s, ['p2', ch[[0, 2, 1, 2][(s / 2) % 4]], 2, .6]);
        else if (S.arp === 'pad') { add(b0, ['p2', ch[0], 16, .5]); add(b0, ['p3', ch[2], 16, .4]); }
      }
      // drums, with a snare fill closing every eighth bar and crashes when it gets serious
      const fill = bar % 8 === 7 && dr.s;
      for (const [k, pat] of Object.entries(dr)) for (let s = 0; s < 16; s++) {
        if (fill && k === 's' && s >= 12) continue;
        if (pat[s] === 'x') add(b0 + s, ['d', k, 1, 1]);
      }
      if (fill) for (let s = 12; s < 16; s++) add(b0 + s, ['d', 's', 1, .6 + (s - 12) * .12]);
      if (level >= 2 && dr.k) { if (bar % 2 === 0) add(b0, ['d', 'c', 1, 1]); for (let s = 1; s < 16; s += 2) add(b0 + s, ['d', 'h', 1, .6]); }
      else if (dr.k && bar % 8 === 0 && level >= 1 && S.drums !== 'soft' && S.drums !== 'soft2') add(b0, ['d', 'c', 1, .7]);
    }
    return ev;
  }

  // ---------------------------------------------------------------- making the sounds
  const waves = new WeakMap();
  function pulseWave(ctx, duty) {
    let m = waves.get(ctx); if (!m) waves.set(ctx, m = {});
    if (m[duty]) return m[duty];
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = 0; im[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty); }
    return m[duty] = ctx.createPeriodicWave(re, im);
  }
  const noiseBufs = new WeakMap();
  function noiseBuf(ctx) {
    let b = noiseBufs.get(ctx); if (b) return b;
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ctx, b); return b;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const VOL = { p1: .15, p2: .075, p3: .06, tri: .3 };
  function note(ctx, out, S, e, t, stepDur) {
    const [chn, m, steps, v] = e, dur = steps * stepDur;
    if (chn === 'd') return drum(ctx, out, m, t, v);
    const o = ctx.createOscillator(), g = ctx.createGain(), vol = VOL[chn] * v;
    if (chn === 'tri') o.type = 'triangle'; else o.setPeriodicWave(pulseWave(ctx, chn === 'p1' ? S.duty : chn === 'p2' ? .125 : .25));
    o.frequency.setValueAtTime(hz(m), t);
    const gate = Math.max(.04, dur * (chn === 'tri' ? .92 : .86)), end = t + gate;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004);
    if (chn !== 'tri' && gate > .1) g.gain.exponentialRampToValueAtTime(vol * .6, t + Math.min(.12, gate * .6));
    g.gain.setValueAtTime(chn !== 'tri' && gate > .1 ? vol * .6 : vol, end - .012); g.gain.linearRampToValueAtTime(0, end);
    if (chn === 'p1' && gate > .3) {                         // a touch of vibrato on held notes
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + Math.min(.4, gate));
      l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(end + .02);
    }
    o.connect(g); g.connect(chn === 'p1' && out.echo ? out.lead : out.mix); o.start(t); o.stop(end + .02);
  }
  function drum(ctx, out, k, t, v) {
    const g = ctx.createGain(); g.connect(out.mix);
    const tone = (type, f0, f1, d, vol) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
      og.gain.setValueAtTime(vol * v, t); og.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(og); og.connect(g); o.start(t); o.stop(t + d + .02); };
    const hiss = (ft, f, d, vol, q = .8) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), ng = ctx.createGain(); s.buffer = noiseBuf(ctx); fl.type = ft; fl.frequency.value = f; fl.Q.value = q;
      ng.gain.setValueAtTime(vol * v, t); ng.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl); fl.connect(ng); ng.connect(g); s.start(t, Math.random() * .5); s.stop(t + d + .02); };
    if (k === 'k') { tone('triangle', 170, 42, .13, .6); hiss('lowpass', 900, .02, .12); }
    else if (k === 's') { hiss('bandpass', 1700, .13, .32); tone('triangle', 200, 130, .07, .16); }
    else if (k === 'h') hiss('highpass', 7200, .035, .09);
    else if (k === 'c') hiss('highpass', 3800, .9, .14, .5);
    else if (k === 't') tone('triangle', 230, 90, .17, .45);
    else if (k === 'a') { tone('square', 1760, 1700, .11, .05); tone('square', 2637, 2600, .08, .035); }
  }
  // a little output chain per track: everything into mix, the lead optionally through an echo
  function chain(ctx, dest, S, stepDur) {
    const mix = ctx.createGain(); mix.connect(dest);
    const out = { mix, lead: mix, echo: !!S.echo };
    if (S.echo) { const lead = ctx.createGain(), d = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(); d.delayTime.value = stepDur * 3; fb.gain.value = .32; wet.gain.value = .35;
      lead.connect(mix); lead.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(mix); out.lead = lead; }
    return out;
  }

  // ---------------------------------------------------------------- the live player
  const cache = {};
  const events = (id, lvl) => cache[id + ':' + lvl] || (cache[id + ':' + lvl] = build(id, lvl));
  const M = { want: null, wantLvl: 1, cur: null, out: null, ducked: false, timer: null, songs: SONGS };
  const speed = lvl => lvl >= 3 ? 1.12 : lvl >= 2 ? 1.07 : 1;
  function audible() { return !!(Sound.on && Settings.data.music !== false && !CG.muted); }
  function ensureOut(ctx) {
    if (M.out) return M.out;
    M.out = ctx.createGain(); M.out.gain.value = 0; M.out.connect(ctx.destination); return M.out;
  }
  M.refresh = () => {
    const ctx = Sound.ctx; if (!ctx) return;
    const out = ensureOut(ctx), v = audible() ? (M.ducked ? .35 : 1) * .2 : 0;      // well under the sound effects
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(v, ctx.currentTime, .08);
  };
  function stopCur(fade = .5) {
    const c = M.cur; if (!c) return; M.cur = null;
    const ctx = Sound.ctx; if (!ctx) return;
    try { c.gain.gain.cancelScheduledValues(ctx.currentTime); c.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 4); setTimeout(() => c.gain.disconnect(), (fade + .3) * 1000); } catch (e) {}
  }
  function startCur(id, lvl) {
    const ctx = Sound.ctx; if (!ctx || !SONGS[id]) return;
    const S = SONGS[id], gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ensureOut(ctx)); gain.gain.setTargetAtTime(1, ctx.currentTime, .12);
    const sd = 60 / (S.bpm * speed(lvl)) / 4;
    M.cur = { id, lvl, S, gain, out: chain(ctx, gain, S, sd), step: 0, next: ctx.currentTime + .08, ev: events(id, lvl) };
    M.refresh();
  }
  function tick() {
    const ctx = Sound.ctx; if (!ctx || ctx.state !== 'running') return;
    if (M.want && (!M.cur || M.cur.id !== M.want)) { stopCur(); startCur(M.want, M.wantLvl); }
    const c = M.cur; if (!c) return;
    if (c.lvl !== M.wantLvl && !c.S.once) { c.lvl = M.wantLvl; c.ev = events(c.id, c.lvl); }
    const sd = 60 / (c.S.bpm * speed(c.lvl)) / 4;
    if (c.next < ctx.currentTime - .25) c.next = ctx.currentTime + .03;      // woke up late (tab in the background): don't play catch-up
    while (c.next < ctx.currentTime + .14) {
      for (const e of c.ev[c.step]) note(ctx, c.out, c.S, e, c.next, sd);
      c.next += sd; c.step++;
      if (c.step >= c.ev.length) { if (c.S.once) { M.want = null; M.cur = null; setTimeout(() => c.gain.disconnect(), 3000); return; } c.step = 0; }
    }
  }
  // what should be playing: a track id, and for boss themes how hard
  M.play = (id, lvl = 1) => { M.want = id; M.wantLvl = lvl; if (!M.timer) M.timer = setInterval(tick, 25); };
  M.level = lvl => { M.wantLvl = lvl; };
  M.sting = id => { stopCur(.25); M.want = id; M.wantLvl = 1; if (!M.timer) M.timer = setInterval(tick, 25); };
  M.stop = () => { M.want = null; stopCur(); };
  M.duck = v => { M.ducked = v; M.refresh(); };
  M.huntTrack = god => HUNT[god] || 'hunt_field';
  // render a track offline (for listening outside the game)
  M.render = async (id, lvl = 1, seconds = 30, rate = 44100) => {
    const S = SONGS[id], sd = 60 / (S.bpm * speed(lvl)) / 4, ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
    const g = ctx.createGain(); g.gain.value = .55; g.connect(ctx.destination);
    const out = chain(ctx, g, S, sd), ev = events(id, lvl);
    for (let step = 0, t = .05; t < seconds - .1; step++, t += sd) { const i = step % ev.length; if (S.once && step >= ev.length) break; for (const e of ev[i]) note(ctx, out, S, e, t, sd); }
    return ctx.startRendering();
  };
  return M;
})();
