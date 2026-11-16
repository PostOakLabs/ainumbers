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

test('manifest-only diff picks the WebMCP direct-execute gate (real preflight labels), not its controls', () => {
  const g = [
    ['WebMCP direct-execute (fixture-0 through every direct-mode execute body + the page run path)', 'node scripts/check-webmcp-direct-execute.mjs'],
    ['WebMCP direct-execute gate controls (leg-1/leg-2 RED + GREEN, GATE-SELFTEST-META-1 pair)', 'node scripts/check-webmcp-direct-execute.mjs --self-test'],
  ];
  const r = affectedSelection(g, ['manifests/art-151-agent-obo-mandate-validator.manifest.json']);
  assert.deepEqual(r.picked.map(([, cmd]) => cmd), ['node scripts/check-webmcp-direct-execute.mjs']);
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

// ── PREPUSH-HYGIENE-ALWAYS-1: the always-on hygiene set and the never-zero plan ──
import { AFFECTED_HYGIENE_CMDS, affectedPlan, missingHygiene } from './affected-gates.mjs';

const HYG = AFFECTED_HYGIENE_CMDS.map((cmd, i) => [`Hygiene gate ${i} (self-test controls)`, cmd]);
const WITH_HYGIENE = [...GATES, ...HYG];

test('hygiene gates are picked for a diff that touches no gated path class (even with "controls" in the label)', () => {
  const r = affectedSelection(WITH_HYGIENE, ['README.md']);
  assert.deepEqual(r.classes, []);
  assert.deepEqual(r.picked.map(([, c]) => c).sort(), [...AFFECTED_HYGIENE_CMDS].sort());
});

test('hygiene gates ride along with the path-class gates, in GATES order', () => {
  const r = affectedSelection(WITH_HYGIENE, ['chaingraph/kernels/824-zip317-transfer-fee.kernel.mjs']);
  assert.ok(AFFECTED_HYGIENE_CMDS.every((c) => r.picked.some(([, cmd]) => cmd === c)));
  assert.ok(r.picked.some(([l]) => l.startsWith('Flags-computed lint (')));
});

test('plan: empty touched set falls back to hygiene only, loudly, never zero gates', () => {
  const p = affectedPlan(WITH_HYGIENE, []);
  assert.equal(p.loud, true);
  assert.equal(p.picked.length, AFFECTED_HYGIENE_CMDS.length);
  assert.match(p.note, /EMPTY/);
});

test('plan: undeterminable touched set (null) fails closed to the FULL list, which includes hygiene, loudly', () => {
  const p = affectedPlan(WITH_HYGIENE, null);
  assert.equal(p.loud, true);
  assert.equal(p.picked.length, WITH_HYGIENE.length);
  assert.ok(AFFECTED_HYGIENE_CMDS.every((c) => p.picked.some(([, cmd]) => cmd === c)));
  assert.match(p.note, /UNDETERMINABLE/);
});

test('plan: a determinable diff is quiet and counts hygiene plus class gates', () => {
  const p = affectedPlan(WITH_HYGIENE, ['manifests/824-zip317-transfer-fee.manifest.json']);
  assert.equal(p.loud, false);
  assert.ok(p.picked.length > AFFECTED_HYGIENE_CMDS.length);
  assert.match(p.note, /manifest/);
});

test('plan: never selects zero gates for any touched set when the hygiene commands exist', () => {
  for (const files of [null, [], ['README.md'], ['docs/x.md'], ['guides/x.html']]) {
    assert.ok(affectedPlan(WITH_HYGIENE, files).picked.length >= AFFECTED_HYGIENE_CMDS.length, JSON.stringify(files));
  }
});

test('missingHygiene names a hygiene command that no gate runs (RED), none when all present (GREEN)', () => {
  assert.deepEqual(missingHygiene(WITH_HYGIENE), []);
  const dropped = WITH_HYGIENE.filter(([, c]) => c !== 'node scripts/check-git-env-scrub.mjs');
  assert.deepEqual(missingHygiene(dropped), ['node scripts/check-git-env-scrub.mjs']);
});

test('the hygiene set covers the gates that went red in CI on 2026-11-06', () => {
  for (const c of ['check-git-env-scrub.mjs', 'check-internal-lang-leak.mjs', 'check-copy-hallmarks.mjs']) {
    assert.ok(AFFECTED_HYGIENE_CMDS.includes(`node scripts/${c}`), c);
  }
});

// ── PREFLIGHT-AFFECTED-GATE-PARITY-1: a gate-machinery diff selects the parity gate ──
// PRs 3107/3117/3052 pushed new gates with no workflow registration and first-failed
// in CI on "Workflow gate parity (no CI↔preflight drift)" although --affected was
// green: no AFFECTED_CLASSES path class matched gate machinery, so the parity gate
// was only ever picked by the kernel class's broad /parity/i label regex.
const PARITY_LABEL = 'Workflow gate parity (no CI↔preflight drift)';
const PARITY_CONTROLS_LABEL = 'Workflow gate parity controls (status + reverse-presence axes, mutation)';
const WITH_PARITY = [...GATES, [PARITY_LABEL, 'p'], [PARITY_CONTROLS_LABEL, 'q']];

test('a diff touching only scripts/preflight.mjs selects the workflow gate parity gate', () => {
  const r = affectedSelection(WITH_PARITY, ['scripts/preflight.mjs']);
  assert.ok(r.classes.includes('gate-machinery'), JSON.stringify(r.classes));
  assert.ok(labels(r).includes(PARITY_LABEL));
});

test('a lone new scripts/check-something-new.mjs selects the workflow gate parity gate', () => {
  const r = affectedSelection(WITH_PARITY, ['scripts/check-something-new.mjs']);
  assert.ok(r.classes.includes('gate-machinery'), JSON.stringify(r.classes));
  assert.ok(labels(r).includes(PARITY_LABEL));
});

test('a lone .github/workflows/scripts-verify.yml selects the workflow gate parity gate', () => {
  const r = affectedSelection(WITH_PARITY, ['.github/workflows/scripts-verify.yml']);
  assert.ok(r.classes.includes('gate-machinery'), JSON.stringify(r.classes));
  assert.ok(labels(r).includes(PARITY_LABEL));
});

test('a diff touching the parity checker itself selects the plain gate, never its controls', () => {
  const r = affectedSelection(WITH_PARITY, ['scripts/check-workflow-gate-parity.mjs']);
  assert.ok(labels(r).includes(PARITY_LABEL));
  assert.ok(!labels(r).includes(PARITY_CONTROLS_LABEL), 'AFFECTED_SKIP must keep dropping the controls gate');
});

test('changed gate test and selftest files (any depth under scripts/) select the parity gate without a kernel file', () => {
  const r = affectedSelection(WITH_PARITY, ['scripts/lib/affected-gates.test.mjs']);
  assert.ok(r.classes.includes('gate-machinery'), JSON.stringify(r.classes));
  assert.ok(labels(r).includes(PARITY_LABEL));
  const s = affectedSelection(WITH_PARITY, ['scripts/check-copy-hallmarks.selftest.mjs']);
  assert.ok(labels(s).includes(PARITY_LABEL));
});

test('an unrelated README-only touched set selects no gate-machinery gate (no change)', () => {
  const r = affectedSelection(WITH_PARITY, ['README.md']);
  assert.deepEqual(r.classes, []);
  assert.ok(!labels(r).some((l) => /Workflow gate parity/.test(l)));
});
