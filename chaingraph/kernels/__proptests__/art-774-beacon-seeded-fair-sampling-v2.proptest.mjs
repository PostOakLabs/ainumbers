// art-774-beacon-seeded-fair-sampling-v2 — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:c757f4569a003583873d412190beb7d376192a7fb58615e8ce21dfd8314e54cc
// spec: research/browser-first-primitives-revised-plan-2026-10-16.md item 0b + research/no-reprove-shared-bundle-design-2026-10-17.md section 3 (SAMPLER-583-V2-1)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny.
// float_sensitive: NO — the entire derivation is HMAC-SHA256 over Uint8Array byte
// arithmetic plus exact integer arithmetic. The threshold reduction stays inside
// 2^52 (raw 32-bit draw times window width <= 10^6), so every Number in compute() is an
// exact integer; there is no IEEE-754 division, fractional comparison, or continuous
// threshold anywhere.
//
// Checks:
//   fixture-oracle gate (mandatory before any property is trusted),
//   P1 exact-draws: every valid derivation completes with verdict DERIVED, exactly
//      sample_size accepted draws, draws_used === sample_size + reduction_rejects, and NO
//      draw cap — full samples at populations the v1 sampler's 10x cap could not cover
//      succeed (the committed n=20000 fixture pins the large case; in-property full
//      samples run to n=1200),
//   P2 boundedness: selected indices distinct and in [0, item_count); a full sample is a
//      permutation of [0, item_count); the emitted transcript is capped at 50 entries and
//      transcript_truncated is exactly (draws_used > transcript length),
//   P3 determinism + seed determinism: identical inputs replay byte-identically; seed_hex
//      depends only on (item_manifest_hash, beacon_randomness, beacon_round, algorithm_id),
//      so varying item_count/sample_size leaves seed_hex unchanged,
//   P4 differential: (a) an independent node:crypto reimplementation of the whole v2 walk
//      (same seed construction, per-draw HMAC, threshold reduction, partial Fisher-Yates)
//      matches the kernel byte-for-byte; (b) raw-stream identity against the v1 sampler
//      kernel, imported read-only and never edited: both kernels' per-draw values are the
//      same function of their seed (HMAC-SHA256(key=seed, msg='draw:<i>'), first 8 hex
//      chars as the 32-bit draw), so equal seeds give equal raw streams — only the
//      reduction into the remaining window differs between v1 and v2,
//   P5 uniformity, chi-square-free: (a) EXACT structural unbiasedness of the threshold
//      reduction by BigInt boundary arithmetic — the accepted region is the largest exact
//      multiple of the window width that fits in 32 bits, hence every offset is hit by
//      exactly limit/width raw values, no statistics involved; (b) end-to-end index
//      frequency over 2100 independent seeds at n=7 inside a 5-sigma band of the uniform
//      mean,
//   P6 forced categorical refusals: empty input, sample_size > item_count, sample_size 0,
//      non-integer item_count, over-ceiling item_count, uppercase hex, wrong algorithm id,
//      wrong beacon source — each a structured INDETERMINATE with normalized null echoes.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
// node:crypto is used ONLY by the independent P4 reimplementation, never by the kernel.
//
// Run: node chaingraph/kernels/__proptests__/art-774-beacon-seeded-fair-sampling-v2.proptest.mjs

import { compute as computeV2 } from '../art-774-beacon-seeded-fair-sampling-v2.kernel.mjs';
import { compute as computeV1 } from '../art-583-beacon-seeded-fair-sampling-deriver.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, summarize } from './_pbt-common.mjs';
import { createHmac } from 'node:crypto';

const KERNEL_ID = 'art-774-beacon-seeded-fair-sampling-v2';
const Z32 = 4294967296;

const rand = mulberry32(0x772A2);
function hexN(rng, n) { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16); return s; }

function randomPP(rng, maxN = 200) {
  const item_count = 2 + Math.floor(rng() * maxN);
  const sample_size = 1 + Math.floor(rng() * item_count);
  return {
    beacon_source: pick(rng, ['drand_quicknet', 'nistir_8213']),
    beacon_round: String(1 + Math.floor(rng() * 1e7)),
    beacon_randomness: hexN(rng, 64),
    item_manifest_hash: hexN(rng, 64),
    item_count,
    sample_size,
    algorithm_id: 'hmac-drbg-sha256-v2',
  };
}

// Independent reimplementation via node:crypto: same seed construction, per-draw HMAC,
// threshold rejection into the shrinking window, partial Fisher-Yates. Strings are passed
// with an explicit 'utf8' encoding so no Buffer is constructed (the Buffer global is not
// allowlisted the way node:* module specifiers and process are).
function hmacHex(keyStr, msgStr) { return createHmac('sha256', keyStr).update(msgStr, 'utf8').digest('hex'); }
function reimplementV2(pp) {
  const seed_hex = hmacHex(pp.item_manifest_hash, `${pp.beacon_randomness}:${pp.beacon_round}:${pp.algorithm_id}`);
  const index = [];
  for (let i = 0; i < pp.item_count; i++) index.push(i);
  const selected = [];
  const transcript = [];
  let draw = 0, rejects = 0;
  while (selected.length < pp.sample_size) {
    const draw_hex = hmacHex(seed_hex, `draw:${draw}`);
    const raw32 = parseInt(draw_hex.slice(0, 8), 16);
    const w = pp.item_count - selected.length;
    const limit = Math.floor(Z32 / w) * w;
    if (raw32 >= limit) {
      rejects += 1;
      if (transcript.length < 50) transcript.push({ draw, hmac_hex: draw_hex, result: 'rejected_reduction' });
    } else {
      const j = selected.length + (raw32 % w);
      const tmp = index[selected.length]; index[selected.length] = index[j]; index[j] = tmp;
      const picked = index[selected.length];
      selected.push(picked);
      if (transcript.length < 50) transcript.push({ draw, hmac_hex: draw_hex, result: 'selected', position: selected.length - 1, swap_index: j, selected_index: picked });
    }
    draw += 1;
  }
  return { seed_hex, selected, draws_used: draw, reduction_rejects: rejects, transcript, transcript_truncated: draw > transcript.length };
}

// ---------- P1: exact draws — every valid derivation completes, no cap ----------
function checkP1_exact_draws() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = computeV2(pp);
    checked++;
    if (o.verdict !== 'DERIVED') violations++;
    if (o.selected_indices.length !== pp.sample_size) violations++;
    if (o.draws_used !== pp.sample_size + o.reduction_rejects) violations++;
  }
  // Full samples at populations the v1 cap could not cover: no cap exists here.
  for (const n of [500, 1200]) {
    const pp = randomPP(rand, 1);
    pp.item_count = n; pp.sample_size = n;
    const { output_payload: o } = computeV2(pp);
    checked++;
    if (o.verdict !== 'DERIVED') violations++;
    if (o.draws_used !== n + o.reduction_rejects) violations++;
  }
  return { name: 'P1_exact_draws_no_cap_full_samples_complete', checked: checked, violations };
}

// ---------- P2: boundedness — distinct in-range indices, permutation on full samples, transcript cap ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = computeV2(pp);
    checked++;
    const set = new Set(o.selected_indices);
    if (set.size !== o.selected_indices.length) violations++;
    if (o.selected_indices.some((idx) => idx < 0 || idx >= pp.item_count)) violations++;
    if (o.derivation_transcript.length > 50) violations++;
    if (o.transcript_truncated !== (o.draws_used > o.derivation_transcript.length)) violations++;
    if (pp.sample_size === pp.item_count) {
      const sorted = [...o.selected_indices].sort((a, b) => a - b);
      for (let k = 0; k < pp.item_count; k++) if (sorted[k] !== k) { violations++; break; }
    }
  }
  return { name: 'P2_boundedness_distinct_in_range_transcript_cap', checked: checked, violations };
}

// ---------- P3: determinism + seed determinism ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomPP(rand);
    const a = computeV2(pp).output_payload;
    const b = computeV2(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    const pp2 = { ...pp, item_count: pp.item_count + 1, sample_size: 1 };
    const c = computeV2(pp2).output_payload;
    if (c.seed_hex !== a.seed_hex) violations++;
  }
  return { name: 'P3_determinism_and_seed_determinism', checked: checked, violations };
}

// ---------- P4: differential — full-walk reimplementation + raw-stream identity vs the v1 sampler ----------
function checkP4_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = computeV2(pp);
    const exp = reimplementV2(pp);
    checked++;
    if (o.seed_hex !== exp.seed_hex) violations++;
    if (JSON.stringify(o.selected_indices) !== JSON.stringify(exp.selected)) violations++;
    if (o.draws_used !== exp.draws_used || o.reduction_rejects !== exp.reduction_rejects) violations++;
    if (JSON.stringify(o.derivation_transcript) !== JSON.stringify(exp.transcript)) violations++;
  }
  // Raw-stream identity against the v1 sampler node (read-only import; v1 is never edited).
  for (let i = 0; i < 40; i++) {
    const pp1 = randomPP(rand, 60);
    const v1pp = { ...pp1, algorithm_id: 'hmac-drbg-sha256-v1', sample_size: Math.min(pp1.sample_size, 5) };
    const v2pp = { ...pp1, algorithm_id: 'hmac-drbg-sha256-v2', item_count: v1pp.item_count, sample_size: v1pp.sample_size };
    const r1 = computeV1(v1pp).output_payload;
    const r2 = computeV2(v2pp).output_payload;
    checked++;
    if (r1.verdict !== 'DERIVED' || r2.verdict !== 'DERIVED') { violations++; continue; }
    let v1ok = true, v2ok = true;
    for (const e of r1.derivation_transcript) if (e.hmac_hex !== hmacHex(r1.seed_hex, `draw:${e.draw}`)) v1ok = false;
    for (const e of r2.derivation_transcript) if (e.hmac_hex !== hmacHex(r2.seed_hex, `draw:${e.draw}`)) v2ok = false;
    if (!v1ok || !v2ok) violations++;
    // Same-seed equality: v2's per-draw construction at v1's seed reproduces v1's recorded
    // raw stream exactly, draw for draw, including the 32-bit prefix extraction.
    for (let d = 0; d < r1.derivation_transcript.length; d++) {
      const h = hmacHex(r1.seed_hex, `draw:${d}`);
      if (r1.derivation_transcript[d].hmac_hex !== h) violations++;
      if (parseInt(r1.derivation_transcript[d].hmac_hex.slice(0, 8), 16) !== parseInt(h.slice(0, 8), 16)) violations++;
    }
  }
  return { name: 'P4_differential_walk_and_v1_stream_identity', checked: checked, violations };
}

// ---------- P5: uniformity, chi-square-free ----------
function checkP5_uniformity() {
  let violations = 0, checked = 0;
  // (a) EXACT structural unbiasedness by boundary arithmetic: for each window width w the
  // accepted region is [0, limit) with limit = floor(2^32 / w) * w — an exact multiple of
  // w (every offset hit by exactly limit/w raw values) and the largest such multiple that
  // fits in 32 bits. No statistical claim is involved.
  const widths = [2, 3, 5, 7, 8, 16, 97, 100, 997, 1000, 4096, 999983, 1000000];
  for (const w of widths) {
    const limit = Number((4294967296n / BigInt(w)) * BigInt(w));
    checked++;
    if (limit % w !== 0) violations++;
    if (limit > Z32 || limit + w <= Z32) violations++; // largest multiple of w inside the raw [0, 2^32) domain
    if (limit < Z32 - w) violations++;
    const perClass = limit / w;
    for (const o of [0, 1, w - 1]) {
      const first = o;
      const last = limit - (w - o);
      const count = Number((BigInt(last) - BigInt(first)) / BigInt(w)) + 1;
      if (count !== perClass) violations++;
    }
  }
  // (b) end-to-end index frequency at n=7, sample_size=1, 2100 independent seeds: every
  // index count within 5 sigma of the uniform mean (sigma = sqrt(T/n * (1-1/n))).
  const n = 7, T = 2100;
  const counts = new Array(n).fill(0);
  for (let t = 0; t < T; t++) {
    const pp = randomPP(rand, 1);
    pp.item_count = n; pp.sample_size = 1;
    const { output_payload: o } = computeV2(pp);
    checked++;
    if (o.verdict !== 'DERIVED') { violations++; continue; }
    counts[o.selected_indices[0]] += 1;
  }
  const mean = T / n;
  const sigma = Math.sqrt(mean * (1 - 1 / n));
  for (const c of counts) if (Math.abs(c - mean) > 5 * sigma) violations++;
  return { name: 'P5_uniformity_exact_reduction_plus_frequency', checked: checked, violations, counts };
}

// ---------- P6: forced categorical refusals ----------
function checkP6_forced_categorical() {
  let violations = 0, checked = 0;
  const R = hexN(rand, 64), M = hexN(rand, 64);
  const ok = { beacon_source: 'drand_quicknet', beacon_round: '4321000', beacon_randomness: R, item_manifest_hash: M, algorithm_id: 'hmac-drbg-sha256-v2' };
  { const { output_payload: o } = computeV2({}); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (o.reasons.length < 5) violations++;
    if (o.item_count !== null || o.sample_size !== null || o.beacon_source !== null) violations++;
    if (o.seed_hex !== undefined) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, item_count: 5, sample_size: 6 }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (!o.reasons.some((r) => r.includes('cannot exceed'))) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, item_count: 250, sample_size: 0 }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (!o.reasons.some((r) => r.includes('sample_size must be a positive integer'))) violations++;
    if (o.sample_size !== null) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, item_count: 10.5, sample_size: 2 }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (o.item_count !== null) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, item_count: 1000001, sample_size: 2 }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (!o.reasons.some((r) => r.includes('between 1 and 1000000'))) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, beacon_randomness: 'F'.repeat(64), item_count: 10, sample_size: 2 }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (!o.reasons.some((r) => r.includes('64 lowercase hex'))) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, item_count: 10, sample_size: 2, algorithm_id: 'hmac-drbg-sha256-v1' }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (!o.reasons.some((r) => r.includes('algorithm_id must be hmac-drbg-sha256-v2'))) violations++; }
  { const { output_payload: o } = computeV2({ ...ok, beacon_source: 'made-up-source', item_count: 10, sample_size: 2 }); checked++;
    if (o.verdict !== 'INDETERMINATE') violations++;
    if (!o.reasons.some((r) => r.includes('drand_quicknet, nistir_8213'))) violations++; }
  return { name: 'P6_forced_categorical_refusals', checked: checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, computeV2);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures present)', got: String((e && e.message) || e) }] };
}

const properties = [
  checkP1_exact_draws(),
  checkP2_boundedness(),
  checkP3_seed_determinism(),
  checkP4_differential(),
  checkP5_uniformity(),
  checkP6_forced_categorical(),
];

const ok = summarize(KERNEL_ID, oracle, properties);
if (!ok) console.log('note: P5 frequency counts:', JSON.stringify(properties[4].counts));
process.exit(ok ? 0 : 1);
