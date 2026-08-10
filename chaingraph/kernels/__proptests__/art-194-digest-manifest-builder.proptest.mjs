// art-194-digest-manifest-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:f7773f9cb20b6ccffd83c7dc8eadff91a541c6046f38620c66139db89449959b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's initial table (which listed float:yes for this
// kernel). Direct source read confirms `total_bytes` is a plain `reduce((s,e)=>s+e.bytes,0)` sum of
// caller-supplied byte counts with no threshold comparison, and every other decision (sort,
// dedupe, hex validation) is string/hex-digest comparison — no float comparison anywhere. Note:
// summing many integer byte counts in IEEE-754 float64 is exact for all realistic file sizes
// (exact below 2^53), so even the sum itself carries no meaningful ULP risk. Categorical (not ULP)
// boundary forcing is used instead.
// Checks: fixture-oracle gate, termination (entry-processing loop bounded by entries.length),
// boundedness (entry_count === entries.length always), a permutation-invariance metamorphic
// property (the final SORTED entries array — and therefore manifest_sha256 — is independent of the
// caller's input order, for either sort mode), differential re-derivation of duplicate-name /
// duplicate-digest detection, and forced categorical boundary cases (zero entries, malformed hex,
// path-like names, digest-sort vs name-sort tiebreak).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-194-digest-manifest-builder.proptest.mjs

import { compute } from '../art-194-digest-manifest-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-194-digest-manifest-builder.fixtures.json');
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
const rand = mulberry32(0x194A0);
function randHex64(rng) { let s = ''; for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16); return s; }

function randomEntries(rng, n) {
  const entries = [];
  for (let i = 0; i < n; i++) {
    entries.push({ name: 'file_' + i + '.bin', sha256: randHex64(rng), bytes: Math.floor(rng() * 100000) });
  }
  return entries;
}
function shuffle(rng, arr) {
  const out = [...arr];
  for (let j = out.length - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    [out[j], out[k]] = [out[k], out[j]];
  }
  return out;
}

const TRIALS = 5000;

// ---------- P1: termination — entry_count === entries.length, always ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const entries = randomEntries(rand, n);
    const { output_payload } = compute({ entries });
    checked++;
    if (output_payload.manifest.entry_count !== n) violations++;
    if (output_payload.manifest.entries.length !== n) violations++;
  }
  return { name: 'P1_termination_entry_count_matches', trials: checked, violations };
}

// ---------- P2 (differential): duplicate-name/duplicate-digest detection re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 8);
    let entries = randomEntries(rand, n);
    if (rand() < 0.3 && entries.length > 1) entries[1] = { ...entries[1], name: entries[0].name }; // force a dup name
    if (rand() < 0.3 && entries.length > 1) entries[1] = { ...entries[1], sha256: entries[0].sha256 }; // force a dup digest
    const { output_payload } = compute({ entries });
    checked++;
    const names = output_payload.manifest.entries.map((e) => e.name);
    const hasDupName = new Set(names).size !== names.length;
    const noDupCheck = output_payload.checks.find((c) => c.check === 'no_duplicate_names');
    if (noDupCheck.pass !== !hasDupName) violations++;
    const digests = output_payload.manifest.entries.map((e) => e.sha256);
    const hasDupDigest = new Set(digests).size !== digests.length;
    const noDupDigestCheck = output_payload.checks.find((c) => c.check === 'no_duplicate_digests');
    if (noDupDigestCheck.pass !== !hasDupDigest) violations++;
  }
  return { name: 'P2_duplicate_detection_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of the sorted output (and its digest) under input reordering ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const entries = randomEntries(rand, n);
    const shuffled = shuffle(rand, entries);
    const sort = rand() < 0.5 ? 'name' : 'digest';
    const r1 = compute({ entries, sort }).output_payload;
    const r2 = compute({ entries: shuffled, sort }).output_payload;
    checked++;
    if (JSON.stringify(r1.manifest.entries) !== JSON.stringify(r2.manifest.entries)) violations++;
    if (r1.manifest.manifest_sha256 !== r2.manifest.manifest_sha256) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
function checkP4_forced() {
  const cases = [
    { label: 'zero entries -> entry_count 0, total_bytes null (no entries to sum)', pp: { entries: [] } },
    { label: 'malformed hex digest (63 chars) -> flagged malformed', pp: { entries: [{ name: 'a.txt', sha256: 'a'.repeat(63), bytes: 10 }] } },
    { label: 'path-like name -> basenamed and flagged', pp: { entries: [{ name: 'dir/sub/file.txt', sha256: 'a'.repeat(64), bytes: 10 }] } },
    { label: 'digest-sort with tie-break on name', pp: { entries: [{ name: 'zebra.txt', sha256: 'a'.repeat(64), bytes: 1 }, { name: 'apple.txt', sha256: 'a'.repeat(64), bytes: 2 }], sort: 'digest' } },
  ];
  return cases.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, entry_count: output_payload.manifest.entry_count, total_bytes: output_payload.manifest.total_bytes, entries: output_payload.manifest.entries, checks: output_payload.checks };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const [zeroEntries, malformedHex, pathLike, digestSortTie] = results.boundary_forced;
const zeroEntriesOk = zeroEntries.entry_count === 0 && zeroEntries.total_bytes === null;
const malformedFlagged = malformedHex.checks.find((c) => c.check === 'all_digests_64_hex').pass === false;
const pathLikeFlagged = pathLike.checks.find((c) => c.check === 'no_path_like_names').pass === false && pathLike.entries[0].name === 'file.txt';
const tieBreakByName = digestSortTie.entries[0].name === 'apple.txt';
const anyBoundaryMismatch = !(zeroEntriesOk && malformedFlagged && pathLikeFlagged && tieBreakByName);

console.log(JSON.stringify({
  tool_id: 'art-194-digest-manifest-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
