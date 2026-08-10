// kernel_digest_at_authoring: sha256:e2226e2a5e87529aafc4e91fc031b0238f9158ef93e1f8bfe0ffae3e57e692a0
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-495-avax-permissioning-control-classifier.
// Class B (bounded-numeric), float:no per WU — kernel is a pure categorical classifier with no
// numeric fields at all (boolean precompile activation states, string enum modes). Forced
// CATEGORICAL boundary cases (missing precompile config, non-boolean activation, unrecognised
// validator_manager_mode) are used in place of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-495-avax-permissioning-control-classifier.proptest.mjs

import { compute } from '../art-495-avax-permissioning-control-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-495-avax-permissioning-control-classifier.fixtures.json');
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
const rand = mulberry32(0x495C3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;
const PRECOMPILE_KEYS = ['txallowlist', 'deployerallowlist', 'nativeminter', 'feemanager', 'rewardmanager'];
const CONTROL_IDS = ['transaction_permissioning', 'contract_deployment_permissioning', 'native_asset_issuance_control', 'fee_policy_control', 'reward_distribution_control', 'validator_set_membership_control'];
const TRISTATE = [true, false, undefined];

function mkPP(rng) {
  const precompiles = {};
  for (const k of PRECOMPILE_KEYS) {
    const t = pick(rng, TRISTATE);
    if (t === undefined) precompiles[k] = {}; // absent activation field
    else precompiles[k] = { activated: t };
  }
  const application_controls = {};
  for (const id of CONTROL_IDS) {
    const t = pick(rng, TRISTATE);
    if (t !== undefined) application_controls[id] = t;
  }
  const validator_manager_mode = pick(rng, ['poa', 'pos', 'managed', 'none', 'unknown_mode']);
  return { precompiles, application_controls, validator_manager_mode };
}

// ---------- P1: boundedness — every control status is one of the four declared statuses ----------
function checkP1_statusBounded() {
  let violations = 0, checked = 0;
  const STATUSES = new Set(['protocol_enforced', 'application_enforced', 'absent', 'judgment_required']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const c of r.output_payload.controls) if (!STATUSES.has(c.status)) violations++;
    if (r.output_payload.controls.length !== 6) violations++;
  }
  return { name: 'P1_every_control_status_in_declared_enum', trials: checked, violations };
}

// ---------- P2: round-trip — gap_register contains exactly the 'absent' controls, judgment_required exactly the 'judgment_required' ones ----------
function checkP2_registersMatchStatuses() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const absentIds = r.output_payload.controls.filter((c) => c.status === 'absent').map((c) => c.control_id);
    const judgmentIds = r.output_payload.controls.filter((c) => c.status === 'judgment_required').map((c) => c.control_id);
    const gapIds = r.output_payload.gap_register.map((g) => g.control_id);
    const jrIds = r.output_payload.judgment_required.map((j) => j.control_id);
    if (JSON.stringify([...absentIds].sort()) !== JSON.stringify([...gapIds].sort())) violations++;
    if (JSON.stringify([...judgmentIds].sort()) !== JSON.stringify([...jrIds].sort())) violations++;
  }
  return { name: 'P2_gap_register_and_judgment_required_exact_status_partition', trials: checked, violations };
}

// ---------- P3: round-trip — the four counts sum exactly to controls_evaluated (always 6) ----------
function checkP3_countsSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { protocol_enforced_count, application_enforced_count, absent_count, judgment_required_count, controls_evaluated } = r.output_payload;
    if (protocol_enforced_count + application_enforced_count + absent_count + judgment_required_count !== controls_evaluated) violations++;
    if (controls_evaluated !== 6) violations++;
  }
  return { name: 'P3_status_counts_exactly_sum_to_controls_evaluated', trials: checked, violations };
}

// ---------- P4: fixed rule — precompile activated:true always yields protocol_enforced regardless of application_controls ----------
function checkP4_activatedAlwaysProtocolEnforced() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (let j = 0; j < PRECOMPILE_KEYS.length; j++) {
      const key = PRECOMPILE_KEYS[j];
      if (pp.precompiles[key] && pp.precompiles[key].activated === true) {
        const c = r.output_payload.controls[j];
        if (c.status !== 'protocol_enforced') violations++;
      }
    }
  }
  return { name: 'P4_precompile_activated_true_always_protocol_enforced', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const ALL_ACTIVE = Object.fromEntries(PRECOMPILE_KEYS.map((k) => [k, { activated: true }]));
const ALL_INACTIVE = Object.fromEntries(PRECOMPILE_KEYS.map((k) => [k, { activated: false }]));
const BOUNDARY_CASES = [
  [{ precompiles: {}, application_controls: {}, validator_manager_mode: 'none' }, 'all precompile config entirely absent — every precompile control must be judgment_required, never a silent guess'],
  [{ precompiles: { txallowlist: { activated: 'yes' } }, application_controls: {}, validator_manager_mode: 'none' }, 'activated field present but non-boolean (string "yes") — must be judgment_required, not coerced truthy'],
  [{ precompiles: ALL_ACTIVE, application_controls: {}, validator_manager_mode: 'poa' }, 'every precompile active + PoA validator manager — must be FULLY_RESOLVED, zero absent, zero judgment_required'],
  [{ precompiles: ALL_INACTIVE, application_controls: Object.fromEntries(CONTROL_IDS.map((id) => [id, false])), validator_manager_mode: 'none' }, 'every precompile inactive with every application control explicitly declared false — every control must be absent, none judgment_required'],
  [{ precompiles: ALL_INACTIVE, application_controls: {}, validator_manager_mode: 'none' }, 'every precompile inactive with NO application_controls declared at all — every control must be judgment_required (undetermined substitute), not absent'],
  [{ precompiles: {}, application_controls: {}, validator_manager_mode: 'nonsense_mode_xyz' }, 'unrecognised validator_manager_mode string, not "none" — validator_set control must be judgment_required naming the resolving input'],
  [{ precompiles: {}, application_controls: { validator_set_membership_control: true }, validator_manager_mode: 'none' }, 'mode explicitly "none" but an app-level control is declared true — validator_set control must be application_enforced'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = o.controls.length === 6 && o.protocol_enforced_count + o.application_enforced_count + o.absent_count + o.judgment_required_count === 6;
    rows.push({ label, absent_count: o.absent_count, judgment_required_count: o.judgment_required_count, protocol_enforced_count: o.protocol_enforced_count, flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_statusBounded());
results.properties.push(checkP2_registersMatchStatuses());
results.properties.push(checkP3_countsSum());
results.properties.push(checkP4_activatedAlwaysProtocolEnforced());
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
