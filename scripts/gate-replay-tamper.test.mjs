#!/usr/bin/env node
/**
 * scripts/gate-replay-tamper.test.mjs
 * Gate: the §21 gate-replay engine must flag tampered decisions[].
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1, audit finding E-3).
 * This gate carries NO copy of the gate evaluator. It brace-extracts the REAL
 * `deepEqual` / `rfc6901` / `applyOp` / `_replayGates` out of `ledger/index.html`
 * — the source the browser actually runs — via the shared extract-and-diff helper
 * `scripts/lib-extract-shipped.mjs` (the AUD-C3-2 extractor from
 * chaingraph/kernels/inline-hash-equality.test.mjs). Before this change the gate
 * ran a private replica: `ledger/index.html` could regress arbitrarily and every
 * assertion below stayed green.
 *
 * It also closes the header claim this file used to make and never test: the
 * shipped inline copy is diffed BEHAVIOURALLY against the exported
 * `chaingraph/kernels/_gateval.mjs` (`rfc6901`, `applyOp`), so the two sources
 * cannot silently diverge either.
 *
 * SELF-PROVING (SO #34c / SO #40b): every run also builds the same suite over a
 * DELIBERATELY-BROKEN source fixture and asserts the suite fails on it. If
 * extraction ever goes blind or the assertions stop discriminating, that check
 * reds — so a green result here can never be a false negative.
 *
 * Tests (all now executed against the SHIPPED evaluator):
 *   1. Clean composite → gate replay passes.
 *   2. Mutated observed_value in decisions[] → gate replay fails (tamper detected).
 *   3. Mutated step output_payload → gate replay fails.
 *   4. Missing step in composite → gate replay fails (step not found).
 *   5. Empty decisions[] → absent status.
 *   6. Pointer resolves correctly on step output_payload.
 *   7. Two gates, one mutated → overall fail, second still ok.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildShipped } from './lib-extract-shipped.mjs';
import { rfc6901 as kernelRfc6901, applyOp as kernelApplyOp } from '../chaingraph/kernels/_gateval.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SHIPPED_REL = 'ledger/index.html';

// The extraction contract: exactly the shipped symbols the §21 replay path is made of.
const EXTRACT_SPEC = {
  file: SHIPPED_REL,
  decls: ['isFiniteNum'],                                   // applyOp's numeric guard
  fns: ['deepEqual', 'rfc6901', 'applyOp', '_replayGates'],
};

// ── Test fixtures ──────────────────────────────────────────────────────────────

// Canonical clean composite artifact (gate fires based on spread_bps value)
const CLEAN_COMPOSITE = {
  '@context': 'https://ainumbers.co/chaingraph/standard/v0.4',
  chaingraph_version: '0.4.0',
  execution_hash: 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111',
  chain: 'mortgage-compliance-preflight',
  tool_id: 'chaingraph/chains/mortgage-compliance-preflight',
  mandate_type: 'mortgage_compliance',
  generated_at: '2026-07-06T00:00:00.000Z',
  policy_parameters: { loan_amount: 425000, apor: 6.5, apr: 8.7 },
  output_payload: {
    composite: true,
    steps: [
      {
        tool_id: 'art-215-conforming-loan-limit',
        execution_hash: 'step1hash',
        mandate_type: 'rule',
        output_payload: { conforming: true, limit: 726200 }
      },
      {
        tool_id: 'art-216-qm-apr-apor-spread',
        execution_hash: 'step2hash',
        mandate_type: 'rule',
        output_payload: { spread_bps: 220, threshold_bps: 150, exceeds_threshold: true }
      }
    ],
    decisions: [
      {
        step_id: 'art-216-qm-apr-apor-spread',
        input_pointer: '/spread_bps',
        observed_value: 220,
        op: 'gt',
        value: 150,
        next: 'art-217-check-points'
      }
    ],
    path_taken: ['art-215-conforming-loan-limit', 'art-216-qm-apr-apor-spread', 'art-217-check-points']
  },
  audit_signature: { server_side_executed: true, zero_pii_verified: true, deterministic_run: true }
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// ── The tamper suite, run against whichever evaluator it is handed ─────────────
// Returns a list of failure messages (empty = suite passed for that evaluator).
function runReplaySuite(V) {
  const fails = [];
  const check = (name, fn) => {
    try { fn(); } catch (e) { fails.push(name + ': ' + e.message); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  check('clean composite: gate replay passes', () => {
    const result = V._replayGates(CLEAN_COMPOSITE);
    assert(result.status === 'pass', 'Expected pass, got: ' + result.status);
    assert(!result.tamper, 'Expected tamper=false');
    assert(result.results.length === 1, 'Expected 1 gate result, got ' + result.results.length);
    assert(result.results[0].ok, 'First gate result should be ok');
  });

  check('mutated observed_value in decisions[]: gate replay fails', () => {
    const tampered = clone(CLEAN_COMPOSITE);
    tampered.output_payload.decisions[0].observed_value = 100;
    const result = V._replayGates(tampered);
    assert(result.status === 'fail', 'Expected fail, got: ' + result.status);
    assert(result.tamper === true, 'Expected tamper=true');
    assert(!result.results[0].ok, 'First gate result should NOT be ok after mutation');
  });

  check('mutated step output_payload: gate replay fails', () => {
    const tampered = clone(CLEAN_COMPOSITE);
    tampered.output_payload.steps[1].output_payload.spread_bps = 80;
    const result = V._replayGates(tampered);
    assert(result.status === 'fail', 'Expected fail, got: ' + result.status);
    assert(result.tamper === true, 'Expected tamper=true after step mutation');
  });

  check('missing step: gate replay fails with step-not-found', () => {
    const tampered = clone(CLEAN_COMPOSITE);
    tampered.output_payload.steps = tampered.output_payload.steps.filter(
      s => s.tool_id !== 'art-216-qm-apr-apor-spread'
    );
    const result = V._replayGates(tampered);
    assert(result.status === 'fail', 'Expected fail when step missing');
    assert(result.results[0].reason === 'step not in composite output', 'Expected step-not-found reason');
  });

  check('empty decisions[]: returns absent status', () => {
    const noGates = clone(CLEAN_COMPOSITE);
    noGates.output_payload.decisions = [];
    const result = V._replayGates(noGates);
    assert(result.status === 'absent', 'Expected absent, got: ' + result.status);
  });

  check('rfc6901: resolves nested pointer /spread_bps correctly', () => {
    const { found, value } = V.rfc6901({ spread_bps: 220, nested: { x: 1 } }, '/spread_bps');
    assert(found, 'Expected found=true');
    assert(value === 220, 'Expected 220, got ' + value);
  });

  check('rfc6901: absent key returns found=false', () => {
    const { found } = V.rfc6901({ a: 1 }, '/nonexistent');
    assert(!found, 'Expected found=false for absent key');
  });

  check('rfc6901: array index resolution', () => {
    const { found, value } = V.rfc6901({ items: [10, 20, 30] }, '/items/1');
    assert(found, 'Expected found=true');
    assert(value === 20, 'Expected 20, got ' + value);
  });

  check('rfc6901: tilde escape ~1 -> /', () => {
    const { found, value } = V.rfc6901({ 'a/b': 42 }, '/a~1b');
    assert(found, 'Expected found=true');
    assert(value === 42, 'Expected 42, got ' + value);
  });

  check('two gates: one mutated observed_value = overall fail', () => {
    const twoGates = clone(CLEAN_COMPOSITE);
    twoGates.output_payload.steps.push({
      tool_id: 'art-217-check-points',
      execution_hash: 'step3hash',
      mandate_type: 'rule',
      output_payload: { points_ok: true }
    });
    twoGates.output_payload.decisions.push({
      step_id: 'art-217-check-points',
      input_pointer: '/points_ok',
      observed_value: true,
      op: 'eq',
      value: true,
      next: 'end'
    });
    const cleanResult = V._replayGates(twoGates);
    assert(cleanResult.status === 'pass', 'Clean two-gate should pass: ' + cleanResult.status);

    twoGates.output_payload.decisions[0].observed_value = 999;
    const tampResult = V._replayGates(twoGates);
    assert(tampResult.status === 'fail', 'After mutation, should fail');
    assert(tampResult.results[0].ok === false, 'First gate should fail');
    assert(tampResult.results[1].ok === true, 'Second gate should still pass');
  });

  return fails;
}

// ── Runner ─────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function report(name, failures) {
  if (failures.length === 0) { console.log('  ✓ ' + name); passed++; return; }
  console.error('  ✗ ' + name);
  for (const f of failures) console.error('    ' + f);
  failed++;
}
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

console.log('gate-replay-tamper.test.mjs (SHIPPED source: ' + SHIPPED_REL + ')');

// ── 1. Build the evaluator from the SHIPPED page and run the tamper suite ──────
const shippedSrc = readFileSync(join(REPO, SHIPPED_REL), 'utf8');
const V = buildShipped(shippedSrc, EXTRACT_SPEC);   // throws (red) if a symbol is gone
test('extraction: all §21 replay symbols located in ' + SHIPPED_REL, () => {
  for (const n of EXTRACT_SPEC.fns) {
    if (typeof V[n] !== 'function') throw new Error('shipped `' + n + '` did not extract as a function');
  }
});

report('shipped §21 replay engine: full tamper suite (10 assertions)', runReplaySuite(V));

// ── 2. Shipped inline copy vs the _gateval.mjs kernel (behavioural diff) ───────
const POINTER_VECTORS = [
  [{ spread_bps: 220 }, '/spread_bps'],
  [{ a: { b: [1, 2, 3] } }, '/a/b/2'],
  [{ 'a/b': 42 }, '/a~1b'],
  [{ 'a~b': 7 }, '/a~0b'],
  [{ a: 1 }, '/missing'],
  [{ a: 1 }, 'no-leading-slash'],
  [{ a: 1 }, ''],
  [{ items: [1] }, '/items/9'],
  [{ items: [1] }, '/items/01'],
  [{ a: 1 }, '/a~2b'],
];
const OP_VECTORS = [
  ['eq', true, 5, 5], ['eq', true, 5, 6], ['neq', true, 5, 6], ['gt', true, 220, 150],
  ['gt', true, '220', 150], ['gte', true, 150, 150], ['lt', true, 1, 2], ['lte', true, 2, 2],
  ['in', true, 'b', ['a', 'b']], ['in', true, 'z', ['a', 'b']], ['present', false, undefined, null],
  ['absent', false, undefined, null], ['bogus-op', true, 1, 1],
];
test('shipped inline rfc6901 ≡ chaingraph/kernels/_gateval.mjs rfc6901', () => {
  for (const [doc, ptr] of POINTER_VECTORS) {
    const a = V.rfc6901(doc, ptr), b = kernelRfc6901(doc, ptr);
    if (a.found !== b.found || JSON.stringify(a.value) !== JSON.stringify(b.value))
      throw new Error(`divergence on pointer ${JSON.stringify(ptr)}: inline=${JSON.stringify(a)} kernel=${JSON.stringify(b)}`);
  }
});
test('shipped inline applyOp ≡ chaingraph/kernels/_gateval.mjs applyOp', () => {
  for (const [op, found, observed, value] of OP_VECTORS) {
    const a = V.applyOp(op, found, observed, value), b = kernelApplyOp(op, found, observed, value);
    if (a !== b) throw new Error(`divergence on op ${op}(${JSON.stringify(observed)}, ${JSON.stringify(value)}): inline=${a} kernel=${b}`);
  }
});

// ── 3. Self-proving: the SAME suite must FAIL on a deliberately-broken source ──
// A `_replayGates` that rubber-stamps every decision. If the suite above cannot
// catch this, it is not discriminating and its green means nothing.
const BROKEN_SOURCE = `
  const isFiniteNum = x => typeof x === 'number' && Number.isFinite(x);
  function deepEqual(a, b) { return true; }                       // BUG: everything is equal
  function rfc6901(doc, pointer) { return { found: true, value: undefined }; }
  function applyOp(op, found, observed, value) { return true; }
  function _replayGates(artifact) {
    const out = artifact.output_payload;
    const decisions = out && out.decisions;
    if (!Array.isArray(decisions) || decisions.length === 0) return { status: 'absent' };
    const results = decisions.map(d => ({ step_id: d.step_id, ok: true }));  // BUG: never flags tamper
    return { status: 'pass', results, tamper: false };
  }`;
const brokenV = buildShipped(BROKEN_SOURCE, { ...EXTRACT_SPEC, file: '<broken-source-fixture>' });
const brokenFails = runReplaySuite(brokenV);
test(`self-test: suite red-lines a rubber-stamp evaluator (${brokenFails.length} assertion failures caught)`, () => {
  if (brokenFails.length === 0) throw new Error('suite passed a rubber-stamp evaluator — the assertions do not discriminate');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
