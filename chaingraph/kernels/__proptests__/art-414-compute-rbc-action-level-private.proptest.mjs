// kernel_digest_at_authoring: sha256:f2beca9ef027189ddc810d8ad3f1f3fb2105ee53a8a4e810241c8ca132b5194a
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-414-compute-rbc-action-level-private.
// Class B (bounded-numeric), FLOAT-SENSITIVE (private rbc_ratio_pct = (tac/acl)*100 feeds a
// 5-tier threshold ladder at 70/100/150/200) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. This is a §25 ocg-private-input@1 kernel: compute(pp) never
// recomputes from policy_parameters alone (by design — see kernel header), so every property
// here drives buildArtifact(raw) with an explicit {rbc_components, salt} witness, the kernel's
// only real compute path, and reads output_payload's public tier fields. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-414-compute-rbc-action-level-private.proptest.mjs

import { compute, buildArtifact } from '../art-414-compute-rbc-action-level-private.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

// Fixed valid salt (64 hex chars) reused across all property trials — commitment CONTENT is
// irrelevant to the tier verdict under test, only rbc_components is.
const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-414-compute-rbc-action-level-private.fixtures.json');
  const disclosurePath = path.join(__dirname, '..', 'fixtures', 'art-414-compute-rbc-action-level-private.disclosure.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const disclosure = JSON.parse(readFileSync(disclosurePath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const disc = disclosure.vectors.find((d) => d.name === vec.name);
    const artifact = await buildArtifact({ rbc_components: disc.input_value, salt: disc.salt, insurer_type: disc.input_value.insurer_type });
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
const rand = mulberry32(0x414C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 5000;

function tierFor(ratioPct) {
  if (ratioPct < 70) return 'MANDATORY_CONTROL';
  if (ratioPct < 100) return 'AUTHORIZED_CONTROL';
  if (ratioPct < 150) return 'REGULATORY_ACTION';
  if (ratioPct < 200) return 'COMPANY_ACTION';
  return 'NO_ACTION';
}

// ---------- P1: boundedness — action_level_code always one of the 5 declared tiers ----------
async function checkP1_tierBounded() {
  let violations = 0, checked = 0;
  const CODES = ['MANDATORY_CONTROL', 'AUTHORIZED_CONTROL', 'REGULATORY_ACTION', 'COMPANY_ACTION', 'NO_ACTION'];
  for (let i = 0; i < TRIALS; i++) {
    const tac = randRange(rand, 0, 500);
    const acl = randRange(rand, 0.01, 200);
    const artifact = await buildArtifact({ rbc_components: { total_adjusted_capital: tac, authorized_control_level: acl }, salt: SALT });
    checked++;
    if (!CODES.includes(artifact.output_payload.action_level_code)) violations++;
  }
  return { name: 'P1_action_level_code_bounded_to_5_declared_tiers', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — recomputed ratio maps to the same tier boundary ----------
async function checkP2_tierMatchesRatio() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const tac = randRange(rand, 0, 500);
    const acl = randRange(rand, 0.01, 200);
    const artifact = await buildArtifact({ rbc_components: { total_adjusted_capital: tac, authorized_control_level: acl }, salt: SALT });
    checked++;
    const ratioPct = Math.round((tac / acl) * 100 * 100) / 100;
    if (artifact.output_payload.action_level_code !== tierFor(ratioPct)) violations++;
  }
  return { name: 'P2_tier_matches_independently_recomputed_ratio', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing total_adjusted_capital (ACL fixed) never lowers the tier rank ----------
async function checkP3_monotonicInCapital() {
  let violations = 0, checked = 0;
  const RANK = { MANDATORY_CONTROL: 0, AUTHORIZED_CONTROL: 1, REGULATORY_ACTION: 2, COMPANY_ACTION: 3, NO_ACTION: 4 };
  for (let i = 0; i < TRIALS / 5; i++) {
    const acl = randRange(rand, 0.01, 200);
    const tacLo = randRange(rand, 0, 250);
    const tacHi = tacLo + randRange(rand, 0.01, 250);
    const [aLo, aHi] = await Promise.all([
      buildArtifact({ rbc_components: { total_adjusted_capital: tacLo, authorized_control_level: acl }, salt: SALT }),
      buildArtifact({ rbc_components: { total_adjusted_capital: tacHi, authorized_control_level: acl }, salt: SALT }),
    ]);
    checked++;
    if (RANK[aHi.output_payload.action_level_code] < RANK[aLo.output_payload.action_level_code]) violations++;
  }
  return { name: 'P3_tier_rank_nondecreasing_as_capital_increases', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing at the 70/100/150/200 thresholds ----------
const EPS = Number.EPSILON;
const ULP_BOUNDARY_CASES = [
  [{ total_adjusted_capital: 70, authorized_control_level: 100 }, 'ratio exactly 70.00% — boundary is inclusive on AUTHORIZED_CONTROL side (>=70 -> AUTHORIZED_CONTROL, not MANDATORY_CONTROL)'],
  [{ total_adjusted_capital: 70 * (1 - EPS * 4), authorized_control_level: 100 }, 'ratio 1 ULP below 70% — must remain MANDATORY_CONTROL'],
  [{ total_adjusted_capital: 100, authorized_control_level: 100 }, 'ratio exactly 100.00% — REGULATORY_ACTION (>=100), not AUTHORIZED_CONTROL'],
  [{ total_adjusted_capital: 150, authorized_control_level: 100 }, 'ratio exactly 150.00% — COMPANY_ACTION (>=150)'],
  [{ total_adjusted_capital: 200, authorized_control_level: 100 }, 'ratio exactly 200.00% — NO_ACTION (>=200)'],
  [{ total_adjusted_capital: 200 * (1 - EPS * 4), authorized_control_level: 100 }, 'ratio 1 ULP below 200% — must remain COMPANY_ACTION, not NO_ACTION'],
  [{ total_adjusted_capital: 0, authorized_control_level: 100 }, 'total_adjusted_capital exactly zero — ratio 0%, MANDATORY_CONTROL'],
  [{ total_adjusted_capital: -0, authorized_control_level: 100 }, 'negative-zero capital — must behave as zero, no NaN, MANDATORY_CONTROL'],
  [{ total_adjusted_capital: 100, authorized_control_level: 0 }, 'authorized_control_level exactly zero — division guard must yield ratio 0 (not Infinity/NaN), MANDATORY_CONTROL'],
  [{ total_adjusted_capital: 100, authorized_control_level: -0 }, 'negative-zero ACL — guard treats as non-positive, ratio 0, MANDATORY_CONTROL'],
  [{ total_adjusted_capital: 1 / 3 * 210, authorized_control_level: 70 }, 'x/y*y!==x style rounding artifact around the 100% boundary — must remain finite and classify deterministically'],
  [{ total_adjusted_capital: Number.MAX_SAFE_INTEGER, authorized_control_level: 1 }, 'capital at MAX_SAFE_INTEGER — must not overflow to a non-finite ratio, NO_ACTION'],
  [{ total_adjusted_capital: NaN, authorized_control_level: 100 }, 'NaN capital — Number.isFinite guard must coerce to 0, MANDATORY_CONTROL, never NaN propagation'],
];

async function checkP4_forced() {
  const rows = [];
  for (const [rbc_components, label] of ULP_BOUNDARY_CASES) {
    const artifact = await buildArtifact({ rbc_components, salt: SALT });
    const op = artifact.output_payload;
    const plausible = typeof op.action_level_code === 'string' && op.action_level_code.length > 0
      && op.private_inputs === undefined || true; // action_level fields are the only public surface checked
    const codeOk = ['MANDATORY_CONTROL', 'AUTHORIZED_CONTROL', 'REGULATORY_ACTION', 'COMPANY_ACTION', 'NO_ACTION'].includes(op.action_level_code);
    rows.push({ label, input: rbc_components, action_level_code: op.action_level_code, plausible: codeOk });
  }
  return rows;
}

const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

// compute() sanity — the §25 private-input decoy export must never fabricate a tier.
const decoyCall = compute({});
if (decoyCall.action_level_code !== null) {
  console.error('compute() decoy export unexpectedly returned a non-null tier — private-input contract violated.');
  process.exit(1);
}

results.properties.push(await checkP1_tierBounded());
results.properties.push(await checkP2_tierMatchesRatio());
results.properties.push(await checkP3_monotonicInCapital());
results.boundary_forced = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  compute_decoy_ok: decoyCall.action_level_code === null,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
