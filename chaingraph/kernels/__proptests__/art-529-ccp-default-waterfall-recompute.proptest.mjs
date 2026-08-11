// art-529-ccp-default-waterfall-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:1fa3932e10c166675cb5eaf1c41a165ee448e916df2086e1cf963e95ee4a2f97
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. recomputeWaterfall() is pure integer
// minor-units arithmetic: Math.min/subtraction over safe-integer capacities, no division, no
// multiplication that could produce a fraction, and the uncapped-assessment-powers sentinel is
// Number.MAX_SAFE_INTEGER (a finite integer, never a float ratio). commitPrivateInput() does
// hex-to-byte parsing (parseInt base 16) and a WebCrypto SHA-256 digest — no floating-point
// arithmetic anywhere in the file. Forced categorical boundary cases are used, not ULP forcing.
// PRIVATE-INPUT NODE (OCG Standard §25 ocg-private-input@1): the real waterfall recompute lives in
// buildArtifact(), which takes the PLAINTEXT witness (defaulter IM, defaulter default-fund
// contribution, surviving-member default-fund pool, salt) and commits it via sha256-salted@1 — never
// echoed in policy_parameters or output_payload. compute(pp) is a decoy contract that only echoes the
// caller-declared loss amount and never derives a waterfall verdict from policy_parameters alone (per
// SPEC.md §18.3), exactly art-413/art-415's private-input shape.
// Checks: fixture-oracle gate (via buildArtifact against the private witness in the .disclosure.json
// sidecar, same shape as art-413/art-415), a decoy compute() contract check (P0), termination (P1:
// steps.length never exceeds the caller-declared waterfall_structure length, itself capped at the 5
// known stage types), a loss-conservation boundedness identity (P2: sum of every step's
// absorbed_minor_units plus the final residual_minor_units always equals the declared loss amount --
// exact integer arithmetic, no rounding), a differential re-derivation of the sequential absorption
// against an independent reimplementation (P3), a loss-amount monotonicity metamorphic identity (P4:
// increasing the declared loss can never decrease the residual), and forced categorical boundary
// cases (P5: empty waterfall_structure, uncapped vs capped assessment_powers, loss exactly exhausting
// a stage's capacity).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled). Uses the
// runtime's real globalThis.crypto.subtle (Node 19+ WebCrypto) for the commitment digest, exactly as
// production does.
//
// Run: node chaingraph/kernels/__proptests__/art-529-ccp-default-waterfall-recompute.proptest.mjs

import { compute, buildArtifact } from '../art-529-ccp-default-waterfall-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-529-ccp-default-waterfall-recompute.fixtures.json');
  const disclosurePath = path.join(__dirname, '..', 'fixtures', 'art-529-ccp-default-waterfall-recompute.disclosure.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const disclosure = JSON.parse(readFileSync(disclosurePath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const disc = disclosure.vectors.find((d) => d.name === vec.name);
    const raw = {
      ...vec.policy_parameters,
      defaulter_im_minor_units: disc.input_value.defaulter_im_minor_units,
      defaulter_default_fund_minor_units: disc.input_value.defaulter_default_fund_minor_units,
      surviving_member_default_fund_pool_minor_units: disc.input_value.surviving_member_default_fund_pool_minor_units,
      salt: disc.salt,
    };
    delete raw.member_figures_commitment;
    const artifact = await buildArtifact(raw);
    const a = JSON.stringify(artifact.output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: artifact.output_payload });
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
const rand = mulberry32(0x529C27);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const SALT = 'c1c384a6e64b95ac12db9de1fe3bede49808888215e91e6477a600daf395bc1c';

const ALL_STAGES = ['defaulter_im', 'defaulter_default_fund', 'ccp_skin_in_game', 'surviving_member_default_fund_pro_rata', 'assessment_powers'];

function randomStructure(rng) {
  const shuffled = [...ALL_STAGES].sort(() => rng() - 0.5);
  const n = 1 + Math.floor(rng() * ALL_STAGES.length);
  return shuffled.slice(0, n);
}
function randomAmount(rng, max) { return Math.floor(rng() * max); }

function randomRaw(rng) {
  const capDeclared = rng() < 0.7;
  return {
    currency: 'USD',
    waterfall_structure: randomStructure(rng),
    loss_amount_minor_units: randomAmount(rng, 500000000000),
    ccp_skin_in_game_minor_units: randomAmount(rng, 50000000000),
    assessment_powers_cap_declared: capDeclared,
    assessment_powers_cap_minor_units: capDeclared ? randomAmount(rng, 200000000000) : null,
    defaulter_im_minor_units: randomAmount(rng, 5000000000),
    defaulter_default_fund_minor_units: randomAmount(rng, 5000000000),
    surviving_member_default_fund_pool_minor_units: randomAmount(rng, 100000000000),
    salt: SALT,
  };
}

// Independent reimplementation of recomputeWaterfall(), for the differential check (P3).
function reimplement(structure, loss, amountsByStage) {
  let remaining = loss;
  const steps = [];
  for (const stage of structure) {
    const capacity = amountsByStage[stage] ?? 0;
    const absorbed = Math.min(remaining, capacity);
    remaining -= absorbed;
    steps.push({ stage, absorbed_minor_units: absorbed });
    if (remaining === 0) break;
  }
  return { steps, residual_minor_units: remaining };
}
function amountsFor(raw) {
  return {
    defaulter_im: raw.defaulter_im_minor_units,
    defaulter_default_fund: raw.defaulter_default_fund_minor_units,
    ccp_skin_in_game: raw.ccp_skin_in_game_minor_units,
    surviving_member_default_fund_pro_rata: raw.surviving_member_default_fund_pool_minor_units,
    assessment_powers: raw.assessment_powers_cap_declared ? raw.assessment_powers_cap_minor_units : Number.MAX_SAFE_INTEGER,
  };
}

const TRIALS = 1500; // WebCrypto digest calls per trial are more expensive than pure JS

// ---------- P0: decoy compute() contract — never leaks the waterfall recompute from policy_parameters ----------
function checkP0_decoy() {
  let violations = 0, checked = 0;
  for (const loss of [0, 12345, 999999999999]) {
    const r = compute({ loss_amount_minor_units: loss });
    checked++;
    if (r.recomputed !== false) violations++;
    if (r.loss_amount_minor_units !== loss) violations++;
    if ('steps' in r || 'residual_minor_units' in r) violations++;
  }
  const rBad = compute({ loss_amount_minor_units: 'not-a-number' });
  checked++;
  if (rBad.loss_amount_minor_units !== 0) violations++;
  return { name: 'P0_decoy_compute_never_leaks_recompute', trials: checked, violations };
}

// ---------- P1: termination — steps.length never exceeds the declared structure length ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const raw = randomRaw(rand);
    const artifact = await buildArtifact(raw);
    checked++;
    const o = artifact.output_payload;
    if (o.steps.length > raw.waterfall_structure.length) violations++;
    if (o.steps.length > ALL_STAGES.length) violations++;
  }
  return { name: 'P1_termination_steps_bounded_by_structure_length', trials: checked, violations };
}

// ---------- P2: boundedness — loss conservation: sum(absorbed) + residual === declared loss, exact ----------
async function checkP2_loss_conservation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const raw = randomRaw(rand);
    const artifact = await buildArtifact(raw);
    checked++;
    const o = artifact.output_payload;
    const sumAbsorbed = o.steps.reduce((s, st) => s + st.absorbed_minor_units, 0);
    if (sumAbsorbed + o.residual_minor_units !== raw.loss_amount_minor_units) violations++;
    if (o.residual_minor_units < 0) violations++;
    for (const st of o.steps) { if (st.absorbed_minor_units < 0) violations++; }
    if (o.loss_fully_absorbed !== (o.residual_minor_units === 0)) violations++;
    if (o.breach !== !o.loss_fully_absorbed) violations++;
  }
  return { name: 'P2_loss_conservation_and_boundedness', trials: checked, violations };
}

// ---------- P3: differential — sequential absorption re-derived against an independent reimplementation ----------
async function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const raw = randomRaw(rand);
    const artifact = await buildArtifact(raw);
    checked++;
    const expected = reimplement(raw.waterfall_structure, raw.loss_amount_minor_units, amountsFor(raw));
    const o = artifact.output_payload;
    if (o.residual_minor_units !== expected.residual_minor_units) violations++;
    if (o.steps.length !== expected.steps.length) violations++;
    for (let s = 0; s < Math.min(o.steps.length, expected.steps.length); s++) {
      if (o.steps[s].absorbed_minor_units !== expected.steps[s].absorbed_minor_units) violations++;
      if (o.steps[s].stage !== expected.steps[s].stage) violations++;
    }
  }
  return { name: 'P3_sequential_absorption_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — increasing the declared loss never decreases the residual ----------
async function checkP4_loss_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 400; i++) {
    const raw = randomRaw(rand);
    const bumped = { ...raw, loss_amount_minor_units: raw.loss_amount_minor_units + randomAmount(rand, 100000000000) };
    const a = (await buildArtifact(raw)).output_payload;
    const b = (await buildArtifact(bumped)).output_payload;
    checked++;
    if (b.residual_minor_units < a.residual_minor_units) violations++;
  }
  return { name: 'P4_loss_monotonicity_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
async function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty waterfall_structure -> zero steps, full residual, rejected_inputs names it
  {
    const raw = randomRaw(rand);
    raw.waterfall_structure = [];
    const { rejected_inputs, output_payload } = { rejected_inputs: (await buildArtifact(raw)).output_payload.rejected_inputs, output_payload: (await buildArtifact(raw)).output_payload };
    checked++;
    if (output_payload.steps.length !== 0) violations++;
    if (output_payload.residual_minor_units !== raw.loss_amount_minor_units) violations++;
    if (!rejected_inputs.some((r) => r.where === 'waterfall_structure')) violations++;
  }
  // loss exactly exhausts a single-stage capacity -> exhausted_stage_capacity true, fully absorbed
  {
    const raw = { currency: 'USD', waterfall_structure: ['defaulter_im'], loss_amount_minor_units: 500000, ccp_skin_in_game_minor_units: 0, assessment_powers_cap_declared: false, assessment_powers_cap_minor_units: null, defaulter_im_minor_units: 500000, defaulter_default_fund_minor_units: 0, surviving_member_default_fund_pool_minor_units: 0, salt: SALT };
    const o = (await buildArtifact(raw)).output_payload;
    checked++;
    if (!o.steps[0].exhausted_stage_capacity) violations++;
    if (!o.steps[0].loss_fully_absorbed_at_this_stage) violations++;
    if (o.residual_minor_units !== 0) violations++;
  }
  // uncapped assessment_powers absorbs an enormous loss without ever going negative/NaN
  {
    const raw = { currency: 'USD', waterfall_structure: ['assessment_powers'], loss_amount_minor_units: Number.MAX_SAFE_INTEGER, ccp_skin_in_game_minor_units: 0, assessment_powers_cap_declared: false, assessment_powers_cap_minor_units: null, defaulter_im_minor_units: 0, defaulter_default_fund_minor_units: 0, surviving_member_default_fund_pool_minor_units: 0, salt: SALT };
    const o = (await buildArtifact(raw)).output_payload;
    checked++;
    if (o.residual_minor_units !== 0) violations++;
    if (!Number.isFinite(o.residual_minor_units)) violations++;
  }
  // capped assessment_powers with loss exceeding every stage -> breach true, residual > 0
  {
    const raw = { currency: 'USD', waterfall_structure: ['assessment_powers'], loss_amount_minor_units: 100, ccp_skin_in_game_minor_units: 0, assessment_powers_cap_declared: true, assessment_powers_cap_minor_units: 10, defaulter_im_minor_units: 0, defaulter_default_fund_minor_units: 0, surviving_member_default_fund_pool_minor_units: 0, salt: SALT };
    const o = (await buildArtifact(raw)).output_payload;
    checked++;
    if (!o.breach) violations++;
    if (o.residual_minor_units !== 90) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP0_decoy());
results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_loss_conservation());
results.properties.push(await checkP3_differential());
results.properties.push(await checkP4_loss_monotonicity());
results.properties.push(await checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-529-ccp-default-waterfall-recompute',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
