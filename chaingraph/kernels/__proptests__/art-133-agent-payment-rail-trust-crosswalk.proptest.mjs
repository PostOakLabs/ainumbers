// art-133-agent-payment-rail-trust-crosswalk property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:a7e15f563cd47402550a3b4c1164e8dcc35ca0576feb53d0ab18cf0971a9b8bf
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: a fixed CHECKS object
// (ed25519, directory_published, card_present, signature_verified) fed through a per-rail
// `rail()` helper that produces a gaps array per of 3 named rails -- three parallel instances
// of the "fixed CHECKS object -> gap list" class-A sub-family named in
// FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence, composed into one kernel.
// float:no (declared string enum + booleans, no numeric float fields) -- forced CATEGORICAL
// boundary cases (all 16 combinations of the 4 governing booleans/enum) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-133-agent-payment-rail-trust-crosswalk.proptest.mjs

import { compute } from '../art-133-agent-payment-rail-trust-crosswalk.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mulberry32, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-133-agent-payment-rail-trust-crosswalk';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildProfile(alg, directoryPublished, cardPresent, signatureVerified) {
  return { alg, directory_published: directoryPublished, card_present: cardPresent, signature_verified: signatureVerified };
}

function expectedRails(pp) {
  const ed = pp.alg === 'ed25519', dir = pp.directory_published === true, card = pp.card_present === true, sig = pp.signature_verified === true;
  const rail = (reqs) => { const gaps = Object.entries(reqs).filter(([, ok]) => !ok).map(([k]) => k); return { accepted: gaps.length === 0, gaps }; };
  return {
    web_bot_auth: rail({ ed25519: ed, directory_published: dir, signature_verified: sig }),
    visa_tap: rail({ ed25519: ed, directory_published: dir, signature_verified: sig }),
    mastercard_agent_pay: rail({ signature_verified: sig, agent_card_present: card }),
  };
}

function randomProfile(rng) {
  const alg = rng() < 0.5 ? 'ed25519' : 'rsa-pss';
  return buildProfile(alg, rng() < 0.5, rng() < 0.5, rng() < 0.5);
}

// P1: each rail's accepted/gaps and any_accepted are correct re-derivations.
async function checkP1_checksDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(133001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expRails = expectedRails(pp);
    if (JSON.stringify(op.rails) !== JSON.stringify(expRails)) violations++;
    const expAny = Object.values(expRails).some((r) => r.accepted);
    if (op.any_accepted !== expAny) violations++;
  }
  return { name: 'P1_checks_derivation_random300', checked, violations };
}

// P2: forced categorical boundary cases -- all 16 combinations of the 4 governing
// booleans/enum (alg x directory_published x card_present x signature_verified).
async function checkP2_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const alg of ['ed25519', 'rsa-pss']) {
    for (const directoryPublished of [true, false]) {
      for (const cardPresent of [true, false]) {
        for (const signatureVerified of [true, false]) {
          const pp = buildProfile(alg, directoryPublished, cardPresent, signatureVerified);
          const { output_payload: op } = await compute(pp);
          checked++;
          const expRails = expectedRails(pp);
          if (JSON.stringify(op.rails) !== JSON.stringify(expRails)) violations++;
        }
      }
    }
  }
  return { name: 'P2_forced_categorical_boundary_cases_all_16', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, all 3 rails always present.
async function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { alg: 'ed25519' }, { directory_published: true }, { card_present: true, signature_verified: true }];
  for (const pp of inputs) {
    const { output_payload: op } = await compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.any_accepted !== 'boolean') violations++;
    if (!('web_bot_auth' in op.rails) || !('visa_tap' in op.rails) || !('mastercard_agent_pay' in op.rails)) violations++;
  }
  return { name: 'P3_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
async function main() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`);
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    if (JSON.stringify(output_payload) !== JSON.stringify(vec.output_payload)) {
      failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
    }
  }
  const oracleResult = { total: fixtures.vectors.length, failures };
  if (oracleResult.failures.length > 0) {
    console.error('FIXTURE ORACLE FAILED --', JSON.stringify(oracleResult.failures, null, 2));
    process.exit(1);
  }

  const controlPP = buildProfile('ed25519', true, true, true);
  const { output_payload: controlOp } = await compute(controlPP);
  const mutated = { ...controlOp, any_accepted: !controlOp.any_accepted };
  const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
  if (!negativeControlOk) {
    console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
    process.exit(1);
  }

  const properties = [
    await checkP1_checksDerivation(),
    await checkP2_forcedCategoricalBoundaries(),
    await checkP3_outputShapeInvariant(),
  ];

  const ok = summarize(KERNEL_ID, oracleResult, properties);
  process.exit(ok ? 0 : 1);
}

main();
