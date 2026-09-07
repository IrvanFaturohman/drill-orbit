'use strict';
/* ============ tiny math / draw helpers ============ */
/* one font stack shared by CSS and canvas so DOM and drawn text always match */
const FONT = '"Fredoka", "Trebuchet MS", Verdana, system-ui, sans-serif';


const U = {
  TAU: Math.PI * 2,
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  map(v, a, b, c, d) {
    const t = U.clamp((v - a) / (b - a), 0, 1);
    return c + (d - c) * t;
  },
  /* frame-rate independent lerp */
  damp: (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt)),
  smooth: (t) => t * t * (3 - 2 * t),
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  chance: (p) => Math.random() < p,
  pick: (a) => a[(Math.random() * a.length) | 0],
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  easeOutBack(t) {
    const c1 = 1.9, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const p = 0.36;
    return Math.pow(2, -9 * t) * Math.sin(((t - p / 4) * U.TAU) / p) + 1;
  },

  /* deterministic RNG */
  mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /* smooth seeded 1D value noise, returns 0..1 */
  noise1(seed) {
    const r = U.mulberry32(seed | 0);
    const N = 512;
    const tab = new Float32Array(N);
    for (let i = 0; i < N; i++) tab[i] = r();
    return function (x) {
      const i = Math.floor(x), f = x - i;
      const a = tab[((i % N) + N) % N];
      const b = tab[(((i + 1) % N) + N) % N];
      return U.lerp(a, b, U.smooth(f));
    };
  },

  /* rounded rect path (avoids relying on ctx.roundRect) */
  rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  /* colours */
  hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  mix(c1, c2, t) {
    const a = typeof c1 === 'string' ? U.hex(c1) : c1;
    const b = typeof c2 === 'string' ? U.hex(c2) : c2;
    return `rgb(${Math.round(U.lerp(a[0], b[0], t))},${Math.round(U.lerp(a[1], b[1], t))},${Math.round(U.lerp(a[2], b[2], t))})`;
  },
  rgba(c, a) {
    const [r, g, b] = typeof c === 'string' ? U.hex(c) : c;
    return `rgba(${r},${g},${b},${a})`;
  },
  shade(c, amt) {
    const [r, g, b] = U.hex(c);
    const f = amt < 0 ? 0 : 255;
    const t = Math.abs(amt);
    return `rgb(${Math.round(U.lerp(r, f, t))},${Math.round(U.lerp(g, f, t))},${Math.round(U.lerp(b, f, t))})`;
  },

  /* star / polygon path */
  star(ctx, x, y, spikes, outer, inner, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = rot + (i * Math.PI) / spikes;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  },
};
