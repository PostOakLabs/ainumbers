import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-498-reward-flow-related-party';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_reward_flow_related_party',
  mandate_type: 'compliance_control', gpu: false,
};

/*
 * Consortium validator reward-flow related-party classifier (art-498).
 *
 * A consortium runs a permissioned Avalanche Evergreen L1. Its reward-manager
 * precompile pays block rewards to a configured recipient list. At quarter-end
 * close the controller has to answer a question nobody currently sells an
 * answer to: are any of those recipients related parties of the reporting
 * entity, and is the amount they received material?
 *
 * Inputs are ALL caller-transcribed. There is no chain observation, no RPC and
 * no P-Chain query. The recipient list is transcribed from the reward-manager
 * configuration; the per-period amounts are transcribed from the institution's
 * OWN accounting export; the entity-ownership map is the caller's own group
 * structure. This kernel reconciles those three transcriptions against a
 * materiality threshold and reports what it can and cannot resolve.
 *
 * OWN VERSIONED RULESET. `ruleset_version` is a caller input carried into the
 * output_payload and therefore into the execution_hash preimage (art-459's
 * pattern). This node deliberately does NOT import the ICFR family's ruleset:
 * that spec is archived, and coupling a live node to a retired document means
 * one ruleset edit moves two families' hashes.
 *
 * §28 CLAUSE BINDING. The ASC 850 and IAS 24 citations are pinned objects with
 * full ISO `in_force_from` values, emitted UNCONDITIONALLY inside
 * output_payload, so they sit inside the execution_hash preimage. A bare year
 * would not satisfy `in_force_from`. The citation supports a computed finding;
 * it is never surfaced on its own.
 *
 * THE DRAFT NOTE IS THE CONVENIENCE LAYER, NEVER THE ONLY OUTPUT. Flags,
 * amounts and citations emit unconditionally. The disclosure-note lines are
 * additional, carry the DECISION-SUPPORT DRAFT label, and are written as
 * factual restatements of what was computed. They are not legal or accounting
 * advice and do not tell the reader what to conclude or file.
 *
 * NO COVERAGE RATIO, NO PERCENTAGE OF RECIPIENTS CLASSIFIED (§0.7). Counts and
 * amounts only. The permitted form is a gap list that NAMES each unresolved
 * recipient, which this kernel emits.
 *
 * NO CLOCK. `period_ref` and `as_of` are opaque caller strings, echoed only and
 * never parsed. `buildArtifact` takes `now` via options. There is no
 * `last_reviewed` and no clock-derived `valid_until`.
 *
 * ZERO PII. Every reference is an opaque string supplied by the caller.
 * Ownership maps and accounting exports can carry entity and person names, so
 * this kernel reads ONLY the fields it maps by name and drops every unmapped
 * field on every input object, so nothing unmapped can reach output_payload,
 * the classification, the gap list or the draft note. Note the precise scope of
 * that claim: `policy_parameters` is echoed verbatim into the artifact because
 * it is the execution_hash preimage, so the guarantee is that this kernel never
 * PROPAGATES an unmapped field into anything it computes. The node page never
 * offers a field to paste one into, and the transcription discipline is that
 * only opaque references are entered in the first place.
 *
 * MONEY. Amounts are summed in integer minor units (hundredths) so a float
 * cannot drift a total, then rendered back to two decimals.
 *
 * FINITE GATE. An empty recipient list, an absent ownership map, a missing
 * threshold and a missing issuer parent each resolve to a DEFINED result. No
 * branch emits NaN, Infinity or an undefined verdict.
 *
 * Not X: use art-459 for a segregation-of-duties conflict matrix over role
 * assignments; this node classifies payment recipients against a group
 * ownership structure, which is a different question with a different ruleset.
 */

/** §28 pinned citation objects (profile `ocg-clause-binding@1`, §1.2 required members). */
const CITE_MAPPED_BY = 'AINumbers AVAX-RPARTY-1';
const CITE_MAPPED_AT = '2026-07-31';
const CITATIONS = {
  us_gaap_related_party: {
    scheme: 'fasb-asc',
    id: 'ASC 850-10-50',
    // The FASB Accounting Standards Codification became the single source of
    // authoritative US GAAP for interim and annual periods ending after
    // 15 September 2009, which is when ASC 850 became citable as ASC 850.
    in_force_from: '2009-09-15',
    mapped_by: CITE_MAPPED_BY,
    mapped_at: CITE_MAPPED_AT,
    uri: 'https://asc.fasb.org/',
  },
  ifrs_related_party: {
    scheme: 'ifrs-ias',
    id: 'IAS 24',
    // IAS 24 as revised November 2009, effective for annual periods beginning
    // on or after 1 January 2011.
    in_force_from: '2011-01-01',
    mapped_by: CITE_MAPPED_BY,
    mapped_at: CITE_MAPPED_AT,
    uri: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-24-related-party-disclosures/',
  },
};

const CLASS_SAME_PARENT = 'SAME_ULTIMATE_PARENT';
const CLASS_CO_CONSORTIUM = 'CO_CONSORTIUM_MEMBER';
const CLASS_NOT_RELATED = 'NOT_RELATED';
const CLASS_UNRESOLVED = 'UNRESOLVED';

function s(v) { return String(v == null ? '' : v).trim(); }

/** Amount in integer minor units, or null when the caller did not state a usable one. */
function minor(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function major(units) { return Math.round(units) / 100; }

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = ['REWARD_FLOW_RELATED_PARTY_EVALUATED'];
  const gaps = [];

  const ruleset_version = s(pp.ruleset_version) || 'unversioned';
  if (ruleset_version === 'unversioned') gaps.push({ subject_ref: null, reason_code: 'RULESET_VERSION_NOT_STATED' });

  const issuer_ref = s(pp.issuer_ref) || null;
  if (!issuer_ref) gaps.push({ subject_ref: null, reason_code: 'ISSUER_REF_MISSING' });

  const issuer_ultimate_parent_ref = s(pp.issuer_ultimate_parent_ref) || null;
  if (!issuer_ultimate_parent_ref) {
    gaps.push({ subject_ref: null, reason_code: 'ISSUER_ULTIMATE_PARENT_NOT_STATED' });
  }

  const period_ref = s(pp.period_ref) || null;
  if (!period_ref) gaps.push({ subject_ref: null, reason_code: 'PERIOD_REF_MISSING' });
  const as_of = s(pp.as_of) || null;
  const currency = s(pp.currency) || null;

  // Co-consortium membership, declared two ways: a top-level ref list and a
  // per-entry flag on the ownership map. Either is sufficient.
  const declaredMembers = new Set(
    (Array.isArray(pp.consortium_member_refs) ? pp.consortium_member_refs : []).map(s).filter(Boolean)
  );

  // Ownership map: entity_ref -> {ultimate_parent_ref, consortium_member}.
  // ONLY these three keys are read; every other key on the caller's object is
  // dropped and can never reach the artifact.
  const ownership = new Map();
  const rawOwnership = Array.isArray(pp.ownership_map) ? pp.ownership_map : [];
  for (const row of rawOwnership) {
    const entity_ref = s(row && row.entity_ref);
    if (!entity_ref) continue;
    const parent = s(row && row.ultimate_parent_ref);
    const member = row && row.consortium_member === true;
    ownership.set(entity_ref, { ultimate_parent_ref: parent || null, consortium_member: member });
    if (member) declaredMembers.add(entity_ref);
  }
  if (ownership.size === 0) gaps.push({ subject_ref: null, reason_code: 'OWNERSHIP_MAP_EMPTY' });

  const threshold_units = minor(pp.materiality_threshold);
  const threshold_stated = threshold_units !== null && threshold_units >= 0;
  if (!threshold_stated) gaps.push({ subject_ref: null, reason_code: 'MATERIALITY_THRESHOLD_NOT_STATED' });

  // Recipients. Only recipient_ref, entity_ref and reward_amount are read.
  const rawRecipients = Array.isArray(pp.recipients) ? pp.recipients : [];
  const recipients = [];
  const seen = new Set();
  for (const row of rawRecipients) {
    const recipient_ref = s(row && row.recipient_ref);
    if (!recipient_ref) {
      gaps.push({ subject_ref: null, reason_code: 'RECIPIENT_REF_MISSING' });
      continue;
    }
    if (seen.has(recipient_ref)) {
      gaps.push({ subject_ref: recipient_ref, reason_code: 'DUPLICATE_RECIPIENT_REF' });
      continue;
    }
    seen.add(recipient_ref);

    // A recipient address may be mapped to a legal entity; when it is not, the
    // recipient reference itself is tried as an entity key before giving up.
    const stated_entity_ref = s(row && row.entity_ref) || null;
    const entity_key = stated_entity_ref || recipient_ref;
    const owned = ownership.get(entity_key) || null;

    const amount_units = minor(row && row.reward_amount);
    if (amount_units === null) {
      gaps.push({ subject_ref: recipient_ref, reason_code: 'REWARD_AMOUNT_NOT_STATED' });
    } else if (amount_units < 0) {
      gaps.push({ subject_ref: recipient_ref, reason_code: 'REWARD_AMOUNT_NEGATIVE' });
    }

    let classification;
    if (!owned && !declaredMembers.has(entity_key)) {
      classification = CLASS_UNRESOLVED;
      gaps.push({ subject_ref: recipient_ref, reason_code: 'ENTITY_NOT_IN_OWNERSHIP_MAP' });
    } else if (
      issuer_ultimate_parent_ref &&
      owned && owned.ultimate_parent_ref &&
      owned.ultimate_parent_ref === issuer_ultimate_parent_ref
    ) {
      classification = CLASS_SAME_PARENT;
    } else if (declaredMembers.has(entity_key)) {
      classification = CLASS_CO_CONSORTIUM;
    } else if (owned && !owned.ultimate_parent_ref) {
      classification = CLASS_UNRESOLVED;
      gaps.push({ subject_ref: recipient_ref, reason_code: 'ULTIMATE_PARENT_NOT_STATED_FOR_ENTITY' });
    } else if (!issuer_ultimate_parent_ref) {
      classification = CLASS_UNRESOLVED;
      gaps.push({ subject_ref: recipient_ref, reason_code: 'ISSUER_PARENT_UNKNOWN_CANNOT_COMPARE' });
    } else {
      classification = CLASS_NOT_RELATED;
    }

    recipients.push({
      recipient_ref,
      entity_ref: stated_entity_ref,
      ultimate_parent_ref: owned ? owned.ultimate_parent_ref : null,
      reward_amount: amount_units === null ? null : major(amount_units),
      classification,
      related_party: classification === CLASS_SAME_PARENT || classification === CLASS_CO_CONSORTIUM,
      _units: amount_units,
    });
  }
  if (recipients.length === 0) gaps.push({ subject_ref: null, reason_code: 'RECIPIENT_LIST_EMPTY' });

  recipients.sort((a, b) => (a.recipient_ref < b.recipient_ref ? -1 : a.recipient_ref > b.recipient_ref ? 1 : 0));

  let flagged_units = 0;
  let flagged_recipient_count = 0;
  let unresolved_recipient_count = 0;
  let unquantified_related_recipient_count = 0;
  const flagged_recipient_refs = [];
  for (const r of recipients) {
    if (r.classification === CLASS_UNRESOLVED) unresolved_recipient_count += 1;
    if (!r.related_party) continue;
    flagged_recipient_count += 1;
    flagged_recipient_refs.push(r.recipient_ref);
    if (r._units === null || r._units < 0) unquantified_related_recipient_count += 1;
    else flagged_units += r._units;
  }
  for (const r of recipients) delete r._units;

  const flagged_total = major(flagged_units);
  const materiality_threshold = threshold_stated ? major(threshold_units) : null;

  let materiality_status;
  if (flagged_recipient_count === 0) materiality_status = 'NOT_APPLICABLE';
  else if (!threshold_stated) materiality_status = 'UNQUANTIFIED';
  else materiality_status = flagged_units >= threshold_units ? 'AT_OR_ABOVE_THRESHOLD' : 'BELOW_THRESHOLD';

  if (flagged_recipient_count === 0) {
    compliance_flags.push('NO_RELATED_PARTY_FLAGGED');
  } else if (materiality_status === 'AT_OR_ABOVE_THRESHOLD') {
    compliance_flags.push('RELATED_PARTY_MATERIAL');
  } else if (materiality_status === 'BELOW_THRESHOLD') {
    compliance_flags.push('RELATED_PARTY_IMMATERIAL');
  }

  const escalate =
    materiality_status === 'AT_OR_ABOVE_THRESHOLD' ||
    materiality_status === 'UNQUANTIFIED' ||
    gaps.length > 0;
  if (escalate) compliance_flags.push('ESCALATION_RAISED');

  // Convenience layer. Factual restatement of what was computed above, under a
  // DECISION-SUPPORT DRAFT label. Never the only output, never advice.
  const draft_disclosure_note = {
    label: 'DECISION-SUPPORT DRAFT',
    disclaimer: 'Drafted from the transcribed figures above for review by the reporting entity and its auditor. Not legal or accounting advice, and not a filing.',
    lines: buildDraftLines({
      issuer_ref,
      period_ref,
      currency,
      flagged_recipient_count,
      flagged_total,
      materiality_status,
      materiality_threshold,
      unresolved_recipient_count,
      unquantified_related_recipient_count,
      recipients,
    }),
  };

  return {
    output_payload: {
      ruleset_version,
      issuer_ref,
      issuer_ultimate_parent_ref,
      period_ref,
      as_of,
      currency,
      recipient_count: recipients.length,
      recipients,
      flagged_recipient_count,
      flagged_recipient_refs,
      flagged_total,
      materiality_threshold,
      materiality_status,
      unresolved_recipient_count,
      unquantified_related_recipient_count,
      gaps,
      citations: CITATIONS,
      draft_disclosure_note,
    },
    compliance_flags,
  };
}

function buildDraftLines(v) {
  const unit = v.currency ? ' ' + v.currency : '';
  const who = v.issuer_ref || 'the reporting entity';
  const when = v.period_ref || 'the reported period';
  const lines = [];

  lines.push(
    'Validator reward flows for ' + when + ' were reviewed against the group ownership structure recorded for ' + who + '.'
  );

  if (v.flagged_recipient_count === 0) {
    lines.push('No reward-manager recipient in the transcribed list was classified as a related party.');
  } else {
    lines.push(
      v.flagged_recipient_count + ' reward-manager recipient(s) were classified as related parties, receiving ' +
      v.flagged_total.toFixed(2) + unit + ' in aggregate for the period.'
    );
    const named = v.recipients
      .filter((r) => r.related_party)
      .map((r) => r.recipient_ref + ' (' + r.classification + ')');
    lines.push('Recipients so classified: ' + named.join(', ') + '.');
  }

  if (v.materiality_status === 'AT_OR_ABOVE_THRESHOLD') {
    lines.push(
      'The aggregate related-party amount is at or above the materiality threshold of ' +
      v.materiality_threshold.toFixed(2) + unit + ' stated for this review.'
    );
  } else if (v.materiality_status === 'BELOW_THRESHOLD') {
    lines.push(
      'The aggregate related-party amount is below the materiality threshold of ' +
      v.materiality_threshold.toFixed(2) + unit + ' stated for this review.'
    );
  } else if (v.materiality_status === 'UNQUANTIFIED') {
    lines.push('No materiality threshold was stated for this review, so the aggregate was not measured against one.');
  }

  if (v.unresolved_recipient_count > 0) {
    lines.push(
      v.unresolved_recipient_count + ' recipient(s) could not be resolved against the ownership structure and are listed in the gap list. They are not included in the amounts above.'
    );
  }
  if (v.unquantified_related_recipient_count > 0) {
    lines.push(
      v.unquantified_related_recipient_count + ' related-party recipient(s) had no usable amount transcribed and are excluded from the aggregate.'
    );
  }

  lines.push('Prepared with reference to ASC 850-10-50 and IAS 24, as pinned in the citations above.');
  return lines;
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
