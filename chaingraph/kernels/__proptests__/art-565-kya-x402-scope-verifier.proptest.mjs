// art-565-kya-x402-scope-verifier.proptest.mjs -- FV property-test FLOOR (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:f6c593e542fe2fbd5e4226a231dff7ce88a280d8fa68cc757c9fe6602afe29f3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- confirmed by direct source read (matches the WU row). Every comparison is
// either a string equality/inclusion check (caseInsensitiveIncludes), a digit-only unsigned-integer
// string compare (cmpUnsignedIntStrings, lexical after leading-zero strip, no Number() division or
// multiplication anywhere), or a safe-integer unix-seconds compare (unixSecondsOrNull gates via
// Number.isSafeInteger). There is no division, no percentage, no toFixed()/rounding anywhere in the
// file. Forced categorical boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (exactly 5 evaluable checks are attempted whenever both
// declared objects are present -- rejected_inputs/indeterminate_reasons are bounded, never unbounded),
// differential re-derivation of the verdict from findings/indeterminate_reasons, metamorphic
// permutation-invariance of the allowlist/scope arrays (order must never change a verdict), and forced
// categorical boundary cases (exact spend-cap boundary, exact validity-window boundary, case-
// insensitive matching, each claim missing one at a time).
//
// Run: node chaingraph/kernels/__proptests__/art-565-kya-x402-scope-verifier.proptest.mjs

import { compute } from '../art-565-kya-x402-scope-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-565-kya-x402-scope-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x56500);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const NETWORKS = ['base', 'ethereum', 'polygon'];
const ASSETS = ['0xAAA', '0xBBB'];
const PAYEES = ['0xMERCHANT1', '0xMERCHANT2'];

function randomCred(rng) {
  const cred = {
    sub: 'buyer-' + Math.floor(rng() * 5),
    aud: 'seller-' + Math.floor(rng() * 5),
    ssi: 'svc-' + Math.floor(rng() * 5),
    iat: 1754400000 + Math.floor(rng() * 1000),
  };
  cred.exp = cred.iat + 100000 + Math.floor(rng() * 1000);
  if (rng() < 0.85) cred.spend_cap_amt = String(1000 + Math.floor(rng() * 10000000));
  if (rng() < 0.85) cred.allowed_networks = [pick(rng, NETWORKS), pick(rng, NETWORKS)];
  if (rng() < 0.85) cred.allowed_assets = [pick(rng, ASSETS)];
  if (rng() < 0.85) cred.payee_allowlist = [pick(rng, PAYEES), pick(rng, PAYEES)];
  if (rng() < 0.85) cred.scope = [`payments:x402:${pick(rng, ['exact', 'exact-v2'])}`];
  return cred;
}

function randomPayload(rng, cred) {
  const validAfter = cred.iat + Math.floor(rng() * 500);
  const validBefore = validAfter + 100 + Math.floor(rng() * 500);
  return {
    x402Version: 1,
    scheme: pick(rng, ['exact', 'exact-v2']),
    network: pick(rng, NETWORKS),
    asset: pick(rng, ASSETS),
    payload: {
      signature: '0xsig',
      authorization: {
        from: '0xBUYER',
        to: pick(rng, PAYEES),
        value: String(Math.floor(rng() * 20000000)),
        validAfter,
        validBefore,
        nonce: '0x01',
      },
    },
  };
}

function randomPP(rng) {
  const includeCred = rng() < 0.95;
  const includePay = rng() < 0.95;
  const cred = includeCred ? randomCred(rng) : null;
  const pay = includePay ? randomPayload(rng, cred || { iat: 1754400000 }) : null;
  const pp = {};
  if (cred) pp.kya_credential = cred;
  if (pay) pp.x402_payload = pay;
  return pp;
}

const TRIALS = 4000;

// ---------- P1: termination -- at most 6 findings + indeterminate_reasons whenever both objects are
// present (5 check GROUPS: group 2 "network/asset vs allowed set" alone can emit 2 findings when it
// runs, or 1 indeterminate_reason when it does not -- so the total is bounded to {5, 6}, never
// unbounded and never fewer than 5). ------------------------------------------------------------------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const bothPresent = pp.kya_credential !== undefined && pp.x402_payload !== undefined;
    if (bothPresent) {
      const total = output_payload.findings.length + output_payload.indeterminate_reasons.length;
      if (total !== 5 && total !== 6) violations++;
      if (output_payload.rejected_inputs.length !== 0) violations++;
    } else {
      if (output_payload.verdict !== 'INDETERMINATE') violations++;
      if (output_payload.rejected_inputs.length < 1 || output_payload.rejected_inputs.length > 2) violations++;
    }
  }
  return { name: 'P1_exactly_five_checks_bounded_rejected_inputs', trials: checked, violations };
}

// ---------- P2 (differential): verdict re-derived from findings/indeterminate_reasons ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const bothPresent = pp.kya_credential !== undefined && pp.x402_payload !== undefined;
    let expected;
    if (!bothPresent) expected = 'INDETERMINATE';
    else {
      const anyFail = output_payload.findings.some((f) => f.pass === false);
      if (anyFail) expected = 'OUT_OF_SCOPE';
      else if (output_payload.indeterminate_reasons.length > 0) expected = 'INDETERMINATE';
      else expected = 'IN_SCOPE';
    }
    if (output_payload.verdict !== expected) violations++;
  }
  return { name: 'P2_verdict_differential_from_findings', trials: checked, violations };
}

// ---------- P3: metamorphic -- reordering allowlist/scope arrays never changes the verdict ----------
function checkP3_allowlist_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (!pp.kya_credential || !pp.x402_payload) continue;
    const cred = pp.kya_credential;
    const reversed = {
      ...cred,
      allowed_networks: cred.allowed_networks ? [...cred.allowed_networks].reverse() : undefined,
      allowed_assets: cred.allowed_assets ? [...cred.allowed_assets].reverse() : undefined,
      payee_allowlist: cred.payee_allowlist ? [...cred.payee_allowlist].reverse() : undefined,
      scope: cred.scope ? [...cred.scope].reverse() : undefined,
    };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, kya_credential: reversed }).output_payload;
    if (r1.verdict !== r2.verdict) violations++;
    // Compare pass/check only -- `detail` embeds JSON.stringify() of the (now-reversed) array itself,
    // so the detail TEXT legitimately differs while the PASS/FAIL outcome must not.
    const strip = (fs) => fs.map((f) => ({ check: f.check, pass: f.pass }));
    if (JSON.stringify(strip(r1.findings)) !== JSON.stringify(strip(r2.findings))) violations++;
  }
  return { name: 'P3_allowlist_reversal_order_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception -- no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const baseCred = { sub: 's', aud: 'a', ssi: 'x', iat: 1000, exp: 2000, spend_cap_amt: '100', allowed_networks: ['base'], allowed_assets: ['0xA'], payee_allowlist: ['0xM'], scope: ['payments:x402:exact'] };
  const basePay = { x402Version: 1, scheme: 'exact', network: 'base', asset: '0xA', payload: { authorization: { to: '0xM', value: '100', validAfter: 1000, validBefore: 2000 }, signature: '0xs' } };

  // exact spend-cap boundary: value === cap -> within, pass=true
  checked++;
  {
    const r = compute({ kya_credential: baseCred, x402_payload: basePay }).output_payload;
    if (r.findings[0].pass !== true || r.verdict !== 'IN_SCOPE') violations++;
  }
  // one unit over cap -> fail, OUT_OF_SCOPE
  checked++;
  {
    const pay = { ...basePay, payload: { ...basePay.payload, authorization: { ...basePay.payload.authorization, value: '101' } } };
    const r = compute({ kya_credential: baseCred, x402_payload: pay }).output_payload;
    if (r.findings[0].pass !== false || r.verdict !== 'OUT_OF_SCOPE') violations++;
  }
  // leading-zero unsigned-int-string comparison: "0100" spend cap equals "100"
  checked++;
  {
    const cred = { ...baseCred, spend_cap_amt: '0100' };
    const r = compute({ kya_credential: cred, x402_payload: basePay }).output_payload;
    if (r.findings[0].pass !== true) violations++;
  }
  // validity window exact boundary: validAfter===iat, validBefore===exp -> within
  checked++;
  {
    const r = compute({ kya_credential: baseCred, x402_payload: basePay }).output_payload;
    const f = r.findings.find((x) => x.check === 'validity_window_vs_payload_timestamp');
    if (f.pass !== true) violations++;
  }
  // validAfter one tick before iat -> fails window
  checked++;
  {
    const pay = { ...basePay, payload: { ...basePay.payload, authorization: { ...basePay.payload.authorization, validAfter: 999 } } };
    const r = compute({ kya_credential: baseCred, x402_payload: pay }).output_payload;
    const f = r.findings.find((x) => x.check === 'validity_window_vs_payload_timestamp');
    if (f.pass !== false || r.verdict !== 'OUT_OF_SCOPE') violations++;
  }
  // case-insensitive network match: credential upper-case, payload lower-case
  checked++;
  {
    const cred = { ...baseCred, allowed_networks: ['BASE'] };
    const r = compute({ kya_credential: cred, x402_payload: basePay }).output_payload;
    const f = r.findings.find((x) => x.check === 'network_vs_allowed_set');
    if (f.pass !== true) violations++;
  }
  // credential omits scope -> indeterminate reason present, verdict INDETERMINATE (all else passing)
  checked++;
  {
    const cred = { ...baseCred }; delete cred.scope;
    const r = compute({ kya_credential: cred, x402_payload: basePay }).output_payload;
    if (r.verdict !== 'INDETERMINATE' || r.indeterminate_reasons.length !== 1) violations++;
  }
  // neither object supplied -> INDETERMINATE, 2 rejected_inputs
  checked++;
  {
    const r = compute({}).output_payload;
    if (r.verdict !== 'INDETERMINATE' || r.rejected_inputs.length !== 2) violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_allowlist_order_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-565-kya-x402-scope-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
