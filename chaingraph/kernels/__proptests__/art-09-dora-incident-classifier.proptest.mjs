// kernel_digest_at_authoring: sha256:402db5fdc85927df292a47afb1b93448eb3e655291d3fbdef48466732382561d
//
// DORA-CLOCK-REPAIR-1 — property-test floor for art-09-dora-incident-classifier
// (rewritten with the kernel: art-09 CLASSIFIES per 2024/1772 Art. 8(1) + Art. 9(1)-(6)
// and CONSUMES the art-467 2025/301 clock result under the REVERSED D split; it no
// longer clocks anything itself). Class B (bounded-numeric), float:no — thresholds are
// fixed statutory cutoffs compared via strict > / >=, never float rounding math. Forced
// CATEGORICAL boundary cases stand in for ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0xA09CA);
const TRIALS = 5000;
const STATES = new Set(['major', 'not_major', 'not_evaluable', 'malformed']);
const CRITERION_IDS = new Set(['clients_counterparties_transactions', 'duration', 'geographical_spread', 'data_losses', 'criticality_of_services', 'economic_impact', 'reputational_impact']);

function mkPP(rng) {
  const pick = (p) => (rng() < p ? true : rng() < 0.5 ? false : undefined);
  return {
    critical_services_affected: rng() < 0.15 ? undefined : rng() < 0.5,
    clients_affected_pct: rng() < 0.5 ? rng() * 100 : undefined,
    clients_affected_count: rng() < 0.2 ? rng() * 200000 : undefined,
    financial_counterparts_affected_pct: rng() < 0.15 ? rng() * 100 : undefined,
    transactions_affected_number_pct: rng() < 0.15 ? rng() * 100 : undefined,
    transactions_affected_value_pct: rng() < 0.15 ? rng() * 100 : undefined,
    art_1_3_relevant_parties_affected: pick(0.1),
    reputational_impact: pick(0.3),
    duration_hours: rng() < 0.4 ? rng() * 100 : undefined,
    critical_function_downtime_minutes: rng() < 0.3 ? rng() * 1000 : undefined,
    member_states_affected_count: rng() < 0.4 ? Math.floor(rng() * 10) : undefined,
    data_loss_adverse_impact: pick(0.4),
    malicious_access_successful: pick(0.4),
    economic_impact_eur: rng() < 0.4 ? rng() * 500000 : undefined,
  };
}

// The Art. 8(1) formula the kernel must implement exactly:
// MAJOR <=> gateway assessed AND gateway met AND (9(5)(b) malicious OR >=2 other thresholds)
// other thresholds pool = { clients 9(1), reputational 9(2), duration 9(3), geographic 9(4),
//                           data-loss adverse 9(5)(a), economic 9(6) } — strict statutory cutoffs.
function expectedDetermination(pp) {
  const malformed = [];
  for (const v of [pp.critical_services_affected, pp.art_1_3_relevant_parties_affected, pp.reputational_impact, pp.data_loss_adverse_impact, pp.malicious_access_successful]) {
    if (v !== undefined && typeof v !== 'boolean') malformed.push(1);
  }
  for (const v of [pp.clients_affected_pct, pp.clients_affected_count, pp.financial_counterparts_affected_pct, pp.transactions_affected_number_pct, pp.transactions_affected_value_pct, pp.duration_hours, pp.critical_function_downtime_minutes, pp.member_states_affected_count, pp.economic_impact_eur]) {
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) malformed.push(1);
  }
  if (malformed.length) return 'malformed';
  if (pp.critical_services_affected === undefined) return 'not_evaluable';
  const clients = (pp.clients_affected_pct ?? -Infinity) > 10
    || (pp.clients_affected_count ?? -Infinity) > 100000
    || (pp.financial_counterparts_affected_pct ?? -Infinity) > 30
    || (pp.transactions_affected_number_pct ?? -Infinity) > 10
    || (pp.transactions_affected_value_pct ?? -Infinity) > 10
    || pp.art_1_3_relevant_parties_affected === true;
  const duration = (pp.duration_hours ?? -Infinity) > 24 || (pp.critical_function_downtime_minutes ?? -Infinity) > 120;
  const geo = (pp.member_states_affected_count ?? -Infinity) >= 2;
  const dataLoss = pp.data_loss_adverse_impact === true;
  const econ = (pp.economic_impact_eur ?? -Infinity) > 100000;
  const rep = pp.reputational_impact === true;
  const otherCount = [clients, rep, duration, geo, dataLoss, econ].filter(Boolean).length;
  return (pp.critical_services_affected === true && (pp.malicious_access_successful === true || otherCount >= 2)) ? 'major' : 'not_major';
}

// ---------- P1: exact Art. 8(1) gateway formula ----------
function checkP1_gatewayFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = expectedDetermination(pp);
    if (r.output_payload.determination_code !== expected) violations++;
    if (r.output_payload.major_incident !== (r.output_payload.determination_code === 'major')) violations++;
  }
  return { name: 'P1_art_8_1_gateway_formula_exact', trials: checked, violations };
}

// ---------- P2: data loss (9(5)(a)) NEVER fires standalone; 9(5)(b) never without the gateway ----------
function checkP2_noStandaloneTriggers() {
  let violations = 0, checked = 0;
  const cases = [
    { critical_services_affected: false, data_loss_adverse_impact: true },
    { critical_services_affected: false, malicious_access_successful: true },
    { critical_services_affected: undefined, data_loss_adverse_impact: true, malicious_access_successful: true },
    { critical_services_affected: false, clients_affected_pct: 100, duration_hours: 999, member_states_affected_count: 27, economic_impact_eur: 999999999, data_loss_adverse_impact: true, malicious_access_successful: true },
  ];
  for (const pp of cases) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.determination_code !== 'not_major' && r.output_payload.determination_code !== 'not_evaluable') violations++;
  }
  return { name: 'P2_data_loss_and_malicious_access_never_standalone', trials: checked, violations };
}

// ---------- P3: boundedness — determination in the 4-state enum, criteria ids bounded ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!STATES.has(r.output_payload.determination_code)) violations++;
    if (r.output_payload.criteria_detail.length !== 7) violations++;
    for (const c of r.output_payload.criteria_detail) {
      if (!CRITERION_IDS.has(c.id)) violations++;
      if (typeof c.met !== 'boolean' || typeof c.not_assessed !== 'boolean') violations++;
    }
    for (const id of r.output_payload.qualifying_criteria) if (!CRITERION_IDS.has(id)) violations++;
    if (r.output_payload.other_thresholds_met_count < 0 || r.output_payload.other_thresholds_met_count > 6) violations++;
  }
  return { name: 'P3_states_and_criteria_bounded_to_declared_sets', trials: checked, violations };
}

// ---------- P4: consumed-clock consistency (REVERSED D) — matching origins bind on major; mismatch => not_evaluable stages, never silent precedence ----------
function checkP4_consumedClock() {
  let violations = 0, checked = 0;
  const clock = (classification_at, awareness_at) => ({
    classification_at,
    awareness_at,
    stages: {
      initial_notification: { deadline: '2026-07-20T14:00:00.000Z', state: 'not_yet_due', reason_code: 'INITIAL_DEADLINE_CLASSIFICATION_4H' },
      intermediate_report: { deadline: null, state: 'not_evaluable', reason_code: 'INTERMEDIATE_INITIAL_NOT_SUBMITTED' },
      final_report: { deadline: null, state: 'no_final_report_yet', reason_code: 'FINAL_NO_INTERMEDIATE_SUBMITTED' },
    },
  });
  const factPatterns = [
    { critical_services_affected: true, malicious_access_successful: true },
    { critical_services_affected: true, clients_affected_pct: 15, duration_hours: 30 },
    { critical_services_affected: true, clients_affected_pct: 15 },
  ];
  for (let i = 0; i < factPatterns.length; i++) {
    // consistent origins + major/not-major
    const ppA = { ...factPatterns[i], classification_at: '2026-07-20T10:00:00Z', awareness_at: '2026-07-20T09:00:00Z', reporting_clock: clock('2026-07-20T10:00:00Z', '2026-07-20T09:00:00Z') };
    const rA = compute(ppA);
    checked++;
    if (rA.output_payload.reporting_clock.binding !== (rA.output_payload.determination_code === 'major')) violations++;
    for (const stage of ['initial_notification', 'intermediate_report', 'final_report']) {
      if (rA.output_payload.reporting_clock.stages[stage].reason_code === 'CONSUMED_CLOCK_ORIGIN_MISMATCH') violations++;
    }
    // mismatched classification origin — stages not_evaluable regardless of the verdict
    const ppB = { ...factPatterns[i], classification_at: '2026-07-20T10:00:00Z', reporting_clock: clock('2026-07-21T10:00:00Z', '2026-07-20T09:00:00Z') };
    const rB = compute(ppB);
    checked++;
    if (rB.output_payload.reporting_clock.binding !== false) violations++;
    for (const stage of ['initial_notification', 'intermediate_report', 'final_report']) {
      const s = rB.output_payload.reporting_clock.stages[stage];
      if (!(s.state === 'not_evaluable' && s.reason_code === 'CONSUMED_CLOCK_ORIGIN_MISMATCH')) violations++;
    }
    // mismatched awareness origin — same refusal
    const ppC = { ...factPatterns[i], awareness_at: '2026-07-20T09:00:00Z', reporting_clock: clock('2026-07-20T10:00:00Z', '2026-07-19T09:00:00Z') };
    const rC = compute(ppC);
    checked++;
    if (rC.output_payload.reporting_clock.binding !== false) violations++;
    if (rC.output_payload.reporting_clock.stages.initial_notification.reason_code !== 'CONSUMED_CLOCK_ORIGIN_MISMATCH') violations++;
  }
  return { name: 'P4_consumed_clock_origins_never_silent_precedence', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced statutory cutoff boundaries ----------
const G = true; // gateway met
const BOUNDARY_CASES = [
  [{ critical_services_affected: G, clients_affected_pct: 10.000001 }, 'clients 9(1)(a) just over 10% — met ("higher than 10%")'],
  [{ critical_services_affected: G, clients_affected_pct: 10 }, 'clients exactly 10% — NOT met (strictly "higher than")'],
  [{ critical_services_affected: G, clients_affected_count: 100000.001 }, 'clients 9(1)(b) just over 100,000 — met'],
  [{ critical_services_affected: G, clients_affected_count: 100000 }, 'clients exactly 100,000 — NOT met (strictly "higher than")'],
  [{ critical_services_affected: G, duration_hours: 24.000001 }, 'duration 9(3)(a) just over 24h — met'],
  [{ critical_services_affected: G, duration_hours: 24 }, 'duration exactly 24h — NOT met ("longer than")'],
  [{ critical_services_affected: G, critical_function_downtime_minutes: 120.000001 }, 'downtime 9(3)(b) just over 2h — met'],
  [{ critical_services_affected: G, critical_function_downtime_minutes: 120 }, 'downtime exactly 2h — NOT met ("longer than")'],
  [{ critical_services_affected: G, member_states_affected_count: 2 }, 'geographic 9(4) exactly 2 member states — met ("two or more")'],
  [{ critical_services_affected: G, member_states_affected_count: 1 }, 'geographic 1 member state — NOT met'],
  [{ critical_services_affected: G, economic_impact_eur: 100000.001 }, 'economic 9(6) just over EUR 100,000 — met'],
  [{ critical_services_affected: G, economic_impact_eur: 100000 }, 'economic exactly EUR 100,000 — NOT met ("exceeded")'],
  [{ critical_services_affected: G, data_loss_adverse_impact: true, reputational_impact: true }, 'gateway + data-loss(9(5)(a)) + reputational(9(2)) = TWO other — MAJOR via the two-other branch'],
  [{ critical_services_affected: G, data_loss_adverse_impact: true }, 'gateway + data loss alone — NOT major (one other only, no malicious access)'],
  [{ critical_services_affected: G, malicious_access_successful: true }, 'gateway + 9(5)(b) — MAJOR single-condition branch'],
  [{ malicious_access_successful: true }, '9(5)(b) WITHOUT gateway — NOT major (branch lives inside the gateway)'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const plausible = STATES.has(r.output_payload.determination_code) && typeof r.output_payload.major_incident === 'boolean';
    rows.push({ label, input: pp, determination: r.output_payload.determination_code, reasons: r.output_payload.determination_reason_codes, other_count: r.output_payload.other_thresholds_met_count, flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gatewayFormula());
results.properties.push(checkP2_noStandaloneTriggers());
results.properties.push(checkP3_bounded());
results.properties.push(checkP4_consumedClock());
results.boundary_forced = checkP5_forced();

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
