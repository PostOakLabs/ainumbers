// kernel_digest_at_authoring: sha256:9b92c3c4c8082ee5def48e00030b928ad66b653ffea5f5dfb69b3356b9323ffa
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-73-taxonomy-alignment-scorer.
// Class B, CLASSIFICATION CORRECTED FROM THE WU'S float:yes TO float:NO — per this row's
// own FIX-2-CARRY instruction ("verify float-sensitivity against the kernel before authoring,
// not inherited from the triage table alone"), direct measurement of compute() found ZERO
// floating-point arithmetic anywhere in the function body: every field is a string
// (substantial_contribution/objective/minimum_safeguards enums, nace_code passthrough) or a
// boolean/array derived from string comparisons (dnsh status lookups, alignment_verdict
// string-prefix logic). There is no toFixed(), no division, no multiplication, no numeric
// output field at all. This is a pure categorical/string decision kernel — the same shape
// B12 documented for art-314/art-316 — so it carries forced CATEGORICAL boundary cases
// instead of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3's float:no exception path.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-73-taxonomy-alignment-scorer.proptest.mjs

import { compute } from '../art-73-taxonomy-alignment-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-73-taxonomy-alignment-scorer.fixtures.json');
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
const rand = mulberry32(0x73A5);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const OBJECTIVES = ['climate_mitigation', 'climate_adaptation', 'water', 'circular_economy', 'pollution_prevention', 'biodiversity'];
const SC_VALUES = ['met', 'partial', 'not-met'];
const DNSH_STATUS = ['met', 'not-met'];
const SAFEGUARD_VALUES = ['in-place', 'partial', 'none'];

function mkPP(rng) {
  const objective = pick(rng, OBJECTIVES);
  const other = OBJECTIVES.filter((o) => o !== objective);
  const dnsh = other.map((o) => ({ objective: o, status: pick(rng, DNSH_STATUS) }));
  return {
    activity: { nace_code: `NACE-${Math.floor(rng() * 100)}`, objective },
    substantial_contribution: pick(rng, SC_VALUES),
    dnsh,
    minimum_safeguards: pick(rng, SAFEGUARD_VALUES),
  };
}

// ---------- P1: round-trip identity — is_aligned exactly matches alignment_verdict's ALIGNED prefix ----------
function checkP1_isAlignedMatchesVerdictPrefix() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.output_payload.alignment_verdict.startsWith('ALIGNED');
    if (r.output_payload.is_aligned !== expected) violations++;
  }
  return { name: 'P1_is_aligned_exact_negation_free_prefix_check', trials: checked, violations };
}

// ---------- P2: boundedness — alignment_verdict always starts with one of the three declared prefixes ----------
function checkP2_verdictBoundedToDeclaredPrefixes() {
  let violations = 0, checked = 0;
  const PREFIXES = ['ALIGNED', 'NOT_ELIGIBLE', 'ELIGIBLE_NOT_ALIGNED'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!PREFIXES.some((p) => r.output_payload.alignment_verdict.startsWith(p))) violations++;
  }
  return { name: 'P2_alignment_verdict_bounded_to_declared_prefixes', trials: checked, violations };
}

// ---------- P3: round-trip identity — dnsh_gaps is exactly the not-met subset of dnsh_results ----------
function checkP3_dnshGapsMatchResults() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dnsh_results, dnsh_gaps } = r.output_payload;
    const expectedGaps = Object.entries(dnsh_results).filter(([, s]) => s !== 'met').map(([o]) => o);
    const actualGaps = dnsh_gaps.map((g) => g.objective);
    if (JSON.stringify(expectedGaps.sort()) !== JSON.stringify(actualGaps.sort())) violations++;
    // The primary objective itself must never appear as a DNSH gap (it is excluded from other_objectives)
    if (dnsh_gaps.some((g) => g.objective === r.output_payload.primary_objective)) violations++;
  }
  return { name: 'P3_dnsh_gaps_exact_notmet_subset_excluding_primary_objective', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'met', dnsh: ['climate_adaptation', 'water', 'circular_economy', 'pollution_prevention', 'biodiversity'].map((o) => ({ objective: o, status: 'met' })), minimum_safeguards: 'in-place' }, 'fully-passing case — substantial_contribution met, all 5 DNSH met, safeguards in-place — must classify ALIGNED, is_aligned true'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'not-met' }, 'substantial_contribution exactly "not-met" (not "partial") — must classify NOT_ELIGIBLE, never ELIGIBLE_NOT_ALIGNED'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'partial' }, 'substantial_contribution exactly "partial" — must classify ELIGIBLE_NOT_ALIGNED (SC leg), not NOT_ELIGIBLE'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'met', dnsh: [{ objective: 'water', status: 'not-met' }], minimum_safeguards: 'in-place' }, 'SC met but exactly one DNSH objective fails, the other four default to not-met via missing entries — must classify ELIGIBLE_NOT_ALIGNED (DNSH leg) listing all defaulted gaps, not just the one supplied'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'met', dnsh: ['climate_adaptation', 'water', 'circular_economy', 'pollution_prevention', 'biodiversity'].map((o) => ({ objective: o, status: 'met' })), minimum_safeguards: 'partial' }, 'SC met, all DNSH met, safeguards exactly "partial" (not "none") — must classify ELIGIBLE_NOT_ALIGNED (safeguards-partial leg), distinct wording from the safeguards-none leg'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'met', dnsh: ['climate_adaptation', 'water', 'circular_economy', 'pollution_prevention', 'biodiversity'].map((o) => ({ objective: o, status: 'met' })), minimum_safeguards: 'none' }, 'SC met, all DNSH met, safeguards exactly "none" — must classify ELIGIBLE_NOT_ALIGNED (safeguards-none leg)'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'met', dnsh: [] }, 'empty dnsh array — every one of the five other objectives must default to "not-met" (entry?.status ?? "not-met"), producing exactly five gaps'],
  [{ activity: { objective: 'water' }, substantial_contribution: 'met', dnsh: ['climate_mitigation', 'climate_adaptation', 'circular_economy', 'pollution_prevention', 'biodiversity'].map((o) => ({ objective: o, status: 'met' })), minimum_safeguards: 'in-place' }, 'primary objective is NOT the default climate_mitigation (here "water") — other_objectives exclusion must track the actual objective, not a hardcoded one'],
  [{ activity: {}, substantial_contribution: undefined, dnsh: undefined, minimum_safeguards: undefined }, 'all fields omitted — must fall through to every declared default (climate_mitigation / not-met / [] / none), classifying NOT_ELIGIBLE without throwing'],
  [{ activity: { objective: 'climate_mitigation' }, substantial_contribution: 'met', dnsh: [{ objective: 'climate_mitigation', status: 'not-met' }, { objective: 'water', status: 'met' }, { objective: 'circular_economy', status: 'met' }, { objective: 'pollution_prevention', status: 'met' }, { objective: 'biodiversity', status: 'met' }, { objective: 'climate_adaptation', status: 'met' }], minimum_safeguards: 'in-place' }, 'a dnsh entry is supplied for the PRIMARY objective itself (climate_mitigation, not-met) alongside all five others met — the primary-objective entry must be ignored entirely (filtered out of other_objectives), verdict must still be ALIGNED'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { alignment_verdict, is_aligned, dnsh_gaps } = r.output_payload;
    const plausible = typeof alignment_verdict === 'string' && typeof is_aligned === 'boolean' && Array.isArray(dnsh_gaps);
    rows.push({ label, input: pp, alignment_verdict, is_aligned, dnsh_gaps, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_isAlignedMatchesVerdictPrefix());
results.properties.push(checkP2_verdictBoundedToDeclaredPrefixes());
results.properties.push(checkP3_dnshGapsMatchResults());
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
