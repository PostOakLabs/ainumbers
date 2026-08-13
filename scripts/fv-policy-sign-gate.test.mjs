#!/usr/bin/env node
// fv-policy-sign-gate.test.mjs — fixture tests for FV-POLICY-SIGN-GATE-1.
// One eligible (all-green) case, one red-before-green case per failing predicate,
// per the row's own done-criterion. Pure in-memory evidence objects — no disk,
// no gh/CI, no live gen-kernel-identity/challenge-script invocation (this gate
// consumes their OUTPUTS as input fields; it is their callers' job to produce
// those fields correctly, tested separately in their own suites).

import { evaluateEligibility } from './fv-policy-sign-gate.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── baseline: a fully eligible artifact ──────────────────────────────────
const ELIGIBLE_EVIDENCE = {
  ciChecks: [
    { name: 'preflight', conclusion: 'success' },
    { name: 'anchor', conclusion: 'success' },
  ],
  kernelIdentity: { clean: true, detail: '✓ §17 kernel-identity coverage clean' },
  samplingQuota: { current: true, level: 'NORMAL' },
  challengeWindow: { state: 'PROVISIONAL-EXPIRED-UPGRADED', upgradedTo: 'verified' },
  artifactClass: 'routine-template-instance',
};

test('calibration — a fully-passing evidence bundle is ELIGIBLE with zero failed predicates', () => {
  const v = evaluateEligibility(ELIGIBLE_EVIDENCE);
  assert(v.eligible === true, `expected eligible, got ${JSON.stringify(v.failed_predicates)}`);
  assert(v.failed_predicates.length === 0, 'expected 0 failed predicates');
  assert(v.checked.length === 5, `expected 5 predicates checked, got ${v.checked.length}`);
});

// ── OBSERVED RED, one per predicate — each holds all OTHER fields at the eligible baseline ──

test('OBSERVED RED — ci_gates_green fails when a CI check is not success', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, ciChecks: [{ name: 'preflight', conclusion: 'failure' }] });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'ci_gates_green'), 'expected ci_gates_green to fail');
});

test('OBSERVED RED — ci_gates_green fails closed when no CI evidence is supplied at all', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, ciChecks: [] });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'ci_gates_green'), 'expected ci_gates_green to fail on empty evidence');
});

test('OBSERVED RED — kernel_identity_fresh fails when gen-kernel-identity --check was not clean', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, kernelIdentity: { clean: false, detail: 'stale digest' } });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'kernel_identity_fresh'), 'expected kernel_identity_fresh to fail');
});

test('OBSERVED RED — kernel_identity_fresh fails closed when no kernelIdentity evidence supplied', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, kernelIdentity: undefined });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'kernel_identity_fresh'), 'expected kernel_identity_fresh to fail on missing evidence');
});

test('OBSERVED RED — sampling_quota_current fails when quota has lapsed (the enforcement case named in the row)', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, samplingQuota: { current: false, reason: 'period sample not yet drawn' } });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'sampling_quota_current'), 'expected sampling_quota_current to fail');
});

test('OBSERVED RED — sampling_quota_current fails closed when no sampling infra exists yet (unbuilt draw/switching-state machinery)', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, samplingQuota: undefined });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'sampling_quota_current'), 'expected sampling_quota_current to fail on missing evidence');
});

test('OBSERVED RED — challenge_window_expired_unchallenged fails while the window is still open', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, challengeWindow: { state: 'PROVISIONAL-OPEN' } });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'challenge_window_expired_unchallenged'), 'expected challenge_window_expired_unchallenged to fail');
});

test('OBSERVED RED — challenge_window_expired_unchallenged fails when a challenge is on file (routes to human review, not auto-sign)', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, challengeWindow: { state: 'PROVISIONAL-CHALLENGED' } });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'challenge_window_expired_unchallenged'), 'expected challenge_window_expired_unchallenged to fail on a filed challenge');
});

test('OBSERVED RED — artifact_class_routine PERMANENTLY fails novel formalizations', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, artifactClass: 'novel-formalization' });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'artifact_class_routine'), 'expected artifact_class_routine to fail');
  assert(v.failed_predicates.find((p) => p.name === 'artifact_class_routine').message.includes('PERMANENTLY'), 'novel-class failure message must state permanence');
});

test('OBSERVED RED — artifact_class_routine fails closed on an unrecognized/absent class', () => {
  const v = evaluateEligibility({ ...ELIGIBLE_EVIDENCE, artifactClass: undefined });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.some((p) => p.name === 'artifact_class_routine'), 'expected artifact_class_routine to fail on missing class');
});

test('multiple failing predicates all surface, not just the first', () => {
  const v = evaluateEligibility({ ciChecks: [], kernelIdentity: undefined, samplingQuota: undefined, challengeWindow: undefined, artifactClass: undefined });
  assert(v.eligible === false, 'expected ineligible');
  assert(v.failed_predicates.length === 5, `expected all 5 predicates to fail, got ${v.failed_predicates.length}: ${JSON.stringify(v.failed_predicates.map((p) => p.name))}`);
});

test('evaluateEligibility throws on non-object input rather than silently passing', () => {
  let threw = false;
  try { evaluateEligibility(null); } catch { threw = true; }
  assert(threw, 'expected evaluateEligibility(null) to throw');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
