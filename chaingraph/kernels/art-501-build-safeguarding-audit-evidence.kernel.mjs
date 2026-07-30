/**
 * art-501-build-safeguarding-audit-evidence.kernel.mjs
 * Assurance Waves programme (SAFEGUARDING-CASS15-BUILD-SPEC.md §3, CASS15-K-2) — the UK CASS 15
 * safeguarding audit evidence pack, and the FIRST CONSUMER of the SPEC.md §27.4 attested-artifact
 * subject class.
 *
 * WHAT THIS ASSEMBLES. The evidence set a qualified auditor asks a payment or e-money firm for at
 * the start of a safeguarding audit: the reconciliation results across the audit period, the
 * safeguarding method classification, a schedule of the matters those two raise, and the §27
 * accountability trail over the firm's own reconciliation export. It assembles what the firm
 * already holds. It computes no new safeguarding arithmetic of its own.
 *
 * IT IS NOT A FILING, AND NOTHING HERE SAYS IT IS (SPEC.md §27.7). An approval record is evidence
 * OF a human act, never a claim of regulator acceptance. This pack is not submittable to the FCA,
 * it does not reproduce the prescribed report as a fillable filing, and it does not discharge the
 * audit. It is evidence assembled FOR THE ENGAGEMENT, and the auditor's report remains the
 * auditor's to write.
 *
 * THIS TOOL EXPRESSES NO AUDIT OPINION. The report the auditor produces carries two opinions:
 * whether the firm maintained systems adequate to enable it to comply throughout the period, and
 * whether the firm was in compliance at the period end. Both are emitted here as OPEN SLOTS with
 * outcome `not_expressed_by_this_tool`, naming who decides. A tool that filled them in would be
 * pretending to be the auditor.
 *
 * THE SUBJECT COMES FROM art-502, AND IS NOT RECOMPUTED HERE. The firm's reconciliation export is a
 * non-OCG producer's sealed output, so its §27.4 subject identifier is computed by
 * art-502-bind-attested-subject on the ONE canonical path,
 * sha256(JCS({tool_ref, inputs_digest, artifact})). This kernel CONSUMES that node's output_payload
 * as an input and echoes it verbatim. It deliberately does NOT re-derive subject_hash: a second
 * implementation of that preimage would be a second canon, which §27.4 forbids, and the binding is
 * independently verifiable against art-502 from the echoed preimage alone. `subject_recomputed_here`
 * is emitted as `false` so a reader is never left guessing which surface computed the identifier.
 *
 * §27.4's LIMIT CARRIES THROUGH UNCHANGED. An attested-artifact subject evidences producer pinning,
 * input binding and content integrity. It NEVER evidences that the arithmetic inside the firm's
 * export is correct. This artifact therefore OMITS `replay_verified` entirely rather than setting it
 * `false` -- no replay was attempted, and `false` would read as a replay that was attempted and
 * disagreed. The limit is carried in output_payload so a consumer holding only the artifact sees it.
 *
 * VOCABULARY IS THE INCUMBENT'S (adoption test 3). Period fields, the two opinion slots, the
 * reasonable-assurance basis, and an exception schedule keyed BY RULE REFERENCE with a management
 * response against each item follow the structure of the CASS assurance report the safeguarding
 * engagement uses, so the output pastes into the engagement's own names rather than ours. The
 * safeguarding figures keep the Handbook names art-499 and art-500 already emit.
 *
 * NOT A BREACH RECORD (SAFEGUARDING-CASS15-BUILD-SPEC.md §6). The schedule below lists MATTERS FOR
 * THE AUDITOR'S ATTENTION derived from the supplied results. It is deliberately not called a breach
 * schedule and records no breach: whether any of these is a breach of CASS 15 is for the firm's
 * records and its safeguarding auditor, never for this tool.
 *
 * NO CLOCK ANYWHERE. Period dates and every as-of date are caller inputs; date comparison is ISO
 * yyyy-mm-dd string comparison, so no Date parsing, no timezone drift and no wall-clock read occurs.
 * The artifact carries no `last_reviewed` and no `valid_until` derived from now plus a window.
 * Because there is no clock, a §27.5 override's expiry CANNOT be evaluated here, so an override
 * record NEVER satisfies a required role and is reported instead -- absent evidence holds, and a
 * timeout can never resolve to a silent auto-pass through this surface.
 *
 * THE §27 STRUCTURAL CHECKS BELOW ARE THE INLINE TWIN OF `_hagate.mjs`, NOT A SECOND SEMANTICS.
 * `_isConformantEvidence` and `_distinctIdentities` mirror that module's exported functions exactly;
 * they are inlined for the same reason `_cgCanon` is inlined in art-502 -- the §18 zkVM guest cannot
 * import, and compute() must stay self-contained and synchronous (the art-476 FIX-2 lesson,
 * board/RIDER-KERNEL.md). Cryptographic verification of a §16 proof is NOT performed here; as in
 * `_hagate.mjs` this is a STRUCTURAL check that a record carries an eddsa-jcs-2022 whole-artifact
 * proof bound to its own identity.
 *
 * FINITE GATE. An empty reconciliation set, an absent subject, an empty record set and a missing
 * period each resolve to a DEFINED result. No branch emits NaN, Infinity or an undefined verdict.
 *
 * §28 CLAUSE BINDING (profile `ocg-clause-binding@1`): every rule reference this pack relies on is
 * emitted as a §1.2 pinned citation OBJECT inside output_payload, so it sits inside the
 * execution_hash preimage. No bare-year citation: every object carries a full ISO `in_force_from`.
 *
 * NO COVERAGE RATIO IS PUBLISHED (§0.7). Counts only, never a proportion of anything.
 *
 * PII: opaque firm, account and stream references and identity identifiers only. No customer names,
 * no account numbers, no document content. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: SAFEGUARDING-CASS15-BUILD-SPEC.md §3 + §5 · HA-ATTESTED-SUBJECT-BUILD-SPEC.md §1/§2 ·
 * SPEC.md §27.2/§27.4/§27.7/§27.8.
 * Regime facts re-verified against FCA primary source on 2026-07-30 (STEP-0): handbook.fca.org.uk
 * CASS 15.8 (in force 2026-05-07), SUP 3A (safeguarding audit), and the client assets report
 * structure at SUP 3.10.5R / SUP 3.10.9AR that the safeguarding assurance report follows.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-501-build-safeguarding-audit-evidence';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'build_safeguarding_audit_evidence', mandate_type: 'compliance_mandate', gpu: false };

/**
 * §28 pinned citation objects (profile `ocg-clause-binding@1`, §1.2 required members).
 * `in_force_from` is the commencement date of the strengthened regime confirmed in PS25/12.
 * A bare year would not satisfy `in_force_from`; these are full ISO dates by construction.
 */
const CITE_MAPPED_BY = 'AINumbers CASS15-K-2';
const CITE_MAPPED_AT = '2026-07-30';
const IN_FORCE_FROM = '2026-05-07';
const CASS15_URI = 'https://handbook.fca.org.uk/handbook/cass15/cass15s8';
const SUP3A_URI = 'https://handbook.fca.org.uk/handbook/SUP/3A/';
function cite(id, uri) {
  return { scheme: 'fca-handbook', id, in_force_from: IN_FORCE_FROM, mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT, uri };
}
const CITATIONS = {
  safeguarding_audit: cite('SUP 3A', SUP3A_URI),
  safeguarding_resource: cite('CASS 15.8.26R', CASS15_URI),
  safeguarding_requirement: cite('CASS 15.8.29G', CASS15_URI),
  internal_frequency: cite('CASS 15.8.19R', CASS15_URI),
  external_frequency: cite('CASS 15.8.42R', CASS15_URI),
  discrepancy_treatment: cite('CASS 15.8.50R', CASS15_URI),
};

/** The rule and field-set version pinned in the artifact AND rendered on screen (adoption test 4). */
const RULESET = {
  ruleset_id: 'FCA-CASS15-PS25-12',
  ruleset_label: 'FCA CASS 15 safeguarding rules, as made by PS25/12',
  in_force_from: IN_FORCE_FROM,
  field_set_version: '1.0.0',
  sourced_from: 'handbook.fca.org.uk',
  sourced_on: CITE_MAPPED_AT,
};

/**
 * The engagement's own report vocabulary (adoption test 3). The safeguarding assurance report is a
 * reasonable assurance engagement carrying two opinions and an exception schedule keyed by rule
 * reference with a management response against each item, following the client assets report
 * structure. THESE ARE SLOT DEFINITIONS ONLY -- this tool fills in neither opinion.
 */
const PERMITTED_OPINION_OUTCOMES = ['unmodified', 'qualified', 'adverse'];
const OPINION_SLOTS = [
  {
    opinion_ref: 'systems_adequacy_throughout_period',
    opinion_question: 'Whether the firm maintained systems adequate to enable it to comply with the safeguarding rules throughout the audit period.',
  },
  {
    opinion_ref: 'compliance_at_period_end',
    opinion_question: 'Whether the firm was in compliance with the safeguarding rules at the date as at which the report is made.',
  },
];
const REPORT_VOCABULARY = {
  assurance_basis: 'reasonable_assurance',
  opinion_refs: OPINION_SLOTS.map((o) => o.opinion_ref),
  permitted_opinion_outcomes: PERMITTED_OPINION_OUTCOMES,
  exception_schedule_key: 'rule_reference',
  management_response_required_per_item: true,
  vocabulary_basis: 'The safeguarding assurance report is a reasonable assurance engagement stating two opinions, systems adequacy throughout the period and compliance at the period end, with exceptions listed against the individual rule reference and a management response recorded against each item. This pack uses those names so its output pastes into the engagement rather than into a format we invented.',
  sourced_from: 'handbook.fca.org.uk',
  sourced_on: CITE_MAPPED_AT,
};

/** Who decides the things this tool deliberately leaves open. */
const AUDITOR_DECIDES = 'The safeguarding auditor appointed for the engagement, on the firm\'s own books and records. This tool does not decide it.';
const FIRM_DECIDES = 'The firm, from its own books and records. This tool does not decide it.';

/** The three roles the pack's accountability trail requires over the attested subject (§27.1). */
const REQUIRED_ROLES = [
  { role: 'preparer', held_by: 'The firm officer who prepared the reconciliation export.' },
  { role: 'reviewer', held_by: 'The qualified auditor engaged to review it.' },
  { role: 'approver', held_by: 'The firm officer with legally effective sign-off.' },
];

const MINOR_UNIT_EXPONENT = 2;

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function strOrNull(v) { return isNonEmptyString(v) ? v.trim() : null; }
/** ISO yyyy-mm-dd shape check only. No Date parsing, so no clock and no timezone drift. */
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
/** ISO yyyy-mm-dd sorts correctly as a plain string, so range tests need no date arithmetic. */
function withinPeriod(d, start, end) {
  if (d === null) return false;
  if (start !== null && d < start) return false;
  if (end !== null && d > end) return false;
  return true;
}
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

/**
 * Structural (non-cryptographic) §27.2 signed-named-human check. INLINE TWIN of
 * `_hagate.mjs` isConformantEvidence -- same rule, inlined because the §18 guest cannot import.
 * This does NOT verify signature bytes; it checks that a §16 eddsa-jcs-2022 whole-artifact proof is
 * present and that its verificationMethod is bound to the record's own identity.
 */
function _isConformantEvidence(record) {
  const proof = obj(obj(record).audit_signature).proof;
  if (!proof || typeof proof !== 'object') return false;
  const vm = typeof proof.verificationMethod === 'string' ? proof.verificationMethod : '';
  const id = strOrNull(obj(record).identity && record.identity.id);
  if (!id) return false;
  return proof.cryptosuite === 'eddsa-jcs-2022' && vm.indexOf(id) === 0;
}

/**
 * §27.3 distinctness: count DISTINCT `identity.id`, never records and never keys. One human rotating
 * keys, or signing twice, counts once. INLINE TWIN of `_hagate.mjs` distinctApprovers.
 */
function _distinctIdentities(records) {
  const seen = [];
  for (const r of records) {
    const id = strOrNull(obj(r).identity && r.identity.id);
    if (id && seen.indexOf(id) === -1) seen.push(id);
  }
  return seen;
}

/** An identity is an agent only when it says so; §27.8 turns on the declaration, never on a guess. */
function _isAgentIdentity(record) {
  const identity = obj(obj(record).identity);
  return identity.actor_type === 'agent';
}
/** §27.8: an agent satisfies a human role ONLY under an explicit human-role mandate. */
function _hasHumanRoleMandate(record) {
  return obj(record).human_role_mandate !== undefined && obj(record).human_role_mandate !== null;
}

export function compute(pp) {
  pp = pp || {};

  // ── Audit period. Caller-supplied ISO dates; an unparseable or absent bound is reported, never
  //    substituted from a clock. ────────────────────────────────────────────────────────────────
  const periodIn = obj(pp.audit_period);
  const period_start_date = isoDateOrNull(periodIn.start_date);
  const period_end_date = isoDateOrNull(periodIn.end_date);
  const period_bounds_present = period_start_date !== null && period_end_date !== null;
  const period_order_valid = !period_bounds_present || period_start_date <= period_end_date;
  const audit_period = {
    start_date: period_start_date,
    end_date: period_end_date,
    bounds_present: period_bounds_present,
    order_valid: period_order_valid,
  };

  const firm_ref = str(pp.firm_ref, 'UNSTATED');

  // ── The attested subject, CONSUMED from art-502 and never recomputed here. ───────────────────
  const subjIn = obj(pp.attested_subject);
  const subject_hash = strOrNull(subjIn.subject_hash);
  const subject = {
    subject_hash,
    subject_preimage: subjIn.subject_preimage !== undefined ? subjIn.subject_preimage : null,
    producer_pinned: subjIn.producer_pinned === true,
    binding_complete: subjIn.binding_complete === true,
    inputs_digest_source: str(subjIn.inputs_digest_source, 'absent'),
    binding_source_tool_id: 'art-502-bind-attested-subject',
    subject_recomputed_here: false,
    subject_class: 'attested_artifact',
  };

  // ── Reconciliation results across the period (art-499 output payloads, or the same field names
  //    lifted from the firm's own export). Nothing is re-derived; the supplied verdict governs. ──
  const reconciliation_days = arr(pp.reconciliation_results).map((raw, i) => {
    const r = obj(raw);
    const as_of_date = isoDateOrNull(r.as_of_date);
    const verdict = str(r.verdict, 'unstated');
    return {
      entry_ref: str(r.entry_ref, `RECON-${i + 1}`),
      as_of_date,
      reconciliation_type: str(r.reconciliation_type, 'unstated'),
      verdict,
      difference_direction: str(r.difference_direction, 'unstated'),
      difference_display: str(r.difference_display, null),
      safeguarding_requirement_display: str(r.safeguarding_requirement_display, null),
      safeguarding_resource_display: str(r.safeguarding_resource_display, null),
      currency: str(r.currency, 'GBP'),
      within_period: withinPeriod(as_of_date, period_start_date, period_end_date),
      date_stated: as_of_date !== null,
    };
  });

  const reconciled_count = reconciliation_days.filter((d) => d.verdict === 'reconciled').length;
  const shortfall_count = reconciliation_days.filter((d) => d.verdict === 'shortfall').length;
  const excess_count = reconciliation_days.filter((d) => d.verdict === 'excess').length;
  const unstated_verdict_count = reconciliation_days.filter((d) => d.verdict === 'unstated').length;
  const outside_period_count = reconciliation_days.filter((d) => d.date_stated && !d.within_period).length;
  const undated_count = reconciliation_days.filter((d) => !d.date_stated).length;

  const reconciliation_summary = {
    entry_count: reconciliation_days.length,
    reconciled_count,
    shortfall_count,
    excess_count,
    unstated_verdict_count,
    outside_period_count,
    undated_count,
    entries: reconciliation_days,
  };

  // ── Method classification (art-500 output payload), echoed as supplied. ──────────────────────
  const methodIn = obj(pp.method_classification);
  const method_supplied = pp.method_classification !== undefined && pp.method_classification !== null;
  const method_summary = {
    supplied: method_supplied,
    classification_verdict: str(methodIn.classification_verdict, 'NOT_SUPPLIED'),
    stream_count: Number.isSafeInteger(methodIn.stream_count) ? methodIn.stream_count : 0,
    coherent_count: Number.isSafeInteger(methodIn.coherent_count) ? methodIn.coherent_count : 0,
    incoherent_count: Number.isSafeInteger(methodIn.incoherent_count) ? methodIn.incoherent_count : 0,
    open_judgment_count: Number.isSafeInteger(methodIn.open_judgment_count) ? methodIn.open_judgment_count : 0,
    audit_exemption_indicator: methodIn.audit_exemption_indicator !== undefined ? methodIn.audit_exemption_indicator : null,
  };

  // ── Exception schedule: MATTERS FOR THE AUDITOR'S ATTENTION, keyed by rule reference, with a
  //    management response slot per item (the engagement's own structure). NOT a breach record. ──
  const supplied_responses = obj(pp.management_responses);
  const exception_schedule = [];
  function addException(source_tool, rule_reference, matter, resolving_input, decided_by, context) {
    const item_ref = `EX-${exception_schedule.length + 1}`;
    exception_schedule.push({
      item_ref,
      source_tool,
      rule_reference,
      matter,
      resolving_input,
      decided_by,
      context: context === undefined ? null : context,
      management_response: strOrNull(supplied_responses[item_ref]),
      management_response_present: strOrNull(supplied_responses[item_ref]) !== null,
      classification: 'matter_for_the_auditor',
    });
  }

  for (const d of reconciliation_days) {
    if (d.verdict === 'shortfall' || d.verdict === 'excess') {
      addException(
        'art-499-check-safeguarding-reconciliation',
        CITATIONS.discrepancy_treatment.id,
        `A reconciliation on ${d.as_of_date === null ? 'an unstated date' : d.as_of_date} resolved to ${d.verdict} beyond the tolerance declared for it.`,
        'The firm\'s reconciliation working papers for that date, and the record of the action taken on the difference.',
        AUDITOR_DECIDES,
        { entry_ref: d.entry_ref, as_of_date: d.as_of_date, difference_display: d.difference_display, currency: d.currency },
      );
    }
    if (!d.date_stated) {
      addException(
        'art-499-check-safeguarding-reconciliation',
        CITATIONS.internal_frequency.id,
        'A reconciliation result was supplied without an as-of date, so it cannot be placed inside or outside the audit period.',
        'The as-of date of the reconciliation this result came from.',
        FIRM_DECIDES,
        { entry_ref: d.entry_ref },
      );
    } else if (!d.within_period && period_bounds_present) {
      addException(
        'art-499-check-safeguarding-reconciliation',
        CITATIONS.internal_frequency.id,
        `A reconciliation result dated ${d.as_of_date} falls outside the declared audit period and is carried in the pack as supplied rather than dropped.`,
        'Either a corrected audit period, or confirmation that this result belongs to a different period.',
        FIRM_DECIDES,
        { entry_ref: d.entry_ref, as_of_date: d.as_of_date },
      );
    }
    if (d.verdict === 'unstated') {
      addException(
        'art-499-check-safeguarding-reconciliation',
        CITATIONS.safeguarding_requirement.id,
        'A reconciliation entry was supplied without a verdict, so the pack carries no outcome for it.',
        'The reconciliation verdict for that entry: reconciled, shortfall, or excess.',
        FIRM_DECIDES,
        { entry_ref: d.entry_ref, as_of_date: d.as_of_date },
      );
    }
  }

  for (const det of arr(methodIn.determinations)) {
    const d = obj(det);
    const stream_ref = str(d.stream_ref, 'UNLABELLED');
    for (const f of arr(d.method_findings)) {
      const finding = obj(f);
      if (finding.outcome === 'incoherent') {
        addException(
          'art-500-classify-safeguarding-method',
          str(finding.citation_id, CITATIONS.safeguarding_resource.id),
          `Stream ${stream_ref} carries facts that do not agree with the safeguarding method asserted for it. ${str(finding.basis, '')}`.trim(),
          'The account and instrument documentation for that stream.',
          AUDITOR_DECIDES,
          { stream_ref },
        );
      } else if (finding.outcome === 'judgment_required') {
        addException(
          'art-500-classify-safeguarding-method',
          str(finding.citation_id, CITATIONS.safeguarding_resource.id),
          `Stream ${stream_ref} leaves a question undetermined on the facts supplied. ${str(finding.what_is_undetermined, '')}`.trim(),
          str(finding.resolving_input, 'The input the classifier named as resolving this question.'),
          str(finding.decided_by, AUDITOR_DECIDES),
          { stream_ref },
        );
      }
    }
    const rfd = obj(d.relevant_funds_determination);
    if (rfd.outcome === 'judgment_required') {
      addException(
        'art-500-classify-safeguarding-method',
        str(rfd.citation_id, CITATIONS.safeguarding_requirement.id),
        `Whether stream ${stream_ref} carries relevant funds is undetermined on the facts supplied. ${str(rfd.what_is_undetermined, '')}`.trim(),
        str(rfd.resolving_input, 'The input the classifier named as resolving this question.'),
        str(rfd.decided_by, AUDITOR_DECIDES),
        { stream_ref },
      );
    }
  }

  if (!subject.binding_complete) {
    addException(
      'art-502-bind-attested-subject',
      CITATIONS.safeguarding_audit.id,
      subject_hash === null
        ? 'No attested-artifact subject was supplied, so the pack has nothing for the accountability records to name.'
        : 'The attested-artifact subject binding is incomplete, so the reconciliation export is bound less tightly than the subject class allows.',
      'A complete art-502 binding over the firm\'s reconciliation export: a well-formed producer manifest_digest, an inputs digest, and the sealed output\'s content type and content digest.',
      FIRM_DECIDES,
      { producer_pinned: subject.producer_pinned },
    );
  } else if (!subject.producer_pinned) {
    addException(
      'art-502-bind-attested-subject',
      CITATIONS.safeguarding_audit.id,
      'The producer of the reconciliation export is not pinned, so the binding covers the output but not the tool that made it.',
      'A well-formed manifest_digest for the producer, supplied to art-502.',
      FIRM_DECIDES,
      { producer_pinned: false },
    );
  }

  // ── §27 accountability trail over the attested subject. ──────────────────────────────────────
  const all_records = arr(pp.accountability_records).map((r) => obj(r));
  const for_subject = subject_hash === null
    ? []
    : all_records.filter((r) => strOrNull(r.subject_hash) === subject_hash);
  const foreign_subject_record_count = all_records.length - for_subject.length;

  const override_records = for_subject.filter((r) => r.record_type === 'override');
  const agent_parity_findings = [];
  const trail_by_role = {};
  let roles_satisfied = 0;

  for (const spec of REQUIRED_ROLES) {
    const ofRole = for_subject.filter((r) => r.role === spec.role);
    const approvals = ofRole.filter((r) => r.record_type === 'approval');
    const rejections = ofRole.filter((r) => r.record_type === 'rejection');
    const conformant = approvals.filter((r) => _isConformantEvidence(r));
    const unsigned_count = approvals.length - conformant.length;

    // §27.8 agent parity: an agent NEVER satisfies a human role absent an explicit human-role mandate.
    const counted = [];
    for (const r of conformant) {
      if (_isAgentIdentity(r) && !_hasHumanRoleMandate(r)) {
        agent_parity_findings.push({
          code: 'HA_AGENT_WITHOUT_HUMAN_ROLE_MANDATE',
          role: spec.role,
          identity_id: strOrNull(r.identity && r.identity.id),
          detail: 'An agent identity filed this approval and carries no explicit human-role mandate, so under SPEC.md §27.8 it does not satisfy the role. The record is carried in the pack and is not counted toward the trail.',
        });
      } else {
        counted.push(r);
      }
    }

    const identities = _distinctIdentities(counted);
    const blocked_by_rejection = rejections.length > 0;
    const satisfied = identities.length >= 1 && !blocked_by_rejection;
    if (satisfied) roles_satisfied += 1;

    trail_by_role[spec.role] = {
      role: spec.role,
      held_by: spec.held_by,
      record_count: ofRole.length,
      approval_count: approvals.length,
      unsigned_approval_count: unsigned_count,
      rejection_count: rejections.length,
      counted_identity_count: identities.length,
      counted_identities: identities,
      status: satisfied ? 'satisfied' : 'hold',
      reason: blocked_by_rejection
        ? 'A rejection record is present for this role over this subject, which blocks the role outright.'
        : satisfied
          ? 'At least one signed approval record names a distinct identity in this role over this subject.'
          : unsigned_count > 0
            ? 'Approval records were supplied for this role but none carries a §16 proof bound to the named identity. An unsigned approval record is not conformant §27 evidence, so the role is held rather than passed.'
            : 'No qualifying approval record for this role over this subject. Absent evidence holds; it is never a fall-through pass.',
    };
  }

  // Self-approval: the same identity in both the preparer and approver roles.
  const preparer_ids = trail_by_role.preparer.counted_identities;
  const approver_ids = trail_by_role.approver.counted_identities;
  const self_approval_identities = preparer_ids.filter((id) => approver_ids.indexOf(id) !== -1);
  for (const id of self_approval_identities) {
    agent_parity_findings.push({
      code: 'HA_PREPARER_IS_ALSO_APPROVER',
      role: 'approver',
      identity_id: id,
      detail: 'The same identity appears as both preparer and approver of this subject. The records are counted as supplied, and the concentration is reported here as a matter for the auditor rather than resolved by this tool.',
    });
  }

  const trail_status = roles_satisfied === REQUIRED_ROLES.length ? 'satisfied' : 'hold';
  const accountability_trail = {
    subject_hash,
    required_roles: REQUIRED_ROLES.map((r) => r.role),
    roles_satisfied_count: roles_satisfied,
    roles_required_count: REQUIRED_ROLES.length,
    by_role: trail_by_role,
    status: trail_status,
    record_count_over_subject: for_subject.length,
    foreign_subject_record_count,
    override_record_count: override_records.length,
    override_handling: 'A §27.5 override is time-boxed and its expiry can only be judged against an instant. This kernel reads no clock, so an override record NEVER satisfies a required role here and is reported instead. On expiry an override lapses and the underlying policy reverts; it can never become a silent permanent auto-pass through this surface.',
    distinctness_basis: 'Roles count DISTINCT identity.id (SPEC.md §27.3), never records and never signing keys. One human rotating keys, or signing twice, counts once.',
    agent_parity_findings,
  };

  // ── The two auditor opinions, left OPEN by construction. ─────────────────────────────────────
  const auditor_opinions = OPINION_SLOTS.map((slot) => ({
    opinion_ref: slot.opinion_ref,
    opinion_question: slot.opinion_question,
    outcome: 'not_expressed_by_this_tool',
    permitted_outcomes: PERMITTED_OPINION_OUTCOMES,
    assurance_basis: REPORT_VOCABULARY.assurance_basis,
    decided_by: AUDITOR_DECIDES,
    citation_id: CITATIONS.safeguarding_audit.id,
  }));

  // ── Pack completeness: what an auditor asked for and whether it is here. ─────────────────────
  const evidence_items = [
    { item: 'audit_period', present: period_bounds_present && period_order_valid, detail: 'A declared audit period with a start date and an end date in order.' },
    { item: 'attested_subject', present: subject_hash !== null, detail: 'The §27.4 subject identifier for the firm\'s reconciliation export, computed by art-502.' },
    { item: 'reconciliation_results', present: reconciliation_days.length > 0, detail: 'Reconciliation results across the audit period.' },
    { item: 'method_classification', present: method_supplied, detail: 'The safeguarding method classification for the firm\'s funds streams.' },
    { item: 'accountability_trail', present: trail_status === 'satisfied', detail: 'A signed preparer, reviewer and approver trail over the attested subject.' },
    { item: 'management_responses', present: exception_schedule.length === 0 || exception_schedule.every((e) => e.management_response_present), detail: 'A management response recorded against every item in the exception schedule.' },
  ];
  const missing_items = evidence_items.filter((i) => !i.present).map((i) => i.item);
  const pack_complete = missing_items.length === 0;

  // ── Rationale. ──────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Evidence pack assembled for firm reference ${firm_ref} against ${RULESET.ruleset_label}, in force from ${RULESET.in_force_from}, for the audit period ${period_start_date === null ? 'unstated start' : period_start_date} to ${period_end_date === null ? 'unstated end' : period_end_date}.`);
  if (!period_bounds_present) {
    rationale.push('The audit period is not fully bounded, so no reconciliation result can be placed inside or outside it. Each result is carried as supplied and named in the exception schedule.');
  } else if (!period_order_valid) {
    rationale.push('The declared period start falls after the declared period end. The dates are carried exactly as supplied and are not reordered, because silently repairing a period would change which results appear to belong to it.');
  }
  rationale.push(subject_hash === null
    ? 'No attested-artifact subject was supplied. Nothing in the accountability trail can name a subject, so every role is held.'
    : `The pack is bound to attested-artifact subject ${subject_hash}, computed by ${subject.binding_source_tool_id} on the single canonical §27.4 path. This kernel echoes that identifier and deliberately does not recompute it: a second implementation of the preimage would be a second canon.`);
  rationale.push(`${reconciliation_days.length} reconciliation result${reconciliation_days.length === 1 ? '' : 's'} carried: ${reconciled_count} reconciled, ${shortfall_count} shortfall, ${excess_count} excess. Every verdict is taken as supplied; no safeguarding arithmetic is recomputed here.`);
  rationale.push(method_supplied
    ? `Method classification carried as supplied: ${method_summary.classification_verdict} across ${method_summary.stream_count} stream${method_summary.stream_count === 1 ? '' : 's'}, with ${method_summary.incoherent_count} incoherent and ${method_summary.open_judgment_count} question${method_summary.open_judgment_count === 1 ? '' : 's'} left open.`
    : 'No method classification was supplied, so the pack carries none.');
  rationale.push(exception_schedule.length === 0
    ? 'The supplied results raised no matters for the auditor\'s attention. That is a statement about the figures supplied, not a finding that the firm complied with CASS 15.'
    : `${exception_schedule.length} matter${exception_schedule.length === 1 ? '' : 's'} for the auditor\'s attention listed against the individual rule reference, each with a slot for the firm\'s management response. These are matters raised by the supplied results. None of them is recorded as a breach: whether any is a breach of CASS 15 is for the firm's records and its safeguarding auditor.`);
  rationale.push(trail_status === 'satisfied'
    ? 'Each of the preparer, reviewer and approver roles is named by at least one signed record over this subject, counted by distinct identity.'
    : `The accountability trail is on hold: ${roles_satisfied} of ${REQUIRED_ROLES.length} required roles are satisfied. Absent or unsigned evidence holds and never passes by default.`);
  rationale.push('Neither audit opinion is expressed here. The systems-adequacy and period-end compliance opinions belong to the safeguarding auditor, and this pack leaves both open with the question and the decider named.');
  rationale.push('This pack is evidence assembled for the engagement. It is not a filing, it is not submittable to the FCA, and it does not discharge the audit. An approval record inside it evidences that a named human acted and nothing more.');

  // ── Flags. ──────────────────────────────────────────────────────────────────────────────────
  const compliance_flags = [];
  compliance_flags.push(pack_complete ? 'SAFEGUARDING_AUDIT_EVIDENCE_PACK_COMPLETE' : 'SAFEGUARDING_AUDIT_EVIDENCE_PACK_INCOMPLETE');
  compliance_flags.push(subject.producer_pinned ? 'SAFEGUARDING_AUDIT_EVIDENCE_SUBJECT_PRODUCER_PINNED' : 'SAFEGUARDING_AUDIT_EVIDENCE_SUBJECT_PRODUCER_UNPINNED');
  compliance_flags.push(trail_status === 'satisfied' ? 'HA_TRAIL_SATISFIED' : 'HA_TRAIL_HOLD');
  compliance_flags.push('SAFEGUARDING_AUDIT_OPINION_NOT_EXPRESSED');
  if (subject_hash === null) compliance_flags.push('SAFEGUARDING_AUDIT_EVIDENCE_SUBJECT_ABSENT');
  if (exception_schedule.length > 0) compliance_flags.push('SAFEGUARDING_AUDIT_EXCEPTIONS_PRESENT');
  if (exception_schedule.some((e) => !e.management_response_present)) compliance_flags.push('SAFEGUARDING_AUDIT_MANAGEMENT_RESPONSE_OUTSTANDING');
  if (!period_bounds_present) compliance_flags.push('SAFEGUARDING_AUDIT_PERIOD_UNBOUNDED');
  if (!period_order_valid) compliance_flags.push('SAFEGUARDING_AUDIT_PERIOD_ORDER_INVALID');
  if (outside_period_count > 0) compliance_flags.push('SAFEGUARDING_RESULT_OUTSIDE_AUDIT_PERIOD');
  if (undated_count > 0) compliance_flags.push('SAFEGUARDING_RESULT_UNDATED');
  if (shortfall_count > 0) compliance_flags.push('SAFEGUARDING_SHORTFALL_IN_PERIOD');
  if (excess_count > 0) compliance_flags.push('SAFEGUARDING_EXCESS_IN_PERIOD');
  if (override_records.length > 0) compliance_flags.push('HA_OVERRIDE_PRESENT_NOT_COUNTED');
  if (foreign_subject_record_count > 0) compliance_flags.push('HA_RECORDS_FOR_OTHER_SUBJECTS_IGNORED');
  // Flags are a SET: a finding repeated across roles is one flag, never a count wearing a flag's name.
  for (const f of agent_parity_findings) {
    if (compliance_flags.indexOf(f.code) === -1) compliance_flags.push(f.code);
  }
  if (REQUIRED_ROLES.some((spec) => trail_by_role[spec.role].unsigned_approval_count > 0)) {
    compliance_flags.push('HA_UNSIGNED_APPROVAL_RECORD_NOT_COUNTED');
  }

  const output_payload = {
    ruleset: RULESET,
    report_vocabulary: REPORT_VOCABULARY,
    firm_ref,
    audit_period,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    subject,
    reconciliation_summary,
    method_summary,
    exception_schedule,
    exception_count: exception_schedule.length,
    accountability_trail,
    auditor_opinions,
    evidence_items,
    missing_items,
    pack_complete,
    citations: CITATIONS,
    rationale,
    // §27.4's stated limit, carried in the payload so a consumer holding only the artifact sees it.
    // `replay_verified` is DELIBERATELY ABSENT -- not false. No replay was attempted.
    no_arithmetic_claim: 'The attested-artifact subject this pack is bound to evidences producer pinning, input binding and content integrity. It carries no §18 compute proof and no §16/§17 re-execution claim, and it never evidences that the arithmetic inside the firm\'s reconciliation export is correct. This artifact deliberately omits replay_verified rather than setting it false, because no replay was attempted.',
    not_a_filing: 'This is evidence assembled for a safeguarding audit engagement. It is not a regulatory filing, it is not submittable to the FCA, it does not reproduce the prescribed report as a fillable form, and it does not discharge the audit. An approval record inside it is evidence of a human act, never a claim that any regulator has accepted anything.',
    note: 'Deterministic UK CASS 15 safeguarding audit evidence pack. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It assembles reconciliation results, the safeguarding method classification, a schedule of matters for the auditor keyed by rule reference, and the §27 accountability trail over an attested-artifact subject computed by art-502 and echoed here rather than recomputed. It recomputes no safeguarding arithmetic, records no breach, and expresses neither of the two audit opinions, which belong to the safeguarding auditor. It is not a filing and not legal advice.',
  };

  return { output_payload, compliance_flags };
}

/** §1.4 pointers: every one roots at output_payload, so each cited object is inside the preimage. */
export const CLAUSE_BINDING_POINTERS = Object.keys(CITATIONS).map((k) => ({
  profile: 'ocg-clause-binding@1',
  pointer: `/output_payload/citations/${k}`,
}));

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    clause_bindings: CLAUSE_BINDING_POINTERS,
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
