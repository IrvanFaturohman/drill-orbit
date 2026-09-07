'use strict';
/* ============ particles, shockwave rings, floating text ============ */

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
    this.ps.push(p);
    return p;
  },

  /* generic radial burst */
  burst(x, y, opt) {
    const n = opt.n || 12;
    const spread = opt.spread === undefined ? U.TAU : opt.spread;
    const dir = opt.dir === undefined ? -Math.PI / 2 : opt.dir;
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = U.rand(opt.spd0 || 60, opt.spd1 || 260);
      this.add({
        x: x + U.rand(-4, 4), y: y + U.rand(-4, 4),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: U.rand(opt.r0 || 2, opt.r1 || 6),
        life: U.rand(opt.life0 || 0.3, opt.life1 || 0.75),
        color: Array.isArray(opt.color) ? U.pick(opt.color) : opt.color || '#fff',
        g: opt.g, drag: opt.drag, glow: opt.glow, shape: opt.shape,
        vr: U.rand(-8, 8), fadeIn: opt.fadeIn,
      });
    }
  },

  /* soft ground dust puff */
  dust(x, y, n, color, power) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + U.rand(-1.35, 1.35);
      const s = U.rand(30, 180) * (power || 1);
      this.add({
        x: x + U.rand(-10, 10), y: y + U.rand(-3, 5),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.55,
        r: U.rand(5, 14) * (0.7 + (power || 1) * 0.4),
        life: U.rand(0.45, 1.0), color, g: -25, drag: 1.7, grow: U.rand(8, 26),
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
  ctx.fillStyle = p.color;
  const r = p.shrink ? p.r * (1 - k) : p.r;
  if (r <= 0.1) return;
  if (p.shape === 'square') {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  } else if (p.shape === 'streak') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = r;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    ctx.stroke();
  } else if (p.shape === 'shard') {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, U.TAU);
    ctx.fill();
  }
}
