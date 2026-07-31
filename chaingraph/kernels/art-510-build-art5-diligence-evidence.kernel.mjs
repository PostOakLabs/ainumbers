/**
 * art-510-build-art5-diligence-evidence.kernel.mjs
 * Assurance Waves programme (SECURITISATION-WATERFALL-BUILD-SPEC.md §3, SECZ-K-1) — the Article 5
 * due-diligence evidence record an EU institutional investor is required by law to be able to
 * demonstrate, per position and per period.
 *
 * WHAT THIS RECORDS. For one position over one period: which Article 5 verification and ongoing
 * monitoring duties the investor actually performed, what evidence backs each one, what remains
 * outstanding, and the §27 accountability trail naming who signed each off. It assembles what the
 * investor already holds. It performs none of the duties itself and it recomputes none of the
 * underlying arithmetic.
 *
 * IT NEVER SAYS THE DILIGENCE WAS ADEQUATE (§27.7, and spec §3). Every status here is a statement
 * about EVIDENCE OF A HUMAN ACT: a duty is recorded as performed when the investor says it was
 * performed AND names evidence AND a conformant signed record exists. Whether what was done was
 * sufficient, and whether any supervisor would accept it, is not decided here and is not claimed
 * anywhere in the payload. An approval record evidences that a named human acted, and nothing more.
 *
 * NO COVERAGE RATIO, EVER (spec §3, SAFEGUARDING-CASS15-BUILD-SPEC.md §5). This kernel emits counts
 * and a GAP LIST WITH THE DUTY NAMED. It does not emit a percentage of duties met, a proportion, a
 * score, or any figure that could be read as one. A ratio invites a reader to treat nine duties out
 * of ten as ninety percent compliant, which is exactly the claim this tool refuses to make.
 *
 * `judgment_required` IS NEVER A BARE FLAG. Where a duty cannot be resolved on the facts supplied,
 * the record names WHAT IS UNDETERMINED, WHICH INPUT RESOLVES IT, and WHO DECIDES. A flag alone
 * hands the reader a problem with no route out of it.
 *
 * §28 PINNED CITATIONS ON EVERY DUTY. Each duty carries a §1.2 citation object with `scheme`, `id`,
 * `in_force_from`, `mapped_by` and `mapped_at`, emitted inside output_payload so it sits within the
 * execution_hash preimage. A BARE FOUR-DIGIT YEAR DOES NOT SATISFY `in_force_from`: a caller-supplied
 * citation whose `in_force_from` is not a full ISO date is REJECTED, named in `rejected_citations[]`,
 * and the shipped pinned citation stands in its place. A superseded citation is recorded through
 * `superseded_by` and is NEVER STRIPPED, because a receipt that quietly drops the provision it was
 * written against cannot be read later.
 *
 * THE DUTY SET IS THE ARTICLE 5 PARAGRAPH SET, NOT A MAINTAINED TEMPLATE (spec §1). The duties below
 * are the paragraphs of Article 5 itself, which is primary legislation and changes by amendment
 * rather than by consultation. No Article 7 disclosure template is read, validated or asserted
 * anywhere here, and no field set is checked against an annex. A caller may declare ADDITIONAL duties
 * with their own pinned citations; the shipped set is never presented as exhaustive.
 *
 * NO CLOCK. `as_of_date` and every period date are caller inputs; compute() never reads a clock, and
 * the artifact carries no `last_reviewed` and no `valid_until` derived from now plus a window.
 * Because there is no clock, a §27.5 override's expiry cannot be evaluated here, so an override
 * record NEVER satisfies a sign-off and is reported instead. Absent evidence holds; a timeout can
 * never resolve to a silent auto-pass through this surface.
 *
 * THE §27 STRUCTURAL CHECKS ARE THE INLINE TWIN OF `_hagate.mjs`, NOT A SECOND SEMANTICS.
 * `_isConformantEvidence` and `_distinctIdentities` mirror that module's exported functions exactly;
 * they are inlined because the §18 zkVM guest cannot import and compute() must stay self-contained
 * and synchronous (the art-476 FIX-2 lesson, board/RIDER-KERNEL.md). No signature bytes are verified
 * here: this is a STRUCTURAL check that a record carries an eddsa-jcs-2022 whole-artifact proof bound
 * to its own identity.
 *
 * FINITE GATE. An empty duty declaration set, an absent period, an empty record set and a duty with
 * no evidence each resolve to a DEFINED status. No branch emits NaN, Infinity or an undefined status.
 *
 * CONFIDENTIALITY (spec §4). Securitisation loan-level data is confidential and frequently personal.
 * Nothing here needs it: the record works on opaque position, deal and identity references and on
 * evidence REFERENCES rather than evidence content. Unmapped fields on any supplied object are
 * IGNORED and never echoed into output_payload. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: SECURITISATION-WATERFALL-BUILD-SPEC.md §1/§3/§4 · SAFEGUARDING-CASS15-BUILD-SPEC.md §5 ·
 * SPEC.md §27.2/§27.3/§27.5/§27.7/§27.8/§28.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-510-build-art5-diligence-evidence';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'build_art5_diligence_evidence', mandate_type: 'compliance_mandate', gpu: false };

/**
 * §28 pinned citation objects (profile `ocg-clause-binding@1`, §1.2 required members).
 * The Securitisation Regulation applied from 1 January 2019; the Article 5(1) verification duties as
 * they now read were substituted by Regulation (EU) 2021/557, which applied from 9 April 2021. Both
 * dates are carried as full ISO dates, because a bare year does not satisfy `in_force_from`.
 */
const CITE_MAPPED_BY = 'AINumbers SECZ-K-1';
const CITE_MAPPED_AT = '2026-07-31';
const SECR_IN_FORCE = '2019-01-01';
const AMEND_IN_FORCE = '2021-04-09';
const SECR_URI = 'https://eur-lex.europa.eu/eli/reg/2017/2402/oj';
const AMEND_URI = 'https://eur-lex.europa.eu/eli/reg/2021/557/oj';

function cite(id, in_force_from, uri) {
  return { scheme: 'eu-regulation', id, in_force_from, mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT, uri: uri || SECR_URI };
}
const CITATIONS = {
  art5_1_a_credit_granting: cite('Regulation (EU) 2017/2402 Article 5(1)(a)', AMEND_IN_FORCE, AMEND_URI),
  art5_1_c_risk_retention: cite('Regulation (EU) 2017/2402 Article 5(1)(c)', AMEND_IN_FORCE, AMEND_URI),
  art5_1_e_disclosure: cite('Regulation (EU) 2017/2402 Article 5(1)(e)', AMEND_IN_FORCE, AMEND_URI),
  art5_3_risk_assessment: cite('Regulation (EU) 2017/2402 Article 5(3)', SECR_IN_FORCE),
  art5_4_ongoing_monitoring: cite('Regulation (EU) 2017/2402 Article 5(4)', SECR_IN_FORCE),
  art5_4_b_stress_testing: cite('Regulation (EU) 2017/2402 Article 5(4)(b)', SECR_IN_FORCE),
  art5_4_d_internal_reporting: cite('Regulation (EU) 2017/2402 Article 5(4)(d)', SECR_IN_FORCE),
  art7_investor_report: cite('Regulation (EU) 2017/2402 Article 7(1)(e)', SECR_IN_FORCE),
};

/**
 * The shipped duty set is the Article 5 paragraph set. It is primary legislation, not a maintained
 * template or field set, and it is NEVER presented as exhaustive: a caller may declare additional
 * duties carrying their own pinned citations.
 */
const DUTIES = [
  {
    duty_id: 'verify_credit_granting_standards',
    duty_class: 'verification_before_holding',
    label: 'Verify that the originator or original lender grants credits on the same sound and well-defined criteria it applies to non-securitised exposures.',
    citation_key: 'art5_1_a_credit_granting',
    typical_evidence: 'The originator credit policy, and the investor record of the comparison made against its non-securitised book.',
    decided_by: 'The investor investment or credit function that performed the verification. This tool does not decide it.',
  },
  {
    duty_id: 'verify_risk_retention',
    duty_class: 'verification_before_holding',
    label: 'Verify that the originator, sponsor or original lender retains a material net economic interest of not less than 5 percent and discloses it to institutional investors.',
    citation_key: 'art5_1_c_risk_retention',
    typical_evidence: 'The retention statement in the transaction documents, the retention holder identity, and the retention form relied on.',
    decided_by: 'The investor function that performed the retention verification. This tool does not decide it.',
  },
  {
    duty_id: 'verify_article_7_disclosure',
    duty_class: 'verification_before_holding',
    label: 'Verify that the originator, sponsor or securitisation special purpose entity has made available the information required by Article 7.',
    citation_key: 'art5_1_e_disclosure',
    typical_evidence: 'The reference to where the information was made available, and the investor record of having obtained it. Availability is what is verified; the content of any disclosure template is not assessed here.',
    decided_by: 'The investor function that obtained the information. This tool does not decide it.',
  },
  {
    duty_id: 'assess_risk_characteristics',
    duty_class: 'assessment_before_holding',
    label: 'Carry out a due-diligence assessment enabling the risks of the position to be assessed, covering the risk characteristics of the position and of the underlying exposures, and the structural features of the transaction.',
    citation_key: 'art5_3_risk_assessment',
    typical_evidence: 'The written pre-investment assessment, and the source data and structural analysis it rests on.',
    decided_by: 'The investor function that carried out the assessment. This tool does not decide it.',
  },
  {
    duty_id: 'monitor_ongoing_performance',
    duty_class: 'ongoing_monitoring',
    label: 'Establish written procedures to monitor, on an ongoing basis and for the life of the position, the performance of the position and of the underlying exposures.',
    citation_key: 'art5_4_ongoing_monitoring',
    typical_evidence: 'The written monitoring procedure, and the monitoring output for this period, including any waterfall recomputation performed on the period investor report.',
    decided_by: 'The investor function that operates the monitoring procedure. This tool does not decide it.',
  },
  {
    duty_id: 'perform_stress_tests',
    duty_class: 'ongoing_monitoring',
    label: 'Perform regular stress tests on the cash flows and collateral values supporting the underlying exposures, proportionate to the risk of the position.',
    citation_key: 'art5_4_b_stress_testing',
    typical_evidence: 'The stress test run for this period, its assumptions, and the record of who ran it.',
    decided_by: 'The investor risk function that owns the stress testing. This tool does not decide it.',
  },
  {
    duty_id: 'report_internally',
    duty_class: 'ongoing_monitoring',
    label: 'Ensure internal reporting to the management body so that material risks arising from the position are known and are managed.',
    citation_key: 'art5_4_d_internal_reporting',
    typical_evidence: 'The internal report covering this position and period, and the record of it reaching the management body.',
    decided_by: 'The investor management body, on the report placed before it. This tool does not decide it.',
  },
];

/** Who decides what is deliberately left open. */
const INVESTOR_DECIDES = 'The institutional investor holding the position, from its own records. This tool does not decide it.';

/** The two roles a duty sign-off requires. Distinctness is counted by identity, never by record. */
const REQUIRED_ROLES = ['performer', 'approver'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function strOrNull(v) { return isNonEmptyString(v) ? v.trim() : null; }
/** ISO yyyy-mm-dd shape check only. No Date parsing, so no clock and no timezone drift. */
function isoDateOrNull(v) { return typeof v === 'string' && ISO_DATE.test(v) ? v : null; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

/**
 * §28 citation validation. A citation object is accepted only with a scheme, an id, and an
 * `in_force_from` that is a FULL ISO DATE. A bare four-digit year is rejected by construction.
 * `superseded_by` is carried through when present and is never stripped.
 */
function validateCitation(raw, where, rejected) {
  const c = obj(raw);
  const scheme = strOrNull(c.scheme);
  const id = strOrNull(c.id);
  const in_force_from = strOrNull(c.in_force_from);
  const problems = [];
  if (scheme === null) problems.push('scheme absent');
  if (id === null) problems.push('id absent');
  if (in_force_from === null) {
    problems.push('in_force_from absent');
  } else if (!ISO_DATE.test(in_force_from)) {
    problems.push(/^\d{4}$/.test(in_force_from)
      ? 'in_force_from is a bare four-digit year, which does not satisfy the pinned citation requirement; a full ISO date is required'
      : 'in_force_from is not a full ISO yyyy-mm-dd date');
  }
  if (problems.length > 0) {
    rejected.push({ where, reasons: problems, supplied_id: id, supplied_in_force_from: in_force_from });
    return null;
  }
  const accepted = {
    scheme,
    id,
    in_force_from,
    mapped_by: str(c.mapped_by, CITE_MAPPED_BY),
    mapped_at: str(c.mapped_at, CITE_MAPPED_AT),
  };
  if (isNonEmptyString(c.uri)) accepted.uri = c.uri.trim();
  // A superseded citation is RECORDED, never stripped.
  if (c.superseded_by !== undefined && c.superseded_by !== null) {
    const sup = obj(c.superseded_by);
    accepted.superseded_by = {
      scheme: str(sup.scheme, scheme),
      id: str(sup.id, 'UNSTATED'),
      in_force_from: isoDateOrNull(sup.in_force_from),
      mapped_by: str(sup.mapped_by, CITE_MAPPED_BY),
      mapped_at: str(sup.mapped_at, CITE_MAPPED_AT),
    };
  }
  return accepted;
}

/**
 * Structural (non-cryptographic) §27.2 signed-named-human check. INLINE TWIN of `_hagate.mjs`
 * isConformantEvidence. It does NOT verify signature bytes; it checks that a §16 eddsa-jcs-2022
 * whole-artifact proof is present and that its verificationMethod is bound to the record's identity.
 */
function _isConformantEvidence(record) {
  const proof = obj(obj(record).audit_signature).proof;
  if (!proof || typeof proof !== 'object') return false;
  const vm = typeof proof.verificationMethod === 'string' ? proof.verificationMethod : '';
  const id = strOrNull(obj(record).identity && record.identity.id);
  if (!id) return false;
  return proof.cryptosuite === 'eddsa-jcs-2022' && vm.indexOf(id) === 0;
}

/** §27.3 distinctness: count DISTINCT `identity.id`, never records and never keys. */
function _distinctIdentities(records) {
  const seen = [];
  for (const r of records) {
    const id = strOrNull(obj(r).identity && r.identity.id);
    if (id && seen.indexOf(id) === -1) seen.push(id);
  }
  return seen;
}

/** An identity is an agent only when it says so; §27.8 turns on the declaration, never on a guess. */
function _isAgentIdentity(record) { return obj(obj(record).identity).actor_type === 'agent'; }
/** §27.8: an agent satisfies a human role ONLY under an explicit human-role mandate. */
function _hasHumanRoleMandate(record) {
  return obj(record).human_role_mandate !== undefined && obj(record).human_role_mandate !== null;
}

export function compute(pp) {
  pp = pp || {};
  const rejected_citations = [];

  const position_ref = str(pp.position_ref, 'UNSTATED');
  const deal_ref = str(pp.deal_ref, 'UNSTATED');
  const investor_ref = str(pp.investor_ref, 'UNSTATED');

  const periodIn = obj(pp.period);
  const period_label = str(periodIn.label, str(pp.period_label, 'UNSTATED'));
  const period_start_date = isoDateOrNull(periodIn.start_date);
  const period_end_date = isoDateOrNull(periodIn.end_date);
  const period_bounds_present = period_start_date !== null && period_end_date !== null;
  const period_order_valid = !period_bounds_present || period_start_date <= period_end_date;
  const period = {
    label: period_label,
    start_date: period_start_date,
    end_date: period_end_date,
    bounds_present: period_bounds_present,
    order_valid: period_order_valid,
  };

  // ── Caller declarations, keyed by duty id. Unmapped fields are ignored, never echoed. ──────────
  const declarations = {};
  for (const raw of arr(pp.duty_declarations)) {
    const d = obj(raw);
    const id = strOrNull(d.duty_id);
    if (id !== null) declarations[id] = d;
  }

  // ── Additional duties the caller declares beyond the Article 5 paragraph set. ──────────────────
  const additional = [];
  for (let i = 0; i < arr(pp.additional_duties).length; i++) {
    const d = obj(arr(pp.additional_duties)[i]);
    const duty_id = str(d.duty_id, `ADDITIONAL-${i + 1}`);
    additional.push({
      duty_id,
      duty_class: str(d.duty_class, 'caller_declared'),
      label: str(d.label, 'A duty declared by the caller beyond the Article 5 paragraph set shipped with this tool.'),
      citation_key: null,
      citation_supplied: validateCitation(d.citation, `additional_duties[${i}].citation`, rejected_citations),
      typical_evidence: str(d.typical_evidence, 'As declared by the caller.'),
      decided_by: str(d.decided_by, INVESTOR_DECIDES),
      declaration: declarations[duty_id] !== undefined ? declarations[duty_id] : obj(d.declaration),
    });
  }

  // ── Accountability records, partitioned by duty. ───────────────────────────────────────────────
  const all_records = arr(pp.accountability_records).map((r) => obj(r));
  const override_records = all_records.filter((r) => r.record_type === 'override');
  const agent_parity_findings = [];

  function trailFor(duty_id) {
    const forDuty = all_records.filter((r) => strOrNull(r.duty_id) === duty_id);
    const by_role = {};
    let roles_satisfied = 0;
    for (const role of REQUIRED_ROLES) {
      const ofRole = forDuty.filter((r) => r.role === role);
      const approvals = ofRole.filter((r) => r.record_type === 'approval');
      const rejections = ofRole.filter((r) => r.record_type === 'rejection');
      const conformant = approvals.filter((r) => _isConformantEvidence(r));
      const unsigned_count = approvals.length - conformant.length;

      const counted = [];
      for (const r of conformant) {
        if (_isAgentIdentity(r) && !_hasHumanRoleMandate(r)) {
          agent_parity_findings.push({
            code: 'ART5_AGENT_WITHOUT_HUMAN_ROLE_MANDATE',
            duty_id,
            role,
            identity_id: strOrNull(r.identity && r.identity.id),
            detail: 'An agent identity filed this sign-off and carries no explicit human-role mandate, so under SPEC.md §27.8 it does not satisfy the role. The record is carried and is not counted toward the trail.',
          });
        } else {
          counted.push(r);
        }
      }

      const identities = _distinctIdentities(counted);
      const blocked = rejections.length > 0;
      const satisfied = identities.length >= 1 && !blocked;
      if (satisfied) roles_satisfied += 1;
      by_role[role] = {
        role,
        approval_count: approvals.length,
        unsigned_approval_count: unsigned_count,
        rejection_count: rejections.length,
        counted_identity_count: identities.length,
        counted_identities: identities,
        status: satisfied ? 'satisfied' : 'hold',
        reason: blocked
          ? 'A rejection record is present for this role on this duty, which blocks the role outright.'
          : satisfied
            ? 'At least one signed record names a distinct identity in this role on this duty.'
            : unsigned_count > 0
              ? 'Sign-off records were supplied for this role but none carries a §16 proof bound to the named identity. An unsigned record is not conformant §27 evidence, so the role is held rather than passed.'
              : 'No qualifying signed record for this role on this duty. Absent evidence holds; it is never a fall-through pass.',
      };
    }
    const performer_ids = by_role.performer.counted_identities;
    const approver_ids = by_role.approver.counted_identities;
    const self_approval = performer_ids.filter((id) => approver_ids.indexOf(id) !== -1);
    for (const id of self_approval) {
      agent_parity_findings.push({
        code: 'ART5_PERFORMER_IS_ALSO_APPROVER',
        duty_id,
        role: 'approver',
        identity_id: id,
        detail: 'The same identity performed and approved this duty. The records are counted as supplied, and the concentration is reported here rather than resolved by this tool.',
      });
    }
    return {
      duty_id,
      required_roles: REQUIRED_ROLES,
      roles_satisfied_count: roles_satisfied,
      roles_required_count: REQUIRED_ROLES.length,
      by_role,
      record_count: forDuty.length,
      status: roles_satisfied === REQUIRED_ROLES.length ? 'satisfied' : 'hold',
    };
  }

  // ── Duty evaluation. ──────────────────────────────────────────────────────────────────────────
  function evaluate(spec, i) {
    const decl = obj(spec.declaration !== undefined ? spec.declaration : declarations[spec.duty_id]);

    // Citation: shipped pin, unless the caller supplies a valid override or the duty is caller-declared.
    const overrideKey = `duty_declarations[${spec.duty_id}].citation`;
    const supplied = decl.citation !== undefined && decl.citation !== null
      ? validateCitation(decl.citation, overrideKey, rejected_citations)
      : null;
    const shipped = spec.citation_key !== null ? CITATIONS[spec.citation_key] : null;
    const citation = supplied !== null ? supplied : (spec.citation_supplied !== undefined && spec.citation_supplied !== null ? spec.citation_supplied : shipped);
    const citation_source = supplied !== null
      ? 'caller_supplied'
      : citation === null ? 'absent' : (spec.citation_key !== null ? 'shipped_pin' : 'caller_supplied');

    const evidence = arr(decl.evidence).map((e, j) => {
      const ev = obj(e);
      return {
        evidence_ref: str(ev.evidence_ref, `${spec.duty_id}-EV-${j + 1}`),
        evidence_type: str(ev.evidence_type, 'unstated'),
        description: str(ev.description, 'No description supplied.'),
        dated: isoDateOrNull(ev.dated),
        within_period: isoDateOrNull(ev.dated) !== null && period_bounds_present
          ? isoDateOrNull(ev.dated) >= period_start_date && isoDateOrNull(ev.dated) <= period_end_date
          : null,
      };
    });

    // `judgment_required` is never a bare flag: it names what, which input, and who.
    const jrIn = obj(decl.judgment_required);
    const jrDeclared = decl.judgment_required !== undefined && decl.judgment_required !== null;
    const judgment_required = jrDeclared
      ? {
        what_is_undetermined: str(jrIn.what_is_undetermined, 'The caller declared that a judgment is required on this duty but did not name what is undetermined. That omission is itself the thing to resolve.'),
        resolving_input: str(jrIn.resolving_input, 'Not named by the caller. Name the input that would settle the question.'),
        decided_by: str(jrIn.decided_by, spec.decided_by),
        named_completely: isNonEmptyString(jrIn.what_is_undetermined) && isNonEmptyString(jrIn.resolving_input) && isNonEmptyString(jrIn.decided_by),
      }
      : null;

    const trail = trailFor(spec.duty_id);
    const performed_asserted = decl.performed === true;
    const evidence_present = evidence.length > 0;
    const signed_off = trail.status === 'satisfied';

    let status;
    let status_basis;
    if (citation === null) {
      status = 'citation_unusable';
      status_basis = 'The citation supplied for this duty was rejected, so the duty is carried without a usable pinned provision and is treated as outstanding.';
    } else if (judgment_required !== null) {
      status = 'judgment_required';
      status_basis = 'The caller declared that this duty turns on a question the facts supplied do not settle. What is undetermined, which input resolves it, and who decides are all named.';
    } else if (!performed_asserted) {
      status = 'outstanding';
      status_basis = 'The investor has not declared this duty performed for this position and period. Absent evidence holds; nothing here treats silence as performance.';
    } else if (!evidence_present) {
      status = 'asserted_without_evidence';
      status_basis = 'The duty is declared performed but no evidence reference was supplied, so the record has nothing behind the assertion.';
    } else if (!signed_off) {
      status = 'evidence_unsigned';
      status_basis = 'The duty is declared performed and evidence is named, but the accountability trail is not satisfied, so no conformant signed record shows who stands behind it.';
    } else {
      status = 'performed';
      status_basis = 'The duty is declared performed, evidence is named, and a conformant signed record names both a performer and an approver by distinct identity. This records evidence of a human act. It is not a statement that what was done was adequate.';
    }

    return {
      duty_id: spec.duty_id,
      position: i + 1,
      duty_class: spec.duty_class,
      label: spec.label,
      citation,
      citation_source,
      typical_evidence: spec.typical_evidence,
      performed_asserted,
      evidence,
      evidence_count: evidence.length,
      judgment_required,
      accountability_trail: trail,
      status,
      status_basis,
      decided_by: spec.decided_by,
      performed_note: str(decl.note, null),
    };
  }

  const shippedResults = DUTIES.map((spec, i) => evaluate(spec, i));
  const additionalResults = additional.map((spec, i) => evaluate(spec, DUTIES.length + i));
  const duty_results = shippedResults.concat(additionalResults);

  // ── The gap list. A NAMED LIST, never a ratio (spec §3). ───────────────────────────────────────
  const OUTSTANDING_STATUSES = ['outstanding', 'asserted_without_evidence', 'evidence_unsigned', 'citation_unusable'];
  const outstanding_duties = duty_results
    .filter((d) => OUTSTANDING_STATUSES.indexOf(d.status) !== -1)
    .map((d) => ({
      duty_id: d.duty_id,
      label: d.label,
      citation_id: d.citation === null ? null : d.citation.id,
      status: d.status,
      what_is_missing: d.status === 'outstanding'
        ? 'The duty is not declared performed for this position and period.'
        : d.status === 'asserted_without_evidence'
          ? 'The duty is declared performed but names no evidence.'
          : d.status === 'evidence_unsigned'
            ? 'The duty names evidence but no conformant signed record satisfies both required roles.'
            : 'The citation supplied for this duty was rejected, so the duty has no usable pinned provision.',
      decided_by: d.decided_by,
    }));

  const judgment_duties = duty_results.filter((d) => d.status === 'judgment_required').map((d) => ({
    duty_id: d.duty_id,
    label: d.label,
    citation_id: d.citation === null ? null : d.citation.id,
    what_is_undetermined: d.judgment_required.what_is_undetermined,
    resolving_input: d.judgment_required.resolving_input,
    decided_by: d.judgment_required.decided_by,
  }));

  const performed_count = duty_results.filter((d) => d.status === 'performed').length;
  const duty_count = duty_results.length;

  // ── Rationale. ──────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Article 5 due-diligence evidence recorded for position ${position_ref} on deal ${deal_ref}, held by investor ${investor_ref}, for period ${period_label}${period_bounds_present ? ` running ${period_start_date} to ${period_end_date}` : ''}.`);
  if (!period_bounds_present) {
    rationale.push('The period is not fully bounded, so no piece of evidence can be placed inside or outside it. Each evidence reference is carried with within_period left null rather than guessed.');
  } else if (!period_order_valid) {
    rationale.push('The declared period start falls after the declared period end. The dates are carried exactly as supplied and are not reordered, because silently repairing a period would change which evidence appears to belong to it.');
  }
  rationale.push(`${duty_count} duties are recorded: the ${DUTIES.length} Article 5 paragraph duties shipped with this tool, plus ${additional.length} declared by the caller. The shipped set is the Article 5 paragraph set and is never presented as an exhaustive statement of everything an investor must do.`);
  rationale.push(`${performed_count} of the ${duty_count} duties carry a performance declaration, named evidence, and a signed record naming both a performer and an approver by distinct identity.`);
  rationale.push(outstanding_duties.length === 0
    ? 'No duty is outstanding on the record supplied. That is a statement about what was supplied, not a finding that the investor diligence was adequate.'
    : `${outstanding_duties.length} ${outstanding_duties.length === 1 ? 'duty is' : 'duties are'} outstanding, each named in the gap list with what is missing against it. No proportion or coverage figure is published anywhere in this artifact, because a percentage would invite a reader to treat a partial record as partial compliance.`);
  if (judgment_duties.length > 0) {
    rationale.push(`${judgment_duties.length} ${judgment_duties.length === 1 ? 'duty turns' : 'duties turn'} on a question the facts supplied do not settle. Each names what is undetermined, which input resolves it, and who decides, rather than carrying a bare flag.`);
  }
  if (rejected_citations.length > 0) {
    rationale.push(`${rejected_citations.length} supplied citation${rejected_citations.length === 1 ? ' was' : 's were'} rejected for not carrying a full ISO in_force_from date. A bare four-digit year does not pin a provision to a version, so the shipped pinned citation stands where one exists and the duty is carried as unusable where none does.`);
  }
  if (override_records.length > 0) {
    rationale.push('Override records were supplied. This kernel reads no clock, so a time-boxed override expiry cannot be judged here. No override satisfies a sign-off through this surface; each is carried and reported.');
  }
  rationale.push('Every status here is evidence of a human act. Nothing in this artifact states that the diligence performed was adequate, that any duty was discharged to a supervisor satisfaction, or that any regulator has accepted anything. Those are for the investor and its supervisor.');
  rationale.push('No Article 7 disclosure template is read, validated or asserted anywhere in this tool. Where a duty concerns Article 7 information, what is recorded is that the information was obtained, never an assessment of a template field set.');

  // ── Flags. ──────────────────────────────────────────────────────────────────────────────────
  const compliance_flags = ['ART5_EVIDENCE_RECORDED'];
  if (outstanding_duties.length > 0) compliance_flags.push('ART5_DUTIES_OUTSTANDING');
  if (judgment_duties.length > 0) compliance_flags.push('ART5_JUDGMENT_REQUIRED');
  if (duty_results.some((d) => d.status === 'evidence_unsigned')) compliance_flags.push('ART5_UNSIGNED_SIGNOFF_NOT_COUNTED');
  if (duty_results.some((d) => d.status === 'asserted_without_evidence')) compliance_flags.push('ART5_ASSERTED_WITHOUT_EVIDENCE');
  if (rejected_citations.length > 0) compliance_flags.push('ART5_CITATION_REJECTED');
  if (override_records.length > 0) compliance_flags.push('ART5_OVERRIDE_PRESENT_NOT_COUNTED');
  if (!period_bounds_present) compliance_flags.push('ART5_PERIOD_UNBOUNDED');
  if (!period_order_valid) compliance_flags.push('ART5_PERIOD_ORDER_INVALID');
  if (outstanding_duties.length > 0 || judgment_duties.length > 0) compliance_flags.push('ESCALATION_RAISED');
  // Flags are a SET: a finding repeated across duties is one flag, never a count wearing a flag's name.
  for (const f of agent_parity_findings) {
    if (compliance_flags.indexOf(f.code) === -1) compliance_flags.push(f.code);
  }

  const output_payload = {
    duty_set: {
      duty_set_id: 'EU-SECR-ART5-PARAGRAPHS',
      duty_set_label: 'The duties stated in Article 5 of Regulation (EU) 2017/2402, as amended by Regulation (EU) 2021/557',
      shipped_duty_count: DUTIES.length,
      exhaustive: false,
      exhaustiveness_note: 'This is the Article 5 paragraph set, not a maintained template or field set, and it is not presented as an exhaustive statement of everything an institutional investor must do. A caller may declare additional duties carrying their own pinned citations.',
      field_set_version: '1.0.0',
    },
    position_ref,
    deal_ref,
    investor_ref,
    period,
    duty_count,
    performed_count,
    duty_results,
    outstanding_duties,
    judgment_duties,
    agent_parity_findings,
    override_record_count: override_records.length,
    override_handling: 'A §27.5 override is time-boxed and its expiry can only be judged against an instant. This kernel reads no clock, so an override record NEVER satisfies a sign-off here and is reported instead. On expiry an override lapses and the underlying policy reverts; it can never become a silent permanent auto-pass through this surface.',
    distinctness_basis: 'Roles count DISTINCT identity.id (SPEC.md §27.3), never records and never signing keys. One human rotating keys, or signing twice, counts once.',
    rejected_citations,
    citations: CITATIONS,
    rationale,
    no_ratio_published: 'This artifact publishes counts and a named gap list. It deliberately publishes no coverage ratio, no percentage of duties met and no score, because a proportion invites a reader to treat a partial record as partial compliance.',
    no_adequacy_claim: 'Every status recorded here is evidence OF a human act. Nothing here states that the diligence performed was adequate, that a duty was discharged to any supervisor satisfaction, or that any regulator has accepted anything.',
    not_a_filing: 'This is an evidence record assembled for the investor own file. It is not a regulatory filing, it is not submittable to any competent authority, and it does not discharge Article 5.',
    note: 'Deterministic Article 5 due-diligence evidence record for one securitisation position over one stated period. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It records which duties the investor declares performed, the evidence references behind each, what remains outstanding as a named gap list, and the §27 accountability trail naming who signed each off. It performs none of the duties, recomputes no underlying arithmetic, reads no disclosure template, publishes no coverage ratio, and expresses no view on whether the diligence was adequate. It is not a filing and not legal advice.',
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
