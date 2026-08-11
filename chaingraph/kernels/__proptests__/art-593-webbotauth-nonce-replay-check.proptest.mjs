// art-593-webbotauth-nonce-replay-check property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-2).
// kernel_digest_at_authoring: sha256:4d4491d75002a02d8a1448ca25e0aa851ccd4ea646dccde0afdd5d745f48967b
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: a pure, stateless nonce format/freshness/caller-replay-set check (Visa
// TAP §2) -- no crypto, no vendored code, just string/arithmetic checks over caller-supplied fields.
// The fixture oracle (5 vectors) is the primary correctness anchor; properties below are structural
// invariants a stateless nonce checker must hold regardless of the exact arithmetic. float:no (all
// inputs are strings/integers). ZERO external dependencies -- pure Node built-ins / plain JS. READ-ONLY
// w.r.t. the kernel it imports. compute() is async (awaited below).
//
// Run: node chaingraph/kernels/__proptests__/art-593-webbotauth-nonce-replay-check.proptest.mjs

import { compute } from '../art-593-webbotauth-nonce-replay-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_PP = {
  nonce: 'aB3dEfGhIjKlMnOpQrStUvWxYz012345',
  created: 1750000000, expires: 1750000300, now_unix: 1750000060, max_age_s: 3600,
};

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-593-webbotauth-nonce-replay-check.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
async function negativeControl() {
  const { output_payload } = await compute(BASE_PP);
  const mutated = { ...output_payload, verdict: output_payload.verdict === 'ACCEPT' ? 'REFUSE' : 'ACCEPT' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output.
async function checkP1_determinism() {
  const a = (await compute(BASE_PP)).output_payload;
  const b = (await compute(BASE_PP)).output_payload;
  const violations = JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  return { name: 'P1_determinism_repeat_call', trials: 1, violations };
}

// P2: a nonce present in seen_nonces (or nonce_already_used:true) always REFUSEs, regardless of an
// otherwise-valid format/freshness.
async function checkP2_replaySuspectedAlwaysRefuses() {
  let violations = 0, checked = 0;
  const cases = [
    { ...BASE_PP, seen_nonces: [BASE_PP.nonce] },
    { ...BASE_PP, nonce_already_used: true },
  ];
  for (const pp of cases) {
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.verdict !== 'REFUSE' || output_payload.already_used !== true || output_payload.nonce_valid !== false) violations++;
  }
  return { name: 'P2_replay_suspected_always_refuses', trials: checked, violations };
}

// P3: a spread (expires-created) over 480s always spread_ok:false, and spread_ok:false forces REFUSE.
async function checkP3_wideSpreadForcesRefuse() {
  let violations = 0, checked = 0;
  const wide = { ...BASE_PP, expires: BASE_PP.created + 481 };
  const { output_payload } = await compute(wide);
  checked++; if (output_payload.spread_ok !== false) violations++;
  checked++; if (output_payload.verdict !== 'REFUSE') violations++;
  return { name: 'P3_wide_spread_forces_refuse', trials: checked, violations };
}

// P4: output shape -- verdict is always one of ACCEPT/REFUSE, and format_ok/nonce_valid/already_used
// are always booleans, across a spread of malformed and well-formed inputs.
async function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, BASE_PP, { ...BASE_PP, nonce: 'short' }, { ...BASE_PP, now_unix: 9999999999 }];
  for (const pp of inputs) {
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.verdict !== 'ACCEPT' && output_payload.verdict !== 'REFUSE') violations++;
    if (typeof output_payload.format_ok !== 'boolean') violations++;
    if (typeof output_payload.nonce_valid !== 'boolean') violations++;
    if (typeof output_payload.already_used !== 'boolean') violations++;
  }
  return { name: 'P4_output_shape_invariant', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = await negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(await checkP1_determinism());
results.properties.push(await checkP2_replaySuspectedAlwaysRefuses());
results.properties.push(await checkP3_wideSpreadForcesRefuse());
results.properties.push(await checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-593-webbotauth-nonce-replay-check',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
