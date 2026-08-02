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
// `_proof.mjs`'s async job (WebCrypto). This module checks the STRUCTURAL shape of the evidence
// (§27.2 signed-named-human) plus the §27.3/§27.4/§27.5 threshold, hold, and override semantics.
//
// §27.11 — IT NO LONGER ASSUMES IT WAS HANDED ALREADY-VERIFIED RECORDS. A structural check is not a
// signature check, so every result carries an `evidence_verification` SIBLING (§27.11.1) saying whether
// the counted records' §16 proofs were cryptographically verified. A caller that CAN verify bytes (an
// async surface with WebCrypto and key material, e.g. verify.html) passes `verdictOf` — a SYNCHRONOUS
// lookup of an already-computed per-record verdict, so this module stays pure and sync. A caller that
// cannot (the §18 guest, an offline reader) passes nothing and honestly reports `structural_only`.
// Per §27.11.3 the gate is an EVIDENCE RECORDER: `structural_only` NEVER converts a met threshold into a
// hold, an error, or a refusal to evaluate. Per §27.11.4 the one case that DOES change counting is a
// proof CHECKED and FAILED — not conformant evidence under §27.2 as already written, so it is excluded
// from every count and the exclusion is reported as `invalid`.
//
// Vendored by generate.mjs (worker) + embed/vendor.mjs (embed), same as `_gateval.mjs`, so every
// executing surface (verify.html, workbench, worker MCP tools) shares one evaluator.

// Closed haGatePolicy vocabulary (§27.4). Mirrors the schema $defs/haGatePolicy enum.
export const HA_GATE_POLICIES = Object.freeze([
  'auto_pass', 'review_required', 'dual_control', 'escalate', 'hold', 'reject', 'emergency_override',
]);

// Resolved precondition outcomes this evaluator can return.
export const HA_STATUSES = Object.freeze(['satisfied', 'hold', 'override_active', 'rejected', 'escalate']);

// Closed §27.11.2 evidence-verification vocabulary. A verifier MUST NOT silently accept an unknown value
// and thereby treat it as `verified`; adding a value IS a spec change.
export const HA_EVIDENCE_VERIFICATION = Object.freeze(['verified', 'structural_only', 'invalid', 'not_applicable']);

/**
 * §27.11 per-record signature verdict, normalised. `verdictOf` is caller-supplied and SYNCHRONOUS —
 * the caller has already run `_proof.mjs` verify() (async) and is handing us the answer.
 * @returns {true|false|undefined} true = proof verified · false = proof CHECKED and FAILED ·
 *   undefined = never checked (no verifier / no key material / no async capability available).
 */
function proofVerdict(record, verdictOf) {
  if (typeof verdictOf !== 'function') return undefined;
  const v = verdictOf(record);
  return v === true ? true : (v === false ? false : undefined);
}

/**
 * The records a given outcome actually rests on, split by §27.11.4.
 * `counted` are structurally conformant AND not proven-bad; `invalid` were CHECKED and FAILED and are
 * therefore excluded from every §27.3 threshold and every §27.5 override, per §27.2 as already written.
 */
function partitionEvidence(records, predicate, requireConformant, verdictOf) {
  const counted = [];
  const invalid = [];
  (records || []).forEach((r) => {
    if (!predicate(r)) return;
    if (requireConformant && !isConformantEvidence(r)) return;
    if (proofVerdict(r, verdictOf) === false) invalid.push(r); else counted.push(r);
  });
  return { counted, invalid };
}

/**
 * §27.11.2: classify what this evaluation can honestly claim about the evidence it rested on.
 * ⛔ Never returns `verified` on absence — absence of a verdict means NO CLAIM was made (§27.11.5).
 * @param {{counted:Array<object>, invalid:Array<object>}} part
 * @param {Function|null} verdictOf
 * @returns {string} one of HA_EVIDENCE_VERIFICATION
 */
export function classifyEvidenceVerification(part, verdictOf) {
  if (part.invalid.length) return 'invalid';                 // §27.11.4 — a checked-and-failed proof.
  if (!part.counted.length) return 'not_applicable';         // §27.11.2 — the outcome counted zero records.
  return part.counted.every((r) => proofVerdict(r, verdictOf) === true) ? 'verified' : 'structural_only';
}

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
 * @param {Function|null} verdictOf - §27.11 per-record signature verdict; a CHECKED-and-FAILED record
 *   is excluded here, not merely annotated (§27.11.4). Omit it and nothing is excluded on this ground.
 * @returns {Set<string>}
 */
export function distinctApprovers(records, role, subjectHash, requireConformant = true, verdictOf = null) {
  return new Set(
    approvalEvidence(records, role, subjectHash, requireConformant, verdictOf).counted
      .map((r) => r.identity?.id)
      .filter(Boolean)
  );
}

/** The §27.3 approval evidence for this role+subject, partitioned per §27.11.4. */
export function approvalEvidence(records, role, subjectHash, requireConformant = true, verdictOf = null) {
  return partitionEvidence(
    records,
    (r) => r.record_type === 'approval' && r.role === role && r.subject_hash === subjectHash,
    requireConformant, verdictOf
  );
}

export function satisfiesThreshold(records, role, subjectHash, n, requireConformant = true, verdictOf = null) {
  return distinctApprovers(records, role, subjectHash, requireConformant, verdictOf).size >= n;
}

/** The §27.2 rejection evidence for this role+subject, partitioned per §27.11.4. */
export function rejectionEvidence(records, role, subjectHash, requireConformant = true, verdictOf = null) {
  return partitionEvidence(
    records,
    (r) => r.record_type === 'rejection' && r.role === role && r.subject_hash === subjectHash,
    requireConformant, verdictOf
  );
}

/** Any `rejection` record for this role+subject blocks the gate outright (§27.2). */
export function hasRejection(records, role, subjectHash, requireConformant = true, verdictOf = null) {
  return rejectionEvidence(records, role, subjectHash, requireConformant, verdictOf).counted.length > 0;
}

/**
 * §27.5: is this override record's time-boxed window still open at `nowISO`?
 * An override with no `override.expiry` is never active (malformed — expiry is required by §27.5).
 */
export function isOverrideActive(record, nowISO) {
  if (!record || record.record_type !== 'override' || !record.override?.expiry) return false;
  return Date.parse(nowISO) < Date.parse(record.override.expiry);
}

/** The §27.5 active-override evidence for this subject, partitioned per §27.11.4. */
export function overrideEvidence(records, subjectHash, nowISO, requireConformant = true, verdictOf = null) {
  return partitionEvidence(
    records,
    (r) => r.record_type === 'override' && r.subject_hash === subjectHash && isOverrideActive(r, nowISO),
    requireConformant, verdictOf
  );
}

/** Find the (structurally conformant) active override record for this subject, if any. */
export function findActiveOverride(records, subjectHash, nowISO, requireConformant = true, verdictOf = null) {
  return overrideEvidence(records, subjectHash, nowISO, requireConformant, verdictOf).counted[0] || null;
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
 * @param {Function} [params.verdictOf] - §27.11 SYNCHRONOUS per-record signature verdict:
 *   `(record) => true | false | undefined`. Supplied by a caller that has ALREADY run the async §16
 *   verifier. Omit it and the evaluation honestly reports `structural_only` — ⛔ never `verified`.
 * @returns {{status:string, policy_applied:string, satisfied:boolean, matched_identities:string[],
 *   evidence_verification:string, reason:string}} `evidence_verification` is a §27.11.1 SIBLING of the
 *   threshold outcome, ⛔ never folded into `status`: a surface MUST report the pair, because
 *   `satisfied` alone conflates "the threshold was met" with "the evidence was verified".
 */
export function evaluateHaGate({ gatePolicy, threshold, role, subjectHash, records = [], nowISO, requireConformant = true, verdictOf = null }) {
  if (!HA_GATE_POLICIES.includes(gatePolicy)) {
    // Nothing was consulted, so nothing is claimed about any evidence (§27.11.2 not_applicable).
    return { status: 'hold', policy_applied: gatePolicy, satisfied: false, matched_identities: [], evidence_verification: 'not_applicable', reason: `unknown haGatePolicy "${gatePolicy}" — HOLD (never fall through)` };
  }

  const rej = rejectionEvidence(records, role, subjectHash, requireConformant, verdictOf);
  const classify = (counted, invalid) => classifyEvidenceVerification({ counted, invalid }, verdictOf);

  // A rejection record is terminal-blocking regardless of declared policy.
  if (rej.counted.length) {
    return { status: 'rejected', policy_applied: gatePolicy, satisfied: false, matched_identities: [], evidence_verification: classify(rej.counted, rej.invalid), reason: '§27.2 rejection record present for this role+subject' };
  }

  // §27.5: an active time-boxed override takes precedence over the underlying policy.
  const ovr = overrideEvidence(records, subjectHash, nowISO, requireConformant, verdictOf);
  const activeOverride = ovr.counted[0] || null;
  // Records excluded by §27.11.4 on paths already consulted — reported even where the surviving
  // outcome counted nothing, since "a proof was checked and failed" is a fact about THIS evaluation.
  const consumedInvalid = rej.invalid.concat(ovr.invalid);
  const applied = effectiveGatePolicy(activeOverride, nowISO, gatePolicy);
  if (applied === 'emergency_override') {
    return {
      status: 'override_active', policy_applied: applied, satisfied: true,
      matched_identities: activeOverride?.identity?.id ? [activeOverride.identity.id] : [],
      evidence_verification: classify([activeOverride], consumedInvalid),
      reason: `§27.5 active override (expires ${activeOverride.override.expiry})`,
    };
  }

  switch (gatePolicy) {
    case 'auto_pass':
      return { status: 'satisfied', policy_applied: gatePolicy, satisfied: true, matched_identities: [], evidence_verification: classify([], consumedInvalid), reason: 'auto_pass requires no human record' };
    case 'reject':
      return { status: 'rejected', policy_applied: gatePolicy, satisfied: false, matched_identities: [], evidence_verification: classify([], consumedInvalid), reason: 'gate policy is unconditional reject' };
    case 'escalate':
      return { status: 'escalate', policy_applied: gatePolicy, satisfied: false, matched_identities: [], evidence_verification: classify([], consumedInvalid), reason: 'gate policy routes to the exception path (§22.8.1)' };
    case 'dual_control':
    case 'review_required':
    case 'hold': {
      const n = Number.isFinite(threshold) ? threshold : (gatePolicy === 'dual_control' ? 2 : 1);
      const app = approvalEvidence(records, role, subjectHash, requireConformant, verdictOf);
      const distinct = new Set(app.counted.map((r) => r.identity?.id).filter(Boolean));
      const satisfied = distinct.size >= n;
      return {
        status: satisfied ? 'satisfied' : 'hold', policy_applied: gatePolicy, satisfied,
        matched_identities: [...distinct],
        evidence_verification: classify(app.counted, consumedInvalid.concat(app.invalid)),
        reason: satisfied
          ? `${distinct.size} distinct "${role}" approval(s) ≥ N=${n}`
          : `only ${distinct.size} distinct "${role}" approval(s) — need N=${n}; absent records ⇒ HOLD, never a fall-through default`,
      };
    }
    default:
      return { status: 'hold', policy_applied: gatePolicy, satisfied: false, matched_identities: [], evidence_verification: 'not_applicable', reason: 'unreachable' };
  }
}
