/* ============================== FINISH DATA ============================== */
// Numbers worked out from the tables above, for every rank.
for (const w of Object.values(WEAPONS)) w.dmg = Math.round(tierW(w.wt) * KINDS[w.kind].dmgM);

// Build the 4 pieces of every set. Piece ids look like "winged:head".
const PIECES = {};
// Boots with a power of their own. Double dash: dash twice in a row, but dashes recharge slower, and these boots
// give up the faster dodge recovery other boots have. Every rank's version of the set keeps it.
const PIECE_PERKS = { 'winged:feet': 'doubleDash', 'timeless:feet': 'doubleDash' };
for (const [sid, set] of Object.entries(ARMOR_SETS)) {
  let defLeft = set.def, hpLeft = set.hp;
  const lch = Math.min(17, set.ch - RANKS[set.rank || 0].off + 2 * (set.rank || 0));   // how good each slot's job is
  for (const slot of SLOTS) {
    const sp = SLOT_SPLIT[slot];
    const def = slot === 'feet' ? defLeft : Math.round(set.def * sp.def), hp = slot === 'legs' ? hpLeft : Math.round(set.hp * sp.hp);
    defLeft -= def; hpLeft -= hp;
    let recipe = null;
    if (set.recipe) {
      const share = { head: .25, chest: .35, legs: .25, feet: .2 }[slot], items = {};
      for (const [id, n] of Object.entries(set.recipe.items)) {
        if (ITEMS[id].rarity >= 3) { if (slot === 'head' || slot === 'chest') items[id] = Math.max(1, Math.ceil(n / 2)); }
        else items[id] = Math.max(1, Math.round(n * share * 1.25));
      }
      // a set made only of rare parts still needs some of them for its legs and boots
      if (!Object.keys(items).length) for (const [id, n] of Object.entries(set.recipe.items)) items[id] = Math.max(1, Math.floor(n / 2));
      recipe = { items, cost: Math.max(10, Math.round(set.recipe.cost * share / 10) * 10) };
    }
    const perk = PIECE_PERKS[(set.base || sid) + ':' + slot] || null;
    const job = {
      head: { kbRes: Math.min(.5, .04 * lch) },
      chest: {},
      legs: { dodgeDist: .02 * lch },
      feet: perk === 'doubleDash' ? { speed: .006 * lch } : { speed: .006 * lch, dodgeCd: .012 * lch },
    }[slot];
    PIECES[`${sid}:${slot}`] = { id: `${sid}:${slot}`, set: sid, slot, name: `${set.name} ${SLOT_LABEL[slot]}`, def, hp, job, recipe, rank: set.rank || 0, perk };
  }
}

// Gods and Titans: how many on-curve sword hits they take to bring down. The real health is worked out per rank.
for (const b of Object.values(BOSSES)) b.hits = b.hp ? b.hp / tierW(b.tier) : (54 + 2.5 * (b.tier - 1)) * (b.side ? .7 : 1) * (b.titan ? 1.8 : 1);

// Balance from the bot runs (Oct 29): a sword bot and a bow bot fought every god and Titan at each rank, and each fight's
// health lost was compared to a smooth curve (rising through the gods, Titans harder, each rank harder again, Cronus the
// hardest Titan). Where a fight was clearly off, its health and damage are nudged per rank: [Low, High, God]. Fights the
// bots found slow (evasive bosses at God Rank) lose health rather than gain damage, so none of them drags.
const BOSS_TUNE = {
  hermes: { hp: [0.92, 0.84, 0.85], dmg: [0.92, 0.84, 0.85] },
  dionysus: { hp: [0.89, 0.89, 0.87], dmg: [0.89, 0.89, 0.87] },
  pan: { hp: [1.35, 1.41, 1.31], dmg: [1.25, 1.25, 1.25] },
  athena: { hp: [1.0, 1.14, 1.0], dmg: [1.0, 1.14, 1.0] },
  aphrodite: { hp: [1.0, 0.92, 0.77], dmg: [1.0, 0.92, 0.77] },
  apollo: { hp: [1.17, 1.18, 1.09], dmg: [1.17, 1.18, 1.09] },
  hecate: { hp: [1.0, 0.72, 0.82], dmg: [1.0, 0.72, 0.82] },
  poseidon: { hp: [1.0, 1.0, 1.1], dmg: [1.0, 1.0, 1.1] },
  hera: { hp: [0.92, 1.0, 1.0], dmg: [0.92, 1.0, 1.0] },
  eris: { hp: [1.0, 0.87, 0.69], dmg: [1.0, 0.87, 0.69] },
  hephaestus: { hp: [1.29, 1.4, 1.18], dmg: [1.25, 1.25, 1.18] },
  hades: { hp: [1.1, 1.0, 1.0], dmg: [1.1, 1.0, 1.0] },
  hypnos: { hp: [0.84, 0.83, 0.85], dmg: [0.84, 0.83, 0.85] },
  hyperion: { hp: [1.0, 1.0, 0.82], dmg: [1.0, 1.0, 0.82] },
  oceanus: { hp: [1.0, 0.92, 0.77], dmg: [1.0, 0.92, 0.77] },
  mnemosyne: { hp: [1.0, 1.0, 0.57], dmg: [1.0, 1.0, 1.0] },   // her echoes replay your swings, so the bots over-rate her damage
  themis: { hp: [0.87, 1.0, 0.89], dmg: [0.87, 1.0, 0.89] },
  rhea: { hp: [1.24, 1.25, 1.14], dmg: [1.24, 1.25, 1.14] },
  cronus: { hp: [0.87, 0.88, 0.75], dmg: [0.87, 0.88, 0.75] },
};
for (const [id, t] of Object.entries(BOSS_TUNE)) if (BOSSES[id]) BOSSES[id].tune = t;

// Generated arenas: obstacles and the hidden nook come out the same every time.
for (const [id, A] of Object.entries(ARENAS)) {
  if (A.obstacles) continue;
  const R = mulberry(hashStr(id)), slots = LAYOUTS[A.layout];
  A.obstacles = slots.map(([tx, ty], i) => {
    const kind = A.kit[(i + Math.floor(R() * A.kit.length)) % A.kit.length];
    return kind === 'statue' ? ['statue', tx, ty, A.statue || 'owl'] : [kind, tx, ty];
  });
  const n = NOOKS[A.nook];
  A.secret = { ...n, chest: n.chest.slice(), hint: '' };
}

// Quests: pay, stars, which god's quest has to be beaten first, and how strong the monsters are.
{
  const bossQuest = {};
  for (const qd of QUESTS) if (qd.boss && !qd.side && !qd.titan) bossQuest[qd.rank + ':' + qd.god] = qd.id;
  const huntN = {};
  for (const qd of QUESTS) {
    // Titans sit on half tiers; their pay follows the curve between whole tiers so each one pays more than the last.
    const local = qd.tier - RANKS[qd.rank].off, ft = Math.floor(qd.tier), base = qd.titan ? lerp(huntPay(ft), huntPay(ft + 1), qd.tier - ft) : huntPay(ft);
    if (!qd.reward) qd.reward = qd.boss ? Math.round(base * (qd.titan ? 3.2 : qd.side ? 2.4 : 3) / 10) * 10 : base;
    qd.stars = clamp(Math.round(local * .55 + (qd.boss ? .6 : 0)), 1, 10);
    qd.urgent = !!qd.boss;
    // A god's own quest also needs the previous god beaten, so old saves can't skip ahead.
    const gi = GODS.findIndex(g => g.id === qd.god);
    if (qd.boss && !qd.side && !qd.titan && gi > 0) { const prev = bossQuest[qd.rank + ':' + GODS[gi - 1].id]; if (!qd.requires.includes(prev)) qd.requires.push(prev); }
    // The first Titan needs every god of that rank, side gods included.
    if (qd.titan && qd.requires.length === 0) for (const g of ALL_GOD_QUESTS) qd.requires.push(rid(g, qd.rank));
    const key = qd.rank + ':' + qd.god; huntN[key] = (huntN[key] || 0) + 1;
    // Monster strength: the first hunts of a god are a touch easier than the god's own quest.
    qd.mt = qd.boss ? qd.tier : Math.max(1, qd.tier - (huntN[key] === 1 ? .3 : .15));
  }
}
const QUEST_BY_ID = Object.fromEntries(QUESTS.map(qd => [qd.id, qd]));

// Refinement at the smith: +1 to +5 on gear you own. Each step costs drachmae and some of the parts the gear was made from;
// the last two steps also need one of its rare parts. Weapons hit harder, armor sets and shields hold more.
const REFINE_MAX = 5, REFINE_COST = [.35, .5, .7, 1, 1.4], REFINE_PARTS = [.25, .35, .5, .65, .85];
const REFINE_GAIN = { weapon: .05, armor: .06, shield: .06 };
function refineLevel(id, save = G.save) { return (save && save.refine && save.refine[id]) || 0; }
function refineDef(kind, id) { return kind === 'weapon' ? WEAPONS[id] : kind === 'shield' ? SHIELDS[id] : ARMOR_SETS[id]; }
function refineRecipe(kind, id, lv) {                      // what it takes to go from lv to lv + 1
  const def = refineDef(kind, id), rec = def.recipe, items = {};
  if (rec) for (const [it, n] of Object.entries(rec.items)) {
    if (ITEMS[it].rarity >= 3) { if (lv >= 3) items[it] = 1; }
    else items[it] = Math.max(1, Math.ceil(n * REFINE_PARTS[lv]));
  }
  const base = rec ? rec.cost : 150 * RANKS[def.rank || 0].cost;
  return { items, cost: Math.max(50, Math.round(base * REFINE_COST[lv] / 10) * 10) };
}
