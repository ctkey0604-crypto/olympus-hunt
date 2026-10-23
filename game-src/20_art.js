/* ============================== ART ===================================== */
// Sprites are text grids so they're easy to edit by hand: one letter = one pixel, '.' = empty.
// A dark outline is added automatically. Swap these for your own art any time.
const PAL = {
  k: '#1a1210', K: '#3a2a22', s: '#e8b796', S: '#b97f5f', w: '#f3e9d4', W: '#c2b293',
  r: '#c0412e', R: '#7f2618', o: '#d9822b', O: '#9c5419', y: '#e9c04f', Y: '#a8842a',
  b: '#4f8fc7', B: '#2c5684', g: '#7fa548', G: '#4e6e2b', n: '#8a5a34', N: '#5a3a22',
  h: '#a7adb3', H: '#636a72', c: '#57c2b0', C: '#2c7a70', p: '#9a6bc0', P: '#5a3b78',
};
const OUTLINE = '#140d0b';

const SPRITE_DATA = {
  bandit: [
    ['...NNNN...', '..NnnnnN..', '.Nnnnnnnn.', '.NnnSSkSn.', '.NnnSSSSn.', '..nnnnnn..', '.snnnnnnS.',
     '.snnoooonS', '..nnnnnn..', '..NN..NN..', '..k....k..'],
    { from: 9, rows: ['...NNNN...', '...k..k...'] }],
  slinger: [
    ['...NNNN...', '..NNNNNN..', '..rrrrrr..', '..NsssksN.', '..Nsssss..', '...ssss...', '..gggggg..',
     '.sggggggs.', '.sgGGGGgs.', '..gggggg..', '..s....s..', '..n....n..'],
    { from: 10, rows: ['...s..s...', '...n..n...'] }],
  bull: [
    ['............w..w', '............wwww', '..NNNNNNNNNNnnn.', '.NnnnnnnnnnNnknn', 'NnnnnnnnnnnNnnnn', 'NnnnnnnnnnnNnnwn',
     'N.NnnnnnnnnN.nn.', '..NnnnnnnnnN....', '..nN.nN..nN.nN..', '..nN.nN..nN.nN..', '..kk.kk..kk.kk..'],
    { from: 8, rows: ['...nN.nN.nN.nN..', '...nN.nN.nN.nN..', '...kk.kk.kk.kk..'] }],
  hermes: [
    ['.w.........w.', 'ww..yyyyy..ww', '.wwyyyyyyyww.', '..yyyyyyyyy..', 'yyyyyyyyyyyyy', '...ssssss....', '...sssskS....',
     '...ssssss....', '....SsssS....', '..wwwwwww....', '.swwwwwwws...', '.swwbbbwws...', '..wwyyyww.s..', '..wwwwwww....',
     '..wwbbbbw....', '...ss.ss.....', '..wnn.wnn....', '...n...n.....'],
    { from: 0, rows: ['.............', 'w...yyyyy...w', 'wwwyyyyyyywww'] }],
  owl: [
    ['H........H', 'hH.HhhH.Hh', '.hhHhhHhh.', '..hywwyh..', '..hkyykh..', '...hooh...', '...hWWh...', '....hh....', '....yy....'],
    { from: 0, rows: ['..........', '...HhhH...', 'HhhHhhHhhH'] }],
  hoplite: [
    ['....rrrr...', '...rrrrrr..', '...yyyyy...', '..yyyyyyy..', '..yYyykyy..', '..yYyyyyy..', '...YyyY....',
     '..rrrrryyy.', '.srrrrryyYy', '.srrrrryrYy', '..rrrrryyYy', '..rrrrr.yy.', '...s..s....', '...n..n....'],
    { from: 12, rows: ['....s.s....', '....n.n....'] }],
  harpy: [
    ['pp........pp', '.pp.NNNN.pp.', '..ppNssNpp..', '...pNskNp...', '....ssss....', '...pwwwwp...', '....wwww....', '....PPPP....', '....y..y....', '...yy..yy...'],
    { from: 0, rows: ['............', '..ppNNNNpp..', 'pppPNssNPppp'] }],
  cyclops: [
    ['.....ssssss.....', '....ssssssss....', '...ssswwwwsss...', '...sswwbkwwss...', '...ssswwwwsss...', '....ssSSSSss....',
     '...ssskkkksss...', '..ssssssssssss..', '.ssssSSSSSSssss.', 'ssssSssssssSssss', 'sss.SssssssS.sss', 'ss..ssssssss..ss',
     '....nnnnnnnn....', '....nNnnnnNn....', '....ssss.ssss...', '....sss...sss...', '...nnnn...nnnn..'],
    { from: 14, rows: ['.....ssss.ssss..', '.....sss...sss..', '....nnnn...nnnn.'] }],
  acolyte: [
    ['...BBBB...', '..BbbbbB..', '.BbbbbbbB.', '.BbKcKcbB.', '.BbKKKKbB.', '..bbbbbb..', '.sbbbbbbs.', '.sbbccbbs.', '..bbbbbb..', '..bbbbbb..', '.bbbbbbbb.', '.BBBBBBBB.'],
    { from: 3, rows: ['.BbKKKKbB.'] }],
  spark: [
    ['..yy..', '.ywwy.', 'ywwwwy', 'ywwwwy', '.ywwy.', '..yy..'],
    { from: 0, rows: ['.y..y.', '..yy..', '.ywwy.', '.ywwy.', '..yy..', '.y..y.'] }],
  athena: [
    ['....yyyyy....', '...yyyyyyy...', '...hhhhhhh...', '..hhhhhhhhh..', '..hHsssskh...', '..hHsssss....', '...Hssss.....',
     '..bwwwwwwb...', '.bswwyyywsb..', '.bswyyyyws.b.', '.b.wwyyww..b.', '..wwwwwww....', '..wwbbbww....', '..wwwwwww....',
     '..wwwwwww....', '..wbwbwbw....', '...ss.ss.....', '...nn.nn.....'],
    { from: 16, rows: ['....ss.ss....', '....nn.nn....'] }],
  zeus: [
    ['...yy.yy.yy....', '...wwwwwwww....', '..wwwwwwwwww...', '..wwsssssww....', '..wwssksksw....', '..wwsssssww....', '..wwwwwwwww....',
     '...wwwwwww.....', '..sswwwwwss....', '.ssbwwwwwbss...', '.ss.bbbbbb.ss..', '.s..wwwwww..s..', '....wwyyww.....', '....bbbbbb.....',
     '....wwwwww.....', '....wbwwbw.....', '....wwwwww.....', '.....ss.ss.....', '....nnn.nnn....'],
    { from: 0, rows: ['..yy.yy.yy.....'] }],
  dog: [
    ['........N.', '.......Nnn', 'N.....nnkn', '.nnnnnnnnn', '.nnnnnnn..', '.n.n..n.n.', '.k.k..k.k.'],
    { from: 5, rows: ['..n.n.n.n.', '..k.k.k.k.'] }],
  chest: [
    ['.NNNNNNNNNN.', 'NnnnnnnnnnnN', 'NyyyyyyyyyyN', 'NnnnnyynnnnN', 'NnnnnyynnnnN', 'NnnnnnnnnnnN', 'NyyyyyyyyyyN', 'NnnnnnnnnnnN', 'NNNNNNNNNNNN'],
    { from: 0, rows: ['.NNNNNNNNNN.', 'NyyyyyyyyyyN', 'NNNNNNNNNNNN', 'NkkkkkkkkkkN', 'NyyyyyyyyyyN'] }],
  // ---- v3 monsters ----
  wolf: [
    ['.........n.n.', '.........nnnn', 'n........nnkn', '.nnnnnnnnnnnw', '.nnnnnnnnnn..', '.nNnnnnnNn...', '.n.n...n.n...', '.k.k...k.k...'],
    { from: 6, rows: ['..n.n.n.n....', '..k.k.k.k....'] }],
  stag: [
    ['...........y.y.y', '...........yyy.y', '............yyy.', '............nnn.', '..NnnnnnnnnNnnkn', '.NnnnnnnnnnNnnnw',
     'N.nnnnnnnnnn.n..', '..nnwwnnnnnn....', '..nN.nN..nN.nN..', '..nN.nN..nN.nN..', '..kk.kk..kk.kk..'],
    { from: 8, rows: ['...nN.nN.nN.nN..', '...nN.nN.nN.nN..', '...kk.kk.kk.kk..'] }],
  boar: [
    ['....NNNNN.....', '..NNnnnnnNN...', '.Nnnnnnnnnnnn.', 'Nnnnnnnnnnnnkn', 'NnnnnnnnnnnnnW', '.nnnnnnnnnnnw.', '..nN.nN..nN.n.', '..nN.nN..nN.n.', '..kk.kk..kk.k.'],
    { from: 6, rows: ['...nN.nN.nN.n.', '...nN.nN.nN.n.', '...kk.kk.kk.k.'] }],
  satyr: [
    ['.n.....n..', '.nn...nn..', '..aaaaa...', '.aaaaaaa..', '.aSsssks..', '.aSsssss..', '..aaass...', '..ssssss..', '.sssssssS.', '.s.SssS.s.', '...nnnn...', '...n..n...', '..nn..nn..'],
    { from: 11, rows: ['....nn....', '...nn.n...'] }],
  panther: [
    ['...........NN.', '..........NnnN', 'N........Nnnyn', '.NnnnnnnnnnnnN', '..nnnnnnnnnnn.', '..n.n....n.n..', '..k.k....k.k..'],
    { from: 5, rows: ['...n.n..n.n...', '...k.k..k.k...'] }],
  centaur: [
    ['.......aaa.....', '......aaaaa....', '......aSsks....', '......aSsss....', '.......sss.....', '.....sssssss...', '....s.ssSss.s..', '......sssss....',
     '......ssss.....', '..NnnnnnnnnN...', '.NnnnnnnnnnnN..', 'N.nnnnnnnnnn...', '..nN.nN.nN.nN..', '..nN.nN.nN.nN..', '..kk.kk.kk.kk..'],
    { from: 12, rows: ['...nN.nN.nN.nN.', '...nN.nN.nN.nN.', '...kk.kk.kk.kk.'] }],
  goat: [
    ['........n.n', '........nn.', '.......wwww', '.......wkwW', 'W.wwwwwwwW.', '.wwwwwwwww.', '.wWwwwwWw..', '.w.w...w.w.', '.k.k...k.k.'],
    { from: 7, rows: ['..w.w.w.w..', '..k.k.k.k..'] }],
  eros: [
    ['....yyy....', '...yyyyy...', 'w..ySsks..w', 'ww.ySsss.ww', 'www.sss.www', '.wwrrrrrww.', '..srrrrrs..', '...rrrrr...', '...s...s...', '...s...s...'],
    { from: 2, rows: ['...ySsks...', 'w..ySsss..w', 'ww..sss..ww', 'wwwrrrrrwww'] }],
  python: [
    ['..............ggy.', '.............ggggk', '..gggg....gggggg..', '.gGGGgg..gGGgg....', 'gg...ggggg..g.....', 'g.....GGG.........'],
    { from: 2, rows: ['...gggg....gggggg.', '..gGGGgg..gGGgg...', '.gg...ggggg..g....', '.g.....GGG........'] }],
  skeleton: [
    ['...wwww...', '..wwwwww..', '..wkwwkw..', '..wwwwww..', '...wkkw...', '....ww....', '..wwwwww..', '.w.wkkw.w.', '.w.wwww.w.', '...wkkw...', '...w..w...', '...w..w...', '..ww..ww..'],
    { from: 10, rows: ['....ww....', '...w..w...', '...ww.ww..'] }],
  crab: [
    ['.o.........o.', 'oo.........oo', '.oo.k...k.oo.', '...ooooooo...', '..ooOoooOoo..', '.o.o.o.o.o.o.', 'o..o.....o..o'],
    { from: 5, rows: ['..o.o.o.o.o..', '.o..o...o..o.'] }],
  triton: [
    ['...cccc...', '..cccccc..', '..cSsskc..', '..cSssss..', '...ssss...', '..ssssss..', '.sssSssss.', '.s.ssss.s.', '...cccc...', '...cCcc...', '....cCc...', '.....cc...', '....c..c..'],
    { from: 10, rows: ['....Ccc...', '....cc....', '...c..c...'] }],
  hippocamp: [
    ['............cc.', '...........cccc', '..........ccckc', '.........cccccc', '.c......cccc...', 'cC.cccccccccc..', '.cCcccccccccc..', '..ccwwcccc.c...', '.........c..c..', '........kk..kk.'],
    { from: 8, rows: ['..........cc...', '.........kk.kk.'] }],
  peacock: [
    ['.ggg.........', 'gbybgg.......', 'gbbbbgg...b..', 'gbybgbgg.bbb.', '.gbbbgbg.bkby', '..ggbbgbbbbb.', '...gggbbbbb..', '.....gbbbb...', '.......y.y...', '.......y.y...', '......yy.yy..'],
    { from: 8, rows: ['......y..y...', '......y..y...', '.....yy..yy..'] }],
  shade: [
    ['...ppp...', '..ppppp..', '.ppPPPpp.', '.pPwPwPp.', '.ppPPPpp.', '.ppppppp.', 'pppppppp.', '.ppppppp.', '.pp.ppp..', '.p..p.p..', '....p....'],
    { from: 8, rows: ['..pp.ppp.', '..p.p..p.', '...p.....'] }],
  cerberus: [
    ['...........NN.NN.', '..........NnnNnnN', '.........NnrnNnrn', '..........nnn.nnn', '.NN......NnnnnNN.', 'N.NnnnnnnnnnnnrnN', '..nnnnnnnnnnnnnn.', '..nNnnnnnnnnnNn..', '..n.n.....n.n....', '..k.k.....k.k....'],
    { from: 8, rows: ['...n.n...n.n.....', '...k.k...k.k.....'] }],
  stand: [['ww', 'ww']],
};
// Monsters that reuse another body with new colours (or a few rows changed).
const SPRITE_VARIANTS = {
  archer:       { base: 'slinger', pal: { N: '#7f2618', r: '#e9c04f', g: '#4f8fc7', G: '#2c5684' } },
  huntress:     { base: 'slinger', pal: { N: '#3a2416', r: '#d5dbe5', g: '#5e7d35', G: '#3e5a22' } },
  sun_archer:   { base: 'slinger', pal: { N: '#a8842a', r: '#f3e9d4', g: '#ffd463', G: '#c9a032' } },
  plague:       { base: 'bandit',  pal: { N: '#4a5a3a', n: '#7a8a5a', o: '#d8e6b0', s: '#c8d0a0', S: '#9aa27a' } },
  berserker:    { base: 'bandit',  pal: { N: '#2a2a30', n: '#c0412e', o: '#e9c04f' } },
  warboar:      { base: 'boar',    pal: { n: '#3a2a22', N: '#1f140c', W: '#f3e9d4' } },
  boar:         { base: 'boar',    pal: { n: '#5a4030', N: '#3a281e', W: '#fff6d8', w: '#fff6d8' } },
  wolf:         { base: 'wolf',    pal: { n: '#8f8f8f', N: '#5f5f5f' } },
  panther:      { base: 'panther', pal: { n: '#3a3a40', N: '#1f1f24' } },
  stag:         { base: 'stag',    pal: { n: '#c9a46b', N: '#8a6a3a', y: '#f3e9d4' } },
  satyr:        { base: 'satyr',   pal: { a: '#5a3a22', n: '#7a5232' } },
  centaur:      { base: 'centaur', pal: { a: '#3a2416', n: '#8a6a4a', N: '#5a3a22' } },
  goat:         { base: 'goat',    pal: { n: '#8a5a34' } },
  eros:         { base: 'eros',    pal: { r: '#f2a7c0', w: '#ffffff' } },
  dove:         { base: 'owl',     pal: { h: '#ffffff', H: '#c9d0dc', y: '#e88aa8', o: '#e88aa8', w: '#ffffff', W: '#e0e4ea' } },
  eagle:        { base: 'owl',     pal: { h: '#8a5a34', H: '#5a3a22', y: '#e9c04f', o: '#e9c04f', w: '#f3e9d4', W: '#f3e9d4' } },
  python:       { base: 'python',  pal: { g: '#6f9a3e', G: '#3e5a22' } },
  skeleton:     { base: 'skeleton', pal: {} },
  spartoi:      { base: 'skeleton', pal: { y: '#c9a032' }, rows: { 0: '..yyyyyy..', 1: '.yyyyyyyy.' } },
  crab:         { base: 'crab',    pal: { o: '#e07a3a', O: '#a04a1a' } },
  triton:       { base: 'triton',  pal: { s: '#b8d8c8', S: '#7fa898' } },
  hippocamp:    { base: 'hippocamp', pal: { w: '#7fd0c8' } },
  peacock:      { base: 'peacock', pal: { g: '#3f9a8a', b: '#2c5684' } },
  gigas:        { base: 'cyclops', pal: { s: '#8a9a6a', S: '#5a6a4a', n: '#3a2a22', N: '#1f140c' }, rows: { 2: '...ssssssssss...', 3: '...sskssssksss..', 4: '...ssssssssss...' } },
  storm_cyclops:{ base: 'cyclops', pal: { s: '#7a8aa8', S: '#4d5a72', n: '#2e3648', N: '#1f2430', b: '#57c2b0' } },
  argus:        { base: 'cyclops', pal: { s: '#e8c8a8', S: '#b98f6f', n: '#2c5684', N: '#1a3352', b: '#2c5684' },
                  rows: { 7: '..ssbsssssbsss..', 8: '.ssssSbSSbSssss.', 9: 'sbssSsssssbSssbs', 10: 'sss.SsbsssSs.sss' } },
  hound:        { base: 'dog',     pal: { n: '#c9a032', N: '#8f6c1c', k: '#ff8a2b' } },
  automaton:    { base: 'hoplite', pal: { r: '#8f6c1c', R: '#5a4410', y: '#c9a032', Y: '#8f6c1c', s: '#d9b860', k: '#ff8a2b', n: '#5a4410' } },
  talos:        { base: 'hoplite', pal: { r: '#a8842a', R: '#6b5216', y: '#e9c04f', Y: '#a8842a', s: '#e9c04f', k: '#ff5a3c', n: '#6b5216' } },
  shade:        { base: 'shade',   pal: { p: '#6b5a8a', P: '#3a2f4a', w: '#c8b8ff' } },
  fury:         { base: 'harpy',   pal: { p: '#7f2618', P: '#4a1410', N: '#140d0b', s: '#a8a0a0', w: '#c0412e' } },
  cerberus:     { base: 'cerberus', pal: { n: '#2a2a30', N: '#0e0e12', r: '#ff5a3c' } },
};

// Gods share one robed body; each god changes its colours and a few rows (hair, crown, beard).
// In a patch row, '_' keeps the base pixel.
const GOD_BASE = [
  '.............', '....aaaaa....', '...aaaaaaa...', '..aaaaaaaaa..', '..aaAssssss..', '..aAsssksS...', '..aAsssssS...',
  '...A.SssS....', '...dcccccd...', '..sccCccccs..', '.ss.cCcccc.s.', '.s..cCccdc.s.', '....ddddd....', '...ccCcccc...',
  '...ccCcccc...', '..cccCccccc..', '..cCCCCCCCc..', '....ss.ss....', '....ff.ff....',
];
const GOD_WALK = { from: 17, rows: ['...ss...ss...', '...ff...ff...'] };
const GOD_LOOKS = {
  artemis:    { pal: { a: '#3a2416', A: '#24160c', c: '#5e7d35', C: '#3e5a22', d: '#d5dbe5', f: '#8a5a34' },
                rows: { 0: '..aa.........', 1: '.aaaaaaa.....', 3: '__dddddddd___', 15: '...ccCcccc...', 16: '...cCCCCc....', 17: '....ss.ss....' } },
  dionysus:   { pal: { a: '#2e211b', A: '#1a1210', c: '#7a4f9c', C: '#4a2f63', d: '#e9c04f', f: '#5a3a22', g: '#4e8a3a', G: '#2f5a22', p: '#9a6bc0' },
                rows: { 0: '...g.g.g.....', 1: '...gGgGgg....', 2: '..ggaaaagg...', 3: '.pgaaaaaaag..' } },
  aphrodite:  { pal: { a: '#e9c04f', A: '#a8842a', c: '#f2a7c0', C: '#c76d8e', d: '#e9c04f', f: '#e9c04f' },
                rows: { 7: '..aA.SssS....', 8: '..adcccccd...', 9: '..accCccccs..', 10: '.sa.cCcccc.s.', 11: '.s..cCccdc.s.' } },
  apollo:     { pal: { a: '#ffd463', A: '#c9a032', c: '#f3e9d4', C: '#c2b293', d: '#ffd463', f: '#c9a032', g: '#6f9a3e' },
                rows: { 2: '...gagagag...', 3: '..gaaaaaaag..' } },
  ares:       { pal: { a: '#3a3a40', A: '#1f1f24', c: '#7f2618', C: '#4a1410', d: '#a8842a', f: '#3a3a40', r: '#c0412e' },
                rows: { 0: '..rrrrr......', 1: '.rrrrrraaa...', 2: '.r.aaaaaaa...', 4: '..aAaAsssss..', 5: '..aAasskS....', 6: '..aAasssS....' } },
  poseidon:   { pal: { a: '#e6e1d6', A: '#b5b0a6', c: '#57c2b0', C: '#2c7a70', d: '#e9c04f', f: '#2c7a70', y: '#e9c04f' },
                rows: { 0: '...y.y.y.....', 1: '...yyyyy.....', 6: '..aAaaaaa....', 7: '...Aaaaa.....', 8: '...daaaad....' } },
  hera:       { pal: { a: '#2e211b', A: '#1a1210', c: '#5b9bd5', C: '#2c5684', d: '#f3e9d4', f: '#e9c04f', y: '#e9c04f', Y: '#a8842a' },
                rows: { 0: '...yyyyy.....', 1: '...yYyYy.....', 2: '...yyyyyy....' } },
  hephaestus: { pal: { a: '#2e211b', A: '#1a1210', c: '#6b4528', C: '#4e321d', d: '#9aa0a6', f: '#3a2416', s: '#c99a76', S: '#9a6f50' },
                rows: { 1: '.............', 2: '....aaaa.....', 3: '...aaaaaa....', 6: '..aAaaaaa....', 7: '...Aaaaa.....', 9: '.sscCccccss..', 10: '.ss.cCcccc.ss' } },
  hades:      { pal: { a: '#1f1f24', A: '#0e0e12', c: '#2a1f3a', C: '#140e1e', d: '#7fe08a', f: '#1f1f24', s: '#c9c3cf', S: '#8f8a96', k: '#2f8a4a', g: '#7fe08a' },
                rows: { 0: '..a.a.a.a....', 1: '..aaaaaaa....', 3: '.aaaaaaaaa...', 4: '.aaaAsssss...', 5: '.aaAsssksS...', 6: '.aaAsssssS...', 7: '.aaA.SssS....' } },
  pan:        { pal: { a: '#5a3a22', A: '#3a2416', c: '#7a5232', C: '#5a3a22', d: '#7fa548', f: '#3a2416', n: '#c9a46b' },
                rows: { 0: '..n....n.....', 1: '..nn.aann....', 9: '..sccCccccs..', 13: '...ccCcccc...', 16: '...cc..cc....', 17: '...cc..cc....', 18: '..ff...ff....' } },
  hecate:     { pal: { a: '#2c3a6a', A: '#1a2442', c: '#2c3a6a', C: '#1a2442', d: '#57c2b0', f: '#1a2442', s: '#b8c0d8', S: '#8a92aa' },
                rows: { 3: '.aaaaaaaaa...', 4: '.aaaAsssss...', 5: '.aaAsssksS...', 6: '.aaAsssssS...', 7: '.aaA.SssS....' } },
  nemesis:    { pal: { a: '#c9bda4', A: '#8f846c', c: '#d8d2c4', C: '#a39d91', d: '#e9c04f', f: '#8f846c', w: '#ffffff', W: '#c9d0dc' },
                rows: { 8: 'ww.dcccccd...', 9: 'wwsccCccccs..', 10: '.Ws.cCcccc.s.' } },
  eris:       { pal: { a: '#7f2618', A: '#4a1410', c: '#1f1f24', C: '#0e0e12', d: '#c0412e', f: '#1f1f24' },
                rows: { 0: '..a.a..a.....', 1: '.aaaaaaa.a...', 2: 'aaaaaaaaaa...', 4: '.aaaAssssss..', 6: 'a.aAsssssS...' } },
  hypnos:     { pal: { a: '#e6e1d6', A: '#b5b0a6', c: '#2c3a6a', C: '#1a2442', d: '#c8b8ff', f: '#1a2442', w: '#ffffff' },
                rows: { 1: 'w...aaaaa....', 2: 'ww.aaaaaaa...', 3: 'www.aaaaaaa..' } },
};

// Villagers: a few body shapes recoloured per person (a = hair, c = clothes, C = clothes shade, d = trim).
const NPC_BASES = {
  man:      [['...aaaa...', '..aaaaaa..', '..aSsssa..', '..Ssskss..', '..Sssss...', '...sss....', '..cccccc..', '.scccccccs', '.scdddccs.', '..cccccc..', '..cCCCCc..', '...s..s...', '...n..n...'],
             { from: 11, rows: ['....ss....', '....nn....'] }],
  manBeard: [['...aaaa...', '..aaaaaa..', '..aSsssa..', '..Ssskss..', '..aaaaa...', '...aaa....', '..cccccc..', '.scccccccs', '.scdddccs.', '..cccccc..', '..cCCCCc..', '...s..s...', '...n..n...'],
             { from: 11, rows: ['....ss....', '....nn....'] }],
  woman:    [['...aaaa...', '..aaaaaa..', '.aaSsssa..', '.aaSsksa..', '.aa.ssss..', '..a.sss...', '..cccccc..', '.scccccccs', '.sccddccs.', '..cccccc..', '..cccccc..', '.cccccccc.', '.CCCCCCCC.'],
             { from: 11, rows: ['..cccccc..', '.CCCCCCCC.'] }],
};
const NPC_LOOKS = {
  smith:     { base: 'manBeard', pal: { a: '#2e211b', c: '#6b4528', C: '#4e321d', d: '#9aa0a6' } },
  herald:    { base: 'man',      pal: { a: '#5a3a22', c: '#4f8fc7', C: '#2c5684', d: '#e9c04f' } },
  keeper:    { base: 'woman',    pal: { a: '#7fa548', c: '#a39a5c', C: '#7d7546', d: '#e9c04f' } },
  oracle:    { base: 'woman',    pal: { a: '#4a2f63', c: '#7a4f9c', C: '#4a2f63', d: '#e9c04f' } },
  suitor:    { base: 'man',      pal: { a: '#3a2416', c: '#e88aa8', C: '#b85a78', d: '#f3e9d4' } },
  maenad:    { base: 'woman',    pal: { a: '#4a2f63', c: '#7a4f9c', C: '#4a2f63', d: '#4e8a3a' } },
  priestess: { base: 'woman',    pal: { a: '#2e211b', c: '#f3e9d4', C: '#c2b293', d: '#5b9bd5' } },
  merchant:  { base: 'woman',    pal: { a: '#2e211b', c: '#c0412e', C: '#7f2618', d: '#e9c04f' } },
};

/* ---- icons ---- */
const ICON_DATA = {
  bandit_cloth:   ['........', '.nnnnnn.', '.nNnnnn.', '.nnnnNn.', '.nnNnnn.', '.nnnnnN.', '..nnnnn.', '........'],
  stolen_ring:    ['...bb...', '..bBBb..', '..yyyy..', '.y....y.', '.y....y.', '.y....y.', '..yyyy..', '........'],
  sling_cord:     ['..WWWW..', '.W.ww.W.', 'W.w..w.W', 'W.w.Ww.W', 'W.w....W', '.W.www.W', '..WWWWW.', '........'],
  smooth_stone:   ['........', '..hhhh..', '.hwhhhH.', '.hhhhhH.', '.hhhhHH.', '..HHHH..', '........', '........'],
  cattle_hide:    ['.n....n.', 'nnnnnnnn', '.nNnnnn.', '.nnnnNn.', '.nNnnnn.', 'nnnnnnnn', '.n....n.', '........'],
  golden_horn:    ['......y.', '.....yy.', '....yyY.', '...yyY..', '..yyY...', '.wyY....', '.ww.....', '........'],
  winged_feather: ['......w.', '.....ww.', '....wwW.', '...wwW..', '..wwW...', '..wW....', '.W......', 'W.......'],
  herald_token:   ['..yyyy..', '.yYYYYy.', 'yYwwyYYy', 'yYYwwyYy', 'yYYYwwYy', 'yYYYYYYy', '.yYYYYy.', '..yyyy..'],
  owl_quill:      ['......h.', '.....hh.', '....hhH.', '...hhH..', '..hhH...', '..hH....', '.H......', 'H.......'],
  silver_talon:   ['..hh....', '.hwh....', '.h..h...', '....h...', '....h...', '...hh...', '..hH....', '........'],
  cedar_shaft:    ['.......h', '......hh', '.....n..', '....n...', '...n....', '.wn.....', 'w.w.....', '.w......'],
  bronze_plate:   ['........', '.yyyyyy.', '.yYyyYy.', '.yyyyyy.', '.yYyyYy.', '.yyyyyy.', '..YYYY..', '........'],
  hoplite_crest:  ['..rrrr..', '.rrrrrr.', 'rrRRRRrr', 'r......r', '..yyyy..', '.yyyyyy.', '.y....y.', '........'],
  aegis_scale:    ['...yy...', '..yYYy..', '.yYwwYy.', '.yYwwYy.', '.yYYYYy.', '..yYYy..', '...yy...', '........'],
  wisdom_token:   ['..hhhh..', '.hHHHHh.', 'hHwHHwHh', 'hHHkkHHh', 'hHHwwHHh', 'hHHHHHHh', '.hHHHHh.', '..hhhh..'],
  harpy_talon:    ['.NN.....', 'N..N....', '....N...', '....N...', '...NN...', '..N.N...', '.N..N...', '........'],
  storm_glass:    ['...c....', '..ccb...', '..cwc...', '.ccwcb..', '.cccbb..', '..ccb...', '...b....', '........'],
  cyclops_hide:   ['.H....H.', 'HHHHHHHH', '.HhHHHH.', '.HHHHhH.', '.HhHHHH.', 'HHHHHHHH', '.H....H.', '........'],
  cyclops_eye:    ['..wwww..', '.wwwwww.', 'wwbbbbww', 'wwbkkbww', 'wwbkkbww', 'wwbbbbww', '.wwwwww.', '..wwww..'],
  spark_dust:     ['........', '..y..y..', '...yy...', '.yycyy..', '...yy...', '..y..y..', '........', '........'],
  thunder_core:   ['....yy..', '...yy...', '..yyyyy.', '....yy..', '...yy...', '..yy....', '.yy.....', '........'],
  olympian_token: ['..yyyy..', '.yYYYYy.', 'yYYYwYYy', 'yYYwwYYy', 'yYYYwwYy', 'yYYYwYYy', '.yYYYYy.', '..yyyy..'],
  bronze_sword:   ['........y.', '.......yy.', '......yy..', '.....yy...', '....yy....', '.Y.yy.....', '..YY......', '..nY......', '.n..Y.....', '..........'],
  bandit_spear:   ['.........h', '........hh', '.......nh.', '......n...', '.....n....', '....n.....', '...n......', '..n.......', '.n........', 'n.........'],
  hill_bow:       ['...nnw....', '..n..w....', '.n...w....', '.n...w....', '.n...w....', '.n...w....', '..n..w....', '...nnw....'],
  bull_maul:      ['....hhhh..', '...hhhhhh.', '...HhhhhH.', '....HnHH..', '....n.....', '...n......', '..n.......', '.n........', 'n.........', '..........'],
  harpe:          ['h......h..', '.h....h...', '..h..h....', '...hh.....', '...hh.....', '..y..y....', '.n....n...', 'n......n..'],
  owl_bow:        ['...HHw....', '..H..w....', '.H...w....', '.H...w....', '.H...w....', '.H...w....', '..H..w....', '...HHw....'],
  hoplite_dory:   ['.........y', '........yy', '.......Ny.', '......N...', '.....N....', '....N.....', '...N......', '..N.......', '.N........', 'y.........'],
  athena_spear:   ['.........w', '........ww', '.......yw.', '......y...', '.....y....', '....y.....', '...y......', '..y.......', '.y........', 'b.........'],
  storm_fangs:    ['c......c..', '.c....c...', '..c..c....', '...cc.....', '...cc.....', '..b..b....', '.N....N...', 'N......N..'],
  cyclops_club:   ['....NNN...', '...NnnnN..', '...nnhnn..', '...nnnnn..', '....nnn...', '....Nn....', '...Nn.....', '..Nn......', '.Nn.......', 'N.........'],
  keraunos:       ['........y.', '.......yy.', '......yw..', '.....yy...', '....wy....', '.Y.yy.....', '..YY......', '..bY......', '.b..Y.....', '..........'],
};
// Templates for item icons that only give colours: a = main, b = shade, c = accent.
const ICON_TEMPLATES = {
  hide:    ['.a....a.', 'aaaaaaaa', '.abaaaa.', '.aaaaba.', '.abaaaa.', 'aaaaaaaa', '.a....a.', '........'],
  fang:    ['......a.', '.....aa.', '....aab.', '...aab..', '..aab...', '.aab....', '.ab.....', 'b.......'],
  shard:   ['...a....', '..aab...', '..aab...', '.aaabb..', '.aabbb..', '..abb...', '...b....', '........'],
  horn:    ['......a.', '.....aa.', '....aab.', '...aab..', '..aab...', '.cab....', '.cc.....', '........'],
  gem:     ['...aa...', '..acaa..', '.acaaab.', '.aaaabb.', '..abbb..', '...bb...', '........', '........'],
  coin:    ['..aaaa..', '.abbbba.', 'abccbbba', 'abbccbba', 'abbbccba', 'abbbbbba', '.abbbba.', '..aaaa..'],
  grape:   ['....c...', '...cc...', '..aa.a..', '.aaaaab.', '.aaabab.', '..abab..', '...ab...', '........'],
  flower:  ['..a.a...', '.aacaa..', '..aaa...', '.a.b....', '...b....', '..bb.b..', '...bb...', '........'],
  bone:    ['aa......', 'aab.....', '.abb....', '..abb...', '...abb..', '....abba', '.....baa', '......a.'],
  vial:    ['...cc...', '...aa...', '..abba..', '.abbbba.', '.abbbba.', '.abbbba.', '..aaaa..', '........'],
  cloth:   ['........', '.aaaaaa.', '.abaaaa.', '.aaaaba.', '.aabaaa.', '.aaaaab.', '..aaaaa.', '........'],
  feather: ['......a.', '.....aa.', '....aab.', '...aab..', '..aab...', '..ab....', '.c......', 'c.......'],
  arrow:   ['......cc', '.....bcc', '....b...', '...b....', '..b.....', 'aab.....', 'aa......', 'a.......'],
  orb:     ['..aaaa..', '.acaaaa.', 'acaaaaab', 'aaaaaaab', 'aaaaaabb', 'aaaaabbb', '.abbbbb.', '..bbbb..'],
  scale:   ['...aa...', '..abba..', '.abccba.', '.abccba.', '.abbbba.', '..abba..', '...aa...', '........'],
  tooth:   ['.aaaa...', 'aaaaab..', 'aaaaab..', '.aaab...', '.aa.b...', '.a..b...', '........', '........'],
  plate:   ['........', '.aaaaaa.', '.abaaba.', '.aaaaaa.', '.abaaba.', '.aaaaaa.', '..bbbb..', '........'],
  shell:   ['...a....', '..aab...', '.aabab..', 'aababab.', 'aababab.', '.abbbbb.', '..bbb...', '........'],
  claw:    ['.aa.....', 'a..a....', '....a...', '....ab..', '...abb..', '..abb...', '.ab.....', '........'],
  eye:     ['..aaaa..', '.aaaaaa.', 'aabbbbaa', 'aabccbaa', 'aabccbaa', 'aabbbbaa', '.aaaaaa.', '..aaaa..'],
  gear:    ['...a....', '.a.aa.a.', '..abba..', 'aabccbaa', '.abccba.', '..abba..', '.a.aa.a.', '....a...'],
  ember:   ['...a....', '..aa....', '..aca...', '.aacca..', '.acccba.', '.abbbba.', '..bbbb..', '........'],
};
// Weapon icons for gear without a hand-drawn icon: built from the kind with two colours (blade, grip).
const WEAPON_ICON_T = {
  sword:   ['........a.', '.......aa.', '......aa..', '.....aa...', '....aa....', '.b.aa.....', '..bb......', '..cb......', '.c..b.....', '..........'],
  spear:   ['.........a', '........aa', '.......ca.', '......c...', '.....c....', '....c.....', '...c......', '..c.......', '.c........', 'c.........'],
  hammer:  ['....aaaa..', '...aaaaaa.', '...baaaab.', '....bcbb..', '....c.....', '...c......', '..c.......', '.c........', 'c.........', '..........'],
  daggers: ['a......a..', '.a....a...', '..a..a....', '...aa.....', '...aa.....', '..b..b....', '.c....c...', 'c......c..'],
  bow:     ['...cca....', '..c..a....', '.c...a....', '.c...a....', '.c...a....', '.c...a....', '..c..a....', '...cca....'],
};
const WEAPON_COLORS = {
  stag_spear: ['#f3e9d4', '#c9a46b', '#8a5a34'], wolf_fangs: ['#f3e9d4', '#8f8f8f', '#5f5f5f'], silver_bow: ['#ffffff', '#d5dbe5', '#8f98a8'],
  satyr_club: ['#7a5232', '#5a3a22', '#5a3a22'], thyrsus: ['#4e8a3a', '#7a4f9c', '#8a5a34'], wild_maul: ['#c9a46b', '#7a5232', '#5a3a22'],
  myrtle_spear: ['#f2a7c0', '#e88aa8', '#6b8a3a'], rose_blade: ['#f2a7c0', '#e9c04f', '#c76d8e'], laurel_bow: ['#ffd463', '#6f9a3e', '#3e5a22'],
  sunblade: ['#ffd463', '#ffffff', '#c9a032'], witchfire_daggers: ['#57c2b0', '#2c5684', '#1a2442'], spartoi_spear: ['#f3e9d4', '#c9a032', '#8a5a34'],
  ares_warblade: ['#c0412e', '#3a3a40', '#1f1f24'], retribution: ['#d5dbe5', '#e9c04f', '#8f846c'], coral_daggers: ['#e07a3a', '#7fd0c8', '#a04a1a'],
  trident: ['#57c2b0', '#e9c04f', '#2c7a70'], peacock_bow: ['#e9c04f', '#3f9a8a', '#2c5684'], hera_scepter: ['#e9c04f', '#5b9bd5', '#a8842a'],
  discord_bow: ['#e9c04f', '#c0412e', '#1f1f24'], automaton_blade: ['#c9a032', '#ff8a2b', '#8f6c1c'], forge_hammer: ['#4b4f57', '#ff8a2b', '#6b4528'],
  stygian_daggers: ['#7fd0c8', '#3c6a5a', '#1f1f24'], bident: ['#7fe08a', '#2a1f3a', '#1f1f24'], dream_daggers: ['#c8b8ff', '#2c3a6a', '#1a2442'],
  ...TITAN_WEAPON_COLORS,
};
// Armor piece and shield icons, coloured from the set.
const PIECE_ICON_T = {
  head:  ['..aaaa..', '.aaaaaa.', 'aaaaaaab', 'aab..aab', 'ab....ab', 'ab....ab', '........', '........'],
  chest: ['.a....a.', 'aaaaaaaa', 'aaacaaab', '.aacaab.', '.aaaaab.', '.cccccb.', '.aaaaab.', '........'],
  legs:  ['.cccccc.', '.aaaaab.', '.aab.ab.', '.aab.ab.', '.aab.ab.', '.ab..ab.', '.ab..ab.', '........'],
  feet:  ['........', '.aa..aa.', '.ab..ab.', '.ab..ab.', 'aab.aab.', 'aaa.aaa.', '........', '........'],
  shield:['..aaaa..', '.abbbba.', 'abbccbba', 'abcccbba', 'abbccbba', 'abbbbbba', '.abbbba.', '..aaaa..'],
};

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function makeSprite(rows, outline = OUTLINE, pal = PAL) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = mkCanvas(w + 2, h + 2), x = c.getContext('2d');
  const filled = (i, j) => j >= 0 && j < h && i >= 0 && i < rows[j].length && rows[j][i] !== '.';
  if (outline) {
    x.fillStyle = outline;
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      if (filled(i, j)) continue;
      if (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1)) x.fillRect(i + 1, j + 1, 1, 1);
    }
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i]; if (ch === '.') continue;
    x.fillStyle = pal[ch] || '#f0f'; x.fillRect(i + 1, j + 1, 1, 1);
  }
  return c;
}
function flipCanvas(src) { const c = mkCanvas(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
function solidCanvas(src, color) { const c = mkCanvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; }
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
// Re-shades a sprite by brightness into a colour ramp (used for stone and gold statues).
function toneCanvas(src, ramp) {
  const c = mkCanvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), cols = ramp.map(hexRgb);
  for (let i = 0; i < d.data.length; i += 4) {
    if (!d.data[i + 3]) continue;
    const l = (d.data[i] * .3 + d.data[i + 1] * .59 + d.data[i + 2] * .11) / 255;
    const col = cols[Math.min(cols.length - 1, Math.floor(l * cols.length))];
    d.data[i] = col[0]; d.data[i + 1] = col[1]; d.data[i + 2] = col[2];
  }
  x.putImageData(d, 0, 0); return c;
}
function patchRows(base, patch) {
  const rows = base.slice();
  for (const [i, r] of Object.entries(patch || {})) {
    const b = rows[i] || '';
    let out = '';
    for (let k = 0; k < Math.max(r.length, b.length); k++) { const ch = r[k]; out += ch === undefined || ch === '_' ? (b[k] || '.') : ch; }
    rows[i] = out;
  }
  return rows;
}
function framesFrom(def, pal = PAL) {
  const base = def[0], frames = [base];
  for (const alt of def.slice(1)) { const rows = base.slice(); alt.rows.forEach((r, i) => { rows[alt.from + i] = r; }); frames.push(rows); }
  return frames.map(rows => {
    const n = makeSprite(rows, OUTLINE, pal), f = flipCanvas(n);
    return { n, f, wn: solidCanvas(n, '#ffffff'), wf: solidCanvas(f, '#ffffff'), gn: solidCanvas(n, '#ebc152'), gf: solidCanvas(f, '#ebc152'), w: n.width, h: n.height };
  });
}
const buildFrames = framesFrom;
const SPR = {};
for (const [name, def] of Object.entries(SPRITE_DATA)) SPR[name] = buildFrames(def);
for (const [name, v] of Object.entries(SPRITE_VARIANTS)) {
  const b = SPRITE_DATA[v.base], def = [patchRows(b[0], v.rows), ...b.slice(1)];
  SPR[name] = buildFrames(def, Object.assign({}, PAL, v.pal));
}
for (const [name, look] of Object.entries(GOD_LOOKS)) SPR[name] = buildFrames([patchRows(GOD_BASE, look.rows), GOD_WALK], Object.assign({}, PAL, look.pal));
for (const [name, look] of Object.entries(NPC_LOOKS)) SPR[name] = buildFrames(NPC_BASES[look.base], Object.assign({}, PAL, look.pal));
const STONE = ['#4a463f', '#77716a', '#a39d91', '#cfc9bc', '#ebe6db'], GOLDR = ['#5c4410', '#8f6c1c', '#c9a032', '#e9c04f', '#fff0b0'];

// Icons for every item, weapon, armor piece and shield.
const ICON_CANVAS = {};
function iconCanvas(id) {
  if (ICON_CANVAS[id]) return ICON_CANVAS[id];
  let c = null;
  const r = rankOf(id);
  if (r) {                                   // High and God Rank forms: the base icon, recoloured, with a rank gem in the corner
    const b = iconCanvas(baseId(id)); if (!b) return null;
    c = mkCanvas(b.width + 1, b.height + 1); const x = c.getContext('2d'); x.drawImage(recolorCanvas(b, r), 0, 1);
    const col = RANK_TINT[r].trim; x.fillStyle = OUTLINE; x.fillRect(c.width - 4, 0, 4, 4); x.fillStyle = col; x.fillRect(c.width - 3, 1, 2, 2);
    if (r === 2) { x.fillStyle = '#ffffff'; x.fillRect(c.width - 3, 1, 1, 1); }
    return (ICON_CANVAS[id] = c);
  }
  if (ICON_DATA[id]) c = makeSprite(ICON_DATA[id]);
  else if (ITEMS[id] && ITEMS[id].icon) { const [t, a, b, cc] = ITEMS[id].icon; c = makeSprite(ICON_TEMPLATES[t], OUTLINE, { a, b: b || a, c: cc || a }); }
  else if (WEAPONS[id]) { const [a, b, cc] = WEAPON_COLORS[id] || ['#c7ccd1', '#8a5a34', '#5a3a22']; c = makeSprite(WEAPON_ICON_T[WEAPONS[id].kind], OUTLINE, { a, b, c: cc }); }
  else if (PIECES[id]) {
    const P = PIECES[id], col = ARMOR_SETS[P.set].colors[P.slot];
    c = makeSprite(PIECE_ICON_T[P.slot], OUTLINE, { a: col[0], b: col[1], c: (P.slot === 'chest' ? col[2] : null) || (P.slot === 'legs' ? ARMOR_SETS[P.set].colors.chest[0] : col[1]) });
  }
  else if (SHIELDS[id]) { const [a, b, cc] = SHIELDS[id].colors; c = makeSprite(PIECE_ICON_T.shield, OUTLINE, { a, b, c: cc }); }
  else if (id.startsWith('potion:')) { const [a, b, cc] = POTIONS[id.slice(7)].col; c = makeSprite(['...cc...', '...ww...', '..waaw..', '.waaaab.', '.wacaab.', '.aaaabb.', '..abbb..', '........'], OUTLINE, { a, b, c: cc, w: '#e6e1d6' }); }
  else if (ITEMS[id]) c = makeSprite(ICON_TEMPLATES.shard, OUTLINE, { a: '#d8ccb4', b: '#85735d', c: '#ffffff' });
  return (ICON_CANVAS[id] = c);
}
const ICONS = {};
function icon(id) { if (ICONS[id]) return ICONS[id]; const c = iconCanvas(id); if (!c) return ''; return (ICONS[id] = c.toDataURL()); }
const ITEM_SPR = new Proxy({}, { get: (_, id) => iconCanvas(id) });

/* ---- the hero: built from the four armor pieces you wear ---- */
// Codes: i/I/c = head piece, a/A/t = chest, l/L = legs, f/F = feet, s/S = skin, k = eye, h/H = hair.
// The first four rows are empty so crests, wings and crowns have room.
const HERO_BODY = [
  '............', '............', '............', '............',
  '....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hHhhssss..', '..hHsssks...', '..hHsssss...', '...H.sss....',
  '..taaaaat...', '.saaAaaaas..', '.saaAaaaas..', '.s.aAaaa.s..', '...tttttt...', '...aAaaaa...',
  '...ll..ll...', '...lL..lL...', '...ff..ff...',
];
const HERO_WALK = { from: 17, rows: ['....ll.l....', '....lL.L....', '....ff.ff...'] };
const HEAD_SHAPES = {
  hair:   null,
  cap:    { 4: '....iiii....', 5: '...iiiiii...', 6: '..iiiiiiii..', 7: '..iIiiiiii..', 8: '..iIsssks...', 9: '..iIsssss...', 10: '...I.sss....' },
  hood:   { 4: '....iiii....', 5: '...iiiiii...', 6: '..iiiiiiii..', 7: '.iiIiissss..', 8: '.iiIsssks...', 9: '.iiIsssss...', 10: '.ii..sss....', 11: '.It_________' },
  wreath: { 6: '..iIiIiIii..' },
};
const HEAD_EXTRAS = {
  crest:   { 1: '...ccccc....', 2: '..ccccccc...', 3: '.cc.........', 4: '.c__________' },
  wings:   { 2: '.c........c.', 3: 'cc.......cc.', 4: 'ccc_____cc__' },
  horns:   { 2: '..c.....c...', 3: '..cc...cc...' },
  antlers: { 0: '.c.c...c.c..', 1: '.ccc...ccc..', 2: '..c.....c...', 3: '..c.....c...' },
  laurel:  {},
  ivy:     { 10: '_c__________', 11: '_c__________' },
  roses:   { 6: '..cicicici..' },
  rays:    { 1: '...c..c..c..', 2: '....c.c.c...', 3: '..c.......c.' },
  crown:   { 2: '..c.c.c.c...', 3: '..cccccccc..' },
  spikes:  { 1: '...c...c....', 2: '..cc..cc.c..', 3: '..ccccccc...' },
  fins:    { 1: '.....c......', 2: '....ccc.....', 3: '...ccccc....' },
  shell:   { 2: '....c.c.....', 3: '...ccccc....' },
  plume:   { 0: '.cc.........', 1: 'cccc........', 2: '.cc.........', 3: '..c.........' },
  flame:   { 1: '.....c......', 2: '....ccc.....', 3: '....cIc.....' },
  hood:    {},
};
const HEAD_STYLE = { hood: 'hood', laurel: 'wreath', ivy: 'wreath', roses: 'wreath', rays: 'wreath', crown: 'wreath', antlers: 'wreath' };
const HERO_CACHE = {};
function heroKey(eq, shield) { return SLOTS.map(s => eq[s]).join('|'); }
// eq = { head: setId, chest: setId, legs: setId, feet: setId }
function heroFrames(eq) {
  const key = heroKey(eq);
  if (HERO_CACHE[key]) return HERO_CACHE[key];
  const H = ARMOR_SETS[eq.head] || ARMOR_SETS.traveler, C = ARMOR_SETS[eq.chest] || ARMOR_SETS.traveler;
  const L = ARMOR_SETS[eq.legs] || ARMOR_SETS.traveler, F = ARMOR_SETS[eq.feet] || ARMOR_SETS.traveler;
  const extra = H === ARMOR_SETS.traveler ? null : H.extra, style = extra ? (HEAD_STYLE[extra] || 'cap') : 'hair';
  let rows = patchRows(HERO_BODY, HEAD_SHAPES[style]);
  if (extra) rows = patchRows(rows, HEAD_EXTRAS[extra]);
  const hc = H.colors.head, cc = C.colors.chest, lc = L.colors.legs, fc = F.colors.feet;
  const hair = style === 'hair' && H === ARMOR_SETS.traveler ? hc : ['#5a3a22', '#3a2416'];
  // High and God Rank: spiked pauldrons on the chest piece, glowing eyes under the helmet, spiked knees.
  const cr = C.rank || 0, hr = H.rank || 0, lr = L.rank || 0;
  if (cr) rows = patchRows(rows, { 9: '_p_______p__', 10: '_pp_____pp__', 11: '_p_________' });
  if (lr) rows = patchRows(rows, { 17: '__q_________' });
  const pal = Object.assign({}, PAL, {
    h: hair[0], H: hair[1], i: hc[0], I: hc[1], c: hc[2] || hc[0],
    a: cc[0], A: cc[1], t: cc[2] || cc[1], l: lc[0], L: lc[1], f: fc[0], F: fc[1],
    p: cr ? RANK_TINT[cr].trim : '#000', q: lr ? RANK_TINT[lr].trim : '#000',
  });
  if (hr && extra) pal.k = RANK_TINT[hr].trim;
  return (HERO_CACHE[key] = buildFrames([rows, HERO_WALK], pal));
}


