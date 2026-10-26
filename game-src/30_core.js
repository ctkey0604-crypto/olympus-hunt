/* ============================== AUDIO ==================================== */
const Sound = {
  ctx: null, master: null, on: true, nbuf: null,
  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.on ? .22 : 0; this.master.connect(this.ctx.destination); this.refresh();
      const len = this.ctx.sampleRate; this.nbuf = this.ctx.createBuffer(1, len, len);
      const d = this.nbuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {}); },
  // held: paused for an ad. CrazyGames can also mute the game from its own settings.
  held: false,
  hold(v) { this.held = v; if (!this.ctx) return; if (v) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {}); },
  setOn(v) { this.on = v; this.refresh(); },
  refresh() { let vol = 1; try { vol = Settings.data.sfxVol ?? 1; } catch (e) {} if (this.master) this.master.gain.value = this.on && !CG.muted ? .22 * vol : 0; try { Music.refresh(); } catch (e) {} },
  tone(freq, dur, type = 'square', vol = .3, slide = 0, delay = 0) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol = .3, freq = 1200, q = 1, type = 'bandpass', delay = 0, sweepTo = 0) {
    if (!this.ctx || !this.on || !this.nbuf) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.nbuf; f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  },
  last: {},
  play(name) {
    if (!this.ctx || !this.on || CG.muted) return;
    const now = performance.now(); if (this.last[name] && now - this.last[name] < 35) return; this.last[name] = now;
    switch (name) {
      case 'swing': this.noise(.08, .22, 2600, .8, 'highpass'); break;
      case 'heavy': this.noise(.2, .35, 500, .7, 'lowpass'); this.tone(90, .18, 'triangle', .3, .5); break;
      case 'arrow': this.noise(.07, .2, 4200, 1, 'highpass'); this.tone(500, .05, 'triangle', .1, 1.6); break;
      case 'hit': this.tone(320, .07, 'square', .16, .5); this.noise(.05, .2, 1800); break;
      case 'kill': this.noise(.25, .28, 900, .6, 'bandpass', 0, 200); this.tone(190, .2, 'square', .1, .4); break;
      case 'hurt': this.tone(170, .22, 'sawtooth', .22, .45); this.noise(.12, .25, 600); break;
      case 'heartbeat': this.tone(58, .11, 'sine', .32, .7); this.tone(52, .13, 'sine', .26, .7, .17); break;
      case 'pickup': this.tone(880, .06, 'square', .1); this.tone(1320, .08, 'square', .1, 1, .05); break;
      case 'heal': this.tone(660, .1, 'triangle', .18); this.tone(990, .14, 'triangle', .18, 1, .08); break;
      case 'dodge': this.noise(.14, .18, 3000, .6, 'bandpass', 0, 800); break;
      case 'shoot': this.tone(620, .06, 'triangle', .12, .6); break;
      case 'telegraph': this.tone(110, .25, 'square', .1, .8); break;
      case 'thud': this.noise(.3, .4, 180, .7, 'lowpass'); this.tone(60, .3, 'sine', .4, .5); break;
      case 'roar': this.tone(75, .9, 'sawtooth', .25, .6); this.noise(.9, .3, 400, .5, 'lowpass'); break;
      case 'ability': this.noise(.25, .28, 1500, .5, 'bandpass', 0, 4000); this.tone(300, .25, 'sawtooth', .12, 2); break;
      case 'zap': this.noise(.18, .3, 3000, .5, 'highpass'); this.tone(900, .15, 'sawtooth', .1, .3); break;
      case 'block': this.tone(1800, .05, 'square', .08, .8); this.tone(1200, .07, 'triangle', .08, .8, .02); break;
      case 'guard': this.tone(700, .06, 'square', .1, .7); this.noise(.08, .2, 2200, 1); break;
      case 'perfect': this.tone(1568, .12, 'square', .12); this.tone(2093, .18, 'triangle', .12, 1, .04); this.noise(.1, .2, 5000, 1, 'highpass'); break;
      case 'break': this.tone(300, .3, 'sawtooth', .2, .4); this.noise(.25, .35, 900, .6); break;
      case 'pounce': this.noise(.12, .22, 1800, .7, 'bandpass', 0, 600); this.tone(240, .1, 'square', .08, 1.5); break;
      case 'explode': this.noise(.4, .45, 600, .5, 'lowpass', 0, 120); this.tone(70, .35, 'sine', .4, .4); break;
      case 'splash': this.noise(.2, .25, 900, .8, 'bandpass', 0, 300); break;
      case 'beam': this.tone(220, .5, 'sawtooth', .1, 2); this.noise(.5, .15, 3000, .5, 'highpass'); break;
      case 'bones': this.tone(900, .04, 'square', .07, .6); this.tone(700, .04, 'square', .07, .6, .05); this.tone(500, .05, 'square', .07, .6, .1); break;
      case 'revive': this.tone(200, .3, 'triangle', .14, 2); break;
      case 'charm': [880, 1108, 1318].forEach((f, i) => this.tone(f, .12, 'triangle', .1, 1, i * .05)); break;
      case 'blessing': [392, 523, 659, 784].forEach((f, i) => this.tone(f, .3, 'triangle', .12, 1, i * .1)); break;
      case 'chest': [523, 784, 1046, 1568].forEach((f, i) => this.tone(f, .16, 'triangle', .14, 1, i * .07)); break;
      case 'talk': this.tone(520 + Math.random() * 120, .03, 'square', .04); break;
      case 'door': this.noise(.12, .2, 700, .8, 'bandpass', 0, 300); break;
      case 'wave': this.tone(220, .2, 'square', .12); this.tone(330, .3, 'square', .12, 1, .15); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .25, 'square', .1, 1, i * .12)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, .35, 'triangle', .16, 1, i * .18)); break;
      case 'click': this.tone(660, .03, 'square', .07); break;
      case 'craft': [440, 660, 880].forEach((f, i) => this.tone(f, .12, 'square', .1, 1, i * .07)); this.noise(.2, .2, 2500, 1, 'highpass', .2); break;
      case 'clink': this.tone(1500, .05, 'square', .07, .7); break;
    }
  },
};

/* ============================== CRAZYGAMES =============================== */
// Only does anything when the CrazyGames SDK is on the page (their build). Saves go to their Data
// module, they're told when gameplay starts and stops, and a midgame ad can play between hunts.
const CG = {
  sdk: null, data: null, on: false, playing: false, muted: false, lastAd: 0, adBusy: false,
  async init() {
    const S = window.CrazyGames && window.CrazyGames.SDK; if (!S) return;
    try { await S.init(); } catch (e) { return; }
    if (S.environment === 'disabled') return;
    this.sdk = S; this.on = true;
    try { if (S.data) { S.data.getItem('olympus-hunt/probe'); this.data = S.data; } } catch (e) { this.data = null; }
    try { this.applySettings(S.game.settings); S.game.addSettingsChangeListener(st => this.applySettings(st)); } catch (e) {}
  },
  applySettings(st) { this.muted = !!(st && st.muteAudio); Sound.refresh(); },
  gameplay(on) { if (!this.on || on === this.playing) return; this.playing = on; try { if (on) this.sdk.game.gameplayStart(); else this.sdk.game.gameplayStop(); } catch (e) {} },
  loading(on) { if (!this.on) return; try { if (on) this.sdk.game.loadingStart(); else this.sdk.game.loadingStop(); } catch (e) {} },
  happy() { if (!this.on) return; try { this.sdk.game.happytime(); } catch (e) {} },
  // A midgame ad, at most every 3 minutes. Sound pauses while it plays; if no ad starts within 5 seconds we carry on.
  midgameAd(then) {
    if (!this.on || this.adBusy || Date.now() - this.lastAd < 180000) { then(); return; }
    this.adBusy = true; let started = false, done = false;
    const finish = () => { if (done) return; done = true; this.adBusy = false; Sound.hold(false); then(); };
    const timer = setTimeout(() => { if (!started) finish(); }, 5000);
    try {
      this.sdk.ad.requestAd('midgame', {
        adStarted: () => { started = true; clearTimeout(timer); this.lastAd = Date.now(); Sound.hold(true); },
        adFinished: finish, adError: () => { clearTimeout(timer); finish(); },
      });
    } catch (e) { clearTimeout(timer); finish(); }
  },
};

/* ============================== INPUT ==================================== */
// Default keys. Each action can hold up to 3 keys; players can change them in Options.
// J/K/L/I comes first so laptop and Chromebook players never need the touchpad.
const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', 'Space', 'KeyZ'], dodge: ['KeyK', 'ShiftLeft', 'KeyX'], ability: ['KeyL', 'KeyR', 'KeyC'], guard: ['KeyE', 'KeyI', 'KeyQ'],
  potion1: ['Digit1'], potion2: ['Digit2'], potion3: ['Digit3'],
};
const ACTION_LABELS = { up: 'Move up', left: 'Move left', down: 'Move down', right: 'Move right', attack: 'Attack', dodge: 'Dash', ability: 'Weapon skill', guard: 'Guard / use in town',
  potion1: 'Health potion', potion2: 'Strength potion', potion3: 'Speed potion' };
// Keys that can't be bound: game shortcuts plus Chromebook/OS keys (Search, Ctrl, Alt) that trigger system shortcuts.
const RESERVED = new Set(['Escape', 'KeyP', 'KeyM', 'KeyF', 'Enter', 'NumpadEnter', 'Tab', 'CapsLock', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ContextMenu']);
const Input = {
  down: new Set(), pressed: new Set(),
  bind: JSON.parse(JSON.stringify(DEFAULT_BINDS)),
  virt: {}, virtPressed: {},
  stick: { x: 0, y: 0 },
  mouse: { x: VIEW_W / 2, y: VIEW_H / 2, held: false },
  mouseAttack: false, enter: false,
  is(a) { return this.bind[a].some(k => this.down.has(k)) || !!this.virt[a]; },
  hit(a) { return this.bind[a].some(k => this.pressed.has(k)) || !!this.virtPressed[a]; },
  endFrame() { this.pressed.clear(); this.virtPressed = {}; this.mouseAttack = false; this.enter = false; },
};
let GAME_KEYS = new Set();
function applyBinds() {
  Input.bind = JSON.parse(JSON.stringify(Settings.data.binds || DEFAULT_BINDS));
  GAME_KEYS = new Set(Object.values(Input.bind).flat());
}
function codeLabel(c) {
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', Enter: 'Enter', Backspace: 'Backspace',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`' };
  if (map[c]) return map[c];
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) return 'Num ' + c.slice(6);
  return c;
}
const kbd = c => `<kbd>${esc(codeLabel(c))}</kbd>`;
function moveKeysHTML() {
  const dirs = ['up', 'left', 'down', 'right'], n = Math.max(...dirs.map(a => Input.bind[a].length)), sets = [];
  for (let i = 0; i < n; i++) { const ks = dirs.map(a => Input.bind[a][i]); if (ks.every(Boolean)) sets.push(ks.map(kbd).join('')); }
  return sets.length ? sets.join(' or ') : dirs.map(a => Input.bind[a].map(kbd).join('')).join(' ');
}
function controlsItems() {
  const m = Settings.data.mouse, keys = a => Input.bind[a].map(kbd).join(' ');
  if (document.body.classList.contains('touch')) return [
    ['Move', 'Drag on the left side of the screen'],
    ['Attack', 'The Attack button<br>Hold it to keep swinging'],
    ['Dash', 'The Dash button'],
    ['Weapon skill', 'The Skill button'],
    ['Guard / use in town', 'The Guard button<br>Hold to block with a shield. Talk and open doors in town'],
    ['Potions', 'Tap one in the top right corner<br>Health, strength, speed'],
    ['Pause', 'The pause button in the top right'],
  ];
  return [
    ['Move', moveKeysHTML()],
    ['Attack', keys('attack') + (m ? ' or click' : '') + '<br>Hold to keep swinging'],
    ['Dash', keys('dodge') + (m ? ' or right click' : '')],
    ['Weapon skill', keys('ability')],
    ['Guard / use in town', keys('guard') + '<br>Hold to block with a shield. Talk and open doors in town'],
    ['Potions', ['potion1', 'potion2', 'potion3'].map(a => keys(a)).join(' ') + '<br>Health, strength, speed'],
    ['Pause', `${kbd('Escape')} ${kbd('KeyP')} · ${kbd('KeyF')} fullscreen · ${kbd('KeyM')} mute`],
  ];
}
function renderTitleControls() {
  $('titleControls').innerHTML = controlsItems().map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  // the hand-position tip follows whatever keys are set
  const first = a => kbd(Input.bind[a][0]), move = ['up', 'left', 'down', 'right'].map(a => kbd(Input.bind[a][0])).join('');
  $('titleTip').innerHTML = `On a Chromebook or laptop: one hand on ${move}, the other on ${first('attack')} ${first('dodge')} ${first('ability')}. No touchpad needed. You can change any key in Options.`;
}

/* ============================== SAVES ==================================== */
// Where saves go:
//  - On your own website (the Cloudflare server in src/index.js): to your account once you sign in.
//  - As a Claude artifact: to the viewer's Claude account.
//  - Always: this browser's localStorage too, so the game works offline and nothing is lost if the network drops.
const Store = {
  cloud: null, uid: null, localOk: false, ready: null, queue: {},
  api: false, user: null, token: null, remote: null, pending: {}, timers: {},
  key(n, who = this.user) { return who ? `olympus-hunt/u/${who.toLowerCase()}/slot${n}` : 'olympus-hunt/slot' + n; },
  // On CrazyGames saves live in their Data module (it works like localStorage and follows the player's account).
  ls() { return CG.data || localStorage; },
  readLocal(n, who) { try { const s = this.ls().getItem(this.key(n, who)); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  writeLocal(n, d, who) { try { this.ls().setItem(this.key(n, who), JSON.stringify(d)); return true; } catch (e) { return false; } },
  delLocal(n, who) { try { this.ls().removeItem(this.key(n, who)); } catch (e) {} },
  init() {
    this.ready = (async () => {
      await CG.init();
      try { localStorage.setItem('olympus-hunt/test', '1'); localStorage.removeItem('olympus-hunt/test'); this.localOk = true; } catch (e) { this.localOk = false; }
      if (CG.data) {
        this.localOk = true;
        // the first time, saves already in this browser move into the CrazyGames account
        try {
          if (!CG.data.getItem('olympus-hunt/migrated')) {
            for (let n = 1; n <= 3; n++) { const k = this.key(n, null), v = localStorage.getItem(k); if (v && !CG.data.getItem(k)) CG.data.setItem(k, v); }
            CG.data.setItem('olympus-hunt/migrated', '1');
          }
        } catch (e) {}
      } else if (window.claude && typeof window.claude.use === 'function') {
        try {
          const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
          if (db && user) { const id = await user.id(); if (id) { this.cloud = db; this.uid = id; } }
        } catch (e) { this.cloud = null; }
      } else if (/^https?:$/.test(location.protocol) && !/crazygames|itch\.io|itch\.zone|github\.io/.test(location.hostname)) await this.probeApi();   // only your own site has the account server
    })();
    return this.ready;
  },
  /* ---- your own server ---- */
  async call(method, path, body, keepalive = false) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch('/api/' + path, { method, keepalive, signal: ctrl.signal, cache: 'no-store',
        headers: Object.assign({ 'Content-Type': 'application/json' }, this.token ? { Authorization: 'Bearer ' + this.token } : {}),
        body: body === undefined ? undefined : JSON.stringify(body) });
      let data = null; try { data = await res.json(); } catch (e) {}
      if (res.status === 401 && this.token && path !== 'login') this.forget();
      if (!res.ok) throw new Error((data && data.error) || `The server said no (${res.status}).`);
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('The server took too long. Check your connection.');
      if (e instanceof TypeError) throw new Error('Can’t reach the server. Check your connection.');
      throw e;
    } finally { clearTimeout(t); }
  },
  async probeApi() {
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal }); clearTimeout(t);
      const d = res.ok ? await res.json() : null;
      this.api = !!(d && d.game === 'olympus-hunt');
    } catch (e) { this.api = false; }
    if (!this.api) return;
    try { this.token = localStorage.getItem('olympus-hunt/session'); this.user = localStorage.getItem('olympus-hunt/user'); } catch (e) {}
    if (this.token) { try { const me = await this.call('GET', 'me'); this.user = me.name; } catch (e) { if (!this.token) this.user = null; } }
  },
  forget() {
    for (const n in this.timers) clearTimeout(this.timers[n]);
    this.token = null; this.user = null; this.remote = null; this.pending = {}; this.timers = {};
    try { localStorage.removeItem('olympus-hunt/session'); localStorage.removeItem('olympus-hunt/user'); } catch (e) {}
  },
  // Fetch the account's three saves (used by the save list).
  async refresh() { if (!this.user) { this.remote = null; return; } try { this.remote = (await this.call('GET', 'saves')).saves || {}; } catch (e) { this.remote = null; } },
  // Sign in or create an account. Only a brand-new account takes the saves played signed out in this browser
  // (on a shared device, signing in must never pull someone else's guest saves into your account).
  async signIn(name, password, create) {
    const d = await this.call('POST', create ? 'register' : 'login', { name, password });
    this.token = d.token; this.user = d.name;
    try { localStorage.setItem('olympus-hunt/session', d.token); localStorage.setItem('olympus-hunt/user', d.name); } catch (e) {}
    await this.refresh();
    const moved = [], kept = [];
    for (let n = 1; n <= 3 && create; n++) {
      const guest = sanitize(this.readLocal(n, null)); if (!guest) continue;
      if (this.remote && !this.remote[n]) {
        try { await this.call('PUT', 'saves/' + n, { save: guest }); this.remote[n] = { save: guest, savedAt: guest.savedAt }; this.writeLocal(n, guest); this.delLocal(n, null); moved.push(n); } catch (e) { kept.push(n); }
      } else kept.push(n);
    }
    return { moved, kept };
  },
  async signOut() {
    await this.flush();
    try { await this.call('POST', 'logout'); } catch (e) {}
    for (let n = 1; n <= 3; n++) this.delLocal(n);
    this.forget();
  },
  push(n, keepalive = false) {
    clearTimeout(this.timers[n]); this.timers[n] = null;
    const data = this.pending[n]; if (!data || !this.user) return Promise.resolve();
    delete this.pending[n];
    return this.call('PUT', 'saves/' + n, { save: data }, keepalive).catch(() => { if (!this.pending[n]) this.pending[n] = data; });
  },
  flush(keepalive = false) { return Promise.all(Object.keys(this.pending).map(n => this.push(n, keepalive))); },
  /* ---- Claude artifact cloud ---- */
  ref(n) { return this.cloud.doc('data/users/' + this.uid + '/slot' + n); },
  async load(n) {
    const local = sanitize(this.readLocal(n));
    if (this.user) {
      const r = this.remote && this.remote[n];
      const c = r ? sanitize(r.save) : null;
      if (c && (!local || (c.savedAt || 0) >= (local.savedAt || 0))) { this.writeLocal(n, c); return c; }
      if (local && this.remote && (!c || (local.savedAt || 0) > (c.savedAt || 0))) { this.pending[n] = local; this.push(n); }   // offline progress goes up
      return local;
    }
    if (this.cloud) {
      try {
        const snap = await this.ref(n).get();
        if (snap.exists) {
          const body = snap.data();
          const c = body && body.save ? sanitize(JSON.parse(JSON.stringify(body.save))) : null;
          if (c && (!local || (c.savedAt || 0) >= (local.savedAt || 0))) { this.writeLocal(n, c); return c; }
        }
      } catch (e) { /* fall back to local */ }
    }
    return local;
  },
  // urgent: send right away (end of a quest, leaving the game). Otherwise changes are bundled for a few seconds.
  save(n, data, urgent = false) {
    data.savedAt = Date.now();
    this.writeLocal(n, data);
    if (this.user) {
      this.pending[n] = JSON.parse(JSON.stringify(data));
      clearTimeout(this.timers[n]);
      if (urgent) this.push(n); else this.timers[n] = setTimeout(() => this.push(n), 4000);
      return;
    }
    if (this.cloud) {
      const body = { save: JSON.parse(JSON.stringify(data)) };
      const run = async () => {
        try { await this.ref(n).set(body); }
        catch (e) {
          if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); try { await this.ref(n).set(body); } catch (e2) {} }
          else if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted' || e.code === 'capability_disabled')) { this.cloud = null; }
        }
      };
      this.queue[n] = (this.queue[n] || Promise.resolve()).then(run);
    }
  },
  async del(n) {
    this.delLocal(n); delete this.pending[n]; clearTimeout(this.timers[n]);
    if (this.user) { try { await this.call('DELETE', 'saves/' + n); if (this.remote) delete this.remote[n]; } catch (e) {} }
    else if (this.cloud) { try { await this.ref(n).delete(); } catch (e) {} }
  },
};
// Anything not yet sent goes up when the tab closes or hides.
addEventListener('pagehide', () => Store.flush(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(true); });

function newSave() {
  return { v: 3, createdAt: Date.now(), savedAt: Date.now(), playtime: 0, money: START_MONEY, inv: {},
           weapons: ['bronze_sword'], weapon: 'bronze_sword',
           pieces: SLOTS.map(s => 'traveler:' + s), equip: { head: 'traveler', chest: 'traveler', legs: 'traveler', feet: 'traveler' },
           shields: [], shield: null, potions: { health: 0, strength: 0, speed: 0 }, cleared: {}, best: {}, chests: {}, seenIntro: false, blessing: false,
           rank: 0, stairs: false, seenHall: false, tut: 0, hints: {}, finale: false, refine: {}, typhonTold: false, legend: false };
}
// Version 2 armor became full sets of four pieces.
const V2_ARMOR = { tunic: 'traveler', brigand_leathers: 'brigand', herdsman_hide: 'herdsman', winged_raiment: 'winged', hoplite_panoply: 'hoplite',
                   aegis_mantle: 'aegis', cyclops_mail: 'cyclops', olympian_regalia: 'olympian' };
// Cleans any loaded or imported save so bad data can't break the game. Older saves load fine.
function sanitize(s) {
  if (!s || typeof s !== 'object') return null;
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const arr = v => Array.isArray(v) ? v : [];
  const out = newSave();
  out.createdAt = num(s.createdAt, Date.now()); out.savedAt = num(s.savedAt, 0);
  out.playtime = Math.max(0, num(s.playtime, 0));
  out.money = Math.max(0, Math.floor(num(s.money, 0)));
  if (s.inv && typeof s.inv === 'object') for (const k of Object.keys(ITEMS)) { const v = Math.floor(num(s.inv[k], 0)); if (v > 0) out.inv[k] = Math.min(v, 9999); }
  out.weapons = ['bronze_sword', ...new Set(arr(s.weapons).filter(w => WEAPONS[w] && w !== 'bronze_sword'))];
  out.weapon = out.weapons.includes(s.weapon) ? s.weapon : 'bronze_sword';
  const pieces = new Set(out.pieces);
  arr(s.pieces).forEach(p => { if (PIECES[p]) pieces.add(p); });
  arr(s.armors).forEach(a => { const set = V2_ARMOR[a]; if (set) SLOTS.forEach(sl => pieces.add(set + ':' + sl)); });
  out.pieces = [...pieces];
  const eq = s.equip && typeof s.equip === 'object' ? s.equip : null;
  for (const sl of SLOTS) {
    let want = eq ? eq[sl] : (V2_ARMOR[s.armor] || 'traveler');
    out.equip[sl] = pieces.has(want + ':' + sl) ? want : 'traveler';
  }
  out.shields = [...new Set(arr(s.shields).filter(id => SHIELDS[id]))];
  out.shield = out.shields.includes(s.shield) ? s.shield : null;
  for (const qd of QUESTS) {
    const c = Math.floor(num(s.cleared && s.cleared[qd.id], 0)); if (c > 0) out.cleared[qd.id] = c;
    const b = num(s.best && s.best[qd.id], 0); if (b > 0) out.best[qd.id] = Math.round(b);
    if (s.chests && s.chests[qd.id] === true) out.chests[qd.id] = true;
  }
  out.seenIntro = s.seenIntro === true;
  out.rank = clamp(Math.floor(num(s.rank, 0)), 0, RANKS.length - 1);
  out.stairs = s.stairs === true; out.seenHall = s.seenHall === true;
  // first-steps tutorial: saves from before it existed skip it once they have a hunt behind them
  out.tut = typeof s.tut === 'number' ? clamp(Math.floor(s.tut), 0, 6) : Object.keys(out.cleared).length ? 6 : 0;
  out.finale = s.finale === true && !!out.cleared[TYPHON_Q];   // the old ending (before Typhon) doesn't count as the finale
  out.typhonTold = s.typhonTold === true; out.legend = s.legend === true;
  if (s.refine && typeof s.refine === 'object') for (const [k, v] of Object.entries(s.refine)) {
    const n = clamp(Math.floor(num(v, 0)), 0, REFINE_MAX); if (n > 0 && (WEAPONS[k] || ARMOR_SETS[k] || SHIELDS[k])) out.refine[k] = n;
  }
  out.hints = { skill: !!(s.hints && s.hints.skill), guard: !!(s.hints && s.hints.guard) };
  out.blessing = s.blessing === true;
  for (const id of Object.keys(POTIONS)) out.potions[id] = clamp(Math.floor(num(s.potions && s.potions[id], 0)), 0, POTION_MAX);
  return out;
}

const Settings = {
  data: { sound: true, music: true, sfxVol: 1, musicVol: 1, shake: !matchMedia('(prefers-reduced-motion: reduce)').matches, autoAim: true, mouse: true, binds: null, lastSlot: 0, tips: true },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('olympus-hunt/settings') || 'null');
      if (s && typeof s === 'object') {
        for (const k of ['sound', 'music', 'shake', 'autoAim', 'mouse']) if (typeof s[k] === 'boolean') this.data[k] = s[k];
        for (const k of ['sfxVol', 'musicVol']) if (typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 1) this.data[k] = s[k];
        if ([1, 2, 3].includes(s.lastSlot)) this.data.lastSlot = s.lastSlot;
        if (s.binds && typeof s.binds === 'object') {
          const b = {}; let ok = true;
          for (const a of Object.keys(DEFAULT_BINDS)) {
            const v = s.binds[a];
            if (v === undefined) continue;                               // older settings: filled in below
            if (!Array.isArray(v) || !v.length || !v.every(x => typeof x === 'string' && !RESERVED.has(x))) { ok = false; break; }
            b[a] = v.slice(0, 3);
          }
          if (ok) for (const a of Object.keys(DEFAULT_BINDS)) if (!b[a]) { const used = new Set(Object.values(b).flat()); b[a] = DEFAULT_BINDS[a].filter(k => !used.has(k)); if (!b[a].length) b[a] = [{ guard: 'Semicolon', potion1: 'Digit7', potion2: 'Digit8', potion3: 'Digit9' }[a] || 'Digit0']; }
          if (ok) this.data.binds = b;
        }
      }
    } catch (e) {}
    Sound.setOn(this.data.sound); applyBinds();
  },
  save() { try { localStorage.setItem('olympus-hunt/settings', JSON.stringify(this.data)); } catch (e) {} },
};

/* ============================== STATE ==================================== */
const G = {
  mode: 'title', slot: 0, save: null, paused: false, rebinding: null,
  panel: null, armoryTab: 'weapons', selQuest: null, dialog: null, oracleIdx: 0, cutscene: null,
  boardRank: null, forgeRank: null, forgeFilter: 'all', stashRank: null,
  hitstop: 0, slowmo: 1, shake: 0, flash: 0, cam: { x: 0, y: 0 }, time: 0,
};
let q = null;    // the running quest
let V = null;    // the walkable place you're in (village or temple)
let sc = null;   // whichever scene is active (q or V): particles, collision, etc.
let EID = 1;
const PLACES = {};

const cv = $('game');
let ctx = cv.getContext('2d');      // swapped for a moment while a Titan is drawn into its own buffer
ctx.imageSmoothingEnabled = false;


