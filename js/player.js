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
    this.trail = [];
    this.grounded = false;
    this.drilling = false;
    this.overdrive = false;
    this.steer = 0;
    this.slowT = 0;                     // hit-a-rock slowdown
    this.impactE = 0;                   // penetration energy budget left
    this.impactE0 = 0;                  // ...and what it started at, for the bore taper
    this.penAngle = Math.PI / 2;        // direction the impact is carrying the drill
    this.soilResist = 1;                // biome resistance multiplier at the crash site
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  launch(v, angle) {
    this.vx = Math.cos(-angle) * v;
    this.vy = Math.sin(-angle) * v;
    this.grounded = false;
    this.squash = -0.55;                // stretch
  }

  /* ---------- flight: a ballistic arc, then one contact ----------
     The pod is a thrown mass. Nothing acts on it but gravity, so mechanical energy is
     conserved and the apex is only a visual promise of the speed coming back. There is
     no air control and no terrain bouncing: the first serious ground contact ends the
     arc and hands the run to onImpact(x, y, speed, angle). */
  updateFlight(dt, onImpact) {
    const sub = U.clamp(Math.ceil((this.speed * dt) / 6), 1, 24);
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      this.vy += CFG.GRAV * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
      const contact = World.yAt(this.x) - this.r;
      if (this.y >= contact) {
        this.y = contact;
        this.grounded = true;
        /* A crawling contact is a landing, not an impact: without this a pod that runs
           out of arc on an upslope would trigger the whole meteor sequence at 40px/s. */
        const spd = this.speed;
        const ang = Math.atan2(this.vy, this.vx);
        this.vx = 0; this.vy = 0;
        onImpact(this.x, this.y + this.r, spd, ang);
        return;
      }
      this.grounded = false;
    }
    /* nose tracks the path exactly — a falling meteor has no reason to flare */
    if (this.speed > 30) this.angle = angleDamp(this.angle, Math.atan2(this.vy, this.vx), 11, dt);
    this.spin += dt * 2.5;

    if (this.speed > 170) {
      this.trail.push({ x: this.x, y: this.y, a: 1 });
      if (this.trail.length > (this.overdrive ? 40 : 26)) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].a -= dt * 2.1;
      if (this.trail[i].a <= 0) this.trail.splice(i, 1);
    }
    this.tickSquash(dt);
  }

  /* ---------- IMPACT mode: automatic penetration ----------
     Carried by leftover impact energy. Speed comes from the energy still in the budget
     (v = scale * sqrt(E), the same shape as E = 1/2 m v2), and each metre of soil takes
     a bite out of it, so the drill slows the way something ploughing through earth does
     rather than on a timer. Returns metres travelled this frame. */
  updatePenetrate(dt, ug, cb) {
    const startY = this.y;
    /* soil gets harder with depth, which guarantees the budget always runs out */
    const depthM = (this.y - ug.surfaceY) / CFG.M;
    const resist = CFG.SOIL_RESISTANCE * this.soilResist * (1 + depthM * CFG.SOIL_HARDEN_PER_M);

    const v = U.clamp(CFG.PEN_SPEED_SCALE * Math.sqrt(Math.max(0, this.impactE)),
                      0, CFG.PEN_MAX_SPEED);
    /* the path bends from the impact angle toward straight down: soil resists sideways
       travel far more than downward, and it leaves the pod pointing down for drilling */
    this.penAngle = angleDamp(this.penAngle, Math.PI / 2, CFG.PEN_TURN, dt);
    const step = v * dt;
    this.x += Math.cos(this.penAngle) * step;
    this.y += Math.sin(this.penAngle) * step;

    /* walls */
    const lo = ug.centerX - ug.halfW + this.r;
    const hi = ug.centerX + ug.halfW - this.r;
    this.x = U.clamp(this.x, lo, hi);

    const metres = Math.abs(this.y - startY) / CFG.M;
    this.impactE = Math.max(0, this.impactE - resist * metres);

    this.angle = angleDamp(this.angle, this.penAngle, 12, dt);
    this.spin += dt * 40;
    this.vx = Math.cos(this.penAngle) * v;     // kept live for FX and the debug readout
    this.vy = Math.sin(this.penAngle) * v;

    /* the drill eats whatever it passes through — no steering required, by design */
    /* Stamp the tunnel with a radius that follows the remaining energy. A violent entry
       tears a wide hole; as the budget drains the bore narrows, so the player can SEE the
       momentum running out before the drill stops — the transition to manual drilling
       reads without any UI saying so.
       Taper against THIS run's own budget, not an absolute constant. Keyed to a fixed 1.0
       the clamp pinned the bore at maximum for the first third of every penetration (and
       for almost all of a high-level one), so the hole read as a uniform smear that
       suddenly stopped. Normalised, the narrowing spans the whole dig at every level. */
    const t = this.impactE0 > 0 ? U.clamp(this.impactE / this.impactE0, 0, 1) : 0;
    const bore = U.lerp(CFG.TUNNEL_R_MIN, CFG.TUNNEL_R_MAX, Math.sqrt(t));
    /* ragged scales with what is left: the entry chews the wall, the tail is nearly clean */
    World.stampTunnel(ug, this.x, this.y, bore, t);
    for (const m of ug.minerals) {
      if (m.got) continue;
      if (Math.hypot(m.x - this.x, m.y - this.y) < this.r + m.r + 6) { m.got = true; cb.mineral(m); }
    }
    for (const r of ug.rocks) {
      if (r.dead) continue;
      if (Math.hypot(r.x - this.x, r.y - this.y) < this.r + r.r) {
        r.dead = true;
        /* rock costs energy: a boulder is what makes one impact stop short of another */
        this.impactE = Math.max(0, this.impactE - CFG.SOIL_RESISTANCE * 1.6);
        cb.rock(r);
      }
    }
    this.tickSquash(dt);
    return { metres, v };
  }

  /* ---------- drilling ---------- */
  updateDrill(dt, ug, cb) {
    const depthPx = this.y - ug.surfaceY;
    const t = U.clamp(depthPx / Math.max(80, ug.botY - ug.surfaceY), 0, 1);
    let targetVy = U.lerp(CFG.DRILL_VY, CFG.DRILL_VY_DEEP, t);
    if (this.slowT > 0) { targetVy *= 0.32; this.slowT -= dt; }
    /* A hard turn costs a little descent. Steering was previously free, which made the
       straight line and the weaving line identical in every way except what they picked
       up — so there was no line to choose. It is deliberately small: a cost you can feel
       in the drill's weight, never one that punishes going after a mineral. */
    targetVy *= 1 - CFG.DRILL_TURN_COST * Math.abs(this.steer);

    this.vy = U.damp(this.vy, targetVy, 6, dt);
    const want = this.steer * targetVy * CFG.DRILL_STEER_RATIO;
    const accel = this.steer === 0 ? CFG.DRILL_AX * 0.85 : CFG.DRILL_AX;
    this.vx += U.clamp(want - this.vx, -accel * dt, accel * dt);
    this.vx *= Math.exp(-1.4 * dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* Walls. The old -0.25 rebound threw the drill back off the edge of the field, which
       reads as a mistake being punished twice; now it just stops dead against the rock and
       the player keeps whatever input they are holding. */
    const lo = ug.centerX - ug.halfW + this.r;
    const hi = ug.centerX + ug.halfW - this.r;
    if (this.x < lo) { this.x = lo; this.vx = 0; }
    if (this.x > hi) { this.x = hi; this.vx = 0; }

    /* Point the nose down the ACTUAL velocity vector. A capped fake lean made the pod
       crab sideways ~15 deg off its own path, which reads as the tail wagging. */
    let target = Math.atan2(this.vy, this.vx);
    /* A rock slowdown cuts vy hard; without this the nose swings past level and the pod
       reads as flying sideways instead of boring downward. */
    target = U.clamp(target, Math.PI / 2 - 0.95, Math.PI / 2 + 0.95);
    this.angle = angleDamp(this.angle, target, 14, dt);
    this.spin += dt * 34;

    /* carve the tunnel. The powered drill bores a clean, constant, NARROW hole — the
       contrast against the torn impact tunnel above is the point, so barely any raggedness
       and a bore that widens only a little when the pod is steering hard. */
    const bore = CFG.TUNNEL_R_MIN * (1 + Math.abs(this.vx) / 320);
    World.stampTunnel(ug, this.x, this.y, bore, 0.35);

    /* collisions */
    /* no carry cap: the pod takes everything it touches */
    for (const m of ug.minerals) {
      if (m.got) continue;
      if (Math.hypot(m.x - this.x, m.y - this.y) < this.r + m.r + 2) {
        m.got = true;
        cb.mineral(m);
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

    /* Skid plate. The pod flares and lands on THIS, never on the bit, so the belly needs
       to look like the part built to take a landing. Without it the flare just looks like
       the pod tipping back for no reason. */
    ctx.fillStyle = '#39455f';
    U.rr(ctx, -R * 1.3, R * 0.46, R * 1.95, R * 0.44, R * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    U.rr(ctx, -R * 1.18, R * 0.53, R * 1.5, R * 0.13, R * 0.065); ctx.fill();

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
