'use strict';
/* ============ tuning ============ */
const CFG = {
  M: 8,                    // world pixels per metre
  GRAV: 1250,
  PAD_X: 110,              // launch pad world x
  SURFACE_Y: 140,          // baseline surface world y

  POWER_PER: 0.10,         // +10% launch speed / level
  DEPTH_BASE: 38,          // metres
  DEPTH_PER: 10,
  /* STORAGE_BASE / STORAGE_PER removed: the carry cap is gone. It used to end most runs
     early, which is exactly what hid the DRILL upgrade — runs finished at 40-60m because
     the pod was full, never because it ran out of depth. Now a run ends only at MAX DEPTH,
     so DRILL is the thing that decides how long you are down there. */

  DRILL_VY: 50,            // world px/s downward at depth 0
  DRILL_VY_DEEP: 78,
  /* ---- steering authority ----
     Expressed as a RATIO of descent speed, not an absolute px/s, so the drill always
     travels inside the same cone. The old absolute 44 against a 50-78 descent meant the
     cone narrowed as you went deeper — 41deg near the surface, 29deg at the bottom — so
     the control quietly got worse exactly as the field got more interesting.

     The ceiling on the ratio is the nose clamp in Pod.updateDrill (0.95 rad, 54deg). Push
     the travel angle past it and the art stops matching the path: the pod crabs sideways
     off its own heading, which is the wagging tail the clamp was added to prevent. 1.35
     puts travel at 53.5deg, hard against that limit and no further.

     What it buys, in the units that matter: minerals sit on a 46px grid across a 600px
     field, one row every 30px of depth. At the old authority 30px of descent bought 27px
     of sideways travel, so the column next to you was already out of reach and the run
     was on rails. At 1.35 it buys 40px — the neighbouring column, every row. */
  DRILL_STEER_RATIO: 1.35,
  DRILL_AX: 420,           // steering acceleration. At 190 it took a quarter second to
                           // reach full lock, and on a phone that reads as the drill
                           // answering late. 420 is moving inside two frames.
  DRILL_TURN_COST: 0.12,   // share of downward speed given up at full lock. Small, but it
                           // is what stops steering from being free: going straight down
                           // is the fast line, and cutting across costs you a little.
  /* ---- steering input (touch) ----
     Relative drag, not screen halves. The old rule was `x < W/2 ? -1 : +1`: binary, full
     deflection from the first touch, and it put the thumb in the middle of the play area
     with an invisible midline deciding the direction. Now the touch-down point is the
     origin and horizontal distance from it is the deflection, so the thumb can land
     anywhere, a light nudge is a light turn, and reversing is a small movement instead of
     a trip across the screen. */
  DRILL_STEER_DEAD: 6,     // px of slop before the drill answers, so a resting thumb
                           // holds a line instead of drifting
  DRILL_STEER_RANGE: 62,   // px of drag for full lock — about one thumb-width, chosen so
                           // the whole range is reachable without the hand moving

  /* ================= the meteor loop =================
     Launch high, fall hard, punch into the ground, and let the leftover energy carry the
     drill down until it runs out. No air control, no pads, no terrain bouncing. The only
     surface skill is timing, and what timing buys is ENERGY.

     Measured while choosing these: impact kinetic energy is almost completely independent
     of launch angle (288k at 52deg, 288k at 60deg, 279k at 65deg at Lv1 PERFECT). Height
     only trades KE for PE and back, exactly as it should — so the angle is a choice about
     arc SHAPE and anticipation, and never a way to smuggle in extra energy.              */
  IMPACT_ANGLE: 60 * Math.PI / 180,  // steep on purpose: the pod arrives at 60deg, so
                                     // vertical speed is 1.7x horizontal at contact.
  IMPACT_BASE_V: 1000,               // launch speed at PERFECT/Lv1. Sized so the authored
                                     // site map and the biome thresholds keep meaning what
                                     // they mean — see `node tools/flight-sim.mjs reach`.
  POD_MASS: 1,                       // normalised; the model only ever uses energy RATIOS

  /* energy -> penetration. depth ~= impactEnergy / SOIL_RESISTANCE, so the constant is
     readable as "metres per unit of energy" (1 / 0.0476 = 21m for a Lv1 PERFECT). */
  IMPACT_ENERGY_SCALE: 660000,       // KE of a Lv1 PERFECT impact, so that reads as 1.0
  IMPACT_EFF_BASE: 1.0,              // share of impact KE that becomes penetration budget
  IMPACT_EFF_PER: 0.12,              // + per IMPACT upgrade level
  SOIL_RESISTANCE: 0.028,           // energy drained per metre of penetration
  SOIL_HARDEN_PER_M: 0.012,          // ...rising with depth, so penetration always ends
  PEN_SPEED_SCALE: 640,              // px/s per sqrt(energy): v = scale * sqrt(E)
  PEN_MIN_SPEED: 60,                 // below this the drill has stopped
  PEN_MAX_SPEED: 1250,               // clamp so a huge impact still reads as digging
  PEN_TURN: 2.4,                     // how fast the path bends from impact angle to straight
                                     // down; soil resists sideways travel far more
  /* How long the underground field takes to fade up after impact, in seconds of GAME time.
     Game time on purpose: the hitstop freezes it too, so the contact freeze-frame holds the
     surface exactly as it was and the field only arrives once the world starts moving again. */
  UG_REVEAL_T: 0.30,
  IMPACT_STOP_T: 0.32,               // beat between "energy gone" and the drill motor
  IMPACT_MIN_SPEED: 150,             // below this a contact is a landing, not an impact

  /* ---- real terrain damage ----
     The heightfield itself is rewritten on impact, so yAt() returns the hole and every
     system downstream (collision, crust, props, the next launch) sees it. These cap how
     far the world can actually be dug out; without the cap, repeated hits on one spot
     would bore a shaft straight down through it. */
  CRATER_R_BASE: 30,                 // px radius at zero energy
  CRATER_R_SCALE: 46,                // ...plus this much per unit of impact energy
  CRATER_DEPTH_BASE: 8,
  CRATER_DEPTH_SCALE: 22,
  MAX_CRATERS: 40,                   // oldest scar drops off past this. Only reachable
                                     // in one run now, so it is a ceiling on draw cost
                                     // rather than on how deep the world can be dug.
  /* tunnel bore. The impact tears a wide hole and it narrows as the energy drains, so the
     shape of the tunnel itself says how much momentum is left. The powered drill bores
     TUNNEL_R_MIN flat — the contrast between the torn entry and the clean bore is what
     makes the handover to manual drilling readable without a word of UI. */
  TUNNEL_STAMP: 4.5,                 // px between recorded bore stamps. Tight enough that
                                     // neighbouring circles overlap heavily at the smallest
                                     // bore (12px), which is what makes the union read as
                                     // one torn hole instead of a string of beads.
  TUNNEL_R_MIN: 12,                  // px, the powered drill's clean bore
  TUNNEL_R_MAX: 23,                  // px at the moment of impact. The pod's own radius is
                                     // 19, so this is a hole a little wider than the thing
                                     // that made it. At 30 it was a third wider again and
                                     // read as a smear rather than a bore.

  MINE_DEPTH_MULT: 1.5,
  MINE_RARE_BOOST: 2.2,

  /* how far ABOVE the world surface plane the distant parallax plain sits, in world px.
     Scales with the camera like everything else, so the gap closes as the pod climbs. */
  PLAIN_LIFT: 92,

  PERFECT_ACC: 0.90,       // timing accuracy needed for PERFECT
  SOCLOSE_ACC: 0.84,       // narrow miss -> "SO CLOSE!" (presentation only)
  OVERDRIVE_T: 2.6,        // seconds of PERFECT overdrive after launch
  BEST_CHASE_M: 45,        // start the record countdown this far out

  AD_MULT: 2,              // rewarded-ad placeholder multiplier
  DIST_COIN: 14,           // distance payout = DIST_COIN * sqrt(metres):
                           // front-loads early upgrades, lets minerals lead later
  WORLD_M: 4200,          // world length in metres. A maxed-out run measures ~2940m,
                          // so the world has to outrun the player, not the other way
                          // round — running out of terrain reads as a bug.
};

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

/* ============ journey atmosphere ============
   The three BIOMES above own mechanics: soil, resistance and mineral pools. Atmosphere
   is deliberately a separate, denser progression layer. A run can cross several moods
   inside one biome, so going farther feels like entering a new place instead of watching
   one palette very slowly warm up. `from` is raw world metres (the pad starts at 13.75m). */
/* Palettes lifted from the Figma mockup "Drill Orbit: Game UI Mockup" — GREENLINE from
   node 64:854 and SUNSCORCHED from node 59:265, both named "Atmospheric Depth". The
   gradient stops and the layer order are taken exactly; the ART is not. Those frames are
   1600px of fixed SVG scenery and this world is 4200 metres wide, so the paths are TILED
   and mirrored rather than stretched — see the ridge helper in drawParallax. The other
   five atmospheres reuse the two sets of paths, recoloured, so the whole journey reads as
   one set rather than two imported frames and five strangers.

   What the mockup added that this did not have:
     haze      a band of horizon colour laid OVER each ridge, densest at its base. This is
               the "atmospheric depth" the file is named for: it is what makes the far
               ridge sit BEHIND the near one instead of merely above it.
     plain0-2  the distant horizon plain, a three-stop band between the ridges and the
               playable ground.
     prop      silhouettes standing on that plain — pines in the green frame, rocks in the
               desert one.                                                               */
const ATMOSPHERES = [
  { key: 'greenline', name: 'GREENLINE', sub: 'CLEAR MORNING', from: 0,
    /* mid is pulled well down from the mockup's #66bb95: that value was measured off a
       ridge the mockup had already hazed, and using it as the SOURCE colour hazed it a
       second time until the near ridge disappeared into the sky. plain2 likewise goes
       deeper than the mockup's #13c7a7 — there the bright band is a thin strip bounded by
       dark green hills, here it runs all the way down to the grass and needs somewhere to
       land. */
    sky0: '#50c5d5', sky1: '#7fcfcd', horizon: '#afdac5', far: '#86d2c4', mid: '#3f9d7f',
    haze: '#94e1cd', haze2: '#9fffd1', plain0: '#40f2cb', plain1: '#1fc9a6', plain2: '#0b7a62',
    vecFar: 'greenFar', vecMid: 'greenMid', vecHill0: 'greenHillFar', vecHill1: 'greenHillNear',
    prop: 'tree', propColor: '#0d3c17',
    accent: '#a8ffcf', celestial: '#fff6c9', stars: 0, weather: 'pollen' },
  { key: 'skyridge', name: 'SKYRIDGE', sub: 'HIGH ALTITUDE WINDS', from: 110,
    sky0: '#496fc5', sky1: '#8fc0e8', horizon: '#dcecfb', far: '#93b4d2', mid: '#5d7ba4',
    haze: '#cfe6fb', haze2: '#eaf5ff', plain0: '#bcdcf2', plain1: '#94b8d8', plain2: '#6d92b8',
    vecFar: 'greenFar', vecMid: 'greenMid', vecHill0: 'greenHillFar', vecHill1: 'greenHillNear',
    prop: 'tree', propColor: '#2b3d57',
    accent: '#9fe6ff', celestial: '#e9f7ff', stars: 0.05, weather: 'wind' },
  { key: 'sunscorched', name: 'SUNSCORCHED', sub: 'HEATLINE DESERT', from: 390,
    sky0: '#c1990d', sky1: '#dfae2e', horizon: '#eec85b', far: '#e6b941', mid: '#c2894f',
    haze: '#f7d55e', haze2: '#fdda5b', plain0: '#f2d060', plain1: '#e59d46', plain2: '#d76a2b',
    vecFar: 'desertFar', vecMid: 'desertMid', vecProps: 'desertProps', prop: 'rock', propColor: '#7f3136',
    accent: '#ffd071', celestial: '#fff0a8', stars: 0, weather: 'sand' },
  { key: 'twilight', name: 'TWILIGHT RUINS', sub: 'THE LIGHT FALLS AWAY', from: 750,
    sky0: '#31305e', sky1: '#a34f78', horizon: '#ef9873', far: '#8a5a76', mid: '#54406a',
    haze: '#ef9873', haze2: '#ffc09a', plain0: '#e79070', plain1: '#b96a72', plain2: '#7d4a6a',
    vecFar: 'desertFar', vecMid: 'desertMid', vecProps: 'desertProps', prop: 'rock', propColor: '#2a2140',
    accent: '#d7a8ff', celestial: '#ffe0d1', stars: 0.62, weather: 'glimmer' },
  { key: 'volcanic', name: 'VOLCANIC WASTE', sub: 'THE GROUND IS AWAKE', from: 1110,
    sky0: '#241c31', sky1: '#71333e', horizon: '#e05b3f', far: '#6d3f4a', mid: '#3c2a3a',
    haze: '#e05b3f', haze2: '#ff8a5c', plain0: '#c9553f', plain1: '#8f3a37', plain2: '#54242f',
    vecFar: 'desertFar', vecMid: 'desertMid', vecProps: 'desertProps', prop: 'rock', propColor: '#1a1016',
    accent: '#ff9452', celestial: '#ffb36b', stars: 0.34, weather: 'ember' },
  { key: 'ashfall', name: 'ASHFALL NIGHT', sub: 'NO SUN BEYOND THIS POINT', from: 1810,
    sky0: '#101728', sky1: '#303247', horizon: '#75454b', far: '#3b3f52', mid: '#242a39',
    haze: '#75454b', haze2: '#a16a72', plain0: '#5d3c42', plain1: '#42303a', plain2: '#2a222e',
    vecFar: 'desertFar', vecMid: 'desertMid', vecProps: 'desertProps', prop: 'rock', propColor: '#12161f',
    accent: '#ffb06a', celestial: '#d7deea', stars: 0.88, weather: 'ash' },
  { key: 'anomaly', name: 'ANOMALY STORM', sub: 'SIGNAL LOST', from: 2610,
    sky0: '#081d24', sky1: '#28334a', horizon: '#6a3f78', far: '#2d5568', mid: '#1c3646',
    haze: '#6a3f78', haze2: '#9a67ac', plain0: '#4d3a63', plain1: '#33314e', plain2: '#1d2739',
    vecFar: 'desertFar', vecMid: 'desertMid', vecProps: 'desertProps', prop: 'rock', propColor: '#0a1620',
    accent: '#71ffe1', celestial: '#a7fff0', stars: 1, weather: 'anomaly' },
];

/* ============ launch pads ============
   One pad per atmosphere. Reaching a stage for the first time unlocks its pad, and a run
   can then start from there instead of from home — the checkpoint idea, not Space
   Frontier's separate systems, because this world is one continuous line and the far
   stages physically sit behind the near ones.

   Why it exists: from the home pad alone, ASHFALL needs POWER 31 (~10.5M coins) and
   ANOMALY needs POWER 40 (~246M). At 14*sqrt(m) a run near 1000m pays about 440 coins, so
   those two atmospheres were roughly half a million runs away — art that shipped and that
   nobody would ever see. Measured pad to pad the same ladder is POWER 5, 5, 10, 10, 16, 18.

   `m` is metres TRAVELLED, the same coordinate SITES use, so the two tables can be read
   against each other. Positions are authored, not derived: every pad has to clear each
   landing zone's near-miss band (a pad inside one would flatten the bowl the site needs)
   and sit past its own stage's colour crossfade. They also deliberately miss every sample
   point Tools/refgen.mjs reads, so flattening the ground under them leaves the Unity
   port's fidelity references untouched. */
const PADS = [
  { key: 'greenline',   m: 0 },      // home. Its runway is shaped in World.init's main loop.
  { key: 'skyridge',    m: 215 },
  { key: 'sunscorched', m: 430 },
  { key: 'twilight',    m: 800 },
  { key: 'volcanic',    m: 1180 },
  { key: 'ashfall',     m: 1850 },
  { key: 'anomaly',     m: 2650 },
];
/* Flat core and blend-out either side of a pad, in metres. The flat part has to be wider
   than the pod so the launch angle is the same every time; the ramp exists so the pad does
   not leave a step in the silhouette. */
const PAD_FLAT = 14, PAD_RAMP = 42;

/* How the ground behaves when a meteor hits it, per biome. Resistance is the only
   mechanical difference; the rest is debris colour so each biome reads distinct. */
const IMPACT_GROUND = {
  grass:   { resist: 1.00, chunks: ['#7a5230', '#5fcf5a', '#37a544', '#4a3220'], dust: '#9a7a52', spark: null },
  desert:  { resist: 0.88, chunks: ['#d29a45', '#f0c069', '#b07f42', '#e9e0cb'], dust: '#e8c98f', spark: null },
  volcano: { resist: 1.35, chunks: ['#2f2530', '#4a3b47', '#241a1f', '#3a2a30'], dust: '#6a4a55', spark: '#ff9040' },
};

/* ============ surface sites ============
   Named points along the world. Three roles:
     decor     - scenery only; never in the UI, no reward
     milestone - landing inside pays out; drives NEXT / near-miss / strip
     mystery   - shows as ??? until first reached, then keeps its real name
   `half` is the landing half-width in metres (0 = not landable).
   `near` is how close a stop must be to earn "Xm SHORT!" feedback.          */
/* Spacing. Every site is gated by a distinct upgrade level, measured with
   tools/flight-sim.mjs. SUPPLY CRATE deliberately stays at 58m: run one still has to pay
   out, and the whole Lv1 ladder hangs off it. With one arc per run and no pads, reach is
   purely POWER x timing — see `node tools/flight-sim.mjs impact` for the ladder. */
const SITES = [
  { id: 'crate',   m: 58,   half: 8,    near: 7,  kind: 'milestone', art: 'crate',    name: 'SUPPLY CRATE',     reward: { coins: 90 } },
  { id: 'crystal', m: 126,  half: 10,   near: 8,  kind: 'milestone', art: 'crystal',  name: 'CRYSTAL PIT',      reward: { rare: 3.2 } },
  { id: 'wreck',   m: 170,  half: 9,    near: 8,  kind: 'mystery',   art: 'wreck',    name: 'RUSTED EXCAVATOR', reward: { coins: 170 } },
  { id: 'arch',    m: 230,  half: 0,               kind: 'decor',     art: 'arch',     name: 'STONE ARCH' },
  { id: 'crater',  m: 296,  half: 12,   near: 10, kind: 'milestone', art: 'crater',   name: 'METEOR CRATER',    reward: { depth: 14 } },
  { id: 'bridge',  m: 385,  half: 0,               kind: 'decor',     art: 'bridge',   name: 'OLD BRIDGE' },
  { id: 'bones',   m: 495,  half: 11,   near: 9,  kind: 'mystery',   art: 'bones',    name: 'GIANT SKELETON',   reward: { coins: 340 } },
  { id: 'obelisk', m: 600,  half: 0,               kind: 'decor',     art: 'obelisk',  name: 'OBELISK' },
  { id: 'mine',    m: 712.5, half: 17.5, near: 12, kind: 'major',    art: 'mine',     name: 'ANCIENT MINE',     reward: { depthMult: 1.5, rare: 2.2 } },
  { id: 'rig',     m: 985,  half: 13,   near: 11, kind: 'mystery',   art: 'rig',      name: 'ABANDONED RIG',    reward: { coins: 760 } },
  { id: 'lava',    m: 1480, half: 16,   near: 13, kind: 'milestone', art: 'lava',     name: 'LAVA TUBE',        reward: { depth: 24 } },
  /* the far pair arrives at 3–4x the Lv1 speed, so their windows are wider in metres
     just to stay the same size in reaction time */
  { id: 'tower',   m: 2180, half: 20,   near: 15, kind: 'mystery',   art: 'towerbase', name: 'SIGNAL TOWER',    reward: { coins: 2400 } },
];

const World = {
  step: 12,
  hs: null,
  props: [],
  ug: null,           // active underground field

  /* ---------- biome ---------- */
  /* Stretched with SITES so each biome still owns the same named places: METEOR CRATER is
     the last grassland site, ANCIENT MINE sits in the desert, LAVA TUBE in the volcano.
     These are RAW world metres; sites are metres TRAVELLED, 13.75m higher (PAD_X). */
  biomeKeyAt(xm) { return xm < 400 ? 'grass' : xm < 1100 ? 'desert' : 'volcano'; },

  stageAt(xm) {
    let index = 0;
    for (let i = 1; i < ATMOSPHERES.length; i++) {
      if (xm >= ATMOSPHERES[i].from) index = i;
      else break;
    }
    return { ...ATMOSPHERES[index], index };
  },

  /* A 72m crossfade is long enough to be cinematic at high speed but short enough that
     the player can point at the instant the world changed. Shape/weather swap at the
     midpoint; all colour and intensity values stay continuous. */
  /* Half-width of the blend into atmosphere `i`, in metres. Was a flat 36 either side, and
     that number was chosen against a pod that crawled. A Lv20 arc covers 960m in 4.6s —
     208 metres per SECOND — so a 72m band was crossed in a third of a second and the whole
     sky changed identity mid-flight, which is the single most jarring thing in the arc.
     Scaled to the gap between neighbours instead: wide where the world gives room, and
     never so wide that two bands overlap and the search below picks the wrong edge. */
  blendHalf(i) {
    const gap = ATMOSPHERES[i].from - ATMOSPHERES[i - 1].from;
    const nextGap = i + 1 < ATMOSPHERES.length
      ? ATMOSPHERES[i + 1].from - ATMOSPHERES[i].from : gap;
    return Math.min(150, Math.min(gap, nextGap) * 0.45);
  },

  atmosphereAt(xm) {
    for (let i = 1; i < ATMOSPHERES.length; i++) {
      const edge = ATMOSPHERES[i].from;
      const hw = this.blendHalf(i);
      if (xm < edge - hw || xm > edge + hw) continue;
      const prev = ATMOSPHERES[i - 1], next = ATMOSPHERES[i];
      const t = U.smooth(U.clamp((xm - (edge - hw)) / (hw * 2), 0, 1));
      const out = { ...(t < 0.5 ? prev : next), index: U.lerp(i - 1, i, t) };
      /* Colours blend, but everything STRUCTURAL — which mountain path, whether this
         atmosphere has hill bands or a desert rock layer — is picked whole from one side
         or the other. Handing back the endpoints lets drawParallax cross-fade the two
         skylines instead of cutting between them halfway through the colour blend. */
      out.blend = { prev, next, t };
      /* the haze and the plain belong to the blend too: without them the fog and the
         horizon band snapped from one atmosphere to the next halfway through an otherwise
         smooth transition */
      for (const k of ['sky0', 'sky1', 'horizon', 'far', 'mid', 'accent', 'celestial',
                       'haze', 'haze2', 'plain0', 'plain1', 'plain2'])
        out[k] = U.mix(prev[k], next[k], t);
      out.stars = U.lerp(prev.stars, next.stars, t);
      return out;
    }
    return this.stageAt(xm);
  },

  /* blended palette so transitions read smoothly */
  paletteAt(xm) {
    let a, b, t;
    if (xm < 340) { a = 'grass'; b = 'grass'; t = 0; }
    else if (xm < 460) { a = 'grass'; b = 'desert'; t = U.smooth((xm - 340) / 120); }
    else if (xm < 1020) { a = 'desert'; b = 'desert'; t = 0; }
    else if (xm < 1180) { a = 'desert'; b = 'volcano'; t = U.smooth((xm - 1020) / 160); }
    else { a = 'volcano'; b = 'volcano'; t = 0; }
    const A = BIOMES[a], B = BIOMES[b];
    const out = {};
    for (const k of ['sky0', 'sky1', 'top', 'top2', 'soil', 'soil2', 'far', 'mid'])
      out[k] = t === 0 ? A[k] : U.mix(A[k], B[k], t);
    out.key = t < 0.5 ? a : b;

    /* Pull the ground into the atmosphere's own family. The two palettes were authored
       independently — BIOMES owns soil and minerals, ATMOSPHERES owns the sky — and with
       the background now carrying the whole screen, a brown bank of earth sitting under a
       turquoise morning read as two pictures stacked rather than one place.

       Tinted, not replaced. At a full swap the ground stops being earth and the biome
       stops being legible; at roughly half it still reads as soil while taking the cast
       the sky is throwing on it, which is what light actually does. The ramp continues the
       one the parallax already walks: distant plain, then hills at -0.1 and -0.22, then
       this ground deeper still. `key` is untouched — resistance, mineral pools and debris
       colour all hang off it and are mechanics, not mood. */
    const atm = this.atmosphereAt(xm);
    const deep = atm.plain2;
    /* Nearly all the way on hue, only half on saturation. At 0.8 the rotation stopped 36
       degrees short in SKYRIDGE — a near-antipodal turn only covers so much at 80% — and a
       violet ground under a slate sky is still two pictures. Saturation is held back on
       purpose: matching that too makes the ground as vivid as the sky and it stops sitting
       behind everything. */
    out.soil = U.tint(out.soil, deep, 0.92, 0.45, -0.02);
    out.soil2 = U.tint(out.soil2, deep, 0.92, 0.45, -0.02);
    out.top = U.tint(out.top, deep, 0.82, 0.38);
    out.top2 = U.tint(out.top2, deep, 0.82, 0.38);
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
      /* Damp the first ~400m hard. Near-miss psychology only works if the player blames
         their timing, and one steep hill was worth more than a whole POWER level.
         Extended from 320m: a skilled Lv1 chain now reaches 302m, so the whole of level
         one has to stay deterministic, not just its no-input band. */
      amp *= U.lerp(0.34, 1, U.smooth(U.clamp((xm - 55) / 345, 0, 1)));
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

    /* clamp slope so the terrain silhouette stays readable and a crater always lands on
       ground the player could see coming. The early world gets a much tighter cap. */
    const slopeAt = (i) => {
      const xm = (i * this.step) / CFG.M;
      return this.step * U.lerp(0.22, 0.55, U.smooth(U.clamp((xm - 55) / 345, 0, 1)));
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

    /* Carve a gentle bowl at every landing zone, so a zone reads as a place to aim at
       and the ground around it is flat enough for the distance to be repeatable. */
    for (const site of SITES) {
      if (site.half <= 0) continue;
      const iA = Math.floor(this.xOf(site.m - site.half) / this.step);
      const iB = Math.ceil(this.xOf(site.m + site.half) / this.step);
      const pad = Math.round(((site.near + 6) * CFG.M) / this.step);
      /* Shallow on purpose: the bowl is scenery and framing, never a trap. Where the pod
         lands is decided by the arc alone, and a deep bowl would quietly move the contact
         point away from where the player aimed. */
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

    /* Level the ground under every away pad, before the zone bowls so a site always wins
       where the two would meet. Sampled height first, then written, so the blend reads the
       original terrain rather than its own half-finished result. */
    for (const pad of PADS) {
      if (pad.m === 0) continue;                    // home pad: shaped in the loop above
      const px = this.xOf(pad.m);
      const flatY = this.hs[U.clamp(Math.round(px / this.step), 0, count - 1)];
      const i0 = Math.floor((px - PAD_RAMP * CFG.M) / this.step);
      const i1 = Math.ceil((px + PAD_RAMP * CFG.M) / this.step);
      for (let i = i0; i <= i1; i++) {
        if (i < 0 || i >= count) continue;
        const d = Math.abs(i * this.step - px) / CFG.M;
        const w = d <= PAD_FLAT ? 1
                : U.smooth(U.clamp((PAD_RAMP - d) / (PAD_RAMP - PAD_FLAT), 0, 1));
        this.hs[i] = U.lerp(this.hs[i], flatY, w);
      }
    }

    this.buildProps(seed);
  },

  /* ---------- impact craters ----------
     A crater is a set of circles subtracted from the ground PATH at draw time. The
     heightfield is never touched, so it is not terrain damage in the simulation sense —
     collision, the crust, the props and the next launch all keep seeing the original
     ground, and the scars are wiped at the start of every run. See carveCrater for what
     that trade buys and what it costs. */
  craters: [],

  /* Record a crater. NOTHING is written to the heightfield: `hs` stays pristine for the
     whole session, so yAt() is one unchanging answer for collision, the crust, the props'
     footing, the launch pad and every future arc.

     That is the trade this model makes, and it is worth stating plainly. The damage is a
     DRAWING now, not an event: a second pod landing in the same spot lands on the original
     ground, and the scars are wiped at the start of every run. What it buys is that the
     ground can never disagree with itself — the entire class of bug where the picture and
     the collision had carved at different moments simply cannot happen — and the code that
     existed to keep them in step (a pristine backup array, the excavated-face pass, the
     depth cap against repeat hits) is gone.

     The bite is stored as circles, which is how Worms and Tank Stars hold it: one main
     bowl whose lower arc is exactly the old heightfield curve, two shallow scallops that
     break the lip, and a handful of nibbles. drawTerrain subtracts them from the ground
     path, so the sky shows through the hole and the crust stroke stops at its edge.

     Geometry of the main bowl: for a bite `depth` deep and `rPx` wide at ground level,
       R = (rPx^2 + depth^2) / (2 * depth)   centred at groundY + depth - R.            */
  carveCrater(x, rPx, depth, pal) {
    const y = this.yAt(x);
    const seed = (Math.random() * 1e6) | 0;
    const jag = U.mulberry32(seed);
    const R = (rPx * rPx + depth * depth) / (2 * depth);

    const cy = y + depth - R;
    const holes = [{ x, y: cy, r: R }];
    /* Roughen the CUT, not the neighbourhood. The nibbles sit on the bowl's own lower arc,
       each straddling it, so half of every circle falls inside the bite and does nothing
       while the other half takes a small extra bite out of the wall. Scattered freely
       instead — the first attempt threw them anywhere within 1.05x the radius — they punch
       separate pits in the flat ground beyond the rim, and the crater stops reading as one
       hole and starts reading as a cluster of lumps. */
    const nn = 15 + ((jag() * 7) | 0);
    for (let i = 0; i < nn; i++) {
      const t = (i + 0.15 + jag() * 0.7) / nn;
      const dx = (t * 2 - 1) * rPx * 0.97;
      const arcY = cy + Math.sqrt(Math.max(0, R * R - dx * dx));
      /* small and many. At twice this radius each one cuts a semicircle you can pick out
         individually and the rim reads as a string of beads rather than a broken edge. */
      const rr = rPx * (0.035 + jag() * 0.05);
      holes.push({ x: x + dx, y: arcY + rr * (jag() * 1.1 - 0.45), r: rr });
    }

    /* Anything growing or standing inside the bite is gone. Leaving bushes and rocks
       upright in the middle of a meteor crater was the single loudest tell that the
       destruction was a drawing rather than an event. Flagged, not spliced, so
       clearCraters() can bring the scenery back. */
    const killed = [];
    for (const p of this.props) {
      if (p.gone) continue;
      if (Math.abs(p.x - x) < rPx * 0.92) { p.gone = true; killed.push(p); }
    }

    /* rubble authored once, so the floor is the same every frame */
    const rubble = [];
    const rn = 4 + ((jag() * 5) | 0);
    for (let i = 0; i < rn; i++) {
      rubble.push({ dx: (jag() - 0.5) * rPx * 1.3, r: 3 + jag() * 7, rot: jag() * 6.28, s: jag() });
    }
    /* radiating cracks, drawn later — cheap, authored once per impact */
    const cracks = [];
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const len = rPx * U.rand(0.5, 1.15);
      cracks.push({ x0: x + side * rPx * U.rand(0.55, 0.95), len: len * side, w: U.rand(1.5, 3) });
    }
    this.craters.push({ x, y, rPx, depth, pal, holes, cracks, rubble, seed, born: performance.now() / 1000 });
    if (this.craters.length > CFG.MAX_CRATERS) this.craters.shift();
    /* the caller throws the wreckage, and plants the pod on the floor of the bite */
    return { killed, floorY: y + depth };
  },

  /* Add every visible crater to the CURRENT path, wound against the outer shape so a
     non-zero fill turns them into holes. Overlapping circles stay one hole, which is why
     this cannot use the even-odd rule: even-odd would XOR the overlaps back into solid
     ground and leave islands floating in the middle of the bite. */
  /* Clip to damaged ground: everything below the surface, minus the bites.
     TWO clips, not one path, and that is the whole subtlety. A single path of
     ground-polygon + reverse-wound circles looks right and is wrong: the non-zero rule
     gives winding 0 inside a circle that overlaps the ground (a hole, correct) but -1
     where the same circle sticks out ABOVE the ground — and -1 is non-zero, so the part
     of the bite that reaches into the sky paints as solid soil. The main bowl reaches
     ~90px above the surface, so that was a brown disc hanging over every crater.
     Clipping to the ground first makes the sky half moot; the second clip then only has
     to say "not inside a circle", which a big rectangle minus the circles expresses
     exactly. Verified on a scratch canvas rather than reasoned about. */
  clipDamaged(ctx, x0, x1, bottom, left, right) {
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += this.step) ctx.lineTo(x, this.yAt(x));
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    ctx.clip();
    if (!this.craters.length) return;
    ctx.beginPath();
    ctx.rect(x0 - 200, CFG.SURFACE_Y - 4000, x1 - x0 + 400, bottom - CFG.SURFACE_Y + 4400);
    this.craterHoles(ctx, left, right);
    ctx.clip();
  },

  craterHoles(ctx, left, right) {
    let any = false;
    for (const c of this.craters) {
      if (c.x < left - c.rPx - 60 || c.x > right + c.rPx + 60) continue;
      for (const h of c.holes) {
        /* Wound AGAINST the outer ground polygon, which is built bottom-left, up to the
           surface, along it, and back down. Verified on a scratch canvas rather than
           reasoned about: with that outer shape, anticlockwise=true gives winding 0 inside
           the circle and punches the hole; false gives -1 and fills it solid. */
        ctx.moveTo(h.x + h.r, h.y);
        ctx.arc(h.x, h.y, h.r, 0, U.TAU, true);
        any = true;
      }
    }
    return any;
  },

  /* wipe the damage. Cheap now: there is no heightfield to restore. */
  clearCraters() {
    this.craters.length = 0;
    for (const p of this.props) p.gone = false;
  },

  /* The cut face. NOT a fill of the bite — that was tried in the heightfield model and it
     is the wrong picture: a crater is a cross-section, the material is GONE, and the sky
     belongs in the middle of it. Painting the removed volume back in turns the hole into a
     dark mass and the silhouette, which is the whole read, disappears.

     So this is a band hugging the cut on the SOLID side: stroke the bite outline wide,
     clipped to the ground, and only the half that lands on earth survives. Fresh subsoil
     a little darker than the surface, plus the horizontal strata that say you are looking
     into layers rather than at a shape cut out of a picture. */
  drawCraterWalls(ctx, left, right, pal) {
    const st = this.step;
    const x0 = Math.floor((left - 80) / st) * st - st;
    const x1 = Math.ceil((right + 80) / st) * st + st;
    const bottom = CFG.SURFACE_Y + 6000;
    for (const c of this.craters) {
      if (c.x < left - c.rPx - 60 || c.x > right + c.rPx + 60) continue;
      ctx.save();
      this.clipDamaged(ctx, x0, x1, bottom, left, right);

      ctx.beginPath();
      for (const h of c.holes) { ctx.moveTo(h.x + h.r, h.y); ctx.arc(h.x, h.y, h.r, 0, U.TAU); }
      ctx.lineJoin = ctx.lineCap = 'round';
      /* wide band of raw subsoil, then a narrower darker one right at the lip */
      ctx.strokeStyle = U.shade(pal.soil, -0.12);
      ctx.lineWidth = 15;
      ctx.stroke();
      ctx.strokeStyle = U.shade(pal.soil2, -0.05);
      ctx.lineWidth = 6;
      ctx.stroke();

      /* strata exposed in the band: horizontal, because layers are horizontal */
      ctx.save();
      ctx.clip();                        // the band itself
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = '#000';
      for (let d = 6; d < c.depth + 40; d += 15) {
        ctx.fillRect(c.x - c.rPx * 1.8, c.y + d, c.rPx * 3.6, 4);
      }
      ctx.restore();
      ctx.restore();

      /* rubble caught on the lip, half-buried */
      for (const r of c.rubble) {
        const rx = c.x + r.dx;
        const k = U.clamp(Math.abs(r.dx) / (c.rPx * 0.95), 0, 1);
        const ry = c.y + c.depth * (1 - k * k) - r.r * 0.3;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(r.rot);
        ctx.fillStyle = U.shade(pal.soil2, r.s * 0.3 - 0.1);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * U.TAU;
          const rr = r.r * (0.75 + ((Math.sin(i * 9.1 + r.s * 30) + 1) / 2) * 0.5);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }
    }
  },

  /* Scorch and cracks ON the bite. The hole is a gap in the ground path; this only adds
     the burn and the fracture lines that say something violent happened here. */
  drawCraters(ctx, left, right) {
    const now = performance.now() / 1000;
    const st = this.step;
    const x0 = Math.floor((left - 80) / st) * st - st;
    const x1 = Math.ceil((right + 80) / st) * st + st;
    const bottom = CFG.SURFACE_Y + 6000;
    for (const c of this.craters) {
      if (c.x < left - c.rPx - 60 || c.x > right + c.rPx + 60) continue;
      const age = now - c.born;
      ctx.save();
      /* Burn and a hard edge, both hugging the cut, both clipped to solid ground. The
         outline is the other half of the Worms/Tank Stars look: carved terrain has a
         crisp border, and without it a hole reads as a smudge no matter how right the
         geometry is. Unclipped, the same stroke draws the rest of each circle as a dark
         ring hanging in the sky above the crater. */
      this.clipDamaged(ctx, x0, x1, bottom, left, right);
      ctx.beginPath();
      for (const h of c.holes) { ctx.moveTo(h.x + h.r, h.y); ctx.arc(h.x, h.y, h.r, 0, U.TAU); }
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#1a1116';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const heat = U.clamp(1 - age / 2.2, 0, 1);
      if (heat > 0.01) {
        /* glow on the ROCK around the cut, not inside the hole — inside is sky now */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = heat * 0.4;
        const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.rPx * 0.7);
        g.addColorStop(0, '#ffb066'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rPx * 0.7, c.depth * 0.3 + 4, 0, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }

      /* fracture lines running out of the rim, following the real surface */
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.lineCap = 'round';
      for (const k of c.cracks) {
        ctx.lineWidth = k.w;
        ctx.beginPath();
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const px = k.x0 + (k.len * i) / steps;
          const py = this.yAt(px) + 1 + Math.sin(i * 2.1 + c.x) * 1.5;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  yAt(x) {
    const n = this.hs.length;
    const f = x / this.step;
    let i = Math.floor(f);
    if (i < 0) return this.hs[0];
    if (i >= n - 1) return this.hs[n - 1];
    return U.lerp(this.hs[i], this.hs[i + 1], U.smooth(f - i));
  },

  /* Clip whatever comes next to the SOIL — everything at or below the live heightfield,
     crater included. The underground view used to paint its depth bands as plain
     rectangles starting at `ug.surfaceY`, a flat line sampled at the moment of impact
     BEFORE the crater was carved. Those rectangles landed on top of the finished crater
     and refilled it, so the entry read as undamaged flat ground with a shaft floating
     unconnected below it. Clipped here, the soil stops where the ground actually stops. */
  /* Record the hole the drill is making, as overlapping circles rather than as a centre
     line. Lifted from the Worms/Tank Stars family of destructible terrain, where the hole
     IS a sequence of erased circles: interpolating stamps along the travelled segment and
     jittering each radius gives a wall that looks torn rather than extruded, and the
     circles union into a single silhouette for free — no outline to build, no clipping to
     make the crater and the shaft agree.

     The difference from that reference is that nothing here is erased from a bitmap. Our
     terrain is a heightfield, so damage is real (collision, crust, props and the next
     launch all see the crater) and it persists across runs; the stamps are the RENDERING
     of the shaft, replayed every frame from a stored list. Which means every jitter has to
     be rolled ONCE and kept — re-rolling per frame would make the walls boil.

     `ragged` (0..1) scales how often an extra off-axis nibble is thrown in: a violent
     entry chews the wall, the powered drill bores nearly clean.                        */
  stampTunnel(ug, x, y, r, ragged) {
    const tn = ug.tunnel;
    if (!tn.length) {
      tn.push({ x, y, r });
      ug.tx = x; ug.ty = y; ug.tr = r;
      return;
    }
    const dx = x - ug.tx, dy = y - ug.ty;
    const dist = Math.hypot(dx, dy);
    if (dist < CFG.TUNNEL_STAMP) return;
    const steps = Math.ceil(dist / CFG.TUNNEL_STAMP);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = ug.tx + dx * t, sy = ug.ty + dy * t;
      const rr = U.lerp(ug.tr, r, t) * U.rand(0.84, 1.15);
      tn.push({ x: sx, y: sy, r: rr });
      /* the nibble is what actually makes the wall look broken. Radius jitter alone barely
         survives the union — neighbouring stamps are 4.5px apart and simply swallow it —
         so the ragged edge has to come from circles thrown OFF the axis. */
      if (Math.random() < 0.3 * (ragged || 0)) {
        const a = Math.random() * U.TAU, d = rr * U.rand(0.55, 1.0);
        tn.push({
          x: sx + Math.cos(a) * d,
          y: sy + Math.sin(a) * d,
          r: rr * U.rand(0.3, 0.58),
        });
      }
    }
    ug.tx = x; ug.ty = y; ug.tr = r;
  },

  clipToSoil(ctx, left, right) {
    const s = this.step;
    const x0 = Math.floor((left - 60) / s) * s - s;
    const x1 = Math.ceil((right + 60) / s) * s + s;
    const bottom = CFG.SURFACE_Y + 8000;
    /* the craters are holes in the soil here too, or the depth bands would fill the bite
       back in from below and the entry would read as undamaged flat ground again */
    this.clipDamaged(ctx, x0, x1, bottom, left - 60, right + 60);
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

  /* ---------- launch pads ---------- */
  pads: PADS,
  padFor(key) { return PADS.find((p) => p.key === key) || PADS[0]; },
  /* World x of a pad. CFG.PAD_X stays the ORIGIN of the metres-travelled coordinate — it
     is what sites, markers and the tools are authored against — so it must not be
     repurposed as "where this run starts". That is Game.padX. */
  padX(key) { return this.xOf(this.padFor(key).m); },
  /* The furthest pad the player has unlocked, so a fresh save cannot select one it has
     never reached and a corrupt list cannot strand the run off the map. */
  padUnlocked(key, list) { return key === 'greenline' || (list || []).includes(key); },

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

  /* ---------- sky + parallax (screen space) ---------- */
  /* Altitude bands, in world px above SURFACE_Y. The sky is a function of HEIGHT, not of
     screen position: at the pad you see the biome's own sky, and as the pod climbs the
     black of space comes down into view from the top of the screen rather than the whole
     background swapping colour. Measured against what the game can actually reach —
     `node tools/flight-sim.mjs impact` puts a Lv1 PERFECT apex at 403px and a Lv20 one at
     3343px — so 3200 is "as high as this game goes" and the ladder in between is what
     upgrading buys you a view of. */
  SKY_BANDS: [
    [-400, null],          // below the surface: hold the horizon colour
    [0, null],             // the ground line: horizon colour
    [250, null],           // sky1
    [700, null],           // sky0
    [1800, '#16265c'],     // thin air
    [3200, '#05060f'],     // space
  ],

  /* colour of the sky at `alt` world px above the surface */
  skyAt(alt, pal) {
    const B = this.SKY_BANDS;
    const col = (i) => B[i][1] || (i <= 1 ? pal.horizon : i === 2 ? pal.sky1 : pal.sky0);
    if (alt <= B[0][0]) return col(0);
    for (let i = 1; i < B.length; i++) {
      if (alt <= B[i][0]) {
        const t = (alt - B[i - 1][0]) / (B[i][0] - B[i - 1][0]);
        return U.mix(col(i - 1), col(i), U.clamp(t, 0, 1));
      }
    }
    return col(B.length - 1);
  },

  drawSky(ctx, cam, W, H) {
    const pal = this.atmosphereAt(cam.x / CFG.M);
    /* screen row -> world y -> altitude, sampled down the screen. Thirteen stops is far
       smoother than the eye can resolve on a gradient this long and costs nothing.
       Uses the BACKGROUND zoom, not the camera's, so a snap cut cannot jolt the sky. */
    const bz = cam.bz || cam.zoom;
    const worldAt = (t) => cam.y + (t * H - H * cam.anchor) / bz;
    const altAt = (t) => CFG.SURFACE_Y - worldAt(t);
    const tOfAlt = (alt) => (CFG.SURFACE_Y - alt - cam.y) * bz / H + cam.anchor;

    /* Stops placed ON the band edges, not sampled at even intervals. skyAt is piecewise
       linear between those edges, so edge-aligned stops reproduce it EXACTLY; even
       sampling does not. High up, one screen spans ~2900 world px and a fixed 13 samples
       land 224px apart, which walks straight past band edges and facets the gradient into
       visible slabs — slabs that then slide as the camera moves, which is what made the
       climb look like the sky was stepping rather than fading. */
    const stops = [[0, this.skyAt(altAt(0), pal)], [1, this.skyAt(altAt(1), pal)]];
    for (const [alt] of this.SKY_BANDS) {
      const t = tOfAlt(alt);
      if (t > 0.0005 && t < 0.9995) stops.push([t, this.skyAt(alt, pal)]);
    }
    /* Sorted before adding: altitude runs UP the screen while a gradient offset runs down,
       so walking the bands in their own order hands addColorStop a descending sequence. */
    stops.sort((p1, p2) => p1[0] - p2[0]);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (const [t, c] of stops) g.addColorStop(t, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* How much of space is in frame, from the altitude at the TOP of the screen. Drives
       the stars, so they answer to height rather than to the clock. It used to be stored on
       World as `spaceT` for the earth-curvature pass to read; that pass is gone, so this is
       a local again. */
    const altTop = CFG.SURFACE_Y - worldAt(0);
    const space = U.clamp((altTop - 900) / 2300, 0, 1);


    /* Stars phase in with height and with the journey's own nightfall, whichever is
       further along. Placed in world space at a very slow rate so they read as sky rather
       than as a decal stuck to the screen. */
    const stars = Math.max(pal.stars, space);
    if (stars > 0.01) {
      ctx.save();
      const rate = 0.03;
      for (let i = 0; i < 70; i++) {
        const wx = (hash2(i * 71, 19) - 0.5) * 40000;
        const wy = hash2(i * 29, 47) * -6000;
        const x = ((W / 2 + (wx - cam.x * rate) % (W * 2)) + W * 2) % (W * 2) - W * 0.5;
        const y = H * cam.anchor + (wy - cam.y * rate) * 0.35;
        if (y < -10 || y > H * 0.9) continue;
        const tw = 0.45 + 0.35 * Math.sin(performance.now() * 0.0018 + i * 2.1);
        ctx.globalAlpha = stars * tw;
        ctx.fillStyle = i % 7 === 0 ? pal.accent : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, i % 6 === 0 ? 1.6 : 0.9, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }

    /* The celestial body migrates left and shrinks as the journey darkens, and rides a
       little with the camera so it is not nailed to the viewport. */
    const sunX = U.lerp(W * 0.78, W * 0.25, pal.index / (ATMOSPHERES.length - 1)) - cam.x * 0.012 % W;
    const sunY = U.lerp(H * 0.14, H * 0.22, pal.index / (ATMOSPHERES.length - 1))
               + (CFG.SURFACE_Y - cam.y) * 0.03;
    ctx.save();
    ctx.globalAlpha = (pal.key === 'volcanic' ? 0.22 : 0.32) * (1 - space * 0.45);
    ctx.fillStyle = pal.celestial;
    ctx.beginPath();
    ctx.arc(sunX, sunY, W * (pal.index >= 3 ? 0.055 : 0.09), 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha *= 0.35;
    ctx.beginPath(); ctx.arc(sunX, sunY, W * 0.15, 0, U.TAU); ctx.fill();
    ctx.restore();

    drawAtmosphereWeather(ctx, pal, cam, W, H);
  },

  /* Scratch layer for cross-fading one whole skyline over another. Screen-sized and
     reused; see drawParallax for why a layer is needed rather than a globalAlpha. */
  paraLayer(ctx) {
    const cvs = ctx.canvas;
    if (!this._para) {
      this._para = document.createElement('canvas');
      this._pctx = this._para.getContext('2d');
    }
    if (this._para.width !== cvs.width || this._para.height !== cvs.height) {
      this._para.width = cvs.width;
      this._para.height = cvs.height;
    }
    this._pctx.setTransform(1, 0, 0, 1, 0, 0);
    this._pctx.clearRect(0, 0, this._para.width, this._para.height);
    this._pctx.setTransform(ctx.getTransform());
    return this._pctx;
  },

  /* Screen y of the distant plain's top edge. Shared by drawStack and drawParallax.
     Taken literally, with NO cap: at apex it slides clean off the bottom of the screen and
     the planet is gone, which is the point — a climb that leaves nothing behind reads as
     scenery being dragged along rather than as altitude.

     This used to be soft-capped at 0.88 of the screen with a 0.12 creep, precisely so the
     planet could NOT vanish. That was the wrong call: past roughly 100m up the cap froze
     the horizon, so another 100m of climb changed nothing on screen. The cap also has to
     match whatever the real terrain does, and the terrain is drawn in world space with no
     cap at all — pinning one and not the other pulls them apart visibly. */
  horizonAt(cam, H) {
    const z = cam.bz || cam.zoom;
    return H * cam.anchor + (CFG.SURFACE_Y - CFG.PLAIN_LIFT - cam.y) * z;
  },

  drawParallax(ctx, cam, W, H) {
    const pal = this.atmosphereAt(cam.x / CFG.M);
    const b = pal.blend;
    if (!b) { this.drawStack(ctx, cam, W, H, pal); return; }

    /* Two things cross a stage boundary, and they must NOT travel together.

       COLOUR blends across the whole band — 250-odd metres for the desert — because a slow
       atmospheric shift is the point. SHAPE cannot be interpolated at all: which mountain
       path is drawn, and whether this stage has hill bands or a desert rock layer, is a
       choice between two sets of art. So the shapes dissolve inside a SHORT window in the
       middle of the colour blend, and outside that window exactly one skyline is drawn.

       This used to hand each half its own raw atmosphere — `drawStack(..., b.prev)` — which
       threw away the blended palette that had just been computed and drew the outgoing
       stage in its OWN colours. Measured at 433m travelled, 82% of the way through the
       skyridge->sunscorched blend, that still put SKYRIDGE's blue hills and blue-grey pines
       at 18% over an orange desert. Blue against orange at 18% is not a ghost, it reads as
       solid scenery from the wrong biome — which is exactly what it looked like.

       Now both halves take the SAME blended colours and differ only in which art they
       point at, so the palette is never mixed with itself and the only thing dissolving is
       the silhouette.

       Drawn as a layer rather than with globalAlpha because the stack sets its own alpha
       internally for haze and overlays; a layer is the only way to fade the result as one
       image. The outgoing shape is painted solid first so coverage is always complete —
       two half-transparent stacks would let the sky through between them. */
    const st = U.smooth(U.clamp((b.t - 0.40) / 0.20, 0, 1));
    const propColor = U.mix(b.prev.propColor, b.next.propColor, b.t);
    const shaped = (side) => Object.assign({}, pal, {
      vecFar: side.vecFar, vecMid: side.vecMid,
      vecHill0: side.vecHill0, vecHill1: side.vecHill1,
      vecProps: side.vecProps, prop: side.prop, propColor,
    });

    if (st <= 0.002) { this.drawStack(ctx, cam, W, H, shaped(b.prev)); return; }
    if (st >= 0.998) { this.drawStack(ctx, cam, W, H, shaped(b.next)); return; }

    this.drawStack(ctx, cam, W, H, shaped(b.prev));
    const lx = this.paraLayer(ctx);
    this.drawStack(lx, cam, W, H, shaped(b.next));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = st;
    ctx.drawImage(this._para, 0, 0);
    ctx.restore();
  },

  /* One atmosphere's full skyline: ridges, haze, the distant plain and whatever stands on
     it. Takes the palette explicitly so two of them can be drawn in one frame. */
  drawStack(ctx, cam, W, H, pal) {
    const z = cam.bz || cam.zoom;
    /* This scenery is ON THE GROUND, so it has to behave like it. The horizon is the world
       surface plane put through the camera — same transform the terrain gets — lifted by a
       fixed WORLD distance so the distant plain reads as further away rather than sitting
       on top of the near ground. Both terms carry the zoom, so as the pod climbs and the
       camera pulls back the whole landscape shrinks and settles toward the terrain line
       instead of hanging at a fixed height on the screen.

       Before this, the horizon was H*0.55 plus a damped 0.18 of the camera's height and
       nothing scaled at all: the trees stayed the same size at 400 metres up as they were
       on the pad, which is what made the world feel like a painted backdrop instead of a
       planet being left behind. */
    const horizon = this.horizonAt(cam, H);
    /* The mockup frames are 900px tall with their horizon — the top of the distant plain —
       at y 513. Every offset below is that frame's own measurement, taken relative to the
       horizon and scaled by k, which now carries the camera zoom too. Figma layer names
       are quoted so the order can be checked against the file. */
    const k = (H / 900) * z;

    /* The horizon is a STRAIGHT line, and that is a decision rather than a simplification.
       There used to be an earth-curvature pass here: a parabola bending the top edge of the
       distant plain, the far ground line and every ridge row into a dome. It was removed
       because a curved horizon is all-or-nothing — the real terrain, the props standing on
       it, the sites and the 100m markers are drawn in world space and would every one of
       them have to bend by the same amount to agree with it. Bending only the backdrop is
       what made it read as a dome sitting behind a flat world instead of as a planet. */
    const fillBelow = (topY, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(0, topY, W, H - topY + 2);
    };

    /* A tiled band of one vector. The frames are 1600px and this world is 4200 metres, so
       the path repeats; alternate tiles are MIRRORED, which is both free and exact — a
       mirrored join meets right edge to right edge and left to left, so the seam matches
       whatever the path's end heights happen to be. The mockup does the same thing: every
       range in it is a group plus a -scale-x-100 copy of itself.
       `baseOff` is where the art's BOTTOM sits relative to the horizon.

       The tile is drawn at the art's OWN aspect ratio. Squeezing it horizontally to fit a
       whole range into a portrait screen was tried and it is the wrong trade: the mockup
       is 1600x900 landscape and this game is a ~490px column, so making a range fit meant
       compressing it three or four times over, and the desert frame's flat-topped mesas
       turned into thin towers. The silhouette IS the art. A portrait screen simply shows
       part of a wide range at a time and scrolls across the rest, which is what every
       portrait game does with landscape scenery.
       `ground` fills below the base so a range stands on something instead of floating. */
    const band = (key, rate, baseOff, drawH, fill, ground, phase) => {
      const v = VEC[key];
      if (!v) return;
      const sw = drawH * (v.w / v.h);          // on-screen width of one tile
      /* The tile's period in the WORLD, and it must not contain the zoom. `sw` does — it
         is a screen length — so dividing it back out is what keeps the pattern nailed to
         the world. Without that division the period moved every time the camera zoomed,
         which slid and stretched the entire skyline sideways for reasons that had nothing
         to do with the camera travelling. Through a launch, zoom runs 1.0 down to 0.28, so
         the whole backdrop was crawling the entire way up. */
      const P = sw / (z * rate);
      /* the horizontal rate carries the zoom too: pulled back, a given camera move has to
         push the scenery a shorter way across the screen, not the same way */
      const span = (W / 2) / (rate * z);
      const base = horizon + baseOff;
      const topY = base - drawH;
      const ph = (phase || 0) * P;
      const i0 = Math.floor((cam.x - span - ph) / P) - 1;
      const i1 = Math.ceil((cam.x + span - ph) / P) + 1;
      for (let i = i0; i <= i1; i++) {
        const sx = W / 2 + (i * P + ph - cam.x) * rate * z;
        if (sx > W + 2 || sx + sw < -2) continue;
        const top = topY;
        if (i & 1) {
          ctx.save();
          ctx.translate(sx + sw, 0);
          ctx.scale(-1, 1);
          drawVec(ctx, v, 0, top, sw, drawH, fill);
          ctx.restore();
        } else {
          drawVec(ctx, v, sx, top, sw, drawH, fill);
        }
      }
      if (ground) fillBelow(base - 1, ground);
    };

    /* Where a band's silhouette sits at a world x, in screen y. Same tiling maths as
       band(), including the mirror, so anything planted with this lands on the shape the
       player can see rather than on its bounding box. */
    const surfaceOf = (key, rate, baseOff, drawH, wx) => {
      const v = VEC[key];
      if (!v) return horizon + baseOff;
      const P = (drawH * (v.w / v.h)) / (z * rate);    // same world period as band()
      const i = Math.floor(wx / P);
      let u = (wx - i * P) / P;
      if (i & 1) u = 1 - u;
      return horizon + baseOff - drawH + vecTop(v, u) * drawH;
    };

    /* "04 · Horizon Haze". The mockup's gradient is transparent AT the horizon, peaks
       opaque a fifth of the band up, and is gone by four fifths — so it is a strip of fog
       hanging in the air that eats the middle of the mountains, not a wash pooled on the
       ground. Getting that backwards (dense at the base) is the obvious guess and it makes
       the ranges look like they are sinking rather than receding. */
    const haze = (bandBottom, bandH, alpha, colour) => {
      const c = U.hex(colour || pal.haze);
      const g = ctx.createLinearGradient(0, bandBottom - bandH, 0, bandBottom);
      g.addColorStop(0, U.rgba(c, 0));
      g.addColorStop(1 - 0.7987, U.rgba(c, 0));
      g.addColorStop(1 - 0.3686, U.rgba(c, alpha * 0.73));
      g.addColorStop(1 - 0.1843, U.rgba(c, alpha));
      g.addColorStop(1, U.rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, bandBottom - bandH, W, bandH);
    };

    /* ---- the ridge stack ----
       Two flat-filled rows is what made this read as a child's drawing: the same silhouette
       twice, each one solid colour, with a single fog band laid over both. Depth in a flat
       painting is a RAMP, and every property has to move along it together — further back
       means smaller, paler, lower in contrast, slower, and more fogged. Four rows off the
       same two paths, each with its own fade, does that without another byte of art.

       Two details that matter more than the count. Each ridge is filled with a VERTICAL
       gradient, full colour at the peaks and most of the way to the haze at its feet: that
       single fade is aerial perspective, and flat fills cannot fake it. And each row gets
       its own tile PHASE, because four rows off two paths at tidy multiples line their
       peaks up into one repeating comb the moment the camera moves. */
    /* Heights are well under the mockup's own 284 and 195, and the reason is the portrait
       screen again. Those numbers are right for a 1600x900 landscape frame where one tile
       spans the whole width and you see a range of many peaks. Ported at the same share of
       screen HEIGHT into a 459x816 column, one tile came out 3.45 screens wide — so all
       you ever saw was a third of it, which meant one 272px peak standing nearly still at
       rate 0.10 and reading as a single enormous mountain parked in the sky rather than as
       a range at all. Shrinking the rows brings 1.1 to 1.7 screens of each range into view
       at once, which is the composition the mockup actually has. */
    const RIDGES = [
      // artwork, rate, base offset, height, tile phase, haze after
      ['vecFar', 0.10, -30, 150, 0.00, 0.95],
      ['vecFar', 0.16, -20, 128, 0.37, 0.86],
      ['vecMid', 0.26, -10, 108, 0.13, 0.80],
      ['vecMid', 0.36, -1, 92, 0.61, 0.92],
    ];
    for (let r = 0; r < RIDGES.length; r++) {
      const [key, rate, off, hh, phase, hz] = RIDGES[r];
      const d = r / (RIDGES.length - 1);                 // 0 furthest, 1 nearest
      const base = horizon + off * k, topY = base - hh * k;
      const body = U.hex(U.mix(pal.far, pal.mid, d));
      const foot = U.hex(U.mix(U.mix(pal.far, pal.mid, d), pal.haze, 0.6 - d * 0.3));
      const gr = ctx.createLinearGradient(0, topY, 0, base);
      gr.addColorStop(0, U.rgba(body, 0.88 + d * 0.1));
      gr.addColorStop(1, U.rgba(foot, 0.88 + d * 0.1));
      band(pal[key], rate, off * k, hh * k, gr, null, phase);
      /* The mockup carries TWO haze colours, not one: node 64:1074 fogs the far range in
         a dimmer, cooler mint and node 64:1046 fogs the near one in a brighter, greener
         rgb(159,255,209). The near band is the one the eye reads as the mountains melting
         into the water — its peak lands exactly on the water's top edge — and at full
         opacity, which is why a single dim haze at 0.44 left the feet of the ridges sitting
         hard on the waterline instead of dissolving into it. */
      haze(base + 64 * k, 300 * k, hz, U.mix(pal.haze, pal.haze2, d));
    }

    /* "05 · Distant Horizon Plain" */
    const pg = ctx.createLinearGradient(0, horizon, 0, horizon + 215 * k);
    pg.addColorStop(0, pal.plain0);
    pg.addColorStop(0.338, pal.plain1);
    pg.addColorStop(0.722, pal.plain2);
    fillBelow(horizon, pg);

    /* "06 · Ground Surface + Props" — everything except the ground itself, which is this
       game's terrain and gets drawn for real later.

       The rocks were lifted off that layer whole, so they keep the spacing they were
       authored with — but they also lost what they were lying ON. In the mockup they are
       dark patches drawn over a solid ground band, not silhouettes standing on its edge,
       so without a floor behind them they simply hang in the air over the plain. The fix
       is not to import the ground: it is to give the far plain a ground line of its own,
       which is a strip of its own deepest colour with a gently wavy edge. Ours to make. */
    if (pal.vecProps) {
      const farGround = horizon + 150 * k;
      ctx.fillStyle = U.shade(pal.plain2, -0.16);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = 0; sx <= W + 12; sx += 12) {
        const wx = cam.x + (sx - W / 2) / (0.5 * z);
        ctx.lineTo(sx, farGround
          + Math.sin(wx * 0.0021) * 4 * k + Math.sin(wx * 0.0067 + 2) * 2.5 * k);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

      /* the rocks sit in the lower half of their layer, so the layer is placed to put that
         half on the new ground line rather than centred on the plain */
      band(pal.vecProps, 0.5, 168 * k, 150 * k);

      /* the mix-blend-overlay streaks that shade the plain. Faint on purpose: these are
         15px slivers of flat grey, and anything above about a fifth opacity stops reading
         as ground shading and starts reading as a stray rule drawn across the plain. */
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.18;
      /* `spacing` is a world distance and stays one; the screen span and the screen
         position both carry the zoom, exactly like band() */
      const rate = 0.5, spacing = 210;
      const span = (W / 2) / (rate * z);
      const i0 = Math.floor((cam.x - span) / spacing) - 1;
      const i1 = Math.ceil((cam.x + span) / spacing) + 1;
      for (let i = i0; i <= i1; i++) {
        const v = VEC['streak' + (1 + ((hash2(i * 7.1, 3) * 11) | 0))];
        if (!v) continue;
        const wx = i * spacing + hash2(i, 5) * 90;
        const sx = W / 2 + (wx - cam.x) * rate * z;
        if (sx < -120 || sx > W + 20) continue;
        const sh = 11 * k * (0.7 + hash2(i * 2.3, 8));
        drawVec(ctx, v, sx, farGround + (6 + hash2(i * 3.7, 6) * 60) * k, sh * (v.w / v.h), sh);
      }
      ctx.restore();
    }

    /* the green frame's two hill bands, and the pines standing on the far one */
    if (pal.vecHill0) {
      const hillRate = 0.5, hillBase = (58 + 173) * k, hillH = 173 * k;
      band(pal.vecHill0, hillRate, hillBase, hillH,
           U.shade(pal.plain2, -0.1), U.shade(pal.plain2, -0.1));
      const spacing = 96;
      const hillSpan = (W / 2) / (hillRate * z);
      const i0 = Math.floor((cam.x - hillSpan) / spacing) - 1;
      const i1 = Math.ceil((cam.x + hillSpan) / spacing) + 1;
      const kinds = ['tree1', 'tree2', 'tree3', 'tree4'];
      for (let i = i0; i <= i1; i++) {
        const h = hash2(i * 13.7, 4.2);
        if (h < 0.3) continue;
        const wx = i * spacing + (h - 0.5) * 58;
        const sx = W / 2 + (wx - cam.x) * hillRate * z;
        if (sx < -40 || sx > W + 40) continue;
        const v = VEC[kinds[(hash2(i * 5.3, 2) * 4) | 0]];
        const th = (30 + hash2(i * 3.1, 7) * 16) * k;
        /* stand on the hill's outline, a few px in so the trunk is buried rather than
           balanced on the edge */
        const base = surfaceOf(pal.vecHill0, hillRate, hillBase, hillH, wx) + 5 * k;
        drawVec(ctx, v, sx - (th * v.w / v.h) / 2, base - th, th * (v.w / v.h), th, pal.propColor);
        if (hash2(i * 2.7, 11) > 0.74) {
          const b = VEC.bush, bh = 10 * k;
          drawVec(ctx, b, sx + 13 * k, base - bh, bh * (b.w / b.h), bh, pal.propColor);
        }
      }
      band(pal.vecHill1, 0.62, (171 + 265) * k, 265 * k,
           U.shade(pal.plain2, -0.22), U.shade(pal.plain2, -0.22));
    }
  },


  /* ---------- terrain (world space) ---------- */
  drawTerrain(ctx, cam, left, right) {
    const pal = this.paletteAt(cam.x / CFG.M);
    const s = this.step;
    const x0 = Math.floor(left / s) * s - s;
    const x1 = Math.ceil(right / s) * s + s;
    const bottom = CFG.SURFACE_Y + 6000;

    const surfAt = (x) => this.yAt(x);
    /* All the ground art is painted through ONE clip, set up by clipDamaged: the terrain
       below the surface, minus the bites. `hs` is never modified, so this clip is the only
       place the damage exists — which is exactly why the picture can no longer disagree
       with the collision. */
    ctx.save();
    this.clipDamaged(ctx, x0, x1, bottom, left, right);

    const g = ctx.createLinearGradient(0, CFG.SURFACE_Y - 60, 0, CFG.SURFACE_Y + 620);
    g.addColorStop(0, pal.soil);
    g.addColorStop(1, pal.soil2);
    ctx.fillStyle = g;
    ctx.fillRect(x0, CFG.SURFACE_Y - 400, x1 - x0, bottom - CFG.SURFACE_Y + 400);

    /* soil texture: strata bands + pebbles */
    ctx.save();
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

    /* Top crust. Still inside the damaged clip, which is what replaces the old
       excavated-face pass: the crust is one long stroke following the surface, and left
       unclipped it happily lined the inside of every crater with grass. */
    ctx.beginPath();
    ctx.moveTo(x0, surfAt(x0));
    for (let x = x0; x <= x1; x += s) ctx.lineTo(x, surfAt(x));
    ctx.strokeStyle = pal.top2;
    ctx.lineWidth = 30; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = pal.top;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();

    /* A fresh cut face around the inside of each bite, so the hole reads as exposed earth
       rather than a shape cut out of a picture. */
    if (this.craters.length) this.drawCraterWalls(ctx, left, right, pal);

    /* biome props */
    for (const p of this.props) {
      if (p.gone || p.x < left - 90 || p.x > right + 90) continue;
      drawProp(ctx, p, this.yAt(p.x), pal);
    }

    if (this.craters.length) this.drawCraters(ctx, left, right);
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

    /* tx/ty/tr track the last stamp so stampTunnel can interpolate from it */
    this.ug = { minerals, rocks, locked, halfW, topY, botY, centerX, surfaceY, maxDepthM, biome,
                tunnel: [], tx: 0, ty: 0, tr: 0 };
    return this.ug;
  },

  /* Re-floor the field once the impact has actually stopped. The field is generated to a
     PREDICTED impact depth (deliberately generous — rocks and the pod's own radius make
     the real stop shallower), so without this the player would be handed whatever slack
     the prediction left over as extra manual depth. Manual range is the DRILL stat and
     nothing else; it is measured from wherever the crash ended.
     Anything left below the new floor is hidden rather than deleted, so the teaser layer
     and the bedrock line keep drawing the way they always did. */
  setFloor(y) {
    const ug = this.ug;
    if (!ug) return;
    ug.botY = y;
    for (const m of ug.minerals) if (m.y > y) m.got = true;
    for (const r of ug.rocks) if (r.y > y) r.dead = true;
    ug.maxDepthM = (y - ug.surfaceY) / CFG.M;
  },

  /* ---------- underground draw ---------- */
  /* `reveal` (0..1) fades the whole field up after impact. Without it the entire dig site —
     155 minerals, the rocks, the bedrock line — materialises in the single frame the pod
     touches the ground, which is half of what "tiba-tiba muncul" was describing. The other
     half was the camera; see Game.onImpact. */
  drawUnderground(ctx, cam, left, right, top, bottom, reveal) {
    const ug = this.ug;
    if (!ug) return;
    const sy = ug.surfaceY;
    const t = performance.now() / 1000;
    const rv = reveal === undefined ? 1 : U.clamp(reveal, 0, 1);
    if (rv <= 0) return;

    ctx.save();
    /* Everything below inherits this, EXCEPT the two passes that set their own alpha —
       those multiply by `rv` themselves. */
    ctx.globalAlpha = rv;
    this.clipToSoil(ctx, left, right);

    /* depth layer bands */
    const pal = this.paletteAt(cam.x / CFG.M);
    const bands = [
      /* the first band is topsoil seen in section, so it takes the surface's own tinted
         soil; below that you are inside the earth and out of the sky's reach */
      [0, 0.18, U.shade(pal.soil, -0.12), U.shade(pal.soil2, -0.05)],
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
      ctx.globalAlpha = 0.38 * rv;
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
    ctx.globalAlpha = 0.13 * rv;
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

    /* THE SHAFT. Three passes over the same list of stamps at three radii, back to front:
       a soft shadow bleeding into the rock, a lit rim, then the bore itself.

       Each pass is ONE path holding every circle and ONE fill. That detail is the whole
       trick. Filling the circles one at a time would darken every overlap twice over and
       turn a translucent pass into a bumpy string of beads; collected into a single path
       the non-zero winding rule treats the union as one region, so the alpha lands exactly
       once and the outline is the silhouette of the union. It also means the rim needs no
       outline maths at all — it is just the same union drawn slightly larger and left
       showing at the edges.

       The shaft is already clipped to the live heightfield by the soil clip above, so the
       mouth stops at the crater floor instead of poking a pod-radius out into the sky: the
       first stamp is the pod's CENTRE at the moment of contact, which still sits above the
       surface it is about to break. */
    if (ug.tunnel.length > 1) {
      const tn = ug.tunnel;
      /* Culling matters here, not for the fill but for the arc count: a 300m dig records
         well over a thousand stamps and only a screenful is ever visible. */
      const vis = [];
      for (let i = 0; i < tn.length; i++) {
        const p = tn[i];
        const m = p.r + 8;
        if (p.x + m < left || p.x - m > right || p.y + m < top || p.y - m > bottom) continue;
        vis.push(p);
      }
      if (vis.length) {
        const arcs = (pad) => {
          ctx.beginPath();
          for (let i = 0; i < vis.length; i++) {
            const p = vis[i];
            const r = p.r + pad;
            if (r <= 0.2) continue;
            ctx.moveTo(p.x + r, p.y);
            ctx.arc(p.x, p.y, r, 0, U.TAU);
          }
        };
        arcs(6);
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fill();
        /* broken wall: a warm rock edge showing between the shadow and the void, so the
           shaft has a readable boundary against the strata it cuts through */
        arcs(1.8);
        ctx.fillStyle = 'rgba(150,130,120,.3)';
        ctx.fill();
        /* The bore. Not flat black: a void that dark reads as a hole punched in the SCREEN,
           especially next to the equally black out-of-bounds walls. A gradient down the
           shaft says "this is a hole in earth" instead. */
        const t0 = tn[0], t1 = tn[tn.length - 1];
        const gg = ctx.createLinearGradient(t0.x, t0.y, t1.x, t1.y);
        gg.addColorStop(0, '#100c15');
        gg.addColorStop(1, '#241c2c');
        arcs(0);
        ctx.fillStyle = gg;
        ctx.fill();
      }
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

    ctx.restore();                        // release the soil clip
  },
};

/* ============ helpers ============ */

/* stable pseudo-random from a 2D position, for irregular texture */
function hash2(a, b) {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
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


/* Lightweight screen-space weather. It never participates in physics; its job is to
   make a stage readable even when the camera is pulled so far back that props disappear. */
function drawAtmosphereWeather(ctx, pal, cam, W, H) {
  const t = performance.now() / 1000;
  const wrap = (v, max) => ((v % max) + max) % max;
  ctx.save();
  ctx.lineCap = 'round';

  if (pal.weather === 'wind') {
    ctx.strokeStyle = U.rgba(U.hex(pal.accent), 0.16);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) {
      const y = 70 + hash2(i * 31, 8) * H * 0.5;
      const x = wrap(hash2(i * 19, 2) * W + t * (38 + i * 3) - cam.x * 0.015, W + 150) - 75;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 35 + (i % 3) * 18, y - 3); ctx.stroke();
    }
  } else if (pal.weather === 'sand') {
    ctx.fillStyle = U.rgba(U.hex(pal.accent), 0.15);
    for (let i = 0; i < 18; i++) {
      const x = wrap(hash2(i * 43, 6) * W - t * (24 + i) - cam.x * 0.01, W + 40) - 20;
      const y = H * (0.25 + hash2(i * 13, 4) * 0.5);
      ctx.fillRect(x, y, 3 + (i % 4) * 2, 1.2);
    }
  } else if (pal.weather === 'glimmer') {
    ctx.fillStyle = U.rgba(U.hex(pal.accent), 0.28);
    for (let i = 0; i < 13; i++) {
      const x = hash2(i * 47, 3) * W;
      const y = H * (0.14 + hash2(i * 17, 9) * 0.48);
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.4 + i));
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(x, y, 0.7 + a * 1.4, 0, U.TAU); ctx.fill();
    }
  } else if (pal.weather === 'ember' || pal.weather === 'ash') {
    const ember = pal.weather === 'ember';
    ctx.fillStyle = ember ? U.rgba(U.hex(pal.accent), 0.48) : 'rgba(210,215,225,.18)';
    for (let i = 0; i < (ember ? 16 : 24); i++) {
      const speed = 14 + hash2(i, 5) * 24;
      const x = wrap(hash2(i * 37, 7) * W + Math.sin(t + i) * 18 - cam.x * 0.008, W);
      const y = ember
        ? H - wrap(hash2(i * 23, 11) * H + t * speed, H)
        : wrap(hash2(i * 23, 11) * H + t * speed, H);
      ctx.beginPath(); ctx.arc(x, y, ember ? 1.2 + i % 3 : 1 + i % 2, 0, U.TAU); ctx.fill();
    }
  } else if (pal.weather === 'anomaly') {
    ctx.strokeStyle = U.rgba(U.hex(pal.accent), 0.22);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const x = wrap(hash2(i * 41, 12) * W + t * (54 + i * 2), W + 90) - 45;
      const y = H * (0.1 + hash2(i * 27, 14) * 0.55);
      ctx.beginPath(); ctx.moveTo(x - 20, y + 18); ctx.lineTo(x + 20, y - 18); ctx.stroke();
    }
    const pulse = Math.max(0, Math.sin(t * 1.7)) * 0.06;
    ctx.fillStyle = `rgba(80,255,220,${pulse})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = U.rgba(U.hex(pal.accent), 0.13);
    for (let i = 0; i < 12; i++) {
      const x = wrap(hash2(i * 31, 5) * W + t * (7 + i % 4) - cam.x * 0.004, W);
      const y = H * (0.18 + hash2(i * 17, 2) * 0.48) + Math.sin(t + i) * 5;
      ctx.beginPath(); ctx.arc(x, y, 1 + i % 2, 0, U.TAU); ctx.fill();
    }
  }
  ctx.restore();
}

