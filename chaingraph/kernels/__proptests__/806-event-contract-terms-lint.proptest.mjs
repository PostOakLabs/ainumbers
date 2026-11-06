// 806-event-contract-terms-lint — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded and closed (two profiles, closed
// enum sets, integers-only thresholds, opaque labels over a fixed charset, a
// closed refusal set), so properties run over a committed mulberry32 seed plus
// a fixed corpus of structural cases. No totality claim over arbitrary
// objects: malformed inputs must land in the refusal branch, which is itself
// asserted.
//
// kernel_digest_at_authoring: sha256:8a45e6e92437b794e7087e2b86ca9e15027ca56a2bbe83cb744c8a65fd7f28bb
// spec: event-contract declared settlement terms lint against a caller policy
//   (board/queued/EVENT-TERMS-LINT-RESUME-1.md; pinned primary text mapped in
//   research/EVENT-TERMS-LINT-PIN-2026-10-30.md — rule_key ids only in source,
//   citations live in node metadata per KERNEL-CITATION-CLASS-1).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/806-event-contract-terms-lint.proptest.mjs

import { compute } from '../806-event-contract-terms-lint.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '806-event-contract-terms-lint';

const FALLBACKS = ['none', 'last_price', 'void', 'refund'];
const REVISIONS = ['none', 'allowed_within_window'];
const SOURCE_KINDS = ['government_statistic', 'official_body', 'exchange_price', 'media_consensus', 'venue_determination', 'other'];
const REVISION_RULES = ['first_release', 'final_release', 'as_of_expiration'];
const EXPIRATION_VALUE_RULES = ['point', 'average', 'max', 'min', 'threshold_cross'];
const EARLY_CLOSE_RULES = ['none', 'on_event', 'venue_discretion'];
const FAIL_ITEMS = ['forbid_carveout_clause', 'require_unresolvable_fallback', 'forbid_revision_after_settlement', 'forbid_discretion_clause', 'require_outcome_review', 'require_exhaustive_exclusive', 'allowed_source_kinds'];
const THRESHOLD_ITEMS = ['min_fallback_sources', 'max_dispute_window_hours', 'max_settlement_delay_hours'];
const VERDICTS = ['PASS', 'PASS_WITH_FINDINGS', 'FAIL', 'REFUSED'];
const LABEL_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _.-';
const PROFILE_IDS = ['kalshi_rulebook_v1_29', 'generic'];

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const bool = (rng) => rng() < 0.5;
const int0 = (rng, n) => Math.floor(rng() * n);

function randomTerms(rng) {
  let label = '';
  const labelLen = 1 + int0(rng, 40);
  for (let i = 0; i < labelLen; i++) label += LABEL_ALPHABET[int0(rng, LABEL_ALPHABET.length)];
  return {
    contract_label: label,
    carveout_clause: bool(rng),
    unresolvable_fallback: pick(rng, FALLBACKS),
    revision_after_settlement: pick(rng, REVISIONS),
    source_agency_kind: pick(rng, SOURCE_KINDS),
    fallback_sources_count: int0(rng, 5),
    revision_rule: pick(rng, REVISION_RULES),
    expiration_value_rule: pick(rng, EXPIRATION_VALUE_RULES),
    discretion_clause: bool(rng),
    outcome_review_available: bool(rng),
    dispute_window_hours: int0(rng, 40000),
    settlement_delay_hours_max: int0(rng, 72),
    early_close_rule: pick(rng, EARLY_CLOSE_RULES),
    outcomes_exhaustive: bool(rng),
    outcomes_exclusive: bool(rng),
  };
}

function randomPolicy(rng) {
  const policy = {};
  for (const key of FAIL_ITEMS) {
    if (key === 'allowed_source_kinds') {
      if (bool(rng)) {
        const kinds = SOURCE_KINDS.filter(() => bool(rng));
        policy[key] = kinds.length ? kinds : [pick(rng, SOURCE_KINDS)];
      }
    } else if (bool(rng)) {
      policy[key] = bool(rng);
    }
  }
  for (const key of THRESHOLD_ITEMS) {
    if (bool(rng)) policy[key] = int0(rng, 20000);
  }
  return policy;
}

// ---------- class-A: determinism ----------
function checkDeterminism() {
  const rng = mulberry32(20261102);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = { profile: pick(rng, PROFILE_IDS), as_of: '2026-11-02', terms: randomTerms(rng), policy: randomPolicy(rng) };
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'determinism_compute_pure_over_bounded_domain', checked, violations };
}

// ---------- class-B: closed verdict set + closed refusal set ----------
function checkVerdictAndRefusalClosure() {
  const rng = mulberry32(20261103);
  let checked = 0, violations = 0;
  const bump = (ok) => { checked++; if (!ok) violations++; };
  for (let i = 0; i < 200; i++) {
    const pp = { profile: pick(rng, PROFILE_IDS), as_of: '2026-11-02', terms: randomTerms(rng), policy: randomPolicy(rng) };
    const r = compute(pp);
    bump(VERDICTS.indexOf(r.output_payload.verdict) !== -1);
    if (r.output_payload.refused) {
      bump(['unknown_profile', 'invalid_as_of', 'missing_terms', 'identifier_like_label', 'bad_label', 'invalid_field', 'unknown_policy_item', 'invalid_policy_item'].indexOf(r.output_payload.reason_code) !== -1);
    } else {
      const statuses = r.output_payload.findings.map((f) => f.status);
      bump(statuses.every((s) => s === 'PASS' || s === 'FINDING'));
      bump(r.output_payload.findings.every((f) => typeof f.rule_key === 'string' && (f.basis === 'profile_pinned' || f.basis === 'caller_policy')));
      // verdict class law
      const anyFail = r.output_payload.findings.some((f) => f.status === 'FINDING' && FAIL_ITEMS.indexOf(f.item) !== -1);
      const anyFind = r.output_payload.findings.some((f) => f.status === 'FINDING');
      bump(r.output_payload.verdict === (anyFail ? 'FAIL' : anyFind ? 'PASS_WITH_FINDINGS' : 'PASS'));
      bump(r.compliance_flags.length === 1 && r.compliance_flags[0].indexOf('terms_lint_') === 0);
    }
  }
  return { name: 'closed_verdict_refusal_and_finding_shape', checked, violations };
}

// ---------- class-B: refusal branches reachable and never echo ----------
function checkRefusalBranches() {
  let checked = 0, violations = 0;
  const ref = (pp, reason) => {
    checked++;
    const r = compute(pp);
    if (!(r.output_payload.refused && r.output_payload.reason_code === reason)) violations++;
  };
  const goodTerms = {
    contract_label: 'Ok label', carveout_clause: false, unresolvable_fallback: 'last_price',
    revision_after_settlement: 'none', source_agency_kind: 'other', fallback_sources_count: 0,
    revision_rule: 'first_release', expiration_value_rule: 'point', discretion_clause: false,
    outcome_review_available: false, dispute_window_hours: 0, settlement_delay_hours_max: 0,
    early_close_rule: 'none', outcomes_exhaustive: true, outcomes_exclusive: true,
  };
  ref({ profile: 'nope', as_of: '2026-11-02', terms: goodTerms, policy: {} }, 'unknown_profile');
  ref({ profile: 'generic', as_of: 'not-a-date', terms: goodTerms, policy: {} }, 'invalid_as_of');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: null, policy: {} }, 'missing_terms');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: Object.assign({}, goodTerms, { contract_label: 'https://x.example' }), policy: {} }, 'identifier_like_label');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: Object.assign({}, goodTerms, { contract_label: 'a@b' }), policy: {} }, 'identifier_like_label');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: Object.assign({}, goodTerms, { contract_label: 'deadbeefdeadbeefdeadbeef' }), policy: {} }, 'identifier_like_label');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: Object.assign({}, goodTerms, { contract_label: '' }), policy: {} }, 'bad_label');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: Object.assign({}, goodTerms, { unresolvable_fallback: 'ask_the_venue' }), policy: {} }, 'invalid_field');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: goodTerms, policy: { not_a_policy_item: true } }, 'unknown_policy_item');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: goodTerms, policy: { max_dispute_window_hours: -1 } }, 'invalid_policy_item');
  ref({ profile: 'generic', as_of: '2026-11-02', terms: goodTerms, policy: { allowed_source_kinds: ['tarot'] } }, 'invalid_policy_item');
  // refused output never echoes the label
  const echoed = compute({ profile: 'generic', as_of: '2026-11-02', terms: Object.assign({}, goodTerms, { contract_label: 'https://secret.example/path' }), policy: {} });
  checked++;
  if (JSON.stringify(echoed).indexOf('secret.example') !== -1) violations++;
  return { name: 'refusal_branches_reachable_and_no_echo', checked, violations };
}

// ---------- class-K: monotonicity of threshold items ----------
function checkThresholdMonotonicity() {
  const rng = mulberry32(20261104);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const terms = randomTerms(rng);
    terms.dispute_window_hours = 100;
    const ppLo = { profile: 'generic', as_of: '2026-11-02', terms, policy: { max_dispute_window_hours: 200 } };
    const ppHi = { profile: 'generic', as_of: '2026-11-02', terms, policy: { max_dispute_window_hours: 50 } };
    const lo = compute(ppLo).output_payload.findings.find((f) => f.item === 'max_dispute_window_hours');
    const hi = compute(ppHi).output_payload.findings.find((f) => f.item === 'max_dispute_window_hours');
    checked++;
    if (!(lo.status === 'PASS' && hi.status === 'FINDING')) violations++;
  }
  return { name: 'threshold_overrun_monotone_in_policy_bound', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkVerdictAndRefusalClosure(),
  checkRefusalBranches(),
  checkThresholdMonotonicity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
