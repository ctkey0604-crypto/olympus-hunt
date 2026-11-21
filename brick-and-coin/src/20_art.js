'use strict';
/* ============================================================================
   ART — every sprite is drawn in code at native pixel size (the town canvas is
   480x270 and gets scaled up). Swap any of these for hand-drawn sprites later.
   ========================================================================== */
const K = '#140d0b';

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- icons ---------- */
function iconGrid(name) {
  const g = [];
  for (let y = 0; y < 16; y++) g.push(new Array(16).fill('.'));
  if (PROC_ICONS[name]) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = PROC_ICONS[name](x, y); if (c) g[y][x] = c; }
  } else {
    const rows = ICONS[name].replace(/^\n/, '').split('\n');
    rows.forEach((r, y) => { if (y < 16) for (let x = 0; x < 16; x++) g[y][x] = r[x] || '.'; });
  }
  const G = []; for (let y = 0; y < 18; y++) G.push(new Array(18).fill('.'));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) G[y + 1][x + 1] = g[y][x];
  const O = G.map(r => r.slice());
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    if (G[y][x] !== '.') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && X < 18 && Y >= 0 && Y < 18 && G[Y][X] !== '.' && G[Y][X] !== 'k') { O[y][x] = 'k'; break; }
    }
  }
  return O;
}
const ICON_CANVAS = {}, ICON_URL = {};
function iconCanvas(name) {
  if (!ICON_CANVAS[name]) {
    const c = document.createElement('canvas'); c.width = c.height = 18;
    const x = c.getContext('2d'); const O = iconGrid(name);
    for (let j = 0; j < 18; j++) for (let i = 0; i < 18; i++) { const ch = O[j][i]; if (ch !== '.') { x.fillStyle = ch === 'k' ? K : PAL[ch]; x.fillRect(i, j, 1, 1); } }
    ICON_CANVAS[name] = c;
  }
  return ICON_CANVAS[name];
}
function iconURL(name) { return ICON_URL[name] || (ICON_URL[name] = iconCanvas(name).toDataURL()); }
function iconImg(name, size = 36, alt = '') {
  return `<img class="px" src="${iconURL(name)}" width="${size}" height="${size}" alt="${alt}"${alt ? '' : ' aria-hidden="true"'}>`;
}

/* ---------- pixel painter ---------- */
function Painter(ctx, ox = 0, oy = 0) {
  const P = {
    ctx, ox, oy,
    r(x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(ox + Math.round(x), oy + Math.round(y), Math.round(w), Math.round(h)); },
    p(x, y, c) { ctx.fillStyle = c; ctx.fillRect(ox + Math.round(x), oy + Math.round(y), 1, 1); },
    ell(cx, cy, rx, ry, c) {
      ctx.fillStyle = c;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        const dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) > 1) continue;
        const hw = rx * Math.sqrt(1 - dy * dy);
        const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
        if (x1 > x0) ctx.fillRect(ox + x0, oy + y, x1 - x0, 1);
      }
    },
    sh(x, y, w, h, a = .28) { P.r(x, y, w, h, `rgba(10,6,4,${a})`); },
    icon(name, x, y) { ctx.drawImage(iconCanvas(name), ox + x, oy + y); },
    // a top-down 3/4 building: roof seen from above, front wall facing down
    box(x, y, w, h, rh, roof, wall, o = {}) {
      const [rb, rhi, rlo] = roof, [wb, whi, wlo] = wall;
      if (!o.noShadow) P.sh(x + 3, y + 4, w, h - 2);
      P.r(x, y, w, h, K);
      P.r(x + 1, y + 1, w - 2, rh - 1, rb);
      P.r(x + 1, y + 1, w - 2, 1, rhi);
      if (o.flat) {
        for (let yy = y + 3; yy < y + rh - 1; yy += 3) for (let xx = x + 3; xx < x + w - 2; xx += 6) P.p(xx, yy, rhi);
      } else {
        for (let yy = y + 4; yy < y + rh - 1; yy += 3) {
          P.r(x + 1, yy, w - 2, 1, rlo);
          const off = ((yy - y) / 3) % 2 ? 0 : 2;
          for (let xx = x + 2 + off; xx < x + w - 1; xx += 4) P.p(xx, yy + 1, rhi);
        }
      }
      P.r(x + 1, y + 1, 1, rh - 1, rhi); P.r(x + w - 2, y + 1, 1, rh - 1, rlo);
      P.r(x + 1, y + rh - 1, w - 2, 1, rlo);
      const wy = y + rh, wh = h - rh - 1;
      P.r(x + 1, wy, w - 2, wh, wb);
      P.r(x + 1, wy, w - 2, 1, K);
      const st = o.style || 'wood';
      if (st === 'wood') for (let xx = x + 3; xx < x + w - 2; xx += 3) P.r(xx, wy + 1, 1, wh - 1, wlo);
      if (st === 'log') for (let yy = wy + 2; yy < wy + wh; yy += 2) { P.r(x + 1, yy, w - 2, 1, wlo); P.p(x + 1, yy - 1, whi); P.p(x + w - 2, yy - 1, whi); }
      if (st === 'stone' || st === 'brick') {
        const mort = st === 'brick' ? wlo : wlo;
        for (let yy = wy + 2; yy < wy + wh; yy += 3) {
          P.r(x + 1, yy, w - 2, 1, mort);
          const off = ((yy - wy) / 3) % 2 ? 0 : 2;
          for (let xx = x + 2 + off; xx < x + w - 1; xx += 4) P.p(xx, yy - 1, mort);
        }
      }
      if (st === 'metal') for (let xx = x + 2; xx < x + w - 1; xx += 2) P.r(xx, wy + 1, 1, wh - 1, wlo);
      if (st === 'timber') { for (let xx = x + 1; xx < x + w; xx += 8) P.r(xx, wy + 1, 1, wh - 1, '#4a2e1a'); P.r(x + 1, wy + Math.floor(wh / 2), w - 2, 1, '#4a2e1a'); }
      P.r(x + 1, y + h - 2, w - 2, 1, wlo);
      for (const wx of (o.win || [])) P.win(x + wx, wy + (o.winY ?? 3), o.lit);
      for (const wx of (o.win2 || [])) P.win(x + wx, wy + (o.win2Y ?? 11), o.lit);
      const dw = o.doorW ?? 6;
      if (dw > 0) {
        const dx = o.doorX != null ? x + o.doorX : x + Math.floor(w / 2) - Math.floor(dw / 2);
        const dh = Math.min(wh - 2, o.doorH ?? 9);
        P.r(dx - 1, y + h - 1 - dh - 1, dw + 2, dh + 1, K);
        P.r(dx, y + h - 1 - dh, dw, dh, o.doorC || '#5a3a22');
        if (!o.doorC || o.knob) P.p(dx + dw - 2, y + h - 1 - Math.ceil(dh / 2), '#ebc152');
      }
    },
    win(x, y, lit) {
      P.r(x - 1, y - 1, 6, 5, K);
      P.r(x, y, 4, 3, lit ? '#ffd463' : '#9fd0ff');
      P.p(x, y, lit ? '#fff6d8' : '#cdeeff');
    },
  };
  return P;
}

/* ---------- building sprites (body is cached, anim is drawn every frame) ---------- */
const SPR_W = 52, SPR_H = 86, SPR_OX = 6, SPR_OY = 40;   // sprite canvas origin = lot's top-left (room above for towers)
const ROOF = {
  clay:['#cf6a2f','#e8874a','#86391a'], slate:['#5a6270','#8a93a0','#4a5060'], darkslate:['#4a5060','#6b707a','#30343c'],
  brown:['#725935','#8a6a40','#5a3a22'], green:['#4a6a2a','#6a8a3c','#2e461b'], blue:['#2f5f8f','#5b9bd5','#1f4468'],
  barn:['#7f2618','#a8432c','#5a1a10'], teal:['#3f6f6a','#5f9a92','#2a4a46'], purple:['#4a3a6a','#6f5a9a','#2e2448'],
  shingle:['#5a3a22','#8a5a34','#3a2416'], flat:['#b8b0a0','#d8d0c0','#8a8478'], red:['#a8322a','#d9493b','#7f2618'],
  metal:['#6b707a','#8a93a0','#5a6270'],
};
const WALL = {
  stone:['#d8ccb4','#f0e4cc','#a8987c'], wood:['#8a5a34','#a8834f','#5a3a22'], plaster:['#e6dcc6','#f6efe0','#b8ab92'],
  cream:['#ead2a0','#f6e4be','#c4a66a'], ochre:['#e0b050','#f0c870','#b8913a'], brick:['#8a3a2a','#a8532c','#5a2418'],
  darkbrick:['#6b2416','#8a3a22','#4a1a10'], metal:['#8a93a0','#c8d0da','#5a6270'], grey:['#5a6270','#8a93a0','#4a5060'],
  white:['#e8ecef','#ffffff','#b8c0c8'], rock:['#b8ac98','#d0c4b0','#8a7e6a'], barnred:['#a8322a','#c8463a','#7f2618'],
};
function logEnd(P, cx, cy) { P.ell(cx, cy, 2.7, 2.5, K); P.ell(cx, cy, 1.9, 1.7, '#c09a63'); P.p(cx - .5, cy - .5, '#8a5a34'); }
function smallChair(P, x, y) { P.r(x, y, 4, 7, K); P.r(x + 1, y + 1, 1, 4, '#8a5a34'); P.r(x + 1, y + 4, 2, 1, '#c09a63'); P.p(x + 1, y + 5, '#5a3a22'); P.p(x + 2, y + 5, '#5a3a22'); }
function barrel(P, x, y) { P.r(x, y, 6, 7, K); P.r(x + 1, y + 1, 4, 5, '#8a5a34'); P.r(x + 1, y + 2, 4, 1, '#8a93a0'); P.r(x + 1, y + 4, 4, 1, '#8a93a0'); P.p(x + 1, y + 1, '#a8834f'); }
function plankStack(P, x, y, w) { P.sh(x + 2, y + 2, w, 7); P.r(x, y, w, 7, K); for (const yy of [y + 1, y + 3, y + 5]) { P.r(x + 1, yy, w - 2, 1, '#c09a63'); P.r(x + 1, yy + 1, w - 2, 1, '#8a5a34'); } }
function sack(P, x, y) { P.r(x + 2, y, 3, 2, K); P.ell(x + 3.5, y + 5, 3.6, 3.6, K); P.ell(x + 3.5, y + 5, 2.7, 2.7, '#efe6d4'); P.p(x + 3, y + 1, '#3a2416'); P.p(x + 2, y + 4, '#fff6d8'); }
function chimney(P, x, y, w, h, col = '#a8432c', band = '#7f2618') { P.r(x, y, w, h, K); P.r(x + 1, y + 1, w - 2, h - 1, col); for (let yy = y + 3; yy < y + h; yy += 3) P.r(x + 1, yy, w - 2, 1, band); P.r(x + 1, y + 1, w - 2, 2, '#30343c'); }

const BUILD = {
  hq: {
    body(P) {
      P.box(2, 6, 36, 31, 16, ROOF.clay, WALL.stone, { style:'stone', win:[5, 27], lit:true, doorW:8 });
      P.r(19, -14, 1, 21, K); P.r(20, -14, 1, 20, '#d8ccb4');
      P.r(13, 24, 14, 3, K); P.r(14, 25, 12, 1, '#ebc152');
    },
    anim(P, t) { const w = Math.round(Math.sin(t * 4)); P.r(21, -14, 8, 6, K); P.r(21, -13, 7, 4, '#ebc152'); P.r(21, -13, 7, 1, '#ffd463'); P.p(28, -13 + (w > 0 ? 1 : 0), K); P.p(27, -10 - (w > 0 ? 0 : 1), '#b8913a'); },
    smoke: [],
  },
  wood: {
    body(P) {
      P.box(2, 10, 24, 22, 11, ROOF.green, WALL.wood, { style:'log', win:[3], doorX:15, doorW:6 });
      P.sh(30, 24, 10, 12);
      for (const [cx, cy] of [[30, 33], [35, 33], [32.5, 28.6], [37.5, 28.6], [35, 24.2]]) logEnd(P, cx, cy);
      P.ell(8, 36, 5, 3, K); P.ell(8, 35.5, 4, 2.2, '#c09a63'); P.ell(8, 35.5, 2, 1, '#a8834f');
      P.r(31, 12, 7, 6, K); P.r(32, 13, 5, 4, '#6a8a3c'); P.r(32, 13, 5, 1, '#9bbb55');
    },
    anim(P, t) { const up = (t % 1.2) < .6; if (up) { P.r(9, 28, 1, 6, '#5a3a22'); P.r(7, 27, 4, 2, '#8a93a0'); } else { P.r(10, 33, 6, 1, '#5a3a22'); P.r(9, 33, 2, 3, '#8a93a0'); } },
  },
  wheat: {
    body(P) {
      P.r(0, 17, 40, 23, K); P.r(1, 18, 38, 21, '#7a5a32');
      for (let y = 19; y < 39; y += 3) P.r(1, y + 2, 38, 1, '#5a3a22');
      P.box(22, -2, 17, 17, 7, ROOF.barn, WALL.barnred, { style:'wood', doorW:7, doorC:'#f0e4cc', doorH:7 });
      for (let i = 0; i < 6; i++) { P.p(27 + i, 8 + i, '#a8322a'); P.p(32 - i, 8 + i, '#a8322a'); }
      P.ell(9, 9, 7, 5.5, K); P.ell(9, 9, 6, 4.5, '#e0c48a'); P.ell(8, 8, 4, 2.5, '#ffd463');
      for (let i = 0; i < 5; i++) P.p(5 + i * 2, 10 + (i % 2), '#b8913a');
    },
    anim(P, t) {
      for (let y = 19; y < 38; y += 3) for (let x = 2; x < 38; x += 2) {
        const sway = Math.round(Math.sin(t * 2.2 + x * .35 + y * .2) * .8);
        P.r(x, y, 1, 2, '#b8913a'); P.p(x + sway, y - 1, '#ffd463'); P.p(x, y, '#e0c48a');
      }
    },
  },
  ore: {
    body(P) {
      P.sh(4, 22, 36, 14);
      P.ell(20, 18, 20, 16, K); P.ell(20, 18, 19, 15, '#6e5e4f'); P.ell(15, 12, 11, 7, '#8a7a68'); P.ell(26, 26, 12, 5, '#584a3c');
      for (const [x, y] of [[6, 18], [30, 10], [33, 20], [10, 26], [24, 6]]) { P.r(x, y, 3, 2, '#584a3c'); P.p(x, y, '#8a7a68'); }
      P.r(12, 13, 16, 18, K); P.r(14, 15, 12, 16, '#1a1210');
      P.r(12, 13, 2, 18, '#8a5a34'); P.r(26, 13, 2, 18, '#8a5a34'); P.r(11, 12, 18, 3, K); P.r(12, 12, 16, 2, '#a8834f');
      for (let y = 31; y < 40; y += 3) P.r(13, y, 14, 1, '#5a3a22');
      P.r(15, 30, 1, 10, '#8a93a0'); P.r(24, 30, 1, 10, '#8a93a0');
      P.r(14, 31, 12, 7, K); P.r(15, 33, 10, 4, '#5a6270'); P.r(15, 33, 10, 1, '#8a93a0');
      P.ell(17, 32, 2.5, 1.8, '#a8532c'); P.ell(21, 31.5, 2.5, 2, '#6b2416'); P.ell(23, 32.5, 2, 1.5, '#a8532c'); P.p(20, 31, '#e8874a');
      P.r(29, 15, 3, 5, K); P.r(30, 14, 1, 1, K);
    },
    anim(P, t) { const f = Math.sin(t * 9) + Math.sin(t * 13) > 0; P.p(30, 16, f ? '#ffd463' : '#e8874a'); P.p(30, 17, '#ebc152'); },
  },
  planks: {
    body(P) {
      P.box(2, 8, 28, 24, 12, ROOF.slate, WALL.wood, { style:'wood', win:[4, 19], doorW:6, doorX:12 });
      P.r(28, 25, 12, 4, K); P.r(29, 26, 10, 2, '#5a3a22');
      plankStack(P, 2, 33, 15); plankStack(P, 19, 34, 12);
    },
    anim(P, t) {
      P.ell(34, 19, 6.6, 6.6, K); P.ell(34, 19, 5.6, 5.6, '#c8d0da'); P.ell(34, 19, 2, 2, '#5a6270');
      for (let i = 0; i < 8; i++) { const a = t * 6 + i * Math.PI / 4; P.p(34 + Math.cos(a) * 6.8 - .5, 19 + Math.sin(a) * 6.8 - .5, '#8a93a0'); }
      const a = t * 6; P.p(34 + Math.cos(a) * 3.5 - .5, 19 + Math.sin(a) * 3.5 - .5, '#fff6d8');
    },
  },
  flour: {
    body(P) {
      P.sh(14, 30, 18, 8);
      for (let y = 4; y < 37; y++) {
        const hw = 6 + (y - 4) * 3 / 32, x0 = Math.round(20 - hw), x1 = Math.round(20 + hw);
        P.r(x0 - 1, y, x1 - x0 + 2, 1, K); P.r(x0, y, x1 - x0, 1, (y % 4 === 0) ? '#b9a78b' : '#d8ccb4');
        P.p(x0, y, '#f0e4cc');
      }
      P.r(17, 29, 7, 8, K); P.r(18, 30, 5, 7, '#5a3a22'); P.p(21, 33, '#ebc152');
      P.win(18, 17, false);
      P.ell(20, 3, 8.5, 5.5, K); P.ell(20, 3, 7.5, 4.6, '#725935'); P.ell(18, 2, 4, 2, '#8a6a40');
      sack(P, 30, 30); sack(P, 34, 31);
    },
    anim(P, t) {
      const cx = 20, cy = 2;
      for (let s = 0; s < 4; s++) {
        const a = t * 1.3 + s * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
        for (let d = 5; d <= 17; d++) for (let k = 1; k <= 3; k++) P.p(cx + ca * d + nx * k - .5, cy + sa * d + ny * k - .5, (d % 3 === 0 || k === 3) ? '#b9a78b' : '#f0e4cc');
        for (let d = 2; d <= 18; d++) P.p(cx + ca * d - .5, cy + sa * d - .5, '#5a3a22');
      }
      P.r(cx - 1, cy - 1, 3, 3, K); P.p(cx, cy, '#ebc152');
    },
  },
  charcoal: {
    body(P) {
      P.sh(4, 30, 32, 8);
      const dome = (cx, cy, rx, ry) => {
        P.ell(cx, cy, rx + 1, ry + 1, K); P.ell(cx, cy, rx, ry, '#a8532c');
        for (let y = Math.floor(cy - ry) + 2; y < cy + ry; y += 3) { P.ell(cx, y, rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)), .5, '#7f3a1a'); }
        P.ell(cx - rx / 3, cy - ry / 3, rx / 2.5, ry / 3, '#c86a3a');
      };
      dome(13, 24, 11, 10); dome(31, 27, 8, 8);
      P.r(9, 27, 9, 8, K); P.r(11, 26, 5, 1, K); P.r(28, 30, 7, 6, K);
      P.ell(13, 14.5, 2.5, 1.5, K); P.ell(31, 19.5, 2, 1.2, K);
      P.ell(7, 37, 7, 3, K); P.ell(7, 36.5, 6, 2.2, '#30343c'); P.p(5, 35, '#4a5060'); P.p(9, 36, '#4a5060');
    },
    anim(P, t) { const f = (Math.sin(t * 11) + Math.sin(t * 7.3)) > 0; P.r(10, 28, 7, 6, f ? '#ff8a2b' : '#e8602a'); P.r(11, 31, 5, 3, f ? '#ffd463' : '#ff8a2b'); P.r(29, 31, 5, 4, f ? '#e8602a' : '#ff8a2b'); P.r(30, 33, 3, 2, '#ffd463'); },
    smoke: [[13, 13], [31, 18]],
  },
  chair: {
    body(P) {
      P.box(4, 6, 32, 26, 13, ROOF.blue, WALL.plaster, { style:'stone', win:[4, 24], lit:true, doorW:6 });
      P.r(10, 20, 20, 1, '#a8987c');
      smallChair(P, 5, 33); smallChair(P, 12, 33); smallChair(P, 31, 33);
      P.r(20, 34, 8, 1, K); P.r(20, 35, 1, 4, K); P.r(27, 35, 1, 4, K); P.r(21, 33, 6, 2, '#c09a63');
    },
  },
  paper: {
    body(P) {
      P.r(27, 0, 13, 40, '#1f4468'); P.r(28, 0, 11, 40, '#2f5f8f'); P.r(27, 0, 1, 40, '#7f6239');
      P.box(1, 2, 26, 33, 10, ROOF.brown, WALL.plaster, { style:'timber', win:[3, 10, 17], win2:[3, 17], doorW:6, doorX:9 });
      for (const x of [2, 7]) { P.r(x, 35, 5, 4, K); P.r(x + 1, 36, 3, 2, '#f0e4cc'); P.p(x + 1, 36, '#fff6d8'); }
    },
    anim(P, t) {
      for (let i = 0; i < 6; i++) { const y = (t * 8 + i * 7) % 40; P.r(30 + (i * 3) % 8, y, 3, 1, '#5b9bd5'); }
      P.ell(31, 22, 8.6, 8.6, K); P.ell(31, 22, 7.5, 7.5, '#8a5a34'); P.ell(31, 22, 5.5, 5.5, '#2f5f8f');
      for (let s = 0; s < 6; s++) { const a = t * 1.6 + s * Math.PI / 3; for (let d = 0; d <= 7; d++) P.p(31 + Math.cos(a) * d - .5, 22 + Math.sin(a) * d - .5, d === 7 ? '#c09a63' : '#5a3a22'); }
      P.r(30, 21, 2, 2, '#3a2416');
    },
  },
  bread: {
    body(P) {
      chimney(P, 26, -5, 7, 13);
      P.box(4, 6, 32, 27, 12, ROOF.shingle, WALL.cream, { style:'stone', doorW:6, doorX:26 });
      P.r(7, 22, 15, 9, K); P.r(8, 23, 13, 7, '#ffd463'); P.r(8, 23, 13, 1, '#fff6d8');
      for (const [x, y] of [[9, 26], [14, 27], [17, 25]]) { P.ell(x + 1.5, y + 1, 2.2, 1.4, '#86391a'); P.ell(x + 1.5, y + .7, 1.6, .9, '#cf6a2f'); }
      for (let x = 4; x < 36; x++) { const c = Math.floor((x - 4) / 3) % 2 ? '#f0e4cc' : '#d9493b'; P.r(x, 18, 1, 3, c); if ((x - 4) % 3 === 1) P.p(x, 21, c); }
      P.r(4, 17, 32, 1, K);
    },
    smoke: [[29, -6]],
  },
  pasta: {
    body(P) {
      P.box(6, 6, 30, 26, 12, ROOF.clay, WALL.ochre, { style:'stone', win:[3, 22], lit:true, doorW:6, doorC:'#2e6a3a', knob:true });
      P.r(2, 31, 1, 9, K); P.r(21, 31, 1, 9, K); P.r(2, 31, 20, 1, '#5a3a22');
    },
    anim(P, t) { for (let x = 4; x < 21; x += 2) { const len = 3 + ((x * 7) % 4), sw = Math.round(Math.sin(t * 2 + x) * .6); for (let k = 0; k < len; k++) P.p(x + (k === len - 1 ? sw : 0), 32 + k, k % 2 ? '#e0c48a' : '#ffd463'); } },
    smoke: [[11, 15]],
    steam: true,
  },
  iron: {
    body(P) {
      chimney(P, 30, -11, 7, 33, '#8a3a22', '#5a1a10');
      P.box(2, 10, 27, 25, 9, ROOF.darkslate, WALL.darkbrick, { style:'brick', doorW:0 });
      P.r(8, 22, 14, 12, K); P.r(9, 21, 12, 1, K);
      for (const [x, y] of [[31, 33], [35, 33], [33, 30]]) { P.r(x, y, 5, 4, K); P.r(x + 1, y + 1, 3, 2, '#8a93a0'); P.p(x + 1, y + 1, '#c8d0da'); }
    },
    anim(P, t) { const f = (Math.sin(t * 10) + Math.sin(t * 6.1)) > 0; P.r(9, 23, 12, 11, f ? '#ff8a2b' : '#e8602a'); P.r(11, 26, 8, 7, f ? '#ffd463' : '#ff8a2b'); P.r(13, 29, 4, 4, '#fff6d8'); },
    smoke: [[33, -12]],
  },
  nails: {
    body(P) {
      P.box(2, 8, 32, 25, 10, ROOF.teal, WALL.metal, { style:'metal', win:[3], doorW:10, doorX:14, doorC:'#4a5060', doorH:10 });
      for (let y = 24; y < 32; y += 2) P.r(14, y, 10, 1, '#5a6270');
      barrel(P, 3, 33); barrel(P, 10, 33); barrel(P, 33, 30);
    },
    anim(P, t) { const ph = t % 1.6; if (ph < .25) { for (let i = 0; i < 4; i++) P.p(19 + Math.round(Math.cos(i * 1.7 + t * 20) * (2 + ph * 12)), 32 + Math.round(Math.sin(i * 1.3) * 2 - ph * 6), i % 2 ? '#ffd463' : '#ff8a2b'); } },
  },
  sofa: {
    body(P) {
      P.sh(3, 8, 40, 30);
      P.r(0, 4, 40, 31, K);
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 13;
        P.r(x, 5, 13, 13, '#7a3a2a'); P.r(x, 5, 13, 3, '#9fd0ff'); P.r(x, 5, 13, 1, '#cdeeff'); P.r(x, 8, 13, 1, K);
        for (let y = 10; y < 18; y += 3) P.r(x, y, 13, 1, '#5a2418');
        P.r(x + 12, 5, 1, 13, K);
      }
      P.r(1, 18, 38, 16, '#a8532c'); P.r(1, 18, 38, 1, K);
      for (let y = 20; y < 34; y += 3) { P.r(1, y, 38, 1, '#7f3a1a'); const off = ((y - 20) / 3) % 2 ? 0 : 2; for (let x = 2 + off; x < 39; x += 4) P.p(x, y - 1, '#7f3a1a'); }
      P.win(4, 21, true); P.win(31, 21, true);
      P.r(15, 23, 10, 11, K); P.r(16, 24, 8, 10, '#3a2416'); for (let y = 26; y < 34; y += 2) P.r(16, y, 8, 1, '#5a3a22');
      P.r(12, 35, 16, 5, K); P.r(13, 35, 14, 2, '#5b9bd5'); P.r(13, 37, 14, 2, '#2f5f8f'); P.r(12, 36, 2, 3, '#2f5f8f'); P.r(26, 36, 2, 3, '#2f5f8f');
    },
  },
  books: {
    body(P) {
      P.box(6, -6, 28, 41, 10, ROOF.purple, WALL.brick, { style:'brick', win:[4, 20], win2:[4, 20], winY:12, win2Y:20, lit:true, doorW:6 });
      P.ell(20, 9, 4.6, 4.6, K); P.ell(20, 9, 3.7, 3.7, '#f0e4cc');
      for (const [x, c] of [[1, '#d9493b'], [1, '#5b9bd5'], [1, '#9bbb55']]) {}
      const bk = (x, y, c) => { P.r(x, y, 5, 3, K); P.r(x + 1, y + 1, 3, 1, c); };
      bk(0, 36, '#d9493b'); bk(0, 33, '#5b9bd5'); bk(1, 30, '#9bbb55'); bk(35, 36, '#ebc152'); bk(35, 33, '#d9493b');
    },
    anim(P, t) { P.p(20, 9, K); const m = t * .5, h = t * .04; for (let d = 1; d <= 3; d++) P.p(20 + Math.cos(m) * d - .5, 9 + Math.sin(m) * d - .5, K); for (let d = 1; d <= 2; d++) P.p(20 + Math.cos(h) * d - .5, 9 + Math.sin(h) * d - .5, '#d9493b'); },
  },
  lunchbox: {
    body(P) {
      P.box(1, 8, 38, 25, 7, ROOF.flat, WALL.white, { style:'plain', flat:true, win:[4, 30], doorW:8, doorX:15, doorC:'#2f5f8f' });
      P.r(2, 17, 36, 2, '#3fa59a');
      for (const x of [6, 15, 24]) { P.r(x, 10, 4, 3, K); P.r(x + 1, 11, 2, 1, '#5a6270'); }
      P.r(0, 34, 40, 5, K); P.r(1, 35, 38, 3, '#4a5060'); for (let x = 2; x < 39; x += 4) P.p(x, 37, '#8a93a0');
    },
    anim(P, t) { for (let i = 0; i < 4; i++) { const x = Math.floor((t * 6 + i * 10) % 40) - 2; if (x >= 0 && x <= 35) { P.r(x, 32, 5, 4, K); P.r(x + 1, 33, 3, 2, '#5b9bd5'); P.p(x + 2, 33, '#ebc152'); } } },
  },
  canned: {
    body(P) {
      const silo = (x, w) => {
        P.sh(x + 3, 6, w, 30);
        P.r(x, 1, w, 33, K);
        for (let i = 1; i < w - 1; i++) P.r(x + i, 2, 1, 31, i < w * .3 ? '#c8d0da' : i < w * .7 ? '#a8b0ba' : '#6a7280');
        for (let y = 9; y < 33; y += 8) P.r(x + 1, y, w - 2, 1, '#5a6270');
        P.ell(x + w / 2, 2, w / 2, 2.5, K); P.ell(x + w / 2, 2, w / 2 - 1, 1.6, '#e0e6ec');
      };
      silo(1, 11); silo(13, 11);
      P.box(25, 10, 15, 25, 8, ROOF.red, WALL.metal, { style:'metal', doorW:5 });
      const can = (x, y) => { P.r(x, y, 4, 5, K); P.r(x + 1, y + 1, 2, 3, '#d9493b'); P.p(x + 1, y + 2, '#f0e4cc'); };
      can(3, 35); can(7, 35); can(11, 35); can(5, 31); can(9, 31);
    },
  },
  steel: {
    body(P) {
      const ch = (x, y, h) => { P.r(x, y, 7, h, K); for (let yy = y + 1; yy < y + h; yy++) P.r(x + 1, yy, 5, 1, Math.floor((yy - y) / 3) % 2 ? '#f0e4cc' : '#a8432c'); P.r(x + 1, y + 1, 5, 2, '#30343c'); };
      ch(4, -15, 27); ch(27, -11, 23);
      P.box(0, 10, 40, 26, 12, ROOF.metal, WALL.grey, { style:'metal', win:[3, 33], doorW:10, doorX:15, doorC:'#ff8a2b', doorH:9 });
    },
    anim(P, t) { const f = (Math.sin(t * 9) + Math.sin(t * 5.7)) > 0; P.r(15, 26, 10, 9, f ? '#ff8a2b' : '#e8602a'); P.r(17, 29, 6, 5, f ? '#ffd463' : '#ff8a2b'); },
    smoke: [[7, -16], [30, -12]],
  },
  tools: {
    body(P) {
      P.box(2, 6, 30, 26, 12, ROOF.darkslate, WALL.rock, { style:'stone', win:[4, 21], lit:true, doorW:6, doorX:12 });
      P.r(5, 33, 12, 3, K); P.r(6, 34, 10, 1, '#4a5060'); P.r(8, 36, 6, 3, K); P.r(9, 36, 4, 2, '#30343c'); P.r(4, 33, 3, 2, K);
      P.r(24, 33, 9, 6, K); P.r(25, 34, 7, 4, '#a8834f'); P.r(25, 36, 7, 1, '#8a5a34');
    },
    anim(P, t) {
      const cx = 34, cy = 12;
      P.ell(cx, cy, 6, 6, K); P.ell(cx, cy, 5, 5, '#8a93a0'); P.ell(cx, cy, 2, 2, K);
      for (let i = 0; i < 8; i++) { const a = t * 1.5 + i * Math.PI / 4; P.r(cx + Math.cos(a) * 6 - 1, cy + Math.sin(a) * 6 - 1, 2, 2, '#5a6270'); }
      if ((t % 2.2) < .15) { P.p(11, 30, '#ffd463'); P.p(13, 29, '#ff8a2b'); P.p(9, 29, '#ffd463'); }
    },
  },
  /* ---- Gold Hill (v0.04): grander buildings, every one with a gold trim ---- */
  piano: {
    body(P) {
      P.box(2, 4, 36, 30, 12, ROOF.darkslate, WALL.cream, { style:'stone', win:[29], lit:true, doorW:6, doorX:22 });
      P.r(2, 15, 36, 1, '#ebc152');
      // the show window, with a grand piano inside
      P.r(5, 18, 15, 13, K); P.r(6, 19, 13, 11, '#ffd463'); P.r(6, 19, 13, 1, '#fff6d8');
      P.r(7, 23, 10, 3, K); P.r(8, 21, 7, 2, K); P.r(14, 20, 1, 3, K); P.r(8, 26, 1, 3, K); P.r(15, 26, 1, 3, K);
      for (let x = 8; x < 16; x += 2) P.p(x, 24, '#f0e4cc');
      P.r(14, 35, 12, 3, K); P.r(15, 36, 10, 1, '#ebc152');
    },
    anim(P, t) {   // music notes drift up from the roof
      for (let i = 0; i < 3; i++) {
        const ph = (t * .6 + i / 3) % 1, x = Math.round(26 + i * 4 + Math.sin(t * 2 + i) * 1.5), y = Math.round(6 - ph * 16);
        P.r(x, y, 1, 4, K); P.r(x - 2, y + 3, 2, 2, K); if (i % 2) P.r(x + 1, y, 2, 1, K);
      }
    },
  },
  hamper: {
    body(P) {
      P.box(3, 6, 34, 27, 12, ROOF.green, WALL.cream, { style:'stone', win:[4, 26], lit:true, doorW:6 });
      for (let x = 3; x < 37; x++) { const c = Math.floor((x - 3) / 3) % 2 ? '#f0e4cc' : '#9bbb55'; P.r(x, 18, 1, 3, c); if ((x - 3) % 3 === 1) P.p(x, 21, c); }
      P.r(3, 17, 34, 1, K); P.r(3, 16, 34, 1, '#ebc152');
      const basket = (x, y) => {
        P.r(x + 1, y, 5, 1, K); P.p(x + 1, y + 1, K); P.p(x + 5, y + 1, K);
        P.r(x, y + 2, 7, 5, K); P.r(x + 1, y + 3, 5, 3, '#c09a63'); P.p(x + 2, y + 4, '#8a5a34'); P.p(x + 4, y + 4, '#8a5a34'); P.p(x + 3, y + 3, '#d9493b');
      };
      basket(2, 33); basket(31, 33);
    },
    anim(P, t) {   // the big gold bow on the sign catches the light
      const on = (t % 2.4) < .3;
      P.r(16, 2, 8, 5, K); P.r(17, 3, 6, 3, '#ebc152'); P.p(19, 4, '#b8913a'); P.p(20, 4, '#b8913a'); P.p(17, 3, on ? '#fff6d8' : '#ffd463');
    },
  },
  car: {
    body(P) {
      P.box(1, 2, 38, 31, 8, ROOF.metal, WALL.white, { style:'plain', flat:true, doorW:0 });
      P.r(1, 9, 38, 1, '#ebc152');
      P.r(3, 13, 34, 17, K); P.r(4, 14, 32, 15, '#9fd0ff');
      for (let x = 10; x < 36; x += 7) P.r(x, 14, 1, 15, '#5b9bd5');
      P.r(4, 14, 32, 1, '#cdeeff');
      miniCar(P, 8, 22, '#5b9bd5', '#2f5f8f');   // one in the showroom
      miniCar(P, 23, 34, '#d9493b', '#7f2618');  // one parked out front
    },
    anim(P, t) {   // a new car rolls out of the works now and then
      const ph = (t * .25) % 1; if (ph > .6) return;
      const x = Math.round(-10 + ph / .6 * 22); if (x < 0) return;
      miniCar(P, x, 34, '#ebc152', '#b8913a');
    },
  },
};
function miniCar(P, x, y, c, d) {
  P.r(x + 2, y, 7, 3, K); P.r(x + 3, y + 1, 5, 1, '#cdeeff');
  P.r(x, y + 2, 12, 4, K); P.r(x + 1, y + 3, 10, 2, c); P.r(x + 1, y + 4, 10, 1, d); P.p(x + 10, y + 3, '#fff6d8');
  P.r(x + 2, y + 5, 3, 2, K); P.r(x + 8, y + 5, 3, 2, K);
}

/* ---------- level looks: every building gets fancier as it levels up ----------
   Lv 2 street lamps · Lv 3 banner flags on the roof · Lv 4 gold roof trim · Lv 5 a gold crown (and sparkles).
   ANCHOR = [roof left x, roof top y, roof right x, has a plain rectangular roof] in lot pixels. */
const ANCHOR = { hq:[2,6,38,1,'clay','stone'], wood:[2,10,26,1,'green','wood'], wheat:[22,-2,39,1,'barn','barnred'], ore:[9,4,31,0,'brown','wood'],
  planks:[2,8,30,1,'slate','wood'], flour:[13,9,27,0,'brown','stone'], charcoal:[4,15,24,0,'darkslate','brick'], chair:[4,6,36,1,'blue','plaster'],
  paper:[1,2,27,1,'brown','plaster'], bread:[4,6,36,1,'shingle','cream'], pasta:[6,6,36,1,'clay','ochre'], iron:[2,10,29,1,'darkslate','darkbrick'],
  nails:[2,8,34,1,'teal','metal'], sofa:[0,4,40,1,'barn','brick'], books:[6,-6,34,1,'purple','brick'], lunchbox:[1,8,39,1,'flat','white'],
  canned:[25,10,40,1,'red','metal'], steel:[0,10,40,1,'metal','grey'], tools:[2,6,32,1,'darkslate','rock'],
  piano:[2,4,38,1,'darkslate','cream'], hamper:[3,6,37,1,'green','cream'], car:[1,2,39,1,'metal','white'] };
const GOLD_ROOF = ['#ebc152', '#ffd463', '#b8913a'];
// the building itself grows: structures behind the main building, drawn before it
function evolveBack(P, type, lv) {
  const [x0, y0, x1, , rk, wk] = ANCHOR[type] || [2, 6, 38, 1, 'brown', 'wood'];
  const roof = ROOF[rk] || ROOF.brown, wall = WALL[wk] || WALL.wood, w = x1 - x0, cx = Math.round((x0 + x1) / 2);
  if (lv >= 3) {                                      // a back wing as wide as the building
    const h = lv >= 4 ? 20 : 13, top = y0 - h + 4;
    if (lv >= 4) chimney(P, x0 + 3, top - 11, 6, 14);  // with its own smokestack
    P.box(x0 + 2, top, w - 4, h, lv >= 4 ? 8 : 7, roof, wall, { style: wk === 'metal' || wk === 'grey' ? 'metal' : 'stone', win: lv >= 4 ? [4, w - 14] : [], lit: true, doorW: 0, winY: 1 });
  }
  if (lv >= 5) {                                      // a gold-roofed tower in the middle
    P.box(cx - 7, y0 - 30, 14, 30, 8, GOLD_ROOF, wall, { style: 'stone', win: [5], win2: [5], winY: 2, win2Y: 9, lit: true, doorW: 0 });
  }
  if (lv >= 2) P.box(x1 - 13, y0 - 7, 13, 13, 6, roof, wall, { style: 'wood', win: [], doorW: 0 });   // an annex shed
}
function decorate(P, type, lv) {
  const [x0, y0, x1, rect] = ANCHOR[type] || [2, 6, 38, 1];
  if (lv >= 2) for (const x of [-2, 39]) { P.r(x, 26, 3, 14, K); P.r(x + 1, 27, 1, 12, '#5a6270'); P.r(x - 1, 23, 5, 4, K); P.r(x, 24, 3, 2, '#ffd463'); }
  if (lv >= 3) for (const [px, c1, c2] of [[x0 + 2, '#d9493b', '#7f2618'], [x1 - 3, '#ebc152', '#b8913a']]) {
    P.r(px - 1, y0 - 8, 3, 9, K); P.r(px, y0 - 8, 1, 8, '#d8ccb4'); P.r(px + 1, y0 - 8, 6, 4, K); P.r(px + 1, y0 - 7, 5, 2, c1); P.p(px + 5, y0 - 6, c2);
  }
  if (lv >= 4) {
    if (rect) { P.r(x0 + 1, y0, x1 - x0 - 2, 1, '#ebc152'); P.r(x0, y0 + 1, 1, 4, '#ebc152'); P.r(x1 - 1, y0 + 1, 1, 4, '#ebc152'); P.p(x0 + 1, y0, '#ffd463'); }
    else { const cx = Math.round((x0 + x1) / 2); P.r(cx - 5, y0 + 2, 10, 6, K); P.r(cx - 4, y0 + 3, 8, 4, '#ebc152'); P.r(cx - 4, y0 + 3, 8, 1, '#ffd463'); }
  }
  if (lv >= 5) {
    const cx = Math.round((x0 + x1) / 2), y = y0 - 39;
    P.r(cx - 5, y - 1, 11, 8, K);
    P.r(cx - 4, y + 2, 9, 4, '#ebc152'); P.r(cx - 4, y + 2, 9, 1, '#ffd463');
    for (const dx of [-4, 0, 4]) { P.r(cx + dx, y, 1, 2, '#ebc152'); P.p(cx + dx, y - 1, K); }
    P.p(cx, y + 3, '#d9493b'); P.p(cx - 3, y + 4, '#5b9bd5'); P.p(cx + 3, y + 4, '#9bbb55');
  }
}
function decorAnim(P, type, lv, t) {
  const [x0, y0, x1] = ANCHOR[type] || [2, 6, 38];
  if (lv >= 2) { const on = Math.sin(t * 3) > -.6; for (const x of [-2, 39]) { P.p(x + 1, 24, on ? '#fff6d8' : '#ffd463'); } }
  if (lv >= 3) for (const px of [x0 + 2, x1 - 3]) { const w = Math.sin(t * 5 + px) > 0; P.p(px + 6, y0 - 7 + (w ? 1 : 0), w ? '#d9493b' : K); }
  if (lv >= 5) for (let k = 0; k < 3; k++) {
    const ph = (t * 1.3 + k * .33) % 1; if (ph > .45) continue;
    const sx = Math.round(4 + ((k * 13 + Math.floor(t * 1.3 + k * .33) * 7) % 32)), sy = Math.round(y0 - 34 + ((k * 11 + Math.floor(t * 1.3) * 5) % 50));
    const c = ph < .2 ? '#fff6d8' : '#ffd463'; P.p(sx, sy, c); if (ph < .3) { P.p(sx - 1, sy, '#ebc152'); P.p(sx + 1, sy, '#ebc152'); P.p(sx, sy - 1, '#ebc152'); P.p(sx, sy + 1, '#ebc152'); }
  }
}
const SPRITES = {};
function buildingSprite(type, lv = 1) {
  const key = type + lv;
  if (!SPRITES[key]) {
    const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H;
    const P = Painter(c.getContext('2d'), SPR_OX, SPR_OY);
    if (lv >= 2) evolveBack(P, type, lv);
    BUILD[type].body(P);
    if (lv >= 2) decorate(P, type, lv);
    SPRITES[key] = c;
  }
  return SPRITES[key];
}
// a static preview image (body + one animation frame) for menus
const PREVIEW_URL = {};
function buildingPreview(type, lv = 1) {
  const key = type + lv;
  if (!PREVIEW_URL[key]) {
    const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H;
    const ctx = c.getContext('2d'); ctx.drawImage(buildingSprite(type, lv), 0, 0);
    if (BUILD[type].anim) BUILD[type].anim(Painter(ctx, SPR_OX, SPR_OY), 0.35);
    PREVIEW_URL[key] = c.toDataURL();
  }
  return PREVIEW_URL[key];
}

/* ---------- real estate: five kinds of property, each looking nicer with every renovation ---------- */
const HOUSE = {
  cottage(P, r) {
    P.r(0, 26, PLOT, 10, '#4f6a2c');
    chimney(P, 22, 2, 5, 10);
    P.box(4, 8, 28, 22, 11, ROOF.red, WALL.cream, { style:'stone', win:[3, 20], lit:r >= 2, doorW:5 });
    P.r(16, 30, 4, 6, '#c8bca6');
  },
  townhouse(P, r) {
    P.box(1, 3, 17, 30, 10, ROOF.blue, WALL.brick, { style:'brick', win:[3, 10], win2:[3, 10], winY:3, win2Y:10, lit:r >= 2, doorW:4, doorX:6, doorH:6 });
    P.box(18, 3, 17, 30, 10, ROOF.green, WALL.plaster, { style:'stone', win:[3, 10], win2:[3, 10], winY:3, win2Y:10, lit:r >= 2, doorW:4, doorX:6, doorH:6, noShadow:true });
  },
  apartment(P, r) {
    P.box(1, -6, 34, 40, 6, ROOF.flat, WALL.brick, { style:'brick', flat:true, doorW:6, doorH:6, lit:r >= 2 });
    for (const y of [3, 11, 19]) for (const x of [4, 14, 24]) { P.win(x + 1, y, r >= 2 && (x + y) % 3 !== 0); P.r(x, y + 4, 7, 1, '#5a6270'); }
    P.r(5, -4, 5, 3, K); P.r(6, -3, 3, 1, '#8a93a0'); P.r(25, -4, 5, 3, K); P.r(26, -3, 3, 1, '#8a93a0');
  },
  office(P, r) {
    P.box(1, -2, 34, 36, 6, ROOF.flat, ['#2f5f8f', '#5b9bd5', '#1f4468'], { style:'plain', flat:true, doorW:8, doorC:'#9fd0ff', doorH:7 });
    for (let x = 3; x < 34; x += 4) P.r(x, 5, 1, 21, '#1f4468');
    for (let y = 9; y < 27; y += 5) P.r(2, y, 32, 1, '#1f4468');
    for (let i = 0; i < 6; i++) P.p(4 + i * 5, 6 + (i % 3) * 5, '#cdeeff');
    P.r(10, -6, 16, 5, K); P.r(11, -5, 14, 3, r >= 2 ? '#ebc152' : '#d8ccb4');
  },
  mansion(P, r) {
    P.r(0, 30, PLOT, 6, '#4f6a2c');
    P.box(0, 4, 36, 28, 11, ROOF.slate, WALL.white, { style:'stone', win:[3, 10, 22, 29], lit:r >= 2, doorW:6 });
    for (const x of [11, 14, 21, 24]) { P.r(x, 16, 2, 15, '#f0e4cc'); P.p(x + 1, 16, '#b8c0c8'); }
    P.r(10, 15, 16, 2, '#d8ccb4');
    for (const x of [1, 31]) { P.ell(x + 2.5, 33, 3, 2.5, '#2e461b'); P.ell(x + 2, 32.5, 1.8, 1.4, '#4f672b'); }
  },
  villa(P, r) {   // v0.04, on Gold Hill: white walls, a gold roof and a pool
    P.r(0, 27, PLOT, 9, '#68883a');
    P.r(22, 28, 13, 7, K); P.r(23, 29, 11, 5, '#5b9bd5'); P.r(23, 29, 11, 1, '#cdeeff'); P.p(26, 31, '#cdeeff'); P.p(30, 32, '#cdeeff');
    P.box(1, 0, 22, 28, 9, GOLD_ROOF, WALL.white, { style:'stone', win:[3, 15], win2:[3, 15], winY:2, win2Y:10, lit:r >= 2, doorW:5 });
    P.box(21, 6, 14, 22, 8, GOLD_ROOF, WALL.white, { style:'stone', win:[5], lit:r >= 2, doorW:0, noShadow:true });
    for (const x of [6, 14]) { P.r(x, 22, 2, 6, '#f0e4cc'); P.p(x + 1, 22, '#b8c0c8'); }
  },
};
function houseDecor(P, type, r) {
  if (r >= 2) { for (let x = 0; x < PLOT; x += 3) { P.r(x, 33, 1, 3, '#f0e4cc'); } P.r(0, 34, PLOT, 1, '#f0e4cc'); for (const x of [4, 9, 27, 31]) { P.p(x, 32, '#d9493b'); P.p(x + 1, 32, '#ebc152'); } }
  if (r >= 3) { P.r(34, 22, 2, 12, K); P.r(33, 20, 4, 3, K); P.p(34, 21, '#ffd463'); P.p(35, 21, '#ffd463'); P.r(1, -8, 1, 8, '#d8ccb4'); P.r(2, -8, 5, 3, K); P.r(2, -7, 4, 1, '#ebc152'); }
}
const HOUSE_SPR = {};
function houseSprite(type, r) {
  const key = type + r;
  if (!HOUSE_SPR[key]) {
    const c = document.createElement('canvas'); c.width = PLOT + 12; c.height = PLOT + 22;
    const P = Painter(c.getContext('2d'), 6, 14);
    HOUSE[type](P, r); houseDecor(P, type, r);
    HOUSE_SPR[key] = c;
  }
  return HOUSE_SPR[key];
}
const HOUSE_URL = {};
function housePreview(type, r = 1) { const k = type + r; return HOUSE_URL[k] || (HOUSE_URL[k] = houseSprite(type, r).toDataURL()); }

/* ---------- town background (drawn once per level, covers the whole world) ---------- */
let BG = null, BG_LEVEL = -1;
function drawBackground(level) {
  const c = document.createElement('canvas'); c.width = WORLD_W; c.height = WORLD_H;
  const ctx = c.getContext('2d'), P = Painter(ctx, TX, TY), R = rng(7);
  const img = ctx.createImageData(WORLD_W, WORLD_H), d = img.data;
  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const G0 = hx('#5b7832'), Gs = ['#597631', '#577330', '#5a7731'].map(hx), Gd = hx('#465b26'), Gdd = hx('#415423'), Gl = hx('#68883a');
  for (let i = 0; i < WORLD_W * WORLD_H; i++) {
    const v = R(); let col = G0;
    if (v < .015) col = Gdd; else if (v < .05) col = Gd; else if (v < .12) col = Gs[Math.floor(R() * 3)]; else if (v < .132) col = Gl;
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const X0 = -TX, Y0 = -TY, X1 = WORLD_W - TX, Y1 = WORLD_H - TY;   // world edges in town coordinates
  for (let i = 0; i < 900; i++) { const x = X0 + Math.floor(R() * WORLD_W), y = Y0 + Math.floor(R() * WORLD_H); P.p(x, y, '#485d27'); P.p(x, y + 1, '#465b26'); }
  for (let i = 0; i < 220; i++) P.p(X0 + Math.floor(R() * WORLD_W), Y0 + Math.floor(R() * WORLD_H), ['#e9c04f', '#f0e4cc', '#c9a0ff', '#ff8a7a'][Math.floor(R() * 4)]);
  const dirt = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const v = R(); let col = '#a8834f';
      if (v < .012) col = '#c09a63'; else if (v < .025) col = '#7f6239'; else if (v < .09) col = '#93703f'; else if (v < .2) col = '#9a774a';
      P.p(xx, yy, col);
    }
  };
  // pond and far-off fields out in the countryside
  P.ell(-110, 40, 44, 24, '#93703f'); P.ell(-110, 40, 42, 22, '#2f5f8f'); P.ell(-116, 34, 26, 11, '#3f6fa0');
  for (let i = 0; i < 14; i++) P.r(-150 + Math.floor(R() * 70), 26 + Math.floor(R() * 26), 4, 1, '#5b9bd5');
  for (let f = 0; f < 2; f++) { const fx = 540 + f * 64, fy = -96 + f * 30; P.r(fx - 1, fy - 1, 56, 50, '#5a3a22'); P.r(fx, fy, 54, 48, '#7a5a32'); for (let y = fy + 2; y < fy + 46; y += 3) { P.r(fx, y, 54, 1, f ? '#9bbb55' : '#e0c48a'); P.r(fx, y + 1, 54, 1, '#5a3a22'); } }
  drawHill(P, R);
  dirt(X0, ROAD_H.y, WORLD_W, ROAD_H.h);
  for (const v of ROAD_V) dirt(v.x, Y0, v.w, WORLD_H);
  for (let x = X0; x < X1; x++) { P.p(x, ROAD_H.y, '#93703f'); P.p(x, ROAD_H.y + ROAD_H.h - 1, '#93703f'); if (R() < .25) P.p(x, ROAD_H.y - 1, '#93703f'); if (R() < .25) P.p(x, ROAD_H.y + ROAD_H.h, '#93703f'); }
  for (const v of ROAD_V) for (let y = Y0; y < Y1; y++) { if (y >= ROAD_H.y && y < ROAD_H.y + ROAD_H.h) continue; P.p(v.x, y, '#93703f'); P.p(v.x + v.w - 1, y, '#93703f'); }
  for (let i = 0; i < LOTS; i++) { const { x, y, block } = lotXY(i); for (let yy = y; yy < y + LOT; yy++) for (let xx = x; xx < x + LOT; xx++) if (R() < .06) P.p(xx, yy, block === 3 ? '#6f7d34' : '#4f6a2c'); }
  // trees: everywhere outside the town blocks, never on roads, the pond or the fields
  const keepOut = [[8, -2, 464, 272], [-160, 10, 100, 64], [530, -110, 140, 96], [-190, 90, 164, 112], [486, 90, 166, 112], [HILL.x - 4, HILL.y - 14, HILL.w + 8, HILL.h + 26]];
  const blocked = (x, y) => keepOut.some(([a, b, w, h]) => x > a - 8 && x < a + w + 8 && y > b - 8 && y < b + h + 10)
    || Math.abs(y - (ROAD_H.y + 8)) < 18 || ROAD_V.some(v => x > v.x - 10 && x < v.x + v.w + 10);
  const trees = [];
  for (let n = 0; n < 1200 && trees.length < 290; n++) {
    const x = X0 + 6 + Math.floor(R() * (WORLD_W - 12)), y = Y0 + 4 + Math.floor(R() * (WORLD_H - 10));
    if (blocked(x, y) || trees.some(t => Math.abs(t[0] - x) < 13 && Math.abs(t[1] - y) < 11)) continue;
    trees.push([x, y, R() < .4 ? 8 : 7, R() < .3]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  const tree = (cx, cy, rr) => {
    P.sh(cx - rr + 3, cy + rr - 2, rr * 2 - 1, 4, .3);
    P.r(cx - 2, cy + 3, 4, rr - 1, K); P.r(cx - 1, cy + 3, 2, rr - 2, '#5a3a22');
    for (let y = cy - rr - 1; y <= cy + rr + 1; y++) for (let x = cx - rr - 1; x <= cx + rr + 1; x++) {
      const dx = x - cx + .5, dy = y - cy + .5, dd = Math.hypot(dx, dy);
      if (dd > rr + .5) continue;
      let col = '#4a6028';
      if (dd > rr - .6) col = '#160f0d'; else if (dd > rr - 2.2 && dy > 0) col = '#2e461b'; else if (dx + dy > 2) col = '#395721'; else if (dx + dy < -5 && dd < rr - 1.5) col = '#5d7a32'; else if (R() < .12) col = '#4f672b';
      P.p(x, y, col);
    }
  };
  const bush = (cx, cy, rr) => { for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) { const dx = x - cx + .5, dy = y - cy + .5, dd = Math.hypot(dx, dy); if (dd > rr) continue; P.p(x, y, dd > rr - .8 ? '#160f0d' : dx + dy < -2 && dd < rr - 1 ? '#4f672b' : dx + dy < 1 ? '#3a5422' : '#2e461b'); } };
  for (const [x, y, rr, isBush] of trees) isBush ? bush(x, y + 4, rr - 2) : tree(x, y, rr);
  // real-estate plots: a lawn and a little front path each
  for (const pl of PLOTS) {
    for (let yy = pl.y; yy < pl.y + PLOT; yy++) for (let xx = pl.x; xx < pl.x + PLOT; xx++) if (R() < .1) P.p(xx, yy, '#68883a');
    if (pl.y > HILL.y) { P.r(pl.x + 16, pl.y + PLOT, 4, 6, '#c9b98a'); continue; }   // Gold Hill villas: a short gravel drive
    const fy = pl.y < ROAD_H.y ? pl.y + PLOT : ROAD_H.y + ROAD_H.h, fh = pl.y < ROAD_H.y ? ROAD_H.y - fy : pl.y - fy;
    P.r(pl.x + 16, fy, 4, fh, '#b9ab92');
  }
  // fences around areas you haven't unlocked
  for (let b = 0; b < ZONE_LEVEL.length; b++) {
    if (ZONE_LEVEL[b] <= level) continue;
    for (const [x0, y0, x1, y1] of zoneBoxes(b)) {
      ctx.fillStyle = 'rgba(10,6,4,.32)'; ctx.fillRect(TX + x0, TY + y0, x1 - x0, y1 - y0);
      for (let x = x0; x <= x1; x++) { P.p(x, y0, '#5a3a22'); P.p(x, y1, '#5a3a22'); }
      for (let y = y0; y <= y1; y++) { P.p(x0, y, '#5a3a22'); P.p(x1, y, '#5a3a22'); }
      for (let x = x0; x <= x1; x += 6) { P.r(x, y0 - 1, 1, 3, K); P.p(x, y0 - 1, '#8a5a34'); P.r(x, y1 - 1, 1, 3, K); P.p(x, y1 - 1, '#8a5a34'); }
      for (let y = y0; y <= y1; y += 6) { P.r(x0, y - 1, 1, 3, K); P.p(x0, y - 1, '#8a5a34'); P.r(x1, y - 1, 1, 3, K); P.p(x1, y - 1, '#8a5a34'); }
    }
  }
  BG = c; BG_LEVEL = level;
}
// Gold Hill (v0.04): a plateau of golden grass with a rocky, gold-veined face along its front and a gravel lane on top
function drawHill(P, R) {
  const H = HILL, HR = 10, FACE = 15;
  const inTop = (x, y) => { const cx = clamp(x, H.x + HR, H.x + H.w - 1 - HR), cy = clamp(y, H.y + HR, H.y + H.h - 1 - HR); return (x - cx) ** 2 + (y - cy) ** 2 <= HR * HR; };
  P.sh(H.x + 6, H.y + H.h + FACE - 3, H.w - 12, 6, .3);
  // the front face: three rows of rough stones, lit from the top left, with veins of gold
  const stoneCol = ['#8a7a68', '#7e6e5c', '#94846f', '#857563'];
  for (let x = H.x; x < H.x + H.w; x++) {
    let e = H.y + H.h; while (e > H.y && !inTop(x, e - 1)) e--;   // where the grass ends in this column
    for (let fy = 0; fy < FACE; fy++) {
      const y = e + fy; if (inTop(x, y)) continue;
      const row = Math.floor(fy / 5), w = 6 + (row % 2), lx = (x - H.x + row * 3 + 40) % w, ly = fy % 5, id = Math.floor((x - H.x + row * 3 + 40) / w) * 3 + row;
      let col = stoneCol[(id * 7 + row) % 4];
      if (fy === 0) col = '#2a2018';                                  // shadow under the grass lip
      else if (fy === FACE - 1) col = K;
      else if (lx === 0 || ly === 0) col = '#4e4136';                 // cracks between stones
      else if (ly === 1 || lx === 1) col = '#a8987c';                 // the lit top and left of each stone
      else if (lx === w - 1 || ly === 4) col = '#6a5a4b';
      else if (R() < .06) col = R() < .5 ? '#ebc152' : '#ffd463';     // gold
      P.p(x, y, col);
    }
  }
  for (let y = H.y; y < H.y + H.h; y++) for (let x = H.x; x < H.x + H.w; x++) {
    if (!inTop(x, y)) continue;
    const v = R(); let col = '#7f8e3c';
    if (!inTop(x - 1, y) || !inTop(x + 1, y) || !inTop(x, y - 1) || !inTop(x, y + 1)) col = '#3e4a1c';
    else if (!inTop(x, y - 2)) col = '#a5b45a';
    else if (v < .012) col = '#ffd463'; else if (v < .05) col = '#93a347'; else if (v < .12) col = '#74833a'; else if (v < .18) col = '#86963f';
    P.p(x, y, col);
  }
  for (let y = HILL_ROAD.y; y < HILL_ROAD.y + HILL_ROAD.h; y++) for (let x = H.x + 12; x < H.x + H.w - 12; x++) {
    const v = R(); P.p(x, y, y === HILL_ROAD.y || y === HILL_ROAD.y + HILL_ROAD.h - 1 ? '#a8987c' : v < .1 ? '#b8a878' : v < .14 ? '#e0c48a' : '#c9b98a');
  }
}

/* ---------- walkers and particles ---------- */
const WALKERS = [], PARTICLES = [], POPS = [];
const SHIRTS = ['#5b9bd5', '#d9493b', '#ebc152', '#9bbb55', '#b48cff', '#e8874a', '#f0e4cc'];
function spawnWalker(w) {
  w = w || {};
  const R = Math.random;
  if (R() < .6) { w.axis = 'h'; w.dir = R() < .5 ? 1 : -1; w.x = w.dir > 0 ? -TX - 6 : WORLD_W - TX + 2; w.y = ROAD_H.y + 3 + Math.floor(R() * 7); }
  else { const v = ROAD_V[Math.floor(R() * 2)]; w.axis = 'v'; w.dir = R() < .5 ? 1 : -1; w.y = w.dir > 0 ? -TY - 10 : WORLD_H - TY; w.x = v.x + 3 + Math.floor(R() * 8); }
  w.speed = 8 + R() * 6; w.shirt = SHIRTS[Math.floor(R() * SHIRTS.length)]; w.hair = ['#3a2416', '#140d0b', '#8a5a34', '#ebc152'][Math.floor(R() * 4)];
  return w;
}
function stepWalkers(dt) {
  while (WALKERS.length < 14) WALKERS.push(spawnWalker());
  for (const w of WALKERS) {
    if (w.axis === 'h') { w.x += w.dir * w.speed * dt; if (w.x < -TX - 8 || w.x > WORLD_W - TX + 4) spawnWalker(w); }
    else { w.y += w.dir * w.speed * dt; if (w.y < -TY - 12 || w.y > WORLD_H - TY + 2) spawnWalker(w); }
  }
}
function drawWalker(P, w, t) {
  const x = Math.round(w.x), y = Math.round(w.y), step = Math.floor(t * 6 + w.x) % 2;
  P.sh(x, y + 8, 5, 2, .25);
  P.r(x, y, 5, 9, K);
  P.r(x + 1, y + 1, 3, 1, w.hair); P.r(x + 1, y + 2, 3, 2, '#e8b796'); P.p(x + 1, y + 2, w.hair);
  P.r(x + 1, y + 4, 3, 2, w.shirt); P.r(x + 1, y + 6, 3, 2, '#3a2416');
  P.p(x + 2, y + 7, K); if (step) P.p(x + 1, y + 8, '#3a2416'); else P.p(x + 3, y + 8, '#3a2416');
}
function emitSmoke(x, y, heavy) { PARTICLES.push({ x: x + Math.random() * 2 - 1, y, vx: 2 + Math.random() * 3, vy: -(5 + Math.random() * 4), age: 0, life: heavy ? 4 : 3, r0: heavy ? 1.6 : 1.2 }); }
function stepParticles(dt) {
  for (let i = PARTICLES.length - 1; i >= 0; i--) { const p = PARTICLES[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.age > p.life) PARTICLES.splice(i, 1); }
  for (let i = POPS.length - 1; i >= 0; i--) { POPS[i].age += dt; if (POPS[i].age > 1.1) POPS.splice(i, 1); }
}
function drawParticles(P) {
  for (const p of PARTICLES) {
    const k = p.age / p.life, r = p.r0 + k * 3.2;
    const col = k < .35 ? '#d6d0c6' : k < .7 ? '#a8a29a' : '#7a746c';
    P.ctx.globalAlpha = 1 - k * .85; P.ell(p.x, p.y, r, r * .85, col); P.ctx.globalAlpha = 1;
  }
}

