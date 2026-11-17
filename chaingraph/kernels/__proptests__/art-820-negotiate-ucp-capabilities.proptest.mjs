// art-820-negotiate-ucp-capabilities — class-K property-test FLOOR. Authored for row
// UCP-NEGOTIATE-1 per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:f09fdc7369978626a800a5464785c62999cad6868894f8be97db94225f52dc7a
// spec: UCP Overview (serves release 2026-08-25), Intersection Algorithm + requires
// bounds + namespace authority binding — pinned digests in the node shard's
// cited_clause_digest[]; build row board/claimed/UCP-NEGOTIATE-1.md.
// human_sign_off: PENDING
//
// Properties (class-K floor: deterministic inputs, the row's two mandated properties
// plus shape and determinism):
//   1. order independence — permuting profile object key order and capability entry
//      array order never changes output_payload (the kernel walks sorted keys).
//   2. survival symmetry — swapping business_profile and platform_profile leaves the
//      verdict and the agreed capability set identical: negotiation is symmetric in
//      which capabilities survive.
//   3. output shape — no undefined / NaN anywhere in output_payload across every
//      fixture vector, every reachability vector, and compute({}).
//   4. determinism — every input computes byte-identically twice.
//   5. reachability pin — every reachability vector (kernel_generated, one per
//      refusal / finding / requires / extends branch) recomputes its recorded
//      output_payload and compliance_flags exactly (mutation-tier floor coverage).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-820-negotiate-ucp-capabilities.proptest.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compute } from '../art-820-negotiate-ucp-capabilities.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, deepEqual, FIXTURES_DIR } from './_pbt-common.mjs';

const KERNEL_ID = 'art-820-negotiate-ucp-capabilities';

const fixtures = JSON.parse(readFileSync(join(FIXTURES_DIR, `${KERNEL_ID}.fixtures.json`), 'utf8'));
let reachability = { vectors: [] };
try {
  reachability = JSON.parse(readFileSync(join(FIXTURES_DIR, `${KERNEL_ID}.reachability.json`), 'utf8'));
} catch { /* shape property covers fixtures + compute({}) when the file is absent */ }

function reverseKeys(o) {
  const out = {};
  for (const k of Object.keys(o).reverse()) out[k] = o[k];
  return out;
}

// Deep clone, then reverse every key order the pasted profiles carry: profile
// top level, ucp, capabilities names, supported_versions keys, and each
// capability's entry array order. A pure structural permutation — same data.
function shuffledPP(pp) {
  const clone = JSON.parse(JSON.stringify(pp));
  for (const side of ['business_profile', 'platform_profile']) {
    const profile = clone[side];
    if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) continue;
    clone[side] = reverseKeys(profile);
    const ucp = clone[side].ucp;
    if (ucp === null || typeof ucp !== 'object' || Array.isArray(ucp)) continue;
    clone[side].ucp = reverseKeys(ucp);
    const caps = clone[side].ucp.capabilities;
    if (caps !== null && typeof caps === 'object' && !Array.isArray(caps)) {
      const reversedCaps = reverseKeys(caps);
      for (const name of Object.keys(reversedCaps)) {
        if (Array.isArray(reversedCaps[name])) reversedCaps[name] = reversedCaps[name].slice().reverse();
      }
      clone[side].ucp.capabilities = reversedCaps;
    }
    const sv = clone[side].ucp.supported_versions;
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv)) {
      clone[side].ucp.supported_versions = reverseKeys(sv);
    }
  }
  return clone;
}

// 1. order independence
function checkOrderIndependence() {
  let checked = 0;
  const violations = [];
  for (const vec of fixtures.vectors) {
    checked++;
    const a = compute(vec.policy_parameters).output_payload;
    const b = compute(shuffledPP(vec.policy_parameters)).output_payload;
    if (!deepEqual(a, b)) violations.push(`${vec.name}: output_payload changed under key/array permutation`);
  }
  return { name: 'order_independence_permuted_profiles', checked, violations: violations.length };
}

// 2. survival symmetry
function checkSurvivalSymmetry() {
  let checked = 0;
  const violations = [];
  for (const vec of fixtures.vectors) {
    checked++;
    const pp = vec.policy_parameters;
    const a = compute(pp).output_payload;
    const b = compute({ business_profile: pp.platform_profile, platform_profile: pp.business_profile }).output_payload;
    if (a.verdict !== b.verdict) violations.push(`${vec.name}: verdict ${a.verdict} vs swapped ${b.verdict}`);
    if (!deepEqual(a.agreed_capabilities, b.agreed_capabilities)) {
      violations.push(`${vec.name}: agreed set differs under swap (survivors must be symmetric)`);
    }
  }
  return { name: 'survival_symmetry_swapped_sides', checked, violations: violations.length };
}

// 3. output shape
function checkOutputShape() {
  const probes = [{ name: 'compute({})', out: compute({}).output_payload }];
  for (const vec of fixtures.vectors) {
    probes.push({ name: vec.name, out: compute(vec.policy_parameters).output_payload });
  }
  for (const vec of reachability.vectors) {
    probes.push({ name: `reachability:${vec.name}`, out: compute(vec.policy_parameters).output_payload });
  }
  const violations = [];
  for (const p of probes) {
    for (const v of findShapeViolations(p.out)) violations.push(`${p.name}: ${v}`);
  }
  return { name: 'output_shape_no_undefined_or_nan', checked: probes.length, violations: violations.length };
}

// 4. determinism
function checkDeterminism() {
  let checked = 0;
  const violations = [];
  const inputs = [{ name: 'compute({})', pp: {} }]
    .concat(fixtures.vectors.map((v) => ({ name: v.name, pp: v.policy_parameters })));
  for (const input of inputs) {
    checked++;
    const a = compute(input.pp);
    const b = compute(input.pp);
    if (!deepEqual(a.output_payload, b.output_payload) || !deepEqual(a.compliance_flags, b.compliance_flags)) {
      violations.push(`${input.name}: two runs differ`);
    }
  }
  return { name: 'determinism_repeat_runs_identical', checked, violations: violations.length };
}

// 5. reachability pin
function checkReachabilityPinned() {
  let checked = 0;
  const violations = [];
  for (const vec of reachability.vectors) {
    if (vec.output_payload === undefined) continue;
    checked++;
    const r = compute(JSON.parse(JSON.stringify(vec.policy_parameters)));
    if (!deepEqual(r.output_payload, vec.output_payload)) violations.push(`${vec.name}: output_payload differs from the recorded vector`);
    if (vec.compliance_flags !== undefined && !deepEqual(r.compliance_flags, vec.compliance_flags)) {
      violations.push(`${vec.name}: compliance_flags differ from the recorded vector`);
    }
  }
  return { name: 'reachability_vectors_recompute_exactly', checked, violations: violations.length };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkOrderIndependence(),
  checkSurvivalSymmetry(),
  checkOutputShape(),
  checkDeterminism(),
  checkReachabilityPinned(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — UCP capability negotiation.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
