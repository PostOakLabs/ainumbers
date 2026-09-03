// run-consistency.mjs — CLI entry for the cross-kernel consistency property pilot.
//
//   node chaingraph/kernels/__consistency__/run-consistency.mjs
//       Run every property against the real kernels. Exit 1 if any property's OBSERVED
//       result differs from what it DECLARED it expected — in either direction. A
//       property that was expected to be violated and holds is a surprise too, and it
//       means this file is stale rather than that the estate improved silently.
//
//   node chaingraph/kernels/__consistency__/run-consistency.mjs --red
//       RED CONTROL. Substitute a deliberately perturbed scratch copy of art-220 for
//       the real one and assert that P-A1 — which HOLDS against the real kernels —
//       goes red. A harness that has only ever been observed green has not been
//       observed at all (SO #34c). Exit 1 if the control fails to fire.
//
//   --json   emit the structured rows instead of the table.
//
// ⛔ PILOT. Deliberately not wired into preflight.mjs or any CI workflow.

import { runFamilies, formatReport } from './_consistency-harness.mjs';
import familyA from './regz-thresholds.consistency.mjs';
import familyB from './genius-reserve-coverage.consistency.mjs';
import familyC from './euaia-art12-logging.consistency.mjs';
import { compute as perturbedArt220 } from './red-control/art-220-stale-2025-qm-row.perturbed.mjs';

const FAMILIES = [familyA, familyB, familyC];

// This repo installs no `@types/node` (SO #10 — never run npm), so a bare `process`
// reference is a blocking TS2580 under the JSDoc CheckJS gate, and that gate's
// no-@types/node allowlist is deliberately scoped to the __proptests__ floor only.
// Reaching the Node globals through an `any`-typed alias keeps this pilot inside its
// own fence rather than widening a gate to accommodate it.
/** @type {any} */
const globals = globalThis;
/** @type {{ argv: string[], exit: (code: number) => never }} */
const proc = globals.process;

const argv = proc.argv.slice(2);
const redMode = argv.includes('--red');
const jsonMode = argv.includes('--json');

// The property the RED control targets, and the state it is in against real kernels.
const RED_TARGET = 'P-A1-qm-limit-tracks-lookup';

function main() {
  if (redMode) return runRedControl();
  return runNormal();
}

function runNormal() {
  const rows = runFamilies(FAMILIES, {});
  if (jsonMode) {
    console.log(JSON.stringify({ mode: 'normal', rows }, null, 2));
  } else {
    console.log('CROSS-KERNEL CONSISTENCY — pilot run against real kernels');
    for (const fam of FAMILIES) {
      console.log(`  family ${fam.family}: ${fam.title}`);
      console.log(`    chains: ${fam.chains.join(', ')}`);
      console.log(`    kernels: ${fam.kernels.join(', ')}`);
    }
    console.log(formatReport(rows));
  }

  const surprises = rows.filter((r) => r.verdict !== 'AS-DECLARED');
  const violations = rows.filter((r) => r.observed === 'VIOLATION');
  console.log(`properties: ${rows.length} · relationships violated: ${violations.length} · surprises: ${surprises.length}`);
  if (surprises.length) {
    console.log('SURPRISE — a property\'s observed state differs from what it declared:');
    for (const r of surprises) console.log(`  ${r.id}: declared ${r.expect}, observed ${r.observed}`);
  }
  return surprises.length ? 1 : 0;
}

function runRedControl() {
  console.log('RED CONTROL — substituting a perturbed scratch copy of art-220');
  console.log(`  target property: ${RED_TARGET}`);

  const baseline = runFamilies([familyA], {}).find((r) => r.id === RED_TARGET);
  const perturbed = runFamilies([familyA], { art220: perturbedArt220 }).find((r) => r.id === RED_TARGET);

  console.log(`  against real kernels : ${baseline.observed} (${baseline.failureCount}/${baseline.cases} cases violating)`);
  console.log(`  against perturbed copy: ${perturbed.observed} (${perturbed.failureCount}/${perturbed.cases} cases violating)`);

  if (jsonMode) console.log(JSON.stringify({ mode: 'red', baseline, perturbed }, null, 2));
  else console.log(formatReport([perturbed]));

  // The control only means something if the property was green before the perturbation
  // and red after it. Either half missing makes the control worthless.
  const ok = baseline.observed === 'HOLDS' && perturbed.observed === 'VIOLATION';
  console.log(ok
    ? 'RED CONTROL FIRED — the property was green against the real kernels and caught the perturbation.'
    : 'RED CONTROL DID NOT FIRE — this harness has not been shown to detect anything.');
  return ok ? 0 : 1;
}

proc.exit(main());
