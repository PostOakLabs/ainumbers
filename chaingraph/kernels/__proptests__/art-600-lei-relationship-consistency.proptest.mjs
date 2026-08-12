// art-600-lei-relationship-consistency.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:5f6da9c921850504efa9bfc5e8e7f0e2bd92ee4271a81a8eb7d71e7a4dd60b96
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class C -- graph-cycle detection over
// caller-supplied relationship records, unbounded in principle but the walk terminates because it
// only revisits nodes on the CURRENT path). NOT a proof, NOT Dafny.
// float_sensitive: NO -- every check is string equality, ISO-day-string comparison, or graph
// reachability. No arithmetic division or fractional comparison in compute().
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a termination
// property for the cycle walk (P2 -- class-C's mandatory termination-or-report requirement: the DFS
// must always finish, even on an adversarially large or self-referential graph, and report
// cycle_path non-null iff a real cycle exists), a differential re-derivation of invariant 1 (ISO
// 17442 mod-97 node validity, reusing the SAME algorithm shape art-599's floor already differentially
// verifies) plus a hand-built cycle constructor used to force invariant 2 both ways (P3), a
// metamorphic determinism property (P4), and forced categorical boundary cases (P5: empty record
// set, INACTIVE parent edges never counted as a cycle, overlapping vs adjacent ACTIVE duplicate
// periods).

import { compute } from '../art-600-lei-relationship-consistency.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-600-lei-relationship-consistency.fixtures.json');
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
const rand = mulberry32(0x6001EA1);

// valid LEI generator via the SAME mod-97 algorithm the kernel reuses -- an independent construction
// (search for a check-digit suffix that satisfies remainder==1), not a copy of the kernel's function.
function charToDigits(c) {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return c;
  if (code >= 65 && code <= 90) return String(code - 55);
  return '';
}
function mod97(numStr) { let r = 0; for (let i = 0; i < numStr.length; i++) r = (r * 10 + Number(numStr[i])) % 97; return r; }
// ISO 17442: an LEI is a fixed 18-character body + 2 check digits (20 chars total). Check digits are
// computed over body+"00" (mod 97 -> remainder -> checkDigits = 98-remainder), same ISO 7064 MOD 97-10
// algorithm the kernel reuses from art-246 -- constructed independently here, not copied from it.
function makeValidLei(body18) {
  const digits = body18.split('').map(charToDigits).join('') + '00';
  const remainder = mod97(digits);
  const checkDigits = String(98 - remainder).padStart(2, '0');
  return body18 + checkDigits;
}
// ---------- P1: totality ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { relationships: null }, { relationships: 'not-an-array' },
    { relationships: [null, 42, {}] },
    { subject_lei: 'bad', relationships: [{ start_node_lei: '', end_node_lei: '' }] },
    { relationships: [{ relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', start_node_lei: 'A', end_node_lei: 'A' }] },
    { relationships: Array.from({ length: 40 }, (_, i) => ({ start_node_lei: `N${i}`, end_node_lei: `N${i + 1}`, relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'ACTIVE' })) },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (!Array.isArray(o.violations)) violations++;
    if (!Array.isArray(o.invariant_results) || o.invariant_results.length !== 4) violations++;
    if (typeof o.records_assessed !== 'boolean') violations++;
    if (!Array.isArray(out.compliance_flags)) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: termination — the cycle-detecting DFS must ALWAYS finish and report correctly, even
// on a long chain, a self-loop, and a deliberately constructed cycle of varying length ----------
function checkP2_termination_and_cycle_detection() {
  let violations = 0, checked = 0;
  // long ACYCLIC chain (100 nodes) -> must terminate promptly with no cycle detected
  { checked++;
    const n = 100;
    const nodes = Array.from({ length: n }, (_, i) => `LEI${String(i).padStart(16, '0')}`);
    const rels = [];
    for (let i = 0; i < n - 1; i++) rels.push({ start_node_lei: nodes[i], end_node_lei: nodes[i + 1], relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'ACTIVE' });
    const start = Date.now();
    const { output_payload: o } = compute({ subject_lei: nodes[0], relationships: rels });
    const elapsedMs = Date.now() - start;
    if (o.cycle_path !== null) violations++;
    if (elapsedMs > 5000) violations++; // generous bound -- the point is termination, not speed
  }
  // self-loop -> immediate cycle
  { checked++;
    const self = 'LEISELFLOOP00000001';
    const { output_payload: o } = compute({ subject_lei: self, relationships: [{ start_node_lei: self, end_node_lei: self, relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'ACTIVE' }] });
    if (o.cycle_path === null) violations++; }
  // constructed cycle of length 3..8 -> always detected
  for (let len = 3; len <= 8; len++) {
    checked++;
    const nodes = Array.from({ length: len }, (_, i) => `LEICYCLE${String(i).padStart(11, '0')}`);
    const rels = nodes.map((node, i) => ({ start_node_lei: node, end_node_lei: nodes[(i + 1) % len], relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'ACTIVE' }));
    const { output_payload: o } = compute({ subject_lei: nodes[0], relationships: rels });
    if (o.cycle_path === null) violations++;
  }
  return { name: 'P2_termination_bounded_and_cycle_always_detected', trials: checked, violations };
}

// ---------- P3: differential — mod-97 node validity re-derived independently, plus forced
// active/inactive edge distinction for invariant 2 ----------
function checkP3_differential_and_forced() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 40; i++) {
    checked++;
    const body = Array.from({ length: 18 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(rand() * 36)]).join('');
    const lei = makeValidLei(body);
    const digits = lei.split('').map(charToDigits).join('');
    const expectedValid = mod97(digits) === 1;
    const { output_payload: o } = compute({ subject_lei: lei, relationships: [] });
    if (o.subject_lei_valid !== expectedValid) violations++;
    if (!expectedValid) violations++; // makeValidLei must always construct a valid LEI by design
  }
  // INACTIVE parent edge forming a cycle shape must NOT be flagged -- only ACTIVE edges are walked.
  { checked++;
    const a = 'LEIAAAA000000000001', b = 'LEIBBBB000000000002';
    const { output_payload: o } = compute({
      subject_lei: a,
      relationships: [
        { start_node_lei: a, end_node_lei: b, relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'INACTIVE' },
        { start_node_lei: b, end_node_lei: a, relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'INACTIVE' },
      ],
    });
    if (o.cycle_path !== null) violations++; }
  return { name: 'P3_differential_mod97_and_inactive_edges_never_cycle', trials: checked, violations };
}

// ---------- P4: metamorphic — determinism, record-order independence for cycle detection ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 40; trial++) {
    checked++;
    const len = 3 + Math.floor(rand() * 4);
    const nodes = Array.from({ length: len }, (_, i) => `LEIM${trial}${String(i).padStart(12, '0')}`);
    const rels = nodes.map((node, i) => ({ start_node_lei: node, end_node_lei: nodes[(i + 1) % len], relationship_type: 'IS_DIRECTLY_CONSOLIDATED_BY', relationship_status: 'ACTIVE' }));
    const pp = { subject_lei: nodes[0], relationships: rels };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;

    // shuffled record order -> cycle still detected (order-independence)
    const shuffled = [...rels];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const shuffledOut = compute({ subject_lei: nodes[0], relationships: shuffled }).output_payload;
    if ((shuffledOut.cycle_path === null) !== (a.cycle_path === null)) violations++;
  }
  return { name: 'P4_metamorphic_determinism_and_record_order_independence', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty record set -> consistent is null, not true
  { checked++;
    const { output_payload: o } = compute({ subject_lei: '', relationships: [] });
    if (o.consistent !== null) violations++;
    if (o.records_assessed !== false) violations++; }
  // unrecognized exception code -> flagged
  { checked++;
    const { output_payload: o } = compute({ relationships: [{ start_node_lei: 'A', end_node_lei: 'B', exception_code: 'TOTALLY_MADE_UP' }] });
    if (!o.unrecognized_exception_codes.includes('TOTALLY_MADE_UP')) violations++; }
  // deprecated exception code -> recognized (not flagged as unrecognized)
  { checked++;
    const { output_payload: o } = compute({ relationships: [{ start_node_lei: 'A', end_node_lei: 'B', exception_code: 'LEGAL_OBSTACLES' }] });
    if (o.unrecognized_exception_codes.length !== 0) violations++;
    if (!o.deprecated_exception_codes.includes('LEGAL_OBSTACLES')) violations++; }
  // two overlapping ACTIVE duplicates -> flagged; two ADJACENT (non-overlapping) periods -> not flagged
  { checked++;
    const overlap = compute({ relationships: [
      { start_node_lei: 'A', end_node_lei: 'B', relationship_type: 'X', relationship_status: 'ACTIVE', start_date: '2020-01-01', end_date: '2021-01-01' },
      { start_node_lei: 'A', end_node_lei: 'B', relationship_type: 'X', relationship_status: 'ACTIVE', start_date: '2020-06-01', end_date: '2022-01-01' },
    ] }).output_payload;
    if (overlap.duplicate_active_triples.length !== 1) violations++;
    const adjacent = compute({ relationships: [
      { start_node_lei: 'A', end_node_lei: 'B', relationship_type: 'X', relationship_status: 'ACTIVE', start_date: '2020-01-01', end_date: '2021-01-01' },
      { start_node_lei: 'A', end_node_lei: 'B', relationship_type: 'X', relationship_status: 'ACTIVE', start_date: '2021-01-01', end_date: '2022-01-01' },
    ] }).output_payload;
    if (adjacent.duplicate_active_triples.length !== 0) violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(checkP2_termination_and_cycle_detection());
results.properties.push(checkP3_differential_and_forced());
results.properties.push(checkP4_metamorphic());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-600-lei-relationship-consistency',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
