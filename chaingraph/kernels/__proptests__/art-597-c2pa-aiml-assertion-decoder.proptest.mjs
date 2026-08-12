// art-597-c2pa-aiml-assertion-decoder.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:d620138d5260a51255c0c89c76d6ae0e99a18d4a396f6b5443ca9aff00e2bd6e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class A -- pure structural decode
// over a small declared-label vocabulary, no numeric computation). NOT a proof, NOT Dafny.
// float_sensitive: NO -- the kernel does no arithmetic at all; every field is a string/array
// pass-through, filter, or set-membership test.
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), the HARD RAIL
// this kernel's own header comment states as its defining invariant -- it must never adjudicate
// truth, only decode what is asserted (P2: absence of an assertion never becomes a truthy/falsy
// claim; an unrecognized label is silently ignored, never surfaced as an error), a metamorphic
// determinism + action-order-preservation property (P3), and forced categorical boundary cases (P4:
// empty input, both c2pa.actions and c2pa.actions.v2 present together, malformed action entries).

import { compute } from '../art-597-c2pa-aiml-assertion-decoder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-597-c2pa-aiml-assertion-decoder.fixtures.json');
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
const rand = mulberry32(0x597AC7A);

// ---------- P1: totality — compute() never throws, always well-formed shape ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { assertions: null }, { assertions: 'not-an-array' }, { assertions: [null, 42, 'x', {}] },
    { assertions: [{ label: 'c2pa.actions', actions: null }] },
    { assertions: [{ label: 'c2pa.actions', actions: [null, 42, {}] }] },
    { assertions: [{ label: 'c2pa.ai_training', training_mining_opt_out: 'not-a-bool' }] },
    { assertions: [{ label: 'unrecognized.label.xyz', actions: [{ action: 'x' }] }] },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (!Array.isArray(o.actions)) violations++;
    if (!Array.isArray(o.digital_source_type_summary)) violations++;
    if (!Array.isArray(o.unrecognized_source_types)) violations++;
    if (typeof o.note !== 'string' || o.note.length === 0) violations++;
    if (!Array.isArray(out.compliance_flags) || out.compliance_flags.length === 0) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: the HARD RAIL — absence is never adjudicated true/false, unrecognized labels never
// error, and a present-but-malformed opt-out boolean is ALWAYS 'not_asserted', never guessed ----------
function checkP2_hard_rail_never_adjudicates() {
  let violations = 0, checked = 0;

  // No ai_training assertion at all -> not_asserted, never true/false.
  { checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.actions', actions: [] }] });
    if (o.training_mining_opt_out !== 'not_asserted') violations++; }

  // ai_training present but boolean field missing/wrong-typed -> STILL not_asserted, never guessed.
  const malformedOptOuts = [undefined, null, 'true', 1, 0, [], {}];
  for (const bad of malformedOptOuts) {
    checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.ai_training', training_mining_opt_out: bad }] });
    if (o.training_mining_opt_out !== 'not_asserted') violations++;
  }

  // explicit true/false ARE surfaced verbatim -- the rail forbids inference, not honest pass-through.
  { checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.ai_training', training_mining_opt_out: true }] });
    if (o.training_mining_opt_out !== true) violations++; }
  { checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.ai_generative_training', training_mining_opt_out: false }] });
    if (o.training_mining_opt_out !== false) violations++; }

  // No actions assertion at all -> empty actions array, never an error, never inferred content.
  { checked++;
    const { output_payload: o } = compute({ assertions: [] });
    if (o.actions.length !== 0) violations++;
    if (o.digital_source_type_summary.length !== 0) violations++; }

  return { name: 'P2_hard_rail_absence_never_adjudicated_malformed_never_guessed', trials: checked, violations };
}

// ---------- P3: metamorphic — determinism, and action order is preserved across BOTH actions labels
// (a manifest carrying c2pa.actions then c2pa.actions.v2 must decode them in assertion-array order,
// never reordered or deduplicated) ----------
function checkP3_metamorphic() {
  let violations = 0, checked = 0;
  const sourceTypes = Array.from(
    // reuse a subset of the kernel's own known-vocabulary shape via random synthetic strings so the
    // property does not depend on the kernel's internal KNOWN_SOURCE_TYPES constant
    { length: 3 },
    (_, i) => `http://cv.iptc.org/newscodes/digitalsourcetype/synthetic${i}`
  );
  for (let trial = 0; trial < 150; trial++) {
    checked++;
    const n = 1 + Math.floor(rand() * 5);
    const actionEntries = Array.from({ length: n }, (_, i) => ({
      action: `c2pa.action${i}`,
      digitalSourceType: sourceTypes[i % sourceTypes.length],
      when: `2026-08-${String(1 + (i % 28)).padStart(2, '0')}T00:00:00Z`,
      softwareAgent: `Agent ${i}`,
    }));
    const pp = { assertions: [{ label: 'c2pa.actions', actions: actionEntries }] };

    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;

    if (a.actions.length !== n) violations++;
    for (let i = 0; i < n; i++) {
      if (a.actions[i].action !== actionEntries[i].action) violations++;
      if (a.actions[i].digital_source_type !== actionEntries[i].digitalSourceType) violations++;
    }

    // Two actions assertions (c2pa.actions then c2pa.actions.v2) -> BOTH decoded, order preserved,
    // never collapsed to only the first.
    const secondEntries = [{ action: 'c2pa.published', digitalSourceType: sourceTypes[0], when: '2026-08-01T00:00:00Z', softwareAgent: 'Agent Last' }];
    const twoAssertionPP = { assertions: [{ label: 'c2pa.actions', actions: actionEntries }, { label: 'c2pa.actions.v2', actions: secondEntries }] };
    const combined = compute(twoAssertionPP).output_payload;
    if (combined.actions.length !== n + 1) violations++;
    if (combined.actions[combined.actions.length - 1].action !== 'c2pa.published') violations++;
  }
  return { name: 'P3_metamorphic_determinism_and_action_order_preserved_across_both_labels', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // completely empty -> no actions, no training assertion
  { checked++;
    const { output_payload: o } = compute({});
    if (o.actions.length !== 0) violations++;
    if (o.training_mining_opt_out !== 'not_asserted') violations++; }
  // digitalSourceType absent on an action entry -> null, never fabricated
  { checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.actions', actions: [{ action: 'c2pa.created' }] }] });
    if (o.actions[0].digital_source_type !== null) violations++; }
  // unrecognized digitalSourceType -> surfaced in unrecognized_source_types, action still decoded
  { checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.actions', actions: [{ action: 'c2pa.created', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/bogusUnknownType' }] }] });
    if (o.actions.length !== 1) violations++;
    if (!o.unrecognized_source_types.includes('http://cv.iptc.org/newscodes/digitalsourcetype/bogusUnknownType')) violations++; }
  // null entry inside actions array -> silently skipped, never throws, never fabricates an entry
  { checked++;
    const { output_payload: o } = compute({ assertions: [{ label: 'c2pa.actions', actions: [null, { action: 'c2pa.created' }] }] });
    if (o.actions.length !== 1) violations++; }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(checkP2_hard_rail_never_adjudicates());
results.properties.push(checkP3_metamorphic());
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-597-c2pa-aiml-assertion-decoder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
