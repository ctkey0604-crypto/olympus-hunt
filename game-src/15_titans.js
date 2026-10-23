/* ============================== TITANS =================================== */
// The Titans live under the Temple of the Twelve. The stairway opens once every god has been hunted.
// They're bigger than the gods and fight in bigger arenas, but every one of them fits on screen.
const TITANS = [
  { id: 'atlas',     name: 'Atlas',     quest: 'atlas_hunt',     tier: 13 },
  { id: 'hyperion',  name: 'Hyperion',  quest: 'hyperion_hunt',  tier: 13.5 },
  { id: 'oceanus',   name: 'Oceanus',   quest: 'oceanus_hunt',   tier: 14 },
  { id: 'coeus',     name: 'Coeus',     quest: 'coeus_hunt',     tier: 14.5 },
  { id: 'mnemosyne', name: 'Mnemosyne', quest: 'mnemosyne_hunt', tier: 15 },
  { id: 'themis',    name: 'Themis',    quest: 'themis_hunt',    tier: 15.5 },
  { id: 'rhea',      name: 'Rhea',      quest: 'rhea_hunt',      tier: 16 },
  { id: 'cronus',    name: 'Cronus',    quest: 'cronus_hunt',    tier: 16.5 },
];

Object.assign(ITEMS, {
  earth_shard:      { name: 'Earth Shard',      rarity: 1, icon: ['shard', '#8a7a5a', '#5a4e38', '#c9b48e'], desc: 'Rock from the body of an earthborn. It still feels alive.' },
  obsidian_plate:   { name: 'Obsidian Plate',   rarity: 2, icon: ['plate', '#3a3048', '#1c1626'], desc: 'Volcanic glass, chipped into armor plates.' },
  chrono_dust:      { name: 'Chrono Dust',      rarity: 2, icon: ['shard', '#e9c04f', '#8f6c1c', '#fff6d8'], desc: 'Sand that falls upward when nobody is looking.' },
  titan_bone:       { name: 'Titan Bone',       rarity: 3, icon: ['bone', '#e6dcc6', '#9c9078'], desc: 'Heavier than bronze, older than the gods.' },
  sky_shard:        { name: 'Sky Shard',        rarity: 4, icon: ['gem', '#3c4a78', '#232c4e', '#ffffff'], desc: 'A piece of the night sky. Stars still move inside it.' },
  dawn_ember:       { name: 'Dawn Ember',       rarity: 4, icon: ['ember', '#ffd463', '#ff8a2b', '#ffffff'], desc: 'The first light of the first morning.' },
  world_water:      { name: 'World Water',      rarity: 4, icon: ['vial', '#2c7a70', '#1a4a44', '#7fd0c8'], desc: 'From the river that circles the whole world.' },
  axis_star:        { name: 'Axis Star',        rarity: 4, icon: ['orb', '#e6f2ff', '#5b9bd5', '#ffffff'], desc: 'The star the heavens turn around.' },
  memory_glass:     { name: 'Memory Glass',     rarity: 4, icon: ['gem', '#c8b8ff', '#6b5a8a', '#ffffff'], desc: 'Look into it and you see yesterday.' },
  oath_stone:       { name: 'Oath Stone',       rarity: 4, icon: ['plate', '#f3e9d4', '#c9a032'], desc: 'Every promise made on it has been kept.' },
  swaddled_stone:   { name: 'Swaddled Stone',   rarity: 4, icon: ['cloth', '#c9bda4', '#8f846c'], desc: 'A stone wrapped like a baby. Cronus fell for it once.' },
  hourglass_sand:   { name: 'Hourglass Sand',   rarity: 4, icon: ['vial', '#e9c04f', '#8f6c1c', '#1f1f24'], desc: 'It runs out slower when you need it to.' },
  primordial_token: { name: 'Primordial Token', rarity: 4, icon: ['coin', '#3a3048', '#1c1626', '#b48cff'], desc: 'Every Titan kill drops one.' },
});

Object.assign(ENEMIES, {
  earthborn:     { name: 'Earthborn',      role: 'fodder',     cls: 'fodder', sprite: 'earthborn', r: 5, speed: 40, colors: ['#8a7a5a', '#5a4e38', '#ff8a2b'], loot: [['earth_shard', .7], ['titan_bone', .04]] },
  colossus:      { name: 'Stone Colossus', role: 'tank',       cls: 'heavy',  sprite: 'colossus',  r: 9, speed: 22, attack: 'slam', turn: 1.5, kbRes: .1, colors: ['#8a8478', '#5a554c', '#ff8a2b'], loot: [['titan_bone', 1], ['earth_shard', .8, 1, 2]] },
  obsidian_guard:{ name: 'Obsidian Guard', role: 'tank',       cls: 'medium', sprite: 'obsidian',  r: 6, speed: 28, hpM: 7.5, dmgP: .15, shield: true, attack: 'thrust', turn: 2.4, kbRes: .3, colors: ['#3a3048', '#1c1626', '#b48cff'], loot: [['obsidian_plate', .8, 1, 2], ['titan_bone', .08]] },
  chrono_wraith: { name: 'Chrono Wraith',  role: 'teleporter', cls: 'fodder', sprite: 'chrono',    r: 5, speed: 34, hpM: 1.8, dmgP: .08, colors: ['#e9c04f', '#8f6c1c', '#fff6d8'], loot: [['chrono_dust', .7]] },
  sky_harpy:     { name: 'Sky Harpy',      role: 'flyer',      cls: 'medium', sprite: 'skyharpy',  r: 5, speed: 82, hpM: 3, dmgP: .1, swoop: 245, colors: ['#5b9bd5', '#2c5684', '#ffffff'], loot: [['earth_shard', .4], ['storm_glass', .3]] },
  lion:          { name: 'Lion of Rhea',   role: 'leaper',     cls: 'medium', sprite: 'lion',      r: 6, speed: 58, hpM: 4.5, pounce: 270, chain: 2, colors: ['#c9a046', '#8a6a2a', '#5a3a22'], loot: [['earth_shard', .5], ['obsidian_plate', .2]] },
  bundle:        { name: 'Swaddled Stone', role: 'decoy',      cls: 'fodder', sprite: 'bundle',    r: 10, scale: 2, speed: 70, colors: ['#c9bda4', '#8f846c', '#ffffff'], loot: [] },
  river_serpent: { name: 'River Serpent',  role: 'charger',    cls: 'heavy',  sprite: 'serpent',   r: 9, speed: 30, charge: 210, trail: 'water', kbRes: .1, colors: ['#2c7a70', '#1a4a44', '#7fd0c8'], loot: [['titan_bone', 1], ['triton_scale', .8, 1, 2]] },
});
Object.assign(PLURALS, { earthborn: 'Earthborn', colossus: 'Stone Colossi', lion: 'Lions of Rhea', chrono_wraith: 'Chrono Wraiths' });

// Titan fights are hand-made (see TITAN_AI). hp is worked out from the tier like the gods', only longer.
const TITAN_LOOK = {
  atlas:     { title: 'Bearer of the Sky',    colors: ['#8a7a5a', '#3c4a78', '#e9c04f'], relic: 'sky_shard' },
  hyperion:  { dmgScale: 0.92, title: 'Lord of Light',        colors: ['#ffd463', '#ff8a2b', '#ffffff'], relic: 'dawn_ember' },
  oceanus:   { dmgScale: 0.78, title: 'The World-River',      colors: ['#57c2b0', '#2c7a70', '#e6f2ff'], relic: 'world_water' },
  coeus:     { dmgScale: 0.89, title: 'Axis of Heaven',       colors: ['#5b9bd5', '#1a2442', '#ffffff'], relic: 'axis_star' },
  mnemosyne: { dmgScale: 1.9, title: 'Titan of Memory',      colors: ['#c8b8ff', '#6b5a8a', '#ffffff'], relic: 'memory_glass' },
  themis:    { title: 'Keeper of Divine Law', colors: ['#f3e9d4', '#c9a032', '#ffffff'], relic: 'oath_stone' },
  rhea:      { dmgScale: 1.17, title: 'Mother of the Gods',   colors: ['#7fa548', '#8a5a34', '#e9c04f'], relic: 'swaddled_stone' },
  cronus:    { dmgScale: 1.28, title: 'Devourer of Time',     colors: ['#a7adb3', '#e9c04f', '#1f1f24'], relic: 'hourglass_sand' },
};
for (const T of TITANS) {
  const L = TITAN_LOOK[T.id];
  BOSSES[T.id] = { name: T.name, title: L.title, tier: T.tier, titan: true, custom: true, r: 11, sprite: T.id, arrivalHeals: 3,
                   colors: L.colors, loot: [[L.relic, 1, 2, 3], ['primordial_token', 1]], dmgScale: L.dmgScale || 1 };
}

Object.assign(ABILITIES, {
  // skills for High and God Rank forms of weapons that had none
  crescent:    { name: 'Crescent Cut',   cd: 5,  desc: 'Swing so hard the blade throws a crescent of light that cuts through everything in a line.' },
  impale:      { name: 'Impaling Rush',  cd: 5,  desc: 'Charge spear-first, skewering everything in your path.' },
  shockwave:   { name: 'Shockwave',      cd: 7,  desc: 'Slam the ground three times. Each ring reaches further and stuns what it hits.' },
  flurry:      { name: 'Flurry',         cd: 6,  desc: 'Ten stabs in front of you in half a second.' },
  piercer:     { name: 'Piercing Shot',  cd: 5,  desc: 'A heavy arrow that goes through everything and hits three times as hard.' },
  // Titan weapons
  skyfall:     { name: 'Skyfall',        cd: 9,  desc: 'Pieces of the sky crash down on the six nearest enemies.' },
  solar_lance: { name: 'Solar Lance',    cd: 7,  desc: 'A beam of dawn light burns through everything in a long line.' },
  riptide:     { name: 'Riptide',        cd: 8,  desc: 'Drag every enemy nearby to you, then crash a wave over them.' },
  foresight:   { name: 'Foresight',      cd: 10, desc: 'For 5 seconds you sidestep the next two hits on your own.' },
  echo:        { name: 'Echo',           cd: 9,  desc: 'For 5 seconds, an echo of you repeats every swing.' },
  verdict:     { name: 'Verdict',        cd: 9,  desc: 'Turns the damage you took in the last 8 seconds into a blast around you. The more you were hurt, the bigger it is.' },
  pride:       { name: 'Pride of Rhea',  cd: 9,  desc: 'Two spirit lions leap out and hunt the nearest enemies.' },
  timestop:    { name: 'Stop Time',      cd: 12, desc: 'Everything but you freezes for 2.5 seconds. Gods and Titans only slow down.' },
});
const KIND_SKILL = { sword: 'crescent', spear: 'impale', hammer: 'shockwave', daggers: 'flurry', bow: 'piercer' };

Object.assign(WEAPONS, {
  sky_maul:      { titan: true, name: 'Maul of the Sky',     kind: 'hammer',  wt: 13,   ability: 'skyfall',     recipe: { items: { sky_shard: 3, primordial_token: 2, titan_bone: 2 }, cost: 6000 }, desc: 'A lump of the night sky on a handle.' },
  dawn_bow:      { titan: true, name: 'Bow of First Light',  kind: 'bow',     wt: 13.5, pierce: 2, ability: 'solar_lance', recipe: { items: { dawn_ember: 3, primordial_token: 2, obsidian_plate: 4 }, cost: 6400 }, desc: 'Strung with a sunbeam.' },
  tide_daggers:  { titan: true, name: 'Tidebreaker Fangs',   kind: 'daggers', wt: 14,   ability: 'riptide',     recipe: { items: { world_water: 3, primordial_token: 2, triton_scale: 5 }, cost: 6800 }, desc: 'They pull like the undertow.' },
  axis_spear:    { titan: true, name: 'Spear of the Axis',   kind: 'spear',   wt: 14.5, ability: 'foresight',   recipe: { items: { axis_star: 3, primordial_token: 2, chrono_dust: 4 }, cost: 7200 }, desc: 'The heavens turn around its tip.' },
  memory_blade:  { titan: true, name: 'Blade of Memory',     kind: 'sword',   wt: 15,   ability: 'echo',        recipe: { items: { memory_glass: 3, primordial_token: 2, chrono_dust: 4 }, cost: 7600 }, desc: 'It remembers every cut it ever made.' },
  law_glaive:    { titan: true, name: 'Glaive of Law',       kind: 'spear',   wt: 15.5, ability: 'verdict',     recipe: { items: { oath_stone: 3, primordial_token: 2, obsidian_plate: 5 }, cost: 8000 }, desc: 'It weighs every blow you take.' },
  lion_claws:    { titan: true, name: 'Claws of the Pride',  kind: 'daggers', wt: 16,   ability: 'pride',       recipe: { items: { swaddled_stone: 3, primordial_token: 2, earth_shard: 8 }, cost: 8400 }, desc: 'Rhea’s lions answer when they’re drawn.' },
  harpe_cronus:  { titan: true, name: 'Harpe of Cronus',     kind: 'sword',   wt: 16.5, ability: 'timestop',    recipe: { items: { hourglass_sand: 3, primordial_token: 2, titan_bone: 3 }, cost: 9000 }, desc: 'The sickle that cut the sky from the earth.' },
});
const TITAN_WEAPON_COLORS = {
  sky_maul: ['#3c4a78', '#e9c04f', '#5a4e38'], dawn_bow: ['#ffd463', '#ff8a2b', '#8a5a34'], tide_daggers: ['#7fd0c8', '#2c7a70', '#1a4a44'],
  axis_spear: ['#e6f2ff', '#5b9bd5', '#1a2442'], memory_blade: ['#c8b8ff', '#ffffff', '#6b5a8a'], law_glaive: ['#f3e9d4', '#e9c04f', '#8f846c'],
  lion_claws: ['#e9c04f', '#c9a046', '#5a3a22'], harpe_cronus: ['#d5dbe5', '#e9c04f', '#1f1f24'],
};

Object.assign(ARMOR_SETS, {
  skybearer:   { titan: true, name: 'Skybearer',   ch: 13,   def: 46, hp: 84,  god: 'atlas',     colors: { head: ['#3c4a78', '#232c4e', '#e9c04f'], chest: ['#3c4a78', '#232c4e', '#e9c04f'], legs: ['#8a7a5a', '#5a4e38'], feet: ['#3c4a78', '#232c4e'] }, extra: 'crown', recipe: { items: { sky_shard: 3, primordial_token: 1, earth_shard: 6 }, cost: 5600 }, two: { def: 5 }, four: { unflinching: 1 }, desc: 'Starry plate that holds under any weight.' },
  dawnlord:    { titan: true, name: 'Dawnlord',    ch: 13.5, def: 47, hp: 86,  god: 'hyperion',  colors: { head: ['#ffd463', '#c9a032', '#ff8a2b'], chest: ['#fff6d8', '#e0c890', '#ff8a2b'], legs: ['#ffd463', '#c9a032'], feet: ['#ff8a2b', '#a8501a'] }, extra: 'rays', recipe: { items: { dawn_ember: 3, primordial_token: 1, obsidian_plate: 4 }, cost: 6000 }, two: { dmg: .08 }, four: { godBane: .12 }, desc: 'It glows before the sun comes up.' },
  riverborn:   { titan: true, name: 'Riverborn',   ch: 14,   def: 49, hp: 89,  god: 'oceanus',   colors: { head: ['#57c2b0', '#2c7a70', '#e6f2ff'], chest: ['#1a4a44', '#0e2a26', '#57c2b0'], legs: ['#2c7a70', '#1a4a44'], feet: ['#57c2b0', '#2c7a70'] }, extra: 'fins', recipe: { items: { world_water: 3, primordial_token: 1, triton_scale: 5 }, cost: 6400 }, two: { regen: 1.5 }, four: { lifesteal: .04, knock: .4 }, desc: 'Scales that never dry.' },
  starseer:    { titan: true, name: 'Starseer',    ch: 14.5, def: 50, hp: 92,  god: 'coeus',     colors: { head: ['#1a2442', '#0e1428', '#ffffff'], chest: ['#1a2442', '#0e1428', '#e6f2ff'], legs: ['#2c3a6a', '#1a2442'], feet: ['#1a2442', '#0e1428'] }, extra: 'halo', recipe: { items: { axis_star: 3, primordial_token: 1, chrono_dust: 4 }, cost: 6800 }, two: { dodgeCd: .12 }, four: { ward: 12 }, desc: 'Robes sewn with the stars that never set.' },
  mnemonic:    { titan: true, name: 'Mnemonic',    ch: 15,   def: 52, hp: 95,  god: 'mnemosyne', colors: { head: ['#6b5a8a', '#3a2f4a', '#c8b8ff'], chest: ['#c8b8ff', '#8a7aaa', '#6b5a8a'], legs: ['#6b5a8a', '#3a2f4a'], feet: ['#3a2f4a', '#1f1a28'] }, extra: 'hood', recipe: { items: { memory_glass: 3, primordial_token: 1, shade_essence: 6 }, cost: 7200 }, two: { abilityCd: .15 }, four: { abilityCd: .15, dmg: .05 }, desc: 'You remember things you never learned.' },
  lawgiver:    { titan: true, name: 'Lawgiver',    ch: 15.5, def: 53, hp: 98,  god: 'themis',    colors: { head: ['#e9c04f', '#a8842a', '#f3e9d4'], chest: ['#f3e9d4', '#c2b293', '#e9c04f'], legs: ['#f3e9d4', '#c2b293'], feet: ['#e9c04f', '#a8842a'] }, extra: 'laurel', recipe: { items: { oath_stone: 3, primordial_token: 1, obsidian_plate: 5 }, cost: 7600 }, two: { guard: .4 }, four: { thorns: .8 }, desc: 'Plain white and gold. It doesn’t need to say anything.' },
  titanmother: { titan: true, name: 'Titanmother', ch: 16,   def: 55, hp: 100, god: 'rhea',      colors: { head: ['#c9a046', '#8a6a2a', '#7fa548'], chest: ['#7fa548', '#4e6e2b', '#c9a046'], legs: ['#8a5a34', '#5a3a22'], feet: ['#5a3a22', '#3a2416'] }, extra: 'tower', recipe: { items: { swaddled_stone: 3, primordial_token: 1, earth_shard: 8 }, cost: 8000 }, two: { hp: 25, healDrops: .05 }, four: { lastStand: 1 }, desc: 'A crown of city walls and a lion-skin cloak.' },
  timeless:    { titan: true, name: 'Timeless',    ch: 16.5, def: 56, hp: 104, god: 'cronus',    colors: { head: ['#4a4a52', '#2a2a30', '#e9c04f'], chest: ['#4a4a52', '#2a2a30', '#e9c04f'], legs: ['#2a2a30', '#141418'], feet: ['#2a2a30', '#141418'] }, extra: 'hood', recipe: { items: { hourglass_sand: 3, primordial_token: 1, titan_bone: 3 }, cost: 8600 }, two: { speed: .08 }, four: { phase: 1, dodgeCd: .15 }, desc: 'Grey robes that never wear out.' },
});
Object.assign(PERK_TEXT, {
  ward: v => `Every ${v} seconds, the next hit on you is shrugged off`,
  lastStand: () => 'Once per hunt, a hit that would drop you leaves you at 1 health',
  godBane: v => `+${Math.round(v * 100)}% damage to gods and Titans`,
  unflinching: () => 'Hits no longer knock you back',
});

Object.assign(SHIELDS, {
  sky_shield:  { titan: true, name: 'Shield of the Sky', ch: 13,   block: .9,  meter: 16, weight: .08, colors: ['#3c4a78', '#232c4e', '#e9c04f'], perk: 'bash', recipe: { items: { sky_shard: 2, primordial_token: 1, titan_bone: 2 }, cost: 5200 }, desc: 'Perfect blocks knock attackers flying.' },
  aeon_shield: { titan: true, name: 'Shield of Ages',    ch: 16.5, block: .92, meter: 17, weight: .06, colors: ['#4a4a52', '#2a2a30', '#e9c04f'], perk: 'timeslow', recipe: { items: { hourglass_sand: 2, primordial_token: 1, chrono_dust: 6 }, cost: 8000 }, desc: 'Perfect blocks freeze everything close to you for a moment.' },
});

// Titan arenas are bigger than the god arenas. wt/ht = size in tiles.
Object.assign(ARENAS, {
  skyvault:   { name: 'Edge of the World', theme: 'skyvault', wt: 52, ht: 34,
                obstacles: [['boulder', 11, 9], ['boulder', 40, 9], ['boulder', 11, 25], ['boulder', 40, 25], ['rock', 25, 7], ['rock', 7, 17], ['rock', 44, 17], ['rock', 26, 27], ['crystal', 17, 16], ['crystal', 34, 19], ['rock', 20, 23], ['rock', 32, 11]],
                secret: { x: 49, y: 15, w: 2, h: 3, chest: [50, 16], hint: 'At the edge of the world, the east cliff has a hollow about halfway down. Walk straight in.' } },
  dawnhall:   { name: 'Hall of Dawn', theme: 'dawnhall', wt: 48, ht: 32,
                obstacles: [['obelisk', 12, 9], ['obelisk', 24, 8], ['obelisk', 36, 9], ['obelisk', 9, 17], ['obelisk', 39, 17], ['obelisk', 12, 24], ['obelisk', 24, 25], ['obelisk', 36, 24], ['brazier', 18, 16], ['brazier', 30, 16]],
                secret: { x: 22, y: 1, w: 3, h: 2, chest: [23, 1], hint: 'In the Hall of Dawn, the north wall behind the middle obelisk is false.' } },
  riverdeep:  { name: 'The Endless River', theme: 'riverdeep', wt: 54, ht: 34,
                obstacles: [['coral', 10, 8], ['coral', 43, 8], ['shell', 16, 26], ['shell', 37, 26], ['rock', 27, 7], ['rock', 8, 19], ['rock', 46, 15], ['coral', 21, 13], ['coral', 33, 21], ['boulder', 27, 27]],
                secret: { x: 1, y: 22, w: 2, h: 3, chest: [1, 23], hint: 'In the endless river, the west rocks hide a hollow near the bottom.' } },
  starfield:  { name: 'Field of Stars', theme: 'starfield', wt: 50, ht: 32,
                obstacles: [['crystal', 10, 8], ['crystal', 39, 8], ['crystal', 10, 23], ['crystal', 39, 23], ['column', 18, 12], ['column', 31, 12], ['column', 18, 20], ['column', 31, 20]],
                secret: { x: 9, y: 29, w: 3, h: 2, chest: [10, 30], hint: 'In the field of stars, the south wall on the left side is only painted on.' } },
  memorywell: { name: 'Well of Memory', theme: 'memorywell', wt: 48, ht: 30,
                obstacles: [['brokencol', 9, 8], ['brokencol', 38, 8], ['slab', 14, 21], ['slab', 33, 21], ['crystal', 23, 7], ['amphora', 7, 15], ['amphora', 40, 15], ['brokencol', 23, 24]],
                secret: { x: 45, y: 6, w: 2, h: 3, chest: [46, 7], hint: 'At the well of memory, the east wall near the top has been forgotten. Walk into it.' } },
  lawcourt:   { name: 'Court of Themis', theme: 'lawcourt', wt: 46, ht: 30,
                obstacles: [['column', 9, 8], ['column', 17, 8], ['column', 28, 8], ['column', 36, 8], ['column', 9, 21], ['column', 17, 21], ['column', 28, 21], ['column', 36, 21], ['brazier', 22, 7], ['brazier', 22, 22]],
                secret: { x: 1, y: 13, w: 2, h: 3, chest: [1, 14], hint: 'In the court of Themis, the west wall halfway down has a door with no handle.' } },
  diktecave:  { name: 'Cave of Dikte', theme: 'diktecave', wt: 52, ht: 34,
                obstacles: [['boulder', 9, 8], ['boulder', 42, 9], ['boulder', 15, 25], ['boulder', 37, 26], ['crystal', 25, 7], ['crystal', 8, 18], ['crystal', 44, 19], ['rock', 20, 15], ['rock', 32, 18], ['stump', 26, 27]],
                secret: { x: 36, y: 1, w: 3, h: 2, chest: [37, 1], hint: 'In the cave of Dikte, the north wall on the right side opens into a nursery.' } },
  tartarus:   { name: 'Pit of Tartarus', theme: 'tartarus', wt: 56, ht: 36,
                obstacles: [['boulder', 10, 9], ['boulder', 45, 9], ['boulder', 10, 27], ['boulder', 45, 27], ['brazier', 20, 8], ['brazier', 35, 8], ['brazier', 20, 28], ['brazier', 35, 28], ['anvil', 27, 17], ['rock', 16, 18], ['rock', 39, 18]],
                secret: { x: 26, y: 33, w: 3, h: 2, chest: [27, 34], hint: 'In the pit of Tartarus, the south cliff in the middle crumbles if you push.' } },
});

QUESTS.push(
  { id: 'atlas_hunt', god: 'atlas', titan: true, tier: 13, boss: 'atlas', name: 'The Weight of the Sky', arena: 'skyvault', requires: [],
    desc: 'Atlas holds the sky on his shoulders, and pieces of it fall wherever he steps. Watch for marks on the ground. When he hurls the sky at you, get out of its path, then hit him hard while his arms are empty.',
    waves: [{ earthborn: 8, colossus: 1 }] },
  { id: 'hyperion_hunt', god: 'hyperion', titan: true, tier: 13.5, boss: 'hyperion', name: 'The First Dawn', arena: 'dawnhall', requires: ['atlas_hunt'],
    desc: 'Hyperion’s light burns anything it touches. When he gathers a flare, hide behind an obelisk so it’s between you and him. Keep moving when his beams sweep the hall.',
    waves: [{ sky_harpy: 3, obsidian_guard: 2, earthborn: 5 }] },
  { id: 'oceanus_hunt', god: 'oceanus', titan: true, tier: 14, boss: 'oceanus', name: 'The World-River', arena: 'riverdeep', requires: ['hyperion_hunt'],
    desc: 'The river that circles the world never stops flowing. Its current drags you across the arena, and his whirlpools pull you in. Walk against the flow when you need to get away.',
    waves: [{ triton: 3, river_serpent: 1, crab: 5 }] },
  { id: 'coeus_hunt', god: 'coeus', titan: true, tier: 14.5, boss: 'coeus', name: 'The Axis of Heaven', arena: 'starfield', requires: ['oceanus_hunt'],
    desc: 'Coeus sees where you’re going before you do. His strikes land where you’re about to be, so change direction at the last moment. Lines of starlight join the stars he leaves behind.',
    waves: [{ chrono_wraith: 4, sky_harpy: 3, obsidian_guard: 1 }] },
  { id: 'mnemosyne_hunt', god: 'mnemosyne', titan: true, tier: 15, boss: 'mnemosyne', name: 'What Was Forgotten', arena: 'memorywell', requires: ['coeus_hunt'],
    desc: 'Mnemosyne remembers everything you do. Her echoes walk your own path and swing your own swings a few seconds later. Don’t stay where you just fought.',
    waves: [{ chrono_wraith: 6, shade: 4 }] },
  { id: 'themis_hunt', god: 'themis', titan: true, tier: 15.5, boss: 'themis', name: 'The Scales of Law', arena: 'lawcourt', requires: ['mnemosyne_hunt'],
    desc: 'Themis lays down the law. Read each law she announces and keep it until it ends, or her scales tip against you. She has no patience for a fighter who swings the same way over and over.',
    waves: [{ obsidian_guard: 3, earthborn: 6 }] },
  { id: 'rhea_hunt', god: 'rhea', titan: true, tier: 16, boss: 'rhea', name: 'The Mother’s Ruse', arena: 'diktecave', requires: ['themis_hunt'],
    desc: 'Rhea once fooled Cronus with a stone wrapped in a blanket. She’ll try it on you too. When she hides among the bundles, find the one that breathes. The others burst.',
    waves: [{ lion: 3, earthborn: 6 }] },
  { id: 'cronus_hunt', god: 'cronus', titan: true, tier: 16.5, boss: 'cronus', name: 'The Devourer of Time', arena: 'tartarus', requires: ['rhea_hunt'],
    desc: 'The last Titan. When his hourglass appears, hit him hard before the sand runs out, or every wound you gave him heals. His sickle reaches further than it looks.',
    waves: [{ chrono_wraith: 5, obsidian_guard: 2, colossus: 1 }] },
);
// Every god's own hunt, main and side: the stairway under the temple opens once all of them are done.
const ALL_GOD_QUESTS = [...GODS.map(g => g.quest), ...SIDE_GODS.map(g => g.quest)];
