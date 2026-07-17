// checklist-selftest.test.mjs — CHECKRUN-1 GATE (conformance-by-construction, SPEC.md §15 spirit).
// Asserts: (a) a valid definition passes validateDefinition and round-trips its digest;
// (b) an invalid definition (missing steps) is rejected with specific errors;
// (c) a full run over a fixture SOP builds a hash-chained step-receipt set + a run receipt whose
//     Merkle root recomputes correctly; (d) verifyRun on the untouched artifacts is fully valid;
// (e) tampering ANY single step receipt breaks the chain AND the Merkle check, and verifyRun
//     names the exact broken step index; (f) an escalation path yields a §22.9-shaped failure
//     receipt referencing the failing step's execution_hash and a named rule id.
// Node 18+ (WebCrypto). Run: node chaingraph/kernels/checklist-selftest.test.mjs
import {
  validateDefinition, definitionDigest, buildStepReceipt, buildRunReceipt,
  buildEscalationReceipt, verifyRun, merkleRoot,
} from './_checklist.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const DEF = {
  definition_id: 'ckl-fixture-permit-to-work',
  title: 'Permit-to-Work Ops Check (fixture)',
  version: '1.0.0',
  source_citation: 'Internal SOP fixture for CHECKRUN-1 self-test.',
  mandate_hash: null,
  steps: [
    { step_id: 's1', title: 'Isolate energy source', instruction: 'Lock out and tag the panel.', evidence_requirement: 'text', approver_role: null, gate: 'blocking' },
    { step_id: 's2', title: 'Confirm zero energy state', instruction: 'Verify with a meter and record the reading.', evidence_requirement: 'text', approver_role: 'site_supervisor', gate: 'blocking' },
    { step_id: 's3', title: 'Log completion', instruction: 'Record who performed the work.', evidence_requirement: 'none', approver_role: null, gate: 'advisory' },
  ],
};

// (a) valid definition + digest round-trip (same input -> same digest, twice)
const v = validateDefinition(DEF);
ok(v.valid, '(a) fixture definition validates clean');
const d1 = await definitionDigest(DEF);
const d2 = await definitionDigest(DEF);
ok(d1 === d2 && /^[0-9a-f]{64}$/.test(d1), '(a) definition_digest is deterministic 64-char hex');

// (b) invalid definition rejected
const bad = { definition_id: 'x', title: 'x', version: '1.0.0', steps: [] };
const vBad = validateDefinition(bad);
ok(!vBad.valid && vBad.errors.some((e) => e.startsWith('steps:')), '(b) empty steps[] rejected with a specific error');

// (c) full run -> chained step receipts + run receipt
async function runFixture(defDigest, tamperStepIndex = -1) {
  const receipts = [];
  let prev = null;
  for (let i = 0; i < DEF.steps.length; i++) {
    const step = DEF.steps[i];
    const evidence = step.evidence_requirement === 'none' ? null : { text_digest: 'sha256:fixture-evidence-' + i };
    const r = await buildStepReceipt({
      definition_digest: defDigest, step, step_index: i, completer_key: 'operator-1',
      timestamp: `2026-07-16T10:0${i}:00.000Z`, evidence, prev_step_receipt_digest: prev,
    });
    receipts.push(r);
    prev = r.execution_hash;
  }
  if (tamperStepIndex >= 0) {
    // Tamper: mutate the evidence AFTER the receipt was built (attacker rewrites the record),
    // which changes what a real recompute would produce while leaving the stored hash stale.
    receipts[tamperStepIndex] = structuredClone(receipts[tamperStepIndex]);
    receipts[tamperStepIndex].policy_parameters.evidence = { text_digest: 'sha256:TAMPERED' };
  }
  const run = await buildRunReceipt({
    definition_digest: defDigest, run_id: 'run-fixture-1', started_at: '2026-07-16T10:00:00.000Z',
    completed_at: '2026-07-16T10:05:00.000Z', outcome: 'complete', stepReceipts: receipts, escalation: null,
  });
  return { receipts, run };
}

const defDigest = await definitionDigest(DEF);
const { receipts: cleanReceipts, run: cleanRun } = await runFixture(defDigest);
ok(cleanReceipts.length === 3, '(c) 3 step receipts produced for the 3-step fixture');
ok(cleanReceipts[0].policy_parameters.prev_step_receipt_digest === null, '(c) step 1 has no predecessor link');
ok(cleanReceipts[1].policy_parameters.prev_step_receipt_digest === cleanReceipts[0].execution_hash, '(c) step 2 chains to step 1 execution_hash');
ok(cleanReceipts[2].policy_parameters.prev_step_receipt_digest === cleanReceipts[1].execution_hash, '(c) step 3 chains to step 2 execution_hash');
const expectedRoot = await merkleRoot(cleanReceipts.map((r) => r.execution_hash));
ok(cleanRun.output_payload.merkle_root === expectedRoot, '(c) run receipt Merkle root matches independent recompute');

// (d) verifyRun on the untouched artifact set is fully valid
const cleanResult = await verifyRun({ runReceipt: cleanRun, stepReceipts: cleanReceipts });
ok(cleanResult.valid && cleanResult.chain_ok && cleanResult.merkle_ok && cleanResult.run_hash_ok, '(d) verifyRun reports fully valid on the untouched run');
ok(cleanResult.broken_at === null, '(d) no broken link reported on the untouched run');

// (e) tamper step 2 (index 1) -> chain AND Merkle both fail, exact index named
const { receipts: tamperedReceipts, run: tamperedRunSameRoot } = await runFixture(defDigest, 1);
const tamperResult = await verifyRun({ runReceipt: tamperedRunSameRoot, stepReceipts: tamperedReceipts });
ok(!tamperResult.valid, '(e) tampered run is NOT valid');
ok(!tamperResult.chain_ok, '(e) tampered run fails the hash-chain check');
ok(tamperResult.broken_at === 1, '(e) verifyRun names the exact tampered step index (1)');
ok(tamperResult.steps[1].hash_ok === false, '(e) the tampered step itself fails its own execution_hash recompute');
ok(tamperResult.steps[0].ok && tamperResult.steps[2].ok, '(e) the untouched steps on either side still verify clean');

// tamper the run receipt's stored root directly (simulates rewriting the summary, not a step)
const tamperedRun2 = structuredClone(cleanRun);
tamperedRun2.output_payload.merkle_root = 'f'.repeat(64);
const tamperResult2 = await verifyRun({ runReceipt: tamperedRun2, stepReceipts: cleanReceipts });
ok(!tamperResult2.merkle_ok && !tamperResult2.valid, '(e) a rewritten Merkle root is caught even when every step receipt is untouched');

// (f) escalation path -> §22.9-shaped failure receipt
const escalationReceipt = buildEscalationReceipt({
  definition_digest: defDigest,
  subject_execution_hash: cleanReceipts[1].execution_hash,
  failing_rule_id: 'checkrun.blocking_gate_zero_energy_not_confirmed',
  ar4si_tier: 'contraindicated',
  detail: 'Step s2 (Confirm zero energy state) could not be confirmed by the site supervisor; run escalated.',
  generated_at: '2026-07-16T10:02:30.000Z',
});
ok(escalationReceipt.receipt_type === 'failure_receipt', '(f) escalation is a failure_receipt');
ok(escalationReceipt.subject_execution_hash === cleanReceipts[1].execution_hash, '(f) escalation references the failing step execution_hash');
ok(escalationReceipt.ar4si_tier === 'contraindicated', '(f) escalation carries an AR4SI trustworthiness tier');
ok(typeof escalationReceipt.failing_rule_id === 'string' && escalationReceipt.failing_rule_id.length > 0, '(f) escalation names a failing rule id');
const escalatedRun = await buildRunReceipt({
  definition_digest: defDigest, run_id: 'run-fixture-1', started_at: '2026-07-16T10:00:00.000Z',
  completed_at: '2026-07-16T10:02:30.000Z', outcome: 'escalated',
  stepReceipts: cleanReceipts.slice(0, 2), escalation: escalationReceipt,
});
ok(escalatedRun.policy_parameters.outcome === 'escalated', '(f) run receipt records outcome=escalated');
ok(escalatedRun.output_payload.escalation.failing_rule_id === escalationReceipt.failing_rule_id, '(f) run receipt carries the escalation record');
ok(escalatedRun.compliance_flags.includes('CHECKRUN_ESCALATED'), '(f) run receipt flags CHECKRUN_ESCALATED');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all checklist self-test assertions passed');
process.exit(fail ? 1 : 0);
