/* ---- Titans: two body shapes (bare and robed), recoloured and patched per Titan ---- */
// Frames: 0 standing, 1 walking, 2 arms raised. Their held things (the sky, a sickle, scales) are drawn in code.
const TITAN_BASE = { bare: ['..........aaaaaa..........','........aaaaaaaaaa........','.......aaaaaaaaaaaa.......','.......aAssssssssAa.......','.......aSssssssssSa.......','.......aSskksskksSa.......','.......aSssssssssSa.......','........SsssSSsssS........','........aassssssaa........','........aaaskksaaa........','.........aaaaaaaa.........','....SSSS..aaaaaa..SSSS....','..ssssssssaaaaaassssssss..','.sssssssssaaaaaasssssssss.','sss.sssssssSaaSsssssss.sss','sss.ssssssssSSssssssss.sss','sss.sSSSSSSSSSSSSSSSSs.sss','sss.sssssSssSSssSsssss.sss','sss..sssSSSSSSSSSSsss..sss','SSS..ssssSssSSssSssss..SSS','mmm..sssSSSSSSSSSSsss..mmm','MMm..ssssSssSSssSssss..mMM','sss..dddddddddddddddd..sss','sss..cccccccccccccccc..sss','SSS..cCccccccccccccCc..SSS','.s...cCccccccccccccCc...s.','.....cCcccccCCcccccCc.....','......ssssS....Sssss......','......sssSS....SSsss......','......sssSS....SSsss......','......ssSsS....SsSss......','......sssSS....SSsss......','......sssSS....SSsss......','......ssssS....Sssss......','......fffff....fffff......','.....ffffff....ffffff.....'],
  robe: ['..........aaaaaa..........','........aaaaaaaaaa........','.......aaaaaaaaaaaa.......','.......aAssssssssAa.......','.......aSssssssssSa.......','.......aSskksskksSa.......','.......aSssssssssSa.......','........SsssSSsssS........','........ssssssssss........','........SsskSSkssS........','.........SSssssSS.........','....CCCC..ssssss..CCCC....','..cccccccccddddccccccccc..','.cccccccccdccccdccccccccc.','ccc.cccccdccccccdccccc.ccc','ccc.ccccdccccccccdcccc.ccc','ccc.cccdccccccccccdccc.ccc','CCC.ccdccccccccccccdcc.CCC','ccc.dddddddddddddddddd.ccc','ccc..ccccCccccccCcccc..ccc','sss..ccccCccccccCcccc..sss','SSS.cccccCccccccCccccc.SSS','...ccccccCccccccCcccccc...','...cccccCccccccccCccccc...','..ccccccCccccccccCcccccc..','..cccccCccccccccccCccccc..','..ccccCccccccccccccCcccc..','.cccccCccccccccccccCccccc.','.ccccCccccccccccccccCcccc.','.ccccCccccccccccccccCcccc.','.cccCccccccccccccccccCccc.','cccCccccccccccccccccccCccc','CCCCCCCCCCCCCCCCCCCCCCCCCC','....fff....f..f....fff....','...ffff............ffff...'] };
const TITAN_RAISE = { bare: {'0':'..sss.....aaaaaa.....sss..','1':'..sss...aaaaaaaaaa...sss..','2':'..SsS..aaaaaaaaaaaa..SsS..','3':'..sss..aAssssssssAa..sss..','4':'..mmm..aSssssssssSa..mmm..','5':'..MmM..aSskksskksSa..MmM..','6':'..sss..aSssssssssSa..sss..','7':'..sss...SsssSSsssS...sss..','8':'..ssS...aassssssaa...Sss..','9':'..sss...aaaskksaaa...sss..','10':'..sss....aaaaaaaa....sss..','11':'..ssSSSS..aaaaaa..SSSSss..','12':'..ssssssssaaaaaassssssss..','13':'...sssssssaaaaaasssssss...','14':'....sssssssSaaSsssssss....','15':'....ssssssssSSssssssss....','16':'....sSSSSSSSSSSSSSSSSs....','17':'....sssssSssSSssSsssss....','18':'.....sssSSSSSSSSSSsss.....','19':'.....ssssSssSSssSssss.....','20':'.....sssSSSSSSSSSSsss.....','21':'.....ssssSssSSssSssss.....','22':'.....dddddddddddddddd.....','23':'.....cccccccccccccccc.....','24':'.....cCccccccccccccCc.....','25':'.....cCccccccccccccCc.....','26':'.....cCcccccCCcccccCc.....'},
  robe: {'0':'..sss.....aaaaaa.....sss..','1':'..sss...aaaaaaaaaa...sss..','2':'..SsS..aaaaaaaaaaaa..SsS..','3':'..ccc..aAssssssssAa..ccc..','4':'..ccc..aSssssssssSa..ccc..','5':'..CcC..aSskksskksSa..CcC..','6':'..ccc..aSssssssssSa..ccc..','7':'..ccc...SsssSSsssS...ccc..','8':'..ccc...ssssssssss...ccc..','9':'..ccC...SsskSSkssS...Ccc..','10':'..ccc....SSssssSS....ccc..','11':'..ccCCCC..ssssss..CCCCcc..','12':'..cccccccccddddccccccccc..','13':'...ccccccdccccccdcccccc...','14':'....cccccdccccccdccccc....','15':'....ccccdccccccccdcccc....','16':'....cccdccccccccccdccc....','17':'....ccdccccccccccccdcc....','18':'....dddddddddddddddddd....','19':'.....ccccCccccccCcccc.....','20':'.....ccccCccccccCcccc.....','21':'....cccccCccccccCccccc....'} };
const TITAN_WALK = { bare: {'27':'......ssssS......ssssS....','28':'.....sssSS........sssSS...','29':'.....sssSS........sssSS...','30':'....ssSsS..........ssSsS..','31':'....sssSS..........sssSS..','32':'....sssSS...........sssSS.','33':'....ssssS...........ssssS.','34':'....fffff...........fffff.','35':'...ffffff...........ffffff'}, robe: {'33':'...fff..........ffff......','34':'..ffff...........fff......'} };
const TITAN_SPR = {
  atlas: { base: 'bare', pal: {'a':'#5a4632','A':'#3a2c1e','s':'#c99a76','S':'#9a6f50','T':'#7a5238','k':'#1a1210','c':'#3c4a78','C':'#232c4e','d':'#e9c04f','m':'#8a7a5a','M':'#5a4e38','f':'#5a3a22'},
    rows: {} },
  hyperion: { base: 'bare', pal: {'a':'#ffb030','A':'#e07a1a','s':'#e8b07a','S':'#c08a5a','T':'#a06a40','k':'#ffffff','c':'#fff6d8','C':'#e0c890','d':'#ffd463','m':'#e9c04f','M':'#a8842a','f':'#a8842a'},
    rows: {'0':'.........a.aa.a.a........'} },
  oceanus: { base: 'bare', pal: {'a':'#d8f0ec','A':'#7fd0c8','s':'#7fb8a8','S':'#4f8a7a','T':'#3c6a5e','k':'#1a2a30','c':'#1a4a44','C':'#0e2a26','d':'#e07a3a','m':'#f2c0b0','M':'#c98a7a','f':'#2c7a70','o':'#e07a3a','O':'#a04a1a'},
    rows: {'0':'..O.......aaaaaa.......O..','1':'.oO.....aaaaaaaaaa.....Oo.','2':'.o.oo..aaaaaaaaaaaa..oo.o.','23':'_____cdcdcdcdcdcdcdcd_____','24':'_____CcCcCcCcCcCcCcC_____','25':'_____cCcCcCcCcCcCcCc_____'} },
  coeus: { base: 'robe', pal: {'a':'#e6f2ff','A':'#9fb8d8','s':'#d8c8b8','S':'#a8988a','k':'#5b9bd5','c':'#1a2442','C':'#0e1428','d':'#d5dbe5','w':'#ffffff','f':'#0e1428'},
    rows: {'8':'........aassssaa........','9':'........aaasksaaa.......','10':'.........aaaaaaaa.......','11':'....CCCC..aaaaaa..CCCC....','12':'..cccccccccaaaacccccccccc.','15':'_______w__________w_______','20':'________w_____w___________','24':'___w__________________w___','27':'_______w_____w______w_____','30':'__w______w_______w________'} },
  mnemosyne: { base: 'robe', pal: {'a':'#4a2f63','A':'#2e1d40','s':'#e8d0c8','S':'#b8a098','k':'#2e1d40','c':'#c8b8ff','C':'#8a7aaa','d':'#f3e9d4','f':'#3a2f4a'},
    rows: {'3':'______aaAssssssssAaa______','4':'______aaSssssssssSaa______','5':'______aaSskkssskkSaa______','6':'______aaSssssssssSaa______','7':'______aa_SsssSsssS_aa_____','8':'______aa_sssssssss_aa_____','9':'_____aaa__SsskSS___aaa____','10':'_____aaa___SSss____aaa____','11':'_____aaa__sssss__aaa______','12':'____aaacccccccccccccaaa___','13':'_____aacccccdcdcccccaa____'} },
  themis: { base: 'robe', pal: {'a':'#3a2416','A':'#24160c','s':'#e8c8a8','S':'#b8987a','k':'#1a1210','c':'#f3e9d4','C':'#c2b293','d':'#e9c04f','f':'#a8842a','g':'#4e8a3a'},
    rows: {'2':'_______agagagagagaa_______','5':'_______aSddddddddSa_______','9':'________SsssssssS_________','11':'____CCCC__ssssss__CCCC____'} },
  rhea: { base: 'robe', pal: {'a':'#6b4528','A':'#4e321d','s':'#e8b796','S':'#b97f5f','k':'#1a1210','c':'#5e7d35','C':'#3e5a22','d':'#c9a046','f':'#5a3a22','y':'#e9c04f','Y':'#a8842a'},
    rows: {'0':'_______y_y_yy_y_y________','1':'_______yYyYyyYyYy_________','2':'_______yyyyyyyyyyy________','9':'________SsssssssS_________','11':'____dddd__ssssss__dddd____','12':'__ddddcccccccccccccdddd___','13':'_dddccccccccccccccccdddd__','14':'___.dccccccdcccccccd.___'} },
  cronus: { base: 'robe', pal: {'a':'#c9c3cf','A':'#8f8a96','s':'#a89888','S':'#786858','k':'#e9c04f','c':'#3a3a42','C':'#1f1f24','d':'#a8842a','f':'#1f1f24','h':'#26262c','H':'#141418'},
    rows: {'0':'_________hhhhhhh_________','1':'_______hhhhhhhhhhh________','2':'______hhhhhhhhhhhhh_______','3':'______hHAssssssssAHh______','4':'______hHSssssssssSHh______','5':'______hHSskkssskkSHh______','6':'______hHSssssssssSHh______','7':'______hH_SsssSsssS_Hh_____','8':'______hHaassssssaaHh______','9':'______hHaaaskkaaaaHh______','10':'______hH_aaaaaaaa_Hh______','11':'____CCCC__aaaaaa__CCCC____','12':'__cccccccccaaaacccccccccc_','13':'_cccccccccdaaaadcccccccccc','14':'___.cccccdcaaccdccccc.____','15':'___.ccccdccaaccdcccccc.___'} },
};
function frameOf(rows, pal) {
  const n = makeSprite(rows, OUTLINE, pal), f = flipCanvas(n);
  return { n, f, wn: solidCanvas(n, '#ffffff'), wf: solidCanvas(f, '#ffffff'), gn: solidCanvas(n, '#ebc152'), gf: solidCanvas(f, '#ebc152'), w: n.width, h: n.height };
}
for (const [id, T] of Object.entries(TITAN_SPR)) {
  const pal = Object.assign({}, PAL, T.pal), base = TITAN_BASE[T.base];
  const idle = patchRows(base, T.rows), walk = patchRows(patchRows(base, TITAN_WALK[T.base]), T.rows), raise = patchRows(patchRows(base, TITAN_RAISE[T.base]), T.rows);
  SPR[id] = [idle, walk, raise].map(r => frameOf(r, pal));
}
// Monsters under the temple: recoloured bodies from the surface.
const TITAN_MINION_LOOKS = {
  earthborn: { base: 'bandit',  pal: { N: '#3a3428', n: '#8a7a5a', o: '#ff8a2b', s: '#9a9488', S: '#6a655c', k: '#ff8a2b' } },
  colossus:  { base: 'cyclops', pal: { s: '#8a8478', S: '#5a554c', n: '#3a3428', N: '#24201a', b: '#ff8a2b', w: '#c9c3b8' } },
  obsidian:  { base: 'hoplite', pal: { r: '#3a3048', R: '#1c1626', y: '#5a4a6a', Y: '#2e2438', s: '#8a7a9a', k: '#b48cff', n: '#1c1626' } },
  chrono:    { base: 'shade',   pal: { p: '#c9a032', P: '#6b5216', w: '#fff6d8' } },
  skyharpy:  { base: 'harpy',   pal: { p: '#5b9bd5', P: '#2c5684', N: '#1a2442', s: '#d5dbe5', w: '#ffffff', y: '#e9c04f' } },
  lion:      { base: 'panther', pal: { n: '#c9a046', N: '#8a6a2a', y: '#5a3a22' } },
  serpent:   { base: 'python',  pal: { g: '#2c7a70', G: '#1a4a44', y: '#7fd0c8' } },
};
for (const [name, v] of Object.entries(TITAN_MINION_LOOKS)) SPR[name] = buildFrames(SPRITE_DATA[v.base], Object.assign({}, PAL, v.pal));
// Rhea's decoys: a stone wrapped like a baby
SPR.bundle = buildFrames([['....wwww....', '..wwWwwWww..', '.wwwwWwwwWw.', 'wWwwwwwwWwww', 'wwwWwkkwwwWw', 'wwwwwkkwwwww', '.wWwwwwwWww.', '..wwwWwwww..', '....wwww....'],
  { from: 4, rows: ['wwwWwwwwwwWw', 'wwwwwwwwwwww'] }], Object.assign({}, PAL, { w: '#d8ceb7', W: '#a39a86', k: '#6b6458' }));

/* ---- rank looks: High Rank monsters and gods are darker and bloodier, God Rank ones turn night-purple ---- */
function recolorCanvas(src, r) {
  const c = mkCanvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), T = RANK_TINT[r], m = hexRgb(T.mix), g = hexRgb(T.trim);
  for (let i = 0; i < d.data.length; i += 4) {
    if (!d.data[i + 3]) continue;
    const R = d.data[i], G2 = d.data[i + 1], B = d.data[i + 2];
    if (R < 40 && G2 < 30 && B < 30) continue;                         // keep the outline
    const l = (R * .3 + G2 * .59 + B * .11) / 255;
    // very bright pixels (eyes, highlights) take the rank's glow colour
    if (l > .86) { d.data[i] = lerp(R, g[0], .55); d.data[i + 1] = lerp(G2, g[1], .55); d.data[i + 2] = lerp(B, g[2], .55); continue; }
    const a = T.amt * .85;
    d.data[i] = lerp(R, m[0], a); d.data[i + 1] = lerp(G2, m[1], a); d.data[i + 2] = lerp(B, m[2], a);
  }
  x.putImageData(d, 0, 0); return c;
}
const RANK_FR = [{}, {}, {}];
function rankFrames(name, r) {
  const base = SPR[name];
  if (!r || !base) return base;
  if (RANK_FR[r][name]) return RANK_FR[r][name];
  return (RANK_FR[r][name] = base.map(fr => { const n = recolorCanvas(fr.n, r); return { ...fr, n, f: flipCanvas(n) }; }));
}

/* ---- statues: stone until you beat that god or Titan, then gold, diamond (High Rank) or amethyst (God Rank) ---- */
const TONES = { stone: STONE, gold: GOLDR, diamond: ['#1e3a56', '#4a7aa0', '#8fc4e8', '#cdeeff', '#ffffff'], amethyst: ['#24103a', '#4e2482', '#7e44c0', '#b48cff', '#efdcff'] };
const STATUE_TONE = ['gold', 'diamond', 'amethyst'], STATUE_WORD = ['Golden', 'Diamond', 'Amethyst'];
const STATUE_CACHE = {};
function statueImg(id, tone) { const k = id + ':' + tone; return STATUE_CACHE[k] || (STATUE_CACHE[k] = toneCanvas(SPR[id][TITAN_SPR[id] && id === 'atlas' ? 2 : 0].n, TONES[tone])); }
