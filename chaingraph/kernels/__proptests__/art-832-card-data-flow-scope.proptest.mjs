// art-832-card-data-flow-scope — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:6518b84b67ba2cd88669c714464e3add4a9e27014529e83f62c30b74500357db
// spec: board/claimed/PCI-FLOWMAP-SCOPE-1.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-832-card-data-flow-scope.proptest.mjs

import { compute, buildArtifact } from '../art-832-card-data-flow-scope.kernel.mjs';
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

// buildArtifact_never_throws (D6): a preimage the shared canonicalizer would reject mints an
// artifact with a null execution_hash and a hash_refusal beside it; a clean input gets a hash.
async function checkBuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const base = () => ({ components: [{ id: 'a', kind: 'frontend', sees_raw_pan: true }] });
  const hostile = [
    { zzz: 1e300 }, { zzz: NaN }, { zzz: -Infinity }, { zzz: Infinity }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } },
    { zzz: deep }, { zzz: wide },
  ];
  for (const delta of hostile) {
    checked++;
    try {
      const art = await buildArtifact({ ...base(), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log(`unhashable violation: ${Object.keys(delta)[0]} artifact shape`); }
      if (/e\+3\d\d|Infinity|9007199254740992/.test(JSON.stringify(r))) { violations++; console.log('unhashable violation: hostile value echoed'); }
    } catch (e) { violations++; console.log(`unhashable violation: buildArtifact threw: ${String(e.message).slice(0, 80)}`); }
  }
  const nullProto = Object.create(null);
  for (const pp of [base(), {}, null, 5, [], { components: [{ id: 'a', kind: 'backend', captures_from: [nullProto] }] }]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('unhashable violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log(`unhashable violation: buildArtifact threw on clean input: ${String(e.message).slice(0, 80)}`); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [checkPartition(), checkLeakImpliesFlag(), checkNoLeakWithoutRawPan(), checkDeterminism(), checkRefusals(), await checkBuildArtifactNeverThrows()];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
