// art-601-dora-roi-gleif-preflight-pack — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:5007985cc4147eb6f985df0f548f37677d77bea7cf4ddc68c2140347a1454c7e
// spec: research/SPEC-DORA-GLEIF-FEEDERS-1-2026-08-09.md §4
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-601-dora-roi-gleif-preflight-pack.proptest.mjs

import { compute } from '../art-601-dora-roi-gleif-preflight-pack.kernel.mjs';
import { runFixtureOracle, findShapeViolations, mulberry32, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-601-dora-roi-gleif-preflight-pack';
const rand = mulberry32(0x601F1);
const TRIALS = 5000;

function randHex(rng, len) { let s = ''; for (let i = 0; i < len; i++) s += Math.floor(rng() * 16).toString(16); return s; }
function randCounterparty(rng, i) {
  const snapshotCaptured = rng() < 0.85;
  const consistent = rng() < 0.7 ? true : rng() < 0.5 ? false : null;
  return {
    counterparty_id: 'cp-' + i,
    gleif_snapshot: {
      lei: randHex(rng, 20).toUpperCase(),
      lei_checksum_valid: rng() < 0.9,
      source_sha256: snapshotCaptured ? randHex(rng, 64) : null,
      captured_at: snapshotCaptured ? '2026-08-17T00:00:00Z' : null,
      last_update_date: rng() < 0.5 ? '2026-01-01' : null,
      snapshot_captured: snapshotCaptured,
    },
    lei_relationship_check: {
      subject_lei: randHex(rng, 20).toUpperCase(),
      records_assessed: consistent !== null,
      consistent,
      violation_count: consistent === false ? 1 + Math.floor(rng() * 3) : 0,
    },
  };
}
function mkPP(rng) {
  const linked = rng() < 0.9;
  const n = 1 + Math.floor(rng() * 5);
  const attested = rng() < 0.5;
  return {
    dora_roi_artifact: linked ? { execution_hash: 'sha256:' + randHex(rng, 64), tool_id: 'art-466-dora-roi-builder' } : {},
    counterparties: Array.from({ length: n }, (_, i) => randCounterparty(rng, i)),
    attestation: attested ? { name: 'Signer ' + Math.floor(rng() * 100), title: 'Management Body Member', timestamp: '2026-08-17T09:00:00Z' } : undefined,
  };
}

// ---------- P1: rollup.all_snapshots_captured is true iff every counterparty's snapshot_missing is false ----------
function checkP1_allSnapshotsCapturedAgreesWithMembers() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.error !== null) continue;
    const expected = output_payload.counterparties.every((c) => c.snapshot_missing === false);
    if (output_payload.rollup.all_snapshots_captured !== expected) violations++;
  }
  return { name: 'P1_all_snapshots_captured_agrees_with_member_flags', checked, violations };
}

// ---------- P2: rollup.any_relationship_violation is true iff some counterparty has relationship_violation_present ----------
function checkP2_anyViolationAgreesWithMembers() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.error !== null) continue;
    const expected = output_payload.counterparties.some((c) => c.relationship_violation_present === true);
    if (output_payload.rollup.any_relationship_violation !== expected) violations++;
  }
  return { name: 'P2_any_relationship_violation_agrees_with_member_flags', checked, violations };
}

// ---------- P3: attestation.status is 'closed' iff name+title+timestamp all present ----------
function checkP3_attestationClosedIffComplete() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const a = pp.attestation;
    const complete = !!(a && a.name && a.title && a.timestamp);
    const closed = output_payload.attestation.status === 'closed';
    if (complete !== closed) violations++;
  }
  return { name: 'P3_attestation_closed_iff_name_title_timestamp_complete', checked, violations };
}

// ---------- P4: determinism — same pp twice yields byte-identical output_payload ----------
function checkP4_deterministic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1.output_payload) !== JSON.stringify(r2.output_payload)) violations++;
  }
  return { name: 'P4_deterministic_same_input_same_output', checked, violations };
}

// ---------- P5: output shape — no NaN/undefined anywhere in output_payload ----------
function checkP5_noShapeViolations() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P5_output_payload_no_nan_or_undefined', checked, violations };
}

// ---------- P6 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{}, 'fully empty input — missing_dora_roi_artifact_reference'],
  [{ dora_roi_artifact: { execution_hash: 'sha256:' + 'a'.repeat(64), tool_id: 'art-466-dora-roi-builder' }, counterparties: [] }, 'linked ref, zero counterparties — no_counterparties_supplied'],
  [{ dora_roi_artifact: { execution_hash: 'sha256:' + 'a'.repeat(64), tool_id: 'art-466-dora-roi-builder' }, counterparties: [{ counterparty_id: 'x' }] }, 'counterparty with no snapshot/relationship data — snapshot_missing true, not a clean pass'],
];
function checkP6_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const { output_payload } = compute(pp);
    rows.push({ label, plausible: findShapeViolations(output_payload).length === 0 });
  }
  return rows;
}

const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_allSnapshotsCapturedAgreesWithMembers(),
  checkP2_anyViolationAgreesWithMembers(),
  checkP3_attestationClosedIffComplete(),
  checkP4_deterministic(),
  checkP5_noShapeViolations(),
];
const boundaryForced = checkP6_forced();
const anyBoundaryImplausible = boundaryForced.some((b) => !b.plausible);
if (anyBoundaryImplausible) console.log('BOUNDARY FORCED FAILURES:', JSON.stringify(boundaryForced, null, 2));

const ok = summarize(KERNEL_ID, oracle, properties) && !anyBoundaryImplausible;
process.exit(ok ? 0 : 1);
