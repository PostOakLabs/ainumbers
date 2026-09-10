// run-boundary-mr.mjs — CLI entry for the metamorphic boundary-direction relations
// pilot (BOUNDARY-MR-PILOT-1). Idiom mirrors __consistency__/run-consistency.mjs.
//
//   node chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs
//       Run every boundary-direction relation against the real kernels. Exit 1 if any
//       relation's OBSERVED result differs from what it DECLARED it expected — in either
//       direction. A relation declared VIOLATION that holds is a surprise too: it means
//       this file is stale (e.g. CCPP-FIX-ART234-1 landed) rather than that the estate
//       improved silently.
//
//   node chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs --red
//       RED CONTROL (SO #34c mutation adequacy). Substitute a scratch copy of art-218
//       with its pass-comparator direction flipped for the real one and assert that
//       P-B1 — which HOLDS against the real kernels — goes red. A harness that has only
//       ever been observed green has not been observed at all. Exit 1 if the control
//       fails to fire.
//
//   --json   emit the structured rows instead of the table.
//
// ⛔ PILOT. Deliberately not wired into preflight.mjs or any CI workflow.

import { runFamilies, formatReport } from './_mr-harness.mjs';
import familyB1 from './qm-points-fees.boundary.mjs';
import familyB2 from './hoepa-high-cost.boundary.mjs';
import familyB3 from './hpml-escrow.boundary.mjs';
import { compute as perturbedArt218 } from './red-control/art-218-pass-comparator-flipped.perturbed.mjs';

const FAMILIES = [familyB1, familyB2, familyB3];

/** @type {any} */
const globals = globalThis;
/** @type {{ argv: string[], exit: (code: number) => never }} */
const proc = globals.process;

const argv = proc.argv.slice(2);
const redMode = argv.includes('--red');
const jsonMode = argv.includes('--json');

// The relation the RED control targets, and its state against the real kernels.
const RED_TARGET = 'P-B1-qm-limit-boundary-direction';

function main() {
  if (redMode) return runRedControl();
  return runNormal();
}

function runNormal() {
  const rows = runFamilies(FAMILIES, {});
  if (jsonMode) {
    console.log(JSON.stringify({ mode: 'normal', rows }, null, 2));
  } else {
    console.log('METAMORPHIC BOUNDARY-DIRECTION RELATIONS — pilot run against real kernels');
    for (const fam of FAMILIES) {
      console.log(`  family ${fam.family}: ${fam.title}`);
      console.log(`    chain: ${fam.chain}`);
      console.log(`    kernels: ${fam.kernels.join(', ')}`);
      console.log(`    selection basis: ${fam.basis}`);
    }
    console.log(formatReport(rows));
  }

  const surprises = rows.filter((r) => r.verdict !== 'AS-DECLARED');
  const violations = rows.filter((r) => r.observed === 'VIOLATION');
  const cases = rows.reduce((n, r) => n + r.cases, 0);
  console.log(`families: ${FAMILIES.length} · relations: ${rows.length} · cases: ${cases} · relations violated: ${violations.length} · surprises: ${surprises.length}`);
  if (surprises.length) {
    console.log('SURPRISE — a relation\'s observed state differs from what it declared:');
    for (const r of surprises) console.log(`  ${r.id}: declared ${r.expect}, observed ${r.observed}`);
  }
  return surprises.length ? 1 : 0;
}

function runRedControl() {
  console.log('RED CONTROL — substituting a scratch copy of art-218 with its pass-comparator direction flipped');
  console.log(`  target relation: ${RED_TARGET}`);

  const baseline = runFamilies([familyB1], {}).find((r) => r.id === RED_TARGET);
  const perturbed = runFamilies([familyB1], { art218: perturbedArt218 }).find((r) => r.id === RED_TARGET);

  console.log(`  against real kernels : ${baseline.observed} (${baseline.failureCount}/${baseline.cases} cases violating)`);
  console.log(`  against flipped copy : ${perturbed.observed} (${perturbed.failureCount}/${perturbed.cases} cases violating)`);

  if (jsonMode) console.log(JSON.stringify({ mode: 'red', baseline, perturbed }, null, 2));
  else console.log(formatReport([perturbed]));

  // The control only means something if the relation was green before the mutation
  // and red after it. Either half missing makes the control worthless.
  const ok = baseline.observed === 'HOLDS' && perturbed.observed === 'VIOLATION';
  console.log(ok
    ? 'RED CONTROL FIRED — the relation was green against the real kernels and caught the comparator flip.'
    : 'RED CONTROL DID NOT FIRE — this harness has not been shown to detect anything.');
  return ok ? 0 : 1;
}

proc.exit(main());
