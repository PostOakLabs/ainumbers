// {{TOOL_ID}} — class-{{CLASS}} property-test FLOOR. Scaffolded by scripts/new-kernel.mjs
// (KERNEL-SCAFFOLD-1) — REPLACE the placeholder property below with real properties per
// FV-PBT-FLOOR-BUILD-SPEC.md before this can go green.
// kernel_digest_at_authoring: {{DIGEST}}
// spec: TODO — link the build spec this kernel implements
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/{{TOOL_ID}}.proptest.mjs

import { compute } from '../{{TOOL_ID}}.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '{{TOOL_ID}}';

// PLACEHOLDER — deliberately fails so an unfilled scaffold can never check off green.
// Replace with real class-A/B/K properties (rounding conformance, monotonicity, invalid-
// domain rejection, determinism, output-shape — see chaingraph/kernels/__proptests__/*.proptest.mjs
// for worked examples) once compute() is implemented.
function checkPLACEHOLDER_replaceBeforeShipping() {
  return { name: 'PLACEHOLDER_replace_before_shipping', checked: 1, violations: 1 };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkPLACEHOLDER_replaceBeforeShipping(),
];
console.log(`[${KERNEL_ID}] class-{{CLASS}} floor property test — SCAFFOLD, not yet authored.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
