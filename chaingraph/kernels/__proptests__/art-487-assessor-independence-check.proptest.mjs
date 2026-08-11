// art-487-assessor-independence-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:296ba15821ab17012505cf41cea3e5915f9146eae5c97eab522579f9cd5fe663
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO, direct read confirmed — the entire eligibility decision is string
// membership (`indexOf`), array intersection, and ISO-8601 date-STRING comparison
// (`pp.assessment_date <= pp.attestation_deadline`, a lexicographic compare on YYYY-MM-DD
// strings, never a numeric/float operation). No arithmetic of any kind appears in compute().
// Forced CATEGORICAL boundary cases used per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (overlapping_identities.length bounded by
// assessor_person_ids.length), differential re-derivation of the four eligibility sub-flags and
// the first-failing-predicate trace, boundedness (eligible === AND of all four sub-flags, exactly
// one of them explains a rejection), forced categorical date/identity boundary cases (deadline ==
// assessment_date, one day after, full identity overlap, empty required-certs list), and
// metamorphic permutation-invariance of identity_set/certification array order (pure set-based
// logic, exactly order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-487-assessor-independence-check.proptest.mjs

import { compute } from '../art-487-assessor-independence-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-487-assessor-independence-check.fixtures.json');
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
const rand = mulberry32(0x487C23);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const nPeople = 2 + Math.floor(rng() * 4);
  const identity_set = [];
  for (let i = 0; i < nPeople; i++) identity_set.push({ person_id: `p${i}`, roles: [] });
  const assessorIds = [], implementerIds = [];
  for (let i = 0; i < nPeople; i++) {
    if (rng() < 0.5) assessorIds.push(`p${i}`);
    if (rng() < 0.5) implementerIds.push(`p${i}`);
  }
  const route = pick(rng, ['internal_2nd_line', 'internal_3rd_line', 'external']);
  const permitted = rng() < 0.7 ? [route] : ['internal_2nd_line', 'internal_3rd_line', 'external'].filter((r) => r !== route);
  const required = rng() < 0.5 ? ['CISA'] : [];
  const claimed = rng() < 0.6 ? ['CISA', 'CISSP'] : ['CISSP'];
  const day = 1 + Math.floor(rng() * 27);
  const assessDate = `2026-07-${String(day).padStart(2, '0')}`;
  const deadline = `2026-07-${String(1 + Math.floor(rng() * 27)).padStart(2, '0')}`;
  return {
    architecture_type: 'A1', assessment_route: route, permitted_routes: permitted,
    assessment_date: assessDate, attestation_deadline: deadline,
    identity_set, implementer_person_ids: implementerIds, assessor_person_ids: assessorIds,
    required_certifications: required, claimed_assessor_certifications: claimed,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — overlapping_identities bounded by assessor_person_ids.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overlapping_identities.length > pp.assessor_person_ids.length) violations++;
  }
  return { name: 'P1_termination_overlap_bounded', trials: checked, violations };
}

// ---------- P2 (differential): four eligibility sub-flags + eligible re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedRoute = pp.permitted_routes.includes(pp.assessment_route);
    const expectedCert = pp.required_certifications.length === 0 || pp.required_certifications.some((c) => pp.claimed_assessor_certifications.includes(c));
    const overlap = pp.assessor_person_ids.filter((id) => pp.implementer_person_ids.includes(id));
    const expectedIndep = overlap.length === 0;
    const expectedDate = pp.assessment_date <= pp.attestation_deadline;
    if (output_payload.route_eligible !== expectedRoute) violations++;
    if (output_payload.cert_eligible !== expectedCert) violations++;
    if (output_payload.independence_eligible !== expectedIndep) violations++;
    if (output_payload.date_eligible !== expectedDate) violations++;
    const expectedEligible = expectedRoute && expectedCert && expectedIndep && expectedDate;
    if (output_payload.eligible !== expectedEligible) violations++;
  }
  return { name: 'P2_eligibility_subflags_differential', trials: checked, violations };
}

// ---------- P3: boundedness — first-failing-predicate names the FIRST false sub-flag in priority order ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let expectedFailing = null;
    if (!output_payload.route_eligible) expectedFailing = 'assessment_route_not_permitted_for_architecture_type';
    else if (!output_payload.cert_eligible) expectedFailing = 'assessor_certification_requirement_not_met';
    else if (!output_payload.independence_eligible) expectedFailing = 'identity_overlap:' + output_payload.overlapping_identities.join(',');
    else if (!output_payload.date_eligible) expectedFailing = 'assessment_date_after_deadline_or_invalid_format';
    if (output_payload.failing_predicate !== expectedFailing) violations++;
    if (output_payload.eligible !== (expectedFailing === null)) violations++;
  }
  return { name: 'P3_failing_predicate_priority_boundedness', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const base = {
    architecture_type: 'A1', assessment_route: 'external', permitted_routes: ['external'],
    identity_set: [{ person_id: 'a', roles: [] }, { person_id: 'b', roles: [] }],
    implementer_person_ids: ['b'], assessor_person_ids: ['a'],
    required_certifications: [], claimed_assessor_certifications: [],
  };
  const rows = [];
  const cases = [
    { label: 'assessment_date === attestation_deadline exact tie -> date_eligible true', pp: { ...base, assessment_date: '2026-07-15', attestation_deadline: '2026-07-15' }, expect: (o) => o.date_eligible === true && o.eligible === true },
    { label: 'assessment_date one day after deadline -> date_eligible false', pp: { ...base, assessment_date: '2026-07-16', attestation_deadline: '2026-07-15' }, expect: (o) => o.date_eligible === false && o.failing_predicate === 'assessment_date_after_deadline_or_invalid_format' },
    { label: 'full identity overlap (assessor === implementer) -> independence_eligible false', pp: { ...base, assessment_date: '2026-07-15', attestation_deadline: '2026-07-20', assessor_person_ids: ['a'], implementer_person_ids: ['a'] }, expect: (o) => o.independence_eligible === false && o.overlapping_identities.includes('a') },
    { label: 'empty required_certifications -> cert_eligible always true', pp: { ...base, assessment_date: '2026-07-15', attestation_deadline: '2026-07-20', required_certifications: [] }, expect: (o) => o.cert_eligible === true },
    { label: 'assessment_route not in permitted_routes -> route_eligible false, first-failing', pp: { ...base, assessment_date: '2026-07-15', attestation_deadline: '2026-07-20', assessment_route: 'external', permitted_routes: ['internal_2nd_line'] }, expect: (o) => o.route_eligible === false && o.failing_predicate === 'assessment_route_not_permitted_for_architecture_type' },
    { label: 'malformed assessment_date -> date_eligible false, no throw', pp: { ...base, assessment_date: 'not-a-date', attestation_deadline: '2026-07-20' }, expect: (o) => o.date_eligible === false },
  ];
  for (const c of cases) {
    let threw = false, o;
    try { o = compute(c.pp).output_payload; } catch (e) { threw = true; }
    const plausible = !threw && c.expect(o);
    rows.push({ label: c.label, threw, plausible });
  }
  return rows;
}

// ---------- P5: metamorphic — permutation-invariance of identity_set/certification order ----------
function checkP5_permutation_exact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffledIdentity = [...pp.identity_set];
    const shuffledCerts = [...pp.claimed_assessor_certifications];
    for (const arr of [shuffledIdentity, shuffledCerts]) {
      for (let j = arr.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
    }
    const pp2 = { ...pp, identity_set: shuffledIdentity, claimed_assessor_certifications: shuffledCerts };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    if (r1.eligible !== r2.eligible) violations++;
    if (r1.route_eligible !== r2.route_eligible) violations++;
    if (r1.cert_eligible !== r2.cert_eligible) violations++;
    if (r1.independence_eligible !== r2.independence_eligible) violations++;
    if (r1.date_eligible !== r2.date_eligible) violations++;
  }
  return { name: 'P5_permutation_invariance_exact', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.boundary_forced = checkP4_forced();
results.properties.push(checkP5_permutation_exact());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-487-assessor-independence-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
