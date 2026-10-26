/* ============================== RANK FORMS =============================== */
// High Rank and God Rank: every part, weapon, armor set, shield and hunt gets a harder form.
// Parts get a + or ++. Gear gets a new name (Dread, Godslayer), darker colours and bigger numbers.
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b), h = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return '#' + h(A[0] + (B[0] - A[0]) * t) + h(A[1] + (B[1] - A[1]) * t) + h(A[2] + (B[2] - A[2]) * t);
}
// High Rank gear turns darker and bloodier; God Rank turns night-purple with glowing trim.
const RANK_TINT = [null, { mix: '#2a0806', amt: .32, trim: '#ff5a3c' }, { mix: '#1c0a36', amt: .42, trim: '#c9a0ff' }];
function rankColor(hex, r, trim = false) {
  if (!r || !hex) return hex;
  const T = RANK_TINT[r];
  return trim ? mixHex(hex, T.trim, .7) : mixHex(hex, T.mix, T.amt);
}
function rankRecipe(rec, r) {
  if (!rec) return null;
  const items = {}; for (const [id, n] of Object.entries(rec.items)) items[rid(id, r)] = n;
  return { items, cost: Math.round(rec.cost * RANKS[r].cost / 10) * 10 };
}
// How each set bonus grows. [High Rank multiplier, God Rank multiplier, cap]. Words for special rules.
const PERK_SCALE = {
  healDrops: [1.5, 2, .2], speed: [1.4, 1.8, .2], dmg: [1.5, 2, .3], bowDmg: [1.5, 2, .3], dodgeCd: [1.4, 1.8, .3], dodgeDist: [1.4, 1.8, .5],
  abilityCd: [1.4, 1.8, .4], guard: [1.5, 2, 1], projRes: [1.5, 2, .45], lifesteal: [1.4, 1.8, .1], knock: [1.5, 2, 1],
  dodgeStrike: [1.5, 2, 1.2], berserk: [1.5, 2, .6], stunHit: [1.5, 2, .3], thorns: [1.5, 2, 1.5], godBane: [1.5, 2, .35],
  hp: 'H', regen: 'H', def: 'D', lightning: 'N', ward: 'W',
};
// High and God Rank armor sits on that rank's expected defense, plus the set's Low Rank lead over the curve grown a little
// (x1.5, x2). Multiplying the whole number instead let early sets run away: Hermes' set ended up the strongest in God Rank.
function rankDef(def, ch, r) { return Math.max(1, Math.round(tierD(ch + RANKS[r].off) + (def - tierD(ch)) * (1 + .5 * r))); }
function scalePerks(perks, r, ch) {
  if (!perks) return undefined;
  const out = {}, off = RANKS[r].off;
  for (const [k, v] of Object.entries(perks)) {
    const S = PERK_SCALE[k];
    if (!S) out[k] = v;
    else if (S === 'H') out[k] = k === 'regen' ? Math.round(v * tierH(ch + off) / tierH(ch) * 1.2 * 2) / 2 : Math.round(v * tierH(ch + off) / tierH(ch));
    else if (S === 'D') out[k] = Math.round(v * tierD(ch + off) / tierD(ch));
    else if (S === 'N') out[k] = Math.max(3, v - r);
    else if (S === 'W') out[k] = Math.max(6, v - 2 * r);
    else out[k] = Math.round(Math.min(S[2], v * S[r - 1]) * 100) / 100;
  }
  return out;
}
{
  const baseItems = Object.keys(ITEMS), baseWeapons = Object.entries(WEAPONS), baseSets = Object.entries(ARMOR_SETS);
  const baseShields = Object.entries(SHIELDS), baseQuests = QUESTS.slice();
  for (const id of baseItems) ITEMS[id].rank = 0;
  for (const [, w] of baseWeapons) w.rank = 0;
  for (const [, s] of baseSets) s.rank = 0;
  for (const [, s] of baseShields) s.rank = 0;
  for (const qd of baseQuests) { qd.rank = 0; qd.base = qd.id; }
  for (let r = 1; r < RANKS.length; r++) {
    const R = RANKS[r];
    for (const id of baseItems) { const it = ITEMS[id]; ITEMS[rid(id, r)] = { ...it, name: it.name + R.item, rank: r, base: id }; }
    for (const [id, w] of baseWeapons) {
      if (!w.recipe) continue;                                          // the starting sword has no rank forms
      WEAPONS[rid(id, r)] = { ...w, name: R.gear + w.name, wt: w.wt + R.off, ability: w.ability || KIND_SKILL[w.kind], pierce: w.pierce,
                              rank: r, base: id, recipe: rankRecipe(w.recipe, r), cdMul: 1 - .1 * r };
    }
    for (const [sid, set] of baseSets) {
      if (set.start) continue;
      const colors = {}; for (const [slot, cols] of Object.entries(set.colors)) colors[slot] = cols.map((c, i) => rankColor(c, r, i === 2));
      const four = scalePerks(set.four, r, set.ch) || {};
      if (r === 2) four.godBane = Math.round(((four.godBane || 0) + .1) * 100) / 100;
      ARMOR_SETS[rid(sid, r)] = { ...set, name: R.gear + set.name, ch: set.ch + R.off, rank: r, base: sid, colors,
        def: rankDef(set.def, set.ch, r), hp: Math.round(set.hp + tierH(set.ch + R.off) - tierH(set.ch)),
        recipe: rankRecipe(set.recipe, r), two: scalePerks(set.two, r, set.ch), four: Object.keys(four).length ? four : undefined };
    }
    for (const [id, sh] of baseShields) {
      SHIELDS[rid(id, r)] = { ...sh, name: R.gear + sh.name, ch: sh.ch + R.off, rank: r, base: id, block: Math.min(.95, sh.block + .04 * r),
                              meter: Math.round(sh.meter * (1 + .3 * r)), colors: sh.colors.map((c, i) => rankColor(c, r, i === 2)), recipe: rankRecipe(sh.recipe, r) };
    }
    for (const qd of baseQuests) {
      const waves = qd.waves.map(w => {
        const out = {};
        for (const [t, n] of Object.entries(w)) {
          const cls = ENEMIES[t].cls;
          out[t] = cls === 'heavy' ? n + R.waves[2] : Math.max(n, Math.round(n * (cls === 'fodder' ? R.waves[0] : R.waves[1])));
        }
        return out;
      });
      QUESTS.push({ ...qd, id: rid(qd.id, r), base: qd.id, rank: r, tier: qd.tier + R.off, requires: qd.requires.map(x => rid(x, r)), waves, reward: undefined });
    }
  }
}
