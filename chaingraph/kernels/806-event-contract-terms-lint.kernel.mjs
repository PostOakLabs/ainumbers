import { executionHash } from './_hash.mjs';

// 806-event-contract-terms-lint — scaffolded by scripts/new-kernel.mjs (KERNEL-SCAFFOLD-1). Fill in:
//   1. compute(pp) below — replace the NOT_IMPLEMENTED throw with real logic.
//   2. chaingraph/kernels/fixtures/806-event-contract-terms-lint.fixtures.json — replace the placeholder
//      vector with real golden vectors (name, policy_parameters, output_payload).
//   3. chaingraph/kernels/__proptests__/806-event-contract-terms-lint.proptest.mjs — replace the
//      placeholder property with real class-A/B/K properties per FV-PBT-FLOOR-BUILD-SPEC.md.
//   4. chaingraph/graph/nodes/806-event-contract-terms-lint.json — replace TODO-CITE / standards_basis and
//      the description once compute() is real.
// Run `node scripts/kernel-preflight.mjs 806-event-contract-terms-lint` repeatedly while doing all of the
// above — RIDER-KERNEL.md explains why each check exists.
//
// DETERMINISM: compute() must be a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which is a
// STRICT SUBSET of a browser/Node global environment: TextEncoder/atob/btoa/URL are ALL
// ABSENT (chaingraph/kernels/check-guest-builtin-safety.mjs enforces this per kernel, over
// every fixture vector, in milliseconds — never discover this after a multi-hour GPU
// prove). If compute() needs UTF-8 bytes, call the pure-JS encoder below instead of
// `new TextEncoder()` — validated byte-identical to TextEncoder.encode() across
// ASCII/2-3-4-byte sequences/surrogate pairs/lone surrogates (22 named + 20,000 fuzz
// cases, 0 mismatches, ART595-ART590-UTF8-FIX-1). Delete this helper if compute() never
// needs it — an unused function is dead weight, not a safety net.
 // keep the helper available without tripping an unused-var lint before compute() calls it

const TOOL_ID = '806-event-contract-terms-lint';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_event_contract_terms',
  mandate_type: 'compliance_control', gpu: false,
};

/**
 * compute(pp) — pure decision kernel. Fill this in; delete the NOT_IMPLEMENTED throw.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
// Event contract terms lint -- screen a contract's DECLARED settlement terms
// (as enums, flags, counts and opaque labels -- never prose, never URLs)
// against a caller-declared policy, and emit per-item PASS/FINDING lines.
//
// The kernel is venue-neutral. Terms and policy arrive fully enumerated; the
// only profile knowledge is a closed data table that names, per profile, which
// rule_key identifiers carry a pinned primary-text basis versus caller policy.
// The node metadata and the node page map those opaque rule_key identifiers to
// the pinned passages (KERNEL-CITATION-CLASS-1: citations never live in kernel
// source). The kernel never says a contract is lawful, fair or compliant; it
// reports where declared terms disagree with the caller's own policy.
//
// VERDICT CLASS (fixed):
//   - forbid_*/require_*/allowed_source_kinds mismatches are FAIL-class.
//   - numeric threshold overruns (min_fallback_sources,
//     max_dispute_window_hours, max_settlement_delay_hours) and the one
//     intrinsic consistency check (a final-release revision rule combined with
//     a venue-discretion early close) are PASS_WITH_FINDINGS-class.
//   - all evaluated items PASS -> PASS. Any refused input -> refused output,
//     never a verdict.
//
// REFUSALS (closed, each with a reachable path + fixture, AUTHORING-STANDARD):
//   - unknown profile string.
//   - opaque label outside [A-Za-z0-9 _.-], 1..64 chars.
//   - label that looks like a URL, email/address, or long hex hash: refused,
//     never echoed.
//   - a declared enum/flag/integer field outside its declared domain.
//   - a policy bound that is not a non-negative integer.
//
// Pure ECMA-262 only: no Date, no Math.random, no floating-point paths that
// carry policy meaning (all thresholds are integers).

const PROFILES = {
  kalshi_rulebook_v1_29: {
    profile_id: 'kalshi_rulebook_v1_29',
    venue_label: 'Kalshi (KalshiEX LLC, DCM)',
    // opaque rule_key -> basis class; the node page maps keys to pinned text
    pinned_keys: {
      unresolvable_fallback: 'rb129_6_3_c',
      revision_after_settlement: 'rb129_7_2_a',
      release_visibility_after_discretionary_close: 'rb129_7_2_c',
      dispute_window: 'rb129_10_2_a',
      settlement_delay: 'rb129_7_1_b',
      discretion_clause: 'rb129_6_3_c',
      outcome_review: 'rb129_7_1',
      source_agency_kind: 'rb129_ch1_source_agency',
    },
  },
  generic: { profile_id: 'generic', venue_label: 'venue-neutral', pinned_keys: {} },
};

const LABEL_RE = /^[A-Za-z0-9 _.-]{1,64}$/;
const AS_OF_RE = /^\d{4}-\d{2}-\d{2}$/;

const FALLBACKS = ['none', 'last_price', 'void', 'refund'];
const REVISIONS = ['none', 'allowed_within_window'];
const SOURCE_KINDS = ['government_statistic', 'official_body', 'exchange_price', 'media_consensus', 'venue_determination', 'other'];
const REVISION_RULES = ['first_release', 'final_release', 'as_of_expiration'];
const EXPIRATION_VALUE_RULES = ['point', 'average', 'max', 'min', 'threshold_cross'];
const EARLY_CLOSE_RULES = ['none', 'on_event', 'venue_discretion'];

// FAIL-class policy items
const FAIL_ITEMS = ['forbid_carveout_clause', 'require_unresolvable_fallback', 'forbid_revision_after_settlement', 'forbid_discretion_clause', 'require_outcome_review', 'require_exhaustive_exclusive', 'allowed_source_kinds'];
// PASS_WITH_FINDINGS-class policy items
const THRESHOLD_ITEMS = ['min_fallback_sources', 'max_dispute_window_hours', 'max_settlement_delay_hours'];

function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isNonNegInt(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }
function looksIdentifierLike(s) {
  if (typeof s !== 'string') return true;
  if (/:\/\//.test(s) || s.indexOf('@') !== -1) return true;
  if (/^www\./i.test(s)) return true;
  if (/^[0-9a-f]{16,}$/i.test(s)) return true;
  return false;
}

function refusal(reason, field) {
  return {
    // issues mirrors the raised flag (flag-mirror doctrine): the refusal reason
    output_payload: { refused: true, reason_code: reason, field: field || null, verdict: 'REFUSED', issues: [reason] },
    compliance_flags: [reason ? 'terms_lint_input_refused' : 'terms_lint_refused'],
  };
}

/**
 * compute(pp) — pure decision kernel.
 * pp: { profile, as_of, terms: {...}, policy: {...} }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const profileId = pp.profile;
  if (profileId !== 'kalshi_rulebook_v1_29' && profileId !== 'generic') {
    return refusal('unknown_profile', 'profile');
  }
  if (typeof pp.as_of !== 'string' || !AS_OF_RE.test(pp.as_of)) {
    return refusal('invalid_as_of', 'as_of');
  }
  const profile = PROFILES[profileId];
  const pinned = (key) => (profile.pinned_keys[key] ? { rule_key: profile.pinned_keys[key], basis: 'profile_pinned' } : { rule_key: 'caller_policy', basis: 'caller_policy' });

  const terms = pp.terms;
  if (!isPlainObject(terms)) return refusal('missing_terms', 'terms');

  // opaque label + identifier-like refusals (never echoed)
  const label = terms.contract_label;
  if (looksIdentifierLike(label)) return refusal('identifier_like_label', 'terms.contract_label');
  if (typeof label !== 'string' || !LABEL_RE.test(label)) return refusal('bad_label', 'terms.contract_label');

  // closed-domain validation of declared terms
  if (typeof terms.carveout_clause !== 'boolean') return refusal('invalid_field', 'terms.carveout_clause');
  if (FALLBACKS.indexOf(terms.unresolvable_fallback) === -1) return refusal('invalid_field', 'terms.unresolvable_fallback');
  if (REVISIONS.indexOf(terms.revision_after_settlement) === -1) return refusal('invalid_field', 'terms.revision_after_settlement');
  if (SOURCE_KINDS.indexOf(terms.source_agency_kind) === -1) return refusal('invalid_field', 'terms.source_agency_kind');
  if (!isNonNegInt(terms.fallback_sources_count)) return refusal('invalid_field', 'terms.fallback_sources_count');
  if (REVISION_RULES.indexOf(terms.revision_rule) === -1) return refusal('invalid_field', 'terms.revision_rule');
  if (EXPIRATION_VALUE_RULES.indexOf(terms.expiration_value_rule) === -1) return refusal('invalid_field', 'terms.expiration_value_rule');
  if (typeof terms.discretion_clause !== 'boolean') return refusal('invalid_field', 'terms.discretion_clause');
  if (typeof terms.outcome_review_available !== 'boolean') return refusal('invalid_field', 'terms.outcome_review_available');
  if (!isNonNegInt(terms.dispute_window_hours)) return refusal('invalid_field', 'terms.dispute_window_hours');
  if (!isNonNegInt(terms.settlement_delay_hours_max)) return refusal('invalid_field', 'terms.settlement_delay_hours_max');
  if (EARLY_CLOSE_RULES.indexOf(terms.early_close_rule) === -1) return refusal('invalid_field', 'terms.early_close_rule');
  if (typeof terms.outcomes_exhaustive !== 'boolean') return refusal('invalid_field', 'terms.outcomes_exhaustive');
  if (typeof terms.outcomes_exclusive !== 'boolean') return refusal('invalid_field', 'terms.outcomes_exclusive');

  // policy validation: only recognized items, correct types
  const policy = isPlainObject(pp.policy) ? pp.policy : {};
  for (const key of Object.keys(policy)) {
    if (FAIL_ITEMS.indexOf(key) === -1 && THRESHOLD_ITEMS.indexOf(key) === -1) {
      return refusal('unknown_policy_item', 'policy.' + key);
    }
  }
  for (const key of FAIL_ITEMS) {
    if (key === 'allowed_source_kinds') continue;
    if (policy[key] !== undefined && typeof policy[key] !== 'boolean') return refusal('invalid_policy_item', 'policy.' + key);
  }
  if (policy.allowed_source_kinds !== undefined) {
    if (!Array.isArray(policy.allowed_source_kinds)) return refusal('invalid_policy_item', 'policy.allowed_source_kinds');
    for (const k of policy.allowed_source_kinds) {
      if (SOURCE_KINDS.indexOf(k) === -1) return refusal('invalid_policy_item', 'policy.allowed_source_kinds');
    }
  }
  for (const key of THRESHOLD_ITEMS) {
    if (policy[key] !== undefined && !isNonNegInt(policy[key])) return refusal('invalid_policy_item', 'policy.' + key);
  }

  // findings: one line per policy item actually declared, plus the one
  // intrinsic consistency check that fires regardless of policy
  const findings = [];
  const addFinding = (item, status, keyBasis) => {
    findings.push({ item, status, rule_key: keyBasis.rule_key, basis: keyBasis.basis });
  };

  if (policy.forbid_carveout_clause === true) {
    const hit = terms.carveout_clause === true;
    addFinding('forbid_carveout_clause', hit ? 'FINDING' : 'PASS', pinned('carveout_clause'));
  }
  if (policy.require_unresolvable_fallback === true) {
    const hit = terms.unresolvable_fallback === 'none';
    addFinding('require_unresolvable_fallback', hit ? 'FINDING' : 'PASS', pinned('unresolvable_fallback'));
  }
  if (policy.forbid_revision_after_settlement === true) {
    const hit = terms.revision_after_settlement === 'allowed_within_window';
    addFinding('forbid_revision_after_settlement', hit ? 'FINDING' : 'PASS', pinned('revision_after_settlement'));
  }
  if (policy.forbid_discretion_clause === true) {
    const hit = terms.discretion_clause === true;
    addFinding('forbid_discretion_clause', hit ? 'FINDING' : 'PASS', pinned('discretion_clause'));
  }
  if (policy.require_outcome_review === true) {
    const hit = terms.outcome_review_available === false;
    addFinding('require_outcome_review', hit ? 'FINDING' : 'PASS', pinned('outcome_review'));
  }
  if (policy.require_exhaustive_exclusive === true) {
    const hit = terms.outcomes_exhaustive === false || terms.outcomes_exclusive === false;
    addFinding('require_exhaustive_exclusive', hit ? 'FINDING' : 'PASS', pinned('outcomes_shape'));
  }
  if (Array.isArray(policy.allowed_source_kinds)) {
    const hit = policy.allowed_source_kinds.indexOf(terms.source_agency_kind) === -1;
    addFinding('allowed_source_kinds', hit ? 'FINDING' : 'PASS', pinned('source_agency_kind'));
  }
  if (policy.min_fallback_sources !== undefined) {
    const hit = terms.fallback_sources_count < policy.min_fallback_sources;
    addFinding('min_fallback_sources', hit ? 'FINDING' : 'PASS', pinned('fallback_sources'));
  }
  if (policy.max_dispute_window_hours !== undefined) {
    const hit = terms.dispute_window_hours > policy.max_dispute_window_hours;
    addFinding('max_dispute_window_hours', hit ? 'FINDING' : 'PASS', pinned('dispute_window'));
  }
  if (policy.max_settlement_delay_hours !== undefined) {
    const hit = terms.settlement_delay_hours_max > policy.max_settlement_delay_hours;
    addFinding('max_settlement_delay_hours', hit ? 'FINDING' : 'PASS', pinned('settlement_delay'));
  }
  // intrinsic (always evaluated): a final_release revision rule is
  // unverifiable when the venue can close the contract early at its own
  // discretion — the declared "final" release may never be observable.
  if (terms.early_close_rule === 'venue_discretion' && terms.revision_rule === 'final_release') {
    addFinding('release_visibility_after_discretionary_close', 'FINDING', pinned('release_visibility_after_discretionary_close'));
  }

  const anyFail = findings.some((f) => f.status === 'FINDING' && FAIL_ITEMS.indexOf(f.item) !== -1);
  const anyFinding = findings.some((f) => f.status === 'FINDING');
  const verdict = anyFail ? 'FAIL' : (anyFinding ? 'PASS_WITH_FINDINGS' : 'PASS');

  const compliance_flags = [
    verdict === 'FAIL' ? 'terms_lint_fail'
      : (verdict === 'PASS_WITH_FINDINGS' ? 'terms_lint_findings' : 'terms_lint_pass'),
  ];
  // issues mirrors the raised flag (flag-mirror doctrine): every FINDING item,
  // in findings order; [] on PASS, so it is truthy exactly when verdict !== PASS
  const issues = findings.filter((f) => f.status === 'FINDING').map((f) => f.item);

  return {
    output_payload: {
      refused: false,
      profile_id: profile.profile_id,
      profile_venue_label: profile.venue_label,
      as_of: pp.as_of,
      contract_label: label,
      findings,
      evaluated_items: findings.length,
      verdict,
      issues,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
