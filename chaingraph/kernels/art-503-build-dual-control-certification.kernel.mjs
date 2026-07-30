/**
 * art-503-build-dual-control-certification.kernel.mjs
 * Assurance Waves programme (GENIUS-CERT-BUILD-SPEC.md §1, GENIUS-K-1) — the REGIME-AGNOSTIC
 * dual-control certification surface, and the first production use of SPEC.md §27.3's
 * `dual_control(2)` threshold construction.
 *
 * WHAT THIS DECIDES. Given a sealed subject, a required §27.1 role and an integer threshold N, it
 * decides whether N DISTINCT named identities have each filed a signed §27.2 approval record over
 * that subject in that role. That is the whole computation. It is threshold counting, and the trap
 * is identity.
 *
 * REGIME-AGNOSTIC BY CONSTRUCTION. `regime_label` is FREE TEXT and is never interpreted. It is
 * echoed so a reader knows which certification the evidence was assembled for, and nothing in this
 * kernel branches on it. There is no enum of statutes here and no statute-specific arithmetic,
 * which is what lets one surface serve a CEO plus CFO certification at N=2, a CEO or COO
 * certification at N=1, and an audit sign-off, without a per-regime node for each.
 *
 * NO RESERVE ARITHMETIC, DELIBERATELY. This surface counts approvals. It computes nothing about
 * what was certified: no reserve composition, no eligible-asset set, no outstanding-token
 * reconciliation, no ratio of any kind. Pinning an asset list to pre-rule commentary is how a node
 * acquires a draft-pinned banner nobody trusts, so that arithmetic is held on final implementing
 * rules and is not attempted here.
 *
 * COUNTING IS BY DISTINCT `identity_id`, NEVER BY KEY AND NEVER BY RECORD (SPEC.md §27.3). One
 * human rotating signing keys counts once. One human signing twice counts once. The collapse is
 * not a silent deduplication: every collapsed identity is reported in
 * `duplicate_identities_collapsed`, with the record hashes and the distinct verification methods
 * that were folded together. "Your two signatures are one person" is the finding a firm cannot get
 * from a signature count, and it is the reason this output is worth reading even when the gate
 * passes.
 *
 * A THRESHOLD OVER FEWER THAN N DISTINCT APPROVERS IS UNSATISFIED AND NEVER AUTO-PASSES. Absent
 * evidence holds. So does malformed evidence: an unstated or non-integer threshold, an unknown
 * role, a missing subject, and an empty record set all resolve to UNSATISFIED with a stated reason
 * rather than falling through to a default.
 *
 * AN UNSIGNED APPROVAL RECORD IS NOT CONFORMANT §27 EVIDENCE (§27.2). Conformance is the structural
 * check `_hagate.mjs` performs: a §16 eddsa-jcs-2022 whole-artifact proof whose verificationMethod
 * is bound to the record's own identity. The caller's `signed` flag is a DECLARATION, not evidence;
 * where it disagrees with the proof actually carried, the record is rejected and the disagreement is
 * named. Rejected records land in `unsigned_records_rejected` rather than being dropped.
 *
 * §27.8 AGENT PARITY IS ENFORCED IN THE VERDICT, NOT MERELY DOCUMENTED. An agent-signed record
 * counts toward a threshold ONLY when a human principal has, in a signed §22 mandate, delegated
 * THAT EXACT role to that agent, and only when the caller's as-of date falls inside the mandate's
 * validity window. Absent any of that, the gate requires a named human and the record is carried
 * uncounted with the specific reason. An agent that prepared the subject can never approve it,
 * mandate or no mandate: an autonomous agent must not be both preparer and approver of its own
 * output.
 *
 * §27.7 BOUNDARY. This evidences that named humans took responsibility for a sealed subject. It is
 * NOT a claim of regulator acceptance, NOT a filing, and NOT an assertion that the certified numbers
 * are correct. A satisfied threshold means N distinct people signed. It means nothing else.
 *
 * NO CLOCK. `as_of_date` is a caller input and the ONLY instant this kernel knows. Mandate windows
 * are compared as ISO yyyy-mm-dd strings, so no Date parsing, no timezone drift and no wall-clock
 * read occurs. With no as-of date supplied, a validity window cannot be evaluated at all, so an
 * agent record is not counted rather than counted optimistically. There is no `last_reviewed` and
 * no `valid_until` derived from now plus a window.
 *
 * A §27.5 OVERRIDE NEVER SATISFIES A THRESHOLD HERE. An override changes which gate policy applies;
 * it does not conjure a distinct human approver. Override records are carried, counted separately
 * and never folded into the distinct-identity count, so a time-boxed record can never resolve to a
 * silent permanent pass through this surface.
 *
 * THE §27 STRUCTURAL CHECKS BELOW ARE THE INLINE TWIN OF `_hagate.mjs`, NOT A SECOND SEMANTICS.
 * `_isConformantEvidence` and `_distinctIdentities` mirror that module's exported functions exactly;
 * they are inlined because the §18 zkVM guest cannot import and compute() must stay self-contained
 * and synchronous (the art-476 FIX-2 lesson, board/RIDER-KERNEL.md). Cryptographic verification of
 * signature bytes is NOT performed here, exactly as in `_hagate.mjs`.
 *
 * NO CITATION IS EMITTED. Every regime this surface serves is named by the caller in free text, and
 * a citation pinned here would be a statutory determination this kernel is not entitled to make.
 * Under the §5 estate rule a citation is a §28 pinned object or there is none; there is none.
 *
 * FINITE GATE. An empty record set, an absent subject, a missing threshold, an unknown role and an
 * absent as-of date each resolve to a DEFINED result. No branch emits NaN, Infinity or an undefined
 * verdict.
 *
 * NO COVERAGE RATIO IS PUBLISHED. Counts only, never a proportion of anything.
 *
 * PII: opaque identity, record and subject references only. No names, no titles, no contact
 * details, no document content. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: GENIUS-CERT-BUILD-SPEC.md §1 · SAFEGUARDING-CASS15-BUILD-SPEC.md §5 ·
 * SPEC.md §27.1/§27.2/§27.3/§27.7/§27.8.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-503-build-dual-control-certification';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'build_dual_control_certification', mandate_type: 'compliance_control', gpu: false };

/** The closed §27.1 role vocabulary. A role outside this set holds the gate, never passes it. */
const HA_ROLES = ['preparer', 'reviewer', 'approver', 'attestor', 'submitter', 'model_owner', 'compliance_officer', 'examiner'];
/** §27.1: an examiner role binding grants inspection, never approval authority. */
const READ_ONLY_ROLES = ['examiner'];

const BOUNDARY = 'This evidences that named humans took responsibility for the subject named here. It carries no claim that a regulator has accepted anything, it does not serve as a filing, and it makes no assertion that the certified numbers are correct. A satisfied threshold means the stated number of distinct identities each filed a signed approval record over this subject in this role, and it means nothing beyond that.';
const NO_ARITHMETIC = 'This surface counts approvals. It computes nothing about what was certified: no reserve composition, no eligible-asset determination, no outstanding-balance reconciliation and no ratio. Whether the certified figures are right is decided by the people who signed and by whoever examines their work, never here.';
const REGIME_IS_FREE_TEXT = 'regime_label is free text supplied by the caller and is never interpreted. Nothing in this computation branches on it, no statute is matched against it, and no citation is emitted for it. It records which certification the evidence was assembled for so a reader is not left guessing.';
const OVERRIDE_HANDLING = 'A section 27.5 override changes which gate policy applies. It does not produce a distinct human approver, so it never satisfies a threshold here. Override records are carried and counted separately and are never folded into the distinct-identity count, which is what stops a time-boxed record resolving to a silent permanent pass.';
const DISTINCTNESS_BASIS = 'Counting is by distinct identity_id (SPEC.md section 27.3), never by record and never by signing key. One human rotating keys counts once, and one human signing twice counts once. Every collapse is reported rather than applied silently.';

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function strOrNull(v) { return isNonEmptyString(v) ? v.trim() : null; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
/**
 * ISO yyyy-mm-dd prefix, or null. Accepts a full ISO timestamp and keeps its date part, so a
 * mandate window expressed as an instant is compared at date granularity. No Date parsing, so no
 * clock is read and no timezone can shift the answer.
 */
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null; }

/**
 * Structural (non-cryptographic) §27.2 signed-named-human check. INLINE TWIN of `_hagate.mjs`
 * isConformantEvidence -- same rule, inlined because the §18 guest cannot import. This does NOT
 * verify signature bytes; it checks that a §16 eddsa-jcs-2022 whole-artifact proof is present and
 * that its verificationMethod is bound to the supplied identity.
 */
function _isConformantEvidence(record, identityId) {
  const proof = obj(obj(record).audit_signature).proof;
  if (!proof || typeof proof !== 'object') return false;
  const vm = typeof proof.verificationMethod === 'string' ? proof.verificationMethod : '';
  if (!identityId) return false;
  return proof.cryptosuite === 'eddsa-jcs-2022' && vm.indexOf(identityId) === 0;
}

/** The verification method a record signed with, for key-rotation reporting. Never counted on. */
function _verificationMethod(record) {
  const proof = obj(obj(record).audit_signature).proof;
  return strOrNull(proof && proof.verificationMethod);
}

/**
 * §27.3 distinctness: DISTINCT `identity_id`, never records and never keys. INLINE TWIN of
 * `_hagate.mjs` distinctApprovers, reduced to the identity projection this surface needs.
 */
function _distinctIdentities(records) {
  const seen = [];
  for (const r of records) {
    const id = strOrNull(obj(r).identity_id);
    if (id && seen.indexOf(id) === -1) seen.push(id);
  }
  return seen;
}

/** An identity is an agent only when it says so; §27.8 turns on the declaration, never on a guess. */
function _isAgent(record) { return str(obj(record).actor_type, 'human') === 'agent'; }

/**
 * §27.8: does this agent record carry a signed human-principal mandate delegating THIS EXACT role,
 * valid at the caller's as-of date? Returns a defined reason on every failure path.
 */
function _mandateVerdict(record, requiredRole, asOfDate) {
  const m = obj(record).delegation_mandate;
  if (m === undefined || m === null) {
    return { accepted: false, code: 'HA_AGENT_WITHOUT_HUMAN_ROLE_MANDATE', detail: 'An agent identity filed this approval and carries no section 22 delegation mandate. Under SPEC.md section 27.8 the gate requires a named human, so the record is carried and is not counted.' };
  }
  const mo = obj(m);
  const granted = strOrNull(mo.granted_role);
  const principal = strOrNull(mo.principal_identity_id);
  const principalType = str(mo.principal_actor_type, 'unstated');
  const validFrom = isoDateOrNull(mo.valid_from);
  const validUntil = isoDateOrNull(mo.valid_until);
  const mandateHash = strOrNull(mo.mandate_hash);

  if (granted === null) {
    return { accepted: false, code: 'HA_AGENT_MANDATE_ROLE_UNSTATED', detail: 'The delegation mandate names no granted role, so it cannot delegate the role this threshold requires. The record is not counted.', mandate_hash: mandateHash };
  }
  if (granted !== requiredRole) {
    return { accepted: false, code: 'HA_AGENT_MANDATE_ROLE_MISMATCH', detail: `The delegation mandate grants the role ${granted}, which is not the role ${requiredRole} this threshold requires. Section 27.8 requires that exact role, so the record is not counted.`, mandate_hash: mandateHash };
  }
  if (principal === null || principalType !== 'human') {
    return { accepted: false, code: 'HA_AGENT_MANDATE_PRINCIPAL_NOT_HUMAN', detail: 'The delegation mandate does not name a human principal. Section 27.8 requires a human principal to have delegated the role, so the record is not counted.', mandate_hash: mandateHash };
  }
  if (!_isConformantEvidence(mo, principal)) {
    return { accepted: false, code: 'HA_AGENT_MANDATE_UNSIGNED', detail: 'The delegation mandate carries no section 16 proof bound to the principal who granted it. An unsigned mandate is not evidence that a human delegated anything, so the record is not counted.', mandate_hash: mandateHash };
  }
  if (validFrom === null || validUntil === null) {
    return { accepted: false, code: 'HA_AGENT_MANDATE_WINDOW_UNBOUNDED', detail: 'The delegation mandate does not state both bounds of its validity window. Section 27.8 requires the delegation to hold within a validity window, and an unbounded delegation cannot be tested, so the record is not counted.', mandate_hash: mandateHash };
  }
  if (asOfDate === null) {
    return { accepted: false, code: 'HA_AGENT_MANDATE_WINDOW_UNTESTABLE', detail: 'No as-of date was supplied, and this surface reads no clock, so the mandate validity window cannot be evaluated. Absent evidence holds, so the record is not counted.', mandate_hash: mandateHash };
  }
  if (asOfDate < validFrom || asOfDate > validUntil) {
    return { accepted: false, code: 'HA_AGENT_MANDATE_EXPIRED_OR_NOT_YET_VALID', detail: `The as-of date ${asOfDate} falls outside the mandate validity window ${validFrom} to ${validUntil}. A delegation that has lapsed or has not begun cannot carry a role, so the record is not counted.`, mandate_hash: mandateHash };
  }
  return { accepted: true, code: 'HA_AGENT_COUNTED_UNDER_HUMAN_MANDATE', detail: `A human principal delegated the role ${requiredRole} to this agent in a signed mandate valid from ${validFrom} to ${validUntil}, and the as-of date ${asOfDate} falls inside it, so the record counts toward the threshold.`, mandate_hash: mandateHash };
}

export function compute(pp) {
  pp = pp || {};

  // ── The certification being evidenced. `regime_label` is free text and is never interpreted. ──
  const regime_label = str(pp.regime_label, 'UNSTATED');
  const certification_ref = str(pp.certification_ref, 'UNSTATED');
  const as_of_date = isoDateOrNull(pp.as_of_date);

  // ── The sealed subject. Either a §4 node output hash or a §27.4 attested-artifact subject. ────
  const subject_hash = strOrNull(pp.subject_hash);
  const subject_class = str(pp.subject_class, 'unstated');
  const subject_is_attested = subject_class === 'attested_artifact';
  const subject = {
    subject_hash,
    subject_present: subject_hash !== null,
    subject_class,
    subject_recomputed_here: false,
    subject_binding_source: subject_is_attested ? 'art-502-bind-attested-subject' : 'the producing node',
    subject_limit: subject_is_attested
      ? 'This subject is a section 27.4 attested artifact. It evidences producer pinning, input binding and content integrity, and it carries no section 18 compute proof and no section 16 or 17 re-execution claim. It never evidences that the arithmetic inside the producer output is correct.'
      : 'The subject identifier is taken as supplied and is not recomputed here. Whether the subject artifact itself verifies is decided where it was sealed, not on this surface.',
  };

  // ── The role and the threshold. Both are checked before anything is counted. ─────────────────
  const required_role = str(pp.required_role, 'UNSTATED');
  const role_known = HA_ROLES.indexOf(required_role) !== -1;
  const role_read_only = READ_ONLY_ROLES.indexOf(required_role) !== -1;
  const role_eligible = role_known && !role_read_only;
  const role_policy = {
    required_role,
    role_known,
    role_read_only,
    role_eligible,
    permitted_roles: HA_ROLES,
    read_only_roles: READ_ONLY_ROLES,
    reason: role_read_only
      ? 'A read-only role grants inspection and never approval authority (SPEC.md section 27.1), so it cannot satisfy a threshold. The gate is unsatisfied.'
      : role_known
        ? 'The required role is one of the closed section 27.1 roles and can carry approval authority.'
        : 'The required role is outside the closed section 27.1 role vocabulary. An unrecognised role holds the gate rather than falling through to a pass.',
  };

  const threshold_raw = pp.threshold_n;
  const threshold_valid = Number.isSafeInteger(threshold_raw) && threshold_raw >= 1;
  const threshold_n = threshold_valid ? threshold_raw : null;
  const threshold_policy = {
    threshold_n,
    threshold_valid,
    threshold_construction: 'in-toto integer threshold, applied per SPEC.md section 27.3: satisfied when at least N distinct identities have each filed a signed approval record naming this role and this subject.',
    dual_control: threshold_valid && threshold_n === 2,
    reason: threshold_valid
      ? `A threshold of ${threshold_n} distinct ${required_role} identities is required over this subject.`
      : 'No usable integer threshold of one or more was supplied. A threshold that cannot be read is unsatisfied; it never falls through to a pass.',
  };

  // ── Triage every supplied record. Nothing is silently dropped. ───────────────────────────────
  const supplied = arr(pp.signatory_records).map((r) => obj(r));
  const prepared_by_in = obj(pp.prepared_by);
  const prepared_by_identity_id = strOrNull(prepared_by_in.identity_id);
  const prepared_by_actor_type = str(prepared_by_in.actor_type, 'unstated');

  const foreign_subject_records_rejected = [];
  const off_role_records_ignored = [];
  const unsigned_records_rejected = [];
  const rejection_records = [];
  const override_records = [];
  const agent_parity_findings = [];
  const counted_records = [];

  for (let i = 0; i < supplied.length; i++) {
    const r = supplied[i];
    const identity_id = strOrNull(r.identity_id);
    const record_hash = strOrNull(r.record_hash);
    const record_ref = record_hash === null ? `RECORD-${i + 1}` : record_hash;
    const record_type = str(r.record_type, 'approval');
    const role = str(r.role, 'unstated');
    const declared_signed = r.signed === true;

    // A record that names a DIFFERENT subject is an integrity finding, not a silent skip.
    const stated_subject = strOrNull(r.subject_hash);
    if (stated_subject !== null && subject_hash !== null && stated_subject !== subject_hash) {
      foreign_subject_records_rejected.push({
        record_ref, identity_id, role, record_type, stated_subject_hash: stated_subject,
        reason: 'This record names a different subject from the one being certified, so it is rejected rather than counted. A record about another artifact is not evidence about this one.',
      });
      continue;
    }

    if (role !== required_role) {
      off_role_records_ignored.push({ record_ref, identity_id, role, record_type, reason: `This record names the role ${role}, not the required role ${required_role}, so it is not relevant to this threshold.` });
      continue;
    }

    if (record_type === 'rejection') {
      rejection_records.push({ record_ref, identity_id, reason: 'A rejection record is present for this role over this subject, which blocks the gate outright (SPEC.md section 27.2).' });
      continue;
    }
    if (record_type === 'override') {
      override_records.push({ record_ref, identity_id, reason: OVERRIDE_HANDLING });
      continue;
    }
    if (record_type !== 'approval') {
      off_role_records_ignored.push({ record_ref, identity_id, role, record_type, reason: `Only an approval record can satisfy a threshold. A record of type ${record_type} is carried and is not counted.` });
      continue;
    }

    // §27.2: unsigned approval records are not conformant evidence.
    if (identity_id === null) {
      unsigned_records_rejected.push({
        record_ref, identity_id: null, role, declared_signed,
        reason: 'The record names no identity, so there is nobody for a signature to bind to and nobody to count. An anonymous approval is not conformant section 27 evidence.',
      });
      continue;
    }
    const conformant = _isConformantEvidence(r, identity_id);
    if (!conformant) {
      unsigned_records_rejected.push({
        record_ref, identity_id, role, declared_signed,
        reason: declared_signed
          ? 'The record declares signed true but carries no section 16 eddsa-jcs-2022 proof bound to the named identity. The declaration is not the evidence, so the record is rejected and the disagreement is reported here.'
          : 'The record carries no section 16 eddsa-jcs-2022 proof bound to the named identity. An unsigned approval record is not conformant section 27 evidence, so it is rejected rather than counted.',
      });
      continue;
    }

    // §27.8: an agent that prepared the subject can never approve it, mandate or no mandate.
    if (_isAgent(r) && prepared_by_identity_id !== null && identity_id === prepared_by_identity_id) {
      agent_parity_findings.push({
        code: 'HA_AGENT_PREPARER_CANNOT_APPROVE', record_ref, identity_id,
        detail: 'This agent identity prepared the subject and also filed an approval over it. An autonomous agent must never be both preparer and approver of its own output (SPEC.md section 27.8), so the record is carried and is not counted. No mandate can cure this.',
      });
      continue;
    }

    // §27.8: an agent counts only under a signed human-principal mandate for THIS role, in window.
    if (_isAgent(r)) {
      const verdict = _mandateVerdict(r, required_role, as_of_date);
      agent_parity_findings.push({ code: verdict.code, record_ref, identity_id, mandate_hash: verdict.mandate_hash === undefined ? null : verdict.mandate_hash, detail: verdict.detail });
      if (!verdict.accepted) continue;
    }

    counted_records.push({ record_ref, identity_id, record_hash, actor_type: str(r.actor_type, 'human'), verification_method: _verificationMethod(r) });
  }

  // ── §27.3 distinctness. Every collapse is reported, never applied silently. ──────────────────
  const counted_identities = _distinctIdentities(counted_records);
  const duplicate_identities_collapsed = [];
  for (const id of counted_identities) {
    const forId = counted_records.filter((r) => r.identity_id === id);
    if (forId.length < 2) continue;
    const methods = [];
    for (const r of forId) { if (r.verification_method !== null && methods.indexOf(r.verification_method) === -1) methods.push(r.verification_method); }
    duplicate_identities_collapsed.push({
      identity_id: id,
      records_supplied: forId.length,
      counted_as: 1,
      record_refs: forId.map((r) => r.record_ref),
      distinct_verification_methods: methods,
      key_rotation_observed: methods.length > 1,
      finding: methods.length > 1
        ? `This identity signed ${forId.length} times using ${methods.length} different verification methods. Different keys are still one person, so the identity counts once toward the threshold.`
        : `This identity filed ${forId.length} approval records over this subject. One human signing twice is still one approver, so the identity counts once toward the threshold.`,
    });
  }

  // ── The verdict. Every failure path is named; none falls through to a pass. ──────────────────
  const distinct_identities_counted = counted_identities.length;
  const blocked_by_rejection = rejection_records.length > 0;
  const threshold_satisfied = subject.subject_present
    && role_eligible
    && threshold_valid
    && !blocked_by_rejection
    && distinct_identities_counted >= threshold_n;

  const shortfall = threshold_valid ? Math.max(0, threshold_n - distinct_identities_counted) : null;

  let verdict_reason;
  if (!subject.subject_present) {
    verdict_reason = 'No subject hash was supplied, so there is nothing for an approval record to be about. The gate is unsatisfied.';
  } else if (!role_eligible) {
    verdict_reason = role_policy.reason;
  } else if (!threshold_valid) {
    verdict_reason = threshold_policy.reason;
  } else if (blocked_by_rejection) {
    verdict_reason = `A rejection record is present for the role ${required_role} over this subject. A rejection blocks the gate outright regardless of how many approvals were filed.`;
  } else if (threshold_satisfied) {
    verdict_reason = `${distinct_identities_counted} distinct ${required_role} identities each filed a signed approval record over this subject, which meets the required threshold of ${threshold_n}.`;
  } else {
    verdict_reason = `Only ${distinct_identities_counted} distinct ${required_role} ${distinct_identities_counted === 1 ? 'identity' : 'identities'} can be counted against a required threshold of ${threshold_n}. A threshold over fewer than N distinct approvers is unsatisfied and does not auto-pass.`;
  }

  const records_summary = {
    supplied_count: supplied.length,
    counted_record_count: counted_records.length,
    distinct_identities_counted,
    duplicate_identity_count: duplicate_identities_collapsed.length,
    unsigned_rejected_count: unsigned_records_rejected.length,
    foreign_subject_rejected_count: foreign_subject_records_rejected.length,
    off_role_ignored_count: off_role_records_ignored.length,
    rejection_record_count: rejection_records.length,
    override_record_count: override_records.length,
    agent_finding_count: agent_parity_findings.length,
  };

  // ── Rationale. ──────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Dual control evidence assembled for certification reference ${certification_ref} under the caller-supplied regime label ${regime_label}. The label is free text and nothing in this computation branches on it.`);
  rationale.push(subject.subject_present
    ? `The certification is bound to subject ${subject_hash}, carried as a ${subject_class === 'unstated' ? 'subject of unstated class' : subject_class} and not recomputed here.`
    : 'No subject was supplied, so no approval record can be tied to a sealed artifact and the gate is held.');
  rationale.push(verdict_reason);
  rationale.push(`${supplied.length} record${supplied.length === 1 ? '' : 's'} supplied: ${counted_records.length} counted, ${unsigned_records_rejected.length} rejected as unsigned, ${foreign_subject_records_rejected.length} rejected for naming another subject, ${off_role_records_ignored.length} not relevant to this role, ${rejection_records.length} rejection, ${override_records.length} override.`);
  if (duplicate_identities_collapsed.length > 0) {
    const rotated = duplicate_identities_collapsed.filter((d) => d.key_rotation_observed).length;
    rationale.push(`${duplicate_identities_collapsed.length} identit${duplicate_identities_collapsed.length === 1 ? 'y' : 'ies'} filed more than one approval and ${duplicate_identities_collapsed.length === 1 ? 'was' : 'were'} collapsed to a single approver each${rotated > 0 ? `, including ${rotated} that signed under more than one verification method` : ''}. Counting is by distinct identity, never by record and never by key.`);
  } else {
    rationale.push('No identity filed more than one counted approval, so no collapse was required. Counting remains by distinct identity rather than by record.');
  }
  if (unsigned_records_rejected.length > 0) {
    rationale.push('An unsigned approval record is not conformant section 27 evidence. Rejected records are listed with their reason rather than dropped, because a firm needs to know which signature it thought it had.');
  }
  if (agent_parity_findings.length > 0) {
    rationale.push('Section 27.8 parity was applied to every agent-filed record. An agent counts toward a threshold only under a signed human-principal mandate delegating this exact role inside a validity window, and an agent that prepared the subject can never approve it.');
  }
  if (override_records.length > 0) {
    rationale.push(OVERRIDE_HANDLING);
  }
  rationale.push(BOUNDARY);
  rationale.push(NO_ARITHMETIC);

  // ── Flags. A finding repeated across records is one flag, never a count wearing a flag's name. ─
  const compliance_flags = [];
  compliance_flags.push(threshold_satisfied ? 'HA_THRESHOLD_SATISFIED' : 'HA_THRESHOLD_UNSATISFIED');
  if (duplicate_identities_collapsed.length > 0) compliance_flags.push('HA_DUPLICATE_IDENTITY_COLLAPSED');
  if (duplicate_identities_collapsed.some((d) => d.key_rotation_observed)) compliance_flags.push('HA_KEY_ROTATION_COLLAPSED_TO_ONE_IDENTITY');
  if (unsigned_records_rejected.length > 0) compliance_flags.push('HA_UNSIGNED_RECORD_REJECTED');
  if (foreign_subject_records_rejected.length > 0) compliance_flags.push('HA_RECORDS_FOR_OTHER_SUBJECTS_REJECTED');
  if (rejection_records.length > 0) compliance_flags.push('HA_REJECTION_RECORD_BLOCKS_GATE');
  if (override_records.length > 0) compliance_flags.push('HA_OVERRIDE_PRESENT_NOT_COUNTED');
  if (!subject.subject_present) compliance_flags.push('HA_SUBJECT_ABSENT');
  if (!role_known) compliance_flags.push('HA_ROLE_NOT_RECOGNISED');
  if (role_read_only) compliance_flags.push('HA_ROLE_IS_READ_ONLY');
  if (!threshold_valid) compliance_flags.push('HA_THRESHOLD_NOT_STATED');
  if (threshold_valid && threshold_n === 2) compliance_flags.push('HA_DUAL_CONTROL_APPLIED');
  if (as_of_date === null) compliance_flags.push('HA_AS_OF_DATE_ABSENT');
  for (const f of agent_parity_findings) {
    if (compliance_flags.indexOf(f.code) === -1) compliance_flags.push(f.code);
  }

  const output_payload = {
    regime: {
      regime_label,
      regime_label_is_free_text: true,
      certification_ref,
      basis: REGIME_IS_FREE_TEXT,
    },
    as_of_date,
    subject,
    role_policy,
    threshold_policy,
    threshold_satisfied,
    distinct_identities_counted,
    threshold_shortfall: shortfall,
    counted_identities,
    counted_records,
    duplicate_identities_collapsed,
    unsigned_records_rejected,
    foreign_subject_records_rejected,
    off_role_records_ignored,
    rejection_records,
    override_records,
    override_handling: OVERRIDE_HANDLING,
    distinctness_basis: DISTINCTNESS_BASIS,
    agent_parity_findings,
    prepared_by: { identity_id: prepared_by_identity_id, actor_type: prepared_by_actor_type },
    records_summary,
    verdict_reason,
    rationale,
    boundary: BOUNDARY,
    no_arithmetic_claim: NO_ARITHMETIC,
    note: 'Deterministic dual control certification evidence. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It decides one thing, whether N distinct named identities each filed a signed approval record over a sealed subject in a required role, and it reports every record it could not count and why. It is regime agnostic: the regime label is free text and no statute is interpreted. It computes nothing about what was certified. It is not a filing and not legal advice.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
