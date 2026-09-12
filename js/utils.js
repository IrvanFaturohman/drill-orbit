'use strict';
/* ============ tiny math / draw helpers ============ */
/* one font stack shared by CSS and canvas so DOM and drawn text always match */
const FONT = '"Fredoka", "Trebuchet MS", Verdana, system-ui, sans-serif';

/* Shown at the bottom of the debug panel. Bump it with any change worth play-testing, so
   "is the build I'm looking at the one that was just edited?" is answerable at a glance
   instead of by guessing at the browser cache. */
const BUILD = '12 Sep · skyline scale';


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
  /* Accepts '#rgb', '#rrggbb' AND 'rgb(r,g,b)'. That last form is not decoration: U.mix
     RETURNS 'rgb(...)', so any mixed colour handed back to hex() used to parse as NaN and
     come out (0,0,0). Every atmosphere blend band is a mix, which is why the mountains
     turned black for the 72 metres either side of each atmosphere change and were fine
     everywhere else — a bug that only ever showed up in a narrow strip of the world. */
  hex(h) {
    const m = /^rgba?\(([^)]+)\)$/.exec(h);
    if (m) {
      const p = m[1].split(',');
      return [+p[0] | 0, +p[1] | 0, +p[2] | 0];
    }
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
  /* Mixing two colours in RGB cannot carry a hue across: a brown soil mixed halfway into a
     dark blue plain stays brown, because darkening the target toward black strips the very
     saturation that would have pulled the hue over. Measured on this game's own palettes,
     a straight 50% mix left the ground 174 degrees of hue away from its sky in SKYRIDGE
     while looking fine in the desert, purely because the desert already matched.
     So tint in HSL and be explicit about what moves: hue and saturation travel toward the
     target, LIGHTNESS stays the base's own. That is what keeps soil reading as solid
     ground under any sky instead of turning into a patch of the sky. */
  rgb2hsl(c) {
    const [r, g, b] = U.hex(c).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    if (d < 1e-6) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: ((h * 60) + 360) % 360, s, l };
  },
  hsl2rgb(h, s, l) {
    /* k first, and x from k. Deriving x from the raw hue is the trap: a tint that rotates
       the short way round the colour wheel routinely hands this a NEGATIVE hue, JS keeps
       the sign through %, and the channel comes out negative — measured once as
       rgb(-72,48,111). The clamp at the end is belt and braces. */
    const k = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((k / 60) % 2) - 1));
    const m = l - c / 2;
    const v = k < 60 ? [c, x, 0] : k < 120 ? [x, c, 0] : k < 180 ? [0, c, x]
            : k < 240 ? [0, x, c] : k < 300 ? [x, 0, c] : [c, 0, x];
    const ch = (n) => Math.max(0, Math.min(255, Math.round((n + m) * 255)));
    return `rgb(${ch(v[0])},${ch(v[1])},${ch(v[2])})`;
  },
  /* pull `c` toward `target`'s hue and saturation, keeping `c`'s own lightness */
  tint(c, target, hAmt, sAmt, lAdj) {
    const a = U.rgb2hsl(c), b = U.rgb2hsl(target);
    let dh = b.h - a.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;      // always rotate the short way round
    const h = b.s < 0.02 ? a.h : a.h + dh * hAmt;
    return U.hsl2rgb(h, U.lerp(a.s, b.s, sAmt), U.clamp(a.l + (lAdj || 0), 0, 1));
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
