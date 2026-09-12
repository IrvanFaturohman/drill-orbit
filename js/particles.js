'use strict';
/* ============ particles, shockwave rings, floating text ============ */

/* ============ particle silhouettes ============
   Debris used to be literal rotating squares and hard-edged circles, which is what made it
   read as "shapes" rather than as dirt and rock.

   Generated in code rather than authored as sprites, for two reasons. Particles are tinted
   per biome at runtime (grassland soil, desert sandstone, volcanic basalt, embers), so an
   image would need one copy per colour; and pre-rendered sprites measured 3.4x SLOWER than
   filled paths here, because scaling a 40px cell down to a 6px chunk has to filter, several
   hundred times a frame. See the note in drawP for the numbers.                           */
/* Unit silhouettes, built once and shared by every particle — nothing is allocated per
   particle, which only stores which variant it picked. */
const POLY_VARIANTS = 8;
function buildPolys(kind) {
  const rnd = U.mulberry32(kind === 'rock' ? 7717 : kind === 'clod' ? 3331 : 911);
  const out = [];
  for (let v = 0; v < POLY_VARIANTS; v++) {
    const pts = [];
    if (kind === 'shard') {
      /* a splinter: long, thin, lopsided */
      const w = 0.22 + rnd() * 0.22;
      pts.push(0, -1, w, -0.1, w * 0.5, 1, -w * 0.85, 0.3);
    } else {
      const n = kind === 'rock' ? 5 + ((rnd() * 3) | 0)
              : kind === 'puff' ? 9 + ((rnd() * 4) | 0)
              : 7 + ((rnd() * 3) | 0);
      /* stone is angular, soil is lumpy, a dust puff is billowy */
      const wob = kind === 'rock' ? 0.42 : kind === 'puff' ? 0.34 : 0.24;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * U.TAU + (rnd() - 0.5) * 0.5;
        const rr = 1 - wob * rnd();
        pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    out.push(Float32Array.from(pts));
  }
  return out;
}
const POLY = { rock: buildPolys('rock'), clod: buildPolys('clod'), shard: buildPolys('shard') };
const PUFF = buildPolys('puff');
/* the shaded face on the lower-right of a chunk, in the same unit space */
const FACET = Float32Array.from([1, 1, 1, -0.25, -0.15, 0.6, -0.5, 1]);

const FX = {
  ps: [],
  rings: [],
  texts: [],
  MAX: 700,

  reset() { this.ps.length = 0; this.rings.length = 0; this.texts.length = 0; },

  add(p) {
    if (this.ps.length >= this.MAX) this.ps.shift();
    p.t = 0;
    p.rot = p.rot || 0;
    p.vr = p.vr || 0;
    p.g = p.g === undefined ? 900 : p.g;
    p.drag = p.drag === undefined ? 0.6 : p.drag;
    p.shape = p.shape || 'circle';
    /* `square` was the old name for debris; it now means a real rock chunk */
    if (p.shape === 'square') p.shape = 'rock';
    /* pick this chunk's silhouette once, so it does not flicker between frames */
    p.v = (Math.random() * POLY_VARIANTS) | 0;
    this.ps.push(p);
    return p;
  },

  /* Where a burst's particles START. Two options, both there for the same reason: an
     impact freezes the frame for ~100ms right after spawning a few hundred particles, and
     particles that all begin life at one point read as a single opaque blob for the whole
     freeze — the explosion only becomes an explosion once it has been allowed to move.
       spanX   spawns them along a width (the crater mouth) instead of a point.
       groundY places each one on the ground it is thrown from, so debris leaves the
               surface rather than erupting out of mid-air above a hole.
       lead    pre-advances each particle along its own velocity by up to this many
               seconds, so frame zero already looks like a spray. Invisible in motion. */
  spawnAt(x, y, opt, vx, vy) {
    const spanX = opt.spanX || 0;
    const ox = x + (spanX ? U.rand(-spanX, spanX) : 0) + U.rand(-4, 4);
    const oy = opt.groundY ? opt.groundY(ox) + U.rand(-4, 2) : y + U.rand(-4, 4);
    const l = opt.lead ? Math.random() * opt.lead : 0;
    return { x: ox + vx * l, y: oy + vy * l };
  },

  /* generic radial burst */
  burst(x, y, opt) {
    const n = opt.n || 12;
    const spread = opt.spread === undefined ? U.TAU : opt.spread;
    const dir = opt.dir === undefined ? -Math.PI / 2 : opt.dir;
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = U.rand(opt.spd0 || 60, opt.spd1 || 260);
      const vx = Math.cos(a) * s, vy = Math.sin(a) * s;
      const o = this.spawnAt(x, y, opt, vx, vy);
      this.add({
        x: o.x, y: o.y,
        vx, vy,
        r: U.rand(opt.r0 || 2, opt.r1 || 6),
        life: U.rand(opt.life0 || 0.3, opt.life1 || 0.75),
        color: Array.isArray(opt.color) ? U.pick(opt.color) : opt.color || '#fff',
        g: opt.g, drag: opt.drag, glow: opt.glow, shape: opt.shape,
        vr: U.rand(-8, 8), fadeIn: opt.fadeIn,
      });
    }
  },

  /* soft ground dust puff. `opt` takes the same spanX/groundY/lead as burst(). */
  dust(x, y, n, color, power, opt) {
    const o = opt || {};
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + U.rand(-1.35, 1.35);
      const s = U.rand(30, 180) * (power || 1);
      const vx = Math.cos(a) * s, vy = Math.sin(a) * s * 0.55;
      const at = this.spawnAt(x, y, o, vx, vy);
      this.add({
        x: at.x + U.rand(-6, 6), y: at.y + U.rand(-3, 5),
        vx, vy,
        r: U.rand(5, 14) * (0.7 + (power || 1) * 0.4),
        life: U.rand(0.45, 1.0), color, g: -25, drag: 1.7, grow: U.rand(8, 26),
        shape: 'dust', vr: U.rand(-1.2, 1.2),
      });
    }
  },

  /* engine flame */
  flame(x, y, dir, power) {
    for (let i = 0; i < 3; i++) {
      const a = dir + U.rand(-0.35, 0.35);
      const s = U.rand(120, 380) * power;
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: U.rand(4, 11), life: U.rand(0.14, 0.3),
        color: U.pick(['#fff3b0', '#ffb03a', '#ff6a2a', '#ff3d2e']),
        g: 0, drag: 3.5, glow: true, shrink: true,
        shape: 'shard', rot: a + Math.PI / 2, vr: U.rand(-4, 4),
      });
    }
  },

  streak(x, y, vx, vy, color) {
    this.add({ x, y, vx, vy, r: U.rand(1.2, 2.6), life: U.rand(0.18, 0.4), color, g: 0, drag: 1.2, glow: true, shape: 'streak' });
  },

  ring(x, y, o) {
    this.rings.push({
      x, y, t: 0, life: o.life || 0.45,
      r0: o.r0 || 6, r1: o.r1 || 90,
      w: o.w || 5, color: o.color || '#fff', fill: !!o.fill,
    });
  },

  text(x, y, str, o) {
    o = o || {};
    this.texts.push({
      x, y, str, t: 0, life: o.life || 0.9,
      color: o.color || '#fff', size: o.size || 18,
      vy: o.vy === undefined ? -46 : o.vy, vx: o.vx || 0,
      stroke: o.stroke === undefined ? true : o.stroke,
      pop: o.pop === undefined ? 1 : o.pop,
    });
  },

  update(dt) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.t += dt;
      if (p.t >= p.life) { this.ps.splice(i, 1); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.grow) p.r += p.grow * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-2.4 * dt);
    }
  },

  /* world-space draw. zoom is used to keep text readable */
  draw(ctx, zoom) {
    /* --- rings --- */
    for (const r of this.rings) {
      const k = r.t / r.life;
      const rad = U.lerp(r.r0, r.r1, U.easeOutCubic(k));
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, U.TAU);
      if (r.fill) { ctx.fillStyle = r.color; ctx.fill(); }
      else { ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - k * 0.7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    /* --- normal particles --- */
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.ps) if (!p.glow) drawP(ctx, p);
    /* --- additive glow particles --- */
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ps) if (p.glow) drawP(ctx, p);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    /* --- floating text --- */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.t / t.life;
      const pop = t.pop ? U.lerp(0.4, 1, U.clamp(U.easeOutBack(U.clamp(k * 5, 0, 1)), 0, 1.3)) : 1;
      const size = (t.size / zoom) * pop;
      ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      ctx.font = `bold ${size}px ${FONT}`;
      if (t.stroke) {
        ctx.lineWidth = size * 0.22;
        ctx.strokeStyle = 'rgba(0,0,0,.62)';
        ctx.lineJoin = 'round';
        ctx.strokeText(t.str, t.x, t.y);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
};

function drawP(ctx, p) {
  const k = p.t / p.life;
  let a = 1 - k * k;
  if (p.fadeIn && k < 0.15) a *= k / 0.15;
  ctx.globalAlpha = U.clamp(a, 0, 1);
  const r = p.shrink ? p.r * (1 - k) : p.r;
  if (r <= 0.1) return;

  /* Chunks: an irregular filled polygon, transformed BY HAND.
     Measured per 200 particles, over a 0.71 ms empty-scene baseline:
       plain circle 0.26 · shard 0.57 · sprite 0.93 · polygon-with-save/restore 1.25
     The cost was never the shape — it was five canvas state calls per particle
     (save, translate, rotate, scale, restore). Rotating eight vertices in JS is free by
     comparison, so the transform happens here and the context is left alone. */
  const poly = POLY[p.shape];
  if (poly) {
    const pts = poly[p.v % POLY_VARIANTS];
    const cs = p.rot ? Math.cos(p.rot) : 1;
    const sn = p.rot ? Math.sin(p.rot) : 0;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i] * r, py = pts[i + 1] * r;
      const X = p.x + px * cs - py * sn;
      const Y = p.y + px * sn + py * cs;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath();
    ctx.fill();
    /* one shadow triangle gives the chunk volume, on any tint, without a second colour.
       Only worth a second path once the chunk is big enough to read one. */
    if (r > 6) {
      const f = FACET;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      for (let i = 0; i < f.length; i += 2) {
        const px = f[i] * r, py = f[i + 1] * r;
        const X = p.x + px * cs - py * sn;
        const Y = p.y + px * sn + py * cs;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = p.color;
  /* dust: two flat discs instead of a gradient. A soft rim for one extra arc, where a
     per-particle radial gradient or a scaled sprite cost three times as much. */
  /* Dust: two nested BILLOWY silhouettes at low alpha, hand-transformed like a chunk.
     Perfect circles at 0.5/0.85 alpha made every puff read as a separate hard-edged
     bubble, and forty of them at an impact looked like soap rather than a dust cloud.
     Lumpy outlines that are individually faint accumulate into one mass instead. */
  if (p.shape === 'dust') {
    const pts = PUFF[p.v % POLY_VARIANTS];
    const cs = p.rot ? Math.cos(p.rot) : 1;
    const sn = p.rot ? Math.sin(p.rot) : 0;
    const base = ctx.globalAlpha * (0.82 + (p.v % 4) * 0.08);
    const ring = (rad, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const px = pts[i] * rad, py = pts[i + 1] * rad;
        const X = p.x + px * cs - py * sn;
        const Y = p.y + px * sn + py * cs;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.closePath();
      ctx.fill();
    };
    ring(r, base * 0.30);
    ring(r * 0.62, base * 0.34);
    return;
  }
  if (p.shape === 'streak') {
    /* tapered, not a constant-width line: wide at the head, nothing at the tail */
    const tx = p.x - p.vx * 0.035, ty = p.y - p.vy * 0.035;
    const nx = -(ty - p.y), ny = tx - p.x;
    const len = Math.hypot(nx, ny) || 1;
    ctx.beginPath();
    ctx.moveTo(p.x + (nx / len) * r * 0.5, p.y + (ny / len) * r * 0.5);
    ctx.lineTo(p.x - (nx / len) * r * 0.5, p.y - (ny / len) * r * 0.5);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, U.TAU);
    ctx.fill();
  }
}
