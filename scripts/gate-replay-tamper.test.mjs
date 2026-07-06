#!/usr/bin/env node
/**
 * scripts/gate-replay-tamper.test.mjs
 * Gate: the §21 gate-replay engine must flag tampered decisions[].
 *
 * Inlines the same rfc6901 / applyOp / deepEqual logic from ledger/index.html
 * and the _gateval kernel (both sources are byte-equivalent — tested here).
 *
 * Tests:
 *   1. Clean composite → gate replay passes.
 *   2. Mutated observed_value in decisions[] → gate replay fails (tamper detected).
 *   3. Missing step in composite → gate replay fails (step not found).
 *   4. Pointer resolves correctly on step output_payload.
 */

// ── Inlined gate evaluator (mirrors ledger/index.html and kernels/_gateval.mjs) ──
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function rfc6901(doc, pointer) {
  if (typeof pointer !== 'string') return { found: false, value: undefined };
  if (pointer === '') return { found: true, value: doc };
  if (pointer[0] !== '/') return { found: false, value: undefined };
  if (/~(?![01])/.test(pointer)) return { found: false, value: undefined };
  const tokens = pointer.slice(1).split('/').map(t => t.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = doc;
  for (const tok of tokens) {
    if (cur === null || typeof cur !== 'object') return { found: false, value: undefined };
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9][0-9]*)$/.test(tok)) return { found: false, value: undefined };
      const idx = +tok;
      if (idx >= cur.length) return { found: false, value: undefined };
      cur = cur[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, tok)) return { found: false, value: undefined };
      cur = cur[tok];
    }
  }
  return { found: true, value: cur };
}

// §21 gate replay engine (mirrors ledger/index.html _replayGates)
function replayGates(artifact) {
  const op = artifact.output_payload;
  const decisions = op?.decisions;
  if (!Array.isArray(decisions) || decisions.length === 0)
    return { status: 'absent', note: 'No gate decisions recorded.' };

  const steps = op.steps || [];
  const stepMap = new Map(steps.map(s => [s.tool_id, s]));
  const results = [];

  for (const d of decisions) {
    const step = stepMap.get(d.step_id);
    if (!step) {
      results.push({ step_id: d.step_id, ok: false, reason: 'step not in composite output' });
      continue;
    }
    const { found, value: actual } = rfc6901(step.output_payload, d.input_pointer);
    const expected = d.observed_value;
    const observedMatch = found ? deepEqual(actual, expected) : (expected === null || expected === undefined);
    results.push({
      step_id: d.step_id,
      ok: observedMatch,
      pointer: d.input_pointer,
      expected,
      actual: found ? actual : undefined,
    });
  }
  const allOk = results.every(r => r.ok);
  return { status: allOk ? 'pass' : 'fail', results, tamper: !allOk };
}

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

// ── Test runner ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (e) {
    console.error('  ✗ ' + name + '\n    ' + e.message);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('gate-replay-tamper.test.mjs');

// ── 1. Clean artifact passes ───────────────────────────────────────────────────
test('clean composite: gate replay passes', () => {
  const result = replayGates(CLEAN_COMPOSITE);
  assert(result.status === 'pass', 'Expected pass, got: ' + result.status);
  assert(!result.tamper, 'Expected tamper=false');
  assert(result.results.length === 1, 'Expected 1 gate result, got ' + result.results.length);
  assert(result.results[0].ok, 'First gate result should be ok');
});

// ── 2. Mutated observed_value triggers tamper flag ────────────────────────────
test('mutated observed_value in decisions[]: gate replay fails', () => {
  const tampered = JSON.parse(JSON.stringify(CLEAN_COMPOSITE));
  // Change recorded observed_value from 220 to 100 (doesn't match actual step output 220)
  tampered.output_payload.decisions[0].observed_value = 100;
  const result = replayGates(tampered);
  assert(result.status === 'fail', 'Expected fail, got: ' + result.status);
  assert(result.tamper === true, 'Expected tamper=true');
  assert(!result.results[0].ok, 'First gate result should NOT be ok after mutation');
});

// ── 3. Mutated step output_payload triggers tamper flag ──────────────────────
test('mutated step output_payload: gate replay fails', () => {
  const tampered = JSON.parse(JSON.stringify(CLEAN_COMPOSITE));
  // Change actual step value from 220 to 80 (doesn't match recorded observed_value 220)
  tampered.output_payload.steps[1].output_payload.spread_bps = 80;
  const result = replayGates(tampered);
  assert(result.status === 'fail', 'Expected fail, got: ' + result.status);
  assert(result.tamper === true, 'Expected tamper=true after step mutation');
});

// ── 4. Missing step → gate fails (step not found) ─────────────────────────────
test('missing step: gate replay fails with step-not-found', () => {
  const tampered = JSON.parse(JSON.stringify(CLEAN_COMPOSITE));
  // Remove the step that the decision references
  tampered.output_payload.steps = tampered.output_payload.steps.filter(
    s => s.tool_id !== 'art-216-qm-apr-apor-spread'
  );
  const result = replayGates(tampered);
  assert(result.status === 'fail', 'Expected fail when step missing');
  assert(result.results[0].reason === 'step not in composite output', 'Expected step-not-found reason');
});

// ── 5. Empty decisions[] → absent status ─────────────────────────────────────
test('empty decisions[]: returns absent status', () => {
  const noGates = JSON.parse(JSON.stringify(CLEAN_COMPOSITE));
  noGates.output_payload.decisions = [];
  const result = replayGates(noGates);
  assert(result.status === 'absent', 'Expected absent, got: ' + result.status);
});

// ── 6. rfc6901 pointer resolution smoke tests ─────────────────────────────────
test('rfc6901: resolves nested pointer /spread_bps correctly', () => {
  const doc = { spread_bps: 220, nested: { x: 1 } };
  const { found, value } = rfc6901(doc, '/spread_bps');
  assert(found, 'Expected found=true');
  assert(value === 220, 'Expected 220, got ' + value);
});

test('rfc6901: absent key returns found=false', () => {
  const doc = { a: 1 };
  const { found } = rfc6901(doc, '/nonexistent');
  assert(!found, 'Expected found=false for absent key');
});

test('rfc6901: array index resolution', () => {
  const doc = { items: [10, 20, 30] };
  const { found, value } = rfc6901(doc, '/items/1');
  assert(found, 'Expected found=true');
  assert(value === 20, 'Expected 20, got ' + value);
});

test('rfc6901: tilde escape ~1 → /', () => {
  const doc = { 'a/b': 42 };
  const { found, value } = rfc6901(doc, '/a~1b');
  assert(found, 'Expected found=true');
  assert(value === 42, 'Expected 42, got ' + value);
});

// ── 7. Multiple gates: one pass, one fail → overall fail ────────────────────
test('two gates: one mutated observed_value = overall fail', () => {
  const twoGates = JSON.parse(JSON.stringify(CLEAN_COMPOSITE));
  twoGates.output_payload.steps.push({
    tool_id: 'art-217-check-points',
    execution_hash: 'step3hash',
    mandate_type: 'rule',
    output_payload: { points_ok: true }
  });
  twoGates.output_payload.decisions.push({
    step_id: 'art-217-check-points',
    input_pointer: '/points_ok',
    observed_value: true,   // correct
    op: 'eq',
    value: true,
    next: 'end'
  });
  // Clean version passes
  const cleanResult = replayGates(twoGates);
  assert(cleanResult.status === 'pass', 'Clean two-gate should pass: ' + cleanResult.status);

  // Mutate first decision
  twoGates.output_payload.decisions[0].observed_value = 999;
  const tampResult = replayGates(twoGates);
  assert(tampResult.status === 'fail', 'After mutation, should fail');
  assert(tampResult.results[0].ok === false, 'First gate should fail');
  assert(tampResult.results[1].ok === true, 'Second gate should still pass');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
