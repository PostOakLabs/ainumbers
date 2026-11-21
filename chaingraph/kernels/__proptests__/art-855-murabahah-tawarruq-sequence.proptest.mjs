// art-855-murabahah-tawarruq-sequence: class-K property-test floor.
// kernel_digest_at_authoring: sha256:a36b839883247bd66e55f312cbc914f55ace480ec5dde2b1be0c771f6c7392eb
// spec: the murabahah / tawarruq sequence checklist node (values only, BNM profile)
// human_sign_off: PENDING
//
// ZERO external dependencies: Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-855-murabahah-tawarruq-sequence.proptest.mjs

import { compute, buildArtifact, STEPS, CHECK_IDS, MAX_STEPS } from '../art-855-murabahah-tawarruq-sequence.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-855-murabahah-tawarruq-sequence';
const FLAGS = ['agent_role', 'delivery_restricted', 'onsale_obligation', 'promise_to_sell_third_party', 'payment_before_contract', 'embedded_in_sale_contract'];

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * STEPS.length);
  const names = STEPS.slice().sort(() => rng() - 0.5).slice(0, n);
  const steps = names.map((step) => {
    const r = { step, t: Math.floor(rng() * 12), evidence_present: rng() < 0.8 };
    for (const f of FLAGS) if (rng() < 0.1) r[f] = true;
    return r;
  });
  return { structure: pick(rng, ['murabahah', 'tawarruq']), steps };
}

// P1: determinism, shape, and one verdict per check id in table order.
function checkP1DeterminismShape() {
  const rng = mulberry32(8551);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomPP(rng);
    const a = compute(pp), b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const p = a.output_payload;
    if (p.refused !== false || p.not_a_shariah_ruling !== true) { violations++; console.log('P1 violation: payload shape'); continue; }
    if (!deepEqual(p.checks.map((c) => c.check_id), CHECK_IDS)) { violations++; console.log('P1 violation: check list'); }
    if (findShapeViolations(p).length) { violations++; console.log('P1 violation: undefined or non-JSON value in payload'); }
  }
  return { name: 'determinism_and_shape', checked, violations };
}

// P2: order_ok and rules_ok are exactly the AND of the matching kinds; first failing step is
// null exactly when both are true; the conditional flags mirror into warnings.
function checkP2FlagsConsistent() {
  const rng = mulberry32(8552);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const { output_payload: p, compliance_flags: f } = compute(randomPP(rng));
    checked++;
    const oFail = p.checks.some((c) => c.kind === 'order' && c.verdict === 'fail');
    const rFail = p.checks.some((c) => c.kind === 'rule' && c.verdict === 'fail');
    if (p.order_ok !== !oFail || p.rules_ok !== !rFail) { violations++; console.log('P2 violation: flag vs checks'); }
    if ((p.first_failing_step === null) !== (p.order_ok && p.rules_ok)) { violations++; console.log('P2 violation: first_failing_step'); }
    if (f.includes('ORDER_NOT_OK') !== !p.order_ok || f.includes('RULES_NOT_OK') !== !p.rules_ok) { violations++; console.log('P2 violation: compliance flags'); }
    if (!deepEqual(p.warnings, f)) { violations++; console.log('P2 violation: warnings do not mirror flags'); }
  }
  return { name: 'order_and_rules_flags_consistent', checked, violations };
}

// P3: checks for the other structure are never applicable; adding the unrelated structure's
// flags does not change a verdict set it cannot see.
function checkP3StructureScope() {
  const rng = mulberry32(8553);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload: p } = compute(pp);
    checked++;
    for (const c of p.checks) {
      const own = (pp.structure === 'murabahah') === c.check_id.startsWith('M_');
      if (!own && c.verdict !== 'not_applicable') { violations++; console.log('P3 violation: foreign check applied ' + c.check_id); }
    }
  }
  return { name: 'checks_scoped_to_structure', checked, violations };
}

// P4: moving the sale contract ahead of ownership flips the order flag and leaves rules alone.
function checkP4OrderRulesIndependent() {
  let checked = 0, violations = 0;
  for (let k = 0; k < 20; k++) {
    const mk = (own) => ({ structure: 'murabahah', steps: [
      { step: 'ifi_acquires_asset', t: own, evidence_present: true },
      { step: 'wad_executed', t: 1, evidence_present: true },
      { step: 'sale_contract', t: 10, evidence_present: true },
      { step: 'possession_transfer', t: 11, evidence_present: true }] });
    const good = compute(mk(0)).output_payload;
    const bad = compute(mk(10 + k)).output_payload;
    checked++;
    if (!good.order_ok || !good.rules_ok) { violations++; console.log('P4 violation: clean case failed'); }
    if (bad.order_ok || !bad.rules_ok) { violations++; console.log('P4 violation: order flip leaked into rules'); }
  }
  return { name: 'order_flag_independent_of_rules_flag', checked, violations };
}

// P5: input contract. Hostile and malformed input refuses by code, never throws, never echoes the value.
function checkP5InputContract() {
  const base = () => ({ structure: 'tawarruq', steps: [{ step: 'sale_contract', t: 1, evidence_present: true }] });
  /** @type {any[]} */
  const cases = [
    [null, 'REFUSED_INPUT_NOT_OBJECT'], [5, 'REFUSED_INPUT_NOT_OBJECT'], ['x', 'REFUSED_INPUT_NOT_OBJECT'], [[], 'REFUSED_INPUT_NOT_OBJECT'],
    [{ ...base(), authority_profile: 'IIFA' }, 'REFUSED_AUTHORITY_NOT_PINNED'],
    [{ ...base(), name: 'x' }, 'REFUSED_UNKNOWN_FIELD'],
    [{ ...base(), __proto_x__: 1 }, 'REFUSED_UNKNOWN_FIELD'],
    [{ structure: 'toString', steps: base().steps }, 'REFUSED_STRUCTURE'],
    [{ ...base(), steps: [] }, 'REFUSED_STEPS'],
    [{ ...base(), steps: new Array(MAX_STEPS + 1).fill(0) }, 'REFUSED_STEPS'],
    [{ ...base(), steps: [{ step: 'constructor', t: 1, evidence_present: true }] }, 'REFUSED_STEP_RECORD'],
    [{ ...base(), steps: [{ step: 'sale_contract', t: 1e300, evidence_present: true }] }, 'REFUSED_INPUT_UNSAFE_NUMBER'],
    [{ ...base(), steps: [{ step: 'sale_contract', t: Infinity, evidence_present: true }] }, 'REFUSED_INPUT_UNSAFE_NUMBER'],
    [{ ...base(), steps: [{ step: 'sale_contract', t: NaN, evidence_present: true }] }, 'REFUSED_INPUT_UNSAFE_NUMBER'],
    [{ ...base(), steps: [{ step: 'sale_contract', t: '1', evidence_present: true }] }, 'REFUSED_STEP_RECORD'],
    [{ ...base(), steps: [{ step: 'sale_contract', t: 1, evidence_present: 1 }] }, 'REFUSED_STEP_RECORD'],
    [{ ...base(), steps: [{ step: 'sale_contract', t: 1, evidence_present: true, onsale_obligation: null }] }, 'REFUSED_STEP_RECORD'],
  ];
  let checked = 0, violations = 0;
  for (const [pp, code] of cases) {
    checked++;
    try {
      const { output_payload: p, compliance_flags: f } = compute(pp);
      if (p.refused !== true || p.refusal_code !== code || !f.includes(code) || !p.warnings.includes(code)) { violations++; console.log(`P5 violation: expected ${code}, got ${p.refusal_code}`); }
      if (/e\+3\d\d|Infinity/.test(JSON.stringify(p))) { violations++; console.log('P5 violation: hostile value echoed'); }
    } catch (e) { violations++; console.log(`P5 violation: compute threw: ${String(e.message).slice(0, 80)}`); }
  }
  return { name: 'input_contract_refuses_by_code', checked, violations };
}

// P6 (D6): buildArtifact never throws; an unhashable preimage gets a null hash plus hash_refusal.
async function checkP6BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const hostile = [
    { structure: 'tawarruq', steps: [{ step: 'sale_contract', t: 1e300, evidence_present: true }] },
    { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide },
  ];
  for (const pp of hostile) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log('P6 violation: artifact shape'); }
    } catch (e) { violations++; console.log(`P6 violation: buildArtifact threw: ${String(e.message).slice(0, 80)}`); }
  }
  const clean = { structure: 'tawarruq', steps: [{ step: 'sale_contract', t: 1, evidence_present: true }] };
  for (const pp of [clean, null, 5, [], { structure: 'x' }]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P6 violation: clean or refused-by-name input lost its hash'); }
    } catch (e) { violations++; console.log(`P6 violation: buildArtifact threw on clean input: ${String(e.message).slice(0, 80)}`); }
  }
  return { name: 'buildArtifact_never_throws', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1DeterminismShape(),
  checkP2FlagsConsistent(),
  checkP3StructureScope(),
  checkP4OrderRulesIndependent(),
  checkP5InputContract(),
  await checkP6BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
