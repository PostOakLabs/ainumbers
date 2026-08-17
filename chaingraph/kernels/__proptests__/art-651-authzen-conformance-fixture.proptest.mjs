// art-651-authzen-conformance-fixture — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:a5c7470c83caad488c64b75342a1e532d18fc9c76126d3c5cb0614deb36bc15d
// spec: AUTHZEN-CONFORMANCE-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-651-authzen-conformance-fixture.proptest.mjs

import { compute } from '../art-651-authzen-conformance-fixture.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-651-authzen-conformance-fixture';
const N = 500;

function req(subjectId, role, action, actionProps, owner, status) {
  return {
    name: `${subjectId}-${action}-${owner}-${status}`,
    subject: role ? { type: 'user', id: subjectId, properties: { role } } : { type: 'user', id: subjectId },
    action: actionProps ? { name: action, properties: actionProps } : { name: action },
    resource: { type: 'record', id: 'record-x', properties: { owner, status } },
  };
}

// Property 1 — determinism: compute() is a pure function of pp; same input, same output,
// checked across N independently-generated request sets.
function checkDeterminism() {
  const rng = mulberry32(4242);
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const subjectId = pick(rng, ['alice', 'bob', 'carol']);
    const role = pick(rng, [undefined, 'admin']);
    const action = pick(rng, ['read', 'write', 'delete']);
    const soft = pick(rng, [true, false]);
    const owner = pick(rng, ['alice', 'bob', 'carol']);
    const status = pick(rng, ['active', 'archived']);
    const requests = [req(subjectId, role, action, action === 'delete' ? { soft } : undefined, owner, status)];
    const a = compute({ requests });
    const b = compute({ requests });
    checked++;
    if (!deepEqual(a.output_payload, b.output_payload)) violations++;
  }
  return { name: 'determinism_same_input_same_output', checked, violations };
}

// Property 2 — read is unconditional: per FIXTURE_POLICY, "read" is always granted
// regardless of subject/owner/role/status. Checked across randomized non-read-adjacent state.
function checkReadAlwaysTrue() {
  const rng = mulberry32(777);
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const subjectId = pick(rng, ['alice', 'bob', 'carol', 'mallory']);
    const role = pick(rng, [undefined, 'admin', 'guest']);
    const owner = pick(rng, ['alice', 'bob', 'carol', 'mallory']);
    const status = pick(rng, ['active', 'archived']);
    const { output_payload } = compute({ requests: [req(subjectId, role, 'read', undefined, owner, status)] });
    checked++;
    if (output_payload.decisions[0].decision !== true) violations++;
  }
  return { name: 'read_always_permitted', checked, violations };
}

// Property 3 — decision shape: `decision` is always strictly boolean, never undefined/null/
// truthy-non-boolean, across randomized action/role/owner/status combinations.
function checkDecisionIsBoolean() {
  const rng = mulberry32(99);
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const subjectId = pick(rng, ['alice', 'bob', 'carol']);
    const role = pick(rng, [undefined, 'admin']);
    const action = pick(rng, ['read', 'write', 'delete']);
    const soft = pick(rng, [true, false]);
    const owner = pick(rng, ['alice', 'bob', 'carol']);
    const status = pick(rng, ['active', 'archived']);
    const { output_payload } = compute({ requests: [req(subjectId, role, action, action === 'delete' ? { soft } : undefined, owner, status)] });
    checked++;
    if (typeof output_payload.decisions[0].decision !== 'boolean') violations++;
  }
  return { name: 'decision_is_strictly_boolean', checked, violations };
}

// Property 4 — context invariant (context is OPTIONAL per the spec): the kernel's own
// context_invariant field must report true for every decision, on every randomized request.
function checkContextInvariantAlwaysHolds() {
  const rng = mulberry32(31415);
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const subjectId = pick(rng, ['alice', 'bob', 'carol']);
    const role = pick(rng, [undefined, 'admin']);
    const action = pick(rng, ['read', 'write', 'delete']);
    const soft = pick(rng, [true, false]);
    const owner = pick(rng, ['alice', 'bob', 'carol']);
    const status = pick(rng, ['active', 'archived']);
    const { output_payload } = compute({ requests: [req(subjectId, role, action, action === 'delete' ? { soft } : undefined, owner, status)] });
    checked++;
    if (output_payload.decisions[0].context_invariant !== true) violations++;
  }
  return { name: 'context_optional_invariant_always_holds', checked, violations };
}

// Property 5 — owner soft-delete is unconditional: an owner requesting a soft delete on
// their own resource is always granted, regardless of resource status (archived or not) —
// FIXTURE_POLICY's delete rule never consults `status`.
function checkOwnerSoftDeleteAlwaysTrue() {
  const rng = mulberry32(2718);
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const subjectId = pick(rng, ['alice', 'bob', 'carol']);
    const status = pick(rng, ['active', 'archived']);
    const { output_payload } = compute({ requests: [req(subjectId, undefined, 'delete', { soft: true }, subjectId, status)] });
    checked++;
    if (output_payload.decisions[0].decision !== true) violations++;
  }
  return { name: 'owner_soft_delete_always_permitted', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkReadAlwaysTrue(),
  checkDecisionIsBoolean(),
  checkContextInvariantAlwaysHolds(),
  checkOwnerSoftDeleteAlwaysTrue(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
