// OpenChainGraph §27 Human Accountability gate-precondition evaluator (SPEC.md §27.4–27.5).
// SINGLE SOURCE OF TRUTH for "given a step's haGatePolicy + collected human_accountability_records[],
// is this gate satisfied, held, overridden, or rejected". Sits BESIDE `_gateval.mjs` (OCG §21.4 routing
// math) — it does NOT modify that evaluator, does NOT touch `execution_hash` preimages, and does not
// change `chaingraph_version` (§27.0 additivity is sacred). A chain step consults `_gateval.mjs` for
// WHERE control routes; it consults this module for WHETHER a human-accountability precondition on that
// route has been met.
//
// PURE ECMA-262: no Date.now(), no Math.random, no crypto, no I/O. `nowISO` is caller-supplied so the
// evaluator stays deterministic and replayable from a recorded transcript (same discipline as
// `evaluateGate`). Cryptographic proof verification (§16 eddsa-jcs-2022) is NOT performed here — that is
// `_proof.mjs`'s async job (WebCrypto). This module assumes it is handed already-verified records and
// only checks the STRUCTURAL shape of the evidence (§27.2 signed-named-human) plus the §27.3/§27.4/§27.5
// threshold, hold, and override semantics.
//
// Vendored by generate.mjs (worker) + embed/vendor.mjs (embed), same as `_gateval.mjs`, so every
// executing surface (verify.html, workbench, worker MCP tools) shares one evaluator.

// Closed haGatePolicy vocabulary (§27.4). Mirrors the schema $defs/haGatePolicy enum.
export const HA_GATE_POLICIES = Object.freeze([
  'auto_pass', 'review_required', 'dual_control', 'escalate', 'hold', 'reject', 'emergency_override',
]);

// Resolved precondition outcomes this evaluator can return.
export const HA_STATUSES = Object.freeze(['satisfied', 'hold', 'override_active', 'rejected', 'escalate']);

/**
 * Structural (non-cryptographic) §27.2 signed-named-human check: a record carries a §16
 * whole-artifact proof whose verificationMethod is bound to the record's own identity.id.
 * This does NOT verify the signature bytes — call `_proof.mjs` verify()/verifyProofs() for that.
 * @param {object} record
 * @returns {boolean}
 */
export function isConformantEvidence(record) {
  const proof = record?.audit_signature?.proof;
  if (!proof) return false;
  const vm = proof.verificationMethod || '';
  return proof.cryptosuite === 'eddsa-jcs-2022' && typeof vm === 'string' && vm.startsWith(record.identity?.id || ' ');
}

/**
 * Distinct §27.3 identities (`identity.id`) who filed an `approval` record for this role+subject.
 * Distinctness is by identity, never by record count or key — the invariant §27.3 exists to enforce
 * (two approvals from the SAME identity satisfy only N=1, never N=2).
 * @param {Array<object>} records
 * @param {string} role
 * @param {string} subjectHash
 * @param {boolean} requireConformant - when true, only structurally-signed records count (default true)
 * @returns {Set<string>}
 */
export function distinctApprovers(records, role, subjectHash, requireConformant = true) {
  return new Set(
    (records || [])
      .filter((r) => r.record_type === 'approval' && r.role === role && r.subject_hash === subjectHash)
      .filter((r) => !requireConformant || isConformantEvidence(r))
      .map((r) => r.identity?.id)
      .filter(Boolean)
  );
}

export function satisfiesThreshold(records, role, subjectHash, n, requireConformant = true) {
  return distinctApprovers(records, role, subjectHash, requireConformant).size >= n;
}

/** Any `rejection` record for this role+subject blocks the gate outright (§27.2). */
export function hasRejection(records, role, subjectHash, requireConformant = true) {
  return (records || []).some(
    (r) => r.record_type === 'rejection' && r.role === role && r.subject_hash === subjectHash
      && (!requireConformant || isConformantEvidence(r))
  );
}

/**
 * §27.5: is this override record's time-boxed window still open at `nowISO`?
 * An override with no `override.expiry` is never active (malformed — expiry is required by §27.5).
 */
export function isOverrideActive(record, nowISO) {
  if (!record || record.record_type !== 'override' || !record.override?.expiry) return false;
  return Date.parse(nowISO) < Date.parse(record.override.expiry);
}

/** Find the (structurally conformant) active override record for this subject, if any. */
export function findActiveOverride(records, subjectHash, nowISO, requireConformant = true) {
  return (records || []).find(
    (r) => r.record_type === 'override' && r.subject_hash === subjectHash && isOverrideActive(r, nowISO)
      && (!requireConformant || isConformantEvidence(r))
  ) || null;
}

/**
 * §27.5: the policy actually in force right now. An active override applies `emergency_override`;
 * an absent or EXPIRED override reverts to the step's underlying policy — never a silent permanent
 * auto-pass.
 */
export function effectiveGatePolicy(overrideRecord, nowISO, underlyingPolicy) {
  return isOverrideActive(overrideRecord, nowISO) ? 'emergency_override' : underlyingPolicy;
}

/**
 * Evaluate the §27.4 gate-precondition for one step.
 * @param {object} params
 * @param {string} params.gatePolicy - one of HA_GATE_POLICIES (the step's `haGatePolicy`)
 * @param {number} [params.threshold] - N for `dual_control`/`review_required`/`hold` (default 1, or 2 for dual_control)
 * @param {string} params.role - the haRole a satisfying approval record must carry
 * @param {string} params.subjectHash - the sealed artifact's `sha256:` subject hash
 * @param {Array<object>} [params.records] - collected human_accountability_records over this subject
 * @param {string} params.nowISO - caller-supplied clock (determinism; never Date.now() internally)
 * @param {boolean} [params.requireConformant] - require structural §27.2 signature shape (default true)
 * @returns {{status:string, policy_applied:string, satisfied:boolean, matched_identities:string[], reason:string}}
 */
export function evaluateHaGate({ gatePolicy, threshold, role, subjectHash, records = [], nowISO, requireConformant = true }) {
  if (!HA_GATE_POLICIES.includes(gatePolicy)) {
    return { status: 'hold', policy_applied: gatePolicy, satisfied: false, matched_identities: [], reason: `unknown haGatePolicy "${gatePolicy}" — HOLD (never fall through)` };
  }

  // A rejection record is terminal-blocking regardless of declared policy.
  if (hasRejection(records, role, subjectHash, requireConformant)) {
    return { status: 'rejected', policy_applied: gatePolicy, satisfied: false, matched_identities: [], reason: '§27.2 rejection record present for this role+subject' };
  }

  // §27.5: an active time-boxed override takes precedence over the underlying policy.
  const activeOverride = findActiveOverride(records, subjectHash, nowISO, requireConformant);
  const applied = effectiveGatePolicy(activeOverride, nowISO, gatePolicy);
  if (applied === 'emergency_override') {
    return {
      status: 'override_active', policy_applied: applied, satisfied: true,
      matched_identities: activeOverride?.identity?.id ? [activeOverride.identity.id] : [],
      reason: `§27.5 active override (expires ${activeOverride.override.expiry})`,
    };
  }

  switch (gatePolicy) {
    case 'auto_pass':
      return { status: 'satisfied', policy_applied: gatePolicy, satisfied: true, matched_identities: [], reason: 'auto_pass requires no human record' };
    case 'reject':
      return { status: 'rejected', policy_applied: gatePolicy, satisfied: false, matched_identities: [], reason: 'gate policy is unconditional reject' };
    case 'escalate':
      return { status: 'escalate', policy_applied: gatePolicy, satisfied: false, matched_identities: [], reason: 'gate policy routes to the exception path (§22.8.1)' };
    case 'dual_control': {
      const n = Number.isFinite(threshold) ? threshold : 2;
      const distinct = distinctApprovers(records, role, subjectHash, requireConformant);
      const satisfied = distinct.size >= n;
      return {
        status: satisfied ? 'satisfied' : 'hold', policy_applied: gatePolicy, satisfied,
        matched_identities: [...distinct],
        reason: satisfied ? `${distinct.size} distinct "${role}" approvals ≥ N=${n}` : `only ${distinct.size} distinct "${role}" approval(s) — need N=${n}; absent records ⇒ HOLD`,
      };
    }
    case 'review_required':
    case 'hold': {
      const n = Number.isFinite(threshold) ? threshold : 1;
      const distinct = distinctApprovers(records, role, subjectHash, requireConformant);
      const satisfied = distinct.size >= n;
      return {
        status: satisfied ? 'satisfied' : 'hold', policy_applied: gatePolicy, satisfied,
        matched_identities: [...distinct],
        reason: satisfied ? `${distinct.size} distinct "${role}" approval(s) ≥ N=${n}` : `no qualifying "${role}" approval record — absent records ⇒ HOLD, never a fall-through default`,
      };
    }
    default:
      return { status: 'hold', policy_applied: gatePolicy, satisfied: false, matched_identities: [], reason: 'unreachable' };
  }
}
