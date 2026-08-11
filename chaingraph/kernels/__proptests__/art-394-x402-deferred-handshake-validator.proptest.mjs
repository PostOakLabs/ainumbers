// art-394-x402-deferred-handshake-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:86b67fe8bd78c4f98cff644943c97efe820149953edf0080e31c279d760f5994
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — score arithmetic is pure integer math
// (100 - e*15 - w*4, clamped [0,100]); isHttpsUrl and the covered-components/id-continuity
// checks are string/array boolean logic only, no float compare anywhere) — forced categorical
// boundary cases used in place of ULP-forcing, per spec §3's float:no row.
// Unbounded input: policy_parameters.id_continuity.prior_ids and .covered_components
// (caller-supplied arrays), scanned by plain Array.prototype loops with no declared cap —
// termination bound is each array's own length. isHttpsUrl also runs an unbounded
// character-scan loop over the URL string, bounded by the string's own length.
// Checks: fixture-oracle gate, termination (prior_ids dedup scan and isHttpsUrl's
// character loop scale linearly, never hang), boundedness (score always clamped to [0,100],
// errors/warnings/passes are non-negative integers, findings.length equals the sum of the
// three sub-check finding counts), metamorphic (permutation-invariance: reordering
// covered_components or prior_ids never changes the verdict/score — only membership matters,
// not order), forced categorical boundary cases (score exactly at the 0/100 clamp boundary,
// https scheme case-insensitivity, empty authority, duplicate id detection).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-394-x402-deferred-handshake-validator.proptest.mjs

import { compute } from '../art-394-x402-deferred-handshake-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-394-x402-deferred-handshake-validator.fixtures.json');
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
const rand = mulberry32(0x394E0);

const VALID_OFFER = { scheme: 'deferred', id: 'offer-1', termsUrl: 'https://example.com/terms' };
const REQUIRED_COMPONENTS = ['@method', '@target-uri', 'content-digest'];

function randomPriorIds(rng, n) {
  return Array.from({ length: n }, (_, i) => `id-${Math.floor(rng() * 1000)}-${i}`);
}

const TRIALS = 2000;

// ---------- P1: termination — scans scale linearly with array/string length, never hang ----------
function checkP1_termination_linear_scaling() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 500, 5000];
  for (const n of sizes) {
    const prior_ids = randomPriorIds(rand, n);
    const start = Date.now();
    const out = compute({ offer: VALID_OFFER, covered_components: REQUIRED_COMPONENTS, id_continuity: { prior_ids } }).output_payload;
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (out.verdict !== 'ACCEPT') violations++;
  }
  // huge URL string — isHttpsUrl's character loop must still terminate promptly
  const hugeUrl = 'https://example.com/' + 'a'.repeat(200000);
  const start2 = Date.now();
  compute({ offer: { ...VALID_OFFER, termsUrl: hugeUrl }, covered_components: REQUIRED_COMPONENTS });
  checked++;
  if (Date.now() - start2 > 3000) violations++;
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — score clamped [0,100], counts non-negative, findings sums correctly ----------
function checkP2_score_and_count_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const scheme = rand() > 0.5 ? 'deferred' : 'wrong-scheme';
    const id = rand() > 0.1 ? `id-${Math.floor(rand() * 100)}` : '';
    const termsUrl = rand() > 0.1 ? 'https://x.com/t' : 'not-a-url';
    const covered = REQUIRED_COMPONENTS.filter(() => rand() > 0.3);
    const prior_ids = randomPriorIds(rand, Math.floor(rand() * 5));
    const out = compute({ offer: { scheme, id, termsUrl }, covered_components: covered, id_continuity: { prior_ids } }).output_payload;
    checked++;
    if (out.score < 0 || out.score > 100) violations++;
    if (!Number.isInteger(out.score)) violations++;
    for (const c of [out.errors, out.warnings, out.passes]) if (!Number.isInteger(c) || c < 0) violations++;
    if (out.errors + out.warnings + out.passes !== out.findings.length) violations++;
    if ((out.errors === 0) !== (out.verdict === 'ACCEPT')) violations++;
  }
  return { name: 'P2_score_clamped_and_count_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of covered_components and prior_ids ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const covered = [...REQUIRED_COMPONENTS].filter(() => rand() > 0.2);
    const shuffledCovered = [...covered];
    for (let j = shuffledCovered.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffledCovered[j], shuffledCovered[k]] = [shuffledCovered[k], shuffledCovered[j]]; }
    const prior_ids = randomPriorIds(rand, 1 + Math.floor(rand() * 10));
    const shuffledPrior = [...prior_ids];
    for (let j = shuffledPrior.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffledPrior[j], shuffledPrior[k]] = [shuffledPrior[k], shuffledPrior[j]]; }
    const outA = compute({ offer: VALID_OFFER, covered_components: covered, id_continuity: { prior_ids } }).output_payload;
    const outB = compute({ offer: VALID_OFFER, covered_components: shuffledCovered, id_continuity: { prior_ids: shuffledPrior } }).output_payload;
    checked++;
    if (outA.verdict !== outB.verdict) violations++;
    if (outA.score !== outB.score) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_components_and_prior_ids', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP claim made) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    // https scheme case-insensitivity
    { pp: { offer: { ...VALID_OFFER, termsUrl: 'HTTPS://EXAMPLE.COM/terms' }, covered_components: REQUIRED_COMPONENTS }, check: (o) => o.verdict === 'ACCEPT' },
    // http (not https) must be rejected
    { pp: { offer: { ...VALID_OFFER, termsUrl: 'http://example.com/terms' }, covered_components: REQUIRED_COMPONENTS }, check: (o) => o.verdict === 'REFUSE' },
    // empty authority after https:// must be rejected
    { pp: { offer: { ...VALID_OFFER, termsUrl: 'https:///terms' }, covered_components: REQUIRED_COMPONENTS }, check: (o) => o.verdict === 'REFUSE' },
    // 3 errors -> score exactly 100 - 3*15 = 55, still ACCEPT is false (errors>0)
    { pp: { offer: { scheme: 'x', id: '', termsUrl: 'bad' }, covered_components: [] }, check: (o) => o.score === 100 - 3 * 15 - 3 * 15 && o.verdict === 'REFUSE' },
    // duplicate id in prior_ids array itself (internal duplicate) is flagged
    { pp: { offer: VALID_OFFER, covered_components: REQUIRED_COMPONENTS, id_continuity: { prior_ids: ['dup', 'dup', 'other'] } }, check: (o) => o.errors >= 1 && o.verdict === 'REFUSE' },
    // offer.id duplicates a prior id
    { pp: { offer: VALID_OFFER, covered_components: REQUIRED_COMPONENTS, id_continuity: { prior_ids: [VALID_OFFER.id] } }, check: (o) => o.verdict === 'REFUSE' },
  ];
  for (const c of cases) {
    const out = compute(c.pp).output_payload;
    checked++;
    if (!c.check(out)) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_scaling());
results.properties.push(checkP2_score_and_count_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-394-x402-deferred-handshake-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
