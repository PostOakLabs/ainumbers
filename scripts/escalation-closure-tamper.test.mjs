#!/usr/bin/env node
/**
 * scripts/escalation-closure-tamper.test.mjs
 * Gate: the §22.8 escalation-record hash recompute + closure verification shipped in
 * ledger/index.html must flag tampered records and closures.
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1, audit finding E-3).
 * This gate carries NO copy of the canonicalizer or the closure verifier. It
 * brace-extracts the REAL `cgCanon` / `computeEscalationRecordHash` /
 * `escalationRecordOf` / `escalationClosureOf` / `verifyEscalationClosure` out of
 * `ledger/index.html` via the shared extract-and-diff helper
 * `scripts/lib-extract-shipped.mjs` (the AUD-C3-2 extractor from
 * chaingraph/kernels/inline-hash-equality.test.mjs). Before this change the gate
 * pinned a private replica's canonicalization against the worker-produced hash and
 * left the SHIPPED page entirely unpinned: ledger/index.html could regress its
 * preimage or drop the tamper branch and every assertion below stayed green.
 *
 * SELF-PROVING (SO #34c / SO #40b): every run also builds the same suite over a
 * DELIBERATELY-BROKEN source fixture and asserts the suite fails on it, so a green
 * result here can never come from a blind extractor or non-discriminating asserts.
 *
 * Tests (all now executed against the SHIPPED verifier):
 *   1. Clean open record: recomputed hash matches the pinned worker-produced record_hash.
 *   2. opened_at excluded from preimage: differing wall-clock hashes identically.
 *   3. Clean closed record: verifyEscalationClosure returns 'closed'.
 *   4. Open record, no closure → 'open'; no record at all → 'absent'.
 *   5. Mutated decision (observed_value) → record hash diverges → closure 'tamper'.
 *   6. Mutated halted_steps → record hash diverges → closure 'tamper'.
 *   7. Mandate-bound vs unbound → different record hashes (conditional-presence discipline).
 *   8. Closure with invalid decision value (not approve/reject) → 'tamper'.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildShipped } from './lib-extract-shipped.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SHIPPED_REL = 'ledger/index.html';

// The extraction contract: exactly the shipped symbols the §22.8 closure path is made of.
const EXTRACT_SPEC = {
  file: SHIPPED_REL,
  fns: ['cgCanon', 'computeEscalationRecordHash', 'escalationRecordOf', 'escalationClosureOf', 'verifyEscalationClosure'],
};

// ── Fixture: the real dora-escalation-demo open record (ML-2 session 2, pinned in
//    memory project-ainumbers-ml2-escalation-emit-halt.md) ──
const CLEAN_DECISION = {
  step_id: 'art-29-dora-readiness-diagnostic',
  input_pointer: '/grade',
  observed_value: 'F',
  matched_rule_index: 0,
  op: 'eq',
  value: 'F',
  next: 'escalate'
};
const CLEAN_RECORD = {
  decision: CLEAN_DECISION,
  halted_steps: ['art-09-dora-incident-classifier'],
  opened_at: '2026-07-06T12:00:00.000Z'
};
const PINNED_RECORD_HASH = '146ca29a0d8ad297e7a6c191ef6891b0f20a3e739e85d422428922c9e8feef73';

const clone = (o) => JSON.parse(JSON.stringify(o));

// The shipped verifier takes a whole artifact and reaches into output_payload, so the
// fixtures are wrapped exactly the way ledger/index.html sees them on ingress (§22.8.3).
function artifactOf(record, closure) {
  const op = {};
  if (record) op.escalation_record = record;
  if (closure) op.escalation_closure = closure;
  return { output_payload: op };
}

// ── The tamper suite, run against whichever verifier it is handed ──────────────
// Returns a list of failure messages (empty = suite passed for that verifier).
async function runClosureSuite(V) {
  const fails = [];
  const check = async (name, fn) => {
    try { await fn(); } catch (e) { fails.push(name + ': ' + e.message); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  await check('clean open record: recomputed hash matches worker-pinned record_hash', async () => {
    const h = await V.computeEscalationRecordHash(CLEAN_RECORD);
    assert(h === PINNED_RECORD_HASH, 'expected ' + PINNED_RECORD_HASH + ', got ' + h);
  });

  await check('opened_at excluded from preimage: differing wall-clock hashes identically', async () => {
    const other = Object.assign({}, CLEAN_RECORD, { opened_at: '2099-01-01T00:00:00.000Z' });
    assert(await V.computeEscalationRecordHash(other) === PINNED_RECORD_HASH, 'record_hash must not depend on opened_at');
  });

  await check('clean closed record: verifyEscalationClosure returns closed', async () => {
    const closure = { record_hash: PINNED_RECORD_HASH, decision: 'approve', anchor: {}, envelope: { id: 'e1' } };
    const r = await V.verifyEscalationClosure(artifactOf(CLEAN_RECORD, closure));
    assert(r.status === 'closed', 'expected closed, got ' + r.status);
    assert(r.hashMatch, 'expected hashMatch=true');
  });

  await check('open record with no closure: status open', async () => {
    const r = await V.verifyEscalationClosure(artifactOf(CLEAN_RECORD, null));
    assert(r.status === 'open', 'expected open, got ' + r.status);
    assert(r.recordHash === PINNED_RECORD_HASH, 'open status must still surface the recomputed record hash');
  });

  await check('artifact with no escalation_record: status absent', async () => {
    const r = await V.verifyEscalationClosure(artifactOf(null, null));
    assert(r.status === 'absent', 'expected absent, got ' + r.status);
  });

  await check('mutated observed_value: record hash diverges, closure tamper-flagged', async () => {
    const tampered = clone(CLEAN_RECORD);
    tampered.decision.observed_value = 'A';
    const closure = { record_hash: PINNED_RECORD_HASH, decision: 'approve', envelope: { id: 'e1' } };
    const r = await V.verifyEscalationClosure(artifactOf(tampered, closure));
    assert(r.status === 'tamper', 'expected tamper, got ' + r.status);
    assert(!r.hashMatch, 'expected hashMatch=false');
  });

  await check('mutated halted_steps: record hash diverges, closure tamper-flagged', async () => {
    const tampered = clone(CLEAN_RECORD);
    tampered.halted_steps.push('art-99-extra-step');
    const closure = { record_hash: PINNED_RECORD_HASH, decision: 'approve', envelope: { id: 'e1' } };
    const r = await V.verifyEscalationClosure(artifactOf(tampered, closure));
    assert(r.status === 'tamper', 'expected tamper, got ' + r.status);
  });

  await check('mandate-bound vs unbound: different record hashes', async () => {
    const bound = Object.assign({}, CLEAN_RECORD, { mandate_hash: 'aaaa1111bbbb2222' });
    const hUnbound = await V.computeEscalationRecordHash(CLEAN_RECORD);
    const hBound = await V.computeEscalationRecordHash(bound);
    assert(hUnbound !== hBound, 'mandate-bound and unbound records must hash differently');
  });

  await check('closure with invalid decision value: tamper-flagged', async () => {
    const closure = { record_hash: PINNED_RECORD_HASH, decision: 'maybe', envelope: { id: 'e1' } };
    const r = await V.verifyEscalationClosure(artifactOf(CLEAN_RECORD, closure));
    assert(r.status === 'tamper', 'expected tamper for non-approve/reject decision, got ' + r.status);
    assert(!r.decisionValid, 'expected decisionValid=false');
  });

  await check('shipped cgCanon sorts keys recursively (the §4 canon the hash depends on)', () => {
    const canon = JSON.stringify(V.cgCanon({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } }));
    assert(canon === '{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}', 'cgCanon did not produce sorted-key JCS order: ' + canon);
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

console.log('escalation-closure-tamper.test.mjs (SHIPPED source: ' + SHIPPED_REL + ')');

// ── 1. Build the verifier from the SHIPPED page and run the tamper suite ───────
const shippedSrc = readFileSync(join(REPO, SHIPPED_REL), 'utf8');
const V = buildShipped(shippedSrc, EXTRACT_SPEC);   // throws (red) if a symbol is gone
test('extraction: all §22.8 closure symbols located in ' + SHIPPED_REL, () => {
  for (const n of EXTRACT_SPEC.fns) {
    if (typeof V[n] !== 'function') throw new Error('shipped `' + n + '` did not extract as a function');
  }
});

report('shipped §22.8 closure verifier: full tamper suite (10 assertions)', await runClosureSuite(V));

// ── 2. Self-proving: the SAME suite must FAIL on a deliberately-broken source ──
// A canonicalizer that drops the recursive key-sort plus a closure verifier that
// rubber-stamps every closure. If the suite cannot catch this, its green is empty.
const BROKEN_SOURCE = `
  function cgCanon(v) {
    if (Array.isArray(v)) return v.map(cgCanon);
    if (v !== null && typeof v === 'object')
      return Object.keys(v).reduce((o, k) => { o[k] = cgCanon(v[k]); return o; }, {});  // BUG: no .sort()
    return v;
  }
  async function computeEscalationRecordHash(record) {
    const bytes = new TextEncoder().encode(JSON.stringify(cgCanon({ decision: record.decision })));  // BUG: halted_steps + mandate_hash dropped
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function escalationRecordOf(artifact) { return artifact && artifact.output_payload && artifact.output_payload.escalation_record || null; }
  function escalationClosureOf(artifact) { return artifact && artifact.output_payload && artifact.output_payload.escalation_closure || null; }
  async function verifyEscalationClosure(artifact) {
    const record = escalationRecordOf(artifact);
    if (!record) return { status: 'absent' };
    const recomputed = await computeEscalationRecordHash(record);
    const closure = escalationClosureOf(artifact);
    if (!closure) return { status: 'open', recordHash: recomputed };
    return { status: 'closed', recordHash: recomputed, hashMatch: true, decisionValid: true };  // BUG: never flags tamper
  }`;
const brokenV = buildShipped(BROKEN_SOURCE, { ...EXTRACT_SPEC, file: '<broken-source-fixture>' });
const brokenFails = await runClosureSuite(brokenV);
test(`self-test: suite red-lines a rubber-stamp closure verifier (${brokenFails.length} assertion failures caught)`, () => {
  if (brokenFails.length === 0) throw new Error('suite passed a rubber-stamp verifier — the assertions do not discriminate');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
