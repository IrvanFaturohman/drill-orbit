/* Static validation of the authored surface layout. Run after moving any SITE:
     - sites stay ordered and their near-miss bands never touch
     - nothing is authored past the usable end of the world
     - each named site sits in the biome its art and rewards assume
   Usage: node tools/check-layout.mjs                                                    */
import { makeCtx } from './flight-sim.mjs';

const ctx = makeCtx();
const { SITES, CFG } = ctx;

const bad = [];
const warn = [];

/* --- sites --- */
let prev = null;
for (const s of SITES) {
  if (prev && s.m <= prev.m) bad.push(`SITES out of order: ${s.id} ${s.m} after ${prev.id} ${prev.m}`);
  if (prev && prev.half > 0 && s.half > 0) {
    const gap = (s.m - s.half - (s.near || 0)) - (prev.m + prev.half + (prev.near || 0));
    if (gap < 0) bad.push(`near-bands overlap: ${prev.id} and ${s.id} (${gap.toFixed(1)}m)`);
    else if (gap < 8) warn.push(`near-bands only ${gap.toFixed(1)}m apart: ${prev.id} -> ${s.id}`);
  }
  prev = s;
}

for (const s of SITES) if (s.m > CFG.WORLD_M - 60) bad.push(`site ${s.id} past the usable world end`);

/* --- biome ownership (sites are metres travelled, biomeKeyAt takes raw world metres) --- */
const off = CFG.PAD_X / CFG.M;
const want = { crate: 'grass', crystal: 'grass', wreck: 'grass', crater: 'grass', bones: 'desert', mine: 'desert', lava: 'volcano', tower: 'volcano' };
for (const id in want) {
  const s = SITES.find((x) => x.id === id);
  const got = ctx.World.biomeKeyAt(s.m + off);
  if (got !== want[id]) bad.push(`${id} @${s.m} is in ${got}, expected ${want[id]}`);
}

console.log(`sites ${SITES.length}  world ${CFG.WORLD_M}m`);
for (const w of warn) console.log('  warn  ' + w);
for (const b of bad) console.log('  FAIL  ' + b);
console.log(bad.length ? `\n${bad.length} problem(s)` : '\nlayout OK');
process.exit(bad.length ? 1 : 0);
