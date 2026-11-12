/* ============================== THE NORTH: art ============================== */
// Placeholder pixel art in the same text-grid style as 20_art.js, mostly the existing bodies recoloured and patched.
// Swap any of these for hand-made art: a sprite only has to keep its name.
{
  // monsters: another body with new colours (pal) and a few rows changed (rows; '_' keeps the base pixel)
  const V = {
    einherjar:   { base: 'hoplite',  pal: { r: '#7f8898', y: '#c7ccd1', Y: '#7f8898', s: '#d8c8b8', n: '#4e321d' }, rows: { 0: '...........', 1: '....yyy....' } },
    warden:      { base: 'hoplite',  pal: { r: '#5f6878', y: '#9aa0a6', Y: '#5f6878', s: '#e8b796', n: '#3a2416', c: '#57c2b0' }, rows: { 0: '....cccc...', 1: '...cccccc..' } },
    shieldmaiden:{ base: 'hoplite',  pal: { r: '#7f2618', y: '#f3e9d4', Y: '#c2b293', s: '#e8b796', n: '#3a2416', a: '#e9c04f' }, rows: { 0: '...........', 1: '...aaaa....', 9: '.srrrrryaYy' } },
    hornbearer:  { base: 'bandit',   pal: { N: '#5a3a22', n: '#8a5a34', o: '#ffd463', s: '#e8b796' }, rows: { 0: '.w.NNNN.w.' } },
    ulfhednar:   { base: 'bandit',   pal: { N: '#3a3a44', n: '#5f5f6a', o: '#c0412e', s: '#e8b796' }, rows: { 0: '..NN..NN..' } },
    axethrower:  { base: 'slinger',  pal: { N: '#5a3a22', r: '#c7ccd1', g: '#8a5a34', G: '#6b4528' } },
    draugr:      { base: 'skeleton', pal: { w: '#8fb0a4', k: '#1e2e2a', e: '#7fe08a' }, rows: { 2: '..wewwew..' } },
    skogkatt:    { base: 'panther',  pal: { n: '#a7998a', N: '#6e6257', y: '#ffd463' } },
    valkyrie:    { base: 'harpy',    pal: { p: '#ffffff', P: '#c9d0dc', N: '#d5dbe5', s: '#e8b796', w: '#c7ccd1', y: '#ffd463' } },
    seidkona:    { base: 'acolyte',  pal: { B: '#4a2f63', b: '#6b4a8a', K: '#2a1a3a', c: '#b58fd6' } },
    runecarver:  { base: 'acolyte',  pal: { B: '#1a2442', b: '#2c3a6a', K: '#0e1428', c: '#9fd0ff' } },
    hildisvini:  { base: 'boar',     pal: { n: '#ffd463', N: '#c9a032', W: '#fff6d8', w: '#fff6d8' } },
    troll:       { base: 'cyclops',  pal: { s: '#6a7a6a', S: '#465246', n: '#5a4a3a', N: '#3a3028', w: '#c9b48e', b: '#3a2a22' },
                   rows: { 2: '...ssssssssss...', 3: '...sskssssksss..', 4: '...ssssssssss...', 6: '...sswkkkkwsss..' } },
    frostgiant:  { base: 'cyclops',  pal: { s: '#9fd0ff', S: '#5b9bd5', n: '#e6f2ff', N: '#8f98a8', w: '#ffffff', b: '#1a2442', k: '#1a2442' },
                   rows: { 0: '.....wwwwww.....', 1: '....wwwwwwww....', 2: '...ssssssssss...', 3: '...sskssssksss..', 4: '...ssssssssss...' } },
    garm:        { base: 'wolf',     pal: { n: '#3a2a2a', N: '#1a1010', w: '#c0412e', e: '#ff5a3c' }, rows: { 2: 'n........nnen' } },
    freki:       { base: 'wolf',     pal: { n: '#d5dbe5', N: '#8f98a8', w: '#ffffff', e: '#5b9bd5' }, rows: { 2: 'n........nnen' } },
    fenriswolf:  { base: 'wolf',     pal: { n: '#2a2a34', N: '#14141c', w: '#9fd0ff', e: '#9fd0ff' }, rows: { 2: 'n........nnen' } },
    serpentling: { base: 'python',   pal: { g: '#3f9a8a', G: '#1f5a50', y: '#7fe08a' } },
    worldspawn:  { base: 'python',   pal: { g: '#2c7a70', G: '#14403a', y: '#7fe08a' } },
    thundergoat: { base: 'goat',     pal: { w: '#d8ccb4', W: '#8f846c', n: '#57c2b0' } },
    raven:       { base: 'owl',      pal: { h: '#3a3a44', H: '#1f1f24', y: '#9fd0ff', o: '#4b4f57', w: '#3a3a44', W: '#2a2a30' } },
  };
  for (const [name, v] of Object.entries(V)) { const b = SPRITE_DATA[v.base]; SPR[name] = buildFrames([patchRows(b[0], v.rows), ...b.slice(1)], Object.assign({}, PAL, v.pal)); }
  // dwarf smiths: short, wide, all beard
  SPR.dwarf = buildFrames([['...hhhh...', '..hhhhhh..', '..hHhhhh..', '..sSssks..', '..Ssssss..', '.nnnnnnnn.', 'snnnnnnnns', 'snnoooonns', '..nnnnnn..', '..NN..NN..', '..kk..kk..'],
    { from: 9, rows: ['...NN.NN..', '...kk.kk..'] }], Object.assign({}, PAL, { h: '#6b6f7a', H: '#3a3d46', n: '#7a4a2a', N: '#3a2416', o: '#ff8a2b' }));
  // Fenrir: a black wolf twice the size of anything else in the North (drawn at double size on top of that)
  SPR.fenrir = buildFrames([[
    '....................n...n.', '...................nn..nn.', '..................nnnnnnn.', '.................nNnnnnenn', 'nn..............nNNnnnnnnw',
    '.nn.............NNnnnnwww.', '..nnnnnnnnnnnnnNNNnnnw....', '..nnnnnnnnnnnnnnNNnn......', '..NnnnnnnnnnnnnnnNn.......', '..NNnnnnnnnnnnnnnnn.......',
    '..nNN.nn.......nnNn.......', '..nn..nn.......nn.nn......', '..nn..nn.......nn..nn.....', '..kk..kk.......kk..kk.....'],
    { from: 11, rows: ['...nn.nn......nn..nn.....', '...nn..nn....nn....nn....', '...kk..kk....kk....kk....'] }],
    Object.assign({}, PAL, { n: '#2a2a34', N: '#14141c', e: '#9fd0ff', w: '#f3e9d4', k: '#0a0a10' }));
  // the six gods: the shared robed body (GOD_BASE), the five men with the male build
  const GODS_N = {
    heimdall: { male: true, pal: { a: '#ffd463', A: '#c9a032', c: '#a7adb3', C: '#636a72', d: '#57c2b0', f: '#c9a032', y: '#e9c04f', w: '#f3e9d4' },   // silver mail, so he doesn't read as bare skin
                rows: { 0: '..w.......w..', 1: '.w..aaaaa..w.', 2: '.w.aaaaaaa.w.', 7: '....yyyyy....' } },
    freyja:   { pal: { a: '#ffd463', A: '#c9a032', c: '#f3e9d4', C: '#c2b293', d: '#ffb347', f: '#c9792a', n: '#8a5a34' },
                rows: { 3: '..adadadada..', 8: '.nndcccccdnn.', 9: 'nnsccCccccsnn', 10: 'nss.cCcccc.sn', 11: 'ns..cCccdc.sn' } },
    tyr:      { male: true, pal: { a: '#c7ccd1', A: '#8f98a8', c: '#c0412e', C: '#7f2618', d: '#d5dbe5', f: '#3a3a44', n: '#6b4528' },
                rows: { 7: '....nnnnn....', 10: '.ss.cCcccc.S.', 11: '.s..cCccdc...' } },              // his right hand is gone
    loki:     { male: true, pal: { a: '#1f1f24', A: '#0e0e12', c: '#2f5a3a', C: '#1a3a24', d: '#e9c04f', f: '#1f1f24', y: '#e9c04f' },
                rows: { 0: '...y.....y...', 1: '...yaaaaay...' } },
    thor:     { male: true, pal: { a: '#c0412e', A: '#7f2618', c: '#3a4a6a', C: '#22304a', d: '#ffd463', f: '#5a3a22', r: '#d9493b' },
                rows: { 7: '....rrrrr....', 8: '...drrrrrd...' } },
    odin:     { male: true, pal: { a: '#3a4a6a', A: '#22304a', c: '#5b6b8a', C: '#3a4a6a', d: '#d5dbe5', f: '#3a2a1a', w: '#e6e1d6', W: '#b5b0a6' },
                rows: { 1: '....aaaaa....', 2: '...aaaaaaa...', 3: 'aaaaaaaaaaaaa', 4: '...Assssss...', 6: '...Awwwwww...', 7: '....wwwwww...', 8: '...dwwwwwd...', 9: '.ssccwWwccss.' } },
  };
  for (const [name, look] of Object.entries(GODS_N)) {
    GOD_LOOKS[name] = look; if (look.male) MALE_GODS.add(name);
    SPR[name] = buildFrames([patchRows(look.male ? patchRows(GOD_BASE, GOD_MALE) : GOD_BASE, look.rows), GOD_WALK], Object.assign({}, PAL, look.pal));
  }
  // Vindheim: Sigrun, Brokk the dwarf and Åsa the trader
  NPC_BASES.dwarfman = [['...aaaa...', '..aaaaaa..', '..aSssks..', '..Ssssss..', '.aaaaaaaa.', '.saaaaaas.', 'scaaaaaacs', '.ccdddcc..', '..cCCCCc..', '..nn..nn..'], { from: 9, rows: ['...nn.nn..'] }];
  const NPCS_N = {
    sigrun: { base: 'woman',    pal: { a: '#e9c04f', c: '#3a5a8a', C: '#22304a', d: '#d5dbe5' } },
    brokk:  { base: 'dwarfman', pal: { a: '#c9792a', c: '#6b4528', C: '#4e321d', d: '#9aa0a6', n: '#3a2416' } },
    asa:    { base: 'woman',    pal: { a: '#a8401e', c: '#4e6e2b', C: '#2f4a1a', d: '#e9c04f' } },
  };
  for (const [name, look] of Object.entries(NPCS_N)) { NPC_LOOKS[name] = look; SPR[name] = buildFrames(NPC_BASES[look.base], Object.assign({}, PAL, look.pal)); }
}
// The North's monsters and gods keep their own colours on God Rank (25_titan_art.js skips the night-purple tint for these).
const NORTH_SPR = new Set(['einherjar', 'warden', 'shieldmaiden', 'hornbearer', 'ulfhednar', 'axethrower', 'draugr', 'skogkatt', 'valkyrie', 'seidkona', 'runecarver',
  'hildisvini', 'troll', 'frostgiant', 'garm', 'freki', 'fenriswolf', 'serpentling', 'worldspawn', 'thundergoat', 'raven', 'dwarf', 'fenrir',
  'heimdall', 'freyja', 'tyr', 'loki', 'thor', 'odin']);
// Helmets the North's armor needs: a nose guard, Odin's wide hat, a wolf pelt with the ears still on.
Object.assign(HEAD_EXTRAS, {
  nasal: { 8: '________i___', 9: '________i___' },
  hat:   { 2: '............', 3: '....iiii....', 4: '...iiiiii...', 5: '...iiiiii...', 6: '...cccccc...', 7: 'iiiiiiiiiiii' },
  ears:  { 2: '...i....i...', 3: '...ii..ii...' },
});
Object.assign(HEAD_STYLE, { ears: 'hood' });
// Anything from the North gets a small ice-blue gem in the corner of its icon instead of a rank colour (iconCanvas in 20_art.js).
function isNorthId(id) {
  const d = ITEMS[id] || WEAPONS[id] || SHIELDS[id] || ARMOR_SETS[id] || (PIECES[id] && ARMOR_SETS[PIECES[id].set]);
  return !!(d && d.north);
}
function northGem(src) {
  const c = mkCanvas(src.width + 1, src.height + 1), x = c.getContext('2d'); x.drawImage(src, 0, 1);
  x.fillStyle = OUTLINE; x.fillRect(c.width - 4, 0, 4, 4); x.fillStyle = '#9fd0ff'; x.fillRect(c.width - 3, 1, 2, 2); x.fillStyle = '#ffffff'; x.fillRect(c.width - 3, 1, 1, 1);
  return c;
}
