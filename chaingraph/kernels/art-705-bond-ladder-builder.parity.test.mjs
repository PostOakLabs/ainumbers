// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only swept into
// tsc --checkJs's program because it lives under chaingraph/kernels/ (same precedent as
// golden-parity.test.mjs's line 1).
//
// art-705-bond-ladder-builder PARITY GATE (row ART705-BOND-LADDER-1 step 5).
// No kernel in the estate imports another kernel — this TEST imports the three TVM primitives'
// exported compute() functions (art-329 duration, art-330 DV01, art-331 convexity) and asserts
// each art-705 rung's duration, modified duration, DV01 and convexity equal theirs to <= 1e-12
// relative for every successful fixture vector. A parity miss is a STOP, never a tolerance widen.
// This file is READ-ONLY with respect to the kernels it imports.
//
// Run: node chaingraph/kernels/art-705-bond-ladder-builder.parity.test.mjs

import { compute as computeDuration } from './art-329-tvm-bond-duration.kernel.mjs';
import { compute as computeDv01 } from './art-330-tvm-dv01.kernel.mjs';
import { compute as computeConvexity } from './art-331-tvm-convexity.kernel.mjs';
import { compute as computeLadder } from './art-705-bond-ladder-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, 'fixtures', 'art-705-bond-ladder-builder.fixtures.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));

const TOL = 1e-12;
function relClose(a, b) {
  if (a === b) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  if (denom === 0) return Math.abs(a - b) === 0;
  return Math.abs(a - b) / denom <= TOL;
}

let checked = 0, skipped = 0, failures = [];
for (const vec of fixtures.vectors) {
  const out = computeLadder(vec.policy_parameters).output_payload;
  if (out.error || !Array.isArray(out.ladder)) { skipped++; continue; }
  for (const rung of out.ladder) {
    const i = rung.rung - 1;
    const rIn = vec.policy_parameters.rungs[i];
    const primitivePP = {
      face_value: vec.policy_parameters.notional * rIn.target_weight,
      coupon_rate_pct: rIn.coupon_rate_pct,
      ytm_pct: rIn.yield_pct,
      years_to_maturity: rIn.maturity_years,
      periods_per_year: vec.policy_parameters.periods_per_year,
    };
    const dur = computeDuration(primitivePP).output_payload;
    const dv01 = computeDv01(primitivePP).output_payload;
    const cx = computeConvexity(primitivePP).output_payload;
    const pairs = [
      ['duration', rung.duration, dur.macaulay_duration_years],
      ['modified_duration', rung.modified_duration, dur.modified_duration_years],
      ['dv01', rung.dv01, dv01.dv01],
      ['convexity', rung.convexity, cx.convexity],
    ];
    for (const [metric, got, want] of pairs) {
      checked++;
      if (!relClose(got, want)) {
        failures.push({ vector: vec.name, rung: rung.rung, metric, got, want, rel: Math.abs(got - want) / Math.max(Math.abs(got), Math.abs(want)) });
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ art-705 parity FAIL — ${failures.length} metric(s) differ from the art-329/330/331 primitives beyond ${TOL} relative:`);
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
if (checked === 0) {
  console.error('✗ art-705 parity: zero metrics compared — no successful fixture vectors found. Corpus is present but nothing was verifiable.');
  process.exit(1);
}
console.log(`✓ art-705 parity clean — ${checked} rung-metric(s) across ${fixtures.vectors.length - skipped} fixture vector(s) (${skipped} refusal vector(s) skipped) match art-329/art-330/art-331 within ${TOL} relative.`);
process.exit(0);
