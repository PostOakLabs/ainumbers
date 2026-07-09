#!/usr/bin/env node
/**
 * scripts/escalation-closure-tamper.test.mjs
 * Gate: the §22.8 escalation-record hash recompute + closure verification, vendored in
 * ledger/index.html, must flag tampered records and closures.
 *
 * Inlines the same cgCanon / computeEscalationRecordHash / verifyEscalationClosure logic
 * from ledger/index.html (byte-equivalent — checked here against a real worker-produced
 * record_hash pinned in the ML-2 landing memory).
 *
 * Tests:
 *   1. Clean open record: recomputed hash matches the pinned worker-produced record_hash.
 *   2. Clean closed record: verifyEscalationClosure returns 'closed'.
 *   3. Mutated decision (observed_value) → record hash diverges → closure 'tamper'.
 *   4. Mutated halted_steps → record hash diverges → closure 'tamper'.
 *   5. Mandate-bound vs unbound → different record hashes (conditional-presence discipline).
 *   6. Closure with invalid decision value (not approve/reject) → 'tamper'.
 *   7. opened_at excluded from preimage: two records differing only in opened_at hash the same.
 */
import { createHash } from 'node:crypto';

// ── Inlined canonicalizer + hash (mirrors ledger/index.html cgCanon / computeEscalationRecordHash) ──
function cgCanon(v) {
  if (Array.isArray(v)) return v.map(cgCanon);
  if (v !== null && typeof v === 'object')
    return Object.keys(v).sort().reduce((o, k) => { o[k] = cgCanon(v[k]); return o; }, {});
  return v;
}

function computeEscalationRecordHash(record) {
  const preimage = {};
  if (record.mandate_hash) preimage.mandate_hash = record.mandate_hash;
  preimage.decision = record.decision;
  preimage.halted_steps = record.halted_steps;
  const json = JSON.stringify(cgCanon(preimage));
  return createHash('sha256').update(json, 'utf8').digest('hex');
}

function verifyEscalationClosure(record, closure) {
  const recomputed = computeEscalationRecordHash(record);
  if (!closure) return { status: 'open', recordHash: recomputed };
  const decisionValid = closure.decision === 'approve' || closure.decision === 'reject';
  const hashMatch = closure.record_hash === recomputed;
  return { status: hashMatch && decisionValid ? 'closed' : 'tamper', recordHash: recomputed, hashMatch, decisionValid };
}

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

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('escalation-closure-tamper.test.mjs');

test('clean open record: recomputed hash matches worker-pinned record_hash', () => {
  const h = computeEscalationRecordHash(CLEAN_RECORD);
  assert(h === PINNED_RECORD_HASH, 'expected ' + PINNED_RECORD_HASH + ', got ' + h);
});

test('opened_at excluded from preimage: differing wall-clock hashes identically', () => {
  const other = Object.assign({}, CLEAN_RECORD, { opened_at: '2099-01-01T00:00:00.000Z' });
  assert(computeEscalationRecordHash(other) === PINNED_RECORD_HASH, 'record_hash must not depend on opened_at');
});

test('clean closed record: verifyEscalationClosure returns closed', () => {
  const closure = { record_hash: PINNED_RECORD_HASH, decision: 'approve', anchor: {}, envelope: { id: 'e1' } };
  const r = verifyEscalationClosure(CLEAN_RECORD, closure);
  assert(r.status === 'closed', 'expected closed, got ' + r.status);
  assert(r.hashMatch, 'expected hashMatch=true');
});

test('open record with no closure: status open', () => {
  const r = verifyEscalationClosure(CLEAN_RECORD, null);
  assert(r.status === 'open', 'expected open, got ' + r.status);
});

test('mutated observed_value: record hash diverges, closure tamper-flagged', () => {
  const tampered = JSON.parse(JSON.stringify(CLEAN_RECORD));
  tampered.decision.observed_value = 'A';
  const closure = { record_hash: PINNED_RECORD_HASH, decision: 'approve', envelope: { id: 'e1' } };
  const r = verifyEscalationClosure(tampered, closure);
  assert(r.status === 'tamper', 'expected tamper, got ' + r.status);
  assert(!r.hashMatch, 'expected hashMatch=false');
});

test('mutated halted_steps: record hash diverges, closure tamper-flagged', () => {
  const tampered = JSON.parse(JSON.stringify(CLEAN_RECORD));
  tampered.halted_steps.push('art-99-extra-step');
  const closure = { record_hash: PINNED_RECORD_HASH, decision: 'approve', envelope: { id: 'e1' } };
  const r = verifyEscalationClosure(tampered, closure);
  assert(r.status === 'tamper', 'expected tamper, got ' + r.status);
});

test('mandate-bound vs unbound: different record hashes', () => {
  const bound = Object.assign({}, CLEAN_RECORD, { mandate_hash: 'aaaa1111bbbb2222' });
  const hUnbound = computeEscalationRecordHash(CLEAN_RECORD);
  const hBound = computeEscalationRecordHash(bound);
  assert(hUnbound !== hBound, 'mandate-bound and unbound records must hash differently');
});

test('closure with invalid decision value: tamper-flagged', () => {
  const closure = { record_hash: PINNED_RECORD_HASH, decision: 'maybe', envelope: { id: 'e1' } };
  const r = verifyEscalationClosure(CLEAN_RECORD, closure);
  assert(r.status === 'tamper', 'expected tamper for non-approve/reject decision, got ' + r.status);
  assert(!r.decisionValid, 'expected decisionValid=false');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
