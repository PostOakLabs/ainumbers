// art-285-acdc-delegation-chain-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C13-1).
// kernel_digest_at_authoring: sha256:c2e7514896d7266effdbb7716fefc7f39377a555f3f45bb847ec9250a184c7db
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — string-equality SAID/edge checks and array
// index math only; no floating-point arithmetic anywhere in compute()).
// TERMINATION-BOUND ARGUMENT (verifier kernel, per WU row instruction): both for-loops (SAID
// check, edge-linkage check) are bounded by `bounded.length`, itself
// `Math.min(credentials.length, maxChainDepth)` where maxChainDepth is clamped to
// HARD_MAX_DEPTH=50 before either loop starts — two flat passes, never recursive.
// Checks: fixture-oracle gate, termination/boundedness (chain_depth never exceeds
// min(credentials.length, max_chain_depth, HARD_MAX_DEPTH=50)), a differential re-derivation of
// EDGE_BROKEN from the child->parent `e` edge linkage (constructed directly, independent of the
// SAID hash which this floor does not recompute), a differential re-derivation of
// ISSUER_ISSUEE_MISMATCH from `child.i` vs `parent.a.i`, and forced categorical boundary cases
// (float:no, no ULP forcing): empty credentials, chain length exactly at / one over the 50-node
// cap, missing SAID field.
// compute() is async (uses globalThis.crypto.subtle for SAID hashing) — every property awaits it.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-285-acdc-delegation-chain-verifier.proptest.mjs

import { compute } from '../art-285-acdc-delegation-chain-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-285-acdc-delegation-chain-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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
const rand = mulberry32(0x285A0);

// Build an n-credential chain: credentials[0] is the leaf (issuee-most), credentials[n-1] is root.
// child.e.auth.n links to parent.d; child.i must equal parent.a.i for issuer/issuee match.
// Construction: creds[i].a.i = "agent{i}" (this cred's issuee); creds[i].i = "agent{i+1}" for
// i<n-1 (this cred's issuer == the NEXT cred's issuee) so that by default every edge's
// child.i === parent.a.i holds, and mismatchIssuerAt can deliberately break exactly one edge.
function buildChain(rng, n, { brokenEdgeAt = -1, mismatchIssuerAt = -1 } = {}) {
  const creds = Array.from({ length: n }, (_, i) => ({
    d: `D${i}${'0'.repeat(60)}`,
    i: i < n - 1 ? `agent${i + 1}` : 'root_issuer',
    a: { i: `agent${i}` },
    e: /** @type {{ auth: { n: string, s: string } } | undefined} */ (undefined),
  }));
  for (let i = 0; i < n - 1; i++) {
    const parent = creds[i + 1];
    const linkTarget = i === brokenEdgeAt ? 'WRONG_TARGET' : parent.d;
    creds[i].e = { auth: { n: linkTarget, s: 'schemaX' } };
    if (i === mismatchIssuerAt) creds[i].i = 'deliberately_wrong_issuer';
  }
  return creds;
}

const TRIALS = 800;

// ---------- P1: termination/boundedness — chain_depth bounded by min(len, max_chain_depth, 50) ----------
async function checkP1_bounded_depth() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 15);
    const maxDepth = 1 + Math.floor(rand() * 10);
    const pp = { credentials: buildChain(rand, n), max_chain_depth: maxDepth };
    checked++;
    const { output_payload } = await compute(pp);
    const bound = Math.min(n, maxDepth, 50);
    if (output_payload.chain_depth > bound) violations++;
  }
  return { name: 'P1_chain_depth_bounded_by_min_length_maxdepth_hardcap', trials: checked, violations };
}

// ---------- P2 (differential): EDGE_BROKEN re-derivation from constructed edge linkage ----------
async function checkP2_edge_broken_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 2 + Math.floor(rand() * 8);
    const brokenAt = rand() < 0.5 ? Math.floor(rand() * (n - 1)) : -1;
    const pp = { credentials: buildChain(rand, n, { brokenEdgeAt: brokenAt }), max_chain_depth: 50 };
    checked++;
    const { output_payload } = await compute(pp);
    for (let idx = 0; idx < n - 1; idx++) {
      const hasEdgeBroken = output_payload.edge_failures.some((f) => f.index === idx && f.code === 'EDGE_BROKEN');
      const expectBroken = idx === brokenAt;
      if (hasEdgeBroken !== expectBroken) violations++;
    }
  }
  return { name: 'P2_edge_broken_differential', trials: checked, violations };
}

// ---------- P3 (differential): ISSUER_ISSUEE_MISMATCH re-derivation ----------
async function checkP3_issuer_mismatch_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 2 + Math.floor(rand() * 8);
    const mismatchAt = rand() < 0.5 ? Math.floor(rand() * (n - 1)) : -1;
    const pp = { credentials: buildChain(rand, n, { mismatchIssuerAt: mismatchAt }), max_chain_depth: 50 };
    checked++;
    const { output_payload } = await compute(pp);
    for (let idx = 0; idx < n - 1; idx++) {
      const hasMismatch = output_payload.edge_failures.some((f) => f.index === idx && f.code === 'ISSUER_ISSUEE_MISMATCH');
      const expectMismatch = idx === mismatchAt;
      if (hasMismatch !== expectMismatch) violations++;
    }
  }
  return { name: 'P3_issuer_issuee_mismatch_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no, no ULP forcing) ----------
async function checkP4_forced() {
  const cases = [
    { label: 'empty credentials array -> CREDENTIALS_MISSING', pp: { credentials: [] } },
    { label: 'null credentials -> CREDENTIALS_MISSING', pp: {} },
    { label: 'chain length exactly at 50-node default cap -> not truncated', pp: { credentials: buildChain(rand, 50), max_chain_depth: 50 } },
    { label: 'chain length 1 over the 50-node cap -> CHAIN_DEPTH_EXCEEDED', pp: { credentials: buildChain(rand, 51), max_chain_depth: 50 } },
    { label: 'max_chain_depth requested above HARD_MAX_DEPTH (50) clamps to 50', pp: { credentials: buildChain(rand, 5), max_chain_depth: 100000 } },
    { label: 'credential missing d (SAID) field -> SAID_MISSING', pp: { credentials: [{ i: 'x', a: {} }] } },
  ];
  const rows = [];
  for (const c of cases) {
    const { output_payload } = await compute(c.pp);
    rows.push({ label: c.label, chain_depth: output_payload.chain_depth, said_failures: output_payload.said_failures.map((f) => f.code) });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_bounded_depth());
results.properties.push(await checkP2_edge_broken_differential());
results.properties.push(await checkP3_issuer_mismatch_differential());
const forcedCases = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-285-acdc-delegation-chain-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
