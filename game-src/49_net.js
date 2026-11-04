/* ============================== ONLINE CO-OP ============================= */
// Rooms live on the server (src/index.js): a Room object passes messages between the players' browsers and a Lobby
// keeps the public room list. In a hunt the host's browser runs everything. Who decides what:
//   the host:     monsters, gods and Titans, marked ground appearing, shots flying, pickups, waves, victory, revives,
//                 and monster melee hitting a guest (judged where the host last saw them)
//   each guest:   its own hunter (moving, swinging, dashing, skills, potions). It tells the host what it hit.
//                 Shots and marked ground are judged on the guest's own screen: if you dodged there, you dodged.
// Messages (JSON, small): guest -> host 'up' (20 a second): its hunter, actions, hits, claims, shots, visuals.
// host -> everyone 'down' (15 a second): changes to monsters, shots, ground marks, pickups, hunters, plus visual events.
// host -> one guest 'self': damage taken, heals, revives and effects meant only for that guest's hunter.
// A connection that drops isn't the end: the room holds your place and your game gets back in on its own (netReconnect), then
// the host sends everything once (a full snapshot). If the player running the hunt never comes back, the room names another
// player and their game takes over (netTakeOver).
const NET = { ws: null, room: null, me: 0, code: '', ping: 0, pingAt: 0, peers: {}, peerObj: {},
              rec: null, replay: false, personal: 0, townT: 0, townLast: '', upT: 0, downT: 0, seq: 0, sent: null,
              out: null, uiT: 0, pingT: 0, infoKey: '', chat: [], chatOpen: false, gone: new Set(),
              re: null, reId: 0, runner: 0, inAt: 0, frameAt: 0, downAt: 0, stall: false, stallT: 0, full: false, flowKey: '' };
const netOn = () => !!(NET.ws && NET.room);
const netHost = () => netOn() && NET.room.host === NET.room.me;
const netMember = id => NET.room && NET.room.members.find(m => m.id === id);
const netPoster = R => R.quest && R.quest.by != null ? R.quest.by : R.host;   // who posted the quest: they depart, and their game runs the hunt
const netCanPost = () => netOn() && (netHost() || NET.room.v >= 2);          // newer rooms let anyone post
let NID = 1;                                                       // ids for shots, ground marks and pickups (monsters keep EID)
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
function netSend(o) { const ws = NET.ws; if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function netRec(ev) { if (NET.rec && !NET.replay) NET.rec.push(ev); }

/* ---- joining and leaving rooms ---- */
async function netHostRoom(pub, name) {
  const d = await Store.call('POST', 'rooms', { public: !!pub, rank: G.save.rank, name: String(name || '').trim().slice(0, ROOM_NAME_MAX) });
  await netConnect(d.code, d.ticket);
}
async function netJoinRoom(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(code)) throw new Error('Room codes are 5 letters.');
  const d = await Store.call('POST', `rooms/${code}/ticket`);
  await netConnect(code, d.ticket);
}
// The host can rename the room; the name shows in the room list and at the Oracle.
const ROOM_NAME_MAX = 24;
const netName = id => { const R = NET.room, m = R && [...R.members, ...(R.away || [])].find(x => x.id === id); return m ? m.name : ''; };
const roomName = R => R.name || (netName(R.host) || 'A') + '’s room';
function netRename(name) { name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, ROOM_NAME_MAX); if (name && netHost()) netSend({ t: 'name', name }); }
// re: getting back in after a drop (netReconnect), as the player you were.
function netConnect(code, ticket, re = null) {
  if (!re) netLeave(true);
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${code}/ws?ticket=${encodeURIComponent(ticket)}${re ? '&re=' + re.id : ''}`);
    let done = false;
    const fail = msg => { if (done) return; done = true; clearTimeout(timer); try { ws.close(1000, 'left'); } catch (e) {} rej(new Error(msg)); };
    const timer = setTimeout(() => fail('The room didn’t answer. Check your connection.'), 8000);
    ws.onopen = () => {
      if (done) return; done = true; clearTimeout(timer);
      if (re && NET.re !== re) { try { ws.close(1000, 'left'); } catch (e) {} res(); return; }   // you left while it was connecting
      NET.ws = ws; NET.code = code; NET.infoKey = ''; NET.inAt = performance.now();
      if (re) { NET.re = null; NET.reId = re.id; }
      else { NET.peers = {}; NET.peerObj = {}; NET.chat = []; NET.gone.clear(); netChatRender(); }
      netSendInfo(); netPing(); res();
    };
    ws.onmessage = ev => { if (ws === NET.ws) { NET.inAt = performance.now(); netMessage(ev.data); } };
    ws.onclose = ev => { if (!done) fail('Couldn’t join that room. It may be full or closed.'); else if (ws === NET.ws) netClosed(ev); };
  });
}
function netLeave(quiet) {
  const ws = NET.ws; NET.ws = null; NET.room = null; NET.peers = {}; NET.peerObj = {}; NET.ping = 0;
  if (NET.re) clearTimeout(NET.re.timer); NET.re = null; NET.reId = 0;
  if (ws) try { ws.close(1000, 'left'); } catch (e) {}
  netChatClose();
  if (!quiet) netUi();
}
// The connection went. Kicked, or replaced by another tab: that's final. Anything else: try to get back in.
function netClosed(ev) {
  const code = ev && ev.code; NET.ws = null;
  if (NET.room && code !== 4001 && code !== 4002) netReconnect(); else netDropped(code);
}
// Out of the room for good.
function netDropped(code) {
  const had = !!NET.room; NET.ws = null; NET.room = null; NET.peers = {}; NET.peerObj = {}; NET.re = null;
  if (q && q.net) netHuntLost(q.net === 'guest' ? 'Lost the connection to the room' : null);
  if (had) toast(code === 4001 ? 'You joined that room from another tab.' : code === 4002 ? 'The host removed you from the room.' : 'You’re no longer in the room. Check your connection.');
  netChatClose(); netUi();
  if (G.mode === 'panel' && G.panel === 'oracle') renderHub();
}
// The room holds your place for 20 s. Your hunt keeps running meanwhile: you keep moving, the monsters wait for the next snapshot.
const NET_RE_MS = 20000, NET_DEAD_MS = 8000;
function netReconnect() {
  NET.peers = {}; NET.peerObj = {}; netChatClose();
  NET.re = { code: NET.code, id: NET.room.me, until: performance.now() + NET_RE_MS, timer: 0 };
  netUi(); netRetry(NET.re);
}
async function netRetry(re) {
  if (NET.re !== re) return;
  if (performance.now() > re.until) { netDropped(); return; }
  try {
    const d = await Store.call('POST', `rooms/${re.code}/ticket`);
    if (NET.re === re) await netConnect(re.code, d.ticket, re);
  } catch (e) {
    if (NET.re !== re) return;
    if (e.status >= 400 && e.status < 500 && e.status !== 429) { netDropped(); return; }   // the room closed, or it won't have you back
    re.timer = setTimeout(() => netRetry(re), 2000);
  }
}
// Back in the room. The same player, still on the hunt: carry on. Otherwise the hunt went on without you.
function netRejoined(m, old) {
  if (!q || !q.net) return;
  const me = m.members.find(x => x.id === m.me), on = m.me === old && m.phase === 'hunt' && !!me && me.hunt, runner = m.runner ?? m.host;
  if (q.net === 'host') {
    if (on && runner === m.me) netResync(); else netHuntLost('The party went on without you. Your hunt carries on here.');
    return;
  }
  if (!on) { netHuntLost('Lost the connection to the hunt'); return; }
  if (runner !== NET.runner) { netHunterLeft(netHunter(NET.runner)); NET.runner = runner; }   // someone took over while you were gone
  NET.downAt = performance.now();
}
function netPing() { if (NET.ws && NET.ws.readyState === 1) { NET.pingAt = performance.now(); NET.ws.send('p'); } }
setInterval(() => { if (NET.ws && document.hidden) netPing(); }, 10000);   // a hidden tab draws no frames: keep telling the room you're there
// What you look like and carry, so the others can draw you; sent on joining and whenever it changes.
function myGear(s = G.save) {
  const ref = {}; for (const id of [s.weapon, s.shield, ...Object.values(s.equip)]) if (id && s.refine && s.refine[id]) ref[id] = s.refine[id];
  return { look: { ...s.equip }, weapon: s.weapon, shield: s.shield || null, refine: ref, meal: s.meal || null, hero: s.hero === 'girl' ? 'girl' : 'boy' };
}
function netSendInfo() {
  if (!NET.ws || !G.save) return;
  // why: a few words on why you can't take the posted hunt, so whoever posted it can see who's held up and why
  const R = NET.room, qd = R && R.quest && R.phase === 'town' && QUEST_BY_ID[R.quest.id], why = (qd && netWhyNot(qd, true)) || null;
  const gear = myGear(), key = JSON.stringify(gear) + G.save.rank + why;
  if (key !== NET.infoKey) {
    NET.infoKey = key; netSend({ t: 'info', gear, rank: G.save.rank, why, cap: 1 });
    // changed into gear the posted quest doesn't allow: you're not ready any more
    const me = R && R.members.find(m => m.id === R.me);
    if (why && me && me.ready && R.me !== netPoster(R)) { netSend({ t: 'ready', v: false }); toast(netWhyNot(qd), 7000); }
  }
  netUi();                                                           // back in town: the room box shows again, with any gear warning up to date
}
// Online, everyone plays at the quest's rank: you need that rank, the quests before it in your own line,
// and no gear from a higher rank. Returns why you can't take it, or null.
// The pieces you have on that come from a rank above r: what to take off, by name.
function gearAbove(r, s = G.save) {
  const out = [], rk = (id, def) => Math.max(rankOf(id), (def && def.rank) || 0);
  if (s.weapon && rk(s.weapon, WEAPONS[s.weapon]) > r) out.push(WEAPONS[s.weapon].name);
  if (s.shield && rk(s.shield, SHIELDS[s.shield]) > r) out.push(SHIELDS[s.shield].name);
  for (const sl of SLOTS) { const id = s.equip[sl], P = PIECES[id + ':' + sl]; if (id && rk(id, ARMOR_SETS[id]) > r) out.push(P ? P.name : (ARMOR_SETS[id] || {}).name || id); }
  return out;
}
// Why you can't take a hunt online, in full (with what to do about it), or null. short: a few words for the others' list.
function netWhyNot(qd, short = false) {
  const s = G.save, qr = qd.rank || 0; if (!s) return null;
  if ((s.rank || 0) < qr) return short ? `needs ${RANKS[qr].name}` : `This is a ${RANKS[qr].name} hunt, and you haven’t reached ${RANKS[qr].name} yet. Hunt every god and Titan on ${RANKS[(s.rank || 0)].name}, then talk to Kleon.`;
  if (qd.titan && !s.stairs) return short ? 'hasn’t opened the Titans' : 'You haven’t opened the Titans’ hall yet. Hunt every god first; the stairway under the temple opens after that.';
  const miss = (qd.requires || []).filter(r => !s.cleared[r]);
  if (miss.length) return short ? 'hasn’t unlocked it' : `You haven’t unlocked this hunt yet. Clear ${QUEST_BY_ID[miss[0]] ? `“${QUEST_BY_ID[miss[0]].name}”` : 'the hunts before it'}${miss.length > 1 ? ` (and ${miss.length - 1} more)` : ''} on Kleon’s board first.`;
  const high = gearAbove(qr, s);
  if (high.length) return short ? 'gear too strong' : `Online, a ${RANKS[qr].name} hunt needs ${RANKS[qr].name} gear or lower. Take off: ${high.join(', ')}. Dion in the Forge can swap them.`;
  return null;
}
// Turns someone's gear message into something playerStats() and drawPlayer() can use. Anything unknown falls back to the basics.
function gearSave(g) {
  g = g || {}; const look = {};
  for (const sl of SLOTS) look[sl] = g.look && ARMOR_SETS[g.look[sl]] && PIECES[g.look[sl] + ':' + sl] ? g.look[sl] : 'traveler';
  const weapon = WEAPONS[g.weapon] ? g.weapon : 'bronze_sword', shield = g.shield && SHIELDS[g.shield] ? g.shield : null, refine = {};
  if (g.refine) for (const [k, v] of Object.entries(g.refine)) refine[k] = clamp(Math.floor(+v || 0), 0, 5);
  return { weapon, shield, equip: look, refine, potions: { health: 0, strength: 0, speed: 0 }, meal: g.meal && MEALS[g.meal] ? g.meal : null, hero: g.hero === 'girl' ? 'girl' : 'boy' };
}

/* ---- messages in ---- */
function netMessage(data) {
  if (data === 'q') { NET.ping = Math.round(performance.now() - NET.pingAt); return; }
  let m; try { m = JSON.parse(data); } catch (e) { return; }
  switch (m.t) {
    case 'room': netRoom(m); break;
    case 'town': netTownIn(m); break;
    case 'depart': netDepart(m); break;
    case 'down': if (q && q.net === 'guest') netDown(m); break;
    case 'self': if (q && q.net === 'guest') netSelf(m); break;
    case 'up': if (q && q.net === 'host') netUp(m); break;
    case 'gone': if (q && q.net === 'host') netGone(m.from); break;
    case 'away': if (q && q.net === 'host') netAway(m.id); if (q && q.net) netChatAdd({ sys: `${m.name} lost connection.` }); break;
    case 'back': if (q && q.net === 'host') netBack(m.from); break;
    case 'runner': netRunner(m); break;
    case 'hostleft': if (q && q.net === 'guest') netHuntLost('The party leader left the room'); else toast('The party leader left.'); break;
    case 'chat': netChatAdd({ from: m.from, name: m.name, text: m.text }); if (m.from !== NET.me) Sound.play('click'); break;
    case 'kick': NET.gone.add(m.id); netChatAdd({ sys: `${m.name} was removed from the room.` }); break;
  }
}
function netRoom(m) {
  const was = NET.room, reId = NET.reId, held = l => r => (l.away || []).some(a => a.id === r.id); NET.room = m; NET.me = m.me; NET.reId = 0;
  if (reId) netRejoined(m, reId);
  if (was && !reId) {                                                // who came and went, for the chat (someone whose place is held hasn't left yet)
    for (const x of m.members) if (!was.members.some(y => y.id === x.id)) { if (!held(was)(x)) netChatAdd({ sys: `${x.name} joined.` }); else if (q && q.net) netChatAdd({ sys: `${x.name} is back.` }); }
    for (const y of [...was.members, ...(was.away || [])]) if (!m.members.some(x => x.id === y.id) && !held(m)(y) && !NET.gone.delete(y.id)) netChatAdd({ sys: `${y.name} left.` });
  }
  for (const id of Object.keys(NET.peers)) if (!m.members.some(x => x.id === +id)) { delete NET.peers[id]; delete NET.peerObj[id]; }
  if (was && was.host !== m.host && m.host === m.me && !(q && q.net)) toast('You’re the host now');
  if (was && was.quest && !m.quest && m.phase === 'town' && !(q && q.net)) NET.confirm = false;
  if (G.mode === 'panel' && G.panel === 'oracle' && was && (was.members.length !== m.members.length || was.name !== m.name)) renderHub();   // the Oracle's player list
  if (!was || (was.quest && was.quest.id) !== (m.quest && m.quest.id)) netSendInfo();   // a new hunt posted: tell the others whether you can take it
  netUi();
}

/* ---- the shared town ---- */
function netTownIn(m) {
  const [place, x, y, face, mv, dash, meal, sit] = String(m.s || '').split(','), pe = NET.peers[m.from] || (NET.peers[m.from] = { x: +x, y: +y, walkT: 0 });
  Object.assign(pe, { place, tx: +x, ty: +y, face: +face, moving: mv === '1', dash: dash === '1', sit: sit === '1', at: performance.now() });
  // they started eating at the Tavern: play their meal here too (on our own clock, from the first message that says so)
  const eating = !!(meal && Object.prototype.hasOwnProperty.call(MEALS, meal));
  if (eating && !pe.mealOn && !pe.eat) pe.eat = eatState(meal);
  pe.mealOn = eating;
}
function peerHunter(id) {                                         // a hunter object to draw someone else in town
  const mem = netMember(id); if (!mem) return null;
  const key = JSON.stringify(mem.gear || {}); let o = NET.peerObj[id];
  if (!o || o.key !== key) { const s = gearSave(mem.gear); o = NET.peerObj[id] = makePlayer(s); o.save = s; o.key = key; }
  o.name = mem.name; return o;
}
function netTownTick(dt) {
  if (!netOn() || !V || !V.player) return;
  const p = V.player; NET.townT -= dt;
  const s = [V.id, Math.round(p.x), Math.round(p.y), r2(p.face), p.moving ? 1 : 0, p.dodgeT > 0 ? 1 : 0, V.eat ? V.eat.meal : '', V.seat ? 1 : 0].join(',');
  if ((s !== NET.townLast && NET.townT <= 0) || NET.townT < -1) { NET.townLast = s; NET.townT = .1; netSend({ t: 'town', s }); }
}
function netPeersTick(dt) {
  const k = Math.min(1, dt * 12);
  for (const pe of Object.values(NET.peers)) {
    if (Math.hypot(pe.tx - pe.x, pe.ty - pe.y) > 60) { pe.x = pe.tx; pe.y = pe.ty; }
    pe.x += (pe.tx - pe.x) * k; pe.y += (pe.ty - pe.y) * k; if (pe.moving) pe.walkT += dt;
    if (pe.eat) { if (pe.place !== (V && V.id) || !V.parts) pe.eat = null; else if (eatStep(pe.eat, pe, dt, false)) pe.eat = null; }
  }
}
// Everyone else standing in the same place as you, for renderVillage. Your home is your own: nobody else shows up there.
function townPeers() {
  if (!netOn() || !V || V.id === 'home') return [];
  const out = [], now = performance.now();
  for (const [id, pe] of Object.entries(NET.peers)) {
    if (pe.place !== V.id || now - pe.at > 4000) continue;
    const o = peerHunter(+id); if (!o) continue;
    Object.assign(o, { x: pe.x, y: pe.y, face: pe.face, moving: pe.moving, walkT: pe.walkT, dodgeT: pe.dash ? .1 : 0, hid: (+id) % PARTY_COLS.length, eat: pe.eat, sitting: pe.sit });
    out.push(o);
  }
  return out;
}
// Runs every animation frame: ping, the town heartbeat, the room box.
function netFrame(dt) {
  if (!NET.ws) return;
  // Nothing heard for a while, not even an answer to a ping: the connection is dead even if nobody told the browser.
  // (a long gap between frames means this tab was hidden or stuck, which says nothing about the connection)
  const now = performance.now(); if (now - NET.frameAt > 1500) NET.inAt = now; NET.frameAt = now;
  if (now - NET.inAt > NET_DEAD_MS) { const ws = NET.ws; NET.ws = null; try { ws.close(); } catch (e) {} netClosed({ code: 1006 }); return; }
  NET.pingT -= dt; if (NET.pingT <= 0) { NET.pingT = 2; netPing(); }
  if (G.mode === 'panel' && V && V.player) netTownTick(dt);
  netPeersTick(dt);
  NET.uiT -= dt; if (NET.uiT <= 0) { NET.uiT = .5; netUiPing(); }
}

/* ---- the room box (top left): tag, ping, the posted quest and its ready check ---- */
function netUi() {
  const box = $('mpBox'); if (!box) return;
  const on = (netOn() || !!NET.re) && (G.mode === 'village' || G.mode === 'quest');
  box.hidden = !on; box.classList.toggle('q', G.mode === 'quest');
  if (!on) { if (NET.chatOpen) netChatClose(); return; }
  const R = NET.room, host = netHost(), qd = R.quest && QUEST_BY_ID[R.quest.id], min = Settings.data.mpMin;
  box.classList.toggle('min', min);
  const key = k => touchMode ? '' : ` <kbd>${k}</kbd>`;
  let html = `<div class="mp-tag"><b>Multiplayer</b><span>${esc(R.code)}</span><span id="mpPing">${NET.ping ? NET.ping + ' ms' : ''}</span>`
    + (netChatOk() ? `<button type="button" data-mp="chat" class="mp-chatbtn">Chat${NET.unread ? `<i class="mp-unread">${NET.unread}</i>` : ''}${key('T')}</button>` : '')
    + `<button type="button" data-mp="min" class="mp-chatbtn" aria-label="${min ? 'Show the room box' : 'Hide the room box'}">${min ? 'Show' : 'Hide'}${key('H')}</button></div>`;
  const wait = NET.re ? 'Connection lost. Reconnecting…' : q && q.net === 'guest' && NET.stall ? `Waiting for ${esc(netName(NET.runner) || 'the party leader')}…` : '';
  if (wait) html += `<div class="mp-card mp-post"><span class="muted">${wait}</span></div>`;
  else if (G.mode === 'village') {
    if (R.phase === 'hunt') html += `<div class="mp-card"><span class="muted">The party is out on ${esc(R.quest ? R.quest.name : 'a hunt')}${R.quest ? ` (${RANKS[R.quest.rank || 0].name})` : ''}.</span></div>`;
    else if (R.quest) {
      const me = R.members.find(m => m.id === R.me), poster = netPoster(R), mine = poster === R.me, all = R.members.every(m => m.ready || m.id === poster), why = qd && netWhyNot(qd);
      const qr = R.quest.rank || 0;                      // the rank goes first, big, in its own colour: you can't miss which one it is
      html += `<div class="mp-card mp-post"><div class="mp-rank" data-rank="${qr}">${RANKS[qr].name}</div><div class="mp-q"><b>${esc(R.quest.name)}</b></div>
        <div class="mp-who">${R.members.map(m => { const ok = m.ready || m.id === poster, no = !ok && m.id !== R.me && m.why;   // ✓ ready, · not yet, ✗ can't take it (and why)
          return `<span class="${ok ? 'ok' : no ? 'no' : ''}">${ok ? '✓' : no ? '✗' : '·'} ${esc(m.name)}${m.id === R.host ? ' (host)' : ''}${no ? ` <i>${esc(m.why)}</i>` : ''}</span>`; }).join('')}</div>
        ${why && !(me && me.ready) ? `<div class="mp-warn">${esc(why)}</div>` : ''}
        ${mine ? (NET.confirm ? `<div class="mp-warn">Not everyone is ready. Leave without them?</div><div class="mp-btns"><button type="button" data-mp="go">Depart anyway</button><button type="button" data-mp="wait">Wait</button></div>`
          : `<div class="mp-btns"><button type="button" data-mp="depart" class="${all ? 'hot' : ''}">Depart${touchMode ? '' : ' <kbd>Enter</kbd>'}</button><button type="button" data-mp="cancel">Cancel</button></div>`)
          : `<div class="mp-btns">${why && !(me && me.ready) ? `<button type="button" data-mp="ready" class="no">Can’t join yet</button>`
            : `<button type="button" data-mp="ready" class="${me && me.ready ? '' : 'hot'}">${me && me.ready ? 'Ready ✓' : 'Ready up'}${touchMode ? '' : ' <kbd>Enter</kbd>'}</button>`}${host ? '<button type="button" data-mp="cancel">Cancel</button>' : ''}</div>`}
      </div>`;
    } else html += `<div class="mp-card"><span class="muted">${R.members.length > 1 ? 'Pick a hunt from Kleon’s board to post it.' : 'Waiting for players to join.'}</span></div>`;
  }
  $('mpRoom').innerHTML = html;
}
function netUiPing() { const el = $('mpPing'); if (el) el.textContent = NET.ping ? NET.ping + ' ms' : ''; }

/* ---- room chat (under the room box): T or the Chat button to type, Enter sends, Esc closes ---- */
const CHAT_MAX = 120, CHAT_KEEP = 40, CHAT_SHOW = 5, CHAT_FADE = 9000;
const netChatOk = () => netOn() && NET.room.v >= 3;                // older servers don't pass chat along
function netChatAdd(line) {
  line.at = performance.now(); NET.chat.push(line);
  if (NET.chat.length > CHAT_KEEP) NET.chat.splice(0, NET.chat.length - CHAT_KEEP);
  if (Settings.data.mpMin && !NET.chatOpen && !line.sys && line.from !== NET.me) { NET.unread = Math.min(99, (NET.unread || 0) + 1); netUi(); }   // hidden: count it on the Chat button
  netChatRender();
}
function netChatRender() {
  const log = $('mpLog'); if (!log) return;
  const now = performance.now(), lines = NET.chatOpen ? NET.chat : Settings.data.mpMin ? [] : NET.chat.slice(-CHAT_SHOW).filter(l => now - l.at < CHAT_FADE);
  log.innerHTML = lines.map(l => { const fade = NET.chatOpen ? '' : ` style="animation-delay:${Math.round(CHAT_FADE - 1500 - (now - l.at))}ms"`;   // fades over its last 1.5 s
    return l.sys ? `<p class="sys"${fade}>${esc(l.sys)}</p>` : `<p${fade}><b class="c${(l.from || 0) % 6}">${esc(l.name)}</b> ${esc(l.text)}</p>`; }).join('');
  log.hidden = !lines.length; log.classList.toggle('open', NET.chatOpen);
  if (NET.chatOpen) log.scrollTop = log.scrollHeight;
}
function netChatOpen() {
  if (!netChatOk() || G.paused) return;
  const inp = $('mpInput');
  if (!NET.chatOpen) {
    NET.chatOpen = true; Input.down.clear(); Input.stick.x = Input.stick.y = 0; Input.virt = {};
    if (NET.unread) { NET.unread = 0; netUi(); }
    $('mpForm').hidden = false; inp.value = ''; netChatRender();
  }
  inp.focus();                                                       // already open (you clicked the game): back to typing
}
function netChatClose() {
  if (!NET.chatOpen) { netChatRender(); return; }
  NET.chatOpen = false; $('mpForm').hidden = true;
  const inp = $('mpInput'); if (document.activeElement === inp) inp.blur();
  netChatRender();
}
function netChatSend() {
  const inp = $('mpInput'), text = inp.value.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (text) netSend({ t: 'chat', text });
  netChatClose();
}
setInterval(() => { if (NET.chat.length && !NET.chatOpen) netChatRender(); }, 1000);   // let old lines fade out
function netKick(id) { if (netHost() && id !== NET.me) netSend({ t: 'kick', id }); }
function netBannerAction(a) {
  if (a === 'chat') { NET.chatOpen ? netChatClose() : netChatOpen(); return; }
  if (a === 'min') { Settings.data.mpMin = !Settings.data.mpMin; Settings.save(); NET.unread = 0; netUi(); netChatRender(); return; }   // H: room box down to its tag line
  const R = NET.room; if (!R || R.phase !== 'town' || !R.quest) return;
  if (a === 'ready') { const me = R.members.find(m => m.id === R.me), qd = QUEST_BY_ID[R.quest.id], why = !(me && me.ready) && qd && netWhyNot(qd); if (why) { toast(why, 7000); return; } netSend({ t: 'ready', v: !(me && me.ready) }); Sound.play('click'); }
  else if (a === 'cancel') { NET.confirm = false; netSend({ t: 'cancel' }); Sound.play('click'); }
  else if (a === 'wait') { NET.confirm = false; netUi(); }
  else if (a === 'depart' || a === 'go') {
    const qd = QUEST_BY_ID[R.quest.id], why = qd && netWhyNot(qd); if (why) { toast(why, 7000); return; }
    const poster = netPoster(R), all = R.members.every(m => m.ready || m.id === poster);
    if (!all && a !== 'go') { NET.confirm = true; netUi(); return; }
    NET.confirm = false; G.save && persist(true); netSend({ t: 'depart' }); Sound.play('click');
  }
}
// Enter in town with nothing to talk to: ready up (guests) or depart (host).
function netEnterKey() { const R = NET.room; if (!R || !R.quest || R.phase !== 'town') return false; netBannerAction(netPoster(R) === R.me ? (NET.confirm ? 'go' : 'depart') : 'ready'); return true; }
function netPost(id) {
  const qd = QUEST_BY_ID[id], R = NET.room; if (!qd || !netCanPost()) return;
  if (R.quest && R.phase === 'town' && netPoster(R) !== R.me && !netHost()) { toast('Someone already posted a hunt. Ready up for it, or wait.'); return; }
  const why = netWhyNot(qd); if (why) { toast(why, 7000); return; }
  netSend({ t: 'post', quest: { id, name: qd.name, rank: qd.rank || 0 } });
  closePanel(); toast('Hunt posted.');
}
// The host departed: everyone who readied up starts the same hunt.
function netDepart(m) {
  const host = m.from, order = [host, ...m.ids.filter(i => i !== host)];
  const roster = order.map((id, hid) => { const mem = netMember(id) || {}; return { id, hid, name: mem.name || 'Player', gear: mem.gear || null }; });
  if (!order.includes(NET.me)) { toast('The party set off without you. They’ll be back.'); return; }
  if (q) return;
  NET.runner = host; closeDialog();
  if (NET.me === host) { G.netParty = roster; fadeTo(() => startQuest(m.quest.id)); }
  else fadeTo(() => startQuest(m.quest.id, { guest: roster }));
}

/* ---- a hunt as host ---- */
// Snapshot fields: everything a guest needs to draw a monster or a shot. Anything that's only for thinking stays home.
const NET_SKIP_E = new Set(['def', 'tgt', 'tgtT', 'tok', 'tokH', 'threat', 'lastBy', 'burnBy', 'burnAcc', 'cd', 'spdMul', 'strafe', 'kbx', 'kby', 'vx', 'vy', 'dmg', 'dm', 'dmgMul',
  'tempo', 'kbRes', 'hitDone', 'trampled', 'dashHit', 'owner', 'rhea', 'typhon', 'decoys', 'onDeath', 'combo', 'shots', 'trailD', 'dashPrev', 'dashStall', 'attacks', 'contactCd',
  'walkT', 'summonTypes', 'orbit', 'last', 'lastCount', 'fireT', 'boltT', 'headT', 'eruptT', 'skyT', 'lawT', 'hgT', 'beamCd', 'readT', 'dodges', 'stormT', '_tx', '_ty', '_b']);
const NET_SKIP_P = new Set(['hit', 'src', 'owner', 'group', 'px', 'py', 'boom', 'homing', 't', 'life', 'nid', 'fall', 'mine', 'lgone']);
const NET_SKIP_K = new Set(['vx', 'vy', 'vz', 't', 'to', 'nid', 'home']);
const netRound = (k, v) => typeof v === 'number' ? r2(v) : v && typeof v === 'object' && (v.def || v.st || v.save || v instanceof Map || v instanceof Set || typeof v === 'function') ? undefined : v;
function netSer(o, skip) {
  const r = {};
  for (const k in o) {
    if (skip.has(k)) continue;
    const v = o[k], t = typeof v;
    if (v === null || v === undefined) r[k] = null;
    else if (t === 'number') r[k] = r2(v);
    else if (t === 'string' || t === 'boolean') r[k] = v;
    else if (t === 'object' && !(v.def || v.st || v.save || v instanceof Map || v instanceof Set)) { try { r[k + '~'] = JSON.stringify(v, netRound); } catch (e) {} }
  }
  return r;
}
// Sends only what changed since the last snapshot (WebSocket messages arrive in order, so this stays in step).
function netDelta(snap, key, list, sent, ser, idOf) {
  const seen = new Set(), out = [];
  for (const o of list) {
    if (o.dead) continue;
    const id = idOf(o); seen.add(id);
    const cur = ser(o), prev = sent.get(id);
    if (!prev) { out.push([id, cur]); sent.set(id, cur); continue; }
    let d = null; for (const k in cur) if (cur[k] !== prev[k]) { (d = d || {})[k] = cur[k]; prev[k] = cur[k]; }
    if (d) out.push([id, d]);
  }
  const gone = []; for (const id of sent.keys()) if (!seen.has(id)) { gone.push(id); sent.delete(id); }
  if (out.length) snap[key] = out; if (gone.length) snap[key + 'x'] = gone;
}
// One hunter's state as a short array: where, which way, health, what it's doing (the same for snapshots and guest reports).
function netHunterState(p) {
  const F = p.fx, fx = (F.charm > 0 ? 1 : 0) | (F.confuse > 0 ? 2 : 0) | (F.sleep > 0 ? 4 : 0) | (F.str > 0 ? 8 : 0) | (F.spd > 0 ? 16 : 0) | (F.frenzy > 0 ? 32 : 0) | (F.heart > 0 ? 64 : 0) | (F.riposte > 0 ? 128 : 0) | (F.slow > 0 ? 256 : 0);
  const fl = (p.moving ? 1 : 0) | (p.dead ? 2 : 0) | (p.downed ? 4 : 0) | (p.dodgeT > 0 ? 8 : 0) | (p.dashT > 0 ? 16 : 0) | (p.guarding ? 32 : 0) | (p.invuln > 0 ? 64 : 0) | (p.left ? 128 : 0) | (p.aegisT > 0 ? 256 : 0) | (p.guardBreak > 0 ? 512 : 0);
  const s = p.swing;
  return [p.hid, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.face), Math.max(0, Math.round(p.hp)), p.st.maxHp, fl, fx, r2(p.walkT % 64), r2(p.shieldT), r2(p.flash), r2(p.bashT), r2(p.blockKick), r2(p.guardFlash), r2(p.reviveT || 0),
          s ? [r2(s.aim), r2(s.t), r2(s.windup), r2(s.active), s.side, s.fired ? 1 : 0] : 0, r1(p.dvx || 0), r1(p.dvy || 0)];
}
function netApplyHunter(p, a, now) {
  p.rep = { x: a[1], y: a[2], vx: a[3], vy: a[4], at: now };
  p.vx = a[3]; p.vy = a[4]; p.face = a[5]; p.hp = a[6];
  const fl = a[8], fx = a[9];
  p.moving = !!(fl & 1);
  if (!(p.reviveHold > performance.now())) { p.dead = !!(fl & 2); p.downed = !!(fl & 4); }
  p.dodgeT = fl & 8 ? .1 : 0; p.dashT = fl & 16 ? .1 : 0; p.guarding = !!(fl & 32); p.invuln = fl & 64 ? .1 : 0; p.left = !!(fl & 128); p.aegisT = fl & 256 ? .1 : 0; p.guardBreak = fl & 512 ? .1 : 0;
  const F = p.fx; F.charm = fx & 1 ? 1 : 0; F.confuse = fx & 2 ? 1 : 0; F.sleep = fx & 4 ? 1 : 0; F.str = fx & 8 ? 1 : 0; F.spd = fx & 16 ? 1 : 0; F.frenzy = fx & 32 ? 1 : 0; F.heart = fx & 64 ? 1 : 0; F.riposte = fx & 128 ? 1 : 0; F.slow = fx & 256 ? 1 : 0;
  p.walkT = a[10]; p.shieldT = a[11]; p.flash = a[12]; p.bashT = a[13]; p.blockKick = a[14]; p.guardFlash = a[15]; if (q && q.net === 'guest') p.reviveT = a[16];
  const s = a[17]; p.swing = s ? { aim: s[0], t: s[1], windup: s[2], active: s[3], side: s[4], fired: !!s[5] } : null;
  p.dvx = a[18] || 0; p.dvy = a[19] || 0;
}
// Smoothly follows a hunter someone else controls (a guest on the host's screen, anyone else on a guest's).
function netFollow(p, dt) {
  const R = p.rep; if (!R) return;
  const age = Math.min(.12, (performance.now() - R.at) / 1000), tx = R.x + R.vx * age, ty = R.y + R.vy * age;
  if (Math.hypot(tx - p.x, ty - p.y) > 48) { p.x = tx; p.y = ty; }
  else { const k = Math.min(1, dt * 14); p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; }
  if (p.swing) p.swing.t += dt;
  p.flash = Math.max(0, p.flash - dt);
}
function netStartHost() {
  NET.sent = { e: new Map(), p: new Map(), k: new Map(), z: new Set() }; NET.seq = 0; NET.downT = 0; NET.rec = []; NET.fwd = []; NET.flash = 0; NET.flowKey = '';
  for (const p of q.hunters) if (p.remote) { p.netQ = []; p.patch = {}; p.stats0 = { kills: 0, dealt: 0 }; }
}
// Someone missed snapshots (they, or you, dropped for a moment): the next one carries everything.
function netResync() { if (!NET.sent) return; NET.sent = { e: new Map(), p: new Map(), k: new Map(), z: new Set() }; NET.full = true; NET.downT = 0; }
function netHunter(memberId) { return q && q.hunters.find(h => h.remote === memberId || h.mirror === memberId); }
// A guest's report: where its hunter is and what it did. Hits and claims wait for the next step.
function netUp(m) {
  const p = netHunter(m.from); if (!p || p.left) return;
  if (m.h) netApplyHunter(p, m.h, performance.now());
  if (m.q) for (const a of m.q) p.netQ.push(a);
  if (m.v) { NET.replay = true; for (const ev of m.v) { netPlayEvent(ev); NET.fwd.push([p.hid, ev]); } NET.replay = false; }
}
function netHunterLeft(p) { if (p) { p.left = true; p.dead = true; p.downed = false; p.away = false; } }
function netGone(id) {
  const p = netHunter(id); if (!p) return;
  netHunterLeft(p);
  banner(`${p.name} left the hunt`, '');
}
// A guest's connection dropped. Out of the fight until it's back (monsters leave it alone), but it doesn't count as down.
function netAway(id) { const p = netHunter(id); if (p && !p.left) { netHunterLeft(p); p.away = true; } }
function netBack(id) {
  const p = netHunter(id); if (!p) return;
  if (p.away) { p.away = false; p.left = false; p.netQ = []; p.patch = {}; }
  netResync();
}
// Host, every step for each guest's hunter: follow its reports and apply what it did, in order.
// A guest's game says how hard it hit. Keep that believable: no hit over 20x its weapon, no more than 80x its weapon a second.
function netCap(p, dmg) {
  const st = p.st || {}, base = ((st.weapon && st.weapon.dmg) || 40) * (st.mul || 1), now = q.elapsed;
  dmg = Math.min(Math.max(0, +dmg || 0), base * 20);
  if (!(now - p.capT <= 1)) { p.capT = now; p.capSum = 0; }
  dmg = Math.min(dmg, Math.max(0, base * 80 - p.capSum)); p.capSum += dmg; return dmg;
}
function netRemoteStep(p, dt) {
  if (p.left) return;
  netFollow(p, dt);
  if (p.moving) p.walkT += dt;
  const Q = p.netQ.splice(0);
  for (const a of Q) {
    const k = a[0];
    if (k === 'h') { const e = q.enemies.find(x => x.id === a[1]); if (e) damageEnemy(e, netCap(p, a[2]), a[3], a[4], !!a[5], a[6] !== 0); }   // a hit: [h, id, dmg, ang, knock, unblockable, fromPlayer]
    else if (k === 'c') {                                        // something its skills did to a monster
      const e = q.enemies.find(x => x.id === a[1]); if (!e || e.dead) continue;
      if (a[2] === 'stun' && !e.boss) e.stun = Math.max(e.stun, a[3]);
      else if (a[2] === 'mark') e.markT = Math.max(e.markT || 0, a[3]);
      else if (a[2] === 'burn') { e.burnT = Math.max(e.burnT || 0, a[3]); e.burnBy = p; }
      else if (a[2] === 'kb') { e.kbx += a[3] * (e.kbRes ?? 1); e.kby += a[4] * (e.kbRes ?? 1); }
      else if (a[2] === 'move' && !e.boss && e.state !== 'spawn') e.state = 'move';
    }
    else if (k === 'ts') q.timeStop = Math.max(q.timeStop, a[1]);
    else if (k === 'act') { if (q.onPlayerAct) q.onPlayerAct(a[1], p, a[2]); }
    else if (k === 'ph') { const pr = q.projs.find(x => x.nid === a[1]); if (pr && pr.team === 'enemy') killProj(pr); }   // a shot hit it on its screen
    else if (k === 'rf') { const pr = q.projs.find(x => x.nid === a[1]); if (pr && pr.team === 'enemy') reflectProj(pr, p); }
    else if (k === 'pj') {                                       // one of its shots, for everyone else to see (it does no damage here)
      spawnProj(a[1], a[2], Math.atan2(a[4], a[3]), Math.hypot(a[3], a[4]), 0, a[5], 'player', { r: a[6], life: a[7], owner: p, pierce: clamp(Math.floor(+a[8] || 0), 0, 20) });
      const pr = q.projs[q.projs.length - 1]; pr.vis = true; pr.oh = p.hid;
    }
  }
}
// Things the host's game did to a guest's hunter go to that guest: damage, heals, effects, revives.
function netTo(p, k, v) { const P = p.patch || (p.patch = {}); if (k === 'hurt') (P.hurt = P.hurt || []).push(v); else if (k === 'heal') P.heal = (P.heal || 0) + v; else P[k] = v; }
function netHurtRemote(p, dmg, ang, knock, o) {
  const f = (o.proj ? 1 : 0) | (o.unblockable ? 2 : 0) | (o.melee ? 4 : 0);
  netTo(p, 'hurt', [Math.round(dmg), r2(ang), Math.round(knock), f, o.src && o.src.id ? o.src.id : 0]);
}
// After each host step: send what changed. Snapshots go out 15 times a second.
function netHostTick(dt) {
  if (!q || q.net !== 'host') return;
  for (const f of q.fx) if (!f._n) { f._n = 1; netRec(['f', netFxOut(f)]); }
  if (G.flash > NET.flash + .02) netRec(['l', r2(G.flash)]); NET.flash = G.flash;
  // remote hunters: effects the game put on them here (charm, frenzy...) go to their owner
  for (const p of q.hunters) {
    if (!p.remote || p.left) continue;
    const F = p.fx, out = {};
    for (const k of ['charm', 'confuse', 'killRush', 'sleep', 'slow']) if (F[k] > (p.fxRep ? p.fxRep[k] || 0 : 0) + .05) out[k] = r2(F[k]);
    if (out.charm && p.charmFrom) out.from = p.charmFrom.id || 0;
    if (Object.keys(out).length) netTo(p, 'fx', out);
    p.fxRep = { ...F };
  }
  // everyone down (some of them on other screens): the hunt is lost
  if (q.phase !== 'victory' && q.phase !== 'defeat' && q.hunters.every(h => h.dead && !h.away)) playerDie(q.player);
  NET.downT -= dt; if (NET.downT > 0) return; NET.downT = 1 / 15;
  const snap = { t: 'down', s: ++NET.seq, g: netGlobals(), h: q.hunters.map(netHunterState) };
  if (NET.full) { snap.f = 1; NET.full = false; }
  netDelta(snap, 'e', q.enemies, NET.sent.e, e => netSer(e, NET_SKIP_E), e => e.id);
  netDelta(snap, 'p', q.projs, NET.sent.p, pr => netSer(pr, NET_SKIP_P), pr => pr.nid || (pr.nid = NID++));
  netDelta(snap, 'k', q.pickups, NET.sent.k, k => netSer(k, NET_SKIP_K), k => k.nid || (k.nid = NID++));
  const zs = [], zid = new Set();                               // ground marks: sent once when they appear, then only their removal
  for (const h of q.hazards) { const id = h.nid || (h.nid = NID++); zid.add(id); if (!NET.sent.z.has(id)) { NET.sent.z.add(id); zs.push([id, netSer(h, new Set(['nid', 'then', 'hits']))]); } }
  const zx = []; for (const id of NET.sent.z) if (!zid.has(id)) { zx.push(id); NET.sent.z.delete(id); }
  if (zs.length) snap.z = zs; if (zx.length) snap.zx = zx;
  const ev = NET.rec.splice(0).map(e => [0, e]).concat(NET.fwd.splice(0));
  if (ev.length) snap.v = ev;
  netSend(snap);
  for (const p of q.hunters) {
    if (!p.remote || p.left) continue;
    const P = p.patch || {}, kl = p.stats.kills - p.stats0.kills, dl = Math.round(p.stats.dealt - p.stats0.dealt);
    if (kl) P.kl = kl; if (dl) P.dl = dl; p.stats0 = { kills: p.stats.kills, dealt: p.stats.dealt };
    if (Object.keys(P).length) { P.t = 'self'; netSend({ t: 'to', id: p.remote, m: P }); }
    p.patch = {};
  }
}
function netGlobals() {
  const g = { ph: q.phase, w: q.waveIdx, el: r1(q.elapsed), ts: r2(q.timeStop), et: r2(q.endT), b: q.boss && !q.boss.dead ? q.boss.id : 0, ch: q.chest && q.chest.open ? 1 : 0 };
  if (q.current) g.cu = [r2(q.current.a), r1(q.current.s), q.current.next === null ? null : r2(q.current.next), r2(q.current.t)];
  if (q.gale) g.ga = [r2(q.gale.t), r1(q.gale.s), r2(q.gale.a)];
  if (q.ghosts && q.ghosts.length) g.gh = q.ghosts.map(gh => [r1(gh.x), r1(gh.y), r2(gh.face), r2(gh.clock), (gh.who || q.player).hid]);
  if (q.def.endless) g.en = [q.endCleared || 0, q.endPay || 0];   // the Endless Hunt: waves cleared and pay so far
  // what's coming next, so another player's game can take over: sent when it changes
  g.tm = [r2(q.timer), r2(q.spawnT), q.nextIsBoss ? 1 : 0];
  const fw = { p: q.pending.map(a => a.type) };
  if (q.def.endless) fw.e = [q.endMt || 0, q.endBudget || 0, q.endTempo || 1, q.endBossNext ? 1 : 0, q.endBag || null];
  const fk = JSON.stringify(fw); if (fk !== NET.flowKey || NET.full) { NET.flowKey = fk; g.fw = fw; }
  return g;
}
// Effects (rings, slashes, after-images...) as plain data. Hero after-images carry the armor they show.
function netFxOut(f) { const o = {}; for (const k in f) { if (k === 'frames' || k === '_n') continue; const v = f[k]; o[k] = typeof v === 'number' ? r2(v) : v; } return o; }
function netFxIn(o) { if (o.look) o.frames = heroFrames(o.look); o._n = 1; return o; }
// Plays one visual event from someone else's game: particles, damage numbers, sounds, banners, music, shakes.
function netPlayEvent(ev) {
  const k = ev[0];
  if (k === 'b') burst(ev[1], ev[2], ev[3], ev[4], ev[5]);
  else if (k === 'd') dust(ev[1], ev[2], ev[3]);
  else if (k === 't') addText(ev[1], ev[2], ev[3], ev[4]);
  else if (k === 's') hitSparks(ev[1], ev[2], ev[3], !!ev[4]);
  else if (k === 'f') q.fx.push(netFxIn(ev[1]));
  else if (k === 'a') Sound.play(ev[1]);
  else if (k === 'n') banner(ev[1], ev[2], !!ev[3]);
  else if (k === 'k') addShake(ev[1]);
  else if (k === 'l') G.flash = Math.max(G.flash, ev[1]);
  else if (k === 'm') { if (Music[ev[1]]) Music[ev[1]](...ev[2]); }
  else if (k === 'L') { if (q && q.net === 'guest') { q.loot[ev[1]] = (q.loot[ev[1]] || 0) + 1; feed(ev[1]); } }
  else if (k === 'C') { if (q && q.net === 'guest' && !q.chestFound) { q.chestFound = true; q.chestMoney += chestReward(q.def, !G.save.chests[q.def.id]).money; } }
  else if (k === 'Q') { if (q && q.net === 'guest' && q.phase !== 'victory' && q.phase !== 'defeat') netHuntLost('The host ended the hunt'); }
}
// The host's hunt ended (results): tell the room, so everyone's back in town.
function netHostEnd(win) {
  if (!q || q.net !== 'host') return;
  netRec(['Q', win ? 1 : 0]); NET.downT = 0; netHostTick(0);
  netSend({ t: 'end' }); NET.rec = null; NET.sent = null;
}

/* ---- a hunt as guest ---- */
function netStartGuest() {
  NET.out = { q: [], v: [] }; NET.upT = 0; NET.rec = []; NET.lastSeq = 0; NET.skipP = new Set(); NET.downAt = performance.now(); NET.stall = false; NET.stallT = 0;
  q.onPlayerAct = (k, p, aim) => { if (p === q.player) NET.out.q.push(['act', k, r2(p.swing ? p.swing.aim : p.face)]); };
}
// A hit your hunter landed: the host applies it (blocks, marks, the real number). You see the flash right away.
function netGuestHit(e, dmg, ang, knock, ub, fp) {
  if (e.dead || e.state === 'spawn' || e.hidden || e.air) return false;
  if (e.boss && e.invuln > 0) { burst(e.x, e.y - 10, 3, ['#ebc152'], 50); Sound.play('clink'); return false; }
  NET.out.q.push(['h', e.id, Math.round(dmg * 10) / 10, r2(ang), Math.round(knock), ub ? 1 : 0, fp ? 1 : 0]);
  e.flash = .12;
  return true;
}
// A snapshot from the host.
function netDown(m) {
  const now = performance.now(), mine = q.player.hid;
  NET.downAt = now;
  if (m.g) netGlobalsIn(m.g);
  if (m.h) for (const a of m.h) { if (a[0] === mine) continue; const p = q.hunters[a[0]]; if (p) netApplyHunter(p, a, now); }
  netMirror(m.e, m.ex, q.enemies, (id, d) => {
    const def = d.boss ? BOSSES[d.type] : ENEMIES[d.type]; if (!def) return null;
    const e = { def, kbx: 0, kby: 0, vx: 0, vy: 0, walkT: 0, mirror: true }; return e;
  }, true);
  // (your own shots are already flying here, so the host's copies of them are left out, now and in later snapshots)
  netMirror(m.p, m.px, q.projs, (id, d) => d.kind ? { mirror: true, hit: new Set(), t: 0, life: 9 } : null, false, pr => pr.oh === mine && pr.team === 'player', NET.skipP);
  netMirror(m.k, m.kx, q.pickups, (id, d) => d.item ? { mirror: true, vx: 0, vy: 0, vz: 0, t: 1 } : null);
  if (m.z) for (const [id, d] of m.z) { if (m.f && q.hazards.some(h => h.nid === id)) continue; const h = netApplyFields({ nid: id, mirror: true }, d); if (h.type === 'ring' || h.type === 'circle' || h.type === 'puddle' || h.type === 'whirl' || h.type === 'lane') q.hazards.push(h); }
  if (m.zx) { const gone = new Set(m.zx); q.hazards = q.hazards.filter(h => !gone.has(h.nid)); }
  if (m.f) netPrune(m);
  if (m.v) { NET.replay = true; for (const [o, ev] of m.v) if (o !== mine) netPlayEvent(ev); NET.replay = false; }
}
// A full snapshot lists everything there is, so anything it doesn't list ended while the snapshots weren't reaching you.
function netPrune(m) {
  const ids = l => new Set((l || []).map(a => a[0])), E = ids(m.e), P = ids(m.p), K = ids(m.k), Z = ids(m.z);
  q.enemies = q.enemies.filter(e => E.has(e.id));
  q.projs = q.projs.filter(pr => pr.mine || P.has(pr.nid));
  q.pickups = q.pickups.filter(k => K.has(k.nid));
  q.hazards = q.hazards.filter(h => Z.has(h.nid));
  for (const id of NET.skipP) if (!P.has(id)) NET.skipP.delete(id);
  if (q.boss && !E.has(q.boss.id)) { q.boss = null; $('bossBar').hidden = true; }
}
function netApplyFields(o, d) {
  for (const k in d) { if (k.endsWith('~')) { try { o[k.slice(0, -1)] = JSON.parse(d[k]); } catch (e) {} } else o[k] = d[k]; }
  return o;
}
// Keeps a local list in step with the host's: new ones made, changed fields copied, gone ones removed.
// Monsters and pickups glide to their new spot; shots carry on in a straight line between snapshots.
// skipped: ids left out on purpose. Later snapshots only carry what changed (a new spot), so without it they would come
// back as half-made copies (a shot with no kind or speed, drawn as a blinking dot).
function netMirror(list, gone, arr, make, smooth = false, skipNew = null, skipped = null) {
  if (list) for (const [id, d] of list) {
    if (skipped && skipped.has(id)) continue;
    const key = arr === q.enemies ? 'id' : 'nid';
    let o = arr.find(x => x[key] === id);
    if (!o) {
      o = make(id, d); if (!o) continue;
      o[key] = id; netApplyFields(o, d);
      if (skipNew && skipNew(o)) { if (skipped) skipped.add(id); continue; }
      arr.push(o);
      if (arr === q.enemies && o.boss) netBossIn(o);
      continue;
    }
    const x0 = o.x, y0 = o.y; netApplyFields(o, d);
    if (smooth && d.x !== undefined || smooth && d.y !== undefined) { o._tx = o.x; o._ty = o.y; o.x = x0; o.y = y0; if (Math.hypot(o._tx - x0, o._ty - y0) > 60) { o.x = o._tx; o.y = o._ty; } }
  }
  if (gone) {
    const g = new Set(gone), key = arr === q.enemies ? 'id' : 'nid';
    for (const o of arr) if (g.has(o[key])) o.netGone = true;
    const keep = arr.filter(o => !o.netGone || o.mine);
    arr.length = 0; arr.push(...keep);
    if (skipped) for (const id of g) skipped.delete(id);
  }
}
function netBossIn(b) {
  q.boss = b; b.def = BOSSES[b.type];
  $('bossName').textContent = b.def.name; $('bossTitle').textContent = b.def.title; $('bossBar').hidden = false;
  $('bossBar').classList.toggle('titan', !!b.def.titan); $('bossBar').dataset.rank = q.def.rank;
}
function netGlobalsIn(g) {
  const was = q.phase;
  q.phase = g.ph; q.waveIdx = g.w; q.elapsed = g.el; q.timeStop = g.ts;
  if ((g.ph === 'victory' || g.ph === 'defeat') && was !== g.ph) { q.endT = g.et; q.hazards = []; }
  if (g.ph === 'defeat' && was !== 'defeat') { G.slowmo = .35; if (!q.player.dead) q.player.dead = true; }
  if (g.ph === 'victory' && was !== 'victory') { G.slowmo = .25; for (const h of [q.player]) h.fx.charm = h.fx.confuse = h.fx.sleep = 0; }
  if (q.chest && g.ch) q.chest.open = true;
  q.current = g.cu ? { a: g.cu[0], s: g.cu[1], next: g.cu[2], t: g.cu[3] } : null;
  q.gale = g.ga ? { t: g.ga[0], s: g.ga[1], a: g.ga[2] } : null;
  q.ghosts = (g.gh || []).map(a => ({ x: a[0], y: a[1], face: a[2], clock: a[3], who: q.hunters[a[4]] || q.player }));
  if (g.b && (!q.boss || q.boss.id !== g.b)) { const b = q.enemies.find(e => e.id === g.b); if (b) netBossIn(b); }
  if (g.en) { q.endCleared = g.en[0]; q.endPay = g.en[1]; if (!g.b && q.boss) { q.boss = null; $('bossBar').hidden = true; } }   // a god down mid-run
  if (g.tm) { q.timer = g.tm[0]; q.spawnT = g.tm[1]; q.nextIsBoss = !!g.tm[2]; }
  if (g.fw) { q.pending = g.fw.p.map(type => ({ type })); if (g.fw.e) { [q.endMt, q.endBudget, q.endTempo] = g.fw.e; q.endBossNext = !!g.fw.e[3]; q.endBag = g.fw.e[4]; } }
}
// Messages meant only for your hunter: damage the host judged, heals, effects, a revive, a pull.
function netSelf(m) {
  const p = q.player;
  if (m.hurt) for (const [dmg, ang, knock, f, src] of m.hurt) hurtHunter(p, dmg, ang, knock, { proj: !!(f & 1), unblockable: !!(f & 2), melee: !!(f & 4), src: src ? q.enemies.find(e => e.id === src) : null });
  if (m.heal) healHunter(p, m.heal);
  if (m.fx) { for (const k of ['charm', 'confuse', 'killRush', 'sleep', 'slow']) if (m.fx[k]) p.fx[k] = Math.max(p.fx[k], m.fx[k]); if (m.fx.from) p.charmFrom = q.enemies.find(e => e.id === m.fx.from) || p.charmFrom; }
  if (m.rev && p.downed) reviveHunter(p);
  if (m.rc && !p.dead) { q.fx.push({ t: 'after', frames: heroFrames(p.look), look: p.look, flip: Math.cos(p.face) < 0, x: p.x, y: p.y, life: .4, max: .4 }); p.x = m.rc[0]; p.y = m.rc[1]; p.dodgeT = 0; p.dashT = 0; G.flash = .15; }
  if (m.kl) p.stats.kills += m.kl;
  if (m.dl) p.stats.dealt += m.dl;
}
// What your skills did to monsters besides damage (stuns, marks, burns, shoves) goes to the host as claims.
const CLAIM_KEYS = [['stun', 'stun'], ['markT', 'mark'], ['burnT', 'burn']];
function netClaimsBefore() { for (const e of q.enemies) e._b = [e.stun || 0, e.markT || 0, e.burnT || 0, e.state]; NET.ts0 = q.timeStop; }
function netClaimsAfter() {
  for (const e of q.enemies) {
    const b = e._b; if (!b) continue;
    CLAIM_KEYS.forEach(([f, n], i) => { if ((e[f] || 0) > b[i] + .01) NET.out.q.push(['c', e.id, n, r2(e[f])]); });
    if (e.kbx || e.kby) { NET.out.q.push(['c', e.id, 'kb', r1(e.kbx), r1(e.kby)]); e.kbx = e.kby = 0; }
    if (e.state !== b[3] && e.state === 'move') { NET.out.q.push(['c', e.id, 'move']); e.state = b[3]; }
  }
  if (q.timeStop > NET.ts0 + .01) NET.out.q.push(['ts', r2(q.timeStop)]);
}
// Shots on a guest's screen: yours fly and hit for real (hits go to the host); the host's carry on in a straight line
// and are checked against your hunter here (if you dodged on your screen, you dodged).
function guestProjs(dt) {
  const mine = [], others = [];
  for (const pr of q.projs) (pr.mine ? mine : others).push(pr);
  q.projs = mine; updateProjs(dt); const mineAfter = q.projs;
  const p = q.player;
  for (const pr of others) {
    if (pr.lgone) continue;
    if (pr.delay > 0) { pr.delay -= dt; pr.t += dt; continue; }
    pr.t += dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.team !== 'enemy' || p.dead || (q.timeStop > 0)) continue;
    const d = Math.hypot(pr.x - p.x, pr.y - p.y);
    if (p.aegisT > 0 && d < pr.r + p.r + 9) { NET.out.q.push(['rf', pr.nid]); pr.lgone = true; Sound.play('block'); continue; }
    if (d < pr.r + p.r + 1) {
      const r = hurtHunter(p, pr.dmg, Math.atan2(pr.vy, pr.vx), pr.knock, { proj: pr.kind !== 'goat' && pr.kind !== 'wave', projObj: null, src: pr.si ? q.enemies.find(e => e.id === pr.si) : null, unblockable: pr.kind === 'globe' });
      if (r === 1 && pr.charm) { p.fx.charm = pr.charm; p.charmFrom = (pr.si && q.enemies.find(e => e.id === pr.si)) || { x: pr.x - pr.vx, y: pr.y - pr.vy }; Sound.play('charm'); }
      if (r && pr.kind !== 'goat' && pr.kind !== 'wave' && pr.kind !== 'globe' && pr.kind !== 'sickle' && pr.kind !== 'godweapon') { pr.lgone = true; NET.out.q.push(['ph', pr.nid]); }
    }
  }
  q.projs = others.filter(pr => !pr.lgone).concat(mineAfter);
}
// Your hunter's own new shots also go to the host, so everyone else sees them.
function netOwnShot(pr) { pr.mine = true; NET.out.q.push(['pj', r1(pr.x), r1(pr.y), r1(pr.vx), r1(pr.vy), pr.kind, pr.r, r2(pr.life), pr.pierce || 0]); }
// One guest step: your hunter runs for real, everything else follows the host.
function guestTick(dt) {
  G.time += dt; if (G.save) G.save.playtime += dt;
  G.flash = Math.max(0, G.flash - dt); G.hitstop = Math.max(0, G.hitstop - dt);
  const p = q.player, done = q.phase === 'victory' || q.phase === 'defeat';
  if (!done) {
    netClaimsBefore();
    p.in = G.botLocal ? botThink(p, dt) : localInput();
    q.actor = p; NET.rec = NET.out.v; updateHunter(p, dt); q.actor = null;
    guestProjs(dt); updatePSpikes(dt);
    NET.rec = null;
    netClaimsAfter();
    updateHazards(dt);                                            // ground marks: timers run here, damage judged on your hunter
    if (q.current && q.boss && q.boss.type === 'oceanus' && !p.dead && p.dodgeT <= 0 && p.dashT <= 0 && q.phase === 'boss') moveEntity(p, Math.cos(q.current.a) * q.current.s * dt, Math.sin(q.current.a) * q.current.s * dt);
    if (q.gale && q.boss && !p.dead && p.dodgeT <= 0 && p.dashT <= 0) { const a = Math.atan2(p.y - q.boss.y, p.x - q.boss.x); moveEntity(p, Math.cos(a) * q.gale.s * dt, Math.sin(a) * q.gale.s * dt); }
    const low = !p.dead && p.hp / p.st.maxHp < .3;
    if (low) { q.beatT = (q.beatT ?? 0) - dt; if (q.beatT <= 0) { q.beatT = .9; Sound.play('heartbeat'); } } else q.beatT = 0;
  }
  // everyone else glides toward where the host last saw them
  const k = Math.min(1, dt * 15);
  for (const e of q.enemies) {
    if (e._tx !== undefined) { const ox = e.x; e.x += (e._tx - e.x) * k; e.y += (e._ty - e.y) * k; if (Math.abs(e.x - ox) > .05) e.walkT += dt; }
    e.st = (e.st || 0) - dt; e.flash = Math.max(0, (e.flash || 0) - dt);
  }
  for (const h of q.hunters) if (h !== p) { netFollow(h, dt); if (h.moving) h.walkT += dt; }
  for (const k2 of q.pickups) if (k2._tx !== undefined) { k2.x += (k2._tx - k2.x) * k; k2.y += (k2._ty - k2.y) * k; }
  tickParticles(dt);
  if (done) { q.endT -= dt; if (q.endT <= 0) { finishQuest(q.phase === 'victory'); return; } }
  followCam(p, dt);
  G.shake = Math.max(0, G.shake - dt * 18);
  // no snapshots for a while: say so here, and ask the room whether the player running the hunt is still there
  const late = !done && !NET.re && performance.now() - NET.downAt > 4000;
  if (late !== NET.stall) { NET.stall = late; netUi(); }
  if (late && (NET.stallT -= dt) <= 0) { NET.stallT = 4; netSend({ t: 'stall' }); }
  NET.upT -= dt;
  if (NET.upT <= 0) {
    NET.upT = 1 / 20;
    const O = NET.out, m = { t: 'up', h: netHunterState(p) };
    if (O.q.length) m.q = O.q.splice(0);
    if (O.v.length) m.v = O.v.splice(0).slice(-60);
    for (const f of q.fx) if (!f._n) { f._n = 1; (m.v = m.v || []).push(['f', netFxOut(f)]); }
    netSend(m);
  }
  Input.endFrame();
}
// The player running the hunt didn't come back, so the room named who runs it now.
function netRunner(m) {
  NET.runner = m.id; NET.downAt = performance.now();
  if (!q || q.net !== 'guest') return;
  netHunterLeft(netHunter(m.old));
  if (m.id === NET.me) netTakeOver(); else netChatAdd({ sys: `${netName(m.id) || 'Another player'}’s game runs the hunt now.` });
}
// Your game takes over the hunt. Monsters and gods were only copies here, so each is made properly and given everything the
// snapshots said. What was never sent (shots in the air, who a monster was after) starts fresh; shots from the old host are gone.
function netTakeOver() {
  const bossId = q.boss && q.boss.id, skip = new Set([...NET_SKIP_E, 'def', 'mirror', 'netGone']);
  q.enemies = q.enemies.filter(e => !e.dead).map(m => {
    const e = m.boss ? makeBoss(m.type, m.x, m.y, m.rank) : makeEnemy(m.type, m.x, m.y, m.tier, m.rank);
    for (const k in m) if (!skip.has(k) && m[k] !== undefined) e[k] = m[k];
    if (m._tx !== undefined) { e.x = m._tx; e.y = m._ty; }
    e.trampled = new Set(); e.trailD = 0;
    if (q.endTempo && !e.boss) e.tempo *= q.endTempo;
    return e;
  });
  const b = q.boss = q.enemies.find(e => e.id === bossId) || null;
  q.onPlayerAct = null; q.ghosts = [];
  if (b) {
    if (b.state === 'summon') { b.state = 'idle'; b.st = .6; }        // the list of who it was calling wasn't sent
    b.tossOut = false; b.fireT = 0; b.boltT = .3; b.beamCd = 0;
    if (q.def.endless && q.endMt) { const f = Math.max(1, rawDmg(1, q.endMt) / rawDmg(1, b.tier)); b.dm *= f; b.dmgMul *= f; }
    if (b.def.titan) q.onPlayerAct = (k, h, aim) => { if (q.boss && !q.boss.dead) titanAct(q.boss, k, h, aim); };
    if (b.type === 'rhea') b.decoys = q.enemies.filter(e => e.type === 'bundle');
  }
  for (const e of q.enemies) {                                        // what links them to their god doesn't travel
    if (e.type === 'bundle' && b) { e.rhea = b; e.onDeath = rheaBundleBroken; e.dmg = tD(b, .18); }
    if (e.type === 'typhon_head') { e.typhon = b; e.onDeath = typhonHeadDown; }
  }
  q.projs = q.projs.filter(pr => pr.mine);
  for (const l of [q.pickups, q.hazards]) for (const o of l) delete o.mirror;
  for (const e of q.enemies) EID = Math.max(EID, e.id + 1);
  for (const o of [...q.pickups, ...q.hazards, ...q.projs]) if (o.nid) NID = Math.max(NID, o.nid + 1);
  for (const id of NET.skipP || []) NID = Math.max(NID, id + 1);
  for (const h of q.hunters) if (h.mirror) { h.remote = h.mirror; delete h.mirror; }
  q.net = 'host'; NET.stall = false; NET.out = null;
  netStartHost(); netResync();
  netUi(); netChatAdd({ sys: 'Your game runs the hunt now.' });
}
// The hunt can't go on: the host left, or you lost the connection. You keep what you picked up.
function netHuntLost(why) {
  if (!q || !q.net) return;
  if (q.net === 'host') {                                        // the host carries on alone
    for (const h of q.hunters) if (h.remote) { h.left = true; h.dead = true; h.downed = false; }
    q.net = null; NET.rec = null; if (why) toast(why);
    return;
  }
  if (why) toast(why);
  finishQuest(false);
}
// Sound and music on the host also play on the guests' screens.
{
  const sp = Sound.play.bind(Sound);
  Sound.play = name => { if (NET.rec && !NET.replay && q && q.net && G.mode === 'quest') NET.rec.push(['a', name]); return sp(name); };
  for (const k of ['play', 'level', 'sting']) { const f = Music[k].bind(Music); Music[k] = (...a) => { if (NET.rec && !NET.replay && q && q.net === 'host') NET.rec.push(['m', k, a]); return f(...a); }; }
}
