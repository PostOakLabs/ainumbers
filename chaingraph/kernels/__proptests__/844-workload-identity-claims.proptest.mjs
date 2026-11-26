// 844-workload-identity-claims — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:e4313b344850b2c7040ae269adb56f5cbdd1c8a9007d44b071c872a31bd3837d
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

// exp, iat and nbf must be integer epoch seconds: strings (including impossible calendar
// dates), floats, booleans, null and negative integers never reach a lint verdict.
function checkNumericDateTyping() {
  let checked = 0, violations = 0;
  for (const k of ['exp', 'iat', 'nbf']) {
    for (const v of ['2026-02-31', '2026-13-45', '0000-00-00', '1700003000', 1.5, true, null]) {
      const s = clone(SUBJECT); s[k] = v;
      checked++;
      const r = compute({ policy: clone(POLICY), subject_claims: s }).output_payload;
      if (r.verdict !== 'INPUT_REFUSED') violations++;
    }
    const s = clone(SUBJECT); s[k] = 1700000000;
    checked++;
    if (compute({ policy: clone(POLICY), subject_claims: s }).output_payload.verdict === 'INPUT_REFUSED') violations++;
    const neg = clone(SUBJECT); neg[k] = -1;
    checked++;
    const rn = compute({ policy: clone(POLICY), subject_claims: neg }).output_payload;
    if (rn.verdict !== 'INPUT_REFUSED' || rn.refusal_codes.indexOf('NUMERIC_DATE_OUT_OF_RANGE') < 0) violations++;
  }
  return { name: 'numeric_dates_typed_and_ranged', checked, violations };
}

// may_act and act must be one well-formed actor object with a string sub, or absent.
function checkMayActShape() {
  let checked = 0, violations = 0;
  for (const v of [{}, [], ['x'], 'someone', 5, 1.5, { sub: 7 }, { sub: null }, { other: 'x' }]) {
    const s = clone(SUBJECT); s.may_act = v;
    checked++;
    if (compute({ policy: clone(POLICY), subject_claims: s }).output_payload.verdict !== 'INPUT_REFUSED') violations++;
    const x = clone(EXCHANGED); x.act = v;
    checked++;
    if (compute({ policy: clone(POLICY), subject_claims: clone(SUBJECT), exchanged_claims: x }).output_payload.verdict !== 'INPUT_REFUSED') violations++;
  }
  const ok = clone(SUBJECT); ok.may_act = { sub: 'spiffe://example.org/ns/prod/sa/db' };
  checked++;
  if (compute({ policy: clone(POLICY), subject_claims: ok }).output_payload.verdict === 'INPUT_REFUSED') violations++;
  return { name: 'may_act_is_one_actor_object', checked, violations };
}

// aud, scope and resource entries are strings: scalar numbers and numeric entries are refused.
function checkScopeResourceEntryTypes() {
  let checked = 0, violations = 0;
  for (const k of ['scope', 'resource', 'aud']) {
    for (const v of [0, -1, 1.5, false]) {
      const s = clone(SUBJECT); s[k] = v;
      checked++;
      if (compute({ policy: clone(POLICY), subject_claims: s }).output_payload.verdict !== 'INPUT_REFUSED') violations++;
    }
    for (const v of [[0], [-1], [1.5], ['ok', 0]]) {
      const s = clone(SUBJECT); s[k] = v;
      checked++;
      if (compute({ policy: clone(POLICY), subject_claims: s }).output_payload.verdict !== 'INPUT_REFUSED') violations++;
    }
  }
  const s = clone(SUBJECT); s.resource = ['doc:844/read'];
  checked++;
  if (compute({ policy: clone(POLICY), subject_claims: s }).output_payload.verdict !== 'WITHIN_POLICY') violations++;
  return { name: 'scope_resource_entries_are_strings', checked, violations };
}

// A present-but-malformed (empty) scope gets the same SCOPE_MALFORMED code whether or not an
// exchange accompanies the request, and is not judged when narrowing is off, both shapes alike.
function checkEmptyScopeConsistency() {
  let checked = 0, violations = 0;
  const shapes = [
    { mk: (s) => ({ policy: clone(POLICY), subject_claims: s }) },
    { mk: (s) => ({ policy: clone(POLICY), subject_claims: s, exchanged_claims: clone(EXCHANGED) }) },
  ];
  for (const sh of shapes) {
    const s = clone(SUBJECT); s.scope = '';
    const r = compute(sh.mk(s)).output_payload;
    checked++;
    if (r.verdict !== 'OUTSIDE_POLICY' || r.outside_findings.join(',').indexOf('SCOPE_MALFORMED') < 0) violations++;
    const off = sh.mk(s); off.policy = Object.assign(clone(POLICY), { scope_must_narrow: false });
    checked++;
    if (compute(off).output_payload.outside_findings.join(',').indexOf('SCOPE_MALFORMED') >= 0) violations++;
  }
  return { name: 'empty_scope_same_code_both_shapes', checked, violations };
}

// With no subject resource, every exchanged resource is wider than the subject set.
function checkExchangeResourceWithoutSubject() {
  let checked = 0, violations = 0;
  const x = clone(EXCHANGED); x.resource = ['doc:844/read'];
  const r = compute({ policy: clone(POLICY), subject_claims: clone(SUBJECT), exchanged_claims: x }).output_payload;
  checked++;
  if (r.verdict !== 'OUTSIDE_POLICY' || r.outside_findings.indexOf('exchanged:RESOURCE_WIDER_THAN_SUBJECT') < 0) violations++;
  const s = clone(SUBJECT); s.resource = ['doc:844/read', 'doc:844/write'];
  const ok = compute({ policy: clone(POLICY), subject_claims: s, exchanged_claims: x }).output_payload;
  checked++;
  if (ok.verdict !== 'WITHIN_POLICY') violations++;
  return { name: 'exchanged_resource_checked_without_subject_resource', checked, violations };
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
  checkNumericDateTyping(),
  checkMayActShape(),
  checkScopeResourceEntryTypes(),
  checkEmptyScopeConsistency(),
  checkExchangeResourceWithoutSubject(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
