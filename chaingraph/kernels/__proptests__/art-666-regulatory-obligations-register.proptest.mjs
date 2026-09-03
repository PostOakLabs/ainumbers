// art-666-regulatory-obligations-register — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:d914ee5f45ba15d39e603ffe41a056532427669bfb4bd0526449d4a1febcd802
// spec: OBLIGATIONS-REGISTER-BUILD-SPEC.md (workspace root, staged 2026-09-03, SLATE-SPEC-REPIN-1 pin).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Class K, float_sensitive: YES (narrowly) — the two coverage percentages are the only float
// path: one Math.round over a non-negative ratio scaled by 10, re-derived independently in P2
// and pinned at the spec's worked-example values (66.7 / 33.3) by the fixture oracle. Integer
// counts never round. Everything else is counting and closed-set enum emission.
//
// Run: node chaingraph/kernels/__proptests__/art-666-regulatory-obligations-register.proptest.mjs

import { compute } from '../art-666-regulatory-obligations-register.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-666-regulatory-obligations-register';
const rand = mulberry32(0x6660B1);
const TRIALS = 8000;

const round1 = (n, d) => (d <= 0 ? 0 : Math.round((n / d) * 1000) / 10);

function randId(rng, prefix) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-';
  return prefix + '-' + Array.from({ length: 3 + Math.floor(rng() * 6) }, () => pick(rng, alphabet.split(''))).join('');
}

// A structurally VALID register rule: unique rule_id, well-typed optional fields.
function randRule(rng, usedIds) {
  let id = randId(rng, 'RULE');
  while (usedIds.has(id)) id = randId(rng, 'RULE');
  usedIds.add(id);
  const hasOwner = rng() < 0.75;
  const ownerRoll = rng();
  return {
    rule_id: id,
    owner: hasOwner ? (ownerRoll < 0.1 ? null : 'owner-' + Math.floor(rng() * 6)) : undefined,
    control_ids: rng() < 0.7 ? Array.from({ length: Math.floor(rng() * 3) }, () => randId(rng, 'C')) : (rng() < 0.5 ? [] : null),
    evidence_refs: rng() < 0.6 ? Array.from({ length: Math.floor(rng() * 2) + 1 }, () => randId(rng, 'E')) : (rng() < 0.5 ? [] : null),
  };
}

function randValidRegister(rng, n) {
  const usedIds = new Set();
  const rules = Array.from({ length: n }, () => randRule(rng, usedIds));
  return { input_parameters: { as_of: '2026-09-03', rules } };
}

// Recount coverage straight from the rules, independently of the kernel's own counters.
function recount(pp) {
  const rules = pp.input_parameters.rules;
  const total = rules.length;
  const unassigned = [];
  let ownerAssigned = 0, controlLinked = 0, evidenceLinked = 0;
  for (const r of rules) {
    if (typeof r.owner === 'string' && r.owner.trim().length > 0) ownerAssigned++;
    else unassigned.push(r.rule_id);
    if (Array.isArray(r.control_ids) && r.control_ids.length > 0) controlLinked++;
    if (Array.isArray(r.evidence_refs) && r.evidence_refs.length > 0) evidenceLinked++;
  }
  return { total, ownerAssigned, unassigned, controlLinked, evidenceLinked };
}

// ---------- P1: accounting identity — owner_assigned + unassigned.length === total, always ----------
function checkP1_accountingIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 12));
    checked++;
    const op = compute(pp).output_payload;
    if (op.intake_error !== undefined) violations++;
    else if (op.owner_assigned + op.unassigned.length !== op.total) violations++;
    else if (op.total !== recount(pp).total) violations++;
  }
  return { name: 'P1_owner_assigned_plus_unassigned_equals_total', checked, violations };
}

// ---------- P2: percentages re-derived independently, both one-decimal rounded ----------
function checkP2_percentagesRecomputed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 40));
    checked++;
    const op = compute(pp).output_payload;
    const rc = recount(pp);
    if (op.owner_assigned !== rc.ownerAssigned) violations++;
    if (op.control_linked !== rc.controlLinked) violations++;
    if (op.evidence_linked !== rc.evidenceLinked) violations++;
    if (JSON.stringify(op.unassigned) !== JSON.stringify(rc.unassigned)) violations++;
    if (op.owner_coverage_pct !== round1(rc.ownerAssigned, rc.total)) violations++;
    if (op.evidence_coverage_pct !== round1(rc.evidenceLinked, rc.total)) violations++;
  }
  return { name: 'P2_counts_and_percentages_independently_recomputed', checked, violations };
}

// ---------- P3: verdict — COVERED iff unassigned empty AND every rule has evidence; else GAPS_FOUND ----------
function checkP3_verdictContract() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 20));
    checked++;
    const op = compute(pp).output_payload;
    const rc = recount(pp);
    const shouldCover = rc.unassigned.length === 0 && rc.evidenceLinked === rc.total;
    if (shouldCover !== (op.overall_determination === 'COVERED')) violations++;
    const failChecks = op.findings.filter((f) => f.status === 'FAIL').map((f) => f.check);
    if (JSON.stringify(failChecks) !== JSON.stringify(op.findings.map((f) => f.check))) violations++;
    if (rc.unassigned.length > 0 && !failChecks.includes('owner_coverage')) violations++;
    if (rc.total - rc.evidenceLinked > 0 && !failChecks.includes('evidence_coverage')) violations++;
    if (rc.unassigned.length === 0 && failChecks.includes('owner_coverage')) violations++;
    if (rc.total === rc.evidenceLinked && failChecks.includes('evidence_coverage')) violations++;
    if (rc.unassigned.length === 0 && rc.total === rc.evidenceLinked && op.findings.length !== 0) violations++;
  }
  return { name: 'P3_covered_iff_no_owner_gap_and_no_evidence_gap', checked, violations };
}

// ---------- P4: control linkage never gates the verdict (spec oracle: 2 of 3 linked, no control finding) ----------
function checkP4_controlsNeverGate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 15));
    // Strip every control linkage: verdict must be unchanged.
    const stripped = { input_parameters: { as_of: pp.input_parameters.as_of, rules: pp.input_parameters.rules.map((r) => ({ ...r, control_ids: [] })) } };
    checked++;
    const a = compute(pp).output_payload;
    const b = compute(stripped).output_payload;
    if (a.overall_determination !== b.overall_determination) violations++;
    if (JSON.stringify(a.findings) !== JSON.stringify(b.findings)) violations++;
    if (a.unassigned && JSON.stringify(a.unassigned) !== JSON.stringify(b.unassigned)) violations++;
    if (b.findings.some((f) => f.check === 'control_coverage')) violations++;
    if (a.findings.some((f) => f.check === 'control_coverage')) violations++;
  }
  return { name: 'P4_control_linkage_measured_never_gated', checked, violations };
}

// ---------- P5: intake mutations always fail closed ----------
const MUTATORS = [
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 0 ? { ...r, rule_id: undefined } : r)) } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 0 ? { ...r, rule_id: '  ' } : r)) } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 0 ? { ...r, owner: 7 } : r)) } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 0 ? { ...r, control_ids: 'C-1' } : r)) } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 0 ? { ...r, evidence_refs: [''] } : r)) } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.concat([pp.input_parameters.rules[0]]) } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: [] } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: 'not-an-array' } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, as_of: '2026/09/03' } }),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 0 ? 'not-an-object' : r)) } }),
  (pp) => ({}),
  (pp) => ({ input_parameters: { ...pp.input_parameters, rules: pp.input_parameters.rules.map((r, i) => (i === 1 ? { ...r, rule_id: pp.input_parameters.rules[0].rule_id } : r)) } }),
];
function checkP5_intakeFailsClosed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 2 + Math.floor(rand() * 4);
    const pp = randValidRegister(rand, n);
    const mutated = pick(rand, MUTATORS)(pp);
    checked++;
    const { output_payload: op, compliance_flags } = compute(mutated);
    if (!Array.isArray(op.errors) || op.errors.length !== 1 || typeof op.errors[0] !== 'string' || op.errors[0].length === 0) violations++;
    if (op.findings.length !== 1 || op.findings[0].check !== 'intake_validation' || op.findings[0].status !== 'FAIL') violations++;
    if (op.findings[0] && op.findings[0].detail !== op.errors[0]) violations++;
    if (op.overall_determination !== 'GAPS_FOUND') violations++;
    if (op.total !== 0 || op.owner_assigned !== 0 || op.unassigned.length !== 0) violations++;
    if (JSON.stringify(compliance_flags) !== JSON.stringify(['OBLREG_INTAKE_VALIDATION_FAILED'])) violations++;
  }
  return { name: 'P5_intake_mutations_always_fail_closed', checked, violations };
}

// ---------- P6: determinism — same pp twice, byte-identical output ----------
function checkP6_deterministic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 25));
    checked++;
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    if (a !== b) violations++;
  }
  return { name: 'P6_deterministic_same_input_same_output', checked, violations };
}

// ---------- P7: shape invariant — no NaN/undefined/non-finite anywhere in the result ----------
function checkP7_shapeClean() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 25));
    checked++;
    const r = compute(pp);
    if (findShapeViolations(r.output_payload).length || findShapeViolations(r.compliance_flags).length) violations++;
  }
  return { name: 'P7_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P8: flag channel — empty on well-formed input, one conditional flag on intake ----------
// failure, mirrored by errors (flag-mirror doctrine: the closed-list member is truthy exactly
// when the conditional flag is present). The verdict never rides a flag.
function checkP8_flagMirrorContract() {
  let violations = 0, checked = 0;
  const EMPTY = JSON.stringify([]);
  const INTAKE_FLAG = JSON.stringify(['OBLREG_INTAKE_VALIDATION_FAILED']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 2 + Math.floor(rand() * 20)); // >= 2 rules: every MUTATOR reaches its target
    const mutated = pick(rand, MUTATORS)(pp);
    checked++;
    const ok = compute(pp);
    if (JSON.stringify(ok.compliance_flags) !== EMPTY) violations++;
    if (Array.isArray(ok.output_payload.errors)) violations++;
    const bad = compute(mutated);
    if (JSON.stringify(bad.compliance_flags) !== INTAKE_FLAG) violations++;
    if (!(Array.isArray(bad.output_payload.errors) && bad.output_payload.errors.length > 0)) violations++;
  }
  return { name: 'P8_flag_mirror_empty_on_success_intake_flag_mirrored_by_errors', checked, violations };
}

// ---------- P9 forced categorical boundary cases ----------
const FORCED_CASES = [
  [{}, 'fully empty input'],
  [{ input_parameters: { rules: [] } }, 'empty register'],
  [{ input_parameters: { rules: [{ rule_id: 'ONLY-ONE', owner: null, control_ids: [], evidence_refs: [] }] } }, 'single unassigned no-evidence rule'],
  [{ input_parameters: { as_of: '2026-09-03', rules: [{ rule_id: 'SOLO', owner: 'ops', control_ids: ['C'], evidence_refs: ['E'] }] } }, 'single fully-covered rule'],
  [{ input_parameters: { as_of: '2026-09-03', rules: [{ rule_id: 'NO-FIELDS' }] } }, 'rule with only rule_id'],
  [{ input_parameters: { as_of: null, rules: [{ rule_id: 'X', owner: 'ops', evidence_refs: ['E'] }] } }, 'null as_of treated as absent'],
  [randValidRegister(mulberry32(77), 200), '200-rule register'],
];
function checkP9_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const { output_payload: op, compliance_flags } = compute(pp);
    const failedIntake = Array.isArray(op.errors) && op.errors.length > 0;
    const rc = !failedIntake ? recount(pp) : null;
    const plausible = failedIntake
      ? op.overall_determination === 'GAPS_FOUND' && op.total === 0 && JSON.stringify(compliance_flags) === JSON.stringify(['OBLREG_INTAKE_VALIDATION_FAILED'])
      : op.total === rc.total && op.owner_coverage_pct === round1(rc.ownerAssigned, rc.total) && op.evidence_coverage_pct === round1(rc.evidenceLinked, rc.total)
        && (op.overall_determination === 'COVERED') === (rc.unassigned.length === 0 && rc.evidenceLinked === rc.total)
        && JSON.stringify(compliance_flags) === JSON.stringify([]);
    rows.push({ label, overall: op.overall_determination, intake_failed: failedIntake, plausible });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_accountingIdentity(),
  checkP2_percentagesRecomputed(),
  checkP3_verdictContract(),
  checkP4_controlsNeverGate(),
  checkP5_intakeFailsClosed(),
  checkP6_deterministic(),
  checkP7_shapeClean(),
  checkP8_flagMirrorContract(),
];
const forced = checkP9_forced();
const forcedImplausible = forced.filter((f) => !f.plausible);
properties.push({ name: 'P9_forced_boundary_cases_plausible', checked: forced.length, violations: forcedImplausible.length });

const ok = summarize(KERNEL_ID, oracle, properties);
if (!ok) console.log('forced boundary rows:', JSON.stringify(forced, null, 2));
process.exit(ok ? 0 : 1);
