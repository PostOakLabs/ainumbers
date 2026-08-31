// kernel_digest_at_authoring: sha256:62ce51c376375e331199c0320830454cf4ba8fad3ec3c3a89d5bea2f15140de0
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for art-09-dora-incident-classifier.
// Class B (bounded-numeric), FLOAT-SENSITIVE (client %, tx-value/outage/member-state threshold
// comparisons) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. Read-only w.r.t. the kernel it imports.
// ART09-DORA-FIELDNAME-MISMATCH-1: randPP/base fixtures renamed to the published schema field names.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-09-dora-incident-classifier.proptest.mjs

import { compute } from '../art-09-dora-incident-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-09-dora-incident-classifier.fixtures.json');
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
const rand = mulberry32(0xA09A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ENTITY_TYPES = ['credit_institution', 'payment_institution', 'investment_firm', 'insurance', 'crypto_asset', 'other'];
const INCIDENT_TYPES = ['ict_outage', 'cyber_attack', 'data_breach', 'third_party_failure', 'other'];
const TRIALS = 20000;

function randPP(rng) {
  const total = randRange(rng, 1, 1_000_000);
  return {
    incident_type: pick(rng, INCIDENT_TYPES),
    entity_type: pick(rng, ENTITY_TYPES),
    clients_affected: randRange(rng, 0, total),
    total_clients: total,
    transaction_value_eur_millions: rng() < 0.7 ? randRange(rng, 0, 100) : 0,
    outage_duration_minutes: rng() < 0.7 ? randRange(rng, 0, 500) : 0,
    eu_member_states_affected: Math.floor(randRange(rng, 1, 27)),
    data_loss_occurred: rng() < 0.5,
    critical_function_affected: rng() < 0.5,
    cross_border_payment: rng() < 0.5,
    tp_ict: rng() < 0.5,
  };
}
const CRITERIA_IDS = ['critical_fn', 'clients', 'data_loss', 'tx_value', 'duration', 'geographic'];

// ---------- P1: boundedness — determination_code agrees with major_incident, 6 fixed criteria, qualifying subset ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    if (r.determination_code !== (r.major_incident ? 'MAJOR' : 'NON_MAJOR')) violations++;
    if (r.criteria_detail.length !== 6) violations++;
    if (r.criteria_detail.map((c) => c.id).join(',') !== CRITERIA_IDS.join(',')) violations++;
    for (const q of r.qualifying_criteria) if (!CRITERIA_IDS.includes(q)) violations++;
  }
  return { name: 'P1_boundedness_fixed_criteria_shape', trials: checked, violations };
}

// ---------- P2: monotone — clients criterion "met" is monotone non-decreasing as clients_affected rises ----------
function checkP2_monotoneClientsCriterion() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const totalClients = randRange(rand, 1000, 1_000_000);
    const c1 = randRange(rand, 0, totalClients / 2);
    const c2 = c1 + randRange(rand, 0, totalClients / 2); // c2 >= c1
    const base = { incident_type: 'other', entity_type: 'other', total_clients: totalClients, transaction_value_eur_millions: 0, outage_duration_minutes: 0, eu_member_states_affected: 1, data_loss_occurred: false, critical_function_affected: false, cross_border_payment: false, tp_ict: false };
    const r1 = compute({ ...base, clients_affected: c1 }).output_payload;
    const r2 = compute({ ...base, clients_affected: c2 }).output_payload;
    checked++;
    const met1 = r1.criteria_detail.find((c) => c.id === 'clients').met;
    const met2 = r2.criteria_detail.find((c) => c.id === 'clients').met;
    if (met1 && !met2) violations++; // met can only turn ON as clients_affected rises, never OFF
  }
  return { name: 'P2_monotone_clients_criterion', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — clients criterion met iff pct>=10 or abs>=100000 ----------
function checkP3_clientsThresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const clientsCrit = r.criteria_detail.find((c) => c.id === 'clients');
    if (clientsCrit.not_assessed) continue;
    const pct = (pp.clients_affected / pp.total_clients) * 100;
    const expected = pct >= 10 || pp.clients_affected >= 100000;
    if (clientsCrit.met !== expected) violations++;
  }
  return { name: 'P3_clients_threshold_agreement', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const base = { incident_type: 'other', entity_type: 'other', total_clients: 1000, transaction_value_eur_millions: 0, outage_duration_minutes: 0, eu_member_states_affected: 1, data_loss_occurred: false, critical_function_affected: false, cross_border_payment: false, tp_ict: false };
const ULP_BOUNDARY_CASES = [
  ['clients pct exactly 10% — must be met (>= not >)', { ...base, clients_affected: 100, total_clients: 1000 }],
  ['clients pct 1 ULP under 10% — must NOT be met', { ...base, clients_affected: 100 - Number.EPSILON * 512, total_clients: 1000 }],
  ['tx_value exactly at 50M (other entity) — must be met', { ...base, entity_type: 'other', transaction_value_eur_millions: 50 }],
  ['tx_value 1 ULP under 50M — must NOT be met', { ...base, entity_type: 'other', transaction_value_eur_millions: 50 - Number.EPSILON * 32 }],
  ['tx_value exactly at 10M (payment institution) — must be met', { ...base, entity_type: 'payment_institution', transaction_value_eur_millions: 10 }],
  ['duration exactly at 120min (critical fn) — must be met', { ...base, critical_function_affected: true, outage_duration_minutes: 120 }],
  ['duration 1 ULP under 120min (critical fn) — must NOT be met', { ...base, critical_function_affected: true, outage_duration_minutes: 120 - Number.EPSILON * 128 }],
  ['member_states exactly 2 — geographic must be met', { ...base, eu_member_states_affected: 2 }],
  ['member_states=1 — geographic must NOT be met', { ...base, eu_member_states_affected: 1 }],
  ['clients_affected=-0 negative zero', { ...base, clients_affected: -0 }],
  ['clients_affected subnormal, total_clients huge', { ...base, clients_affected: Number.MIN_VALUE, total_clients: 1e6 }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(pp.clients_affected) || pp.clients_affected === 0;
    const shapeOk = r.criteria_detail.length === 6 && (r.determination_code === (r.major_incident ? 'MAJOR' : 'NON_MAJOR'));
    rows.push({ label, major_incident: r.major_incident, clients_met: r.criteria_detail.find((c) => c.id === 'clients').met, duration_met: r.criteria_detail.find((c) => c.id === 'duration').met, geographic_met: r.criteria_detail.find((c) => c.id === 'geographic').met, tx_value_met: r.criteria_detail.find((c) => c.id === 'tx_value').met, plausible: shapeOk });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_monotoneClientsCriterion());
results.properties.push(checkP3_clientsThresholdAgreement());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
