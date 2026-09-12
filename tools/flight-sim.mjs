/* Headless flight simulator for Drill Orbit. Loads the real utils/world/player files into
   a vm context with stubs for DOM / Save / Game, then runs the actual Pod code — so the
   numbers below come from the shipping physics, not from a second copy of it.

   The game is one loop: launch, arc, crash, penetrate. There is no air control, no pad and
   no terrain bouncing, so a run is fully determined by POWER x timing, and every question
   worth asking is "how far, how hard, how deep".

   Usage:
     node tools/flight-sim.mjs impact          the whole ladder, by timing and by level
     node tools/flight-sim.mjs reach           which sites each level can actually reach
     node tools/flight-sim.mjs path <lv> <rating>   one arc, sampled                     */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../js/', import.meta.url));

export function makeCtx() {
  const ctx = {
    console, Math, performance: { now: () => 0 },
    window: {}, document: null,
  };
  ctx.Save = { data: { found: [], bounce: 1, power: 1, drill: 1 } };
  /* mirrors the impact-energy model in js/game.js — kept in sync by hand, and the
     `impact` subcommand prints predicted vs actual so a drift shows up immediately */
  ctx.Game = {
    impactEfficiency() {
      return ctx.CFG.IMPACT_EFF_BASE + ctx.CFG.IMPACT_EFF_PER * (ctx.Save.data.bounce - 1);
    },
    impactBudget(speed) {
      const ke = 0.5 * ctx.CFG.POD_MASS * speed * speed;
      return (ke / ctx.CFG.IMPACT_ENERGY_SCALE) * this.impactEfficiency();
    },
    predictDepth(energy, resist) {
      let e = energy, d = 0;
      const step = 0.25;
      while (e > 0 && d < 600) {
        e -= ctx.CFG.SOIL_RESISTANCE * resist * (1 + d * ctx.CFG.SOIL_HARDEN_PER_M) * step;
        d += step;
      }
      return d;
    },
    overdrive: 0,
  };
  vm.createContext(ctx);
  for (const f of ['utils.js', 'world.js', 'player.js']) {
    vm.runInContext(readFileSync(ROOT + f, 'utf8').replace(/^'use strict';/, ''), ctx, { filename: f });
  }
  /* top-level const/class live in the context's lexical scope, not on the global object */
  Object.assign(ctx, vm.runInContext('({ CFG, World, Pod, U, SITES, IMPACT_GROUND })', ctx));
  ctx.World.init(1337);
  return ctx;
}

/* accuracy -> launch multiplier, mirrors Game.doLaunch */
export function multFor(rating) {
  const acc = { WEAK: 0.2, GOOD: 0.55, GREAT: 0.8, PERFECT: 1 }[rating];
  if (rating === 'PERFECT') return 1.15;
  return 0.5 + 0.45 * Math.pow(acc, 0.85);
}

/* One run: ballistic arc to the first contact, then the penetration model.
   Returns everything needed to judge the loop without opening a browser. */
export function impactRun(ctx, { power = 1, impact = 1, rating = 'PERFECT', dt = 1 / 60, log = false } = {}) {
  const { CFG, World, Pod, Game } = ctx;
  ctx.Save.data.bounce = impact;
  World.clearCraters();                 // every run measures virgin ground
  const pod = new Pod();
  pod.reset(CFG.PAD_X, World.yAt(CFG.PAD_X) - pod.r);
  const v0 = CFG.IMPACT_BASE_V * (1 + CFG.POWER_PER * (power - 1)) * multFor(rating);
  pod.launch(v0, CFG.IMPACT_ANGLE);
  const launchME = 0.5 * CFG.POD_MASS * v0 * v0;

  let apex = 0, t = 0, hit = null, meMin = Infinity, meMax = 0;
  const path = [];
  for (let i = 0; i < 60 * 40 && !hit; i++) {
    t += dt;
    const h = Math.max(0, (World.yAt(pod.x) - pod.r) - pod.y);
    apex = Math.max(apex, h);
    /* fixed datum, not local ground: otherwise this measures the terrain rolling under
       the pod rather than whether energy is conserved */
    const hFix = (World.yAt(CFG.PAD_X) - pod.r) - pod.y;
    const me = 0.5 * CFG.POD_MASS * (pod.vx * pod.vx + pod.vy * pod.vy) + CFG.POD_MASS * CFG.GRAV * hFix;
    meMin = Math.min(meMin, me); meMax = Math.max(meMax, me);
    if (log && i % 6 === 0) {
      path.push({ t: +t.toFixed(2), m: +World.mOf(pod.x).toFixed(1), alt: Math.round(h),
                  vx: Math.round(pod.vx), vy: Math.round(pod.vy) });
    }
    pod.updateFlight(dt, (x, y, spd, ang) => {
      hit = { x, m: World.mOf(x), spd, ang: ang * 180 / Math.PI };
    });
  }
  if (!hit) return { end: World.mOf(pod.x), noImpact: true };

  const pal = World.paletteAt(hit.m);
  const ground = ctx.IMPACT_GROUND[pal.key] || ctx.IMPACT_GROUND.grass;
  const budget = hit.spd > CFG.IMPACT_MIN_SPEED ? Game.impactBudget(hit.spd) : 0;
  const predicted = Game.predictDepth(budget, ground.resist);

  /* run the real penetration loop so predicted vs actual can disagree out loud */
  const manual = CFG.DEPTH_BASE;
  const ug = World.genUnderground(hit.x, predicted + manual, 1, 12345);
  pod.impactE = budget;
  pod.impactE0 = budget;
  /* same clamp as Game.onImpact: the carry direction is never sideways */
  const ar = hit.ang * Math.PI / 180;
  pod.penAngle = Math.min(Math.PI * 0.78, Math.max(Math.PI * 0.22, ar));
  pod.soilResist = ground.resist;
  /* the pod is planted on the crater floor before it starts boring — see Game.onImpact.
     carveCrater hands back that floor: the heightfield is never modified, so yAt() still
     reports the original surface and cannot be used for this. */
  const k = Math.min(Math.max(budget / 1.0, 0.06), 1.8);
  const { floorY } = World.carveCrater(hit.x, CFG.CRATER_R_BASE + CFG.CRATER_R_SCALE * k,
                    CFG.CRATER_DEPTH_BASE + CFG.CRATER_DEPTH_SCALE * k, pal);
  pod.y = Math.max(pod.y, floorY);

  let penT = 0, minerals = 0, rocks = 0;
  const cb = { mineral: () => minerals++, rock: () => rocks++ };
  for (let i = 0; i < 60 * 30 && pod.impactE > 0; i++) {
    pod.updatePenetrate(dt, ug, cb);
    penT += dt;
  }
  World.setFloor(pod.y + manual * CFG.M);
  return {
    total: +((World.ug.botY - World.ug.surfaceY) / CFG.M).toFixed(1),
    reach: +hit.m.toFixed(1), apexM: +(apex / CFG.M).toFixed(1), airT: +t.toFixed(2),
    impactSpd: Math.round(hit.spd), impactAng: Math.round(hit.ang),
    budget: +budget.toFixed(3), predicted: +predicted.toFixed(1),
    depth: +((pod.y - ug.surfaceY) / CFG.M).toFixed(1), penT: +penT.toFixed(2),
    biome: pal.key, minerals, rocks, path,
    meDrift: +(((meMax - meMin) / meMax) * 100).toFixed(1),
    launchME,
  };
}

if (process.argv[1] && process.argv[1].endsWith('flight-sim.mjs')) {
  const ctx = makeCtx();
  const { SITES, World } = ctx;
  const which = process.argv[2] || 'impact';

  if (which === 'impact') {
    console.log('arc, crash, penetration\n');
    console.log('Lv1, by timing:');
    console.log('  rating    reach   apex   air   impact spd/ang   energy   DEPTH   time');
    for (const rating of ['WEAK', 'GOOD', 'GREAT', 'PERFECT']) {
      const r = impactRun(ctx, { power: 1, impact: 1, rating });
      console.log(
        `  ${rating.padEnd(9)}${String(r.reach + 'm').padStart(6)}${String(r.apexM + 'm').padStart(7)}` +
        `${String(r.airT + 's').padStart(7)}${String(r.impactSpd).padStart(8)}/${r.impactAng}deg` +
        `${String(r.budget).padStart(9)}${String(r.depth + 'm').padStart(8)}${String(r.penT + 's').padStart(7)}` +
        `   min ${r.minerals} rock ${r.rocks}`
      );
    }
    console.log('\nPERFECT, by upgrade level (power/impact):');
    console.log('  lv        reach   biome      energy   DEPTH  + manual = total');
    for (const [p, im] of [[1, 1], [3, 3], [5, 5], [10, 8], [20, 12]]) {
      const r = impactRun(ctx, { power: p, impact: im, rating: 'PERFECT' });
      console.log(
        `  ${String(p + '/' + im).padEnd(9)}${String(r.reach + 'm').padStart(6)}  ${r.biome.padEnd(9)}` +
        `${String(r.budget).padStart(8)}${String(r.depth + 'm').padStart(8)}  +${ctx.CFG.DEPTH_BASE}m = ${r.total}m`
      );
    }
    const chk = impactRun(ctx, { power: 1, impact: 1, rating: 'PERFECT' });
    console.log(`\nmechanical energy drift across the whole arc: ${chk.meDrift}%  (should be ~0)`);
    console.log(`predicted vs actual penetration: ${chk.predicted}m vs ${chk.depth}m`);
  }

  /* Pacing check: what each upgrade level can actually land on. With one arc per run the
     ladder is pure POWER x timing, so this is the whole progression curve on one screen. */
  if (which === 'reach') {
    const siteOf = (m) => {
      const s = SITES.filter((x) => x.half > 0 && Math.abs(m - x.m) <= x.half)[0];
      if (s) return 'IN ' + s.id;
      const n = World.nearMiss(m);
      return n ? `${Math.round(n.gap)}m ${n.short ? 'SHORT' : 'FAR'} ${n.site.id}` : '-';
    };
    const named = SITES.filter((s) => s.kind !== 'decor');
    const passed = (m) => named.filter((s) => s.m - s.half <= m).length;
    console.log('lv/im   PERFECT reach                        map used');
    for (const [power, im] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [7, 4], [10, 6], [14, 8], [20, 12]]) {
      const r = impactRun(ctx, { power, impact: im, rating: 'PERFECT' });
      console.log(
        `${power}/${im}`.padEnd(8) +
        `${r.reach}m ${siteOf(r.reach)}`.padEnd(38) +
        `${passed(r.reach)} of ${named.length}`
      );
    }
    console.log('\nLv1 ladder (the first run must teach the whole system):');
    for (const rating of ['WEAK', 'GOOD', 'GREAT', 'PERFECT']) {
      const r = impactRun(ctx, { power: 1, impact: 1, rating });
      console.log(`  ${rating.padEnd(8)}${String(r.reach).padStart(7)}m  ${siteOf(r.reach)}`);
    }
    console.log('\nnamed sites:', named.map((s) => `${s.id}@${s.m}`).join('  '));
  }

  if (which === 'path') {
    const power = +process.argv[3] || 1, rating = process.argv[4] || 'PERFECT';
    const r = impactRun(ctx, { power, impact: 1, rating, log: true });
    console.log(`reach ${r.reach}m  apex ${r.apexM}m  air ${r.airT}s  impact ${r.impactSpd}px/s at ${r.impactAng}deg`);
    console.log(`energy ${r.budget}  depth ${r.depth}m in ${r.penT}s`);
    for (const p of r.path) console.log(JSON.stringify(p));
  }
}
