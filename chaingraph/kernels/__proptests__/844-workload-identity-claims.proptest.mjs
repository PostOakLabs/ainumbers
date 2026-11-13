// 844-workload-identity-claims — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:494b91961235d031a1c0eb8d2467b16b37c5e8784d0a8a4d86940741769f957f
// spec: C:/dev/Claude/Projects/AINumbers/board/claimed/WORKLOAD-IDENTITY-CLAIMS-NODE-1.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/844-workload-identity-claims.proptest.mjs

import { compute } from '../844-workload-identity-claims.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '844-workload-identity-claims';

const POLICY = { max_lifetime_seconds: 3600, max_actor_depth: 2, required_audiences: ['svc-a'], allowed_trust_domains: ['example.org'], scope_must_narrow: true, clock_now_epoch_seconds: 1700000100 };
const SUBJECT = { sub: 'spiffe://example.org/ns/prod/sa/api', aud: ['svc-a'], iat: 1700000000, exp: 1700003000, scope: 'read write' };
const EXCHANGED = { sub: 'spiffe://example.org/ns/prod/sa/db', aud: ['svc-a'], iat: 1700000050, exp: 1700001050, scope: 'read', act: { sub: 'spiffe://example.org/ns/prod/sa/api' } };
const clone = (o) => JSON.parse(JSON.stringify(o));

// Dropping any required claim from either token never yields WITHIN_POLICY.
function checkDropRequiredClaim() {
  let checked = 0, violations = 0;
  const base = compute({ policy: POLICY, subject_claims: SUBJECT, exchanged_claims: EXCHANGED });
  checked++; if (base.output_payload.verdict !== 'WITHIN_POLICY') violations++;
  for (const which of ['subject_claims', 'exchanged_claims']) {
    for (const k of ['sub', 'aud', 'exp', 'iat', 'scope']) {
      const pp = { policy: clone(POLICY), subject_claims: clone(SUBJECT), exchanged_claims: clone(EXCHANGED) };
      delete pp[which][k];
      const r = compute(pp);
      checked++;
      if (r.output_payload.verdict === 'WITHIN_POLICY') violations++;
    }
  }
  return { name: 'dropping_required_claim_never_within_policy', checked, violations };
}

// Any compact-JWS-shaped string or signature-named key is refused, never linted.
function checkRefusals() {
  let checked = 0, violations = 0;
  const jws = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln';
  for (const k of ['scope', 'sub', 'resource']) {
    const pp = { policy: clone(POLICY), subject_claims: Object.assign(clone(SUBJECT), { [k]: jws }) };
    checked++; if (compute(pp).output_payload.verdict !== 'INPUT_REFUSED') violations++;
  }
  for (const k of ['signature', 'jws', 'token', 'header']) {
    const pp = { policy: clone(POLICY), subject_claims: Object.assign(clone(SUBJECT), { [k]: 'x' }) };
    checked++; if (compute(pp).output_payload.verdict !== 'INPUT_REFUSED') violations++;
  }
  return { name: 'jws_and_signature_inputs_always_refused', checked, violations };
}

// Refusal flag form and the never-verified-signature field hold across every shape.
function checkFlagsAndSignatureField() {
  let checked = 0, violations = 0;
  const cases = [
    { policy: POLICY, subject_claims: SUBJECT },
    { policy: POLICY, subject_claims: SUBJECT, exchanged_claims: EXCHANGED },
    { policy: POLICY, subject_claims: { sub: 'x' } },
    { policy: {}, subject_claims: SUBJECT },
    {},
  ];
  for (const pp of cases) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.signature_verified !== false) violations++;
    const refused = r.output_payload.verdict === 'INPUT_REFUSED';
    if (refused !== (r.compliance_flags.indexOf('INPUT_REFUSED') >= 0)) violations++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(r)) violations++;
  }
  return { name: 'flags_and_signature_field_invariants', checked, violations };
}

// A widened exchanged scope is always OUTSIDE_POLICY when narrowing is required.
function checkWidenedScope() {
  let checked = 0, violations = 0;
  for (const extra of ['admin', 'write', 'x:y']) {
    const s = clone(SUBJECT); s.scope = 'read';
    const x = clone(EXCHANGED); x.scope = 'read ' + extra;
    checked++;
    if (compute({ policy: POLICY, subject_claims: s, exchanged_claims: x }).output_payload.verdict !== 'OUTSIDE_POLICY') violations++;
  }
  return { name: 'widened_scope_is_outside_policy', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDropRequiredClaim(),
  checkRefusals(),
  checkFlagsAndSignatureField(),
  checkWidenedScope(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
