// art-379-agent-incident-record-composer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:ca7adfd773fa280aeacd5abc28dd20e505612adeceeb7d9311e419c794920177
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- direct read: zero arithmetic, only string/enum/array normalization and
// a regex shape check (HASH_RE). Forced CATEGORICAL boundary cases used instead (below).
// Checks: fixture-oracle gate, termination (unbounded session_evidence array -- bound is array
// length, single filter pass), boundedness (evidence_count === session_evidence.length,
// invalid_evidence_count + evidence_count === input length, every declared enum coerced to a
// member of its declared set, never left undefined), metamorphic (session_evidence permutation
// invariance of evidence_count/invalid_evidence_count/record_claim_strength -- filtering by a
// per-item predicate is order-independent), forced categorical boundary cases (missing
// agent_identity, forbidden severity_class/remediation.status coercion, malformed vs
// well-formed cross-link hash shapes, mixed valid/invalid evidence array).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-379-agent-incident-record-composer.proptest.mjs

import { compute } from '../art-379-agent-incident-record-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-379-agent-incident-record-composer.fixtures.json');
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
const rand = mulberry32(0x379D0);

const EVIDENCE_TYPES = ['otel_span', 'in_toto_link', 'bogus_type'];

function randomEvidence(rng, i) {
  const evidence_type = EVIDENCE_TYPES[Math.floor(rng() * EVIDENCE_TYPES.length)];
  const digest = rng() > 0.1 ? `sha256:${'a'.repeat(64)}` : null; // occasionally omit digest -> invalid
  return { evidence_type, digest };
}

function randomPP(rng, n) {
  const session_evidence = [];
  for (let i = 0; i < n; i++) session_evidence.push(randomEvidence(rng, i));
  return {
    agent_identity: { agent_id: 'agent://x/v1', agent_version: '1.0.0' },
    incident: { incident_id: `INC-${Math.floor(rng() * 1000)}`, severity_class: 'warning' },
    session_evidence,
  };
}

const TRIALS = 2000;

// ---------- P1: termination — unbounded session_evidence array, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 500];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.evidence_count + output_payload.invalid_evidence_count !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.evidence_count + output_payload.invalid_evidence_count !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — counts consistent, every enum coerced to a declared member ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const SEVERITIES = new Set(['affirming', 'warning', 'contraindicated']);
  const STATUSES = new Set(['open', 'in_progress', 'resolved']);
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    pp.incident.severity_class = rand() > 0.5 ? 'garbage' : 'affirming';
    pp.remediation = { status: rand() > 0.5 ? 'garbage_status' : 'resolved' };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.evidence_count !== pp.session_evidence.filter((e) => e.digest && ['otel_span', 'in_toto_link'].includes(e.evidence_type)).length) violations++;
    if (!SEVERITIES.has(output_payload.incident.severity_class)) violations++;
    if (!STATUSES.has(output_payload.remediation.status)) violations++;
    if (!['insufficient', 'declared-only', 'evidence-backed'].includes(output_payload.record_claim_strength)) violations++;
  }
  return { name: 'P2_boundedness_counts_and_enum_coercion', trials: checked, violations };
}

// ---------- P3: metamorphic — session_evidence permutation invariance of counts/claim strength ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 3; i++) {
    const n = 2 + Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const shuffled = { ...pp, session_evidence: [...pp.session_evidence].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.evidence_count !== b.evidence_count) violations++;
    if (a.invalid_evidence_count !== b.invalid_evidence_count) violations++;
    if (a.record_claim_strength !== b.record_claim_strength) violations++;
  }
  return { name: 'P3_permutation_invariance_of_evidence_counts', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float_sensitive: no) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;

  // missing agent_identity -> insufficient claim strength + flagged
  {
    const { output_payload, compliance_flags } = compute({ incident: {}, session_evidence: [] });
    checked++;
    if (output_payload.record_claim_strength !== 'insufficient') violations++;
    if (!compliance_flags.includes('AU3_AGENT_IDENTITY_MISSING')) violations++;
  }

  // forbidden severity_class coerced to 'warning'
  {
    const { output_payload, compliance_flags } = compute({ agent_identity: { agent_id: 'a' }, incident: { severity_class: 'catastrophic' }, session_evidence: [] });
    checked++;
    if (output_payload.incident.severity_class !== 'warning') violations++;
    if (!output_payload.incident.severity_coerced_from_forbidden_class) violations++;
    if (!compliance_flags.includes('AU3_SEVERITY_CLASS_COERCED')) violations++;
  }

  // well-formed vs malformed cross-link hash shapes
  {
    const wellFormed = compute({ agent_identity: { agent_id: 'a' }, incident: {}, session_evidence: [], escalation_cross_link: { escalation_record_hash: 'sha256:' + 'a'.repeat(64) } });
    const malformed = compute({ agent_identity: { agent_id: 'a' }, incident: {}, session_evidence: [], escalation_cross_link: { escalation_record_hash: 'not-a-hash' } });
    checked++;
    if (!wellFormed.output_payload.escalation_cross_link.escalation_record_hash_well_formed) violations++;
    if (malformed.output_payload.escalation_cross_link.escalation_record_hash_well_formed) violations++;
    if (!malformed.compliance_flags.includes('AU3_ESCALATION_CROSS_LINK_MALFORMED')) violations++;
    if (!malformed.compliance_flags.includes('AU3_ESCALATION_CROSS_LINK_PRESENT')) violations++;
  }

  // mixed valid/invalid evidence array
  {
    const { output_payload, compliance_flags } = compute({
      agent_identity: { agent_id: 'a' }, incident: {},
      session_evidence: [{ evidence_type: 'otel_span', digest: 'sha256:' + 'a'.repeat(64) }, { evidence_type: 'bogus', digest: 'sha256:' + 'b'.repeat(64) }, { evidence_type: 'in_toto_link' }],
    });
    checked++;
    if (output_payload.evidence_count !== 1) violations++;
    if (output_payload.invalid_evidence_count !== 2) violations++;
    if (!compliance_flags.includes('AU3_INVALID_EVIDENCE_DROPPED')) violations++;
    if (output_payload.record_claim_strength !== 'evidence-backed') violations++;
  }

  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-379-agent-incident-record-composer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
