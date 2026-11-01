/* ============================== WHAT'S NEW ============================== */
// Recent updates, newest first, shown from the title screen and from Options. To add an update, put a new entry at the
// top: a version, a date, and short lines under new / changed / fixed (leave out any that are empty).
const NEWS = [
  { v: '1.1', date: 'November 2026', title: 'Akros opens its doors',
    new: [
      'Walk into the buildings of Akros: the Forge, the Tavern, Melita’s Market and your home.',
      'The Tavern: take a seat or order at the counter. A meal or a drink gives you a small boost for your next hunt: more health, damage or defense, or faster dashes or skills.',
      'Your home has a chest that holds everything you bring back from your hunts.',
    ],
    changed: [
      'Dion works inside the Forge now, Phaedra runs the Tavern, and Melita has her own shop.',
      'Kleon hands out the hunts, with his notice board right beside him.',
      'Options moved to the pause menu (Esc).',
    ] },
  { v: '1.0', date: 'November 2026', title: 'The full release',
    new: [
      'The Endless Hunt: once Typhon is slain, Etna keeps sending monsters. Every wave is bigger and stronger, a god turns up every fifth wave, and each wave cleared pays. Your best wave and your last run show on the quest board.',
      'Room chat: in a room, press T (or tap Chat) to talk to everyone. H (or Hide) shrinks the room box when it’s in the way.',
      'The room’s host can kick a player from the Oracle’s room panel. A kicked player can’t rejoin that room.',
      'Anyone in a room can post a hunt now, and whoever posts it leads the party out.',
      'Gods and Titans fight smarter in a party: a mark shows who they’re after, a raised shield up close pulls them onto you, and they stop chasing someone far away while someone else hits them up close.',
      'This What’s new list.',
    ],
    changed: [
      'Online hunts need the rank and the earlier quests for them, and no gear from a higher rank.',
      'Online saves are checked by the server. A save that couldn’t come from real play isn’t stored online (it stays on your device).',
      'Shorter, clearer multiplayer messages. The room code shows in one place.',
      '“Hunter” is now “Player” in menus and messages.',
      'The progress gems are gone from the temple roofs.',
      'The Armory’s shield card has a Take off button.',
    ],
    fixed: [
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
