/* ============================== WHAT'S NEW ============================== */
// Recent updates, newest first, shown from the title screen and from Options. To add an update, put a new entry at the
// top: a version, a date, and short lines under new / changed / fixed (leave out any that are empty).
const NEWS = [
  { v: '1.1', date: 'November 2026', title: 'The Coliseum',
    new: [
      'The Coliseum now stands in Akros. With two or more players in your room, talk to Agon the Arena Master to set up a fight: a duel or teams, best of three rounds.',
      'A fight’s rank limits the gear allowed, so anyone can take part in a Normal Rank fight. Your real gear counts, but timing can beat it: a perfect block staggers your attacker, a well-timed dash slips a hit, and no one hit takes more than a fifth of your health.',
      'Weapon skills work in fights: stuns, burns, marks and knockback all land on players. Stuns are short and can’t be chained.',
      'The fight board in the Coliseum ranks players by score, with their K/D beside it. Beating a better player earns more.',
      'Practice mode: try your gear on the dummy in the Coliseum any time, no room needed.',
      'Forager’s Figs at the Tavern: 25% more drops on your next hunt. In a room, everyone gets the extra drops.',
      'Five God Rank sets have new four-piece bonuses with a real trade-off: Glass Cannon (Spartan), Momentum (Reveler), Bulwark (Hoplite), Juggernaut (Cyclops) and Steady Aim (Huntress).',
    ],
    changed: [
      'Akros is bigger, with winding roads and more trees, and the Forge now stands beside the Temple.',
      'Typhon is harder: more health, shorter rests, more serpent heads that come back sooner, and a new attack in his last phase. You also get fewer healing drops when he arrives.',
      'Bows changed: tap for quick, weak shots, or hold to draw a strong one. A bar under your health shows the draw. You walk slowly while drawing, and the lock-on doesn’t reach as far.',
      'Earthquake’s first ring of spikes now fires. It never did before.',
      'Hammers hit a little softer. Spears hit a little harder and faster.',
      'God Rank armor sits closer together, so more sets are worth wearing. Nothing got weaker.',
    ] },
  { v: '1.0', date: 'November 2026', title: 'The full release',
    new: [
      'Walk into the buildings of Akros: the Forge, the Tavern, Melita’s Market and your home.',
      'The Tavern: take a seat or order at the counter. One meal or drink per hunt gives you a small boost for it: more health, damage or defense, or faster dashes or skills.',
      'Your home has a chest that holds everything you bring back from your hunts.',
      'Play as a boy or a girl: pick in Options (Esc), under Your save. Every armor set has both looks, each save keeps its own, and the others in your room see it.',
      'The Endless Hunt: once Typhon is slain, Etna keeps sending monsters. Every wave is bigger and stronger, a god turns up every fifth wave, and each wave cleared pays. Your best wave and your last run show on the quest board.',
      'Rooms hold up to six players. With five or six, the maps are bigger, more monsters come, monsters and gods think faster, and gods switch targets sooner and drop strikes on more of the party.',
      'The host can name the room at the Oracle, and the name shows in the room list.',
      'Room chat: in a room, press T (or tap Chat) to talk to everyone. H (or Hide) shrinks the room box when it’s in the way.',
      'Dropped out of a hunt? Your game gets back in on its own within 20 seconds and carries on. If the player leading the hunt leaves or doesn’t come back, another player’s game takes it over and the hunt goes on.',
      'The room’s host can kick a player from the Oracle’s room panel. A kicked player can’t rejoin that room.',
      'Anyone in a room can post a hunt now, and whoever posts it leads the party out.',
      'Gods and Titans fight smarter in a party: a mark shows who they’re after, a raised shield up close pulls them onto you, and they stop chasing someone far away while someone else hits them up close.',
      'This What’s new list.',
    ],
    changed: [
      'Dion works inside the Forge now, Phaedra runs the Tavern, and Melita has her own shop.',
      'Kleon hands out the hunts, with his notice board right beside him.',
      'Options moved to the pause menu (Esc).',
      'Online hunts need the rank and the earlier quests for them, and no gear from a higher rank. The board and the room box now say exactly what to clear or take off.',
      'Smoother on Chromebooks and older laptops: hunts take far less work to draw, and the music is made ahead instead of note by note.',
      '“Low Rank” is now called Normal Rank.',
      'Online saves are checked by the server. A save that couldn’t come from real play isn’t stored online (it stays on your device).',
      'Shorter, clearer multiplayer messages. The room code shows in one place.',
      '“Hunter” is now “Player” in menus and messages.',
      'The progress gems are gone from the temple roofs.',
      'The Armory’s shield card has a Take off button.',
    ],
    fixed: [
      'A co-op hunt no longer freezes for everyone when the player leading it switches to another tab or window.',
      'Ground rings and warning circles now hit exactly where they’re drawn, not above or below them.',
      'Rooms with a player whose connection died (a sleeping PC) clear out, and old duplicate rooms no longer stay in the list.',
      'The room box shows again right after you leave a menu, and gear warnings update straight away.',
      'A guest’s game can’t report impossible damage to the host.',
    ] },
  { v: 'Beta 0.9', date: 'October 2026', title: 'Online co-op and the last hunt',
    new: [
      'Online co-op for up to four players. Host or join a room at the Oracle in Akros.',
      'Typhon, the father of monsters: the last hunt on God Rank, with his own gear and the credits after.',
    ],
    changed: [
      'A balance pass on the gods and Titans, from hundreds of test fights.',
    ] },
];
function renderNews() {
  const list = (head, items) => items && items.length ? `<p class="sub">${head}</p><ul class="news-list">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  return NEWS.map((n, i) => `<article class="opt news${i ? '' : ' latest'}">
    <div class="news-head"><h3>${esc(n.title)}</h3><span class="muted">${esc(n.v)} · ${esc(n.date)}</span></div>
    ${list('New', n.new)}${list('Changed', n.changed)}${list('Fixed', n.fixed)}</article>`).join('');
}
