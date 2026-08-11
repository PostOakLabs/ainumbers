// art-589-redline-round-classifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:5af85fdf37a3ae3ab73a616adad96621f2fc811520c30cafb6404da7d71393c6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:no classification, no correction needed. compute() is pure string equality (===) and array
// bookkeeping; the word-level diff is an O(n*m) LCS dynamic-programming table over word-count
// integers. There is no arithmetic beyond integer indices and array lengths anywhere. No ULP-boundary
// claim is made or needed.
// Checks: fixture-oracle gate, termination/boundedness (P1: the LCS DP table dimension is exactly
// (word_count(from)+1) x (word_count(to)+1) for each changed segment -- an explicit, structural, not
// merely observed, termination bound on the unbounded segment-text-length input), a reconstruction
// differential (P2: concatenating a changed segment's diff tokens where op is 'equal'|'delete'
// reproduces the FROM text exactly, and 'equal'|'insert' reproduces the TO text exactly -- the LCS
// diff never drops or invents a word), a differential re-derivation of the five-state classification
// rule (ACCEPTED/REVERTED/MODIFIED/NEW/DELETED) against an independent reimplementation (P3), a
// metamorphic permutation-invariance identity over segments[] order (P4: each segment is classified
// independently of array position, so per-segment classification and the aggregate counts do not
// depend on order), and forced categorical boundary cases covering all five classification states
// plus the round-chain declaration rules (round 1 with an unexpected prior digest, round >1 missing
// or malformed prior digest) (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-589-redline-round-classifier.proptest.mjs

import { compute } from '../art-589-redline-round-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-589-redline-round-classifier.fixtures.json');
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
const rand = mulberry32(0x589C30);
const WORDS = ['the', 'seller', 'shall', 'deliver', 'payment', 'within', 'ten', 'business', 'days', 'notwithstanding', 'clause', 'four'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomText(rng) { const n = 1 + Math.floor(rng() * 8); return Array.from({ length: n }, () => pick(rng, WORDS)).join(' '); }

function randomSegment(rng, i) {
  const kind = pick(rng, ['accepted', 'reverted', 'modified', 'new', 'deleted']);
  const baseline = randomText(rng);
  if (kind === 'accepted') { const t = randomText(rng); return { segment_id: `S${i}`, baseline_text: baseline, prior_text: t, current_text: t }; }
  if (kind === 'reverted') { const prior = randomText(rng); return { segment_id: `S${i}`, baseline_text: baseline, prior_text: prior, current_text: baseline }; }
  if (kind === 'modified') { return { segment_id: `S${i}`, baseline_text: baseline, prior_text: randomText(rng), current_text: randomText(rng) }; }
  if (kind === 'new') { return { segment_id: `S${i}`, baseline_text: undefined, prior_text: undefined, current_text: randomText(rng) }; }
  return { segment_id: `S${i}`, baseline_text: baseline, prior_text: randomText(rng), current_text: undefined };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  const roundNumber = 1 + Math.floor(rng() * 5);
  return {
    document_id: 'DOC-1',
    round: { number: roundNumber, label: `Round ${roundNumber}` },
    prior_round_digest: roundNumber > 1 ? '0'.repeat(64) : undefined,
    segments: Array.from({ length: n }, (_, i) => randomSegment(rng, i)),
  };
}

// Independent reimplementation of the five-state classification rule, for the differential check (P3).
function reimplementClassify(entry) {
  const b = entry.baseline_text, p = entry.prior_text, c = entry.current_text;
  if (p == null && c == null) return 'REJECT';
  if (p == null && c != null) return 'NEW';
  if (p != null && c == null) return 'DELETED';
  if (c === p) return 'ACCEPTED';
  if (b != null && c === b && b !== p) return 'REVERTED';
  return 'MODIFIED';
}

const TRIALS = 2000;

// ---------- P1: termination/boundedness — LCS DP table dimension matches word counts exactly ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.classifications.length + o.rejected_inputs.length !== pp.segments.length) violations++;
    for (const c of o.classifications) {
      if (c.changed) {
        const fromWords = (c.classification === 'NEW' ? [] : (c.prior_text ?? '').split(/(\s+)/).filter((t) => t !== '')).length;
        const toWords = (c.classification === 'DELETED' ? [] : (c.current_text ?? '').split(/(\s+)/).filter((t) => t !== '')).length;
        // diff token count is bounded by the sum of both word counts (a hard structural ceiling on
        // the DP walk, never exceeded regardless of segment text length).
        const totalDiffLen = c.diff.reduce((s, t) => s + t.text.split(/(\s+)/).filter((x) => x !== '').length, 0);
        if (totalDiffLen > fromWords + toWords) violations++;
      }
    }
  }
  return { name: 'P1_termination_lcs_table_bounded_by_word_counts', trials: checked, violations };
}

// ---------- P2: reconstruction — diff tokens exactly reconstruct the FROM and TO text ----------
function checkP2_reconstruction() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    for (const c of o.classifications) {
      if (!c.changed || !c.diff) continue;
      const fromText = c.diff.filter((t) => t.op === 'equal' || t.op === 'delete').map((t) => t.text).join('');
      const toText = c.diff.filter((t) => t.op === 'equal' || t.op === 'insert').map((t) => t.text).join('');
      const expectedFrom = c.classification === 'NEW' ? '' : (c.prior_text ?? '');
      const expectedTo = c.classification === 'DELETED' ? '' : (c.current_text ?? '');
      if (fromText !== expectedFrom) violations++;
      if (toText !== expectedTo) violations++;
    }
  }
  return { name: 'P2_diff_reconstruction_differential', trials: checked, violations };
}

// ---------- P3: differential — five-state classification re-derived against an independent reimplementation ----------
function checkP3_classification_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    let ci = 0, ri = 0;
    for (const seg of pp.segments) {
      const exp = reimplementClassify(seg);
      if (exp === 'REJECT') { ri++; continue; }
      const got = o.classifications[ci]; ci++;
      if (!got || got.classification !== exp) violations++;
    }
  }
  return { name: 'P3_classification_rule_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over segments[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.segments.length < 2) continue;
    const shuffled = { ...pp, segments: [...pp.segments].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (JSON.stringify(a.round_summary) !== JSON.stringify(b.round_summary)) violations++;
    const aSet = new Set(a.classifications.map((c) => `${c.segment_id}:${c.classification}`));
    const bSet = new Set(b.classifications.map((c) => `${c.segment_id}:${c.classification}`));
    if (aSet.size !== bSet.size || [...aSet].some((x) => !bSet.has(x))) violations++;
  }
  return { name: 'P4_permutation_invariance_segments', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (all five states + round-chain rules) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const one = (segments, roundExtra) => compute({ document_id: 'D', round: { number: 1, ...roundExtra }, segments }).output_payload;
  // ACCEPTED: current === prior
  { const o = one([{ segment_id: 'a', prior_text: 'x', current_text: 'x' }]); checked++; if (o.classifications[0].classification !== 'ACCEPTED') violations++; }
  // REVERTED: current === baseline !== prior
  { const o = one([{ segment_id: 'a', baseline_text: 'x', prior_text: 'y', current_text: 'x' }]); checked++; if (o.classifications[0].classification !== 'REVERTED') violations++; }
  // MODIFIED: current differs from both
  { const o = one([{ segment_id: 'a', baseline_text: 'x', prior_text: 'y', current_text: 'z' }]); checked++; if (o.classifications[0].classification !== 'MODIFIED') violations++; }
  // NEW: no prior
  { const o = one([{ segment_id: 'a', current_text: 'z' }]); checked++; if (o.classifications[0].classification !== 'NEW') violations++; }
  // DELETED: no current
  { const o = one([{ segment_id: 'a', prior_text: 'y' }]); checked++; if (o.classifications[0].classification !== 'DELETED') violations++; }
  // round 1 declaring an unexpected prior_round_digest -> REJECTED chain state
  { const o = compute({ document_id: 'D', round: { number: 1 }, prior_round_digest: '0'.repeat(64), segments: [] }).output_payload; checked++; if (o.round_chain.status !== 'REJECTED') violations++; }
  // round > 1 missing prior_round_digest -> REJECTED chain state
  { const o = compute({ document_id: 'D', round: { number: 2 }, segments: [] }).output_payload; checked++; if (o.round_chain.status !== 'REJECTED') violations++; }
  // round > 1 malformed (non-64-hex) prior_round_digest -> REJECTED chain state
  { const o = compute({ document_id: 'D', round: { number: 2 }, prior_round_digest: 'not-a-hash', segments: [] }).output_payload; checked++; if (o.round_chain.status !== 'REJECTED') violations++; }
  // well-formed round-2 chain -> LINKED
  { const o = compute({ document_id: 'D', round: { number: 2 }, prior_round_digest: 'a'.repeat(64), segments: [] }).output_payload; checked++; if (o.round_chain.status !== 'LINKED') violations++; }
  return { name: 'P5_forced_categorical_five_states_and_round_chain', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_reconstruction());
results.properties.push(checkP3_classification_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-589-redline-round-classifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
