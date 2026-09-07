'use strict';
/* ============ the drilling pod ============ */

/* how far back to shift the drawn body so the drill tip, not the waist, is the pivot */
const NOSE_PIVOT = 0.95;

class Pod {
  constructor() {
    this.r = 19;
    this.reset(CFG.PAD_X, 0);
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = 0;
    this.spin = 0;
    this.sx = 1; this.sy = 1;          // squash / stretch
    this.squash = 0;                    // impact impulse
    this.charge = 0;                    // pre-launch compression
    this.boost = 0;                     // booster flame timer
    this.trail = [];
    this.grounded = false;
    this.rolling = false;
    this.restT = 0;
    this.bounces = 0;
    this.drilling = false;
    this.overdrive = false;
    this.steer = 0;
    this.slowT = 0;                     // hit-a-rock slowdown
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  launch(v, angle) {
    this.vx = Math.cos(-angle) * v;
    this.vy = Math.sin(-angle) * v;
    this.grounded = false;
    this.rolling = false;
    this.boost = 0.5;
    this.squash = -0.55;                // stretch
    this.bounces = 0;
  }

  /* ---------- flight ---------- */
  updateFlight(dt, onBounce) {
    const sub = U.clamp(Math.ceil((this.speed * dt) / 6), 1, 24);
    const h = dt / sub;

    for (let i = 0; i < sub; i++) {
      this.vy += CFG.GRAV * h;
      this.x += this.vx * h;
      this.y += this.vy * h;

      const gy = World.yAt(this.x);
      const contact = gy - this.r;

      if (this.y >= contact) {
        const sl = World.slopeAt(this.x);
        const len = Math.hypot(sl, 1);
        const nx = sl / len, ny = -1 / len;              // up-normal
        const vn = this.vx * nx + this.vy * ny;
        this.y = contact;
        this.grounded = true;

        if (vn < 0) {
          const impact = -vn;
          if (impact > 62 && !this.rolling) {
            const e = Game.restitution();
            this.vx -= (1 + e) * vn * nx;
            this.vy -= (1 + e) * vn * ny;
            // tangential scrub
            const tx = 1 / len, ty = sl / len;
            const vt = this.vx * tx + this.vy * ty;
            const keep = 0.965;
            this.vx += (vt * keep - vt) * tx;
            this.vy += (vt * keep - vt) * ty;
            this.bounces++;
            this.squash = 0.75;
            if (onBounce) onBounce(this.x, this.y + this.r, impact);
          } else {
            // settle into a roll along the slope
            this.vx -= vn * nx;
            this.vy -= vn * ny;
            this.rolling = true;
          }
        }
        if (this.rolling) {
          // gravity along the tangent + rolling friction
          const tx = 1 / len, ty = sl / len;
          const gt = CFG.GRAV * ty;
          this.vx += gt * tx * h;
          this.vy += gt * ty * h;
          /* landing zones grip a pod that is already rolling, without stealing energy
             from one that is still bouncing through at speed */
          const inZone = World.siteAt(World.mOf(this.x)) !== null;
          const fr = Math.exp(-(inZone ? 5.2 : 2.7) * h);
          this.vx *= fr; this.vy *= fr;
        }
      } else {
        this.grounded = false;
        if (this.vy > 40) this.rolling = false;
      }
    }

    /* orientation follows the velocity vector */
    if (!this.rolling && this.speed > 30) {
      const target = Math.atan2(this.vy, this.vx);
      this.angle = angleDamp(this.angle, target, 9, dt);
    }
    this.spin += dt * U.clamp(this.speed / 90, 4, 26);

    /* trail */
    if (this.speed > 170) {
      this.trail.push({ x: this.x, y: this.y, a: 1 });
      if (this.trail.length > (this.overdrive ? 40 : 26)) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].a -= dt * 2.1;
      if (this.trail[i].a <= 0) this.trail.splice(i, 1);
    }

    this.boost = Math.max(0, this.boost - dt);
    this.tickSquash(dt);

    /* rest detection */
    if (this.grounded && this.speed < 52) this.restT += dt;
    else this.restT = 0;
  }

  /* ---------- drilling ---------- */
  updateDrill(dt, ug, cb) {
    const depthPx = this.y - ug.surfaceY;
    const t = U.clamp(depthPx / Math.max(80, ug.botY - ug.surfaceY), 0, 1);
    let targetVy = U.lerp(CFG.DRILL_VY, CFG.DRILL_VY_DEEP, t);
    if (this.slowT > 0) { targetVy *= 0.32; this.slowT -= dt; }

    this.vy = U.damp(this.vy, targetVy, 6, dt);
    const want = this.steer * CFG.DRILL_VX_MAX;
    const accel = this.steer === 0 ? CFG.DRILL_AX * 0.85 : CFG.DRILL_AX;
    this.vx += U.clamp(want - this.vx, -accel * dt, accel * dt);
    this.vx *= Math.exp(-1.4 * dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* walls */
    const lo = ug.centerX - ug.halfW + this.r;
    const hi = ug.centerX + ug.halfW - this.r;
    if (this.x < lo) { this.x = lo; this.vx *= -0.25; }
    if (this.x > hi) { this.x = hi; this.vx *= -0.25; }

    /* Point the nose down the ACTUAL velocity vector. A capped fake lean made the pod
       crab sideways ~15 deg off its own path, which reads as the tail wagging. */
    let target = Math.atan2(this.vy, this.vx);
    /* A rock slowdown cuts vy hard; without this the nose swings past level and the pod
       reads as flying sideways instead of boring downward. */
    target = U.clamp(target, Math.PI / 2 - 0.95, Math.PI / 2 + 0.95);
    this.angle = angleDamp(this.angle, target, 14, dt);
    this.spin += dt * 34;

    /* carve the tunnel */
    const tn = ug.tunnel;
    if (!tn.length || Math.hypot(this.x - tn[tn.length - 1].x, this.y - tn[tn.length - 1].y) > 9)
      tn.push({ x: this.x, y: this.y });

    /* collisions */
    /* a full pod leaves minerals in the ground */
    if (cb.canCollect()) {
      for (const m of ug.minerals) {
        if (m.got) continue;
        if (Math.hypot(m.x - this.x, m.y - this.y) < this.r + m.r + 2) {
          m.got = true;
          cb.mineral(m);
          if (!cb.canCollect()) break;
        }
      }
    }
    for (const r of ug.rocks) {
      if (r.dead) continue;
      if (Math.hypot(r.x - this.x, r.y - this.y) < this.r + r.r) {
        r.hit += dt;
        this.slowT = 0.28;
        if (r.hit > 0.22) { r.dead = true; cb.rock(r); }
        else cb.grind(r);
      }
    }

    this.tickSquash(dt);
  }

  tickSquash(dt) {
    this.squash = U.damp(this.squash, 0, 9, dt);
    const stretch = this.drilling ? 0 : U.clamp(this.speed / 4200, 0, 0.22);
    this.sx = 1 + stretch - this.squash * 0.42 + this.charge * 0.32;
    this.sy = 1 - stretch + this.squash * 0.42 - this.charge * 0.30;
  }

  /* ---------- drawing ---------- */
  drawTrail(ctx) {
    if (this.trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.strokeStyle = pass ? 'rgba(120,240,255,.55)' : 'rgba(60,150,255,.22)';
      ctx.lineWidth = pass ? 6 : 17;
      ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx) {
    const R = this.r;
    ctx.save();

    /* overdrive bloom: a soft additive halo behind the pod */
    if (this.overdrive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const t = performance.now() / 1000;
      const rad = R * (3.4 + Math.sin(t * 14) * 0.25);
      const g = ctx.createRadialGradient(this.x, this.y, R * 0.4, this.x, this.y, rad);
      g.addColorStop(0, 'rgba(255,225,160,.75)');
      g.addColorStop(0.45, 'rgba(255,140,50,.35)');
      g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y, rad, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    /* Body geometry runs +2.05R (bit) to -1.5R (boosters). Shifting it back puts (x,y) —
       the collision + tunnel point — at the cutting tip, so the bit leads and the body
       trails it instead of the whole pod pivoting about its waist. */
    ctx.translate(-R * NOSE_PIVOT, 0);
    ctx.scale(this.sx, this.sy);

    /* boosters */
    ctx.fillStyle = '#3b4a68';
    U.rr(ctx, -R * 1.45, -R * 0.95, R * 0.6, R * 0.6, 3); ctx.fill();
    U.rr(ctx, -R * 1.45, R * 0.35, R * 0.6, R * 0.6, 3); ctx.fill();

    /* body */
    const bg = ctx.createLinearGradient(0, -R, 0, R);
    if (this.overdrive) {
      bg.addColorStop(0, '#fff6dc');
      bg.addColorStop(0.42, '#ffcf8a');
      bg.addColorStop(1, '#d1662a');
    } else {
      bg.addColorStop(0, '#eef4ff');
      bg.addColorStop(0.42, '#b9c7dd');
      bg.addColorStop(1, '#67789a');
    }
    ctx.fillStyle = bg;
    U.rr(ctx, -R * 1.5, -R * 0.82, R * 2.2, R * 1.64, R * 0.8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,60,.55)';
    ctx.lineWidth = 2;
    U.rr(ctx, -R * 1.5, -R * 0.82, R * 2.2, R * 1.64, R * 0.8);
    ctx.stroke();

    /* energy accents */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(90,225,255,.9)';
    U.rr(ctx, -R * 1.2, -R * 0.62, R * 0.26, R * 1.24, R * 0.13); ctx.fill();
    U.rr(ctx, -R * 0.75, -R * 0.62, R * 0.18, R * 1.24, R * 0.09); ctx.fill();
    ctx.restore();

    /* cockpit */
    const cg = ctx.createLinearGradient(0, -R * 0.5, 0, R * 0.3);
    cg.addColorStop(0, '#9ff0ff'); cg.addColorStop(1, '#1d6ea8');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(R * 0.12, -R * 0.06, R * 0.42, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.ellipse(R * 0.02, -R * 0.22, R * 0.16, R * 0.09, -0.5, 0, U.TAU); ctx.fill();

    /* drill bit */
    ctx.save();
    ctx.translate(R * 0.6, 0);
    const dg = ctx.createLinearGradient(0, -R * 0.7, 0, R * 0.7);
    dg.addColorStop(0, '#ffd97a'); dg.addColorStop(0.5, '#e8a63b'); dg.addColorStop(1, '#9c6418');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.moveTo(R * 1.45, 0);
    ctx.lineTo(0, -R * 0.72);
    ctx.lineTo(0, R * 0.72);
    ctx.closePath(); ctx.fill();
    /* spiral flutes */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(R * 1.45, 0); ctx.lineTo(0, -R * 0.72); ctx.lineTo(0, R * 0.72);
    ctx.closePath(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = R * 0.16;
    for (let i = 0; i < 4; i++) {
      const o = ((this.spin * 0.5 + i * 0.5) % 2) - 0.5;
      ctx.beginPath();
      ctx.moveTo(o * R * 0.9, -R * 0.9);
      ctx.lineTo(o * R * 0.9 + R * 0.75, R * 0.9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,40,10,.5)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(R * 1.45, 0); ctx.lineTo(0, -R * 0.72); ctx.lineTo(0, R * 0.72);
    ctx.closePath(); ctx.stroke();
    ctx.restore();

    /* nose glow when drilling */
    if (this.drilling) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(R * 1.9, 0, 1, R * 1.9, 0, R * 1.5);
      g.addColorStop(0, 'rgba(255,220,140,.75)');
      g.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(R * 1.9, 0, R * 1.5, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

function angleDamp(a, target, lambda, dt) {
  let d = ((target - a + Math.PI) % U.TAU + U.TAU) % U.TAU - Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}
