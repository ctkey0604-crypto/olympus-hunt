/* ============================== HELPERS ================================== */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtMoney = n => Math.floor(n).toLocaleString('en-US');
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtPlay = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };
function relTime(ts) {
  if (!ts) return 'never';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago';
  if (d < 86400) return Math.floor(d / 3600) + ' h ago'; return Math.floor(d / 86400) + ' days ago';
}
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hashStr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const easeOut = t => 1 - (1 - t) * (1 - t);

const VIEW_W = 384, VIEW_H = 216, TILE = 16;
// The world is 40 x 26 tiles for the village and most hunts. Titan arenas are bigger, so the size
// is set whenever a place or hunt starts. INNER = walkable area in tiles, IPX = the same in pixels.
let WT = 40, HT = 26, WORLD_W = WT * TILE, WORLD_H = HT * TILE;
const INNER = { x0: 3, y0: 3, x1: 36, y1: 22 };
const IPX = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
function setWorldSize(wt = 40, ht = 26) {
  WT = wt; HT = ht; WORLD_W = wt * TILE; WORLD_H = ht * TILE;
  INNER.x0 = 3; INNER.y0 = 3; INNER.x1 = wt - 4; INNER.y1 = ht - 4;
  IPX.minX = INNER.x0 * TILE; IPX.maxX = (INNER.x1 + 1) * TILE; IPX.minY = INNER.y0 * TILE; IPX.maxY = (INNER.y1 + 1) * TILE;
}
setWorldSize();
const tc = t => t * TILE + 8;

/* ============================== BALANCE ================================== */
// Tier = how far into the game a hunt sits (1 Hermes … 12 Zeus, 13-16.5 the Titans). High Rank
// replays everything 16 tiers up and God Rank 32 tiers up. Everything scales from the gear a player
// is expected to own at that tier, so each fight stays a challenge without spiking.
const TIER_W = [0, 13, 17, 20, 23, 26, 29, 32, 35, 38, 42, 46, 50, 54];     // expected sword damage
const TIER_D = [0, 4, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 43];      // expected armor defense
const TIER_H = [0, 115, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 180]; // expected max health
// Past the end of a table the curve keeps climbing at a steady rate.
const tierAt = (arr, t, slope) => {
  const last = arr.length - 1;
  if (t >= last) return arr[last] + (t - last) * slope;
  t = Math.max(1, t); const i = Math.floor(t), f = t - i; return arr[i] + (arr[i + 1] - arr[i]) * f;
};
const tierW = t => tierAt(TIER_W, t, 4), tierD = t => tierAt(TIER_D, t, 4), tierH = t => tierAt(TIER_H, t, 5);
// Raw damage that takes away `pct` of an on-curve player's health after their armor.
const rawDmg = (pct, t) => Math.max(1, Math.round(pct * tierH(t) * (20 + tierD(t)) / 20));
// Monster classes: how many sword hits to kill (x expected damage) and how hard they hit (share of your health).
const CLASS = {
  fodder: { hpM: 1.7, dmgP: .06, heal: .07 },     // dies in 1-2 hits, comes in numbers
  medium: { hpM: 5.5, dmgP: .14, heal: .16 },     // 4-8 hits, one attack that makes you react
  heavy:  { hpM: 18,  dmgP: .26, heal: .5 },      // anchors a wave, big area attack
};
const ATTACK_TURNS = { melee: 3, ranged: 2 };    // how many monsters may attack you at the same moment
// Ranks. Low Rank is everything until every god and Titan falls; then the herald opens High Rank, and later God Rank.
// hp / dmg: on top of the tier curve. tempo: how fast monsters and gods think (shorter windups and rests).
// gear: name prefix for that rank's forged gear; item: suffix for its parts.
const RANKS = [
  { id: 0, key: 'lr', name: 'Low Rank',  prefix: '',    off: 0,  hp: 1,    dmg: 1,    tempo: 1,    waves: [1, 1, 0],     turns: [3, 2], gear: '',           item: '',   cost: 1, col: '#d8ccb4' },
  { id: 1, key: 'hr', name: 'High Rank', prefix: 'hr_', off: 16, hp: 1.15, dmg: 1.15, tempo: 1.17, waves: [1.3, 1.2, 0], turns: [4, 2], gear: 'Dread ',     item: '+',  cost: 4, col: '#e2603f' },
  { id: 2, key: 'gr', name: 'God Rank',  prefix: 'gr_', off: 32, hp: 1.3,  dmg: 1.3,  tempo: 1.32, waves: [1.6, 1.4, 1], turns: [5, 3], gear: 'Godslayer ', item: '++', cost: 8, col: '#b48cff' },
];
const rankOf = id => typeof id !== 'string' ? 0 : id.startsWith('gr_') ? 2 : id.startsWith('hr_') ? 1 : 0;
const baseId = id => rankOf(id) ? id.slice(3) : id;
const rid = (base, r) => (RANKS[r] || RANKS[0]).prefix + base;

/* ============================== DATA ===================================== */
// Materials. rarity 1 common … 4 god-tier. icon: a hand-drawn grid (ICON_DATA) or [template, colour1, colour2, colour3].
const ITEMS = {
  bandit_cloth:   { name: 'Bandit Cloth',      rarity: 1, desc: 'Rough wool torn from a road bandit.' },
  stolen_ring:    { name: 'Stolen Ring',       rarity: 3, desc: 'A gold ring with a blue stone. Somebody wants it back.' },
  sling_cord:     { name: 'Sling Cord',        rarity: 1, desc: 'Braided flax from a hill slinger.' },
  smooth_stone:   { name: 'Smooth Stone',      rarity: 1, desc: 'A river stone worn smooth in a sling pouch.' },
  cattle_hide:    { name: 'Cattle Hide',       rarity: 2, desc: 'Thick hide from Apollo’s runaway herd.' },
  golden_horn:    { name: 'Golden Horn',       rarity: 3, desc: 'A gilded horn from a sacred bull.' },
  winged_feather: { name: 'Winged Feather',    rarity: 4, desc: 'Shed from Hermes’ sandals in mid-flight.' },
  herald_token:   { name: 'Herald’s Token', rarity: 4, desc: 'Proof you outran the messenger god. Every Hermes kill drops one.' },
  wolf_pelt:      { name: 'Wolf Pelt',         rarity: 1, icon: ['hide', '#8f8f8f', '#5f5f5f'], desc: 'Grey fur from Artemis’ hunting wolves.' },
  wolf_fang:      { name: 'Wolf Fang',         rarity: 2, icon: ['fang', '#f3e9d4', '#c2b293'], desc: 'Long and sharp. Still warm.' },
  silver_arrowhead:{ name: 'Silver Arrowhead', rarity: 2, icon: ['shard', '#d5dbe5', '#8f98a8'], desc: 'From a huntress’s quiver.' },
  stag_antler:    { name: 'Stag Antler',       rarity: 2, icon: ['horn', '#c9a46b', '#8a6a3a', '#f3e9d4'], desc: 'A branch of antler from a golden stag.' },
  calydon_tusk:   { name: 'Calydon Tusk',      rarity: 3, icon: ['fang', '#fff6d8', '#c9b48e'], desc: 'A tusk from the great boar of Calydon.' },
  moon_silver:    { name: 'Moon Silver',       rarity: 4, icon: ['gem', '#d5dbe5', '#8f98a8', '#ffffff'], desc: 'Silver that glows faintly at night.' },
  hunt_token:     { name: 'Token of the Hunt', rarity: 4, icon: ['coin', '#d5dbe5', '#8f98a8', '#5b9bd5'], desc: 'Every Artemis kill drops one.' },
  satyr_fur:      { name: 'Satyr Fur',         rarity: 1, icon: ['hide', '#7a5232', '#5a3a22'], desc: 'Shaggy goat fur. Smells of wine.' },
  grape_cluster:  { name: 'Grape Cluster',     rarity: 1, icon: ['grape', '#7a4f9c', '#4a2f63', '#7fa548'], desc: 'Grapes from the god’s own vines.' },
  panther_pelt:   { name: 'Panther Pelt',      rarity: 2, icon: ['hide', '#3a3a40', '#1f1f24'], desc: 'Black fur from Dionysus’ panthers.' },
  maenad_ivy:     { name: 'Maenad Ivy',        rarity: 2, icon: ['flower', '#4e8a3a', '#2f5a22', '#e9c04f'], desc: 'Ivy torn from a maenad’s crown.' },
  centaur_hoof:   { name: 'Centaur Hoof',      rarity: 3, icon: ['bone', '#8a6a4a', '#5a3a22'], desc: 'A heavy hoof from a drunken centaur.' },
  wine_of_ages:   { name: 'Wine of Ages',      rarity: 4, icon: ['vial', '#9c2a4a', '#5a1a2c', '#e9c04f'], desc: 'Wine that never runs out.' },
  revel_token:    { name: 'Revel Token',       rarity: 4, icon: ['coin', '#9a6bc0', '#5a3b78', '#7fa548'], desc: 'Every Dionysus kill drops one.' },
  wild_horn:      { name: 'Wild Horn',         rarity: 4, icon: ['horn', '#8a5a34', '#5a3a22', '#e9c04f'], desc: 'One of Pan’s horns. He grows them back.' },
  owl_quill:      { name: 'Owl Quill',         rarity: 1, desc: 'A grey flight feather from one of Athena’s war owls.' },
  silver_talon:   { name: 'Silver Talon',      rarity: 3, desc: 'A war owl’s talon, bright as polished silver.' },
  cedar_shaft:    { name: 'Cedar Shaft',       rarity: 1, desc: 'A straight arrow shaft from an Athenian archer’s quiver.' },
  bronze_plate:   { name: 'Bronze Plate',      rarity: 2, desc: 'Hammered bronze from a hoplite’s armor.' },
  hoplite_crest:  { name: 'Hoplite Crest',     rarity: 3, desc: 'A horsehair helmet crest dyed red.' },
  aegis_scale:    { name: 'Aegis Scale',       rarity: 4, desc: 'A scale from Athena’s goatskin aegis.' },
  wisdom_token:   { name: 'Token of Wisdom',   rarity: 4, desc: 'Every Athena kill drops one.' },
  suitor_silk:    { name: 'Suitor Silk',       rarity: 1, icon: ['cloth', '#e88aa8', '#b85a78'], desc: 'Fine silk from a lovesick suitor.' },
  dove_feather:   { name: 'Dove Feather',      rarity: 1, icon: ['feather', '#ffffff', '#c9d0dc'], desc: 'A soft white feather.' },
  eros_arrow:     { name: 'Eros Arrow',        rarity: 2, icon: ['arrow', '#e9c04f', '#e88aa8', '#f3e9d4'], desc: 'One prick and you’re in love. Handle carefully.' },
  rose_quartz:    { name: 'Rose Quartz',       rarity: 3, icon: ['gem', '#f2a7c0', '#c76d8e', '#ffffff'], desc: 'A pink crystal from Aphrodite’s garden.' },
  foam_pearl:     { name: 'Sea-Foam Pearl',    rarity: 4, icon: ['orb', '#fff6f8', '#f2a7c0', '#ffffff'], desc: 'Born from the same foam as the goddess.' },
  love_token:     { name: 'Token of Desire',   rarity: 4, icon: ['coin', '#f2a7c0', '#c76d8e', '#e9c04f'], desc: 'Every Aphrodite kill drops one.' },
  plague_ash:     { name: 'Plague Ash',        rarity: 1, icon: ['shard', '#8a9a6a', '#5a6a4a'], desc: 'Grey-green ash from a plague wretch.' },
  sun_arrowhead:  { name: 'Sun Arrowhead',     rarity: 2, icon: ['shard', '#ffd463', '#c9a032'], desc: 'Warm to the touch, always.' },
  python_scale:   { name: 'Python Scale',      rarity: 2, icon: ['scale', '#6f9a3e', '#3e5a22', '#e9c04f'], desc: 'A scale from the serpent of Delphi.' },
  python_fang:    { name: 'Python Fang',       rarity: 3, icon: ['fang', '#d8e6b0', '#6f9a3e'], desc: 'Still dripping venom.' },
  sun_disk:       { name: 'Sun Disk',          rarity: 4, icon: ['orb', '#ffd463', '#e9a030', '#ffffff'], desc: 'A sliver of the sun itself.' },
  light_token:    { name: 'Token of Light',    rarity: 4, icon: ['coin', '#ffd463', '#c9a032', '#ffffff'], desc: 'Every Apollo kill drops one.' },
  witch_torch:    { name: 'Witch Torch',       rarity: 4, icon: ['ember', '#57c2b0', '#2c5684', '#ffffff'], desc: 'One of Hecate’s torches. It burns cold.' },
  dragon_tooth:   { name: 'Dragon Tooth',      rarity: 1, icon: ['tooth', '#f3e9d4', '#c2b293'], desc: 'Sow it and a soldier grows. Don’t.' },
  boar_bristle:   { name: 'Boar Bristle',      rarity: 1, icon: ['hide', '#4a3428', '#2c1d17'], desc: 'Stiff black bristles from a war boar.' },
  bloodied_bronze:{ name: 'Bloodied Bronze',   rarity: 2, icon: ['plate', '#c0412e', '#7f2618'], desc: 'Battle-worn bronze plating.' },
  gigas_bone:     { name: 'Gigas Bone',        rarity: 3, icon: ['bone', '#d8ceb7', '#8f846c'], desc: 'A bone from one of the earth-born giants.' },
  war_ember:      { name: 'War Ember',         rarity: 4, icon: ['ember', '#ff5a3c', '#a8261a', '#ffd463'], desc: 'It never cools while there is fighting somewhere.' },
  war_token:      { name: 'Token of War',      rarity: 4, icon: ['coin', '#c0412e', '#7f2618', '#e9c04f'], desc: 'Every Ares kill drops one.' },
  nemesis_scale:  { name: 'Scale of Nemesis',  rarity: 4, icon: ['coin', '#c9bda4', '#5a5245', '#e9c04f'], desc: 'One pan of the scales of justice.' },
  crab_shell:     { name: 'Crab Shell',        rarity: 1, icon: ['shell', '#e07a3a', '#a04a1a'], desc: 'Hard orange shell.' },
  sea_glass:      { name: 'Sea Glass',         rarity: 1, icon: ['gem', '#7fd0c8', '#3c8f82', '#ffffff'], desc: 'Smoothed by the tide.' },
  triton_scale:   { name: 'Triton Scale',      rarity: 2, icon: ['scale', '#57c2b0', '#2c7a70', '#ffffff'], desc: 'From a triton’s fishy half.' },
  giant_claw:     { name: 'Giant Claw',        rarity: 3, icon: ['claw', '#e07a3a', '#a04a1a'], desc: 'A claw the size of a shield.' },
  trident_pearl:  { name: 'Trident Pearl',     rarity: 4, icon: ['orb', '#c8f0ec', '#57c2b0', '#ffffff'], desc: 'Poseidon’s pearl. You can hear the sea in it.' },
  sea_token:      { name: 'Token of the Sea',  rarity: 4, icon: ['coin', '#57c2b0', '#2c7a70', '#ffffff'], desc: 'Every Poseidon kill drops one.' },
  peacock_plume:  { name: 'Peacock Plume',     rarity: 1, icon: ['feather', '#3f9a8a', '#2c5684', '#e9c04f'], desc: 'An eye-patterned plume.' },
  pomegranate:    { name: 'Pomegranate',       rarity: 1, icon: ['orb', '#c0412e', '#7f2618', '#f2a7c0'], desc: 'Hera’s sacred fruit.' },
  royal_gold:     { name: 'Royal Gold',        rarity: 2, icon: ['plate', '#e9c04f', '#a8842a'], desc: 'Gold leaf from the queen’s court.' },
  argus_eye:      { name: 'Argus Eye',         rarity: 3, icon: ['eye', '#f3e9d4', '#2c5684', '#140d0b'], desc: 'One of a hundred. It blinks.' },
  regal_plume:    { name: 'Regal Plume',       rarity: 4, icon: ['feather', '#e9c04f', '#2c5684', '#3f9a8a'], desc: 'From the peacock that never leaves Hera’s side.' },
  queen_token:    { name: 'Token of the Queen',rarity: 4, icon: ['coin', '#5b9bd5', '#2c5684', '#e9c04f'], desc: 'Every Hera kill drops one.' },
  golden_apple:   { name: 'Golden Apple',      rarity: 4, icon: ['orb', '#e9c04f', '#a8842a', '#7fa548'], desc: '"For the fairest." Trouble follows it.' },
  bronze_gear:    { name: 'Bronze Gear',       rarity: 1, icon: ['gear', '#c9a032', '#8f6c1c'], desc: 'A cog from a broken automaton.' },
  spark_dust:     { name: 'Spark Dust',        rarity: 1, desc: 'What’s left of a living spark.' },
  cyclops_hide:   { name: 'Cyclops Hide',      rarity: 2, desc: 'Hide as thick as a door.' },
  automaton_core: { name: 'Automaton Core',    rarity: 2, icon: ['orb', '#ff8a2b', '#a8501a', '#ffd463'], desc: 'A glowing heart of bronze clockwork.' },
  cyclops_eye:    { name: 'Cyclops Eye',       rarity: 3, desc: 'A huge, cloudy eye that still seems to watch you.' },
  divine_bronze:  { name: 'Divine Bronze',     rarity: 4, icon: ['plate', '#ffd463', '#c9a032'], desc: 'Bronze from Hephaestus’ own anvil.' },
  forge_token:    { name: 'Token of the Forge',rarity: 4, icon: ['coin', '#ff8a2b', '#a8501a', '#ffd463'], desc: 'Every Hephaestus kill drops one.' },
  grave_dust:     { name: 'Grave Dust',        rarity: 1, icon: ['shard', '#a7adb3', '#636a72'], desc: 'Dust from the restless dead.' },
  shade_essence:  { name: 'Shade Essence',     rarity: 1, icon: ['orb', '#6b5a8a', '#3a2f4a', '#c8b8ff'], desc: 'A wisp of a lost soul.' },
  fury_wing:      { name: 'Fury Wing',         rarity: 2, icon: ['feather', '#7f2618', '#140d0b', '#c0412e'], desc: 'A leathery wing from an Erinys.' },
  styx_water:     { name: 'Styx Water',        rarity: 2, icon: ['vial', '#3c6a5a', '#1f3a32', '#7fd0c8'], desc: 'Water from the river of oaths.' },
  cerberus_fang:  { name: 'Cerberus Fang',     rarity: 3, icon: ['fang', '#f3e9d4', '#7f2618'], desc: 'From one of three very angry heads.' },
  soul_gem:       { name: 'Soul Gem',          rarity: 4, icon: ['gem', '#7fe08a', '#2f8a4a', '#ffffff'], desc: 'It whispers.' },
  death_token:    { name: 'Token of the Dead', rarity: 4, icon: ['coin', '#4a4a52', '#1f1f24', '#7fe08a'], desc: 'Every Hades kill drops one.' },
  poppy_dream:    { name: 'Dream Poppy',       rarity: 4, icon: ['flower', '#c0412e', '#7f2618', '#140d0b'], desc: 'Hypnos’ flower. Don’t sniff it.' },
  harpy_talon:    { name: 'Harpy Talon',       rarity: 1, desc: 'A hooked claw from a storm harpy.' },
  eagle_feather:  { name: 'Eagle Feather',     rarity: 1, icon: ['feather', '#8a5a34', '#f3e9d4', '#e9c04f'], desc: 'From Zeus’ own eagles.' },
  storm_glass:    { name: 'Storm Glass',       rarity: 2, desc: 'Sand fused by lightning. It hums when you hold it.' },
  storm_hide:     { name: 'Storm Hide',        rarity: 2, icon: ['hide', '#7a8aa8', '#4d5a72'], desc: 'Blue-grey cyclops hide, crackling with static.' },
  storm_eye:      { name: 'Storm Eye',         rarity: 3, icon: ['eye', '#e6f2ff', '#57c2b0', '#140d0b'], desc: 'A cyclops eye full of lightning.' },
  thunder_core:   { name: 'Thunder Core',      rarity: 4, desc: 'A shard of Zeus’ lightning, still crackling.' },
  olympian_token: { name: 'Olympian Token',    rarity: 4, desc: 'Every Zeus kill drops one.' },
};

// Weapon kinds = how a weapon plays. dmgM converts the tier's expected damage into this kind's hit.
const KINDS = {
  sword:   { label: 'Sword',        melee: true,  oneHand: true,  dmgM: 1,    reach: 22, arc: 2.2, windup: .05, active: .13, cooldown: .32, knock: 85,  moveMul: .55, hitstop: .035, shake: 1, sfx: 'swing', blurb: 'Quick, wide swing. Works with a shield.' },
  spear:   { label: 'Spear',        melee: true,  oneHand: true,  dmgM: 1.2,  reach: 36, arc: .6,  windup: .09, active: .14, cooldown: .44, knock: 150, moveMul: .4,  hitstop: .04,  shake: 1, sfx: 'swing', blurb: 'Long, narrow thrust. Works with a shield.' },
  hammer:  { label: 'Hammer',       melee: true,  oneHand: false, dmgM: 2.6,  reach: 27, arc: 3.1, windup: .26, active: .16, cooldown: .8,  knock: 240, moveMul: .3,  hitstop: .075, shake: 3, sfx: 'heavy', blurb: 'Slow, huge arc, sends enemies flying. Two hands, no shield.' },
  daggers: { label: 'Twin daggers', melee: true,  oneHand: false, dmgM: .6,   reach: 24, arc: 2.1, windup: .02, active: .09, cooldown: .15, knock: 60,  moveMul: .75, hitstop: .02,  shake: 0, sfx: 'swing', blurb: 'Very fast stabs that shred anything in reach. No shield.' },
  bow:     { label: 'Bow',          melee: false, oneHand: false, dmgM: .72,  windup: .07, active: .12, cooldown: .44, projSpeed: 250, knock: 70, moveMul: .55, hitstop: .02, shake: 0, sfx: 'arrow', blurb: 'Ranged shots that auto-aim. No shield.' },
};

const ABILITIES = {
  winged_step: { name: 'Winged Step',     cd: 4, desc: 'Dash forward untouchable, cutting through everything in your path.' },
  stampede:    { name: 'Stampede Slam',   cd: 6, desc: 'Slam the ground. Stuns and hurls back everything nearby.' },
  volley:      { name: 'Moon Volley',     cd: 6, desc: 'Loose seven arrows in a wide fan.' },
  frenzy:      { name: 'Frenzy',          cd: 9, desc: 'Attack 60% faster for 5 seconds.' },
  aegis:       { name: 'Aegis Ward',      cd: 7, desc: 'Nothing can hurt you for a moment, and arrows and bolts fly back where they came from.' },
  soulsteal:   { name: 'Heartsteal',      cd: 9, desc: 'For 5 seconds, every hit heals you.' },
  sunburst:    { name: 'Sunburst',        cd: 7, desc: 'Fire a ring of sunlight in every direction.' },
  whirlwind:   { name: 'Whirlwind',       cd: 6, desc: 'Spin and hit everything around you three times.' },
  tidal:       { name: 'Tidal Wave',      cd: 7, desc: 'A wave rolls out from you and shoves everything far back.' },
  quake:       { name: 'Earthquake',      cd: 8, desc: 'Spikes burst from the ground around you and stun what they hit.' },
  eruption:    { name: 'Eruption',        cd: 8, desc: 'Fire bursts under the five nearest enemies.' },
  deathmark:   { name: 'Death Mark',      cd: 9, desc: 'Enemies near you take 50% more damage for 6 seconds.' },
  chain:       { name: 'Chain Lightning', cd: 6, desc: 'Lightning jumps between up to five nearby enemies.' },
};

// wt = power tier (matches TIER_W). Damage is worked out from it, so every weapon stays in line with the curve.
const WEAPONS = {
  bronze_sword:    { name: 'Bronze Sword',          kind: 'sword',   wt: 1,    recipe: null, desc: 'Standard issue for a new hunter.' },
  bandit_spear:    { name: 'Brigand’s Spear',  kind: 'spear',   wt: 1.5,  recipe: { items: { bandit_cloth: 5, stolen_ring: 1 }, cost: 120 }, desc: 'A long road spear, re-wrapped with stolen wool.' },
  hill_bow:        { name: 'Hill Bow',              kind: 'bow',     wt: 1.5,  pierce: 1, recipe: { items: { sling_cord: 4, smooth_stone: 3 }, cost: 150 }, desc: 'Strung with sling cord. Shots punch through one extra enemy.' },
  bull_maul:       { name: 'Bull Maul',             kind: 'hammer',  wt: 1.8,  ability: 'stampede', recipe: { items: { cattle_hide: 5, golden_horn: 1 }, cost: 300 }, desc: 'A horn-capped maul with the weight of a charging bull.' },
  harpe:           { name: 'Harpe of Hermes',       kind: 'daggers', wt: 2,    ability: 'winged_step', recipe: { items: { winged_feather: 4, herald_token: 2 }, cost: 600 }, desc: 'Twin sickle blades of the messenger god.' },
  stag_spear:      { name: 'Antler Spear',          kind: 'spear',   wt: 2.5,  recipe: { items: { stag_antler: 4, wolf_pelt: 3, calydon_tusk: 1 }, cost: 500 }, desc: 'Tipped with a stag’s antler.' },
  wolf_fangs:      { name: 'Wolf Fangs',            kind: 'daggers', wt: 2.5,  recipe: { items: { wolf_fang: 5, wolf_pelt: 4 }, cost: 450 }, desc: 'Two fangs bound in fur.' },
  silver_bow:      { name: 'Silver Bow of Artemis', kind: 'bow',     wt: 3,    pierce: 1, ability: 'volley', recipe: { items: { moon_silver: 3, hunt_token: 2, silver_arrowhead: 4 }, cost: 800 }, desc: 'Strung with moonlight.' },
  satyr_club:      { name: 'Satyr Club',            kind: 'hammer',  wt: 3.5,  recipe: { items: { satyr_fur: 6, panther_pelt: 2, centaur_hoof: 1 }, cost: 650 }, desc: 'Knotted vine-wood, very heavy.' },
  thyrsus:         { name: 'Thyrsus',               kind: 'spear',   wt: 4,    ability: 'frenzy', recipe: { items: { wine_of_ages: 3, revel_token: 2, maenad_ivy: 4 }, cost: 1000 }, desc: 'Dionysus’ pine-cone staff. It makes you a little wild.' },
  wild_maul:       { name: 'Pan’s Wild Maul',  kind: 'hammer',  wt: 4.2,  ability: 'stampede', recipe: { items: { wild_horn: 2, satyr_fur: 4 }, cost: 900 }, desc: 'Hits like a herd.' },
  owl_bow:         { name: 'Owlfeather Bow',        kind: 'bow',     wt: 4.5,  pierce: 2, recipe: { items: { owl_quill: 5, cedar_shaft: 4, silver_talon: 1 }, cost: 700 }, desc: 'Light and silent. Shots punch through two extra enemies.' },
  hoplite_dory:    { name: 'Hoplite Dory',          kind: 'spear',   wt: 4.5,  recipe: { items: { bronze_plate: 5, cedar_shaft: 3, hoplite_crest: 1 }, cost: 750 }, desc: 'The long spear of the Athenian battle line.' },
  athena_spear:    { name: 'Spear of Athena',       kind: 'spear',   wt: 5,    ability: 'aegis', recipe: { items: { aegis_scale: 4, wisdom_token: 2, bronze_plate: 3 }, cost: 1300 }, desc: 'Athena’s own spear, balanced perfectly.' },
  myrtle_spear:    { name: 'Myrtle Spear',          kind: 'spear',   wt: 5.5,  recipe: { items: { suitor_silk: 5, eros_arrow: 3, rose_quartz: 1 }, cost: 900 }, desc: 'Wound with myrtle and silk.' },
  rose_blade:      { name: 'Rose Blade',            kind: 'sword',   wt: 6,    ability: 'soulsteal', recipe: { items: { foam_pearl: 3, love_token: 2, rose_quartz: 1 }, cost: 1500 }, desc: 'Pretty, and much sharper than it looks.' },
  laurel_bow:      { name: 'Laurel Bow',            kind: 'bow',     wt: 6.5,  pierce: 2, recipe: { items: { sun_arrowhead: 5, python_scale: 3, python_fang: 1 }, cost: 1100 }, desc: 'Apollo’s favourite wood.' },
  sunblade:        { name: 'Sunblade',              kind: 'sword',   wt: 7,    ability: 'sunburst', recipe: { items: { sun_disk: 3, light_token: 2, python_scale: 4 }, cost: 1800 }, desc: 'Forged at noon, on the longest day.' },
  witchfire_daggers:{ name: 'Witchfire Daggers',    kind: 'daggers', wt: 7,    ability: 'eruption', recipe: { items: { witch_torch: 2, plague_ash: 6 }, cost: 1500 }, desc: 'Cold blue fire on both blades.' },
  spartoi_spear:   { name: 'Spartoi Spear',         kind: 'spear',   wt: 7.5,  recipe: { items: { dragon_tooth: 6, bloodied_bronze: 3, gigas_bone: 1 }, cost: 1300 }, desc: 'Taken from a soldier who grew out of the ground.' },
  ares_warblade:   { name: 'Warblade of Ares',      kind: 'sword',   wt: 8,    ability: 'whirlwind', recipe: { items: { war_ember: 3, war_token: 2, bloodied_bronze: 4 }, cost: 2200 }, desc: 'It wants to be swung.' },
  retribution:     { name: 'Blade of Retribution',  kind: 'sword',   wt: 8,    ability: 'deathmark', recipe: { items: { nemesis_scale: 2, bloodied_bronze: 4 }, cost: 2000 }, desc: 'Everyone gets what they deserve.' },
  coral_daggers:   { name: 'Coral Daggers',         kind: 'daggers', wt: 8.5,  recipe: { items: { crab_shell: 6, triton_scale: 3, giant_claw: 1 }, cost: 1600 }, desc: 'Grown, not forged.' },
  trident:         { name: 'Trident of the Deep',   kind: 'spear',   wt: 9,    ability: 'tidal', recipe: { items: { trident_pearl: 3, sea_token: 2, triton_scale: 4 }, cost: 2600 }, desc: 'Poseidon’s weapon. It drips forever.' },
  peacock_bow:     { name: 'Peacock Bow',           kind: 'bow',     wt: 9.5,  pierce: 2, recipe: { items: { peacock_plume: 6, royal_gold: 3, argus_eye: 1 }, cost: 1900 }, desc: 'Fletched with eye-feathers.' },
  hera_scepter:    { name: 'Scepter of Hera',       kind: 'hammer',  wt: 10,   ability: 'quake', recipe: { items: { regal_plume: 3, queen_token: 2, royal_gold: 4 }, cost: 3000 }, desc: 'The queen’s scepter. Heavier than a throne.' },
  discord_bow:     { name: 'Bow of Discord',        kind: 'bow',     wt: 10,   pierce: 1, ability: 'volley', recipe: { items: { golden_apple: 2, peacock_plume: 5 }, cost: 2600 }, desc: 'Its arrows never fly quite straight. They don’t need to.' },
  cyclops_club:    { name: 'Cyclops Club',          kind: 'hammer',  wt: 10.5, recipe: { items: { cyclops_hide: 5, cyclops_eye: 1, automaton_core: 2 }, cost: 2200 }, desc: 'A small tree with a bad attitude.' },
  automaton_blade: { name: 'Automaton Blade',       kind: 'sword',   wt: 10.5, recipe: { items: { bronze_gear: 6, automaton_core: 3, cyclops_eye: 1 }, cost: 2200 }, desc: 'Cut from a bronze guardian’s arm.' },
  forge_hammer:    { name: 'Hammer of Hephaestus',  kind: 'hammer',  wt: 11,   ability: 'eruption', recipe: { items: { divine_bronze: 3, forge_token: 2, automaton_core: 4 }, cost: 3400 }, desc: 'The hammer that forged the thunderbolt.' },
  stygian_daggers: { name: 'Stygian Daggers',       kind: 'daggers', wt: 11.5, recipe: { items: { shade_essence: 6, styx_water: 3, cerberus_fang: 1 }, cost: 2600 }, desc: 'Dipped in the Styx.' },
  bident:          { name: 'Bident of Hades',       kind: 'spear',   wt: 12,   ability: 'deathmark', recipe: { items: { soul_gem: 3, death_token: 2, styx_water: 4 }, cost: 3800 }, desc: 'Two prongs. Both of them final.' },
  dream_daggers:   { name: 'Dreamweaver Daggers',   kind: 'daggers', wt: 12,   ability: 'soulsteal', recipe: { items: { poppy_dream: 2, shade_essence: 6 }, cost: 3200 }, desc: 'They hit like a bad dream.' },
  storm_fangs:     { name: 'Storm Fangs',           kind: 'daggers', wt: 12.5, recipe: { items: { harpy_talon: 6, storm_glass: 3, storm_eye: 1 }, cost: 3000 }, desc: 'Twin blades of lightning glass.' },
  keraunos:        { name: 'Keraunos',              kind: 'sword',   wt: 13,   ability: 'chain', recipe: { items: { thunder_core: 4, olympian_token: 2, storm_eye: 1 }, cost: 5000 }, desc: 'A blade forged around one of Zeus’ thunderbolts.' },
};

// Armor: every set has 4 pieces. Defense and health split across slots; each slot also has a job.
const SLOTS = ['head', 'chest', 'legs', 'feet'];
const SLOT_LABEL = { head: 'Helmet', chest: 'Chest', legs: 'Legs', feet: 'Boots' };
const SLOT_SPLIT = { head: { def: .2, hp: 0 }, chest: { def: .4, hp: .6 }, legs: { def: .25, hp: .4 }, feet: { def: .15, hp: 0 } };
// colours: head [main, shade, crest], chest [main, shade, trim], legs [main, shade], feet [main, shade]. null = nothing drawn.
// extra: a decoration drawn on the helmet (wings, horns, crest, laurel, hood, crown, ivy, antlers, flame).
const ARMOR_SETS = {
  traveler: { name: 'Traveler',  ch: 0,  def: 0,  hp: 0,  start: true, colors: { head: ['#5a3a22', '#3a2416', null], chest: ['#c0412e', '#7f2618', '#e9c04f'], legs: ['#e8b796', '#b97f5f'], feet: ['#8a5a34', '#5a3a22'] }, desc: 'Hair, a red tunic and sandals.' },
  brigand:  { name: 'Brigand',   ch: 1,  def: 3,  hp: 0,  colors: { head: ['#6b4528', '#4e321d', null], chest: ['#8a5a34', '#5a3a22', '#d9822b'], legs: ['#6b4528', '#4e321d'], feet: ['#3a2416', '#1f140c'] }, extra: 'hood', recipe: { items: { bandit_cloth: 8 }, cost: 100 }, two: { healDrops: .04 }, desc: 'Padded wool and leather from the road gangs.' },
  herdsman: { name: 'Herdsman',  ch: 1,  def: 6,  hp: 15, colors: { head: ['#8a5a34', '#5a3a22', '#f3e9d4'], chest: ['#8a5a34', '#5a3a22', '#f3e9d4'], legs: ['#6b4528', '#4e321d'], feet: ['#5a3a22', '#3a2416'] }, extra: 'horns', recipe: { items: { cattle_hide: 6, sling_cord: 3 }, cost: 250 }, two: { hp: 10 }, desc: 'Layered cattle hide with a horned cap.' },
  winged:   { name: 'Winged',    ch: 1,  def: 9,  hp: 15, god: 'hermes', colors: { head: ['#e9c04f', '#a8842a', '#f3e9d4'], chest: ['#f3e9d4', '#c2b293', '#4f8fc7'], legs: ['#f3e9d4', '#c2b293'], feet: ['#e9c04f', '#a8842a'] }, extra: 'wings', recipe: { items: { winged_feather: 4, herald_token: 1, cattle_hide: 4 }, cost: 500 }, two: { speed: .06 }, four: { dashDodge: 1 }, desc: 'Hermes’ white robes and winged hat.' },
  huntress: { name: 'Huntress',  ch: 2,  def: 10, hp: 20, colors: { head: ['#4e6e2b', '#2f4a1a', null], chest: ['#5e7d35', '#3e5a22', '#c9a46b'], legs: ['#6b4528', '#4e321d'], feet: ['#4e321d', '#2c1d12'] }, extra: 'hood', recipe: { items: { wolf_pelt: 6, stag_antler: 2 }, cost: 450 }, two: { bowDmg: .1 }, desc: 'Green leathers for moving quietly.' },
  moonlit:  { name: 'Moonlit',   ch: 2,  def: 12, hp: 20, god: 'artemis', colors: { head: ['#d5dbe5', '#8f98a8', '#ffffff'], chest: ['#d5dbe5', '#8f98a8', '#5b9bd5'], legs: ['#8f98a8', '#5f6878'], feet: ['#d5dbe5', '#8f98a8'] }, extra: 'antlers', recipe: { items: { moon_silver: 3, hunt_token: 1, wolf_pelt: 5 }, cost: 800 }, two: { dodgeCd: .1 }, four: { dodgeStrike: .4 }, desc: 'Silver mail that shines like the moon.' },
  reveler:  { name: 'Reveler',   ch: 3,  def: 13, hp: 25, colors: { head: ['#4e8a3a', '#2f5a22', '#7a4f9c'], chest: ['#7a4f9c', '#4a2f63', '#e9c04f'], legs: ['#7a5232', '#5a3a22'], feet: ['#5a3a22', '#3a2416'] }, extra: 'ivy', recipe: { items: { satyr_fur: 6, grape_cluster: 4, maenad_ivy: 2 }, cost: 650 }, two: { regen: .5 }, desc: 'Party clothes, mostly. Somehow it works.' },
  bacchic:  { name: 'Bacchic',   ch: 3,  def: 15, hp: 25, god: 'dionysus', colors: { head: ['#4e8a3a', '#2f5a22', '#9a6bc0'], chest: ['#5a3b78', '#3a2450', '#e9c04f'], legs: ['#3a3a40', '#1f1f24'], feet: ['#5a3a22', '#3a2416'] }, extra: 'ivy', recipe: { items: { wine_of_ages: 3, revel_token: 1, panther_pelt: 4 }, cost: 1000 }, two: { abilityCd: .15 }, four: { killFrenzy: 1 }, desc: 'Panther skin and a crown of ivy.' },
  hoplite:  { name: 'Hoplite',   ch: 4,  def: 16, hp: 30, colors: { head: ['#e9c04f', '#a8842a', '#c0412e'], chest: ['#e9c04f', '#a8842a', '#c0412e'], legs: ['#c0412e', '#7f2618'], feet: ['#e9c04f', '#a8842a'] }, extra: 'crest', recipe: { items: { bronze_plate: 6, hoplite_crest: 1, owl_quill: 3 }, cost: 700 }, two: { guard: .25 }, desc: 'Bronze cuirass, greaves and a crested helm.' },
  aegis:    { name: 'Aegis',     ch: 4,  def: 18, hp: 30, god: 'athena', colors: { head: ['#a7adb3', '#636a72', '#4f8fc7'], chest: ['#4f8fc7', '#2c5684', '#e9c04f'], legs: ['#a7adb3', '#636a72'], feet: ['#a7adb3', '#636a72'] }, extra: 'crest', recipe: { items: { aegis_scale: 3, wisdom_token: 1, bronze_plate: 4 }, cost: 1300 }, two: { projRes: .2 }, four: { reflectPerfect: 1 }, desc: 'Silver and blue, sewn with scales of the aegis.' },
  myrtle:   { name: 'Myrtle',    ch: 5,  def: 19, hp: 35, colors: { head: ['#e88aa8', '#b85a78', null], chest: ['#e88aa8', '#b85a78', '#f3e9d4'], legs: ['#f3e9d4', '#c2b293'], feet: ['#b85a78', '#7f3a52'] }, extra: 'hood', recipe: { items: { suitor_silk: 6, dove_feather: 4, eros_arrow: 2 }, cost: 900 }, two: { healDrops: .05 }, desc: 'Soft silk that’s tougher than it looks.' },
  rose:     { name: 'Rose',      ch: 5,  def: 21, hp: 35, god: 'aphrodite', colors: { head: ['#e9c04f', '#a8842a', '#f2a7c0'], chest: ['#f2a7c0', '#c76d8e', '#e9c04f'], legs: ['#fff6f8', '#e0c8d0'], feet: ['#e9c04f', '#a8842a'] }, extra: 'roses', recipe: { items: { foam_pearl: 3, love_token: 1, suitor_silk: 5 }, cost: 1500 }, two: { lifesteal: .03 }, four: { lifesteal: .05 }, desc: 'Pink and gold, with roses in the circlet.' },
  laurel:   { name: 'Laurel',    ch: 6,  def: 22, hp: 40, colors: { head: ['#6f9a3e', '#3e5a22', null], chest: ['#f3e9d4', '#c2b293', '#6f9a3e'], legs: ['#f3e9d4', '#c2b293'], feet: ['#8a5a34', '#5a3a22'] }, extra: 'laurel', recipe: { items: { sun_arrowhead: 5, python_scale: 3, plague_ash: 4 }, cost: 1100 }, two: { projRes: .1 }, desc: 'White linen and a laurel wreath.' },
  solar:    { name: 'Solar',     ch: 6,  def: 24, hp: 40, god: 'apollo', colors: { head: ['#ffd463', '#c9a032', '#ffffff'], chest: ['#ffd463', '#c9a032', '#ffffff'], legs: ['#f3e9d4', '#c2b293'], feet: ['#ffd463', '#c9a032'] }, extra: 'rays', recipe: { items: { sun_disk: 3, light_token: 1, python_scale: 4 }, cost: 1800 }, two: { dmg: .05 }, four: { burn: 1 }, desc: 'Gold that never stops shining.' },
  spartan:  { name: 'Spartan',   ch: 7,  def: 25, hp: 45, colors: { head: ['#a8842a', '#6b5216', '#c0412e'], chest: ['#c0412e', '#7f2618', '#a8842a'], legs: ['#a8842a', '#6b5216'], feet: ['#5a3a22', '#3a2416'] }, extra: 'crest', recipe: { items: { dragon_tooth: 6, boar_bristle: 5, bloodied_bronze: 2 }, cost: 1300 }, two: { def: 3 }, desc: 'Red cloak, bronze helm.' },
  warlord:  { name: 'Warlord',   ch: 7,  def: 27, hp: 45, god: 'ares', colors: { head: ['#3a3a40', '#1f1f24', '#c0412e'], chest: ['#7f2618', '#4a1410', '#3a3a40'], legs: ['#3a3a40', '#1f1f24'], feet: ['#3a3a40', '#1f1f24'] }, extra: 'spikes', recipe: { items: { war_ember: 3, war_token: 1, bloodied_bronze: 4 }, cost: 2200 }, two: { dmg: .06 }, four: { berserk: .25 }, desc: 'Black iron and red, made for war.' },
  coral:    { name: 'Coral',     ch: 8,  def: 28, hp: 50, colors: { head: ['#e07a3a', '#a04a1a', null], chest: ['#e07a3a', '#a04a1a', '#7fd0c8'], legs: ['#7fd0c8', '#3c8f82'], feet: ['#a04a1a', '#6a2c0e'] }, extra: 'shell', recipe: { items: { crab_shell: 6, sea_glass: 4, triton_scale: 2 }, cost: 1600 }, two: { hp: 15 }, desc: 'Crab shell and sea-glass.' },
  tidal:    { name: 'Tidal',     ch: 8,  def: 30, hp: 50, god: 'poseidon', colors: { head: ['#57c2b0', '#2c7a70', '#e07a3a'], chest: ['#2c7a70', '#1a4a44', '#e9c04f'], legs: ['#57c2b0', '#2c7a70'], feet: ['#2c7a70', '#1a4a44'] }, extra: 'fins', recipe: { items: { trident_pearl: 3, sea_token: 1, triton_scale: 4 }, cost: 2600 }, two: { knock: .3 }, four: { regen: 1 }, desc: 'Scaled armor the colour of deep water.' },
  peacock:  { name: 'Peacock',   ch: 9,  def: 31, hp: 55, colors: { head: ['#3f9a8a', '#2c5684', '#e9c04f'], chest: ['#2c5684', '#1a3352', '#3f9a8a'], legs: ['#3f9a8a', '#2a6a5e'], feet: ['#2c5684', '#1a3352'] }, extra: 'plume', recipe: { items: { peacock_plume: 6, pomegranate: 4, royal_gold: 2 }, cost: 1900 }, two: { dodgeCd: .1 }, desc: 'Blue and green, eyes on every feather.' },
  regal:    { name: 'Regal',     ch: 9,  def: 33, hp: 55, god: 'hera', colors: { head: ['#e9c04f', '#a8842a', '#5b9bd5'], chest: ['#f3e9d4', '#c2b293', '#5b9bd5'], legs: ['#5b9bd5', '#2c5684'], feet: ['#e9c04f', '#a8842a'] }, extra: 'crown', recipe: { items: { regal_plume: 3, queen_token: 1, royal_gold: 4 }, cost: 3000 }, two: { def: 4 }, four: { stunHit: .12 }, desc: 'Fit for the queen of the gods.' },
  cyclops:  { name: 'Cyclops',   ch: 10, def: 34, hp: 60, colors: { head: ['#a7adb3', '#636a72', null], chest: ['#8a909a', '#4b4f57', '#e8b796'], legs: ['#636a72', '#3e4148'], feet: ['#4b4f57', '#2a2c31'] }, extra: 'horns', recipe: { items: { cyclops_hide: 6, bronze_gear: 4, spark_dust: 4 }, cost: 2200 }, two: { hp: 20 }, desc: 'Heavy hide and iron straps.' },
  forged:   { name: 'Forged',    ch: 10, def: 36, hp: 60, god: 'hephaestus', colors: { head: ['#4b4f57', '#2a2c31', '#ff8a2b'], chest: ['#4b4f57', '#2a2c31', '#ff8a2b'], legs: ['#6b4528', '#4e321d'], feet: ['#4b4f57', '#2a2c31'] }, extra: 'flame', recipe: { items: { divine_bronze: 3, forge_token: 1, automaton_core: 4 }, cost: 3400 }, two: { guard: .3 }, four: { thorns: .5 }, desc: 'Smith’s plate, still warm from the forge.' },
  asphodel: { name: 'Asphodel',  ch: 11, def: 37, hp: 65, colors: { head: ['#4a4a52', '#2a2a30', null], chest: ['#4a4a52', '#2a2a30', '#c8b8ff'], legs: ['#3a3a40', '#1f1f24'], feet: ['#2a2a30', '#141418'] }, extra: 'hood', recipe: { items: { shade_essence: 6, grave_dust: 5, fury_wing: 2 }, cost: 2600 }, two: { lifesteal: .03 }, desc: 'Grey cloth from the fields of the dead.' },
  shade:    { name: 'Shade',     ch: 11, def: 39, hp: 65, god: 'hades', colors: { head: ['#1f1f24', '#0e0e12', '#7fe08a'], chest: ['#2a1f3a', '#140e1e', '#7fe08a'], legs: ['#1f1f24', '#0e0e12'], feet: ['#1f1f24', '#0e0e12'] }, extra: 'hood', recipe: { items: { soul_gem: 3, death_token: 1, styx_water: 4 }, cost: 3800 }, two: { dodgeDist: .2 }, four: { phase: 1 }, desc: 'Black robes that smell faintly of smoke.' },
  storm:    { name: 'Storm',     ch: 12, def: 40, hp: 70, colors: { head: ['#7a8aa8', '#4d5a72', '#ffd463'], chest: ['#7a8aa8', '#4d5a72', '#ffd463'], legs: ['#4d5a72', '#2e3648'], feet: ['#4d5a72', '#2e3648'] }, extra: 'wings', recipe: { items: { storm_hide: 6, eagle_feather: 4, storm_glass: 2 }, cost: 3000 }, two: { speed: .05 }, desc: 'Blue-grey hide that crackles when you move.' },
  olympian: { name: 'Olympian',  ch: 12, def: 43, hp: 80, god: 'zeus', colors: { head: ['#e9c04f', '#a8842a', '#f3e9d4'], chest: ['#f3e9d4', '#c2b293', '#e9c04f'], legs: ['#4f8fc7', '#2c5684'], feet: ['#e9c04f', '#a8842a'] }, extra: 'laurel', recipe: { items: { thunder_core: 3, olympian_token: 1, storm_glass: 4 }, cost: 5000 }, two: { dmg: .08 }, four: { lightning: 6 }, desc: 'Robes fit for the throne of Olympus.' },
};
// Plain-language text for each perk.
const PERK_TEXT = {
  healDrops: v => `+${Math.round(v * 100)}% chance monsters drop healing`, hp: v => `+${v} health`, def: v => `+${v} defense`,
  speed: v => `+${Math.round(v * 100)}% move speed`, dmg: v => `+${Math.round(v * 100)}% damage`, bowDmg: v => `+${Math.round(v * 100)}% bow damage`,
  dodgeCd: v => `Dash recharges ${Math.round(v * 100)}% faster`, dodgeDist: v => `+${Math.round(v * 100)}% dash distance`, regen: v => `Heal ${v} health per second`,
  abilityCd: v => `Weapon skill recharges ${Math.round(v * 100)}% faster`, guard: v => `+${Math.round(v * 100)}% guard meter`, projRes: v => `Arrows, stones and bolts deal ${Math.round(v * 100)}% less`,
  lifesteal: v => `Hits heal you for ${Math.round(v * 100)}% of the damage`, knock: v => `+${Math.round(v * 100)}% knockback`,
  dashDodge: () => 'Your dash becomes a long charge that cuts through enemies', dodgeStrike: v => `Your first hit after a dash deals +${Math.round(v * 100)}%`,
  killFrenzy: () => 'Every kill makes you attack faster for 3 seconds', reflectPerfect: () => 'Perfect blocks send projectiles back',
  burn: () => 'Your hits set enemies on fire', berserk: v => `Below 40% health, deal +${Math.round(v * 100)}% damage`,
  stunHit: v => `${Math.round(v * 100)}% of hits briefly stun`, thorns: v => `Melee attackers take ${Math.round(v * 100)}% of their damage back`,
  phase: () => 'Dashes stay untouchable 50% longer', lightning: v => `Every ${v}th hit calls down lightning`,
};

// Shields: only with one-handed weapons (sword, spear). Hold Guard to block from the front.
// block = share of damage stopped, meter = how much blocking it can take before your guard breaks, weight = extra dodge cooldown.
const SHIELDS = {
  buckler:         { name: 'Bronze Buckler',      ch: 1,  block: .55, meter: 6,  weight: .04, colors: ['#e9c04f', '#a8842a', '#c0412e'], recipe: { items: { bandit_cloth: 4, smooth_stone: 3, cattle_hide: 2 }, cost: 180 }, desc: 'Small and quick. A good first shield.' },
  hunters_targe:   { name: 'Hunter’s Targe', ch: 2,  block: .6,  meter: 7,  weight: .04, colors: ['#6b4528', '#4e321d', '#d5dbe5'], recipe: { items: { wolf_pelt: 5, stag_antler: 2 }, cost: 500 }, desc: 'Leather over wood, with an antler boss.' },
  hoplon:          { name: 'Hoplon',              ch: 4,  block: .7,  meter: 9,  weight: .1,  colors: ['#e9c04f', '#a8842a', '#c0412e'], recipe: { items: { bronze_plate: 6, hoplite_crest: 1 }, cost: 900 }, desc: 'The big round shield of the battle line.' },
  aegis_shield:    { name: 'Aegis',               ch: 4,  block: .8,  meter: 10, weight: .08, colors: ['#4f8fc7', '#2c5684', '#e9c04f'], perk: 'reflect', recipe: { items: { aegis_scale: 4, wisdom_token: 2 }, cost: 1600 }, desc: 'Athena’s shield. Perfect blocks send projectiles back.' },
  war_shield:      { name: 'Shield of Ares',      ch: 7,  block: .75, meter: 11, weight: .08, colors: ['#3a3a40', '#1f1f24', '#c0412e'], perk: 'bash', recipe: { items: { war_ember: 2, bloodied_bronze: 5 }, cost: 2200 }, desc: 'Perfect blocks knock attackers flying.' },
  tidal_shield:    { name: 'Tidal Shield',        ch: 8,  block: .8,  meter: 12, weight: .08, colors: ['#57c2b0', '#2c7a70', '#e9c04f'], perk: 'wave', recipe: { items: { trident_pearl: 2, sea_token: 1, crab_shell: 6 }, cost: 2600 }, desc: 'Perfect blocks push out a wave of water.' },
  forge_shield:    { name: 'Forge Shield',        ch: 10, block: .85, meter: 14, weight: .12, colors: ['#4b4f57', '#2a2c31', '#ff8a2b'], recipe: { items: { divine_bronze: 2, bronze_gear: 6, automaton_core: 2 }, cost: 3000 }, desc: 'Heavy, and almost unbreakable.' },
  olympian_shield: { name: 'Shield of Olympus',   ch: 12, block: .9,  meter: 14, weight: .06, colors: ['#f3e9d4', '#c2b293', '#ffd463'], perk: 'lightning', recipe: { items: { thunder_core: 2, olympian_token: 1, storm_hide: 4 }, cost: 4500 }, desc: 'Perfect blocks call lightning down on the attacker.' },
};

// Monsters. role = which AI runs it; cls = how tough it is (see CLASS). Stats scale with the quest's tier.
// Optional: hpM / dmgP override the class, scale = drawn bigger, revive = gets back up unless finished.
const ENEMIES = {
  bandit:      { name: 'Bandit',          role: 'fodder',     cls: 'fodder', sprite: 'bandit',     r: 5, speed: 36, colors: ['#8a5a34', '#5a3a22', '#d9822b'], loot: [['bandit_cloth', .7], ['stolen_ring', .12]] },
  slinger:     { name: 'Slinger',         role: 'shooter',    cls: 'fodder', sprite: 'slinger',    r: 5, speed: 42, hpM: 1.4, dmgP: .055, proj: { kind: 'stone', speed: 118 }, near: 75, far: 130, cd: [1.4, 2.3], colors: ['#7fa548', '#4e6e2b', '#e8b796'], loot: [['sling_cord', .6], ['smooth_stone', .5]] },
  bull:        { name: 'Sacred Bull',     role: 'charger',    cls: 'medium', sprite: 'bull',       r: 7, speed: 30, charge: 215, kbRes: .5, colors: ['#5a3a22', '#3a2416', '#f3e9d4'], loot: [['cattle_hide', .85, 1, 2], ['golden_horn', .15]] },
  wolf:        { name: 'Wolf',            role: 'leaper',     cls: 'fodder', sprite: 'wolf',       r: 5, speed: 54, hpM: 1.5, pounce: 240, colors: ['#8f8f8f', '#5f5f5f', '#f3e9d4'], loot: [['wolf_pelt', .65], ['wolf_fang', .2]] },
  huntress:    { name: 'Huntress',        role: 'shooter',    cls: 'medium', sprite: 'huntress',   r: 5, speed: 42, hpM: 2.6, dmgP: .09, proj: { kind: 'arrowE', speed: 170 }, near: 100, far: 170, cd: [1.4, 2.1], colors: ['#5e7d35', '#3e5a22', '#e8b796'], loot: [['silver_arrowhead', .6], ['wolf_pelt', .3]] },
  stag:        { name: 'Golden Stag',     role: 'charger',    cls: 'medium', sprite: 'stag',       r: 7, speed: 34, charge: 235, kbRes: .5, colors: ['#c9a46b', '#8a6a3a', '#f3e9d4'], loot: [['stag_antler', .8], ['wolf_pelt', .3]] },
  calydon:     { name: 'Calydonian Boar', role: 'charger',    cls: 'heavy',  sprite: 'boar',       r: 12, scale: 2, speed: 26, charge: 200, chain: 2, kbRes: .1, colors: ['#4a3428', '#2c1d17', '#fff6d8'], loot: [['calydon_tusk', 1], ['wolf_pelt', .8, 1, 2]] },
  satyr:       { name: 'Satyr',           role: 'fodder',     cls: 'fodder', sprite: 'satyr',      r: 5, speed: 40, colors: ['#7a5232', '#5a3a22', '#e8b796'], loot: [['satyr_fur', .65], ['grape_cluster', .4]] },
  panther:     { name: 'Panther',         role: 'leaper',     cls: 'medium', sprite: 'panther',    r: 6, speed: 58, hpM: 4, pounce: 270, chain: 2, colors: ['#3a3a40', '#1f1f24', '#e9c04f'], loot: [['panther_pelt', .7], ['grape_cluster', .3]] },
  maenad:      { name: 'Maenad',          role: 'thrower',    cls: 'medium', sprite: 'maenad',     r: 5, speed: 38, hpM: 3.5, dmgP: .1, puddle: 'wine', near: 90, far: 150, cd: [2, 2.8], colors: ['#7a4f9c', '#4e8a3a', '#e8b796'], loot: [['maenad_ivy', .6], ['grape_cluster', .4]] },
  centaur:     { name: 'Drunken Centaur', role: 'charger',    cls: 'heavy',  sprite: 'centaur',    r: 9, speed: 30, hpM: 16, charge: 230, chain: 2, kbRes: .15, colors: ['#8a6a4a', '#5a3a22', '#e8b796'], loot: [['centaur_hoof', 1], ['satyr_fur', .6, 1, 2]] },
  goat:        { name: 'Wild Goat',       role: 'charger',    cls: 'fodder', sprite: 'goat',       r: 5, speed: 34, hpM: 1.2, dmgP: .07, charge: 230, colors: ['#f3e9d4', '#c2b293', '#8a5a34'], loot: [['satyr_fur', .3]] },
  owl:         { name: 'War Owl',         role: 'flyer',      cls: 'fodder', sprite: 'owl',        r: 5, speed: 62, hpM: 2.2, dmgP: .08, swoop: 205, colors: ['#a7adb3', '#636a72', '#e9c04f'], loot: [['owl_quill', .7], ['silver_talon', .1]] },
  archer:      { name: 'Athenian Archer', role: 'shooter',    cls: 'medium', sprite: 'archer',     r: 5, speed: 40, hpM: 2.4, dmgP: .08, proj: { kind: 'arrowE', speed: 165 }, near: 100, far: 165, cd: [1.5, 2.2], colors: ['#4f8fc7', '#2c5684', '#e8b796'], loot: [['cedar_shaft', .65], ['bronze_plate', .15]] },
  hoplite:     { name: 'Hoplite',         role: 'tank',       cls: 'medium', sprite: 'hoplite',    r: 6, speed: 27, hpM: 7, dmgP: .14, shield: true, attack: 'thrust', turn: 2.4, kbRes: .35, colors: ['#e9c04f', '#a8842a', '#c0412e'], loot: [['bronze_plate', .8, 1, 2], ['hoplite_crest', .15]] },
  suitor:      { name: 'Jealous Suitor',  role: 'fodder',     cls: 'fodder', sprite: 'suitor',     r: 5, speed: 38, colors: ['#e88aa8', '#b85a78', '#e8b796'], loot: [['suitor_silk', .7]] },
  dove:        { name: 'Dove',            role: 'flyer',      cls: 'fodder', sprite: 'dove',       r: 4, speed: 75, hpM: 1.2, dmgP: .05, swoop: 220, colors: ['#ffffff', '#c9d0dc', '#e88aa8'], loot: [['dove_feather', .7]] },
  eros:        { name: 'Eros',            role: 'shooter',    cls: 'medium', sprite: 'eros',       r: 5, speed: 46, hpM: 2.5, dmgP: .07, proj: { kind: 'heart', speed: 140, charm: .8 }, near: 90, far: 150, cd: [1.6, 2.4], fly: true, colors: ['#f2a7c0', '#e9c04f', '#ffffff'], loot: [['eros_arrow', .6], ['rose_quartz', .08]] },
  aphro_clone: { name: 'Mirror Image',    role: 'exploder',   cls: 'fodder', sprite: 'aphrodite',  r: 6, speed: 52, hpM: 1.5, dmgP: .12, tint: 'pink', colors: ['#f2a7c0', '#ffffff', '#e9c04f'], loot: [] },
  plague:      { name: 'Plague Wretch',   role: 'exploder',   cls: 'fodder', sprite: 'plague',     r: 5, speed: 50, hpM: 1.3, dmgP: .09, puddle: 'poison', colors: ['#8a9a6a', '#5a6a4a', '#d8e6b0'], loot: [['plague_ash', .7]] },
  sun_archer:  { name: 'Sun Archer',      role: 'shooter',    cls: 'medium', sprite: 'sun_archer', r: 5, speed: 42, hpM: 2.6, dmgP: .08, proj: { kind: 'sunarrow', speed: 175, multi: 3, spread: .25 }, near: 110, far: 175, cd: [1.8, 2.5], colors: ['#ffd463', '#c9a032', '#e8b796'], loot: [['sun_arrowhead', .6], ['python_scale', .12]] },
  python:      { name: 'Python',          role: 'charger',    cls: 'heavy',  sprite: 'python',     r: 9, speed: 30, charge: 200, trail: 'poison', kbRes: .1, colors: ['#6f9a3e', '#3e5a22', '#e9c04f'], loot: [['python_fang', 1], ['python_scale', .9, 1, 3]] },
  spartoi:     { name: 'Spartoi',         role: 'fodder',     cls: 'fodder', sprite: 'spartoi',    r: 5, speed: 38, revive: true, colors: ['#f3e9d4', '#c2b293', '#a8842a'], loot: [['dragon_tooth', .7]] },
  war_boar:    { name: 'War Boar',        role: 'charger',    cls: 'medium', sprite: 'warboar',    r: 7, speed: 34, charge: 240, kbRes: .5, colors: ['#3a2a22', '#1f140c', '#f3e9d4'], loot: [['boar_bristle', .8], ['bloodied_bronze', .2]] },
  berserker:   { name: 'Berserker',       role: 'leaper',     cls: 'medium', sprite: 'berserker',  r: 5, speed: 52, hpM: 4.5, dmgP: .12, pounce: 260, chain: 3, colors: ['#c0412e', '#3a3a40', '#e8b796'], loot: [['bloodied_bronze', .6], ['dragon_tooth', .4]] },
  gigas:       { name: 'Gigas',           role: 'tank',       cls: 'heavy',  sprite: 'gigas',      r: 9, speed: 23, attack: 'slam', turn: 1.6, kbRes: .12, colors: ['#8a9a6a', '#5a6a4a', '#3a2a22'], loot: [['gigas_bone', 1], ['bloodied_bronze', .6, 1, 2]] },
  crab:        { name: 'Crab',            role: 'fodder',     cls: 'fodder', sprite: 'crab',       r: 5, speed: 34, hpM: 1.8, sideways: true, colors: ['#e07a3a', '#a04a1a', '#f3e9d4'], loot: [['crab_shell', .7], ['sea_glass', .3]] },
  triton:      { name: 'Triton',          role: 'shooter',    cls: 'medium', sprite: 'triton',     r: 5, speed: 40, hpM: 2.8, dmgP: .09, proj: { kind: 'water', speed: 150, knock: 220 }, near: 90, far: 160, cd: [1.6, 2.3], colors: ['#57c2b0', '#2c7a70', '#ffffff'], loot: [['triton_scale', .6], ['sea_glass', .4]] },
  hippocamp:   { name: 'Hippocamp',       role: 'charger',    cls: 'medium', sprite: 'hippocamp',  r: 7, speed: 34, charge: 250, kbRes: .5, colors: ['#57c2b0', '#2c7a70', '#7fd0c8'], loot: [['triton_scale', .6], ['sea_glass', .5]] },
  giant_crab:  { name: 'Giant Crab',      role: 'tank',       cls: 'heavy',  sprite: 'crab',       r: 12, scale: 2, speed: 22, attack: 'slam', turn: 1.8, kbRes: .1, colors: ['#e07a3a', '#a04a1a', '#f3e9d4'], loot: [['giant_claw', 1], ['crab_shell', .8, 2, 3]] },
  peacock:     { name: 'Peacock',         role: 'fodder',     cls: 'fodder', sprite: 'peacock',    r: 5, speed: 44, colors: ['#3f9a8a', '#2c5684', '#e9c04f'], loot: [['peacock_plume', .7], ['pomegranate', .3]] },
  priestess:   { name: 'Priestess of Hera', role: 'summoner', cls: 'medium', sprite: 'priestess',  r: 5, speed: 38, hpM: 3.5, summon: 'peacock', colors: ['#f3e9d4', '#5b9bd5', '#e9c04f'], loot: [['royal_gold', .7], ['pomegranate', .4]] },
  argus:       { name: 'Argus',           role: 'tank',       cls: 'heavy',  sprite: 'argus',      r: 9, speed: 22, hpM: 20, attack: 'volley', turn: 1.4, kbRes: .12, colors: ['#e8b796', '#5b9bd5', '#f3e9d4'], loot: [['argus_eye', 1], ['royal_gold', .6, 1, 2]] },
  spark:       { name: 'Living Spark',    role: 'fodder',     cls: 'fodder', sprite: 'spark',      r: 4, speed: 74, hpM: .8, dmgP: .05, windup: .22, colors: ['#ffd463', '#ffffff', '#57c2b0'], loot: [['spark_dust', .25]] },
  bronze_hound:{ name: 'Bronze Hound',    role: 'leaper',     cls: 'fodder', sprite: 'hound',      r: 5, speed: 55, hpM: 1.7, pounce: 250, colors: ['#c9a032', '#8f6c1c', '#ff8a2b'], loot: [['bronze_gear', .7]] },
  automaton:   { name: 'Automaton',       role: 'tank',       cls: 'medium', sprite: 'automaton',  r: 6, speed: 26, hpM: 7.5, dmgP: .14, shield: true, attack: 'thrust', turn: 2.2, kbRes: .3, colors: ['#c9a032', '#8f6c1c', '#ff8a2b'], loot: [['automaton_core', .5], ['bronze_gear', .6, 1, 2]] },
  cyclops:     { name: 'Cyclops',         role: 'tank',       cls: 'heavy',  sprite: 'cyclops',    r: 9, speed: 23, attack: 'slam', turn: 1.6, kbRes: .12, colors: ['#e8b796', '#b97f5f', '#8a5a34'], loot: [['cyclops_hide', .9, 1, 2], ['cyclops_eye', .3]] },
  talos:       { name: 'Talos',           role: 'tank',       cls: 'heavy',  sprite: 'talos',      r: 13, scale: 2, speed: 20, hpM: 26, attack: 'slam', turn: 1.3, kbRes: .05, colors: ['#c9a032', '#8f6c1c', '#ff8a2b'], loot: [['automaton_core', 1, 2, 3], ['divine_bronze', .25]] },
  shade:       { name: 'Shade',           role: 'teleporter', cls: 'fodder', sprite: 'shade',      r: 5, speed: 30, hpM: 1.5, dmgP: .07, colors: ['#6b5a8a', '#3a2f4a', '#c8b8ff'], loot: [['shade_essence', .7]] },
  skeleton:    { name: 'Restless Dead',   role: 'fodder',     cls: 'fodder', sprite: 'skeleton',   r: 5, speed: 38, revive: true, colors: ['#f3e9d4', '#c2b293', '#7fe08a'], loot: [['grave_dust', .7]] },
  fury:        { name: 'Fury',            role: 'flyer',      cls: 'medium', sprite: 'fury',       r: 5, speed: 70, hpM: 3.5, dmgP: .12, swoop: 240, colors: ['#7f2618', '#140d0b', '#c0412e'], loot: [['fury_wing', .6], ['styx_water', .3]] },
  cerberus:    { name: 'Cerberus',        role: 'leaper',     cls: 'heavy',  sprite: 'cerberus',   r: 11, scale: 2, speed: 44, pounce: 250, chain: 3, dmgP: .2, kbRes: .1, colors: ['#2a2a30', '#140d0b', '#c0412e'], loot: [['cerberus_fang', 1], ['styx_water', .6, 1, 2]] },
  harpy:       { name: 'Storm Harpy',     role: 'flyer',      cls: 'medium', sprite: 'harpy',      r: 5, speed: 80, hpM: 3, dmgP: .1, swoop: 235, colors: ['#9a6bc0', '#5a3b78', '#e8b796'], loot: [['harpy_talon', .7], ['storm_glass', .15]] },
  eagle:       { name: 'Eagle of Zeus',   role: 'flyer',      cls: 'fodder', sprite: 'eagle',      r: 5, speed: 85, hpM: 1.5, dmgP: .06, swoop: 250, colors: ['#8a5a34', '#f3e9d4', '#e9c04f'], loot: [['eagle_feather', .7]] },
  acolyte:     { name: 'Storm Acolyte',   role: 'summoner',   cls: 'medium', sprite: 'acolyte',    r: 5, speed: 38, hpM: 3, summon: 'spark', colors: ['#2c5684', '#57c2b0', '#9a6bc0'], loot: [['storm_glass', .8], ['spark_dust', .5]] },
  storm_cyclops:{ name: 'Storm Cyclops',  role: 'tank',       cls: 'heavy',  sprite: 'storm_cyclops', r: 9, speed: 24, attack: 'slam', turn: 1.7, kbRes: .12, colors: ['#7a8aa8', '#4d5a72', '#ffd463'], loot: [['storm_hide', .9, 1, 2], ['storm_eye', .3]] },
};

// Gods. The three originals have hand-written fights; the rest use the shared boss engine with these attack lists.
// Attack damage is a share of an on-curve player's health (0.15 = 15%).
const BOSSES = {
  hermes:     { name: 'Hermes', dmgScale: 1.08, title: 'Messenger of the Gods', tier: 1, hp: 700, r: 7, sprite: 'hermes', custom: true, arrivalHeals: 2, colors: ['#f3e9d4', '#ebc152', '#5b9bd5'], loot: [['winged_feather', 1, 2, 3], ['herald_token', 1]] },
  artemis:    { name: 'Artemis', dmgScale: 0.85, title: 'Lady of the Hunt', tier: 2, r: 6, sprite: 'artemis', keep: 125, speed: 64, contact: .07, arrivalHeals: 3,
                attacks: [{ id: 'fan', w: 3, p1: { n: 5, spread: .7, speed: 170, dmg: .09, kind: 'arrowE' }, p2: { n: 7, volleys: 2 } },
                          { id: 'rain', w: 2, p1: { n: 5, r: 12, delay: .95, dmg: .14, kind: 'arrow' }, p2: { n: 8 } },
                          { id: 'leap', w: 2, p1: { dmg: .16, r: 22 } }],
                summons: [{ at: .66, types: ['wolf', 'wolf', 'wolf'] }, { at: .33, types: ['stag', 'wolf', 'wolf'] }],
                phase2: { title: 'Artemis draws the silver bow', sub: 'Wider volleys and more arrow rain' },
                colors: ['#d5dbe5', '#5e7d35', '#f3e9d4'], loot: [['moon_silver', 1, 2, 3], ['hunt_token', 1]] },
  dionysus:   { name: 'Dionysus', dmgScale: 1.4, title: 'God of Wine and Madness', tier: 3, r: 7, sprite: 'dionysus', keep: 85, speed: 52, contact: .08, arrivalHeals: 3,
                attacks: [{ id: 'confuse', w: 2, p1: { dmg: .06, time: 2.5 }, p2: { time: 3.5 } },
                          { id: 'puddles', w: 2, p1: { n: 4, r: 16, life: 6, dmg: .025, kind: 'wine' }, p2: { n: 6 } },
                          { id: 'leap', w: 2, p1: { dmg: .15, r: 22 } },
                          { id: 'fan', w: 2, p1: { n: 6, spread: 1.2, speed: 105, dmg: .08, kind: 'grape' }, p2: { volleys: 2 } }],
                summons: [{ at: .66, types: ['satyr', 'satyr', 'satyr'] }, { at: .33, types: ['panther', 'satyr', 'satyr'] }],
                phase2: { title: 'Dionysus loses himself', sub: 'Longer madness, more spilled wine' },
                colors: ['#9a6bc0', '#7fa548', '#f3e9d4'], loot: [['wine_of_ages', 1, 2, 3], ['revel_token', 1]] },
  athena:     { name: 'Athena', dmgScale: 0.79, title: 'Goddess of Wisdom and War', tier: 4, r: 7, sprite: 'athena', custom: true, arrivalHeals: 2, colors: ['#f3e9d4', '#a7adb3', '#4f8fc7'], loot: [['aegis_scale', 1, 2, 3], ['wisdom_token', 1]] },
  aphrodite:  { name: 'Aphrodite', title: 'Goddess of Love', tier: 5, r: 6, sprite: 'aphrodite', keep: 105, speed: 60, contact: .07, arrivalHeals: 2,
                attacks: [{ id: 'charm', w: 2, p1: { range: 180, time: 1.1, dmg: .05 } },
                          { id: 'fan', w: 3, p1: { n: 7, spread: 1, speed: 115, dmg: .09, kind: 'heart' }, p2: { volleys: 2 } },
                          { id: 'blink', w: 1, p1: {} },
                          { id: 'wave', w: 2, p1: { dmg: .14, speed: 160, max: 130, col: '#f2a7c0' }, p2: { count: 2 } }],
                summons: [{ at: .66, types: ['aphro_clone', 'aphro_clone', 'aphro_clone'] }, { at: .33, types: ['aphro_clone', 'aphro_clone', 'aphro_clone', 'eros'] }],
                phase2: { title: 'Aphrodite stops being nice', sub: 'Her mirror images explode' },
                colors: ['#f2a7c0', '#e9c04f', '#ffffff'], loot: [['foam_pearl', 1, 2, 3], ['love_token', 1]] },
  apollo:     { name: 'Apollo', dmgScale: 0.89, title: 'The Far-Shooter', tier: 6, r: 7, sprite: 'apollo', keep: 130, speed: 56, contact: .08, arrivalHeals: 2,
                attacks: [{ id: 'beam', w: 2, p1: { dmg: .14, len: 260, sweep: 1.2, time: 1.3 }, p2: { sweep: 1.8 } },
                          { id: 'fan', w: 2, p1: { n: 5, spread: .5, speed: 200, dmg: .1, kind: 'sunarrow' }, p2: { volleys: 3 } },
                          { id: 'puddles', w: 1, p1: { n: 4, r: 15, life: 6, dmg: .035, kind: 'poison' }, p2: { n: 6 } },
                          { id: 'rain', w: 2, p1: { n: 6, r: 14, delay: .9, dmg: .15, kind: 'sunfire' }, p2: { n: 9 } }],
                summons: [{ at: .66, types: ['plague', 'plague', 'sun_archer'] }, { at: .33, types: ['python'] }],
                phase2: { title: 'Apollo burns at noon', sub: 'Wider sun beams and triple volleys' },
                colors: ['#ffd463', '#f3e9d4', '#6f9a3e'], loot: [['sun_disk', 1, 2, 3], ['light_token', 1]] },
  ares:       { name: 'Ares', dmgScale: 0.7, title: 'God of War', tier: 7, r: 7, sprite: 'ares', keep: 45, speed: 70, contact: .1, rage: true, arrivalHeals: 2,
                attacks: [{ id: 'dash', w: 3, p1: { count: 2, speed: 330, dmg: .17 }, p2: { count: 3 } },
                          { id: 'quake', w: 2, p1: { dmg: .16 } },
                          { id: 'leap', w: 2, p1: { dmg: .18, r: 26 } },
                          { id: 'wave', w: 1, p1: { dmg: .14, speed: 170, max: 120, col: '#c0412e' } }],
                summons: [{ at: .66, types: ['spartoi', 'spartoi', 'spartoi', 'spartoi'] }, { at: .33, types: ['berserker', 'berserker'] }],
                phase2: { title: 'Ares sees red', sub: 'He gets faster the more you hurt him' },
                colors: ['#c0412e', '#3a3a40', '#e9c04f'], loot: [['war_ember', 1, 2, 3], ['war_token', 1]] },
  poseidon:   { name: 'Poseidon', dmgScale: 1.1, title: 'The Earth-Shaker', tier: 8, r: 8, sprite: 'poseidon', keep: 110, speed: 52, contact: .09, arrivalHeals: 2,
                attacks: [{ id: 'wave', w: 2, p1: { dmg: .15, speed: 150, max: 160, col: '#57c2b0' }, p2: { count: 2 } },
                          { id: 'puddles', w: 2, p1: { n: 5, r: 18, life: 7, dmg: .02, kind: 'water' }, p2: { n: 7 } },
                          { id: 'fan', w: 2, p1: { n: 6, spread: 1, speed: 145, dmg: .1, kind: 'water' }, p2: { volleys: 2 } },
                          { id: 'rain', w: 2, p1: { n: 6, r: 15, delay: .9, dmg: .16, kind: 'geyser' }, p2: { n: 9 } }],
                summons: [{ at: .66, types: ['crab', 'crab', 'crab', 'crab'] }, { at: .33, types: ['hippocamp', 'hippocamp', 'giant_crab'] }],
                phase2: { title: 'The sea rises', sub: 'Double waves and floods' },
                colors: ['#57c2b0', '#2c7a70', '#ffffff'], loot: [['trident_pearl', 1, 2, 3], ['sea_token', 1]] },
  hera:       { name: 'Hera', dmgScale: 1.2, title: 'Queen of the Gods', tier: 9, r: 7, sprite: 'hera', keep: 120, speed: 50, contact: .09, arrivalHeals: 2,
                attacks: [{ id: 'beam', w: 2, p1: { dmg: .15, len: 240, sweep: 1.4, time: 1.4, col: '#3f9a8a' }, p2: { sweep: 2 } },
                          { id: 'fan', w: 2, p1: { n: 8, spread: 1.2, speed: 125, dmg: .1, kind: 'plume' }, p2: { volleys: 2 } },
                          { id: 'rain', w: 2, p1: { n: 7, r: 14, delay: .9, dmg: .16, kind: 'curse' }, p2: { n: 10 } },
                          { id: 'blink', w: 1, p1: {} }],
                summons: [{ at: .66, types: ['peacock', 'peacock', 'peacock', 'priestess'] }, { at: .33, types: ['argus'] }],
                phase2: { title: 'Hera’s jealousy boils over', sub: 'Wider eye beams and heavier curses' },
                colors: ['#5b9bd5', '#3f9a8a', '#e9c04f'], loot: [['regal_plume', 1, 2, 3], ['queen_token', 1]] },
  hephaestus: { name: 'Hephaestus', dmgScale: 0.54, title: 'Smith of the Gods', tier: 10, r: 8, sprite: 'hephaestus', keep: 70, speed: 40, contact: .1, arrivalHeals: 2,
                attacks: [{ id: 'quake', w: 2, p1: { dmg: .18 } },
                          { id: 'puddles', w: 2, p1: { n: 5, r: 16, life: 7, dmg: .045, kind: 'lava' }, p2: { n: 7 } },
                          { id: 'wave', w: 2, p1: { dmg: .16, speed: 140, max: 140, col: '#ff8a2b' }, p2: { count: 2 } },
                          { id: 'leap', w: 2, p1: { dmg: .2, r: 28 } }],
                summons: [{ at: .66, types: ['bronze_hound', 'bronze_hound', 'bronze_hound', 'automaton'] }, { at: .33, types: ['talos'] }],
                phase2: { title: 'The forge roars', sub: 'Lava everywhere and double shockwaves' },
                colors: ['#ff8a2b', '#4b4f57', '#e9c04f'], loot: [['divine_bronze', 1, 2, 3], ['forge_token', 1]] },
  hades:      { name: 'Hades', dmgScale: 0.9, title: 'Lord of the Dead', tier: 11, r: 7, sprite: 'hades', keep: 100, speed: 58, contact: .1, arrivalHeals: 2,
                attacks: [{ id: 'vanish', w: 2, p1: { time: 2.2, dmg: .18 } },
                          { id: 'ring', w: 2, p1: { n: 14, speed: 85, dmg: .1, kind: 'soul' }, p2: { rings: 2 } },
                          { id: 'puddles', w: 1, p1: { n: 4, r: 16, life: 6, dmg: .05, kind: 'void' }, p2: { n: 6 } },
                          { id: 'rain', w: 2, p1: { n: 8, r: 14, delay: .9, dmg: .16, kind: 'soulfire' }, p2: { n: 11 } }],
                summons: [{ at: .66, types: ['shade', 'shade', 'shade', 'fury'] }, { at: .33, types: ['cerberus'] }],
                phase2: { title: 'Hades opens the underworld', sub: 'Double soul rings and longer shadows' },
                colors: ['#2a1f3a', '#7fe08a', '#c8b8ff'], loot: [['soul_gem', 1, 2, 3], ['death_token', 1]] },
  zeus:       { name: 'Zeus', dmgScale: 1.8, title: 'King of Olympus', tier: 12, r: 8, sprite: 'zeus', custom: true, arrivalHeals: 3, colors: ['#f3e9d4', '#e9c04f', '#57c2b0'], loot: [['thunder_core', 1, 2, 3], ['olympian_token', 1]] },
  // side-hunt gods
  pan:        { name: 'Pan', dmgScale: 1.05, title: 'God of the Wild', tier: 3.5, side: true, r: 6, sprite: 'pan', keep: 90, speed: 62, contact: .08, arrivalHeals: 2,
                attacks: [{ id: 'stampede', w: 2, p1: { n: 5 } }, { id: 'leap', w: 2, p1: { dmg: .15, r: 22 } },
                          { id: 'ring', w: 2, p1: { n: 10, speed: 100, dmg: .08, kind: 'note' }, p2: { rings: 2 } }],
                summons: [{ at: .5, types: ['satyr', 'satyr', 'satyr', 'satyr'] }], phase2: { title: 'Pan panics everyone', sub: 'Bigger stampedes' },
                colors: ['#8a5a34', '#7fa548', '#e8b796'], loot: [['wild_horn', 1, 1, 2], ['satyr_fur', 1, 2, 4]] },
  hecate:     { name: 'Hecate', dmgScale: 1.7, title: 'Goddess of the Crossroads', tier: 6.5, side: true, r: 6, sprite: 'hecate', keep: 120, speed: 50, contact: .08, arrivalHeals: 2,
                attacks: [{ id: 'blink', w: 2, p1: {} }, { id: 'ring', w: 2, p1: { n: 12, speed: 90, dmg: .1, kind: 'witchfire' }, p2: { rings: 2 } },
                          { id: 'puddles', w: 2, p1: { n: 4, r: 16, life: 6, dmg: .04, kind: 'witch' }, p2: { n: 6 } }, { id: 'rain', w: 1, p1: { n: 6, r: 14, delay: .9, dmg: .15, kind: 'witchfire' } }],
                summons: [{ at: .66, types: ['shade', 'shade', 'shade'] }, { at: .33, types: ['shade', 'shade', 'plague', 'plague'] }],
                phase2: { title: 'Hecate lights all three torches', sub: 'Double fire rings' },
                colors: ['#2c5684', '#57c2b0', '#c8b8ff'], loot: [['witch_torch', 1, 1, 2], ['plague_ash', 1, 2, 4]] },
  nemesis:    { name: 'Nemesis', dmgScale: 0.68, title: 'Goddess of Retribution', tier: 7.5, side: true, r: 6, sprite: 'nemesis', keep: 70, speed: 62, contact: .09, arrivalHeals: 2,
                attacks: [{ id: 'reflect', w: 2, p1: { time: 1.8 } }, { id: 'dash', w: 3, p1: { count: 2, speed: 360, dmg: .17 }, p2: { count: 3 } },
                          { id: 'wave', w: 2, p1: { dmg: .15, speed: 160, max: 130, col: '#c9bda4' } }, { id: 'fan', w: 1, p1: { n: 5, spread: .8, speed: 160, dmg: .1, kind: 'blade' } }],
                summons: [{ at: .5, types: ['spartoi', 'spartoi', 'berserker'] }], phase2: { title: 'Nemesis keeps score', sub: 'Strike her while she glows and you pay for it' },
                colors: ['#c9bda4', '#5a5245', '#e9c04f'], loot: [['nemesis_scale', 1, 1, 2], ['bloodied_bronze', 1, 2, 3]] },
  eris:       { name: 'Eris', dmgScale: 1.4, title: 'Goddess of Discord', tier: 9.5, side: true, r: 6, sprite: 'eris', keep: 110, speed: 60, contact: .09, arrivalHeals: 2,
                attacks: [{ id: 'rain', w: 3, p1: { n: 6, r: 15, delay: 1, dmg: .14, kind: 'apple' }, p2: { n: 9 } }, { id: 'fan', w: 2, p1: { n: 7, spread: 1.2, speed: 130, dmg: .1, kind: 'blade' } },
                          { id: 'blink', w: 1, p1: {} }],
                summons: [{ at: .75, types: ['bandit', 'satyr', 'spartoi', 'crab'] }, { at: .5, types: ['war_boar', 'hoplite'] }, { at: .25, types: ['peacock', 'peacock', 'berserker', 'triton'] }],
                phase2: { title: 'Eris laughs', sub: 'Golden apples drive the monsters wild' },
                colors: ['#c0412e', '#1f1f24', '#e9c04f'], loot: [['golden_apple', 1, 1, 2], ['peacock_plume', 1, 2, 4]] },
  hypnos:     { name: 'Hypnos', dmgScale: 2.3, title: 'God of Sleep', tier: 11.5, side: true, r: 6, sprite: 'hypnos', keep: 120, speed: 50, contact: .08, arrivalHeals: 2,
                attacks: [{ id: 'puddles', w: 3, p1: { n: 5, r: 20, life: 8, dmg: .02, kind: 'sleep' }, p2: { n: 7 } }, { id: 'ring', w: 2, p1: { n: 6, speed: 60, dmg: .1, kind: 'dream', homing: 1.2 }, p2: { rings: 2 } },
                          { id: 'blink', w: 1, p1: {} }],
                summons: [{ at: .66, types: ['shade', 'shade', 'shade', 'shade'] }, { at: .33, types: ['fury', 'fury'] }],
                phase2: { title: 'Hypnos yawns', sub: 'More fog. Don’t stand still.' },
                colors: ['#2c3a6a', '#c8b8ff', '#f3e9d4'], loot: [['poppy_dream', 1, 1, 2], ['shade_essence', 1, 2, 4]] },
};
// Potions from the market. share = price as a share of one hunt's pay at the highest god you've unlocked, so they always cost something.
const POTIONS = {
  health:   { name: 'Health Potion',   key: 'potion1', share: .3,  col: ['#d9493b', '#7f2618', '#ffd0c0'], short: 'Health',   desc: 'Heals 40% of your health right away.' },
  strength: { name: 'Strength Potion', key: 'potion2', share: .4,  col: ['#e9a030', '#8f5a1c', '#fff0b0'], short: 'Strength', desc: '+25% damage for 60 seconds.' },
  speed:    { name: 'Speed Potion',    key: 'potion3', share: .35, col: ['#57c2b0', '#2c7a70', '#e6fffa'], short: 'Speed',    desc: 'Double dash for 60 seconds: dash twice in a row, but each dash recharges a bit slower. Already wearing double-dash boots? Then your dashes recharge at full speed instead.' },
};
const POTION_MAX = 3;
// Plurals that don't just add an s.
const PLURALS = { wolf: 'Wolves', spartoi: 'Spartoi', skeleton: 'Restless Dead', fury: 'Furies', gigas: 'Gigantes', cyclops: 'Cyclopes', storm_cyclops: 'Storm Cyclopes',
                  eros: 'Erotes', priestess: 'Priestesses of Hera', aphro_clone: 'Mirror Images', calydon: 'Calydonian Boars', centaur: 'Drunken Centaurs' };
const monsterCount = (t, n) => `${n} ${n > 1 ? (PLURALS[t] || ENEMIES[t].name + 's') : ENEMIES[t].name}`;

const GODS = [
  { id: 'hermes', name: 'Hermes', quest: 'hermes_hunt', tier: 1 }, { id: 'artemis', name: 'Artemis', quest: 'artemis_hunt', tier: 2 },
  { id: 'dionysus', name: 'Dionysus', quest: 'dionysus_hunt', tier: 3 }, { id: 'athena', name: 'Athena', quest: 'athena_hunt', tier: 4 },
  { id: 'aphrodite', name: 'Aphrodite', quest: 'aphrodite_hunt', tier: 5 }, { id: 'apollo', name: 'Apollo', quest: 'apollo_hunt', tier: 6 },
  { id: 'ares', name: 'Ares', quest: 'ares_hunt', tier: 7 }, { id: 'poseidon', name: 'Poseidon', quest: 'poseidon_hunt', tier: 8 },
  { id: 'hera', name: 'Hera', quest: 'hera_hunt', tier: 9 }, { id: 'hephaestus', name: 'Hephaestus', quest: 'hephaestus_hunt', tier: 10 },
  { id: 'hades', name: 'Hades', quest: 'hades_hunt', tier: 11 }, { id: 'zeus', name: 'Zeus', quest: 'zeus_hunt', tier: 12 },
];
const SIDE_GODS = [{ id: 'pan', name: 'Pan', quest: 'pan_hunt' }, { id: 'hecate', name: 'Hecate', quest: 'hecate_hunt' }, { id: 'nemesis', name: 'Nemesis', quest: 'nemesis_hunt' }, { id: 'eris', name: 'Eris', quest: 'eris_hunt' }, { id: 'hypnos', name: 'Hypnos', quest: 'hypnos_hunt' }];


// Arenas. Hand-made ones list their obstacles: [kind, tileX, tileY, variant]. The walkable area is tiles 3-36 across, 3-22 down.
// secret: a hidden nook inside the wall (x, y, w, h in tiles) with a chest. You walk through the wall to reach it.
// Generated arenas give a kit of obstacle kinds plus a layout and nook number; the same arena always comes out the same.
const ARENAS = {
  road:      { name: 'Delphi Road', theme: 'road',
               obstacles: [['rock', 8, 7], ['rock', 30, 6], ['rock', 11, 18], ['rock', 28, 19], ['boulder', 32, 16], ['cart', 15, 17], ['rock', 23, 7], ['tree', 6, 10], ['tree', 34, 9]],
               secret: { x: 37, y: 12, w: 2, h: 3, chest: [38, 13], hint: 'On the Delphi road, the east hedge is thin where the dirt road runs into it. Walk straight in.' } },
  pasture:   { name: 'Hills of Pieria', theme: 'pasture',
               obstacles: [['tree', 8, 7], ['tree', 31, 7], ['tree', 10, 18], ['tree', 29, 17], ['tree', 17, 6], ['tree', 24, 20], ['fence', 14, 11], ['fence', 26, 15], ['rock', 33, 13]],
               secret: { x: 9, y: 1, w: 3, h: 2, chest: [10, 1], hint: 'In the Pieria hills, the north hedge has a gap above the first tree on the left.' } },
  pass:      { name: 'High Pass', theme: 'pass',
               obstacles: [['boulder', 10, 9], ['boulder', 29, 8], ['boulder', 13, 17], ['boulder', 26, 18], ['rock', 7, 15], ['rock', 33, 14], ['rock', 18, 7], ['rock', 22, 19]],
               secret: { x: 1, y: 16, w: 2, h: 3, chest: [1, 17], hint: 'At the high pass, the west cliff has a hollow low on the left side. Look for the crack.' } },
  temple:    { name: 'Shrine of Hermes', theme: 'temple',
               obstacles: [['column', 9, 8], ['column', 15, 8], ['column', 25, 8], ['column', 31, 8], ['column', 9, 18], ['column', 15, 18], ['column', 25, 18], ['column', 31, 18], ['brazier', 12, 13], ['brazier', 28, 13], ['brokencol', 20, 6]],
               secret: { x: 29, y: 23, w: 3, h: 2, chest: [30, 24], hint: 'In Hermes’ shrine, part of the south wall near the right-hand corner is hollow.' } },
  grove:     { name: 'Sacred Olive Grove', theme: 'grove',
               obstacles: [['olive', 8, 7], ['olive', 14, 6], ['olive', 26, 6], ['olive', 32, 8], ['olive', 9, 18], ['olive', 16, 20], ['olive', 25, 19], ['olive', 31, 17], ['statue', 20, 6, 'owl'], ['rock', 23, 16]],
               secret: { x: 37, y: 17, w: 2, h: 3, chest: [38, 18], hint: 'In the olive grove, the old stone wall on the east side has fallen in near the bottom.' } },
  ruins:     { name: 'Ruined Agora', theme: 'ruins',
               obstacles: [['slab', 9, 8], ['slab', 29, 7], ['brokencol', 13, 12], ['brokencol', 27, 15], ['column', 8, 18], ['column', 32, 18], ['slab', 19, 18], ['statue', 20, 6, 'owl'], ['brokencol', 23, 10]],
               secret: { x: 26, y: 1, w: 3, h: 2, chest: [27, 1], hint: 'In the ruined agora, the north wall to the right of the owl statue is crumbling.' } },
  parthenon: { name: 'The Parthenon', theme: 'parthenon',
               obstacles: [['column', 8, 7], ['column', 14, 7], ['column', 26, 7], ['column', 32, 7], ['column', 8, 19], ['column', 14, 19], ['column', 26, 19], ['column', 32, 19], ['statue', 11, 13, 'owl'], ['statue', 29, 13, 'owl']],
               secret: { x: 1, y: 6, w: 2, h: 3, chest: [1, 7], hint: 'In the Parthenon, the west wall beside the top-left column is false.' } },
  storm:     { name: 'Storm Peak', theme: 'storm',
               obstacles: [['pylon', 10, 8], ['pylon', 30, 8], ['pylon', 10, 18], ['pylon', 30, 18], ['boulder', 20, 7], ['rock', 16, 16], ['rock', 25, 16], ['rock', 6, 12]],
               secret: { x: 8, y: 23, w: 3, h: 2, chest: [9, 24], hint: 'On Storm Peak, the south cliff hides a hollow on the left side.' } },
  forge:     { name: 'Cyclops Forge', theme: 'forge',
               obstacles: [['boulder', 8, 8], ['boulder', 31, 9], ['brazier', 14, 12], ['brazier', 26, 12], ['anvil', 20, 7], ['rock', 20, 19], ['boulder', 11, 18], ['boulder', 29, 18]],
               secret: { x: 37, y: 5, w: 2, h: 3, chest: [38, 6], hint: 'In the cyclops forge, the east wall near the top is only soot and smoke.' } },
  summit:    { name: 'Summit of Olympus', theme: 'summit',
               obstacles: [['column', 10, 8, 'gold'], ['column', 30, 8, 'gold'], ['column', 10, 18, 'gold'], ['column', 30, 18, 'gold'], ['brazier', 15, 13], ['brazier', 25, 13], ['statue', 20, 5, 'zeus']],
               secret: { x: 18, y: 1, w: 3, h: 2, chest: [19, 1], hint: 'On the summit, the cloud bank right behind the throne statue is softer than the rest.' } },
  // generated arenas
  woods:        { name: 'Wolfwood',              theme: 'forest',       kit: ['pine', 'pine', 'rock', 'stump', 'pine'], layout: 1, nook: 3 },
  glade:        { name: 'Golden Glade',          theme: 'glade',        kit: ['tree', 'pine', 'stump', 'rock'], layout: 4, nook: 6 },
  moontemple:   { name: 'Temple of the Moon',    theme: 'moon',         kit: ['column', 'crystal', 'column', 'brazier'], layout: 3, nook: 0 },
  vineyard:     { name: 'Vineyards of Naxos',    theme: 'vineyard',     kit: ['vine', 'vine', 'amphora', 'olive'], layout: 1, nook: 7 },
  thicket:      { name: 'Panther Thicket',       theme: 'thicket',      kit: ['tree', 'vine', 'rock', 'stump'], layout: 5, nook: 4 },
  theater:      { name: 'Theater of Dionysus',   theme: 'theater',      kit: ['column', 'amphora', 'brokencol', 'brazier'], layout: 3, nook: 8 },
  meadow:       { name: 'Arcadian Meadow',       theme: 'pasture',      kit: ['tree', 'rock', 'stump', 'tree'], layout: 0, nook: 2 },
  rosegarden:   { name: 'Rose Garden',           theme: 'rose',         kit: ['rosebush', 'rosebush', 'statue', 'olive'], layout: 4, nook: 1, statue: 'aphrodite' },
  dovecote:     { name: 'Dovecote Terrace',      theme: 'rose',         kit: ['rosebush', 'column', 'amphora', 'rosebush'], layout: 2, nook: 5 },
  cythera:      { name: 'Shore of Cythera',      theme: 'cythera',      kit: ['shell', 'column', 'coral', 'shell'], layout: 3, nook: 9 },
  plagueroad:   { name: 'Plague Road',           theme: 'dryland',      kit: ['rock', 'cart', 'stump', 'rock'], layout: 0, nook: 0 },
  pythoncave:   { name: 'Lair of the Python',    theme: 'cave',         kit: ['boulder', 'crystal', 'rock', 'boulder'], layout: 2, nook: 7 },
  delphi:       { name: 'Temple at Delphi',      theme: 'delphi',       kit: ['column', 'brazier', 'column', 'statue'], layout: 3, nook: 1, statue: 'apollo' },
  crossroads:   { name: 'The Crossroads',        theme: 'crossroads',   kit: ['grave', 'brazier', 'rock', 'stump'], layout: 5, nook: 2 },
  battlefield:  { name: 'Field of the Sown',     theme: 'battlefield',  kit: ['rack', 'rock', 'grave', 'boulder'], layout: 0, nook: 4 },
  phlegra:      { name: 'Plain of Phlegra',      theme: 'battlefield',  kit: ['boulder', 'rack', 'rock', 'boulder'], layout: 2, nook: 8 },
  warpit:       { name: 'Pit of Ares',           theme: 'warpit',       kit: ['rack', 'brazier', 'rack', 'slab'], layout: 3, nook: 6 },
  rhamnous:     { name: 'Shrine at Rhamnous',    theme: 'ruins',        kit: ['brokencol', 'slab', 'column', 'brazier'], layout: 5, nook: 9 },
  beach:        { name: 'Bay of Crabs',          theme: 'beach',        kit: ['shell', 'rock', 'coral', 'boulder'], layout: 1, nook: 2 },
  reef:         { name: 'Triton Reef',           theme: 'reef',         kit: ['coral', 'coral', 'shell', 'rock'], layout: 4, nook: 5 },
  seatemple:    { name: 'Temple of the Deep',    theme: 'seatemple',    kit: ['column', 'coral', 'column', 'shell'], layout: 3, nook: 3 },
  peacockgarden:{ name: 'Peacock Court',         theme: 'palacegarden', kit: ['olive', 'rosebush', 'column', 'amphora'], layout: 1, nook: 6 },
  argusgarden:  { name: 'Garden of Argus',       theme: 'palacegarden', kit: ['tree', 'statue', 'rosebush', 'tree'], layout: 4, nook: 0, statue: 'hera' },
  palace:       { name: 'Palace of Hera',        theme: 'palace',       kit: ['column', 'brazier', 'column', 'amphora'], layout: 3, nook: 7 },
  applegarden:  { name: 'Garden of the Hesperides', theme: 'palacegarden', kit: ['olive', 'olive', 'rock', 'rosebush'], layout: 5, nook: 1 },
  workshop:     { name: 'Bronze Workshop',       theme: 'workshop',     kit: ['anvil', 'crate', 'brazier', 'rack'], layout: 2, nook: 3 },
  foundry:      { name: 'The Great Foundry',     theme: 'workshop',     kit: ['brazier', 'anvil', 'boulder', 'crate'], layout: 4, nook: 9 },
  lemnos:       { name: 'Volcano of Lemnos',     theme: 'volcano',      kit: ['boulder', 'brazier', 'anvil', 'boulder'], layout: 3, nook: 5 },
  asphodel:     { name: 'Fields of Asphodel',    theme: 'asphodel',     kit: ['grave', 'stump', 'grave', 'rock'], layout: 0, nook: 6 },
  styx:         { name: 'Banks of the Styx',     theme: 'styx',         kit: ['rock', 'grave', 'crystal', 'boulder'], layout: 2, nook: 0 },
  underworld:   { name: 'Throne of the Dead',    theme: 'underworld',   kit: ['column', 'brazier', 'column', 'crystal'], layout: 3, nook: 8 },
  dreamfield:   { name: 'Field of Dreams',       theme: 'dream',        kit: ['crystal', 'stump', 'crystal', 'rock'], layout: 5, nook: 4 },
};
// Obstacle positions for generated arenas. All of them keep the middle of the arena and the spawn points clear.
const LAYOUTS = [
  [[8, 7], [30, 6], [11, 18], [28, 19], [32, 16], [15, 17], [23, 7], [6, 10], [34, 9]],
  [[8, 7], [31, 7], [10, 18], [29, 17], [17, 6], [24, 20], [14, 11], [26, 15], [33, 13]],
  [[10, 9], [29, 8], [13, 17], [26, 18], [7, 15], [33, 14], [18, 7], [22, 19]],
  [[9, 8], [15, 8], [25, 8], [31, 8], [9, 18], [15, 18], [25, 18], [31, 18], [12, 13], [28, 13]],
  [[8, 7], [14, 6], [26, 6], [32, 8], [9, 18], [16, 20], [25, 19], [31, 17], [20, 6], [23, 16]],
  [[9, 8], [29, 7], [13, 12], [27, 15], [8, 18], [32, 18], [19, 18], [23, 10], [16, 6]],
];
// Hidden nooks for generated arenas.
const NOOKS = [
  { x: 37, y: 12, w: 2, h: 3, chest: [38, 13] }, { x: 9, y: 1, w: 3, h: 2, chest: [10, 1] }, { x: 1, y: 16, w: 2, h: 3, chest: [1, 17] },
  { x: 29, y: 23, w: 3, h: 2, chest: [30, 24] }, { x: 37, y: 17, w: 2, h: 3, chest: [38, 18] }, { x: 26, y: 1, w: 3, h: 2, chest: [27, 1] },
  { x: 1, y: 6, w: 2, h: 3, chest: [1, 7] }, { x: 8, y: 23, w: 3, h: 2, chest: [9, 24] }, { x: 37, y: 5, w: 2, h: 3, chest: [38, 6] },
  { x: 18, y: 1, w: 3, h: 2, chest: [19, 1] },
];
function nookHint(name, theme, s, wt = 40, ht = 26) {
  const word = { hedge: 'hedge', cliff: 'cliff', drystone: 'stone wall', wall: 'wall', clouds: 'cloud bank', sea: 'rocks by the water' }[THEMES[theme].border] || 'wall';
  let side, where;
  const vert = s.y < ht * .35 ? 'near the top' : s.y > ht * .58 ? 'near the bottom' : 'about halfway down', horiz = s.x < wt * .35 ? 'on the left side' : s.x > wt * .63 ? 'on the right side' : 'in the middle';
  if (s.x > wt - 4) { side = 'east'; where = vert; }
  else if (s.x + s.w - 1 < 3) { side = 'west'; where = vert; }
  else if (s.y < 3) { side = 'north'; where = horiz; }
  else { side = 'south'; where = horiz; }
  return `In ${name.replace(/^The /, 'the ')}, the ${side} ${word} ${where} is hollow. Walk straight into it.`;
}

// Quests. waves = list of {monster: count}. Hunts sit between the gods; each god's own quest has a boss.
// tier sets how strong the monsters are (see BALANCE). requires = quests to clear first.
// Pay climbs 20% a tier through Low Rank, then more gently through High and God Rank.
const huntPay = t => Math.round((t <= 16 ? 200 * Math.pow(1.2, t - 1) : 200 * Math.pow(1.2, 15) * (1 + .1 * (t - 16))) / 10) * 10;
const QUESTS = [
  // ---- Low Rank ----
  { id: 'road_bandits', god: 'hermes', tier: 1, name: 'Bandits on the Road', arena: 'road', requires: [],
    desc: 'Bandits have been robbing travelers on the road to Delphi. Clear them out. A good first hunt.',
    waves: [{ bandit: 4 }, { bandit: 6 }, { bandit: 8 }] },
  { id: 'stolen_herd', god: 'hermes', tier: 1, name: 'The Stolen Herd', arena: 'pasture', requires: ['road_bandits'],
    desc: 'Apollo’s sacred cattle have run wild in the hills, and the thieves are still around. Bulls charge in a straight line, so sidestep them and they’ll slam into walls.',
    waves: [{ bandit: 4, bull: 1 }, { bandit: 5, bull: 2 }, { bull: 3, bandit: 4 }] },
  { id: 'hill_slingers', god: 'hermes', tier: 1, name: 'Stones from the Hills', arena: 'pass', requires: ['road_bandits'],
    desc: 'Slingers hold the high pass and keep their distance. Close in fast or get buried in rocks.',
    waves: [{ bandit: 3, slinger: 2 }, { bandit: 4, slinger: 3 }, { slinger: 4, bandit: 5, bull: 1 }] },
  { id: 'hermes_hunt', god: 'hermes', tier: 1, boss: 'hermes', name: 'The Messenger God', arena: 'temple', requires: ['stolen_herd', 'hill_slingers'], reward: 700,
    desc: 'Hermes has noticed you. Fight through his shrine guards, then outrun the god himself. Watch for the red line before he dashes. He stops to catch his breath after.',
    waves: [{ bandit: 5, slinger: 2 }, { bandit: 4, bull: 2, slinger: 2 }] },

  { id: 'wolf_woods', god: 'artemis', tier: 2, name: 'Wolves in the Woods', arena: 'woods', requires: ['hermes_hunt'],
    desc: 'Artemis’ wolves hunt in packs. A wolf crouches before it pounces, so dash sideways when one goes still.',
    waves: [{ wolf: 5 }, { wolf: 6, huntress: 1 }, { wolf: 8, huntress: 2 }] },
  { id: 'golden_stag', god: 'artemis', tier: 2, name: 'The Golden Stag', arena: 'glade', requires: ['hermes_hunt'],
    desc: 'Golden stags charge like bulls, and the great Calydonian boar charges twice in a row. Don’t stop moving after the first one.',
    waves: [{ wolf: 4, stag: 1 }, { stag: 2, wolf: 5 }, { calydon: 1, wolf: 4 }] },
  { id: 'artemis_hunt', god: 'artemis', tier: 2, boss: 'artemis', name: 'Lady of the Hunt', arena: 'moontemple', requires: ['wolf_woods', 'golden_stag'],
    desc: 'Artemis keeps her distance and fills the air with arrows. When the ground lights up, arrows are about to land there. When she crouches, she’s about to leap onto you.',
    waves: [{ wolf: 5, huntress: 1 }, { stag: 1, huntress: 2, wolf: 3 }] },

  { id: 'vineyard_riot', god: 'dionysus', tier: 3, name: 'Riot in the Vineyard', arena: 'vineyard', requires: ['artemis_hunt'],
    desc: 'Satyrs have broken into the wine. Maenads throw jars that leave puddles of wine behind. Wine slows you down, so stay out of it.',
    waves: [{ satyr: 6 }, { satyr: 7, maenad: 2 }, { satyr: 8, maenad: 2, goat: 3 }] },
  { id: 'panther_path', god: 'dionysus', tier: 3, name: 'The Panther Path', arena: 'thicket', requires: ['artemis_hunt'],
    desc: 'Dionysus’ panthers pounce twice in a row. A drunken centaur guards the path and charges through anything.',
    waves: [{ panther: 2, satyr: 4 }, { panther: 3, goat: 4 }, { centaur: 1, panther: 2, satyr: 4 }] },
  { id: 'dionysus_hunt', god: 'dionysus', tier: 3, boss: 'dionysus', name: 'The Wild Feast', arena: 'theater', requires: ['vineyard_riot', 'panther_path'],
    desc: 'Dionysus spreads madness. If his purple wave hits you, your controls flip for a few seconds. Dash through it, or keep calm and steer the other way.',
    waves: [{ satyr: 6, maenad: 2 }, { panther: 1, maenad: 1, satyr: 4 }] },
  { id: 'pan_hunt', god: 'pan', tier: 3.5, side: true, boss: 'pan', name: 'The Panic of Pan', arena: 'meadow', requires: ['dionysus_hunt'],
    desc: 'The wild god Pan sends stampedes of goats across the meadow. Watch the marked lanes and step out of them.',
    waves: [{ goat: 6, satyr: 4 }] },

  // ---- High Rank ----
  { id: 'owl_grove', god: 'athena', tier: 4, name: 'Owls of the Olive Grove', arena: 'grove', requires: ['dionysus_hunt'],
    desc: 'Athena’s war owls nest in the sacred grove and dive at anyone who comes close. Each dive starts with a short hover, so dash sideways when they stop moving.',
    waves: [{ owl: 4, archer: 1 }, { owl: 5, archer: 2 }, { owl: 6, archer: 2, hoplite: 1 }] },
  { id: 'bronze_wall', god: 'athena', tier: 4, name: 'The Bronze Wall', arena: 'ruins', requires: ['dionysus_hunt'],
    desc: 'Hoplites hold the old agora behind bronze shields. Hits on the shield barely land, so get around them, or strike right after they thrust.',
    waves: [{ hoplite: 2, archer: 2 }, { hoplite: 3, archer: 3 }, { hoplite: 3, owl: 4, archer: 2 }] },
  { id: 'athena_hunt', god: 'athena', tier: 4, boss: 'athena', name: 'The Grey-Eyed Strategist', arena: 'parthenon', requires: ['owl_grove', 'bronze_wall'],
    desc: 'Athena waits in the Parthenon. While she watches you, her shield blocks everything from the front. Strike after her attacks, or from behind.',
    waves: [{ hoplite: 2, archer: 3, owl: 2 }, { owl: 5, hoplite: 2 }] },

  { id: 'jealous_suitors', god: 'aphrodite', tier: 5, name: 'The Jealous Suitors', arena: 'rosegarden', requires: ['athena_hunt'],
    desc: 'A crowd of lovesick suitors has turned violent. Doves dive like owls, only faster.',
    waves: [{ suitor: 7 }, { suitor: 8, dove: 3 }, { suitor: 9, dove: 4, eros: 1 }] },
  { id: 'doves_darts', god: 'aphrodite', tier: 5, name: 'Doves and Darts', arena: 'dovecote', requires: ['athena_hunt'],
    desc: 'The little Erotes fly over everything and shoot heart arrows. One hit makes you stumble toward them. Dashing clears it.',
    waves: [{ dove: 5, eros: 1 }, { dove: 6, eros: 2 }, { dove: 7, eros: 2, suitor: 4 }] },
  { id: 'aphrodite_hunt', god: 'aphrodite', tier: 5, boss: 'aphrodite', name: 'The Foam-Born', arena: 'cythera', requires: ['jealous_suitors', 'doves_darts'],
    desc: 'Aphrodite’s gaze pulls you toward her. When the pink line locks onto you, dash out of it. Her mirror images explode, so kill them early or keep away.',
    waves: [{ suitor: 8, eros: 2 }, { dove: 6, eros: 2, suitor: 3 }] },

  { id: 'plague_arrows', god: 'apollo', tier: 6, name: 'The Plague Arrows', arena: 'plagueroad', requires: ['aphrodite_hunt'],
    desc: 'Plague wretches run at you and burst, leaving poison on the ground. Kill them before they reach you, or dash away when they start to swell.',
    waves: [{ plague: 6 }, { plague: 7, sun_archer: 2 }, { plague: 8, sun_archer: 3 }] },
  { id: 'python_lair', god: 'apollo', tier: 6, name: 'Lair of the Python', arena: 'pythoncave', requires: ['aphrodite_hunt'],
    desc: 'The great serpent of Delphi leaves a trail of venom wherever it charges. Make it hit a wall.',
    waves: [{ plague: 5, sun_archer: 1 }, { plague: 6, sun_archer: 2 }, { python: 1, plague: 5 }] },
  { id: 'apollo_hunt', god: 'apollo', tier: 6, boss: 'apollo', name: 'The Far-Shooter', arena: 'delphi', requires: ['plague_arrows', 'python_lair'],
    desc: 'Apollo sweeps a beam of sunlight across the temple. Watch which way the thin line is pointing and get behind him or out of its path.',
    waves: [{ plague: 7, sun_archer: 2 }, { sun_archer: 3, plague: 6 }] },
  { id: 'hecate_hunt', god: 'hecate', tier: 6.5, side: true, boss: 'hecate', name: 'Crossroads at Midnight', arena: 'crossroads', requires: ['apollo_hunt'],
    desc: 'Hecate, goddess of witchcraft, blinks around the crossroads in cold blue fire. Shades appear right behind you, so keep moving.',
    waves: [{ shade: 6, plague: 4 }] },

  { id: 'sown_men', god: 'ares', tier: 7, name: 'The Sown Men', arena: 'battlefield', requires: ['apollo_hunt'],
    desc: 'Soldiers grown from dragon teeth. Knock one down and it falls into a pile of bones that gets back up. Smash the bones before it does.',
    waves: [{ spartoi: 7 }, { spartoi: 8, war_boar: 2 }, { spartoi: 9, war_boar: 2, berserker: 1 }] },
  { id: 'giants_march', god: 'ares', tier: 7, name: 'March of the Giants', arena: 'phlegra', requires: ['apollo_hunt'],
    desc: 'Berserkers leap three times in a row. A gigas leads them, and its ground slam hits everything around it.',
    waves: [{ berserker: 2, spartoi: 5 }, { berserker: 3, war_boar: 2, spartoi: 4 }, { gigas: 1, berserker: 2, spartoi: 5 }] },
  { id: 'ares_hunt', god: 'ares', tier: 7, boss: 'ares', name: 'God of War', arena: 'warpit', requires: ['sown_men', 'giants_march'],
    desc: 'Ares fights up close and never stops. Once he’s hurt he gets faster. A shield helps here, but his earthquakes go under it.',
    waves: [{ spartoi: 8, berserker: 2 }, { war_boar: 3, berserker: 2, spartoi: 4 }] },
  { id: 'nemesis_hunt', god: 'nemesis', tier: 7.5, side: true, boss: 'nemesis', name: 'Retribution', arena: 'rhamnous', requires: ['ares_hunt'],
    desc: 'Nemesis punishes greed. When she glows silver, every hit you land comes back at you. Wait for the glow to fade.',
    waves: [{ spartoi: 6, berserker: 2 }] },

  // ---- Master Rank ----
  { id: 'crab_shore', god: 'poseidon', tier: 8, name: 'Crabs on the Shore', arena: 'beach', requires: ['ares_hunt'],
    desc: 'Crabs scuttle sideways and come at odd angles. Tritons shoot water that shoves you hard.',
    waves: [{ crab: 7 }, { crab: 8, triton: 2 }, { crab: 8, triton: 2, hippocamp: 1 }] },
  { id: 'triton_reef', god: 'poseidon', tier: 8, name: 'The Tritons’ Reef', arena: 'reef', requires: ['ares_hunt'],
    desc: 'Hippocamps charge fast. The giant crab at the end slams the ground, so watch the ring.',
    waves: [{ triton: 3, crab: 5 }, { hippocamp: 2, triton: 2, crab: 5 }, { giant_crab: 1, triton: 2, crab: 5 }] },
  { id: 'poseidon_hunt', god: 'poseidon', tier: 8, boss: 'poseidon', name: 'The Earth-Shaker', arena: 'seatemple', requires: ['crab_shore', 'triton_reef'],
    desc: 'Poseidon floods the temple and sends tidal rings across the floor. Geysers burst where the ground bubbles.',
    waves: [{ crab: 8, triton: 2 }, { hippocamp: 2, triton: 3, crab: 4 }] },

  { id: 'peacock_court', god: 'hera', tier: 9, name: 'The Peacock Court', arena: 'peacockgarden', requires: ['poseidon_hunt'],
    desc: 'Hera’s priestesses keep calling in more peacocks. Kill the priestesses first.',
    waves: [{ peacock: 7 }, { peacock: 8, priestess: 1 }, { peacock: 9, priestess: 2 }] },
  { id: 'hundred_eyes', god: 'hera', tier: 9, name: 'The Hundred Eyes', arena: 'argusgarden', requires: ['poseidon_hunt'],
    desc: 'Argus the hundred-eyed giant fires bolts from all his eyes at once. Find the gaps between them.',
    waves: [{ peacock: 6, priestess: 1 }, { priestess: 2, peacock: 6 }, { argus: 1, peacock: 6 }] },
  { id: 'hera_hunt', god: 'hera', tier: 9, boss: 'hera', name: 'Queen of the Gods', arena: 'palace', requires: ['peacock_court', 'hundred_eyes'],
    desc: 'Hera sweeps the hall with the gaze of Argus and curses the ground under you. She calls Argus himself when she’s hurt.',
    waves: [{ peacock: 8, priestess: 2 }, { priestess: 2, peacock: 6, hoplite: 2 }] },
  { id: 'eris_hunt', god: 'eris', tier: 9.5, side: true, boss: 'eris', name: 'The Golden Apple', arena: 'applegarden', requires: ['hera_hunt'],
    desc: 'Eris, goddess of strife, calls in monsters from every hunt you’ve been on and throws golden apples that burst.',
    waves: [{ bandit: 4, satyr: 4, crab: 3 }] },

  { id: 'bronze_hounds', god: 'hephaestus', tier: 10, name: 'Hounds of Bronze', arena: 'workshop', requires: ['hera_hunt'],
    desc: 'Clockwork hounds pounce like wolves, and living sparks rush you. Keep your back to a wall.',
    waves: [{ bronze_hound: 6 }, { bronze_hound: 7, spark: 4 }, { bronze_hound: 8, automaton: 1 }] },
  { id: 'automaton_works', god: 'hephaestus', tier: 10, name: 'The Automaton Works', arena: 'foundry', requires: ['hera_hunt'],
    desc: 'Automatons block from the front like hoplites. Talos, the bronze giant, guards the foundry.',
    waves: [{ automaton: 2, spark: 5 }, { automaton: 3, bronze_hound: 4 }, { talos: 1, bronze_hound: 4 }] },
  { id: 'hephaestus_hunt', god: 'hephaestus', tier: 10, boss: 'hephaestus', name: 'Smith of the Gods', arena: 'lemnos', requires: ['bronze_hounds', 'automaton_works'],
    desc: 'Hephaestus pours lava across the floor and hits the ground hard enough to crack it. Stay off the glowing spots.',
    waves: [{ bronze_hound: 7, automaton: 1 }, { automaton: 2, bronze_hound: 5, spark: 3 }] },

  { id: 'restless_dead', god: 'hades', tier: 11, name: 'The Restless Dead', arena: 'asphodel', requires: ['hephaestus_hunt'],
    desc: 'The dead keep getting back up. Smash the bones, and watch for shades appearing behind you.',
    waves: [{ skeleton: 8 }, { skeleton: 9, shade: 3 }, { skeleton: 10, shade: 4 }] },
  { id: 'furies_flight', god: 'hades', tier: 11, name: 'Wings of the Furies', arena: 'styx', requires: ['hephaestus_hunt'],
    desc: 'The Furies dive hard and fast. Cerberus guards the river and pounces three times in a row.',
    waves: [{ fury: 2, shade: 4 }, { fury: 3, skeleton: 6 }, { cerberus: 1, shade: 4 }] },
  { id: 'hades_hunt', god: 'hades', tier: 11, boss: 'hades', name: 'Lord of the Dead', arena: 'underworld', requires: ['restless_dead', 'furies_flight'],
    desc: 'Hades vanishes into shadow and strikes from where you least expect. Watch for his shadow on the floor.',
    waves: [{ skeleton: 9, shade: 3 }, { fury: 3, shade: 4, skeleton: 4 }] },
  { id: 'hypnos_hunt', god: 'hypnos', tier: 11.5, side: true, boss: 'hypnos', name: 'The Long Sleep', arena: 'dreamfield', requires: ['hades_hunt'],
    desc: 'Hypnos fills the field with sleeping fog. Stand in it too long and you fall asleep, so keep moving.',
    waves: [{ shade: 8 }] },

  { id: 'harpy_storm', god: 'zeus', tier: 12, name: 'Harpies on the Wind', arena: 'storm', requires: ['hades_hunt'],
    desc: 'Storm harpies and Zeus’ eagles ride the winds below Olympus. Acolytes keep summoning living sparks, so kill them first.',
    waves: [{ harpy: 3, eagle: 4 }, { harpy: 4, acolyte: 1, eagle: 4 }, { harpy: 5, acolyte: 2, eagle: 4 }] },
  { id: 'cyclops_forge', god: 'zeus', tier: 12, name: 'The Cyclops Forge', arena: 'forge', requires: ['hades_hunt'],
    desc: 'The cyclopes who forge Zeus’ thunderbolts hate visitors. Their ground slams hit everything around them, so watch the ring and step out of it.',
    waves: [{ storm_cyclops: 1, spark: 6 }, { storm_cyclops: 1, cyclops: 1, acolyte: 1 }, { storm_cyclops: 2, harpy: 3, eagle: 3 }] },
  { id: 'zeus_hunt', god: 'zeus', tier: 12, boss: 'zeus', name: 'King of Olympus', arena: 'summit', requires: ['harpy_storm', 'cyclops_forge'],
    desc: 'The final hunt. Zeus calls lightning down wherever you stand, and he has a third form when he’s nearly beaten. Keep moving and watch the ground for marks.',
    waves: [{ harpy: 3, eagle: 4, storm_cyclops: 1 }, { harpy: 3, acolyte: 2, eagle: 4 }] },
];
const START_MONEY = 0;


