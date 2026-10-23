/* ============================== FINISH DATA ============================== */
// Numbers worked out from the tables above, for every rank.
for (const w of Object.values(WEAPONS)) w.dmg = Math.round(tierW(w.wt) * KINDS[w.kind].dmgM);

// Build the 4 pieces of every set. Piece ids look like "winged:head".
const PIECES = {};
// Boots with a power of their own. Double dash: roll twice in a row, but rolls recharge slower, and these boots
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
    const local = qd.tier - RANKS[qd.rank].off, base = huntPay(Math.floor(qd.tier));
    if (!qd.reward) qd.reward = qd.boss ? Math.round(base * (qd.titan ? 3.2 : qd.side ? 2.4 : 3) / 10) * 10 : base;
    qd.stars = clamp(Math.round(local * .55 + (qd.boss ? .6 : 0)), 1, 10);
    qd.urgent = !!qd.boss && !qd.side;
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
