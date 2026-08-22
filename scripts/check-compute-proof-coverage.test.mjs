#!/usr/bin/env node
// check-compute-proof-coverage.test.mjs — proven-to-reject fixture for the §18 coverage gate, and the
// RED-first control for PROVE-COVERAGE-GATE-SPLIT-1's advisory-on-PR / hard-on-main split (SO #40b).
//
// WHY THIS EXISTS: a gate never observed going red is not known to work, and a gate whose relaxation was
// never observed relaxing is not known to be split. Both halves are asserted here, on the exact fixture
// that motivated the change — the RESHAPED-PROVE-PR SHAPE measured by PROVE-LAND-RECONCILE-1 on
// 2026-08-22: node shards carry fresh proofs, chaingraph.json is deliberately NOT reassembled (SO #35
// single-writer), the baseline is correctly lowered, and the stale monolith therefore reports the just-
// proved nodes as "newly deferred" — indistinguishable, from chaingraph.json alone, from N fabricated
// proof regressions. The old gate hard-failed on that shape and made both prove PRs unlandable.
//
// Everything below drives the SHIPPED exports of check-compute-proof-coverage.mjs — classifyNode,
// evaluateCoverage, findRegressions, ratchetBreach, disposition — never a re-implementation (SO #34:
// verify a checker by mutation, and never let a checker validate its own restatement).
//
// The last block is an END-TO-END wiring control: it executes the real gate script twice, once in a
// GitHub PR context and once in a main context, and asserts the split is observable from outside the
// module. It deliberately asserts a RELATION (main is never more lenient than PR, PR is always 0) rather
// than fixed exit codes — asserting "main exits 0" would re-create, inside the self-test, exactly the
// hard PR-side failure this row removed.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyNode,
  evaluateCoverage,
  fixtureGap,
  findRegressions,
  ratchetBreach,
  disposition,
} from './check-compute-proof-coverage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = resolve(HERE, 'check-compute-proof-coverage.mjs');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── fixture builders ──────────────────────────────────────────────────────────────────────────────
const GOOD_PROOF = {
  type: 'ZkVmReceipt',
  receiptFormat: 'groth16-bn254',
  imageId: 'sha256:' + 'a'.repeat(64),
  seal: '0xdeadbeef',
  journal: { output: { result: 1 } },
};

function provenNode(toolId, name) {
  return {
    tool_id: toolId, mcp_name: name, status: 'live', gpu: false,
    compute_images: [{ image_id: GOOD_PROOF.imageId }],
    audit_signature: { compute_proof: GOOD_PROOF },
  };
}
function deferredNode(toolId, name, reason = 'in-guest proving cost prohibitive (SPEC §18.2)') {
  return {
    tool_id: toolId, mcp_name: name, status: 'live', gpu: false,
    compute_proof_ready: 'deferred', deferred_reason: reason,
  };
}

// THE FIXTURE. A prove PR sealed art-A and art-B; art-C stays deferred.
//  • chaingraph.json is STALE (single-writer on main) — it still shows all three deferred.
//  • the baseline was correctly lowered by the PR: ceiling 3 → 1, deferred_nodes now names only art-C.
//  • known_gpu_false_nodes is deliberately unchanged (the ASSEMBLE-LAND-PROVE13-1 convention), so the
//    two just-proved names are still "known", which is what turns them into apparent regressions.
const STALE_MONOLITH = {
  nodes: [
    deferredNode('art-a', 'node_a'),
    deferredNode('art-b', 'node_b'),
    deferredNode('art-c', 'node_c'),
  ],
};
const LOWERED_BASELINE = {
  deferred: 1,
  deferred_nodes: ['node_c'],
  known_gpu_false_nodes: ['node_a', 'node_b', 'node_c'],
};

// ── 1. OBSERVED RED — the reshaped-prove-PR fixture DOES trip both failure modes ───────────────────
// This is the pre-fix behaviour, preserved intact: the finding is still computed and still reported.
// Only the disposition changed. If this test ever goes green-by-silence, the gate has been gutted.
test('OBSERVED RED — stale monolith + correctly-lowered baseline reads as fabricated regressions', () => {
  const { deferred } = evaluateCoverage(STALE_MONOLITH, () => null);
  assert(deferred.length === 3, `stale monolith must still show 3 deferred, got ${deferred.length}`);
  const { regressions, newNodes } = findRegressions(deferred, LOWERED_BASELINE);
  assert(regressions.length === 2, `expected 2 apparent regressions, got ${regressions.length}`);
  assert(regressions.includes('node_a') && regressions.includes('node_b'), `expected node_a + node_b, got ${regressions.join(',')}`);
  assert(newNodes.length === 0, 'no node in this fixture is new');
});

test('OBSERVED RED — the same fixture also breaches the lowered ratchet ceiling', () => {
  const { deferred } = evaluateCoverage(STALE_MONOLITH, () => null);
  const r = ratchetBreach(deferred, LOWERED_BASELINE);
  assert(r.over === true, 'deferred 3 vs ceiling 1 must read as over');
  assert(r.ceiling === 1 && r.count === 3, `expected 3 > 1, got ${r.count} > ${r.ceiling}`);
});

// ── 2. GREEN-ON-PR — the split, on that same RED finding ──────────────────────────────────────────
test('GREEN-ON-PR — a red §18 finding on a PR is advisory, exit 0', () => {
  const d = disposition({ failed: true, mainContext: false });
  assert(d.exit === 0, `PR context must not block, got exit ${d.exit}`);
  assert(d.mode === 'advisory', `expected mode "advisory", got ${d.mode}`);
});

// ── 3. HARD-ON-MAIN — the defensive job is untouched ──────────────────────────────────────────────
// Post-regen on main, chaingraph.json IS current, so this exact shape is a GENUINE fabricated
// regression: the monolith really does say fewer nodes are proven than the baseline pins. It must
// still hard-fail. This is the assertion that proves the split relaxed the PR side ONLY.
test('HARD-ON-MAIN — a genuine fabricated regression on main still blocks, exit 1', () => {
  const { deferred } = evaluateCoverage(STALE_MONOLITH, () => null);
  const { regressions } = findRegressions(deferred, LOWERED_BASELINE);
  const ratchet = ratchetBreach(deferred, LOWERED_BASELINE);
  const isFailed = regressions.length > 0 || ratchet.over;
  assert(isFailed, 'fixture must be a failing state for this assertion to mean anything');
  const d = disposition({ failed: isFailed, mainContext: true });
  assert(d.exit === 1, `main context must block, got exit ${d.exit}`);
  assert(d.mode === 'blocking', `expected mode "blocking", got ${d.mode}`);
});

// ── 4. FAILS CLOSED — the downgrade must be affirmatively earned ───────────────────────────────────
test('FAILS CLOSED — an absent/undeterminable context blocks rather than relaxing', () => {
  for (const ctx of [undefined, null, '', 0, NaN]) {
    const d = disposition({ failed: true, mainContext: ctx });
    assert(d.exit === 1, `mainContext=${String(ctx)} must block, got exit ${d.exit}`);
  }
});

test('calibration — a clean state exits 0 in BOTH contexts', () => {
  assert(disposition({ failed: false, mainContext: true }).exit === 0, 'clean on main must be 0');
  assert(disposition({ failed: false, mainContext: false }).exit === 0, 'clean on a PR must be 0');
  assert(disposition({ failed: false, mainContext: true }).mode === 'clean', 'clean must report mode "clean"');
});

// ── 5. calibration — a legitimate brand-new node deferral is NOT a regression ──────────────────────
test('calibration — a brand-new gpu:false node appearing deferred is a new node, not a regression', () => {
  const cg = { nodes: [deferredNode('art-c', 'node_c'), deferredNode('art-d', 'node_d')] };
  const { deferred } = evaluateCoverage(cg, () => null);
  const { regressions, newNodes } = findRegressions(deferred, LOWERED_BASELINE);
  assert(regressions.length === 0, `a never-before-seen node must not read as a regression, got ${regressions.join(',')}`);
  assert(newNodes.length === 1 && newNodes[0] === 'node_d', `expected node_d as the new node, got ${newNodes.join(',')}`);
});

test('calibration — a proved node leaving the deferred set trips nothing', () => {
  const cg = { nodes: [provenNode('art-a', 'node_a'), provenNode('art-b', 'node_b'), deferredNode('art-c', 'node_c')] };
  const { proven, deferred, missing } = evaluateCoverage(cg, () => null);
  assert(proven.length === 2 && deferred.length === 1 && missing.length === 0, 'expected 2 proven / 1 deferred / 0 missing');
  const { regressions } = findRegressions(deferred, LOWERED_BASELINE);
  assert(regressions.length === 0, 'the post-regen state must be clean');
  assert(ratchetBreach(deferred, LOWERED_BASELINE).over === false, 'deferred 1 vs ceiling 1 must not breach');
});

// ── 6. classifier controls (the gate's original defensive job, previously unpaired) ────────────────
test('OBSERVED RED — a journal committing an error is not a proof, however valid the seal', () => {
  const n = provenNode('art-e', 'node_e');
  n.audit_signature.compute_proof = { ...GOOD_PROOF, journal: { error: { error: 'ocg_run', code: -3 }, output: { r: 1 } } };
  const r = classifyNode(n);
  assert(r.state === 'missing', `a seal over a failed run must classify missing, got ${r.state}`);
});

test('OBSERVED RED — an imageId absent from compute_images breaks the §18.1 binding', () => {
  const n = provenNode('art-f', 'node_f');
  n.compute_images = [{ image_id: 'sha256:' + 'b'.repeat(64) }];
  const r = classifyNode(n);
  assert(r.state === 'missing', `unbound imageId must classify missing, got ${r.state}`);
  assert(r.problems.some((p) => p.includes('§18.1')), 'the §18.1 binding defect must be named');
});

test('OBSERVED RED — a placeholder deferred_reason is not a valid park state (§18.6(b))', () => {
  assert(classifyNode(deferredNode('art-g', 'node_g', 'TBD')).state === 'missing', 'placeholder reason must classify missing');
  assert(classifyNode(deferredNode('art-h', 'node_h', '   ')).state === 'missing', 'empty reason must classify missing');
});

test('OBSERVED RED — a node with neither a proof nor a deferral classifies missing', () => {
  const r = classifyNode({ tool_id: 'art-i', mcp_name: 'node_i', status: 'live', gpu: false });
  assert(r.state === 'missing', `expected missing, got ${r.state}`);
});

test('calibration — a well-formed, bound receipt classifies proven', () => {
  assert(classifyNode(provenNode('art-j', 'node_j')).state === 'proven', 'a good receipt must classify proven');
});

// ── 7. conformance-fixture presence controls ──────────────────────────────────────────────────────
test('OBSERVED RED — conformance_fixtures:true with no fixtures file is a gap', () => {
  const n = { ...deferredNode('art-k', 'node_k'), conformance_fixtures: true };
  assert(fixtureGap(n, () => null)?.reason.includes('MISSING'), 'an absent fixtures file must be reported MISSING');
  assert(fixtureGap(n, () => '{"vectors":[]}')?.reason.includes('zero vectors'), 'an empty vectors array must be reported');
  assert(fixtureGap(n, () => 'not json')?.reason.includes('not valid JSON'), 'unparseable fixtures must be reported');
  assert(fixtureGap(n, () => '{"vectors":[{"policy_parameters":{},"output_payload":{}}]}') === null, 'a good fixtures file must not be a gap');
});

// ── 8. END-TO-END wiring control — the split is observable from outside the module ─────────────────
// Proves the shipped CLI path actually routes through disposition()/isMainContext(), not just that the
// pure functions agree with each other. Runs the real script against the real repo twice.
function runGate(eventName) {
  try {
    execFileSync(process.execPath, [GATE], {
      cwd: resolve(HERE, '..'),
      env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: eventName },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

test('END-TO-END — the real gate never blocks a pull_request, and main is never more lenient', () => {
  const prExit = runGate('pull_request');
  const mgExit = runGate('merge_group');
  const mainExit = runGate('push');
  assert(prExit === 0, `pull_request context must exit 0 whatever the finding, got ${prExit}`);
  assert(mgExit === 0, `merge_group context must exit 0 whatever the finding, got ${mgExit}`);
  assert(mainExit >= prExit, `main must never be more lenient than a PR (main ${mainExit} < pr ${prExit})`);
});

test('END-TO-END — the shipped exit path is wired to disposition() + isMainContext(), not a local branch', () => {
  const src = readFileSync(GATE, 'utf8');
  assert(/const MAIN_CONTEXT = isMainContext\(\);/.test(src), 'the CLI must read the context via isMainContext()');
  assert(/disposition\(\{ failed, mainContext: MAIN_CONTEXT \}\)/.test(src), 'the CLI exit must be decided by disposition()');
});

console.log(`\n§18 coverage gate self-test — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
