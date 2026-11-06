// Tests for scripts/lib/affected-gates.mjs (AFFECTED-GATES-PREPUSH-1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { affectedSelection } from './affected-gates.mjs';

const GATES = [
  ['JS syntax', 'a'],
  ['Flags-computed lint (FLAGS-COMPUTED-LINT-1)', 'b'],
  ['Flags-computed lint fixture proof (SO #40b pairing)', 'c'],
  ['R4 null-class ratchet (MR-R4-NULL-REGRESSION-GATE-1)', 'd'],
  ['R4 null-class ratchet controls (planted RED/GREEN)', 'e'],
  ['Node page accessibility tree (TOOLPAGE-A11Y-1)', 'f'],
  ['Server card conformance fixture proof (RED+GREEN, GATE-SELFTEST-META-1 pair)', 'g'],
  ['Server card schema conformance', 'h'],
  ['WebMCP registration freshness (WEBMCP-GEN-FROM-MANIFEST-1)', 'i'],
  ['Copy hallmarks (§1.4)', 'j'],
  ['Mutation tier floor (MUTATION-TIER-1)', 'k'],
  ['Cited clause digest (CLAUSE-DIGEST-GATE-1, SPEC.md §30)', 'l'],
];
const labels = (r) => r.picked.map(([l]) => l);

test('kernel diff picks the kernel content gates, never controls or the tier floor', () => {
  const r = affectedSelection(GATES, ['chaingraph/kernels/824-zip317-transfer-fee.kernel.mjs']);
  assert.deepEqual(r.classes, ['kernel']);
  assert.ok(labels(r).some((l) => l.startsWith('Flags-computed lint (')));
  assert.ok(labels(r).some((l) => l.startsWith('R4 null-class ratchet (')));
  assert.ok(labels(r).some((l) => l.startsWith('Cited clause digest')));
  assert.ok(!labels(r).some((l) => /controls|fixture proof|Mutation tier/.test(l)));
});

test('kernel diff picks the §18 recompute-equality gate; an "SO #34c" control label stays skipped', () => {
  const g = [
    ['§18 recompute-equality (SO #34)', 'r'],
    ['Query-string privacy gate controls (RED/GREEN, SO #34c pairing)', 's'],
    ['cgCanon twin-parity red-proof (SO #34c, AUD-CGCANON-TWIN-GATE-1)', 't'],
  ];
  const r = affectedSelection(g, ['chaingraph/kernels/824-zip317-transfer-fee.kernel.mjs']);
  assert.deepEqual(labels(r), ['§18 recompute-equality (SO #34)']);
});

test('kernel-machinery file (_hash.mjs) is not a kernel content diff', () => {
  const r = affectedSelection(GATES, ['chaingraph/kernels/_hash.mjs']);
  assert.deepEqual(r.classes, []);
  assert.equal(r.picked.length, 0);
});

test('node shard diff picks the a11y tree gate', () => {
  const r = affectedSelection(GATES, ['chaingraph/graph/nodes/827-agent-cred-class-matrix.json']);
  assert.ok(r.classes.includes('node'));
  assert.ok(labels(r).some((l) => l.startsWith('Node page accessibility tree')));
});

test('manifest diff picks server-card and WebMCP freshness, not the fixture-proof control', () => {
  const r = affectedSelection(GATES, ['manifests/824-zip317-transfer-fee.manifest.json']);
  assert.ok(labels(r).includes('Server card schema conformance'));
  assert.ok(labels(r).some((l) => l.startsWith('WebMCP registration freshness')));
  assert.ok(!labels(r).some((l) => l.startsWith('Server card conformance fixture proof')));
});

test('page diff picks copy hallmarks', () => {
  const r = affectedSelection(GATES, ['guides/x-hub.html']);
  assert.ok(r.classes.includes('page'));
  assert.ok(labels(r).includes('Copy hallmarks (§1.4)'));
});

test('node diff does not pick estate-wide slow gates or "toolchain" by substring', () => {
  const g = [['FV toolchain-digest (fv_leg) consumer (FVLEG-DIGEST-CONSUMER-1)', 'x'], ['Ledger §18 Groth16 seal parity (LEDGER-GROTH16-VERIFY-1)', 'y'], ['VM↔worker parity (§24)', 'z'], ['Node completeness (NODE-COMPLETENESS-GATE-1)', 'w']];
  const r = affectedSelection(g, ['chaingraph/graph/nodes/x.json', 'chaingraph/kernels/x.kernel.mjs']);
  assert.deepEqual(r.picked.map(([l]) => l), ['Node completeness (NODE-COMPLETENESS-GATE-1)']);
});

test('docs-only diff picks nothing (the --quick leg covers it)', () => {
  const r = affectedSelection(GATES, ['README.md', 'docs/notes.md']);
  assert.deepEqual(r.classes, []);
  assert.equal(r.picked.length, 0);
});
