/* ============================== THE NORTH: music ============================== */
// Written the same way as 33_music.js (a 4-bar theme and a chord loop; boss themes get the grunge grooves, the half-time
// drop in the bridge and darker modes on God Rank by themselves). The North leans on the scarier modes: Phrygian, harmonic
// minor, Hungarian minor, and Fenrir in the darkest one the band has. Gods' themes are keyed by the god's id.
{
  const T = o => Object.assign({ key: 'C', mode: 'aeo', bpm: 120, oct: 4, bass: 'drive', drums: 'rock', arp: 'up', duty: .25 }, o);
  Object.assign(Music.songs, {
    // Heimdall: horn calls over a marching gallop
    heimdall: T({ key: 'D', mode: 'mix', bpm: 150, prog: '1 7 4 1 1 7 4 5', progB: '4 5 1 7 4 5 7 7', bass: 'octave', drums: 'war', arp: 'harm',
                  A: '1:4 5:4 1\':6 7:2 | 6:4 5:2 4:2 5:8 | 1:4 5:4 2\':6 1\':2 | 7:4 5:4 1\':8', E: '5:4 4:4 1:8' }),
    // Freyja: a seeress' tune, sweet on top and wrong underneath
    freyja:   T({ key: 'E', mode: 'hm', bpm: 144, prog: '1 6 4 5 1 6 7 5', progB: '6 7 1 1 4 5 7 5', bass: 'octave', drums: 'syncop', arp: 'harm',
                  A: '5:3 6:1 5:2 3:2 1:4 3:4 | 4:3 5:1 4:2 2:2 7,:8 | 1:3 2:1 3:2 5:2 1\':4 7:4 | 6:4 5:4 4:8', E: '6:4 5:4 3:8' }),
    // Tyr: hammering on one note like a war drum, then the oath
    tyr:      T({ key: 'A', mode: 'phr', bpm: 164, prog: '1 2 1 7 1 2 6 7', progB: '6 7 1 1 6 7 2 2', bass: 'gallop', drums: 'war', arp: 'harm', oct: 3,
                  A: '1:2 1:2 1:2 2:2 1:4 5,:4 | 1:2 1:2 3:2 2:2 1:8 | 4:2 4:2 4:2 5:2 4:4 2:4 | 3:4 2:4 1:8', E: '2:4 1:4 7,:8' }),
    // Loki: a tune that won't sit still, in the Hungarian minor
    loki:     T({ key: 'F#', mode: 'hun', bpm: 168, prog: '1 5 1 6 1 5 6 5', progB: '6 6 5 5 1 1 5 5', bass: 'pulse', drums: 'syncop', arp: 'updown', echo: true,
                  A: '1:1 3:1 5:2 -:2 4:2 3:1 2:1 1:2 7,:4 | 1:2 3:2 4:2 5:2 6:4 5:4 | 7:1 6:1 5:2 -:2 4:2 3:1 2:1 3:2 4:4 | 5:6 4:2 3:8', E: '2:4 7,:4 1:8' }),
    // Thor: thunder, fast and loud
    thor:     T({ key: 'C', mode: 'mix', bpm: 176, prog: '1 7 4 1 6 7 1 5', progB: '4 4 1 1 6 7 5 5', bass: 'gallop', drums: 'blast', arp: 'harm',
                  A: '1:2 1:2 5:2 1\':2 7:4 5:4 | 4:2 4:2 6:2 4:2 1\':8 | 1:2 1:2 5:2 1\':2 2\':4 1\':4 | 7:4 5:4 1:8', E: '5:4 2\':4 1\':8' }),
    // Odin: slow and huge, the Allfather's tread
    odin:     T({ key: 'D', mode: 'aeo', bpm: 140, prog: '1 6 3 7 1 6 4 5', progB: '6 7 1 1 4 5 7 7', bass: 'drive', drums: 'march', arp: 'harm', oct: 3,
                  A: '1:6 3:2 5:8 | 6:4 5:4 4:4 3:4 | 1:6 3:2 7:8 | 6:4 5:4 3:8', E: '2:4 7,:4 1:8' }),
    // Fenrir: everything at once, in the darkest mode there is
    fenrir:   T({ key: 'B', mode: 'nm', bpm: 180, prog: '1 2 1 2 6 7 1 1', progB: '6 6 7 7 1 2 1 1', bass: 'gallop', drums: 'blast', arp: 'harm', oct: 3,
                  A: '1:1 2:1 1:2 5,:2 1:2 2:4 1:4 | 3:1 2:1 1:2 7,:2 1:2 2:8 | 1:1 2:1 1:2 5,:2 1:2 4:4 3:4 | 2:4 1:4 7,:8', E: '2:4 3:4 1:8' }),
    // the North's hunts
    hunt_north: T({ key: 'D', mode: 'dor', bpm: 144, prog: '1 7 6 7 1 7 4 5', progB: '6 7 1 1 6 7 5 5', bass: 'gallop', drums: 'rock', arp: 'up',
                  A: '1:2 2:2 3:2 5:2 4:4 3:4 | 2:2 3:2 4:2 2:2 1:8 | 5:2 6:2 7:2 1\':2 7:4 5:4 | 4:4 3:4 2:8', E: '4:4 2:4 1:8' }),
    // Vindheim: a slow tune by the fire, with an echo off the fjord
    vindheim: T({ key: 'E', mode: 'dor', bpm: 92, prog: '1 7 6 7 1 4 7 1', progB: '6 7 1 1 4 7 1 1', bass: 'walk', drums: 'soft', arp: 'broken8', duty: .125, echo: true,
                  A: '1:4 5:4 4:2 3:2 2:4 | 3:6 2:2 1:8 | 5:4 1\':4 7:2 6:2 5:4 | 4:8 -:4 5,:4', E: '2:4 7,:4 1:8' }),
    // the first crossing: a rowing song
    voyage:   T({ key: 'G', mode: 'dor', bpm: 100, prog: '1 7 1 4 1 7 4 1', progB: '4 4 1 1 7 7 1 1', bass: 'pulse', drums: 'soft2', arp: 'updown',
                  A: '5:6 4:2 3:4 1:4 | 2:6 3:2 4:8 | 5:6 6:2 7:4 5:4 | 1\':12 -:4', E: '7:4 5:4 1:8' }),
  });
  // 33_music.js marks boss and hunt tracks once, before these existed: mark the North's the same way
  for (const g of [...NORSE_GODS.map(g => g.id), 'fenrir']) Music.songs[g].boss = true;
  Music.songs.hunt_north.hunt = true;
  const huntTrack = Music.huntTrack;
  Music.huntTrack = god => god === 'fenrir' || NORSE_GODS.some(g => g.id === god) ? 'hunt_north' : huntTrack(god);
}
