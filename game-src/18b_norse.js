/* ============================== THE NORTH (update 1.1) ============================== */
// Past Typhon. Word of the hunter who slew the father of monsters reaches Vindheim, a village in the far North, and a
// stranger sails to Akros to fetch them. Six gods of Asgard and then Fenrir, the wolf who ends the world.
// To the player this is Nordic Rank, and it climbs like a rank does. Heimdall starts where Typhon left off, and every god
// after him sits four tiers higher (a whole rank is sixteen), Fenrir four above Odin. What a god's hunts drop forges gear
// on the NEXT god's tier, so if you forge as you go every fight is the fair one it was tuned as, and if you don't the
// North gets steadily harder: by Thor, Typhon's gear is a full rank behind. Gear made from the two monster hunts before a
// god sits halfway, to help against that god. And so that every set is an end-game set (for builds, and for the
// Coliseum), all Nordic gear wakes to the top tier once Fenrir falls: playerStats (50_combat.js) reads the *Top numbers.
// Data only: art is in 21_norse_art.js, the fights in 76_norse_ai.js, the town and the map in 85_vindheim.js.
const NORTH_TIER = { heimdall: 17.25, freyja: 21, tyr: 25, loki: 29, thor: 33, odin: 37, fenrir: 41 }, NORTH_TOP = 45;
const NORSE_GODS = ['heimdall', 'freyja', 'tyr', 'loki', 'thor', 'odin'].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), quest: 'gr_' + id + '_hunt', tier: NORTH_TIER[id] }));
const FENRIR_Q = 'gr_fenrir_hunt', NORTH_RANK = 2, NORTH_OFF = RANKS[NORTH_RANK].off;
// save.north: 0 nothing yet · 1 the stranger is at Akros' gate · 2 she has told you about the North (the map is open) · 3 you have sailed
const northOpen = (s = G.save) => !!s && (s.north | 0) >= 2;
const nid = base => rid(base, NORTH_RANK);                       // Norse parts drop on God Rank hunts, so their ids carry gr_
const isNorth = d => !!(d && d.north);

/* ---- parts ---- */
{
  const add = (id, it) => { ITEMS[id] = { ...it, rank: 0, north: true }; ITEMS[nid(id)] = { ...it, rank: NORTH_RANK, base: id, north: true }; };
  // Heimdall
  add('einherjar_mail',   { name: 'Einherjar Mail',        rarity: 1, icon: ['plate', '#c7ccd1', '#7f8898'], desc: 'Ring mail from one of the chosen dead. It never rusts.' });
  add('warden_boss',      { name: 'Warden’s Shield-Boss',  rarity: 2, icon: ['coin', '#9aa0a6', '#5f6878', '#ffd463'], desc: 'The iron centre of a bridge warden’s shield.' });
  add('horn_shard',       { name: 'Horn Shard',            rarity: 2, icon: ['horn', '#f3e9d4', '#c9a46b', '#ffd463'], desc: 'A piece of a war horn. Hold it to your ear and it still rings.' });
  add('troll_hide',       { name: 'Troll Hide',            rarity: 3, icon: ['hide', '#6a7a6a', '#465246'], desc: 'Grey-green and as hard as the bridge it lived under.' });
  add('bifrost_shard',    { name: 'Bifröst Shard',         rarity: 4, icon: ['gem', '#ff8a5a', '#57c2b0', '#ffffff'], desc: 'A splinter of the rainbow bridge. It is every colour at once.' });
  // Freyja
  add('cat_pelt',         { name: 'Forest Cat Pelt',       rarity: 1, icon: ['hide', '#a7998a', '#6e6257'], desc: 'Thick grey fur from one of the cats that pull Freyja’s chariot.' });
  add('valkyrie_feather', { name: 'Valkyrie Feather',      rarity: 2, icon: ['feather', '#ffffff', '#c9d0dc', '#ffd463'], desc: 'A white feather from a chooser of the slain.' });
  add('seidr_thread',     { name: 'Seidr Thread',          rarity: 2, icon: ['cloth', '#b58fd6', '#6b4a8a'], desc: 'Thread a seeress spun a fate with. It tugs toward you.' });
  add('gold_bristle',     { name: 'Golden Bristle',        rarity: 3, icon: ['hide', '#ffd463', '#c9a032'], desc: 'From Hildisvini, Freyja’s battle boar. It glows in the dark.' });
  add('brising_link',     { name: 'Brísingamen Link',      rarity: 4, icon: ['coin', '#ffb347', '#c9792a', '#ffffff'], desc: 'One link of the necklace four dwarves made for Freyja.' });
  // Tyr
  add('wolf_cloak',       { name: 'Wolf-Warrior Cloak',    rarity: 1, icon: ['hide', '#5f5f6a', '#3a3a44'], desc: 'A wolf pelt worn by the ulfhednar, who fight without mail.' });
  add('axe_head',         { name: 'Bearded Axe Head',      rarity: 1, icon: ['shard', '#c7ccd1', '#7f8898', '#ffffff'], desc: 'Thrown hard enough to stick in a shield.' });
  add('oath_ring',        { name: 'Oath Ring',             rarity: 2, icon: ['coin', '#e9c04f', '#a8842a', '#c0412e'], desc: 'Sworn on at the Thing. Break the oath and it burns.' });
  add('garm_fang',        { name: 'Fang of Garm',          rarity: 3, icon: ['fang', '#f3e9d4', '#7f2618'], desc: 'From the blood-stained hound that guards Hel’s gate.' });
  add('tyr_gauntlet',     { name: 'Tyr’s Gauntlet',        rarity: 4, icon: ['plate', '#d5dbe5', '#8f98a8'], desc: 'For the one hand he has left. It has never broken a promise.' });
  // Loki
  add('draugr_dust',      { name: 'Draugr Dust',           rarity: 1, icon: ['shard', '#7fa8a0', '#3c5a56'], desc: 'What is left of a barrow-dweller once it stops getting up.' });
  add('changeling_ash',   { name: 'Changeling Ash',        rarity: 1, icon: ['ember', '#7fe08a', '#2f8a4a', '#e6ffe0'], desc: 'Green ash from one of Loki’s shapes. It keeps trying to be something else.' });
  add('venom_gland',      { name: 'Venom Gland',           rarity: 2, icon: ['vial', '#8ab04a', '#4e6e2b', '#e6ffe0'], desc: 'From a serpentling of Jörmungandr’s brood. Handle with tongs.' });
  add('serpent_scale',    { name: 'World-Serpent Scale',   rarity: 3, icon: ['scale', '#2c7a70', '#14403a', '#7fe08a'], desc: 'Shed by the spawn of the serpent that circles the world.' });
  add('loki_flame',       { name: 'Trickster’s Flame',     rarity: 4, icon: ['ember', '#7fe08a', '#1f6a3a', '#ffffff'], desc: 'A green flame that burns in whichever hand you aren’t looking at.' });
  // Thor
  add('goat_horn',        { name: 'Thunder-Goat Horn',     rarity: 1, icon: ['horn', '#d8ccb4', '#8f846c', '#ffd463'], desc: 'From one of the goats that pull Thor’s chariot. It hums before a storm.' });
  add('storm_wool',       { name: 'Storm Wool',            rarity: 1, icon: ['cloth', '#c9d0dc', '#8f98a8'], desc: 'Wool so full of static it stands on end.' });
  add('dwarf_iron',       { name: 'Dwarven Iron',          rarity: 2, icon: ['plate', '#6b6f7a', '#3a3d46'], desc: 'Smelted under the mountain by the people who forged Mjölnir.' });
  add('rime_heart',       { name: 'Rime Heart',            rarity: 3, icon: ['orb', '#cdeeff', '#5b9bd5', '#ffffff'], desc: 'The frozen heart of a frost giant. It never melts.' });
  add('mjolnir_spark',    { name: 'Mjölnir Spark',         rarity: 4, icon: ['ember', '#ffffff', '#57c2b0', '#ffd463'], desc: 'A spark struck off the hammer itself.' });
  // Odin
  add('raven_feather',    { name: 'Raven Feather',         rarity: 1, icon: ['feather', '#3a3a44', '#1f1f24', '#9fd0ff'], desc: 'Black, with a blue sheen. It knows more than it lets on.' });
  add('rune_chip',        { name: 'Carved Rune',           rarity: 2, icon: ['shard', '#d8ccb4', '#8f846c', '#9fd0ff'], desc: 'A chip of ash wood with a rune cut into it.' });
  add('freki_pelt',       { name: 'Great Wolf Pelt',       rarity: 3, icon: ['hide', '#d5dbe5', '#8f98a8'], desc: 'From one of the two wolves that sit at Odin’s feet.' });
  add('odin_eye',         { name: 'Eye of Odin',           rarity: 4, icon: ['eye', '#f3e9d4', '#5b9bd5', '#140d0b'], desc: 'The eye he gave up for wisdom. It is still looking.' });
  // every god of the North, and Fenrir
  add('asgard_rune',      { name: 'Rune of Asgard',        rarity: 4, icon: ['coin', '#1a2442', '#0e1428', '#9fd0ff'], desc: 'Every god of the North drops one.' });
  add('fenris_fur',       { name: 'Fenris Fur',            rarity: 2, icon: ['hide', '#2a2a34', '#14141c'], desc: 'Black fur from the wolves that run with Fenrir.' });
  add('gleipnir_link',    { name: 'Gleipnir Link',         rarity: 4, icon: ['coin', '#e6f2ff', '#9fd0ff', '#ffffff'], desc: 'A link of the ribbon that bound Fenrir, made from six things that don’t exist.' });
  add('fenrir_fang',      { name: 'Fang of Fenrir',        rarity: 4, icon: ['fang', '#f3e9d4', '#9fd0ff'], desc: 'As long as your forearm. Colder than the snow it fell in.' });
}

/* ---- monsters ---- */
Object.assign(ENEMIES, {
  // Heimdall: the bridge and its guards
  einherjar:   { name: 'Einherjar',        role: 'fodder',   cls: 'fodder', sprite: 'einherjar',   r: 5, speed: 40, hpM: 1.9, colors: ['#c7ccd1', '#7f8898', '#ffd463'], loot: [['einherjar_mail', .7]] },
  warden:      { name: 'Bridge Warden',    role: 'tank',     cls: 'medium', sprite: 'warden',      r: 6, speed: 28, hpM: 7.5, dmgP: .15, shield: true, attack: 'thrust', turn: 2.4, kbRes: .3, colors: ['#9aa0a6', '#5f6878', '#57c2b0'], loot: [['warden_boss', .8, 1, 2], ['einherjar_mail', .3]] },
  hornbearer:  { name: 'Hornbearer',       role: 'summoner', cls: 'medium', sprite: 'hornbearer',  r: 5, speed: 38, hpM: 3.2, summon: 'einherjar', colors: ['#8a5a34', '#ffd463', '#f3e9d4'], loot: [['horn_shard', .8], ['einherjar_mail', .4]] },
  troll:       { name: 'Bridge Troll',     role: 'tank',     cls: 'heavy',  sprite: 'troll',       r: 9, speed: 23, attack: 'slam', turn: 1.6, kbRes: .12, colors: ['#6a7a6a', '#465246', '#c9b48e'], loot: [['troll_hide', 1], ['horn_shard', .5, 1, 2]] },
  // Freyja: her cats, her boar, and the choosers of the slain
  skogkatt:    { name: 'Forest Cat',       role: 'leaper',   cls: 'fodder', sprite: 'skogkatt',    r: 5, speed: 56, hpM: 1.6, pounce: 255, colors: ['#a7998a', '#6e6257', '#ffd463'], loot: [['cat_pelt', .65]] },
  valkyrie:    { name: 'Valkyrie',         role: 'flyer',    cls: 'medium', sprite: 'valkyrie',    r: 5, speed: 82, hpM: 3.2, dmgP: .11, swoop: 245, colors: ['#ffffff', '#c9d0dc', '#ffd463'], loot: [['valkyrie_feather', .7], ['einherjar_mail', .2]] },
  seidkona:    { name: 'Seeress',          role: 'shooter',  cls: 'medium', sprite: 'seidkona',    r: 5, speed: 40, hpM: 2.8, dmgP: .08, proj: { kind: 'seidr', speed: 135, charm: .8 }, near: 95, far: 160, cd: [1.7, 2.5], colors: ['#b58fd6', '#6b4a8a', '#ffffff'], loot: [['seidr_thread', .7], ['cat_pelt', .25]] },
  hildisvini:  { name: 'Hildisvini',       role: 'charger',  cls: 'heavy',  sprite: 'hildisvini',  r: 12, scale: 2, speed: 27, charge: 210, chain: 2, kbRes: .1, colors: ['#ffd463', '#c9a032', '#fff6d8'], loot: [['gold_bristle', 1], ['cat_pelt', .8, 1, 2]] },
  // Tyr: the war camp
  ulfhednar:   { name: 'Ulfhednar',        role: 'leaper',   cls: 'medium', sprite: 'ulfhednar',   r: 5, speed: 54, hpM: 4.5, dmgP: .12, pounce: 265, chain: 2, colors: ['#5f5f6a', '#3a3a44', '#e8b796'], loot: [['wolf_cloak', .7], ['axe_head', .3]] },
  axethrower:  { name: 'Axe Thrower',      role: 'shooter',  cls: 'fodder', sprite: 'axethrower',  r: 5, speed: 42, hpM: 1.6, dmgP: .06, proj: { kind: 'axe', speed: 150 }, near: 80, far: 140, cd: [1.4, 2.2], colors: ['#8a5a34', '#c7ccd1', '#e8b796'], loot: [['axe_head', .7], ['wolf_cloak', .2]] },
  shieldmaiden:{ name: 'Shield-Maiden',    role: 'tank',     cls: 'medium', sprite: 'shieldmaiden', r: 6, speed: 30, hpM: 7, dmgP: .15, shield: true, attack: 'thrust', turn: 2.6, kbRes: .3, colors: ['#c0412e', '#7f2618', '#ffd463'], loot: [['oath_ring', .6], ['axe_head', .5, 1, 2]] },
  garm:        { name: 'Garm',             role: 'leaper',   cls: 'heavy',  sprite: 'garm',        r: 11, scale: 2, speed: 46, pounce: 255, chain: 3, dmgP: .2, kbRes: .1, colors: ['#3a2a2a', '#1a1010', '#c0412e'], loot: [['garm_fang', 1], ['wolf_cloak', .7, 1, 2]] },
  // Loki: the barrow, the shapes he wears, and the serpent's brood
  draugr:      { name: 'Draugr',           role: 'fodder',   cls: 'fodder', sprite: 'draugr',      r: 5, speed: 38, revive: true, colors: ['#7fa8a0', '#3c5a56', '#7fe08a'], loot: [['draugr_dust', .7]] },
  changeling:  { name: 'Changeling',       role: 'exploder', cls: 'fodder', sprite: 'loki',        r: 6, speed: 52, hpM: 1.4, dmgP: .12, puddle: 'poison', tint: 'pink', colors: ['#7fe08a', '#2f8a4a', '#e6ffe0'], loot: [['changeling_ash', .6]] },
  serpentling: { name: 'Serpentling',      role: 'charger',  cls: 'medium', sprite: 'serpentling', r: 7, speed: 34, charge: 235, trail: 'poison', kbRes: .5, colors: ['#3f9a8a', '#1f5a50', '#7fe08a'], loot: [['venom_gland', .7], ['draugr_dust', .3]] },
  worldspawn:  { name: 'World-Serpent Spawn', role: 'charger', cls: 'heavy', sprite: 'worldspawn', r: 11, scale: 2, speed: 28, charge: 205, chain: 2, trail: 'poison', kbRes: .1, colors: ['#2c7a70', '#14403a', '#7fe08a'], loot: [['serpent_scale', 1], ['venom_gland', .8, 1, 2]] },
  loki_image:  { name: 'Likeness of Loki', role: 'shooter',  cls: 'fodder', sprite: 'loki',        r: 6, speed: 30, hpM: .9, dmgP: .06, proj: { kind: 'lokifire', speed: 125 }, near: 60, far: 150, cd: [1.5, 2.3], tint: 'pink', colors: ['#7fe08a', '#2f8a4a', '#e6ffe0'], loot: [] },
  // Thor: his goats, the dwarves' forge, and the giants he hunts
  thundergoat: { name: 'Thunder-Goat',     role: 'charger',  cls: 'fodder', sprite: 'thundergoat', r: 5, speed: 36, hpM: 1.5, dmgP: .07, charge: 240, colors: ['#d8ccb4', '#8f846c', '#57c2b0'], loot: [['goat_horn', .6], ['storm_wool', .5]] },
  dwarf:       { name: 'Dwarf Smith',      role: 'thrower',  cls: 'medium', sprite: 'dwarf',       r: 5, speed: 34, hpM: 3.8, dmgP: .1, puddle: 'lava', near: 85, far: 145, cd: [2, 2.8], colors: ['#6b4528', '#ff8a2b', '#e8b796'], loot: [['dwarf_iron', .7], ['storm_wool', .25]] },
  frostgiant:  { name: 'Frost Giant',      role: 'tank',     cls: 'heavy',  sprite: 'frostgiant',  r: 9, speed: 23, attack: 'slam', turn: 1.6, kbRes: .12, colors: ['#9fd0ff', '#5b9bd5', '#ffffff'], loot: [['rime_heart', 1], ['dwarf_iron', .5, 1, 2]] },
  // Odin: his ravens, his rune-carvers, his wolves
  raven:       { name: 'Raven of Odin',    role: 'flyer',    cls: 'fodder', sprite: 'raven',       r: 5, speed: 86, hpM: 1.5, dmgP: .06, swoop: 255, colors: ['#3a3a44', '#1f1f24', '#9fd0ff'], loot: [['raven_feather', .7]] },
  runecarver:  { name: 'Rune-Carver',      role: 'shooter',  cls: 'medium', sprite: 'runecarver',  r: 5, speed: 40, hpM: 2.8, dmgP: .08, proj: { kind: 'rune', speed: 150, multi: 3, spread: .3 }, near: 105, far: 170, cd: [1.9, 2.6], colors: ['#1a2442', '#9fd0ff', '#f3e9d4'], loot: [['rune_chip', .7], ['raven_feather', .3]] },
  freki:       { name: 'Great Wolf',       role: 'leaper',   cls: 'heavy',  sprite: 'freki',       r: 11, scale: 2, speed: 46, pounce: 250, chain: 3, dmgP: .2, kbRes: .1, colors: ['#d5dbe5', '#8f98a8', '#9fd0ff'], loot: [['freki_pelt', 1], ['raven_feather', .6, 1, 2]] },
  // Fenrir's pack
  fenriswolf:  { name: 'Fenris Wolf',      role: 'leaper',   cls: 'fodder', sprite: 'fenriswolf',  r: 5, speed: 58, hpM: 1.6, pounce: 255, colors: ['#2a2a34', '#14141c', '#9fd0ff'], loot: [['fenris_fur', .5]] },
});
Object.assign(PLURALS, { einherjar: 'Einherjar', ulfhednar: 'Ulfhednar', draugr: 'Draugar', seidkona: 'Seeresses', hildisvini: 'Hildisvini', garm: 'Garm', loki_image: 'Likenesses of Loki',
                         fenriswolf: 'Fenris Wolves', freki: 'Great Wolves', dwarf: 'Dwarf Smiths', valkyrie: 'Valkyries' });

/* ---- the gods of the North, and Fenrir ---- */
// They use the shared boss engine (70_bosses.js) plus moves of their own from 76_norse_ai.js: bridge, cross, blinkstab,
// decoys, ravens. north2: moves that only join the list at half health. The tiers here are placeholders: NORTH_TIER sets the real ones below.
Object.assign(BOSSES, {
  heimdall: { name: 'Heimdall', title: 'Watchman of the Gods', tier: 17.25, north: true, r: 7, sprite: 'heimdall', keep: 80, speed: 56, contact: .09, arrivalHeals: 2, dmgScale: .8,
    attacks: [{ id: 'dash', w: 3, p1: { count: 2, speed: 340, dmg: .16 } },
              { id: 'wave', w: 2, p1: { dmg: .15, speed: 170, max: 170, col: '#ffd463', count: 2 } },
              { id: 'bridge', w: 2, p1: { n: 3, dmg: .19, delay: 1 } },
              { id: 'toss', w: 2, p1: { dmg: .15, speed: 250, range: 230 } }],
    north2: [{ id: 'gaze', w: 3, p1: { n: 6, r: 13, dmg: .15, gap: .32 } }],
    summons: [{ at: .7, types: ['einherjar', 'einherjar', 'einherjar', 'einherjar'] }, { at: .35, types: ['warden', 'warden', 'hornbearer'] }],
    phase2: { title: 'Heimdall sounds the Gjallarhorn', sub: 'He sees every step you take' },
    colors: ['#ffd463', '#f3e9d4', '#57c2b0'], loot: [['bifrost_shard', 1, 2, 3], ['asgard_rune', 1]] },
  freyja:   { name: 'Freyja', title: 'Lady of the Slain', tier: 17.5, north: true, r: 6, sprite: 'freyja', keep: 115, speed: 62, contact: .08, arrivalHeals: 2, dmgScale: .85,
    attacks: [{ id: 'fan', w: 2, p1: { n: 7, spread: 1.1, speed: 130, dmg: .1, kind: 'seidr', volleys: 2 } },
              { id: 'rain', w: 2, p1: { n: 9, r: 14, delay: .9, dmg: .16, kind: 'amber' } },
              { id: 'dash', w: 3, p1: { count: 3, speed: 380, dmg: .15 } },
              { id: 'blink', w: 1, p1: {} }],
    north2: [{ id: 'beam', w: 3, p1: { dmg: .16, len: 250, sweep: 1.9, time: 1.4, col: '#ffb347' } }],
    summons: [{ at: .7, types: ['skogkatt', 'skogkatt', 'skogkatt'] }, { at: .4, types: ['valkyrie', 'valkyrie', 'skogkatt', 'skogkatt'] }],
    phase2: { title: 'Brísingamen blazes', sub: 'Its light sweeps the whole field' },
    colors: ['#ffb347', '#f3e9d4', '#ffffff'], loot: [['brising_link', 1, 2, 3], ['asgard_rune', 1]] },
  tyr:      { name: 'Tyr', title: 'God of War and Oaths', tier: 17.75, north: true, r: 7, sprite: 'tyr', keep: 44, speed: 70, contact: .1, rage: true, arrivalHeals: 2, dmgScale: .7,
    attacks: [{ id: 'dash', w: 3, p1: { count: 3, speed: 350, dmg: .17 } },
              { id: 'leap', w: 2, p1: { dmg: .19, r: 26 } },
              { id: 'cross', w: 3, p1: { n: 3, dmg: .18, delay: .85, len: 150 } },
              { id: 'quake', w: 1, p1: { dmg: .17 } }],
    north2: [{ id: 'reflect', w: 2, p1: { time: 1.6 } }, { id: 'cross', w: 2, p1: { n: 5, dmg: .18, delay: .8, len: 170 } }],
    summons: [{ at: .7, types: ['ulfhednar', 'ulfhednar', 'axethrower', 'axethrower'] }, { at: .35, types: ['garm'] }],
    phase2: { title: 'Tyr swears an oath', sub: 'Strike him while he stands guard and it comes back at you' },
    colors: ['#c0412e', '#d5dbe5', '#e9c04f'], loot: [['tyr_gauntlet', 1, 2, 3], ['asgard_rune', 1]] },
  loki:     { name: 'Loki', title: 'The Trickster', tier: 18, north: true, r: 6, sprite: 'loki', keep: 105, speed: 66, contact: .08, arrivalHeals: 2, dmgScale: .9,
    attacks: [{ id: 'fan', w: 2, p1: { n: 6, spread: .9, speed: 150, dmg: .1, kind: 'lokifire', volleys: 2 } },
              { id: 'blinkstab', w: 3, p1: { dmg: .17, count: 2 } },
              { id: 'puddles', w: 2, p1: { n: 5, r: 16, life: 6, dmg: .04, kind: 'poison' } },
              { id: 'decoys', w: 2, p1: { n: 3 } }],
    north2: [{ id: 'confuse', w: 2, p1: { dmg: .06, time: 3 } }, { id: 'ring', w: 2, p1: { n: 14, speed: 95, dmg: .1, kind: 'lokifire', rings: 2 } }],
    summons: [{ at: .7, types: ['changeling', 'changeling', 'changeling', 'changeling'] }, { at: .35, types: ['serpentling', 'draugr', 'draugr', 'changeling'] }],
    phase2: { title: 'Loki stops playing fair', sub: 'More likenesses, and your own feet turn on you' },
    colors: ['#7fe08a', '#2f8a4a', '#e9c04f'], loot: [['loki_flame', 1, 2, 3], ['asgard_rune', 1]] },
  thor:     { name: 'Thor', title: 'God of Thunder', tier: 18.25, north: true, r: 8, sprite: 'thor', keep: 58, speed: 60, contact: .1, arrivalHeals: 2, dmgScale: .75,
    attacks: [{ id: 'toss', w: 3, p1: { dmg: .18, speed: 300, range: 240 } },
              { id: 'leap', w: 2, p1: { dmg: .2, r: 28 } },
              { id: 'quake', w: 2, p1: { dmg: .18 } },
              { id: 'rain', w: 2, p1: { n: 9, r: 14, delay: .85, dmg: .17, kind: 'bolt' } },
              { id: 'stampede', w: 1, p1: { n: 4 } }],
    north2: [{ id: 'bridge', w: 3, p1: { n: 4, dmg: .2, delay: .95, col: '#57c2b0' } }],
    summons: [{ at: .7, types: ['thundergoat', 'thundergoat', 'thundergoat', 'thundergoat'] }, { at: .35, types: ['dwarf', 'dwarf', 'thundergoat', 'thundergoat'] }],
    phase2: { title: 'Thor buckles the belt of strength', sub: 'The storm follows him now' },
    colors: ['#c0412e', '#57c2b0', '#ffd463'], loot: [['mjolnir_spark', 1, 2, 3], ['asgard_rune', 1]] },
  odin:     { name: 'Odin', title: 'The Allfather', tier: 18.5, north: true, r: 7, sprite: 'odin', keep: 120, speed: 54, contact: .09, arrivalHeals: 3, dmgScale: .85,
    attacks: [{ id: 'toss', w: 3, p1: { dmg: .19, speed: 320, range: 260 } },
              { id: 'ring', w: 2, p1: { n: 12, speed: 80, dmg: .1, kind: 'rune', homing: .8, rings: 2 } },
              { id: 'rain', w: 2, p1: { n: 10, r: 14, delay: .9, dmg: .17, kind: 'runefire' } },
              { id: 'ravens', w: 2, p1: { n: 2, dmg: .12 } },
              { id: 'vanish', w: 1, p1: { time: 2, dmg: .18 } }],
    north2: [{ id: 'beam', w: 2, p1: { dmg: .17, len: 270, sweep: 2, time: 1.5, col: '#9fd0ff' } }, { id: 'ravens', w: 2, p1: { n: 4, dmg: .12 } }],
    summons: [{ at: .7, types: ['raven', 'raven', 'raven', 'valkyrie'] }, { at: .35, types: ['freki', 'freki'] }],
    phase2: { title: 'Odin opens his one eye', sub: 'Geri and Freki are coming' },
    colors: ['#5b9bd5', '#d5dbe5', '#9fd0ff'], loot: [['odin_eye', 1, 2, 3], ['asgard_rune', 1]] },
  // The last hunt of the North. A fight of his own (76_norse_ai.js): bound in Gleipnir, then loose, then Ragnarök.
  fenrir:   { name: 'Fenrir', title: 'The Wolf Who Ends the World', tier: 19, north: true, custom: true, northFinal: true, r: 12, scale: 2, sprite: 'fenrir', arrivalHeals: 3, dmgScale: .85,
    colors: ['#2a2a34', '#9fd0ff', '#f3e9d4'], loot: [['fenrir_fang', 1, 1, 2], ['gleipnir_link', 1, 2, 3], ['asgard_rune', 1]] },
});
// Post-Typhon gods take a long fight, between a God Rank Titan and Typhon himself (hits are worked out in 19_finalize.js).
// Then nudged from bot runs (Nov 10, a sword bot and a bow bot in gear on the fight's own tier) so each is a fair fight
// of about the same length: [health, damage]. Freyja and Loki keep away from you, so they lose health instead.
// Those runs were made with the gods bunched just above Typhon (NORTH_WAS). Now that they climb, a god's health would also
// grow with the number of hits the curve asks for at its tier, so that part is taken back out: in gear on its tier, each
// god still takes as many hits as it was tuned for.
const NORTH_TUNE = { heimdall: [1, 1], freyja: [.8, 1.15], tyr: [1, 1.1], loki: [.68, 1], thor: [1.25, 1.1], odin: [1, 1], fenrir: [2.86 / 1.55, .66] };
const NORTH_WAS = { heimdall: 17.25, freyja: 17.5, tyr: 17.75, loki: 18, thor: 18.25, odin: 18.5, fenrir: 19 }, hitsAt = t => 54 + 2.5 * (t - 1);
for (const [id, [h, d]] of Object.entries(NORTH_TUNE)) {
  BOSSES[id].tier = NORTH_TIER[id];
  BOSSES[id].tune = { hp: [1, 1, 1.55 * h * hitsAt(NORTH_WAS[id]) / hitsAt(NORTH_TIER[id])], dmg: [1, 1, d] };
}

/* ---- hunts ---- */
{
  const T = t => t + NORTH_OFF;
  // A hunt sits on its god's tier (NORTH_TIER). The two monster hunts before each god are four waves, the last one the big one.
  const Q = (base, god, o) => QUESTS.push({ id: nid(base), base, north: true, rank: NORTH_RANK, god, tier: T(NORTH_TIER[god]), ...o, requires: (o.requires || []).map(r => r === TYPHON_Q ? r : nid(r)) });
  // Heimdall
  Q('bridge_dead', 'heimdall', { name: 'The Dead Stand Watch', arena: 'bifrostfoot', requires: [TYPHON_Q],
    desc: 'The chosen dead guard the foot of the rainbow bridge, and their hornbearers keep calling more. Cut the hornbearers down first.',
    waves: [{ einherjar: 9 }, { einherjar: 9, hornbearer: 2 }, { einherjar: 8, hornbearer: 2, warden: 2 }, { einherjar: 10, hornbearer: 3, warden: 3 }] });
  Q('bridge_troll', 'heimdall', { name: 'Under the Bridge', arena: 'trollford', requires: [TYPHON_Q],
    desc: 'Wardens hold the ford behind their shields, and something big lives under the bridge. Its slam hits everything around it, so watch the ring.',
    waves: [{ warden: 3, einherjar: 6 }, { warden: 3, hornbearer: 1, einherjar: 6 }, { troll: 2, warden: 2, einherjar: 5 }, { troll: 3, warden: 3, hornbearer: 1, einherjar: 4 }] });
  Q('heimdall_hunt', 'heimdall', { boss: 'heimdall', name: 'The Rainbow Bridge', arena: 'bifrost', requires: ['bridge_dead', 'bridge_troll'],
    desc: 'Heimdall has watched you coming since you left Akros. Beams of the bridge burn in lanes across the floor: stand between them. At half health his horn wakes Asgard, and strikes start chasing your feet.',
    waves: [{ einherjar: 8, warden: 2 }, { warden: 2, hornbearer: 2, einherjar: 6 }] });
  // Freyja
  Q('cats_meadow', 'freyja', { name: 'The Chariot Cats', arena: 'folkvang', requires: ['heimdall_hunt'],
    desc: 'Freyja’s forest cats pounce the moment you stop. Her seeresses spin threads that drag you toward them. Dash to break free.',
    waves: [{ skogkatt: 8 }, { skogkatt: 8, seidkona: 2 }, { skogkatt: 9, seidkona: 3, valkyrie: 1 }, { skogkatt: 10, seidkona: 3, valkyrie: 3 }] });
  Q('battle_boar', 'freyja', { name: 'Hildisvini', arena: 'boarwood', requires: ['heimdall_hunt'],
    desc: 'Valkyries dive hard and twice. The golden battle boar charges twice in a row, so keep moving after the first.',
    waves: [{ valkyrie: 3, skogkatt: 5 }, { valkyrie: 4, seidkona: 2, skogkatt: 4 }, { hildisvini: 2, valkyrie: 3, skogkatt: 4 }, { hildisvini: 3, valkyrie: 4, seidkona: 2 }] });
  Q('freyja_hunt', 'freyja', { boss: 'freyja', name: 'Lady of the Slain', arena: 'sessrumnir', requires: ['cats_meadow', 'battle_boar'],
    desc: 'Half of all who fall in battle go to Freyja’s hall. She dives at you as a falcon three times in a row, and weeps gold that bursts where it lands. At half health her necklace sweeps the hall with light.',
    waves: [{ skogkatt: 8, seidkona: 2 }, { valkyrie: 4, seidkona: 2, skogkatt: 4 }] });
  // Tyr
  Q('wolf_warriors', 'tyr', { name: 'The Wolf-Warriors', arena: 'warcamp', requires: ['freyja_hunt'],
    desc: 'The ulfhednar fight in wolf pelts and leap again and again. Axe throwers hang back behind them.',
    waves: [{ ulfhednar: 3, axethrower: 4 }, { ulfhednar: 4, axethrower: 5 }, { ulfhednar: 5, axethrower: 4, shieldmaiden: 2 }, { ulfhednar: 6, axethrower: 5, shieldmaiden: 3 }] });
  Q('hels_hound', 'tyr', { name: 'The Hound at the Gate', arena: 'gnipacave', requires: ['freyja_hunt'],
    desc: 'Shield-maidens block from the front, so get around them. Garm, the hound of Hel’s gate, pounces four times in a row.',
    waves: [{ shieldmaiden: 3, axethrower: 4 }, { shieldmaiden: 3, ulfhednar: 3, axethrower: 3 }, { garm: 2, ulfhednar: 3, axethrower: 3 }, { garm: 3, shieldmaiden: 2, ulfhednar: 3, axethrower: 2 }] });
  Q('tyr_hunt', 'tyr', { boss: 'tyr', name: 'The One-Handed', arena: 'thingstead', requires: ['wolf_warriors', 'hels_hound'],
    desc: 'Tyr fights up close and gets faster as he bleeds. Lines on the ground are his sword coming: step off them. At half health he stands guard, and anything you land on him then comes straight back.',
    waves: [{ ulfhednar: 4, axethrower: 4, shieldmaiden: 1 }, { shieldmaiden: 3, ulfhednar: 3, axethrower: 3 }] });
  // Loki
  Q('barrow_dead', 'loki', { name: 'The Barrow Wakes', arena: 'barrow', requires: ['tyr_hunt'],
    desc: 'Draugar get back up unless you smash the bones. The changelings look like Loki, run at you and burst into poison.',
    waves: [{ draugr: 9 }, { draugr: 9, changeling: 4 }, { draugr: 9, changeling: 5, serpentling: 1 }, { draugr: 10, changeling: 6, serpentling: 2 }] });
  Q('serpent_brood', 'loki', { name: 'The Serpent’s Brood', arena: 'ironwood', requires: ['tyr_hunt'],
    desc: 'The young of the world-serpent leave venom wherever they charge. Make them hit a wall, and stay off the trail.',
    waves: [{ serpentling: 3, draugr: 5 }, { serpentling: 4, changeling: 4, draugr: 4 }, { worldspawn: 2, serpentling: 2, changeling: 4 }, { worldspawn: 3, serpentling: 3, changeling: 4 }] });
  Q('loki_hunt', 'loki', { boss: 'loki', name: 'The Trickster', arena: 'venomcave', requires: ['barrow_dead', 'serpent_brood'],
    desc: 'Loki steps out of sight and comes back behind you: watch for the mark at your back. His likenesses shoot but fall to one hit, and the real one never stands still. At half health he turns your controls around.',
    waves: [{ draugr: 8, changeling: 4 }, { serpentling: 3, changeling: 5, draugr: 4 }] });
  // Thor
  Q('thunder_goats', 'thor', { name: 'The Chariot Goats', arena: 'thrudvang', requires: ['loki_hunt'],
    desc: 'Thor’s goats charge in a straight line, and there are a lot of them. Dwarf smiths lob molten iron that keeps burning on the ground.',
    waves: [{ thundergoat: 9 }, { thundergoat: 9, dwarf: 2 }, { thundergoat: 10, dwarf: 3 }, { thundergoat: 12, dwarf: 4 }] });
  Q('frost_giants', 'thor', { name: 'Giants of the Rime', arena: 'jotunheim', requires: ['loki_hunt'],
    desc: 'Frost giants slam the ground and send a ring out across the ice. Step back from the slam, then dash through the ring as it reaches you.',
    waves: [{ frostgiant: 1, thundergoat: 6 }, { frostgiant: 2, dwarf: 2, thundergoat: 4 }, { frostgiant: 3, dwarf: 2, thundergoat: 5 }, { frostgiant: 4, dwarf: 3, thundergoat: 4 }] });
  Q('thor_hunt', 'thor', { boss: 'thor', name: 'God of Thunder', arena: 'bilskirnir', requires: ['thunder_goats', 'frost_giants'],
    desc: 'Thor throws Mjölnir along the marked line and it always comes back: hit him while his hand is empty. He leaps, cracks the floor and calls his goats. At half health lightning runs in lanes across the hall.',
    waves: [{ thundergoat: 9, dwarf: 2 }, { frostgiant: 2, dwarf: 2, thundergoat: 5 }] });
  // Odin
  Q('ravens_flight', 'odin', { name: 'Thought and Memory', arena: 'ravenwood', requires: ['thor_hunt'],
    desc: 'Odin’s ravens watch everything and dive from above. Rune-carvers fire three runes at once. Close in on them.',
    waves: [{ raven: 7, runecarver: 1 }, { raven: 8, runecarver: 3 }, { raven: 8, runecarver: 3, valkyrie: 2 }, { raven: 10, runecarver: 4, valkyrie: 3 }] });
  Q('valhalla_gate', 'odin', { name: 'The Gates of Valhalla', arena: 'valgrind', requires: ['thor_hunt'],
    desc: 'The chosen dead and their valkyries hold the gate, and Odin’s great wolves pounce four times in a row.',
    waves: [{ einherjar: 8, valkyrie: 3 }, { einherjar: 6, valkyrie: 3, runecarver: 2, warden: 2 }, { freki: 2, valkyrie: 3, einherjar: 6 }, { freki: 3, valkyrie: 4, runecarver: 2, einherjar: 5 }] });
  Q('odin_hunt', 'odin', { boss: 'odin', name: 'The Allfather', arena: 'hlidskjalf', requires: ['ravens_flight', 'valhalla_gate'],
    desc: 'Gungnir flies along the marked line and comes back to his hand. His ravens follow you: dash sideways at the last moment. Runes burn where the ground lights up. At half health he opens his one eye, and his wolves come.',
    waves: [{ raven: 7, runecarver: 2, valkyrie: 2 }, { einherjar: 6, valkyrie: 3, runecarver: 3 }] });
  // Fenrir
  Q('fenrir_hunt', 'fenrir', { boss: 'fenrir', northFinal: true, name: 'The Wolf Who Ends the World', arena: 'lyngvi', requires: NORSE_GODS.map(g => g.quest.slice(3)),
    desc: 'The gods bound Fenrir on the island of Lyngvi with Gleipnir, a ribbon made of six things that don’t exist. While it holds he can’t reach past the ring of stones. It won’t hold. When the sun goes dark, don’t stop moving.',
    waves: [{ fenriswolf: 10, ulfhednar: 2 }, { fenriswolf: 8, draugr: 6, garm: 1 }] });
}

/* ---- skills ---- */
Object.assign(ABILITIES, {
  bifrost:  { name: 'Bifröst',          cd: 8,  desc: 'A beam of the rainbow bridge burns everything in a long line and blinds it for a moment. You ride it to the far end.' },
  falcon:   { name: 'Falcon Dive',      cd: 6,  desc: 'Fly through everything ahead as a falcon, cutting each enemy twice. Nothing can touch you in the air.' },
  judgment: { name: 'Tyr’s Judgment',   cd: 9,  desc: 'Your next three hits land twice as hard, and each one stuns.' },
  mirror:   { name: 'Likeness',         cd: 9,  desc: 'Three likenesses of you leap out and hunt the nearest enemies.' },
  mjolnir:  { name: 'Mjölnir',          cd: 7,  desc: 'Hurl the hammer through everything ahead. Lightning strikes where it turns, and it hits again on the way back. You can’t attack until you catch it.' },
  gungnir:  { name: 'Gungnir',          cd: 7,  desc: 'Throw the spear that never misses. It finds the nearest enemy, goes through it, and seeks out four more.' },
  howl:     { name: 'Howl of Fenrir',   cd: 10, desc: 'A howl freezes everything near you, and two spirit wolves run down the nearest enemies.' },
});

/* ---- gear: forged by Brokk in Vindheim ---- */
// The ladder (GEAR_TIER; tiers, like everything else): a god's own gear sits on the next god's tier, gear from the two
// monster hunts before a god sits halfway there, and Fenrir's is the top. Each piece also carries the top tier's numbers
// (wtTop, defTop, hpTop): once Fenrir has fallen, playerStats uses those for every Nordic piece you own.
const GEAR_TIER = {
  troll_maul: 19, einherjar: 19, hofund: 21, watchman: 21,                                   // Heimdall
  valkyrie_spear: 23, valkyrja: 23, falcon_talons: 25, brising: 25,                          // Freyja
  garm_fangs: 27, maiden_round: 27, oathblade: 29, oathbound: 29,                            // Tyr
  serpent_trident: 31, laevateinn: 33, trickster: 33,                                        // Loki
  dwarven_bow: 35, rimeguard: 35, rime_shield: 35, mjolnir: 37, thunderer: 37,               // Thor
  raven_bow: 39, gungnir: 41, allfather: 41, svalinn: 41,                                    // Odin
  fenrir_jaws: NORTH_TOP, fimbul: NORTH_TOP,                                                 // Fenrir
};
// Fenrir down: the runes in everything Brokk forged wake. (wake: the same, told to the others in a room, 49_net.js)
const northAwake = save => !!save && !!(save.wake || (save.cleared && save.cleared[FENRIR_Q]));
const northDmg = (w, awake) => Math.round(tierW(awake && w.wtTop ? w.wtTop : w.wt) * KINDS[w.kind].dmgM);   // a Nordic weapon's damage, asleep or awake
{
  const T = t => t + NORTH_OFF, R = (items, cost) => ({ items: Object.fromEntries(Object.entries(items).map(([k, v]) => [nid(k), v])), cost });
  const W = (id, w) => { WEAPONS[id] = { north: true, rank: NORTH_RANK, cdMul: .8, ...w, wt: T(GEAR_TIER[id]), wtTop: T(NORTH_TOP), ability: w.ability || KIND_SKILL[w.kind] }; };
  W('troll_maul',      { name: 'Troll-Bone Maul',   kind: 'hammer',  recipe: R({ troll_hide: 2, warden_boss: 5, einherjar_mail: 8 }, 70000), desc: 'A thigh bone from under the bridge, bound in iron.' });
  W('hofund',          { name: 'Hofund',            kind: 'sword',   ability: 'bifrost', recipe: R({ bifrost_shard: 4, asgard_rune: 2, warden_boss: 4 }, 95000), desc: 'Heimdall’s sword. The bridge answers when it’s drawn.' });
  W('valkyrie_spear',  { name: 'Valkyrie Spear',    kind: 'spear',   recipe: R({ valkyrie_feather: 6, seidr_thread: 4, gold_bristle: 1 }, 72000), desc: 'Light enough to carry on the wing.' });
  W('falcon_talons',   { name: 'Falcon Talons',     kind: 'daggers', ability: 'falcon', recipe: R({ brising_link: 4, asgard_rune: 2, valkyrie_feather: 5 }, 98000), desc: 'Cut from Freyja’s falcon cloak. You feel lighter holding them.' });
  W('garm_fangs',      { name: 'Fangs of Garm',     kind: 'daggers', recipe: R({ garm_fang: 2, wolf_cloak: 8, axe_head: 6 }, 74000), desc: 'Two fangs from the hound at Hel’s gate.' });
  W('oathblade',       { name: 'Tyr’s Oathblade',   kind: 'sword',   ability: 'judgment', recipe: R({ tyr_gauntlet: 4, asgard_rune: 2, oath_ring: 5 }, 100000), desc: 'It has never been drawn for a lie.' });
  W('serpent_trident', { name: 'World-Serpent Trident', kind: 'trident', recipe: R({ serpent_scale: 2, venom_gland: 6, draugr_dust: 8 }, 78000), desc: 'Three fangs of the serpent’s brood. Throw it and it comes back.' });
  W('laevateinn',      { name: 'Lævateinn',         kind: 'spear',   ability: 'mirror', recipe: R({ loki_flame: 4, asgard_rune: 2, changeling_ash: 8 }, 102000), desc: 'The wand Loki made at the gates of death. It is never quite where it looks.' });
  W('dwarven_bow',     { name: 'Dwarven Arbalest',  kind: 'bow',     pierce: 2, recipe: R({ dwarf_iron: 6, rime_heart: 1, goat_horn: 8 }, 80000), desc: 'A bow of horn and cold iron. Shots punch through two extra enemies.' });
  W('mjolnir',         { name: 'Mjölnir',           kind: 'hammer',  ability: 'mjolnir', recipe: R({ mjolnir_spark: 4, asgard_rune: 2, dwarf_iron: 6 }, 105000), desc: 'Thor’s hammer, short in the handle. It always comes back.' });
  W('raven_bow',       { name: 'Ravenwing Bow',     kind: 'bow',     pierce: 2, ability: 'volley', recipe: R({ raven_feather: 10, rune_chip: 6, freki_pelt: 1 }, 82000), desc: 'Fletched in black. Its arrows remember where you were looking.' });
  W('gungnir',         { name: 'Gungnir',           kind: 'spear',   ability: 'gungnir', recipe: R({ odin_eye: 4, asgard_rune: 2, rune_chip: 6 }, 108000), desc: 'Odin’s spear. An oath sworn on its point can’t be broken, and it has never missed.' });
  W('fenrir_jaws',     { name: 'Jaws of Fenrir',    kind: 'daggers', ability: 'howl', recipe: R({ fenrir_fang: 2, gleipnir_link: 3, asgard_rune: 3 }, 130000), desc: 'Two fangs of the wolf who ends the world, still cold.' });

  // Armor: Typhon's set, plus what the curve adds between Typhon's tier (17) and this one. Every Nordic set on a tier
  // holds the same; what sets them apart is what they do.
  const top = ARMOR_SETS.typhonic, hold = t => [Math.round(top.def + tierD(T(t)) - tierD(T(17))), Math.round(top.hp + tierH(T(t)) - tierH(T(17)))];
  const S = (id, s) => { const [def, hp] = hold(GEAR_TIER[id]), [defTop, hpTop] = hold(NORTH_TOP); ARMOR_SETS[id] = { north: true, rank: NORTH_RANK, ...s, ch: T(GEAR_TIER[id]), def, hp, defTop, hpTop }; };
  S('einherjar', { name: 'Einherjar',  extra: 'nasal', colors: { head: ['#c7ccd1', '#7f8898', '#ffd463'], chest: ['#9aa0a6', '#5f6878', '#ffd463'], legs: ['#6b4528', '#4e321d'], feet: ['#4e321d', '#2c1d12'] },
    recipe: R({ einherjar_mail: 10, warden_boss: 5, troll_hide: 1 }, 68000), two: { def: 8 }, four: { regen: 3 }, desc: 'Ring mail of the chosen dead. Their wounds close every night, and so do yours.' });
  S('watchman',  { name: 'Watchman',   god: 'heimdall', extra: 'horns', colors: { head: ['#ffd463', '#c9a032', '#f3e9d4'], chest: ['#f3e9d4', '#c2b293', '#57c2b0'], legs: ['#c7ccd1', '#7f8898'], feet: ['#ffd463', '#c9a032'] },
    recipe: R({ bifrost_shard: 3, asgard_rune: 1, einherjar_mail: 8 }, 92000), two: { projRes: .25 }, four: { watchman: 1 }, desc: 'White and gold, with the ram’s horns of the god who never sleeps.' });
  S('valkyrja',  { name: 'Valkyrie',   extra: 'wings', colors: { head: ['#d5dbe5', '#8f98a8', '#ffffff'], chest: ['#ffffff', '#c9d0dc', '#ffd463'], legs: ['#8f98a8', '#5f6878'], feet: ['#d5dbe5', '#8f98a8'] },
    recipe: R({ valkyrie_feather: 8, cat_pelt: 8, seidr_thread: 4 }, 70000), two: { speed: .08 }, four: { dodgeStrike: 1 }, desc: 'Winged helm, white mail. You land harder than you look.' });
  S('brising',   { name: 'Brísing',    god: 'freyja', extra: 'roses', colors: { head: ['#ffb347', '#c9792a', '#ffffff'], chest: ['#f3e9d4', '#c2b293', '#ffb347'], legs: ['#a7998a', '#6e6257'], feet: ['#ffb347', '#c9792a'] },
    recipe: R({ brising_link: 3, asgard_rune: 1, cat_pelt: 8 }, 95000), two: { healDrops: .08 }, four: { lifesteal: .05, lastStand: 1 }, desc: 'Amber and gold under a cloak of falcon feathers.' });
  S('oathbound', { name: 'Oathbound',  god: 'tyr', extra: 'crest', colors: { head: ['#d5dbe5', '#8f98a8', '#c0412e'], chest: ['#c0412e', '#7f2618', '#d5dbe5'], legs: ['#5f5f6a', '#3a3a44'], feet: ['#3a3a44', '#1f1f24'] },
    recipe: R({ tyr_gauntlet: 3, asgard_rune: 1, oath_ring: 5 }, 98000), two: { dmg: .1 }, four: { onehand: .22 }, desc: 'Plain steel and a red cloak. One gauntlet is missing on purpose.' });
  S('trickster', { name: 'Trickster',  god: 'loki', extra: 'hood', colors: { head: ['#2f5a3a', '#1a3a24', '#e9c04f'], chest: ['#2f5a3a', '#1a3a24', '#e9c04f'], legs: ['#1f1f24', '#0e0e12'], feet: ['#3a2a1a', '#1f140c'] },
    recipe: R({ loki_flame: 3, asgard_rune: 1, changeling_ash: 8 }, 100000), two: { dodgeCd: .15 }, four: { trick: .2 }, desc: 'Green and gold. People keep swinging at where you just were.' });
  S('rimeguard', { name: 'Rimeguard',  extra: 'spikes', colors: { head: ['#cdeeff', '#5b9bd5', '#ffffff'], chest: ['#6b6f7a', '#3a3d46', '#9fd0ff'], legs: ['#3a3d46', '#22242a'], feet: ['#6b6f7a', '#3a3d46'] },
    recipe: R({ rime_heart: 1, dwarf_iron: 6, storm_wool: 8 }, 76000), two: { hp: 30 }, four: { frost: 1 }, desc: 'Dwarven iron rimmed with ice that won’t melt.' });
  S('thunderer', { name: 'Thunderer',  god: 'thor', extra: 'wings', colors: { head: ['#9aa0a6', '#5f6878', '#f3e9d4'], chest: ['#3a4a6a', '#22304a', '#c0412e'], legs: ['#6b4528', '#4e321d'], feet: ['#9aa0a6', '#5f6878'] },
    recipe: R({ mjolnir_spark: 3, asgard_rune: 1, dwarf_iron: 6 }, 104000), two: { knock: .4 }, four: { thunderDash: 1, lightning: 5 }, desc: 'A winged helm, a red cloak and the belt of strength.' });
  S('allfather', { name: 'Allfather',  god: 'odin', extra: 'hat', colors: { head: ['#3a4a6a', '#22304a', '#9fd0ff'], chest: ['#3a4a6a', '#22304a', '#d5dbe5'], legs: ['#22304a', '#141c2e'], feet: ['#3a2a1a', '#1f140c'] },
    recipe: R({ odin_eye: 3, asgard_rune: 1, rune_chip: 6 }, 108000), two: { abilityCd: .15 }, four: { ravens: 1 }, desc: 'A wanderer’s grey-blue cloak and a wide hat. Two ravens come with it.' });
  S('fimbul',    { name: 'Fimbulwinter', god: 'fenrir', extra: 'ears', colors: { head: ['#2a2a34', '#14141c', '#9fd0ff'], chest: ['#2a2a34', '#14141c', '#e6f2ff'], legs: ['#3a3a44', '#1f1f24'], feet: ['#14141c', '#0a0a10'] },
    recipe: R({ fenrir_fang: 1, gleipnir_link: 3, asgard_rune: 2 }, 135000), two: { speed: .08 }, four: { devour: .05, godBane: .2, berserk: .35 }, desc: 'The pelt of the wolf who ends the world. The cold comes with you.' });

  const SH = (id, s) => { SHIELDS[id] = { north: true, rank: NORTH_RANK, ...s, ch: T(GEAR_TIER[id]) }; };   // (a shield's guard is worked out against the hunt's tier, so it needs no ladder of its own)
  SH('maiden_round', { name: 'Shield-Maiden’s Round', block: .94, meter: 18, weight: .07, colors: ['#c0412e', '#7f2618', '#ffd463'], perk: 'bash', recipe: R({ oath_ring: 5, axe_head: 8, garm_fang: 1 }, 72000), desc: 'Perfect blocks knock attackers flying.' });
  SH('rime_shield',  { name: 'Rime Shield',           block: .95, meter: 19, weight: .08, colors: ['#cdeeff', '#5b9bd5', '#ffffff'], perk: 'frostblock', recipe: R({ rime_heart: 2, dwarf_iron: 6 }, 80000), desc: 'Perfect blocks freeze everything close to you.' });
  SH('svalinn',      { name: 'Svalinn',               block: .96, meter: 20, weight: .06, colors: ['#ffd463', '#c9a032', '#ffffff'], perk: 'reflect', recipe: R({ odin_eye: 2, asgard_rune: 1, bifrost_shard: 2 }, 100000), desc: 'The shield that stands before the sun. Perfect blocks send projectiles back.' });
}
Object.assign(TITAN_WEAPON_COLORS, {                              // blade, trim/grip, grip (20_art.js spreads these into WEAPON_COLORS)
  troll_maul: ['#d8ccb4', '#6a7a6a', '#4e321d'], hofund: ['#ffd463', '#57c2b0', '#c9a032'], valkyrie_spear: ['#ffffff', '#ffd463', '#8f98a8'], falcon_talons: ['#ffb347', '#f3e9d4', '#c9792a'],
  garm_fangs: ['#f3e9d4', '#7f2618', '#3a2a2a'], oathblade: ['#d5dbe5', '#c0412e', '#8f98a8'], serpent_trident: ['#7fe08a', '#2c7a70', '#14403a'], laevateinn: ['#7fe08a', '#e9c04f', '#2f5a3a'],
  dwarven_bow: ['#6b6f7a', '#9fd0ff', '#3a3d46'], mjolnir: ['#9aa0a6', '#57c2b0', '#6b4528'], raven_bow: ['#3a3a44', '#9fd0ff', '#1f1f24'], gungnir: ['#9fd0ff', '#d5dbe5', '#3a4a6a'],
  fenrir_jaws: ['#e6f2ff', '#9fd0ff', '#2a2a34'],
});
Object.assign(PERK_TEXT, {
  watchman: () => 'Your weapon skill also sounds the horn: a blast that hurls back and stuns everything close to you',
  onehand: v => `With a one-handed weapon and no shield: +${Math.round(v * 100)}% damage`,
  trick: v => `${Math.round(v * 100)}% of hits on you miss`,
  thunderDash: () => 'Lightning strikes the spot you dash away from',
  ravens: () => 'Two ravens circle you and strike the nearest enemy every 2 seconds',
  frost: () => 'Your hits chill enemies: they move and think a quarter slower (gods a tenth)',
  devour: v => `Every kill heals ${Math.round(v * 100)}% of your health`,
});
// The North's gear has no High or God Rank forms (it skips 17_ranks.js): its own ladder, above, is the whole of it.

/* ---- hunting grounds ---- */
// Generated like the others (19_finalize.js): a kit of props, a layout and a hidden nook. Themes are in 41_norse_world.js.
Object.assign(ARENAS, {
  bifrostfoot: { name: 'The Foot of Bifröst',   theme: 'fjord',     kit: ['runestone', 'snowpine', 'rock', 'snowpine'], layout: 0, nook: 5 },
  trollford:   { name: 'The Troll Ford',        theme: 'ford',      kit: ['boulder', 'rock', 'snowpine', 'icecrystal'], layout: 2, nook: 7 },
  bifrost:     { name: 'The Rainbow Bridge',    theme: 'bifrost',   kit: ['icecrystal', 'runestone', 'icecrystal', 'brazier'], layout: 3, nook: 9 },
  folkvang:    { name: 'Fólkvangr',             theme: 'folkvang',  kit: ['tree', 'runestone', 'rock', 'stump'], layout: 4, nook: 1 },
  boarwood:    { name: 'The Boar Wood',         theme: 'snowwood',  kit: ['snowpine', 'snowpine', 'stump', 'logpile'], layout: 1, nook: 3 },
  sessrumnir:  { name: 'Sessrúmnir',            theme: 'longhall',  kit: ['column', 'meadbarrel', 'brazier', 'statue'], layout: 3, nook: 0, statue: 'freyja' },
  warcamp:     { name: 'The War Camp',          theme: 'warcamp',   kit: ['rack', 'logpile', 'meadbarrel', 'brazier'], layout: 0, nook: 4 },
  gnipacave:   { name: 'Gnipa Cave',            theme: 'gnipa',     kit: ['boulder', 'icecrystal', 'rock', 'boulder'], layout: 2, nook: 8 },
  thingstead:  { name: 'The Thingstead',        theme: 'thing',     kit: ['runestone', 'runestone', 'brazier', 'rock'], layout: 5, nook: 6 },
  barrow:      { name: 'The Barrow Field',      theme: 'barrow',    kit: ['grave', 'runestone', 'stump', 'grave'], layout: 0, nook: 2 },
  ironwood:    { name: 'The Iron Wood',         theme: 'ironwood',  kit: ['snowpine', 'stump', 'rock', 'snowpine'], layout: 1, nook: 7 },
  venomcave:   { name: 'The Venom Cave',        theme: 'venomcave', kit: ['boulder', 'icecrystal', 'rock', 'boulder'], layout: 2, nook: 9 },
  thrudvang:   { name: 'Þrúðvangr',             theme: 'thrudvang', kit: ['runestone', 'logpile', 'rock', 'boulder'], layout: 4, nook: 5 },
  jotunheim:   { name: 'Jötunheimr',            theme: 'jotunheim', kit: ['icecrystal', 'boulder', 'icecrystal', 'rock'], layout: 5, nook: 0 },
  bilskirnir:  { name: 'Bilskírnir',            theme: 'thorhall',  kit: ['column', 'brazier', 'meadbarrel', 'statue'], layout: 3, nook: 3, statue: 'thor' },
  ravenwood:   { name: 'The Raven Wood',        theme: 'ravenwood', kit: ['snowpine', 'runestone', 'snowpine', 'stump'], layout: 1, nook: 6 },
  valgrind:    { name: 'Valgrind, Gate of Valhalla', theme: 'valhalla', kit: ['column', 'brazier', 'column', 'statue'], layout: 3, nook: 2, statue: 'odin' },
  hlidskjalf:  { name: 'Hliðskjálf',            theme: 'highseat',  kit: ['runestone', 'brazier', 'runestone', 'column'], layout: 3, nook: 8 },
  // Fenrir's island is made by hand: a ring of stones marks how far Gleipnir lets him reach (76_norse_ai.js uses the same ring).
  lyngvi: { name: 'The Isle of Lyngvi', theme: 'lyngvi', wt: 48, ht: 30,
    obstacles: [['runestone', 32, 15], ['runestone', 29.66, 18.54], ['runestone', 24, 20], ['runestone', 18.34, 18.54], ['runestone', 16, 15], ['runestone', 18.34, 11.46], ['runestone', 24, 10], ['runestone', 29.66, 11.46],
                ['boulder', 8, 7], ['boulder', 40, 7], ['boulder', 8, 23], ['boulder', 40, 23], ['snowpine', 5, 13], ['snowpine', 43, 17], ['rock', 14, 25], ['rock', 34, 5]],
    secret: { x: 45, y: 13, w: 2, h: 3, chest: [46, 14], hint: 'On Lyngvi, the rocks by the water on the east side hide a hollow about halfway down. Walk straight into them.' } },
});
// Gleipnir's reach on Lyngvi, in pixels around the middle of the island: inside the ring of stones.
const GLEIPNIR = { rx: 112, ry: 68 };
// Selling parts (Melita and Åsa, 85_vindheim.js). A part sells for a tenth of what the market asks for it, and the rare
// parts you'd sell for the most are the ones the forge wants. The traders always have the drachmae (1.1 gave them a purse
// that refilled as you play; it's gone). A big sale is paid in steps so the account server's check on how fast drachmae
// climb never turns the save away: Store.room in 30_core.js.
const SELL_SHARE = .1;
// To the player the North is a rank of its own, Nordic Rank, after the other three: a tab in the board, the forge, the chest
// and the market, the tag on its gear, and the rank shown in its hunts and on a room's posting, all in ice blue. Underneath,
// its hunts and gear are God Rank's (rank 2), so saves, the server's checks and multiplayer needed nothing new.
const NORTH_TAB = 3, NORDIC_NAME = 'Nordic Rank', NORDIC_COL = '#9fd0ff';
const northTab = d => d && (d.north || d.nordic) ? NORTH_TAB : (d && d.rank) || 0;   // (nordic: a Coliseum fight with Nordic gear allowed, 84_pvp.js)
const rankLabel = d => northTab(d) === NORTH_TAB ? NORDIC_NAME : RANKS[(d && d.rank) || 0].name;
// Your own rank as shown in town and on your save: Nordic Rank once you've sailed north (still God Rank underneath).
const playerRankTab = s => s && (s.rank || 0) >= 2 && s.north >= 3 ? NORTH_TAB : (s && s.rank) || 0;
const playerRankName = s => { const r = playerRankTab(s); return r === NORTH_TAB ? NORDIC_NAME : RANKS[r].name; };
