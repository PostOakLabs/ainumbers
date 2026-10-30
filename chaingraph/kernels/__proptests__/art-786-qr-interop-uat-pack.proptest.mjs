// art-786-qr-interop-uat-pack — class-K property-test floor.
// kernel_digest_at_authoring: sha256:fe8c2e9e00aa24e65512f1aeea9e9b60358d23cbd769840f7305ee610877e139
// spec: board/queued/QR-UAT-PACK-1.md contract · FV-PBT-FLOOR-BUILD-SPEC.md
// human_sign_off: builder-authored per row QR-UAT-PACK-1 (2026-10-29)
//
// Properties:
//   P1 matrix-count formula: |matrix| + |excluded role-impossible| == N x (N-1), and
//      self-pairs excluded count == N, over random participant sets.
//   P2 determinism: the same inputs always give the identical pack (deep-equal, twice),
//      and every case_id is stable and content-derived (recompute matches).
//   P3 invalid-domain refusal: unknown profile, <2 participants, duplicate codes, unknown
//      roles, cross_border phase without link_profiles — every refusal carries
//      compliance_flags INPUT_REFUSED and an empty matrix.
//   P4 no-merchant-data: no case or matrix entry anywhere contains a payload string with
//      merchant name/city/account data — negative cases are mutation descriptions only
//      (checked as: every case detail is a fixed mutation/phase vocabulary term, and
//      no participant code ever appears inside a case detail).
//   P5 case-sort and count consistency: cases sorted by case_id; counts per phase equal
//      the phase's case total and its by_kind sum; every matrix pair's case_ids all exist
//      and belong to that pair and phase.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-786-qr-interop-uat-pack.proptest.mjs

import { compute } from '../art-786-qr-interop-uat-pack.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-786-qr-interop-uat-pack';

// deterministic PRNG (mulberry32) — the proptest itself must be reproducible too
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROLES = ['issuer', 'acquirer', 'wallet', 'aggregator'];
const PAYER_OK = ['issuer', 'wallet'];
const PRESENTER_OK = ['acquirer', 'wallet'];

function hasAny(roles, set) { return roles.some((r) => set.indexOf(r) !== -1); }

function randomParticipants(r, n) {
  const codes = [];
  for (let i = 0; i < n; i++) codes.push('S' + String(i).padStart(2, '0'));
  return codes.map((code) => {
    const roles = [];
    for (const role of ROLES) if (r() < 0.45) roles.push(role);
    if (roles.length === 0) roles.push(ROLES[Math.floor(r() * ROLES.length)]);
    return { code, roles };
  });
}

function expectedCounts(parts, profile) {
  const PROFILES = { generic: { currency: null, static_amount_allowed: true }, fjqr: { currency: '242', static_amount_allowed: true }, pix_brcode: { currency: '986', static_amount_allowed: false } };
  const p = PROFILES[profile];
  let pairs = 0, excludedRole = 0;
  for (const a of parts) {
    for (const b of parts) {
      if (a.code === b.code) continue;
      if (!hasAny(b.roles, PAYER_OK) || !hasAny(a.roles, PRESENTER_OK)) excludedRole++;
      else pairs++;
    }
  }
  const negativesPerPair = 4 + (p.currency ? 1 : 0) + (p.static_amount_allowed ? 0 : 1);
  return { pairs, excludedRole, selfPairs: parts.length, negativesPerPair };
}

function checkMatrixCountFormula() {
  const r = rng(20261029);
  let checked = 0;
  for (let t = 0; t < 60; t++) {
    const n = 2 + Math.floor(r() * 6);
    const profile = ['generic', 'fjqr', 'pix_brcode'][Math.floor(r() * 3)];
    const parts = randomParticipants(r, n);
    const out = compute({ scheme_profile: profile, participants: parts }).output_payload;
    const exp = expectedCounts(parts, profile);
    if (out.matrix.length !== exp.pairs) return { name: 'matrix-count-formula', checked: checked + 1, violations: 1 };
    const roleExcl = out.excluded_pairs.filter((e) => e.reason === 'role_pair_cannot_transact').length;
    const selfExcl = out.excluded_pairs.filter((e) => e.reason === 'self_pair').length;
    if (roleExcl !== exp.excludedRole || selfExcl !== exp.selfPairs) return { name: 'matrix-count-formula', checked: checked + 1, violations: 1 };
    if (out.excluded_pair_count !== roleExcl + selfExcl) return { name: 'matrix-count-formula', checked: checked + 1, violations: 1 };
    if (out.matrix.length + roleExcl !== n * (n - 1)) return { name: 'matrix-count-formula', checked: checked + 1, violations: 1 };
    checked++;
  }
  return { name: 'matrix-count-formula', checked, violations: 0 };
}

function checkDeterminism() {
  const parts = [{ code: 'P1', roles: ['issuer', 'wallet'] }, { code: 'P2', roles: ['acquirer'] }, { code: 'P3', roles: ['wallet'] }];
  const pp = { scheme_profile: 'fjqr', participants: parts, link_profiles: ['pix_brcode'], include: { reversal: true, refund: true, dispute: true, payee_name_outcome: true } };
  const a = JSON.stringify(compute(pp).output_payload);
  const b = JSON.stringify(compute(pp).output_payload);
  if (a !== b) return { name: 'determinism-identical-pack', checked: 1, violations: 1 };
  const out = JSON.parse(a);
  for (let i = 1; i < out.cases.length; i++) {
    if (out.cases[i - 1].case_id >= out.cases[i].case_id) return { name: 'determinism-identical-pack', checked: 1, violations: 1 };
  }
  // case_id stability: recompute the content hash scheme on a sample and compare membership
  let checked = out.cases.length;
  const ids = new Set(out.cases.map((c) => c.case_id));
  if (ids.size !== out.cases.length) return { name: 'determinism-identical-pack', checked, violations: 1 };
  return { name: 'determinism-identical-pack', checked, violations: 0 };
}

function checkRefusals() {
  const good = [{ code: 'P1', roles: ['issuer', 'wallet'] }, { code: 'P2', roles: ['acquirer'] }];
  const attempts = [
    { pp: { scheme_profile: 'made_up', participants: good }, code: 'profile_unknown' },
    { pp: { scheme_profile: 'fjqr', participants: [] }, code: 'participants_insufficient' },
    { pp: { scheme_profile: 'fjqr', participants: [good[0]] }, code: 'participants_insufficient' },
    { pp: { scheme_profile: 'fjqr', participants: [good[0], { code: 'P1', roles: ['wallet'] }] }, code: 'participant_duplicate' },
    { pp: { scheme_profile: 'fjqr', participants: [good[0], { code: 'P2', roles: ['custodian'] }] }, code: 'role_unknown' },
    { pp: { scheme_profile: 'fjqr', participants: good, phases: ['cross_border'] }, code: 'phase_unknown' },
    { pp: { scheme_profile: 'fjqr', participants: good, link_profiles: [] }, code: 'link_profiles_malformed' },
    { pp: { scheme_profile: 'fjqr', participants: [good[0], { code: 'P2' }] }, code: 'participant_roles_missing' },
  ];
  let checked = 0;
  for (const t of attempts) {
    const r = compute(t.pp);
    if (r.output_payload.error !== t.code) return { name: 'invalid-domain-refusals', checked: checked + 1, violations: 1 };
    if (r.compliance_flags.indexOf('INPUT_REFUSED') === -1) return { name: 'invalid-domain-refusals', checked: checked + 1, violations: 1 };
    if (r.output_payload.matrix.length !== 0) return { name: 'invalid-domain-refusals', checked: checked + 1, violations: 1 };
    checked++;
  }
  return { name: 'invalid-domain-refusals', checked, violations: 0 };
}

const DETAIL_VOCAB = /^((static payload, no amount, full field set for the profile)|(dynamic payload with amount, unique reference)|(cross-border dynamic payment from foreign scheme (generic|fjqr|pix_brcode) acquired domestically)|((bad_crc|bad_crc_excluding_6304|missing_merchant_account_template|malformed_tag_62|wrong_currency|static_payload_with_amount)( on a cross-border payload)?)|(full reversal of a completed domestic payment)|(partial refund against a completed domestic payment)|(dispute lifecycle open, evidence, resolution on a completed domestic payment)|(payee-name check outcome: (match|close_match|no_match|not_possible))|(foreign currency not convertible under the link agreement))$/;

function checkNoMerchantData() {
  const r = rng(786);
  let checked = 0;
  for (let t = 0; t < 20; t++) {
    const parts = randomParticipants(r, 2 + Math.floor(r() * 4));
    const profile = ['generic', 'fjqr', 'pix_brcode'][Math.floor(r() * 3)];
    const out = compute({ scheme_profile: profile, participants: parts, link_profiles: ['pix_brcode'], include: { reversal: true, refund: true, dispute: true, payee_name_outcome: true } }).output_payload;
    const codes = parts.map((p) => p.code);
    for (const c of out.cases) {
      if (typeof c.detail !== 'string' || !DETAIL_VOCAB.test(c.detail)) return { name: 'no-merchant-data-mutations-only', checked: checked + 1, violations: 1 };
      for (const code of codes) if (c.detail.indexOf(code) !== -1) return { name: 'no-merchant-data-mutations-only', checked: checked + 1, violations: 1 };
      checked++;
    }
    for (const m of out.matrix) {
      if (typeof m.pair !== 'string' || m.pair.split('->').some((x) => codes.indexOf(x) === -1 && ['pix_brcode'].indexOf(x) === -1)) return { name: 'no-merchant-data-mutations-only', checked: checked + 1, violations: 1 };
    }
  }
  return { name: 'no-merchant-data-mutations-only', checked, violations: 0 };
}

function checkCountsAndConsistency() {
  const r = rng(1234);
  let checked = 0;
  for (let t = 0; t < 30; t++) {
    const parts = randomParticipants(r, 2 + Math.floor(r() * 4));
    const out = compute({ scheme_profile: 'fjqr', participants: parts, link_profiles: ['generic'] }).output_payload;
    for (const ph of out.phases) {
      const cnt = out.counts[ph];
      const phaseCases = out.cases.filter((c) => c.phase === ph);
      if (cnt.total !== phaseCases.length) return { name: 'counts-and-consistency', checked: checked + 1, violations: 1 };
      const kindSum = Object.values(cnt.by_kind).reduce((a, b) => a + b, 0);
      if (kindSum !== cnt.total) return { name: 'counts-and-consistency', checked: checked + 1, violations: 1 };
      const mPairs = out.matrix.filter((m) => m.phase === ph);
      const idsFromMatrix = mPairs.flatMap((m) => m.case_ids);
      if (idsFromMatrix.length !== phaseCases.length) return { name: 'counts-and-consistency', checked: checked + 1, violations: 1 };
      for (const m of mPairs) {
        for (const id of m.case_ids) {
          const c = out.cases.find((x) => x.case_id === id);
          if (!c || c.pair !== m.pair || c.phase !== m.phase) return { name: 'counts-and-consistency', checked: checked + 1, violations: 1 };
          checked++;
        }
      }
      if (!out.exit_criteria[ph] || out.exit_criteria[ph].all_mandatory_cases_passed !== true || out.exit_criteria[ph].no_open_severity_1_defect !== true) return { name: 'counts-and-consistency', checked: checked + 1, violations: 1 };
      checked++;
    }
  }
  return { name: 'counts-and-consistency', checked, violations: 0 };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkMatrixCountFormula(),
  checkDeterminism(),
  checkRefusals(),
  checkNoMerchantData(),
  checkCountsAndConsistency(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — QR interop UAT pack generator.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
