'use strict';
/* ============ tuning ============ */
const CFG = {
  M: 8,                    // world pixels per metre
  GRAV: 1250,
  BASE_V: 650,            // launch speed at perfect timing, power lv1
  ANGLE: 52 * Math.PI / 180,   // lebih curam = busur lebih tinggi + lebih lama di udara
  PAD_X: 110,              // launch pad world x
  SURFACE_Y: 140,          // baseline surface world y

  POWER_PER: 0.10,         // +10% launch speed / level
  BOUNCE_BASE: 0.56,
  BOUNCE_PER: 0.08,        // +8% restitution / level
  BOUNCE_MAX: 0.80,
  DEPTH_BASE: 38,          // metres
  DEPTH_PER: 10,
  STORAGE_BASE: 5,
  STORAGE_PER: 1,

  DRILL_VY: 50,            // world px/s downward at depth 0
  DRILL_VY_DEEP: 78,
  DRILL_AX: 190,           // steering acceleration
  DRILL_VX_MAX: 44,

  MINE_DEPTH_MULT: 1.5,
  MINE_RARE_BOOST: 2.2,

  PERFECT_ACC: 0.90,       // timing accuracy needed for PERFECT
  SOCLOSE_ACC: 0.84,       // narrow miss -> "SO CLOSE!" (presentation only)
  OVERDRIVE_T: 2.6,        // seconds of PERFECT overdrive after launch
  OVERDRIVE_BOUNCE: 1.5,   // extra seconds granted by the first big overdrive bounce
  BEST_CHASE_M: 45,        // start the record countdown this far out

  AD_MULT: 2,              // rewarded-ad placeholder multiplier
  DIST_COIN: 14,           // distance payout = DIST_COIN * sqrt(metres):
                           // front-loads early upgrades, lets minerals lead later
  WORLD_M: 3000,          // world length in metres
};

/* ============ minerals ============ */
const MINERALS = {
  coal:    { name: 'COAL',           value: 2,   color: '#3d4152', edge: '#6a7086', tier: 0 },
  copper:  { name: 'COPPER',         value: 4,   color: '#e08040', edge: '#ffb37a', tier: 0 },
  iron:    { name: 'IRON',           value: 6,   color: '#aab6c4', edge: '#e2ecf5', tier: 0 },
  gold:    { name: 'GOLD',           value: 12,  color: '#ffc82e', edge: '#fff0a8', tier: 1 },
  ruby:    { name: 'RUBY',           value: 20,  color: '#ff3f6b', edge: '#ff9db3', tier: 1 },
  diamond: { name: 'DIAMOND',        value: 50,  color: '#6ef0ff', edge: '#e6ffff', tier: 2 },
  fossil:  { name: 'FOSSIL',         value: 75,  color: '#f0e0b8', edge: '#fffbe8', tier: 2 },
  alien:   { name: 'ALIEN ARTIFACT', value: 150, color: '#b06bff', edge: '#e7c6ff', tier: 2 },
};

const BIOMES = {
  grass: {
    name: 'GRASSLAND',
    sky0: '#7fd4ff', sky1: '#dff4ff',
    top: '#5fcf5a', top2: '#37a544', soil: '#7a5230', soil2: '#4a3220',
    far: '#8fb9d8', mid: '#5f8fb5',
    pool: { coal: 5, copper: 4.2, iron: 3, gold: 1.2, ruby: 0.5, diamond: 0.16, fossil: 0.12, alien: 0.05 },
  },
  desert: {
    name: 'DESERT',
    sky0: '#f2a34e', sky1: '#ffdca8',
    top: '#f0c069', top2: '#d29a45', soil: '#b07f42', soil2: '#7a5730',
    far: '#e6b487', mid: '#c98f5e',
    pool: { coal: 1.8, copper: 3, iron: 3, gold: 3.6, ruby: 2, diamond: 0.4, fossil: 1.3, alien: 0.16 },
  },
  volcano: {
    name: 'VOLCANIC',
    sky0: '#4a2338', sky1: '#c2554a',
    top: '#4a3b47', top2: '#2f2530', soil: '#3a2a30', soil2: '#241a1f',
    far: '#5a3a4a', mid: '#3b2733',
    pool: { coal: 1, copper: 1.4, iron: 2.4, gold: 2.4, ruby: 3.4, diamond: 1.9, fossil: 0.9, alien: 0.8 },
  },
};

/* ============ surface sites ============
   Named points along the world. Three roles:
     decor     - scenery only; never in the UI, no reward
     milestone - landing inside pays out; drives NEXT / near-miss / strip
     mystery   - shows as ??? until first reached, then keeps its real name
   `half` is the landing half-width in metres (0 = not landable).
   `near` is how close a stop must be to earn "Xm SHORT!" feedback.          */
const SITES = [
  { id: 'crate',   m: 58,   half: 8,    near: 7,  kind: 'milestone', art: 'crate',    name: 'SUPPLY CRATE',     reward: { coins: 90 } },
  { id: 'crystal', m: 96,   half: 10,   near: 8,  kind: 'milestone', art: 'crystal',  name: 'CRYSTAL PIT',      reward: { rare: 3.2 } },
  { id: 'wreck',   m: 132,  half: 9,    near: 8,  kind: 'mystery',   art: 'wreck',    name: 'RUSTED EXCAVATOR', reward: { coins: 170 } },
  { id: 'arch',    m: 172,  half: 0,               kind: 'decor',     art: 'arch',     name: 'STONE ARCH' },
  { id: 'crater',  m: 224,  half: 12,   near: 10, kind: 'milestone', art: 'crater',   name: 'METEOR CRATER',    reward: { depth: 14 } },
  { id: 'bridge',  m: 272,  half: 0,               kind: 'decor',     art: 'bridge',   name: 'OLD BRIDGE' },
  { id: 'bones',   m: 344,  half: 11,   near: 9,  kind: 'mystery',   art: 'bones',    name: 'GIANT SKELETON',   reward: { coins: 340 } },
  { id: 'obelisk', m: 430,  half: 0,               kind: 'decor',     art: 'obelisk',  name: 'OBELISK' },
  { id: 'mine',    m: 512.5, half: 17.5, near: 12, kind: 'major',    art: 'mine',     name: 'ANCIENT MINE',     reward: { depthMult: 1.5, rare: 2.2 } },
  { id: 'rig',     m: 664,  half: 12,   near: 10, kind: 'mystery',   art: 'rig',      name: 'ABANDONED RIG',    reward: { coins: 760 } },
  { id: 'lava',    m: 884,  half: 14,   near: 11, kind: 'milestone', art: 'lava',     name: 'LAVA TUBE',        reward: { depth: 24 } },
  { id: 'tower',   m: 1160, half: 16,   near: 12, kind: 'mystery',   art: 'towerbase', name: 'SIGNAL TOWER',    reward: { coins: 2400 } },
];

const World = {
  step: 12,
  hs: null,
  props: [],
  landmarks: [],
  ug: null,           // active underground field

  /* ---------- biome ---------- */
  biomeKeyAt(xm) { return xm < 300 ? 'grass' : xm < 700 ? 'desert' : 'volcano'; },

  /* blended palette so transitions read smoothly */
  paletteAt(xm) {
    let a, b, t;
    if (xm < 240) { a = 'grass'; b = 'grass'; t = 0; }
    else if (xm < 320) { a = 'grass'; b = 'desert'; t = U.smooth((xm - 240) / 80); }
    else if (xm < 640) { a = 'desert'; b = 'desert'; t = 0; }
    else if (xm < 720) { a = 'desert'; b = 'volcano'; t = U.smooth((xm - 640) / 80); }
    else { a = 'volcano'; b = 'volcano'; t = 0; }
    const A = BIOMES[a], B = BIOMES[b];
    const out = {};
    for (const k of ['sky0', 'sky1', 'top', 'top2', 'soil', 'soil2', 'far', 'mid'])
      out[k] = t === 0 ? A[k] : U.mix(A[k], B[k], t);
    out.key = t < 0.5 ? a : b;
    return out;
  },

  /* ---------- terrain ---------- */
  init(seed) {
    const n1 = U.noise1(seed), n2 = U.noise1(seed + 91), n3 = U.noise1(seed + 517);
    const count = Math.ceil((CFG.WORLD_M * CFG.M) / this.step) + 4;
    this.hs = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = i * this.step, xm = x / CFG.M;
      const b = this.biomeKeyAt(xm);
      let amp = b === 'grass' ? 1 : b === 'desert' ? 0.85 : 1.25;
      /* Damp the first ~300m hard. Near-miss psychology only works if the player blames
         their timing, and one steep hill was worth more than a whole POWER level. */
      amp *= U.lerp(0.34, 1, U.smooth(U.clamp((xm - 55) / 265, 0, 1)));
      let y = 0;
      y += (n1(x / 900) - 0.5) * 112 * amp;
      y += (n2(x / 260) - 0.5) * 46 * amp;
      y += (n3(x / 80) - 0.5) * 14 * amp;
      // flat pad, then a gentle downhill runway so weak shots still travel forward
      if (xm < 60) {
        const w = U.smooth(U.clamp((xm - 16) / 44, 0, 1));
        y = U.lerp(Math.max(0, xm - 16) * 0.9, y, w);
      }
      this.hs[i] = CFG.SURFACE_Y + y;
    }

    /* clamp slope: no walls to bounce backwards off, terrain stays readable.
       The early world gets a much tighter cap so approaches stay predictable. */
    const slopeAt = (i) => {
      const xm = (i * this.step) / CFG.M;
      return this.step * U.lerp(0.22, 0.55, U.smooth(U.clamp((xm - 55) / 265, 0, 1)));
    };
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < count; i++) {
        const maxD = slopeAt(i), d = this.hs[i] - this.hs[i - 1];
        if (d > maxD) this.hs[i] = this.hs[i - 1] + maxD;
        else if (d < -maxD) this.hs[i] = this.hs[i - 1] - maxD;
      }
      for (let i = count - 2; i >= 0; i--) {
        const maxD = slopeAt(i), d = this.hs[i] - this.hs[i + 1];
        if (d > maxD) this.hs[i] = this.hs[i + 1] + maxD;
        else if (d < -maxD) this.hs[i] = this.hs[i + 1] - maxD;
      }
    }

    /* Carve a gentle bowl at every landing zone. Two jobs: a pod that reaches the zone
       actually settles in it, and the run-up is flat enough to be repeatable. */
    for (const site of SITES) {
      if (site.half <= 0) continue;
      const iA = Math.floor(this.xOf(site.m - site.half) / this.step);
      const iB = Math.ceil(this.xOf(site.m + site.half) / this.step);
      const pad = Math.round(((site.near + 6) * CFG.M) / this.step);
      /* Shallow on purpose. A deep bowl eats a fast pod's bounce on the far wall — that
         once made a PERFECT stop short of a GOOD. Zones hold the pod with friction
         (see Pod.updateFlight), not with walls; the geometry only flattens the run-up. */
      const dip = site.id === 'mine' ? 26 : 8;
      const base = this.hs[U.clamp(iA - pad, 0, count - 1)] + dip;
      for (let i = iA - pad; i <= iB + pad; i++) {
        if (i < 0 || i >= count) continue;
        let w = 1;
        if (i < iA) w = U.smooth((i - (iA - pad)) / pad);
        else if (i > iB) w = U.smooth(((iB + pad) - i) / pad);
        const inner = i >= iA && i <= iB ? Math.sin(((i - iA) / (iB - iA)) * Math.PI) * (dip * 0.35) : 0;
        this.hs[i] = U.lerp(this.hs[i], base + inner, w);
      }
    }

    this.buildProps(seed);
    this.buildLandmarks();
  },

  yAt(x) {
    const n = this.hs.length;
    const f = x / this.step;
    let i = Math.floor(f);
    if (i < 0) return this.hs[0];
    if (i >= n - 1) return this.hs[n - 1];
    return U.lerp(this.hs[i], this.hs[i + 1], U.smooth(f - i));
  },

  slopeAt(x) { return (this.yAt(x + 6) - this.yAt(x - 6)) / 12; },

  inMine(x) {
    const s = this.siteAt(this.mOf(x));
    return !!s && s.id === 'mine';
  },

  /* ---------- metres ----------
     Sites, markers and the BEST flag are all authored in METRES TRAVELLED, which is what
     the HUD shows. Terrain/biome internals stay in raw world metres; a 14m offset in
     where the desert starts is invisible, a 14m offset in "NEXT: 12m" is not. */
  xOf: (m) => CFG.PAD_X + m * CFG.M,
  mOf: (x) => (x - CFG.PAD_X) / CFG.M,

  /* ---------- site queries ---------- */
  landable: () => SITES.filter((s) => s.half > 0),

  /* the site the pod is standing in, if any */
  siteAt(xm) {
    for (const s of SITES) if (s.half > 0 && Math.abs(xm - s.m) <= s.half) return s;
    return null;
  },

  /* closest landable site the pod stopped just outside of */
  nearMiss(xm) {
    let best = null;
    for (const s of SITES) {
      if (s.half <= 0) continue;
      const edgeA = s.m - s.half, edgeB = s.m + s.half;
      if (xm >= edgeA && xm <= edgeB) return null;         // landed inside, not a miss
      const gap = xm < edgeA ? edgeA - xm : xm - edgeB;
      if (gap <= s.near && (!best || gap < best.gap))
        best = { site: s, gap, short: xm < edgeA };
    }
    return best;
  },

  /* next meaningful site ahead — decor never shows in the UI */
  nextSite(xm) {
    let best = null;
    for (const s of SITES) {
      if (s.kind === 'decor') continue;
      const edge = s.m - s.half;
      if (edge > xm && (!best || edge < best.m - best.half)) best = s;
    }
    return best;
  },

  /* label respects discovery: a mystery stays ??? until it has been reached */
  siteLabel(s) {
    if (s.kind !== 'mystery') return s.name;
    return Save.data.found && Save.data.found.indexOf(s.id) >= 0 ? s.name : '???';
  },
  isFound: (s) => s.kind !== 'mystery' || (Save.data.found && Save.data.found.indexOf(s.id) >= 0),

  /* ---------- surface decoration ---------- */
  buildProps(seed) {
    const r = U.mulberry32(seed + 7);
    this.props = [];
    let x = 150;
    const end = CFG.WORLD_M * CFG.M;
    while (x < end) {
      const xm0 = x / CFG.M;
      /* pack the first 200m: the sense of travel comes from things going past */
      const spacing = xm0 < 200 ? 20 + r() * 42 : 40 + r() * 130;
      x += spacing;
      const xm = x / CFG.M;
      const dm = this.mOf(x);
      if (SITES.some((s) => Math.abs(dm - s.m) < (s.half || 6) + 9)) continue;
      const b = this.biomeKeyAt(xm);
      let type;
      if (b === 'grass') {
        const q = r();
        type = q < 0.30 ? 'rock' : q < 0.52 ? 'bush' : q < 0.72 ? 'tree'
             : q < 0.82 ? 'sign' : q < 0.92 ? 'grasstuft' : 'barrel';
      }
      else if (b === 'desert') type = r() < 0.5 ? 'cactus' : r() < 0.6 ? 'rock' : 'skull';
      else type = r() < 0.55 ? 'lavarock' : r() < 0.6 ? 'crack' : 'vent';
      this.props.push({ x, type, s: 0.7 + r() * 0.75, seed: r() });
    }
  },

  buildLandmarks() {
    this.landmarks = [
      { xm: 170, type: 'mountain', s: 1.3, p: 0.30 },
      { xm: 250, type: 'mountain', s: 1.0, p: 0.22 },
      { xm: 420, type: 'crystal', s: 1.15, p: 0.32 },
      { xm: 560, type: 'crystal', s: 0.9, p: 0.26 },
      { xm: 760, type: 'volcano', s: 1.35, p: 0.30 },
      { xm: 1000, type: 'tower', s: 1.2, p: 0.34 },
      { xm: 1380, type: 'mountain', s: 1.5, p: 0.24 },
    ];
  },

  /* ---------- sky + parallax (screen space) ---------- */
  drawSky(ctx, cam, W, H) {
    const pal = this.paletteAt(cam.x / CFG.M);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.sky0);
    g.addColorStop(0.62, pal.sky1);
    g.addColorStop(1, U.mix(pal.sky1, pal.mid, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (pal.key === 'volcano') {
      ctx.globalAlpha = 0.35;
      const gg = ctx.createRadialGradient(W * 0.5, H * 0.75, 10, W * 0.5, H * 0.75, W);
      gg.addColorStop(0, '#ff8a3d'); gg.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // sun / haze blob
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(W * 0.76, H * 0.14, W * 0.16, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawParallax(ctx, cam, W, H) {
    const pal = this.paletteAt(cam.x / CFG.M);
    const horizon = H * 0.55 + (CFG.SURFACE_Y - cam.y) * 0.18 * cam.zoom;

    /* landmarks sit furthest back, partly occluded by the hill bands */
    for (const lm of this.landmarks) {
      const wx = lm.xm * CFG.M;
      const sx = W / 2 + (wx - cam.x) * lm.p;
      if (sx < -400 || sx > W + 400) continue;
      const sy = horizon + 46 + (1 - lm.p) * 10;
      drawLandmark(ctx, lm, sx, sy, lm.s * (0.55 + lm.p * 0.8));
    }

    /* far hill band */
    ctx.fillStyle = U.rgba(U.hex(pal.far), 0.9);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 20; sx += 20) {
      const wx = cam.x + (sx - W / 2) / 0.16;
      const y = horizon + 26 + Math.sin(wx * 0.0016) * 26 + Math.sin(wx * 0.0007) * 40;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

    /* near hill band */
    ctx.fillStyle = U.rgba(U.hex(pal.mid), 0.95);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 20; sx += 16) {
      const wx = cam.x + (sx - W / 2) / 0.36;
      const y = horizon + 66 + Math.sin(wx * 0.0031 + 2) * 20 + Math.sin(wx * 0.0012) * 28;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  },

  /* ---------- terrain (world space) ---------- */
  drawTerrain(ctx, cam, left, right) {
    const pal = this.paletteAt(cam.x / CFG.M);
    const s = this.step;
    const x0 = Math.floor(left / s) * s - s;
    const x1 = Math.ceil(right / s) * s + s;
    const bottom = CFG.SURFACE_Y + 6000;

    /* body */
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += s) ctx.lineTo(x, this.yAt(x));
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, CFG.SURFACE_Y - 60, 0, CFG.SURFACE_Y + 620);
    g.addColorStop(0, pal.soil);
    g.addColorStop(1, pal.soil2);
    ctx.fillStyle = g;
    ctx.fill();

    /* soil texture: strata bands + pebbles */
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = '#000';
    for (let y = CFG.SURFACE_Y + 60; y < CFG.SURFACE_Y + 660; y += 118)
      ctx.fillRect(x0, y + Math.sin(x0 * 0.0015) * 9, x1 - x0, 9);
    ctx.globalAlpha = 0.11;
    const gy0 = Math.floor((CFG.SURFACE_Y + 30) / 58) * 58;
    for (let y = gy0; y < CFG.SURFACE_Y + 700; y += 58) {
      for (let x = Math.floor(x0 / 58) * 58; x < x1; x += 58) {
        const h = hash2(x, y);
        ctx.beginPath();
        ctx.arc(x + (h - 0.5) * 46, y + (hash2(y, x) - 0.5) * 40, 2.6 + h * 3.4, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    /* top crust */
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x0, this.yAt(x0));
    for (let x = x0; x <= x1; x += s) ctx.lineTo(x, this.yAt(x));
    ctx.strokeStyle = pal.top2;
    ctx.lineWidth = 30; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = pal.top;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();

    /* biome props */
    for (const p of this.props) {
      if (p.x < left - 90 || p.x > right + 90) continue;
      drawProp(ctx, p, this.yAt(p.x), pal);
    }

    this.drawSites(ctx, left, right);
    this.drawMine(ctx, left, right);
    this.drawMarkers(ctx, left, right);
  },

  /* ---------- named sites ---------- */
  drawSites(ctx, left, right) {
    const t = performance.now() / 1000;
    for (const site of SITES) {
      if (site.id === 'mine') continue;              // has its own richer art
      const x = this.xOf(site.m);
      if (x < left - 260 || x > right + 260) continue;
      const y = this.yAt(x);

      /* landing pad glow + edge posts for anything you can actually land on */
      if (site.half > 0) {
        const w = site.half * CFG.M;
        const col = site.kind === 'mystery' ? '190,120,255' : '120,235,255';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, y - 60, 0, y + 6);
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(1, `rgba(${col},${0.22 + Math.sin(t * 2.4 + site.m) * 0.05})`);
        ctx.fillStyle = g;
        ctx.fillRect(x - w, y - 60, w * 2, 64);
        ctx.restore();
        ctx.fillStyle = `rgba(${col},.5)`;
        ctx.fillRect(x - w, y - 3, w * 2, 6);
        for (const sx of [-1, 1]) {
          ctx.fillStyle = '#2c3550';
          U.rr(ctx, x + sx * w - 3, y - 26, 6, 28, 3); ctx.fill();
          ctx.fillStyle = `rgba(${col},.95)`;
          ctx.beginPath(); ctx.arc(x + sx * w, y - 28, 4, 0, U.TAU); ctx.fill();
        }
      }

      drawSiteArt(ctx, site, x, y, t);
      if (site.kind !== 'decor') drawSiteLabel(ctx, site, x, y, t);
    }
  },

  drawMarkers(ctx, left, right) {
    const from = Math.floor(this.mOf(left) / 100) * 100;
    const to = this.mOf(right);
    ctx.textAlign = 'center';
    for (let m = Math.max(100, from); m <= to; m += 100) {
      const x = this.xOf(m), y = this.yAt(x);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      U.rr(ctx, x - 19, y - 44, 38, 17, 5); ctx.fill();
      ctx.fillStyle = '#233';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(m + 'm', x, y - 35);
    }
  },

  /* ---------- Ancient Mine ---------- */
  drawMine(ctx, left, right) {
    const site = SITES.find((s) => s.id === 'mine');
    const xa = this.xOf(site.m - site.half), xb = this.xOf(site.m + site.half);
    if (xb < left - 200 || xa > right + 200) return;
    const cx = (xa + xb) / 2, y = this.yAt(cx);
    const t = performance.now() / 1000;

    /* ground glow */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(cx, y - 20, 4, cx, y - 20, 190);
    gg.addColorStop(0, 'rgba(120,240,255,.55)');
    gg.addColorStop(1, 'rgba(120,240,255,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(cx - 200, y - 210, 400, 260);
    ctx.restore();

    /* glowing floor strip */
    ctx.fillStyle = 'rgba(110,235,255,.35)';
    ctx.fillRect(xa, y - 5, xb - xa, 9);

    /* entrance arch */
    const ay = y;
    ctx.fillStyle = '#2b3550';
    U.rr(ctx, cx - 46, ay - 76, 92, 78, 8); ctx.fill();
    ctx.fillStyle = '#0a1020';
    ctx.beginPath();
    ctx.moveTo(cx - 30, ay);
    ctx.lineTo(cx - 30, ay - 40);
    ctx.quadraticCurveTo(cx, ay - 74, cx + 30, ay - 40);
    ctx.lineTo(cx + 30, ay);
    ctx.closePath(); ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(cx, ay - 26, 2, cx, ay - 26, 46);
    eg.addColorStop(0, `rgba(140,255,255,${0.5 + Math.sin(t * 3) * 0.15})`);
    eg.addColorStop(1, 'rgba(140,255,255,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(cx, ay - 26, 46, 0, U.TAU); ctx.fill();
    ctx.restore();

    /* pillars + torches */
    for (const sx of [-1, 1]) {
      const px = cx + sx * 54;
      ctx.fillStyle = '#3a4666';
      U.rr(ctx, px - 8, ay - 62, 16, 62, 4); ctx.fill();
      ctx.fillStyle = '#4b5a80';
      U.rr(ctx, px - 12, ay - 70, 24, 12, 4); ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 12 + Math.sin(t * 5 + sx) * 2.5;
      const tg = ctx.createRadialGradient(px, ay - 74, 1, px, ay - 74, r * 2.2);
      tg.addColorStop(0, 'rgba(160,255,255,.9)');
      tg.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.arc(px, ay - 74, r * 2.2, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    /* sign */
    ctx.save();
    ctx.translate(cx, ay - 104 + Math.sin(t * 1.6) * 3);
    ctx.fillStyle = 'rgba(10,20,36,.85)';
    U.rr(ctx, -70, -15, 140, 30, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(130,240,255,.75)'; ctx.lineWidth = 2;
    U.rr(ctx, -70, -15, 140, 30, 9); ctx.stroke();
    ctx.fillStyle = '#9ff2ff';
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ANCIENT MINE', 0, 1);
    ctx.restore();

    /* drifting motes */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const ph = i * 1.7 + t * (0.5 + (i % 3) * 0.2);
      const px = cx + Math.sin(ph) * 92;
      const py = ay - 12 - ((ph * 22) % 130);
      ctx.globalAlpha = 0.55 * (1 - ((ph * 22) % 130) / 130);
      ctx.fillStyle = '#9ff2ff';
      ctx.beginPath(); ctx.arc(px, py, 2.4, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  },

  /* ---------- underground generation ---------- */
  genUnderground(centerX, maxDepthM, rareBoost, seed) {
    const rng = U.mulberry32(seed);
    const surfaceY = this.yAt(centerX);
    const biome = this.biomeKeyAt(centerX / CFG.M);
    const pool = BIOMES[biome].pool;
    const halfW = 300;
    const topY = surfaceY + 74;
    const botY = surfaceY + maxDepthM * CFG.M;
    const minerals = [], rocks = [];

    for (let y = topY; y < botY - 6; y += 30) {
      for (let x = centerX - halfW; x <= centerX + halfW; x += 46) {
        const px = x + (rng() - 0.5) * 24;
        const py = y + (rng() - 0.5) * 16;
        const depthM = (py - surfaceY) / CFG.M;
        const t = U.clamp(depthM / Math.max(22, maxDepthM), 0, 1);
        const roll = rng();
        if (roll < 0.20) {
          rocks.push({ x: px, y: py, r: 11 + rng() * 9, hit: 0, dead: false, s: rng() });
        } else if (roll < 0.20 + 0.34) {
          minerals.push({
            x: px, y: py, r: 10, got: false, ph: rng() * 6.28,
            type: pickMineral(rng, t, pool, rareBoost),
          });
        }
      }
    }
    /* teaser layer below the depth limit: seen but unreachable until DRILL is upgraded */
    const locked = [];
    for (let y = botY + 70; y < botY + 340; y += 74) {
      for (let i = 0; i < 3; i++) {
        const px = centerX + (rng() - 0.5) * halfW * 1.7;
        const depthM = (y - surfaceY) / CFG.M;
        locked.push({
          x: px, y: y + (rng() - 0.5) * 26, r: 11 + rng() * 4, ph: rng() * 6.28,
          type: pickMineral(rng, 1, pool, 2.4), depthM,
        });
      }
    }

    this.ug = { minerals, rocks, locked, halfW, topY, botY, centerX, surfaceY, maxDepthM, biome, tunnel: [] };
    return this.ug;
  },

  /* ---------- underground draw ---------- */
  drawUnderground(ctx, cam, left, right, top, bottom) {
    const ug = this.ug;
    if (!ug) return;
    const sy = ug.surfaceY;
    const t = performance.now() / 1000;

    /* depth layer bands */
    const bands = [
      [0, 0.18, '#6b4a2c', '#5a3d24'],
      [0.18, 0.48, '#4e4a52', '#403c46'],
      [0.48, 0.78, '#3a3746', '#2e2c3a'],
      [0.78, 1.0, '#2a2233', '#1d1826'],
    ];
    const span = ug.botY - sy;
    for (const [a, b, c0, c1] of bands) {
      const ya = sy + span * a, yb = sy + span * b;
      if (yb < top || ya > bottom) continue;
      const g = ctx.createLinearGradient(0, ya, 0, yb);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.fillRect(left - 20, ya, right - left + 40, yb - ya + 2);
    }
    /* below max depth: unreachable strata, dimmed but legible */
    if (bottom > ug.botY) {
      const g = ctx.createLinearGradient(0, ug.botY, 0, ug.botY + 420);
      g.addColorStop(0, '#14101c'); g.addColorStop(1, '#241a33');
      ctx.fillStyle = g;
      ctx.fillRect(left - 20, ug.botY, right - left + 40, bottom - ug.botY + 40);
      ctx.save();
      ctx.globalAlpha = 0.38;
      for (const m of ug.locked) {
        if (m.y < top - 40 || m.y > bottom + 40) continue;
        drawMineral(ctx, m, t);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('UPGRADE DRILL TO GO DEEPER', ug.centerX, ug.botY + 96);
    }

    /* subtle strata speckle */
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#000';
    const gridY0 = Math.floor(Math.max(top, sy) / 52) * 52;
    for (let y = gridY0; y < bottom; y += 52) {
      for (let x = Math.floor(left / 52) * 52; x < right; x += 52) {
        const h = hash2(x, y);
        ctx.beginPath();
        ctx.arc(x + (h - 0.5) * 42, y + (hash2(y, x) - 0.5) * 38, 2.5 + h * 3.6, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    /* field walls */
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(left - 20, top - 20, (ug.centerX - ug.halfW) - (left - 20), bottom - top + 40);
    ctx.fillRect(ug.centerX + ug.halfW, top - 20, (right + 20) - (ug.centerX + ug.halfW), bottom - top + 40);

    /* tunnel carved by the drill */
    if (ug.tunnel.length > 1) {
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.34)';
      ctx.lineWidth = 30;
      strokePath(ctx, ug.tunnel);
      ctx.strokeStyle = '#1a1420';
      ctx.lineWidth = 24;
      strokePath(ctx, ug.tunnel);
    }

    /* rocks */
    for (const r of ug.rocks) {
      if (r.dead || r.y < top - 40 || r.y > bottom + 40 || r.x < left - 40 || r.x > right + 40) continue;
      drawRock(ctx, r);
    }

    /* minerals */
    for (const m of ug.minerals) {
      if (m.got || m.y < top - 40 || m.y > bottom + 40 || m.x < left - 40 || m.x > right + 40) continue;
      drawMineral(ctx, m, t);
    }

    /* max-depth bedrock line */
    if (ug.botY > top - 40 && ug.botY < bottom + 60) {
      const y = ug.botY;
      ctx.fillStyle = '#0d0a14';
      ctx.fillRect(left - 20, y, right - left + 40, 60);
      ctx.save();
      ctx.beginPath(); ctx.rect(left - 20, y, right - left + 40, 12); ctx.clip();
      for (let x = Math.floor(left / 22) * 22 - 40; x < right + 40; x += 22) {
        ctx.fillStyle = ((x / 22) | 0) % 2 ? '#ffd23d' : '#20202c';
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + 11, y);
        ctx.lineTo(x + 11 - 12, y + 12); ctx.lineTo(x - 12, y + 12);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,210,61,.75)';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('MAX DEPTH  ' + Math.round(ug.maxDepthM) + 'm', ug.centerX, y + 20);
    }
  },
};

/* ============ helpers ============ */

/* stable pseudo-random from a 2D position, for irregular texture */
function hash2(a, b) {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function strokePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function pickMineral(rng, depthT, pool, rareBoost) {
  const w = [];
  let total = 0;
  for (const k in pool) {
    const tier = MINERALS[k].tier;
    let v = pool[k];
    if (tier === 0) v *= 1.35 - 0.9 * depthT;
    else if (tier === 1) v *= 0.55 + 1.1 * depthT;
    else v *= (0.18 + 1.9 * depthT) * rareBoost;
    total += v;
    w.push([k, total]);
  }
  const r = rng() * total;
  for (const [k, acc] of w) if (r <= acc) return k;
  return 'coal';
}

function drawMineral(ctx, m, t) {
  const def = MINERALS[m.type];
  const pulse = 1 + Math.sin(t * 3 + m.ph) * 0.06;
  const r = m.r * pulse;

  ctx.save();
  ctx.translate(m.x, m.y);

  /* glow */
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * (def.tier === 2 ? 4.2 : 2.6));
  g.addColorStop(0, U.rgba(def.color, def.tier === 2 ? 0.75 : 0.4));
  g.addColorStop(1, U.rgba(def.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * (def.tier === 2 ? 4.2 : 2.6), 0, U.TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  /* embedded rock socket */
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.arc(0, 1, r * 1.5, 0, U.TAU); ctx.fill();

  ctx.rotate(Math.sin(t * 1.4 + m.ph) * 0.12);
  if (m.type === 'fossil') {
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = '#8a7a52'; ctx.lineWidth = 1.8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(0, 0, r * (0.45 + i * 0.22 + 0.3), -0.8, 2.2); ctx.stroke();
    }
  } else if (m.type === 'alien') {
    U.star(ctx, 0, 0, 3, r * 1.5, r * 0.6, t * 1.1 + m.ph);
    ctx.fillStyle = def.color; ctx.fill();
    ctx.strokeStyle = def.edge; ctx.lineWidth = 2; ctx.stroke();
  } else {
    /* faceted gem */
    const n = def.tier === 0 ? 6 : 5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * U.TAU - Math.PI / 2;
      const rr = r * (i % 2 && def.tier > 0 ? 0.78 : 1.12);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const gg = ctx.createLinearGradient(-r, -r, r, r);
    gg.addColorStop(0, def.edge); gg.addColorStop(0.5, def.color);
    gg.addColorStop(1, U.shade(def.color, -0.3));
    ctx.fillStyle = gg; ctx.fill();
    ctx.strokeStyle = U.rgba(def.edge, 0.85); ctx.lineWidth = 1.6; ctx.stroke();
    /* highlight */
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.26, r * 0.14, -0.6, 0, U.TAU); ctx.fill();
  }
  ctx.restore();
}

function drawRock(ctx, r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.s * 6.28);
  const n = 7;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * U.TAU;
    const rr = r.r * (0.78 + ((Math.sin(i * 12.9 + r.s * 40) + 1) / 2) * 0.42);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-r.r, -r.r, r.r, r.r);
  g.addColorStop(0, '#7d7a86'); g.addColorStop(1, '#4a4753');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
  if (r.hit > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r.r * 0.5, -r.r * 0.3); ctx.lineTo(0, 0);
    ctx.lineTo(-r.r * 0.15, r.r * 0.45); ctx.moveTo(0, 0); ctx.lineTo(r.r * 0.55, r.r * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- site artwork ---------- */
function drawSiteLabel(ctx, site, x, y, t) {
  const known = World.isFound(site);
  const txt = World.siteLabel(site);
  const mystery = !known;
  const lift = 96 + (site.half > 0 ? 14 : 0);
  ctx.save();
  ctx.translate(x, y - lift + Math.sin(t * 1.5 + site.m) * 3);
  ctx.font = `bold ${mystery ? 20 : 14}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.max(58, ctx.measureText(txt).width + 26);
  ctx.fillStyle = 'rgba(10,18,32,.82)';
  U.rr(ctx, -w / 2, -15, w, 30, 9); ctx.fill();
  ctx.strokeStyle = mystery ? 'rgba(200,140,255,.8)' : 'rgba(140,235,255,.7)';
  ctx.lineWidth = 2;
  U.rr(ctx, -w / 2, -15, w, 30, 9); ctx.stroke();
  ctx.fillStyle = mystery ? '#d8aaff' : '#a8ecff';
  ctx.fillText(txt, 0, 1);
  /* little stem down to the ground */
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(0, lift - 34); ctx.stroke();
  ctx.restore();
}

function drawSiteArt(ctx, site, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 30, 6, 0, 0, U.TAU); ctx.fill();

  switch (site.art) {
    case 'crate': {
      ctx.fillStyle = '#b07a3c';
      U.rr(ctx, -22, -40, 44, 40, 4); ctx.fill();
      ctx.fillStyle = '#d29a52';
      U.rr(ctx, -22, -40, 44, 8, 3); ctx.fill();
      ctx.strokeStyle = '#7d5326'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, -40); ctx.lineTo(22, 0); ctx.moveTo(22, -40); ctx.lineTo(-22, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffd23d';
      U.rr(ctx, -8, -26, 16, 12, 2); ctx.fill();
      break;
    }
    case 'crystal': {
      ctx.fillStyle = '#2b2340';
      ctx.beginPath(); ctx.ellipse(0, 0, 48, 12, 0, 0, U.TAU); ctx.fill();
      const sh = [[-26, -46, 11], [-6, -74, 14], [18, -54, 10], [34, -34, 8]];
      for (const [cx, ty, w] of sh) {
        const g = ctx.createLinearGradient(cx, ty, cx, 0);
        g.addColorStop(0, '#e6d0ff'); g.addColorStop(1, '#7a44cf');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, ty); ctx.lineTo(cx + w, 0); ctx.lineTo(cx - w, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, -40, 4, 0, -40, 70);
      gg.addColorStop(0, `rgba(190,130,255,${0.3 + Math.sin(t * 2.2) * 0.1})`);
      gg.addColorStop(1, 'rgba(190,130,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, -40, 70, 0, U.TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'wreck': {
      ctx.fillStyle = '#6f5a3e';
      U.rr(ctx, -30, -34, 52, 30, 5); ctx.fill();
      ctx.fillStyle = '#8a7150';
      U.rr(ctx, -12, -52, 26, 20, 4); ctx.fill();
      ctx.fillStyle = '#3d3630';
      for (const cx of [-20, -4, 12]) { ctx.beginPath(); ctx.arc(cx, -2, 8, 0, U.TAU); ctx.fill(); }
      ctx.strokeStyle = '#7a6444'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(20, -44); ctx.lineTo(52, -20); ctx.stroke();
      ctx.fillStyle = '#5d4c34';
      ctx.beginPath();
      ctx.moveTo(52, -22); ctx.lineTo(68, -16); ctx.lineTo(60, 0); ctx.lineTo(46, -8);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'arch': {
      ctx.fillStyle = '#8f8676';
      ctx.beginPath();
      ctx.moveTo(-46, 0); ctx.lineTo(-46, -52);
      ctx.quadraticCurveTo(0, -104, 46, -52); ctx.lineTo(46, 0);
      ctx.lineTo(26, 0); ctx.lineTo(26, -50);
      ctx.quadraticCurveTo(0, -80, -26, -50); ctx.lineTo(-26, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(-46, -52, 20, 52);
      break;
    }
    case 'crater': {
      ctx.fillStyle = '#4a4038';
      ctx.beginPath(); ctx.ellipse(0, -2, 74, 18, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#241d1a';
      ctx.beginPath(); ctx.ellipse(0, 2, 56, 12, 0, 0, U.TAU); ctx.fill();
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#5a4d42';
        ctx.beginPath();
        ctx.moveTo(sx * 60, 0); ctx.lineTo(sx * 76, -16); ctx.lineTo(sx * 84, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#2e2622';
      ctx.beginPath(); ctx.arc(6, -8, 15, 0, U.TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,120,50,${0.25 + Math.sin(t * 3) * 0.08})`;
      ctx.beginPath(); ctx.arc(6, -8, 11, 0, U.TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'bridge': {
      ctx.fillStyle = '#6b6f7d';
      ctx.fillRect(-70, -46, 140, 8);
      for (let i = -60; i <= 60; i += 24) ctx.fillRect(i - 3, -38, 6, 38);
      ctx.strokeStyle = '#8b91a2'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-70, -46); ctx.quadraticCurveTo(0, -86, 70, -46); ctx.stroke();
      break;
    }
    case 'bones': {
      ctx.fillStyle = '#ddd6c2';
      ctx.beginPath(); ctx.ellipse(-44, -22, 24, 18, -0.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#3a3730';
      ctx.beginPath(); ctx.arc(-52, -26, 5, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#ddd6c2'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-24, -16); ctx.lineTo(58, -8); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const bx = -16 + i * 14;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bx, -16); ctx.quadraticCurveTo(bx + 5, -42, bx + 20, -40);
        ctx.stroke();
      }
      break;
    }
    case 'obelisk': {
      const g = ctx.createLinearGradient(-14, -110, 14, 0);
      g.addColorStop(0, '#4a5570'); g.addColorStop(1, '#232c42');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-15, 0); ctx.lineTo(-9, -104); ctx.lineTo(0, -118);
      ctx.lineTo(9, -104); ctx.lineTo(15, 0);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,220,255,${0.4 + Math.sin(t * 2) * 0.15})`;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, -i * 26, 3.5, 0, U.TAU); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'rig': {
      ctx.strokeStyle = '#7d8494'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-34, 0); ctx.lineTo(-12, -96); ctx.lineTo(12, -96); ctx.lineTo(34, 0);
      ctx.stroke();
      for (let i = 1; i < 5; i++) {
        const k = i / 5, w = U.lerp(34, 12, k);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-w, -k * 96); ctx.lineTo(w, -k * 96); ctx.stroke();
      }
      ctx.fillStyle = '#4b5364';
      U.rr(ctx, -30, -20, 60, 20, 4); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,90,60,${0.5 + Math.sin(t * 4) * 0.4})`;
      ctx.beginPath(); ctx.arc(0, -100, 5, 0, U.TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'lava': {
      ctx.fillStyle = '#2b2026';
      ctx.beginPath();
      ctx.moveTo(-56, 0); ctx.quadraticCurveTo(0, -78, 56, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#120c10';
      ctx.beginPath();
      ctx.moveTo(-30, 0); ctx.quadraticCurveTo(0, -50, 30, 0);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -14, 3, 0, -14, 46);
      g.addColorStop(0, `rgba(255,150,50,${0.6 + Math.sin(t * 2.6) * 0.18})`);
      g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -14, 46, 0, U.TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'towerbase': {
      ctx.fillStyle = '#2f3550';
      ctx.beginPath();
      ctx.moveTo(-30, 0); ctx.lineTo(-18, -120); ctx.lineTo(18, -120); ctx.lineTo(30, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#414a70';
      for (let i = 1; i < 5; i++) ctx.fillRect(-28 + i * 2, -i * 26, 56 - i * 4, 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -132, 3, 0, -132, 44);
      g.addColorStop(0, `rgba(120,255,220,${0.6 + Math.sin(t * 2) * 0.2})`);
      g.addColorStop(1, 'rgba(120,255,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -132, 44, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#7effdc';
      ctx.beginPath(); ctx.arc(0, -132, 8, 0, U.TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawProp(ctx, p, gy, pal) {
  const s = p.s;
  ctx.save();
  ctx.translate(p.x, gy);
  /* contact shadow */
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 16 * s, 4 * s, 0, 0, U.TAU); ctx.fill();

  switch (p.type) {
    case 'rock': {
      ctx.fillStyle = U.shade(pal.soil, 0.18);
      ctx.beginPath();
      ctx.moveTo(-14 * s, 0); ctx.lineTo(-9 * s, -13 * s);
      ctx.lineTo(3 * s, -16 * s); ctx.lineTo(13 * s, -6 * s); ctx.lineTo(15 * s, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath();
      ctx.moveTo(-9 * s, -13 * s); ctx.lineTo(3 * s, -16 * s); ctx.lineTo(0, -8 * s);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'bush': {
      ctx.fillStyle = U.shade(pal.top2, -0.1);
      for (const [dx, dy, r] of [[-8, -7, 9], [6, -8, 10], [0, -13, 9]]) {
        ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, U.TAU); ctx.fill();
      }
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-3 * s, -22 * s, 6 * s, 22 * s);
      ctx.fillStyle = U.shade(pal.top, -0.08);
      ctx.beginPath(); ctx.arc(0, -32 * s, 17 * s, 0, U.TAU); ctx.fill();
      ctx.fillStyle = U.shade(pal.top, 0.16);
      ctx.beginPath(); ctx.arc(-5 * s, -37 * s, 9 * s, 0, U.TAU); ctx.fill();
      break;
    }
    case 'cactus': {
      ctx.fillStyle = '#3f9e63';
      U.rr(ctx, -5 * s, -34 * s, 10 * s, 34 * s, 5 * s); ctx.fill();
      U.rr(ctx, -15 * s, -26 * s, 8 * s, 6 * s, 3 * s); ctx.fill();
      U.rr(ctx, -15 * s, -26 * s, 7 * s, 14 * s, 3.5 * s); ctx.fill();
      U.rr(ctx, 8 * s, -30 * s, 7 * s, 12 * s, 3.5 * s); ctx.fill();
      U.rr(ctx, 8 * s, -24 * s, 8 * s, 6 * s, 3 * s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      U.rr(ctx, -3.5 * s, -32 * s, 3 * s, 28 * s, 2 * s); ctx.fill();
      break;
    }
    case 'skull': {
      ctx.fillStyle = '#e9e0cb';
      ctx.beginPath(); ctx.arc(0, -8 * s, 9 * s, 0, U.TAU); ctx.fill();
      ctx.fillRect(-5 * s, -6 * s, 10 * s, 8 * s);
      ctx.fillStyle = '#4a4335';
      ctx.beginPath(); ctx.arc(-3.6 * s, -9 * s, 2.4 * s, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3.6 * s, -9 * s, 2.4 * s, 0, U.TAU); ctx.fill();
      break;
    }
    case 'sign': {
      ctx.fillStyle = '#7a5c3a';
      ctx.fillRect(-2 * s, -22 * s, 4 * s, 22 * s);
      ctx.fillStyle = '#e8e2d0';
      U.rr(ctx, -13 * s, -34 * s, 26 * s, 13 * s, 3 * s); ctx.fill();
      ctx.fillStyle = '#8a8577';
      ctx.fillRect(-9 * s, -30 * s, 18 * s, 2.5 * s);
      ctx.fillRect(-9 * s, -26 * s, 12 * s, 2.5 * s);
      break;
    }
    case 'grasstuft': {
      ctx.strokeStyle = U.shade(pal.top, -0.12);
      ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3 * s, 0);
        ctx.quadraticCurveTo(i * 5 * s, -7 * s, i * 9 * s, -12 * s);
        ctx.stroke();
      }
      break;
    }
    case 'barrel': {
      ctx.fillStyle = '#4e6b45';
      U.rr(ctx, -8 * s, -20 * s, 16 * s, 20 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#63875a';
      U.rr(ctx, -8 * s, -20 * s, 16 * s, 4 * s, 2 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(-8 * s, -13 * s); ctx.lineTo(8 * s, -13 * s);
      ctx.moveTo(-8 * s, -7 * s); ctx.lineTo(8 * s, -7 * s); ctx.stroke();
      break;
    }
    case 'lavarock': {
      ctx.fillStyle = '#2e2630';
      ctx.beginPath();
      ctx.moveTo(-15 * s, 0); ctx.lineTo(-7 * s, -17 * s);
      ctx.lineTo(6 * s, -19 * s); ctx.lineTo(16 * s, 0);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,120,40,.9)'; ctx.lineWidth = 2.2 * s;
      ctx.beginPath(); ctx.moveTo(-6 * s, -2 * s); ctx.lineTo(-1 * s, -11 * s); ctx.lineTo(6 * s, -6 * s);
      ctx.stroke(); ctx.restore();
      break;
    }
    case 'crack': {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-20 * s, 0, 20 * s, 0);
      g.addColorStop(0, 'rgba(255,90,20,0)');
      g.addColorStop(0.5, 'rgba(255,150,40,.85)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-22 * s, -5 * s, 44 * s, 7 * s);
      ctx.restore();
      break;
    }
    case 'vent': {
      ctx.fillStyle = '#241d26';
      ctx.beginPath(); ctx.ellipse(0, -2 * s, 11 * s, 5 * s, 0, 0, U.TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const t = performance.now() / 1000 + p.seed * 10;
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.6 + i * 0.33) % 1);
        ctx.globalAlpha = (1 - k) * 0.35;
        ctx.fillStyle = '#ffb066';
        ctx.beginPath(); ctx.arc(Math.sin(k * 6 + i) * 6 * s, -10 * s - k * 46 * s, (3 + k * 9) * s, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

function drawLandmark(ctx, lm, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch (lm.type) {
    case 'mountain': {
      const g = ctx.createLinearGradient(0, -180, 0, 0);
      g.addColorStop(0, '#8fa6c4'); g.addColorStop(1, '#43597a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-130, 0); ctx.lineTo(-40, -140); ctx.lineTo(10, -95);
      ctx.lineTo(52, -175); ctx.lineTo(140, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.moveTo(52, -175); ctx.lineTo(78, -122); ctx.lineTo(60, -130);
      ctx.lineTo(46, -114); ctx.lineTo(30, -128);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'crystal': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, -90, 6, 0, -90, 140);
      gg.addColorStop(0, 'rgba(180,120,255,.5)');
      gg.addColorStop(1, 'rgba(180,120,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, -90, 140, 0, U.TAU); ctx.fill();
      ctx.restore();
      const shards = [[-52, -110, 30], [0, -190, 42], [46, -130, 26]];
      for (const [cx, ty, w] of shards) {
        const g = ctx.createLinearGradient(cx - w, ty, cx + w, 0);
        g.addColorStop(0, '#e5c8ff'); g.addColorStop(1, '#8a4fd6');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, ty); ctx.lineTo(cx + w, 0); ctx.lineTo(cx - w, 0);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'volcano': {
      const g = ctx.createLinearGradient(0, -190, 0, 0);
      g.addColorStop(0, '#5a3b47'); g.addColorStop(1, '#2a1c26');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-170, 0); ctx.lineTo(-46, -170); ctx.lineTo(46, -170); ctx.lineTo(170, 0);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,120,40,.85)';
      ctx.beginPath();
      ctx.moveTo(-46, -170); ctx.lineTo(46, -170); ctx.lineTo(20, -120);
      ctx.lineTo(30, -60); ctx.lineTo(-14, -100);
      ctx.closePath(); ctx.fill();
      const t = performance.now() / 1000;
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.35 + i * 0.25) % 1;
        ctx.globalAlpha = (1 - k) * 0.4;
        ctx.fillStyle = '#6a4a55';
        ctx.beginPath(); ctx.arc(Math.sin(k * 5 + i) * 30, -180 - k * 130, 22 + k * 46, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'tower': {
      ctx.fillStyle = '#2f3550';
      ctx.beginPath();
      ctx.moveTo(-34, 0); ctx.lineTo(-22, -230); ctx.lineTo(22, -230); ctx.lineTo(34, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#414a70';
      for (let i = 1; i < 6; i++) ctx.fillRect(-32 + i, -i * 38 - 6, 64 - i * 2, 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const t = performance.now() / 1000;
      const gg = ctx.createRadialGradient(0, -250, 3, 0, -250, 60);
      gg.addColorStop(0, `rgba(120,255,220,${0.55 + Math.sin(t * 2) * 0.2})`);
      gg.addColorStop(1, 'rgba(120,255,220,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, -250, 60, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#7effdc';
      ctx.beginPath(); ctx.arc(0, -250, 11, 0, U.TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
