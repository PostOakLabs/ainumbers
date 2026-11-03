// art-819-ucp-request-constraints — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:0bb4da6c7a155b861e4d7a7df0ba0e005c08dbc552212217c5dc63268429885e
// spec: board/claimed/UCP-CONSTRAINTS-1.md (UCP 2026-08-25 Request Constraints)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-819-ucp-request-constraints.proptest.mjs

import { compute } from '../art-819-ucp-request-constraints.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-819-ucp-request-constraints';
const N = 300;

const FIELDS = ['a', 'b', 'c', 'd', 'e'];

// a random request object with 1..5 scalar members
function randomRequest(rng) {
  const req = {};
  const n = 1 + Math.floor(rng() * FIELDS.length);
  for (let i = 0; i < n; i++) req[FIELDS[i]] = Math.floor(rng() * 5);
  return req;
}

const verdictOf = (request, constraints) => compute({ request, constraints }).output_payload.verdict;

// removing a required field flips SATISFIED to VIOLATED
function checkRemovingRequiredFlips() {
  const rng = mulberry32(819001);
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const req = randomRequest(rng);
    const keys = Object.keys(req);
    const target = pick(rng, keys);
    const rc = [{ request_constraints: { required: [target] } }];
    if (verdictOf(req, rc) !== 'SATISFIED') violations++;
    const without = Object.assign({}, req);
    delete without[target];
    if (verdictOf(without, rc) !== 'VIOLATED') violations++;
  }
  return { name: 'removing_required_field_flips_satisfied_to_violated', checked: N * 2, violations };
}

// the order of properties (and of required names) in the constraint never changes the output
function checkPropertyOrderIndependence() {
  const rng = mulberry32(819002);
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const req = randomRequest(rng);
    const keys = Object.keys(req);
    const props = {};
    for (const k of keys) props[k] = { const: rng() < 0.5 ? req[k] : req[k] + 1 };
    const forward = {};
    const reverse = {};
    for (const k of keys) forward[k] = props[k];
    for (const k of keys.slice().reverse()) reverse[k] = props[k];
    const a = compute({ request: req, constraints: [{ request_constraints: { required: keys, properties: forward } }] });
    const b = compute({ request: req, constraints: [{ request_constraints: { required: keys.slice().reverse(), properties: reverse } }] });
    const va = a.output_payload;
    const vb = b.output_payload;
    if (va.verdict !== vb.verdict || va.violations.length !== vb.violations.length) violations++;
    const sort = (o) => o.violations.map((v) => v.code + v.path).sort().join('|');
    if (sort(va) !== sort(vb)) violations++;
  }
  return { name: 'property_order_independence', checked: N * 2, violations };
}

// constraints only narrow: adding a constraint never turns VIOLATED into SATISFIED
function checkOnlyNarrows() {
  const rng = mulberry32(819003);
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const req = randomRequest(rng);
    const keys = Object.keys(req);
    const base = { request_constraints: { properties: { [pick(rng, keys)]: { const: Math.floor(rng() * 5) } } } };
    const extra = { request_constraints: { required: [pick(rng, FIELDS)] } };
    const one = verdictOf(req, [base]);
    const two = verdictOf(req, [base, extra]);
    if (one === 'VIOLATED' && two !== 'VIOLATED') violations++;
  }
  return { name: 'adding_a_constraint_never_widens', checked: N, violations };
}

// a path that selects nothing has no effect, whatever the expression says
function checkZeroSelectionNoEffect() {
  const rng = mulberry32(819004);
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const req = randomRequest(rng);
    const out = compute({ request: req, constraints: [{ request_constraints: { path: "$['missing'][*]", required: [pick(rng, FIELDS)] } }] });
    if (out.output_payload.verdict !== 'SATISFIED' || out.output_payload.violations.length) violations++;
  }
  return { name: 'zero_selection_has_no_effect', checked: N, violations };
}

// determinism and refusal-flag shape
function checkDeterminismAndFlags() {
  const rng = mulberry32(819005);
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const req = randomRequest(rng);
    const pp = { request: req, constraints: [{ request_constraints: { required: [pick(rng, FIELDS)] } }] };
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
    if (compute(pp).compliance_flags.length !== 0) violations++;
  }
  const refused = compute({ request: [], constraints: [{ request_constraints: {} }] });
  if (refused.compliance_flags.length !== 1 || refused.compliance_flags[0] !== 'INPUT_REFUSED' || refused.output_payload.refusal !== 'REQUEST_NOT_OBJECT') violations++;
  return { name: 'determinism_and_refusal_flag_shape', checked: N * 2 + 1, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkRemovingRequiredFlips(),
  checkPropertyOrderIndependence(),
  checkOnlyNarrows(),
  checkZeroSelectionNoEffect(),
  checkDeterminismAndFlags(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
