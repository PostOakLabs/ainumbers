// art-832-card-data-flow-scope — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:6518b84b67ba2cd88669c714464e3add4a9e27014529e83f62c30b74500357db
// spec: board/claimed/PCI-FLOWMAP-SCOPE-1.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-832-card-data-flow-scope.proptest.mjs

import { compute } from '../art-832-card-data-flow-scope.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-832-card-data-flow-scope';
const KINDS = ['frontend', 'backend', 'logs', 'analytics', 'browser_automation_provider', 'psp', 'other'];
const FLAGS = ['sees_raw_pan', 'sees_token_only', 'stores', 'logs', 'records_sessions', 'unrestricted_connectivity_to_pan_component', 'could_impact_pan_security'];

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 6);
  const ids = [];
  for (let i = 0; i < n; i++) ids.push('c' + i);
  const components = ids.map((id) => {
    const c = { id, kind: pick(rng, KINDS) };
    for (const f of FLAGS) if (rng() < 0.3) c[f] = true;
    if (rng() < 0.4) c.captures_from = ids.filter(() => rng() < 0.4);
    return c;
  });
  return { components };
}

const SETS = ['stores_processes_transmits_placed', 'unrestricted_connectivity_placed', 'security_impacting_placed', 'not_placed_by_declared_inputs'];

function checkPartition() {
  const rng = mulberry32(832);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rng);
    const o = compute(pp).output_payload;
    checked++;
    const seen = [];
    for (const s of SETS) for (const id of o[s]) seen.push(id);
    const want = pp.components.map((c) => c.id).sort().join(',');
    if (seen.slice().sort().join(',') !== want) violations++;
  }
  return { name: 'every_component_in_exactly_one_set', checked, violations };
}

function checkLeakImpliesFlag() {
  const rng = mulberry32(831);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const r = compute(randomPP(rng));
    checked++;
    const leaks = r.output_payload.capture_leaks;
    const has = (f) => r.compliance_flags.includes(f);
    const logs = leaks.some((l) => l.channel === 'logs');
    const rec = leaks.some((l) => l.channel === 'session_recording');
    if (logs !== has('CAPTURE_LEAK_LOGS') || rec !== has('CAPTURE_LEAK_SESSION_RECORDING')) violations++;
    if (!deepEqual(r.output_payload.warnings, r.compliance_flags)) violations++;
  }
  return { name: 'capture_leak_iff_flag_and_warnings_mirror', checked, violations };
}

function checkNoLeakWithoutRawPan() {
  const rng = mulberry32(832);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rng);
    for (const c of pp.components) delete c.sees_raw_pan;
    checked++;
    if (compute(pp).output_payload.capture_leaks.length !== 0) violations++;
  }
  return { name: 'no_leak_when_no_component_declares_raw_pan', checked, violations };
}

function checkDeterminism() {
  const rng = mulberry32(833);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const pp = randomPP(rng);
    checked++;
    if (!deepEqual(compute(pp), compute(JSON.parse(JSON.stringify(pp))))) violations++;
  }
  return { name: 'deterministic', checked, violations };
}

function checkRefusals() {
  const bad = [
    {}, { components: [] }, { components: [{ id: '', kind: 'backend' }] },
    { components: [{ id: 'a', kind: 'nope' }] },
    { components: [{ id: 'a', kind: 'backend', stores: 'yes' }] },
    { components: [{ id: 'a', kind: 'backend', captures_from: ['b'] }] },
    { components: [{ id: 'a', kind: 'frontend', see_raw_pan: true }] },
  ];
  let violations = 0;
  for (const pp of bad) if (compute(pp).output_payload.status !== 'refused') violations++;
  return { name: 'invalid_input_refused', checked: bad.length, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [checkPartition(), checkLeakImpliesFlag(), checkNoLeakWithoutRawPan(), checkDeterminism(), checkRefusals()];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
