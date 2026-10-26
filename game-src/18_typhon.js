/* ============================== TYPHON: THE LAST HUNT ============================== */
// God Rank only. Once every god and every Titan has fallen on God Rank, Typhon, the father of monsters, climbs out from
// under Mount Etna. A hundred serpent heads on his shoulders, wings of storm, and a mountain's worth of fire.
// His fight, art and arena live in 88_typhon.js; this file only adds his data before the numbers are worked out.
const TYPHON_Q = 'gr_typhon_hunt';
{
  // his parts only drop on God Rank; the plain form only exists so the God Rank icon has something to be drawn from
  const add = (id, it) => { ITEMS[id] = { ...it, rank: 0, trophy: true }; ITEMS[rid(id, 2)] = { ...it, name: it.name + RANKS[2].item, rank: 2, base: id, trophy: true }; };
  add('typhon_scale', { name: 'Typhon Scale', rarity: 3, icon: ['plate', '#6b7a4a', '#2e3822', '#ff8a2b'], desc: 'A scale from the father of monsters. Still warm, and harder than bronze.' });
  add('storm_heart',  { name: 'Storm Heart', rarity: 4, icon: ['orb', '#ff5a3c', '#7f2618', '#ffd463'], desc: 'Typhon’s heart. It still beats like far-off thunder. A trophy for the last hunt.' });
}
Object.assign(ENEMIES, {
  typhon_head: { name: 'Serpent Head', role: 'shooter', cls: 'medium', sprite: 'typhonhead', r: 8, scale: 2, speed: 0, hpM: 3.2, dmgP: .07, kbRes: 0,
                 proj: { kind: 'typhonfire', speed: 130 }, near: 0, far: 999, cd: [1.8, 2.6], colors: ['#6b7a4a', '#45512f', '#ff5a3c'], loot: [] },
});
Object.assign(PLURALS, { typhon_head: 'Serpent Heads' });
BOSSES.typhon = { name: 'Typhon', title: 'Father of Monsters', tier: 17, titan: true, custom: true, final: true, r: 13, sprite: 'typhon', arrivalHeals: 3,
                  colors: ['#ff8a2b', '#6b7a4a', '#ffd463'], loot: [['storm_heart', 1], ['typhon_scale', 1, 3, 5]], dmgScale: 1.15 };
QUESTS.push({ id: TYPHON_Q, base: 'typhon_hunt', god: 'typhon', titan: true, final: true, rank: 2, tier: 17 + RANKS[2].off, boss: 'typhon',
  name: 'The Father of Monsters', arena: 'etna',
  requires: [...ALL_GOD_QUESTS, ...TITANS.map(t => t.quest)].map(id => rid(id, 2)),
  desc: 'Typhon broke out from under Mount Etna to finish what the Titans started. His serpent heads spit fire and he hurls the mountain itself. When the heads rise out of the ground he is shielded until you cut them all down.',
  waves: [{ earthborn: 8, colossus: 1, sky_harpy: 3 }, { river_serpent: 2, lion: 2, obsidian_guard: 2 }] });
