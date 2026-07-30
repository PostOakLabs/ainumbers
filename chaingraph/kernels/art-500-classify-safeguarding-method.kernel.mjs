/**
 * art-500-classify-safeguarding-method.kernel.mjs
 * Assurance Waves program (SAFEGUARDING-CASS15-BUILD-SPEC.md §2, CASS15-K-1) — UK CASS 15
 * safeguarding METHOD classifier for payment and e-money firms.
 *
 * For each caller-declared funds stream, decides three things and nothing else:
 *   1. whether the supplied funds are RELEVANT FUNDS;
 *   2. whether the METHOD asserted for them (segregation, or insurance or comparable guarantee)
 *      is COHERENT with the account and instrument facts the caller supplied;
 *   3. where the supplied facts do not settle the answer, that it is JUDGMENT REQUIRED.
 *
 * ⭐ THIS IS WHERE FIRMS ACTUALLY GET IT WRONG, so the diagnostic value of the family sits here.
 *
 * A JUDGMENT FLAG IS NEVER BARE. Persona `stephen` F8: a bare judgment flag is insufficient and,
 * in a supervisory setting, worse than not flagging at all, because it tells a reader something is
 * unresolved without telling them how to resolve it. Every `judgment_required` emitted by this
 * kernel is constructed by judgment() and therefore ALWAYS carries three populated members:
 *   `what_is_undetermined`  — the specific question the supplied facts do not answer;
 *   `resolving_input`       — the one input or document that would answer it;
 *   `decided_by`            — who makes that call. It is never this tool.
 * A judgment object that failed to carry all three could not be built, so the shape is guaranteed
 * by construction rather than by a reviewer noticing.
 *
 * SINGLE-RUN AND STATELESS. No schedule, no stored state, no retained data, no recurring duty on
 * anyone but the firm, which already has one under CASS 15.
 *
 * ⛔ WHAT THIS KERNEL DOES NOT DO. It does not determine that a firm has complied with or breached
 * CASS 15, it does not opine on whether an insurance policy or guarantee is legally effective, and
 * a coherence verdict is a consistency check on the facts as supplied, not a validation of them.
 *
 * ⛔ THE TIMING QUESTION IS DELIBERATELY NOT PINNED TO A RULE. CASS 15.3.1G describes the
 * segregation method by reference to regulation 21 of the Electronic Money Regulations and
 * regulations 23(5) to (11) of the Payment Services Regulations, and the receipt-to-segregation
 * deadline lives in those Regulations rather than in the CASS 15.3 text verified for this build.
 * Rather than pin a deadline that was not confirmed against primary source at STEP-0, this kernel
 * reports the caller's declared timing and routes anything other than same-day segregation to
 * judgment_required naming the underlying Regulations as the resolving source.
 *
 * NO CLOCK. `as_of_date` is a caller input. No `last_reviewed`, no clock-derived `valid_until`.
 * PII: opaque stream and account references only. Demo fixture ships SYNTHETIC data only.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: SAFEGUARDING-CASS15-BUILD-SPEC.md §0 + §2 (CASS15-K-1, art-500).
 * Regime facts re-verified against FCA primary source on 2026-07-30 (STEP-0):
 *   handbook.fca.org.uk CASS 15.3 / 15.5 / 15.7 (in force 2026-05-07) and fca.org.uk PS25/12.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-500-classify-safeguarding-method';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'classify_safeguarding_method', mandate_type: 'compliance_mandate', gpu: false };

const CITE_MAPPED_BY = 'AINumbers CASS15-K-1';
const CITE_MAPPED_AT = '2026-07-30';
const IN_FORCE_FROM = '2026-05-07';
function cite(id, uri) {
  return { scheme: 'fca-handbook', id, in_force_from: IN_FORCE_FROM, mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT, uri };
}
const CITATIONS = {
  segregation_method: cite('CASS 15.3.1G', 'https://handbook.fca.org.uk/handbook/cass15/cass15s3'),
  mixed_remittances: cite('CASS 15.3.2R', 'https://handbook.fca.org.uk/handbook/cass15/cass15s3'),
  insurance_or_guarantee_conditions: cite('CASS 15.5.4R', 'https://handbook.fca.org.uk/handbook/cass15/cass15s5'),
  insurance_or_guarantee_provider: cite('CASS 15.5.8R', 'https://handbook.fca.org.uk/handbook/cass15/cass15s5'),
  acknowledgement_letters: cite('CASS 15.7', 'https://handbook.fca.org.uk/handbook/cass15/cass15s7'),
  safeguarding_audit: cite('SUP 3A', 'https://handbook.fca.org.uk/handbook/SUP/3A/'),
};

const RULESET = {
  ruleset_id: 'FCA-CASS15-PS25-12',
  ruleset_label: 'FCA CASS 15 safeguarding rules, as made by PS25/12',
  in_force_from: IN_FORCE_FROM,
  field_set_version: '1.0.0',
  sourced_from: 'handbook.fca.org.uk',
  sourced_on: CITE_MAPPED_AT,
};

/** SUP 3A safeguarding audit exemption threshold, in minor units: £100,000 expressed in pence. */
const AUDIT_EXEMPTION_THRESHOLD_MINOR_UNITS = 10000000;
/** The exemption is expressed over a period of at least 53 weeks. */
const AUDIT_EXEMPTION_MIN_WEEKS = 53;

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

/** The five conditions CASS 15.5.4R places on an insurance policy or comparable guarantee. */
const INSURANCE_CONDITIONS = [
  { key: 'proceeds_payable_on_insolvency_event', label: 'proceeds are payable upon an insolvency event' },
  { key: 'no_conditions_on_prompt_payout', label: 'there is no condition or restriction on prompt payout other than certification of the insolvency event' },
  { key: 'certification_no_more_onerous_than_necessary', label: 'any certification requirement is no more onerous than is practically necessary' },
  { key: 'proceeds_paid_into_relevant_funds_bank_account', label: 'proceeds are to be promptly paid into a relevant funds bank account' },
  { key: 'cancellation_restricted_with_3_months_notice', label: 'the provider cannot cancel before expiry except for non-payment of premium and on at least 3 months notice to the firm and the FCA' },
];

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
function toSafeInt(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) ? v : null; }
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}

/**
 * The ONLY constructor for a judgment_required outcome. All three explanatory members are
 * REQUIRED positional arguments, so a bare judgment flag cannot be produced by this kernel.
 */
function judgment(what_is_undetermined, resolving_input, decided_by, citation_id) {
  return {
    outcome: 'judgment_required',
    what_is_undetermined,
    resolving_input,
    decided_by,
    citation_id: citation_id || null,
  };
}
function determinate(outcome, basis, citation_id) {
  return { outcome, basis, citation_id: citation_id || null };
}

const RELEVANT_CATEGORIES = ['payment_service_relevant_funds', 'emoney_relevant_funds'];
const AUDITOR_AND_FIRM = 'The firm, on the facts in its own books and records. A safeguarding auditor tests that conclusion under SUP 3A. This tool does not decide it.';

function classifyRelevantFunds(funds_category) {
  if (RELEVANT_CATEGORIES.indexOf(funds_category) !== -1) {
    return determinate('relevant', `Declared as ${funds_category}, which the firm has identified as relevant funds.`, null);
  }
  if (funds_category === 'own_funds') {
    return determinate('not_relevant', 'Declared as the firm\'s own funds, so outside the relevant funds the safeguarding requirement is computed over.', null);
  }
  if (funds_category === 'mixed_remittance') {
    return judgment(
      'Which portion of this mixed remittance is relevant funds and which is not. A mixed remittance carries both, and the split cannot be read off the stream-level facts supplied here.',
      'The transaction-level breakdown of the remittance showing the amount received in respect of payment services or the issuance of electronic money, separated from any other amount.',
      AUDITOR_AND_FIRM,
      CITATIONS.mixed_remittances.id,
    );
  }
  return judgment(
    'Whether these funds are relevant funds at all. The funds category supplied was absent or not one this classifier recognises.',
    'A declared funds category for the stream: payment_service_relevant_funds, emoney_relevant_funds, mixed_remittance, or own_funds.',
    AUDITOR_AND_FIRM,
    null,
  );
}

function classifySegregation(s) {
  const findings = [];
  const account = str(s.designated_account_status, 'unknown');
  const ack = str(s.acknowledgement_letter_status, 'unknown');
  const timing = str(s.receipt_to_segregation_timing, 'unknown');

  if (account === 'not_designated') {
    findings.push(determinate('incoherent', 'Segregation is asserted, but the account holding the funds is declared as not being a designated relevant funds bank account. Under the segregation method the funds are held in a relevant funds bank account, so the asserted method and the declared account status do not agree.', CITATIONS.segregation_method.id));
  } else if (account !== 'designated_relevant_funds_bank_account') {
    findings.push(judgment(
      'Whether the account holding these funds is a designated relevant funds bank account. The account status supplied was absent or not recognised, and segregation turns on it.',
      'The account designation as recorded on the bank mandate or account-opening documentation for the account referenced by this stream.',
      AUDITOR_AND_FIRM,
      CITATIONS.segregation_method.id,
    ));
  }

  if (ack === 'not_received') {
    findings.push(determinate('incoherent', 'Segregation is asserted, but the firm declares that no countersigned acknowledgement letter is held for the account. CASS 15.7 requires the acknowledgement letter for an account used to hold relevant funds.', CITATIONS.acknowledgement_letters.id));
  } else if (ack !== 'received_and_countersigned') {
    findings.push(judgment(
      'Whether a countersigned acknowledgement letter is held for the account used for this stream. The acknowledgement letter status supplied was absent or not recognised.',
      'The countersigned acknowledgement letter for the account, or the firm\'s register recording its receipt date.',
      AUDITOR_AND_FIRM,
      CITATIONS.acknowledgement_letters.id,
    ));
  }

  if (timing !== 'same_business_day') {
    findings.push(judgment(
      `Whether the declared receipt-to-segregation timing for this stream (${timing}) meets the segregation deadline. That deadline sits in regulation 21 of the Electronic Money Regulations and regulations 23(5) to (11) of the Payment Services Regulations, which CASS 15.3.1G points to rather than restates, and this tool does not assert a deadline it has not verified against those Regulations.`,
      'The applicable deadline in the Electronic Money Regulations or the Payment Services Regulations for the firm\'s permission type, read against the firm\'s own record of when the funds were received and when they were placed in a relevant funds bank account.',
      AUDITOR_AND_FIRM,
      CITATIONS.segregation_method.id,
    ));
  }

  return findings;
}

function classifyInsuranceOrGuarantee(s) {
  const findings = [];
  const supplied = s.insurance_conditions && typeof s.insurance_conditions === 'object' ? s.insurance_conditions : {};
  for (const cond of INSURANCE_CONDITIONS) {
    const v = supplied[cond.key];
    if (v === false || v === 'false') {
      findings.push(determinate('incoherent', `The insurance or guarantee method is asserted, but the firm declares that this CASS 15.5.4R condition is not met: ${cond.label}.`, CITATIONS.insurance_or_guarantee_conditions.id));
    } else if (v !== true && v !== 'true') {
      findings.push(judgment(
        `Whether this CASS 15.5.4R condition is met: ${cond.label}. It was supplied as absent or unknown, and the method depends on all five conditions holding.`,
        `The executed wording of the insurance policy or guarantee, at the term that governs: ${cond.label}.`,
        AUDITOR_AND_FIRM,
        CITATIONS.insurance_or_guarantee_conditions.id,
      ));
    }
  }
  if (!isNonEmptyString(s.provider_ref)) {
    findings.push(judgment(
      'Which person provides the insurance policy or guarantee for this stream. No provider reference was supplied.',
      'An opaque provider reference for the policy or guarantee, together with the executed instrument it refers to.',
      AUDITOR_AND_FIRM,
      CITATIONS.insurance_or_guarantee_provider.id,
    ));
  }
  return findings;
}

function classifyAuditExemption(pp) {
  const high_water = toSafeInt(pp.relevant_funds_high_water_minor_units);
  const weeks = toSafeInt(pp.weeks_observed);

  if (high_water === null || weeks === null) {
    return judgment(
      'Whether the firm is indicated as exempt from arranging a safeguarding audit. The highest amount of relevant funds the firm has been required to safeguard, or the length of the observation period, was not supplied as an integer.',
      'The highest relevant funds figure the firm has been required to safeguard at any time, in minor units, and the number of whole weeks that figure has been observed over.',
      AUDITOR_AND_FIRM,
      CITATIONS.safeguarding_audit.id,
    );
  }
  if (weeks < AUDIT_EXEMPTION_MIN_WEEKS) {
    return judgment(
      `Whether the safeguarding audit exemption is indicated. The exemption is expressed over a period of at least ${AUDIT_EXEMPTION_MIN_WEEKS} weeks, and only ${weeks} weeks of observation were supplied, so the supplied window is too short to indicate it either way.`,
      `A relevant funds high-water figure observed over at least ${AUDIT_EXEMPTION_MIN_WEEKS} weeks.`,
      AUDITOR_AND_FIRM,
      CITATIONS.safeguarding_audit.id,
    );
  }
  if (high_water <= AUDIT_EXEMPTION_THRESHOLD_MINOR_UNITS) {
    return determinate(
      'audit_exemption_indicated',
      `Over ${weeks} weeks the firm reports never having been required to safeguard more than ${display(high_water)} in relevant funds, which is at or below the ${display(AUDIT_EXEMPTION_THRESHOLD_MINOR_UNITS)} threshold the exemption is expressed against. This is an indicator computed from the figures supplied. Whether the exemption is available to this firm is for the firm and its auditor.`,
      CITATIONS.safeguarding_audit.id,
    );
  }
  return determinate(
    'audit_exemption_not_indicated',
    `Over ${weeks} weeks the firm reports a relevant funds high-water figure of ${display(high_water)}, above the ${display(AUDIT_EXEMPTION_THRESHOLD_MINOR_UNITS)} threshold the exemption is expressed against.`,
    CITATIONS.safeguarding_audit.id,
  );
}

export function compute(pp) {
  pp = pp || {};
  const as_of_date = isoDateOrNull(pp.as_of_date);
  const streams = Array.isArray(pp.streams) ? pp.streams : [];

  const determinations = streams.map((raw, i) => {
    const s = raw && typeof raw === 'object' ? raw : {};
    const stream_ref = str(s.stream_ref, `UNLABELLED-${i + 1}`);
    const funds_category = str(s.funds_category, 'unknown');
    const method_asserted = str(s.method_asserted, 'unknown');

    const relevant_funds_determination = classifyRelevantFunds(funds_category);

    let method_findings;
    if (method_asserted === 'segregation') {
      method_findings = classifySegregation(s);
    } else if (method_asserted === 'insurance_or_guarantee') {
      method_findings = classifyInsuranceOrGuarantee(s);
    } else {
      method_findings = [judgment(
        'Which safeguarding method applies to this stream. The method asserted was absent or not one of the two the rules provide for.',
        'A declared method for the stream: segregation, or insurance_or_guarantee.',
        AUDITOR_AND_FIRM,
        CITATIONS.segregation_method.id,
      )];
    }

    const incoherent_findings = method_findings.filter((f) => f.outcome === 'incoherent');
    const judgment_findings = method_findings.filter((f) => f.outcome === 'judgment_required');

    let method_coherence;
    if (incoherent_findings.length > 0) method_coherence = 'incoherent';
    else if (judgment_findings.length > 0) method_coherence = 'judgment_required';
    else method_coherence = 'coherent';

    return {
      stream_ref,
      funds_category,
      method_asserted,
      relevant_funds_determination,
      method_coherence,
      method_findings,
      incoherence_count: incoherent_findings.length,
      judgment_required_count: judgment_findings.length
        + (relevant_funds_determination.outcome === 'judgment_required' ? 1 : 0),
    };
  });

  const audit_exemption_indicator = classifyAuditExemption(pp);

  const stream_count = determinations.length;
  const coherent_count = determinations.filter((d) => d.method_coherence === 'coherent').length;
  const incoherent_count = determinations.filter((d) => d.method_coherence === 'incoherent').length;
  const judgment_stream_count = determinations.filter((d) => d.judgment_required_count > 0).length;
  let open_judgments = audit_exemption_indicator.outcome === 'judgment_required' ? 1 : 0;
  for (const d of determinations) open_judgments += d.judgment_required_count;

  let classification_verdict;
  if (stream_count === 0) classification_verdict = 'NO_STREAMS_SUPPLIED';
  else if (incoherent_count > 0) classification_verdict = 'INCOHERENCE_PRESENT';
  else if (open_judgments > 0) classification_verdict = 'JUDGMENT_REQUIRED';
  else classification_verdict = 'COHERENT_ON_SUPPLIED_FACTS';

  const rationale = [];
  rationale.push(`${stream_count} funds stream${stream_count === 1 ? '' : 's'} classified against ${RULESET.ruleset_label}, in force from ${RULESET.in_force_from}.`);
  if (stream_count === 0) {
    rationale.push('No streams were supplied, so there is nothing to classify. This is a defined empty result, not a finding about the firm.');
  }
  if (incoherent_count > 0) {
    rationale.push(`${incoherent_count} stream${incoherent_count === 1 ? '' : 's'} carry facts that do not agree with the method asserted for them. An incoherence here is an inconsistency between the facts as supplied, not a determination that the firm has breached CASS 15.`);
  }
  if (open_judgments > 0) {
    rationale.push(`${open_judgments} question${open_judgments === 1 ? ' remains' : 's remain'} undetermined on the facts supplied. Each one names what is undetermined, which input would resolve it, and who decides. This tool does not decide any of them.`);
  }
  if (classification_verdict === 'COHERENT_ON_SUPPLIED_FACTS') {
    rationale.push('Every stream is internally consistent with the method asserted for it, on the facts supplied. That is a consistency check on the declarations, not a validation that the declarations are true or that the firm complies with CASS 15.');
  }

  const compliance_flags = [`SAFEGUARDING_METHOD_${classification_verdict}`];
  if (incoherent_count > 0) compliance_flags.push('SAFEGUARDING_METHOD_INCOHERENCE_PRESENT');
  if (open_judgments > 0) compliance_flags.push('SAFEGUARDING_METHOD_JUDGMENT_REQUIRED');
  if (audit_exemption_indicator.outcome === 'audit_exemption_indicated') compliance_flags.push('SAFEGUARDING_AUDIT_EXEMPTION_INDICATED');
  if (as_of_date === null) compliance_flags.push('SAFEGUARDING_AS_OF_DATE_MISSING_OR_UNPARSEABLE');

  const output_payload = {
    ruleset: RULESET,
    as_of_date,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    classification_verdict,
    stream_count,
    coherent_count,
    incoherent_count,
    judgment_stream_count,
    open_judgment_count: open_judgments,
    determinations,
    audit_exemption_indicator,
    citations: CITATIONS,
    rationale,
    note: 'Deterministic UK CASS 15 safeguarding method classifier over a caller-declared set of funds streams. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It checks whether the method asserted for each stream is coherent with the account and instrument facts supplied, and names every question those facts leave open together with the input that would resolve it and the person who decides. It is not a determination of compliance or breach, not an opinion on the legal effectiveness of any insurance policy or guarantee, not a regulatory filing, and not legal advice.',
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
