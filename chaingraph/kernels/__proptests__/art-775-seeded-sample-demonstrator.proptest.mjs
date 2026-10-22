// art-775-seeded-sample-demonstrator -- class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:363405e7c6febe1bca4c14287961f40909cbca95ba7a396fd892f2b131a4c733
// spec: ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.0.1 (bundle + demonstrator) + Sec.4 (composition
//       contract) + board row SHARED-PRNG-BUNDLE-1 + SPEC.md Sec.24.6.2 (seed receipt discipline)
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md, class K). NOT a proof, NOT Dafny. Internal
// engineering QC only.
//
// INDEPENDENT ORACLES (no code shared with the kernel or bundle):
//   - Vigna's pinned xoshiro256** / splitmix64 C reference (prng.di.unimi.it, retrieved
//     2026-10-21; byte pins in the fixtures note), cross-derived at authoring time by a Python
//     port of the pinned C and hard-coded here as literals (P1).
//   - art-371's OWN generator bytes: P2 reads the live art-371 kernel source, fail-closed
//     extracts its splitmix64 / rotl / makeXoshiro256ss function statements plus MASK64, and
//     executes exactly those bytes as the reference stream (10,000 outputs x 20 seeds, the
//     row's acceptance gate). If art-371's text moves, extraction fails loudly -- a stale
//     differential cannot silently pass. art-371 is NEVER edited by this row.
//   - art-774 (sampler v2 node, read-only import): P3 re-runs its compute() and requires the
//     bundle to reproduce its seed_hex derivation, every transcript draw hmac, the full
//     selected_indices walk, draws_used and reduction_rejects -- including a 20,000-item full
//     sample (the D14 shape) that v1's draw cap could not do.
//   - node:crypto (createHash / createHmac): P7/P8 differential for the SHA-256 state
//     derivation, the DRBG hmac stream and the beacon seed derivation.
//
// Checks: fixture-oracle gate; Vigna goldens (P1); art-371 stream differential 10k x 20 (P2);
// art-774 DRBG differential incl. full-sample replay (P3); nextBelow range + draw accounting
// (P4); kernel sample properties -- distinct length-k, k=n permutation, replay identical,
// tampered seed differs, all three modes (P5); shuffle permutation (P6); string-seed grammar
// + state pin vs node:crypto (P7); DRBG stream + beacon derivation vs node:crypto (P8);
// totality over hostile inputs (P9); determinism + shape + commitment echo (P10). Inline
// byte-identity with _prng.bundle.mjs is NOT a property here; it is gated by the 'prng',
// 'sha256' and 'sha256-in-bundles' pairs in scripts/inline-ssot-sync-manifest.json, and the
// art-371 equivalence pairs gate the verbatim generator core.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-775-seeded-sample-demonstrator.proptest.mjs

import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compute } from '../art-775-seeded-sample-demonstrator.kernel.mjs';
import * as PRNG from '../_prng.bundle.mjs';
import { compute as compute774 } from '../art-774-beacon-seeded-fair-sampling-v2.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32, pickNasty } from './_pbt-common.mjs';

const KERNEL_ID = 'art-775-seeded-sample-demonstrator';
const X = 'xoshiro256ss-splitmix64-v1';
const S = 'xoshiro256ss-splitmix64-sha256str-v1';
const D = 'hmac-drbg-sha256';
const sha256utf8 = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

// ---- P1: Vigna reference outputs (literal expected values, independent of the bundle) -----------
const V_SM0 = ['0xe220a8397b1dcdaf', '0x6e789e6aa1b965f4', '0x6c45d188009454f', '0xf88bb8a8724c81ec', '0x1b39896a51a8749b', '0x53cb9f0c747ea2ea', '0x2c829abe1f4532e1', '0xc584133ac916ab3c'];
const V_X0 = ['0x99ec5f36cb75f2b4', '0xbf6e1f784956452a', '0x1a5f849d4933e6e0', '0x6aa594f1262d2d2c', '0xbba5ad4a1f842e59', '0xffef8375d9ebcaca', '0x6c160deed2f54c98', '0x8920ad648fc30a3f', '0xdb032c0ba7539731', '0xeb3a475a3e749a3d', '0x1d42993fa43f2a54', '0x11361bf526a14bb5', '0x1b4f07a5ab3d8e9c', '0xa7a3257f6986db7f', '0x7efdaa95605dfc9c', '0x4bde97c0a78eaab8'];
const V_STATE1234 = ['0x2d00', '0x0', '0x5a007080', '0x10e0000000009d80', '0x10e0b61ce1009d80', '0x870021ce143ad00', '0xe071c3c2e143f089', '0x75a1690ef7a20380'];
const V_X1234567 = ['0x30a3a1c363600467', '0x19405f0f579929ca', '0x115beaac046ddbd9', '0xeb17caf48f27d7f6', '0xa0c94fe1cce9d136', '0x70e3326578802da2', '0xe54cf8877c3f5477', '0x5cb9160d2c396c0e'];
function checkP1_vigna() {
  let violations = 0, checked = 0;
  const sm = PRNG.splitmix64(0n);
  for (let i = 0; i < V_SM0.length; i++) { checked++; if ('0x' + sm().toString(16) !== V_SM0[i]) violations++; }
  const g0 = PRNG.xoshiro256ssSplitmix64(0);
  for (let i = 0; i < V_X0.length; i++) { checked++; if ('0x' + g0.nextU64().toString(16) !== V_X0[i]) violations++; }
  const gw = PRNG.makeXoshiro256ssFromWords(1n, 2n, 3n, 4n);
  for (let i = 0; i < V_STATE1234.length; i++) { checked++; if ('0x' + gw().toString(16) !== V_STATE1234[i]) violations++; }
  const g7 = PRNG.xoshiro256ssSplitmix64(1234567);
  for (let i = 0; i < V_X1234567.length; i++) { checked++; if ('0x' + g7.nextU64().toString(16) !== V_X1234567[i]) violations++; }
  return { name: 'P1_vigna_reference_vectors', checked, violations };
}

// ---- P2: differential vs art-371's OWN source bytes (10,000 outputs x 20 seeds) -----------------
// Fail-closed extraction: each anchor must appear exactly once in the live art-371 kernel
// source or this property throws and the floor fails. The reference IS art-371's code.
function load371Generator() {
  const src = readFileSync(new URL('../art-371-simulate-var-monte-carlo.kernel.mjs', import.meta.url), 'utf8');
  function extractOnce(trigger) {
    const first = src.indexOf(trigger);
    if (first < 0 || src.indexOf(trigger, first + 1) >= 0) {
      throw new Error('art-371 source anchor not found exactly once: ' + trigger + ' (the differential cannot run against a moved target)');
    }
    return first;
  }
  function extractFn(name) {
    const start = extractOnce('function ' + name + '(');
    const braceStart = src.indexOf('{', start);
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('art-371 function extraction ran off the file: ' + name);
  }
  const maskStart = extractOnce('const MASK64');
  const maskEnd = src.indexOf(';', maskStart);
  if (maskEnd < 0) throw new Error('art-371 MASK64 extraction failed');
  const body = src.slice(maskStart, maskEnd + 1) + '\n' + extractFn('splitmix64') + '\n' + extractFn('rotl') + '\n' + extractFn('makeXoshiro256ss') + '\nreturn makeXoshiro256ss;';
  // The constructed function is art-371's own extracted bytes (plus MASK64 and the return);
  // nothing of the bundle is in it.
  const factory = new Function(body);
  return factory();
}
function checkP2_differential_art371() {
  const make371 = load371Generator();
  const seeds = [0, 1, 2, 3, 7, 42, 99, 1000, 65535, 65536, 1234567, 2147483647, 2147483648, 4294967295, 4294967296, -1, -42, -1234567, 9007199254740991, 9007199254740992];
  const N = 10000;
  let violations = 0;
  for (const seed of seeds) {
    const ref = make371(seed);            // art-371's own bytes (BigInt(seed) & MASK64 inside)
    const got = PRNG.xoshiro256ssSplitmix64(seed); // the bundle's mode-1 generator (Math.trunc then the same core)
    for (let i = 0; i < N; i++) {
      if (ref() !== got.nextU64()) { violations++; break; }
    }
  }
  return { name: 'P2_differential_vs_art371_stream_10k_x_20', checked: seeds.length, violations };
}

// ---- P3: differential vs art-774 (sampler v2) seed derivation, draw hmacs and selection --------
function checkP3_differential_art774() {
  const base = (r, n, k) => ({
    beacon_source: 'drand_quicknet', beacon_round: r, beacon_randomness: 'a1'.repeat(32),
    item_manifest_hash: 'b2'.repeat(32), algorithm_id: 'hmac-drbg-sha256-v2', item_count: n, sample_size: k,
  });
  const cases = [base('00000000000000f7', 10, 4), base('00000000000000fa', 100, 100), base('round-xyz', 5000, 5000), base('0000000000000101', 20000, 20000)];
  let checked = 0, violations = 0;
  for (const pp of cases) {
    const out = compute774(pp).output_payload;
    checked++;
    if (PRNG.beaconSeedDerivation(pp.item_manifest_hash, pp.beacon_randomness, pp.beacon_round, 'hmac-drbg-sha256-v2') !== out.seed_hex) violations++;
    const gH = PRNG.hmacDrbgSha256(out.seed_hex);
    let hmacOk = true;
    for (const t of out.derivation_transcript) { if (gH.drawHmacHex(t.draw) !== t.hmac_hex) { hmacOk = false; break; } }
    checked++;
    if (!hmacOk) violations++;
    const g = PRNG.hmacDrbgSha256(out.seed_hex);
    const sel = g.sample(pp.item_count, pp.sample_size);
    checked++;
    if (JSON.stringify(sel) !== JSON.stringify(out.selected_indices)) violations++;
    if (g.drawCount !== out.draws_used || g.rejectedDraws !== out.reduction_rejects) violations++;
  }
  return { name: 'P3_differential_vs_art774_selection_and_stream', checked, violations };
}

// ---- P4: nextBelow stays in range; draw accounting is exact ------------------------------------
function checkP4_nextBelow() {
  const rng = mulberry32(775004);
  let checked = 0, violations = 0;
  const makeG = (mode) => mode === 0 ? PRNG.xoshiro256ssSplitmix64(7) : mode === 1 ? PRNG.xoshiro256ssFromString('floor-check') : PRNG.hmacDrbgSha256('ee'.repeat(32));
  for (let mode = 0; mode < 3; mode++) {
    const g = makeG(mode);
    for (let t = 0; t < 40; t++) {
      const n = 1 + Math.floor(rng() * 5000);
      const v = g.nextBelow(n);
      checked++;
      if (!Number.isInteger(v) || v < 0 || v >= n) violations++;
    }
    // drawCount equals accepted calls + rejected draws: recount on a fresh generator
    const g2 = makeG(mode);
    let calls = 0;
    for (let t = 0; t < 200; t++) { g2.nextBelow(1 + Math.floor(rng() * 5000)); calls++; }
    checked++;
    if (g2.drawCount !== calls + g2.rejectedDraws) violations++;
  }
  return { name: 'P4_next_below_range_and_draw_accounting', checked, violations };
}

// ---- P5: kernel-level sample properties over all three modes -----------------------------------
function checkP5_sampleProperties() {
  const rng = mulberry32(775005);
  const modes = [
    { mode: X, seedOf: () => String(Math.floor(rng() * 2 ** 40) - 2 ** 39) },
    { mode: S, seedOf: () => 'seed-' + Math.floor(rng() * 1e9) },
    { mode: D, seedOf: () => 'ab'.repeat(32) },
  ];
  let checked = 0, violations = 0;
  for (const { mode, seedOf } of modes) {
    for (let t = 0; t < 12; t++) {
      const n = 1 + Math.floor(rng() * 300);
      const k = 1 + Math.floor(rng() * n);
      const pp = { algorithm_id: mode, seed: seedOf(), n, k };
      const r1 = compute(pp).output_payload;
      checked++;
      if (r1.status !== 'ok') { violations++; continue; }
      const sel = r1.selected_indices;
      if (sel.length !== k) violations++;
      const seen = new Set(sel);
      if (seen.size !== k) violations++;
      for (const v of sel) if (!Number.isInteger(v) || v < 0 || v >= n) violations++;
      if (k === n) { const sorted = [...sel].sort((a, b) => a - b); for (let i = 0; i < n; i++) if (sorted[i] !== i) violations++; }
      // replay identical (same seed gives the same stream, row step 6)
      const r2 = compute(JSON.parse(JSON.stringify(pp))).output_payload;
      checked++;
      if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
      // tampered seed changes the selection (the seed genuinely drives the output)
      const tampered = { ...pp, seed: mode === D ? 'cd'.repeat(32) : pp.seed + '-tampered' };
      const r3 = compute(tampered).output_payload;
      checked++;
      if (r3.status === 'ok' && JSON.stringify(r3.selected_indices) === JSON.stringify(sel)) violations++;
    }
  }
  return { name: 'P5_sample_distinct_length_k_replay_tamper_all_modes', checked, violations };
}

// ---- P6: shuffle(n) is a permutation of [0, n) --------------------------------------------------
function checkP6_shuffle() {
  const rng = mulberry32(775006);
  let checked = 0, violations = 0;
  for (let t = 0; t < 25; t++) {
    const n = 1 + Math.floor(rng() * 400);
    const g = PRNG.xoshiro256ssSplitmix64(Math.floor(rng() * 1e9));
    const perm = g.shuffle(n);
    checked++;
    if (perm.length !== n) { violations++; continue; }
    const sorted = [...perm].sort((a, b) => a - b);
    for (let i = 0; i < n; i++) if (sorted[i] !== i) { violations++; break; }
  }
  return { name: 'P6_shuffle_is_uniform_permutation', checked, violations };
}

// ---- P7: string-seed grammar + state pin vs node:crypto ----------------------------------------
function checkP7_stringSeed() {
  let checked = 0, violations = 0;
  // grammar refusals
  for (const bad of ['', 'x'.repeat(300)]) {
    checked++;
    try { PRNG.xoshiro256ssFromString(bad); violations++; } catch (e) { /* refused, correct */ }
  }
  // state pin: digest words (node:crypto) fed to the exported words core must equal the constructor's stream
  for (const s of ['ainumbers', '€100 liftoff 😀', 'audit-sample-2026']) {
    checked++;
    const d = createHash('sha256').update(Buffer.from(s, 'utf8')).digest();
    const words = [0n, 0n, 0n, 0n];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) words[i] = (words[i] << 8n) | BigInt(d[i * 8 + j]);
    const core = PRNG.makeXoshiro256ssFromWords(words[0], words[1], words[2], words[3]);
    const g = PRNG.xoshiro256ssFromString(s);
    for (let i = 0; i < 32; i++) if (core() !== g.nextU64()) { violations++; break; }
  }
  // distinct seeds give distinct first outputs (no collision among a sample set)
  const firsts = new Set();
  for (let i = 0; i < 200; i++) { const g = PRNG.xoshiro256ssFromString('distinct-' + i); firsts.add(g.nextU64().toString()); }
  checked++;
  if (firsts.size !== 200) violations++;
  return { name: 'P7_string_seed_grammar_and_sha256_state_pin', checked, violations };
}

// ---- P8: DRBG hmac stream + beacon derivation vs node:crypto ------------------------------------
function checkP8_drbg() {
  const rng = mulberry32(775008);
  let checked = 0, violations = 0;
  for (let t = 0; t < 4; t++) {
    let seedHex = '';
    for (let i = 0; i < 64; i++) seedHex += '0123456789abcdef'[Math.floor(rng() * 16)];
    const g = PRNG.hmacDrbgSha256(seedHex);
    for (let i = 0; i < 24; i++) {
      checked++;
      const want = createHmac('sha256', Buffer.from(seedHex, 'utf8')).update(Buffer.from('draw:' + i, 'utf8')).digest('hex');
      if (g.drawHmacHex(i) !== want) { violations++; break; }
    }
    checked++;
    if (g.nextU32() !== parseInt(g.drawHmacHex(0).slice(0, 8), 16)) violations++;
    // grammar refusal
    checked++;
    try { PRNG.hmacDrbgSha256(seedHex.toUpperCase()); violations++; } catch (e) { /* refused */ }
  }
  // beacon seed derivation, both family algorithm ids
  for (const alg of ['hmac-drbg-sha256-v1', 'hmac-drbg-sha256-v2']) {
    checked++;
    const key = '11'.repeat(32), rnd = '22'.repeat(32), round = '00000000000000f7';
    const want = createHmac('sha256', Buffer.from(key, 'utf8')).update(Buffer.from(rnd + ':' + round + ':' + alg, 'utf8')).digest('hex');
    if (PRNG.beaconSeedDerivation(key, rnd, round, alg) !== want) violations++;
  }
  return { name: 'P8_drbg_stream_and_beacon_derivation_vs_node_crypto', checked, violations };
}

// ---- P9: totality over hostile inputs -----------------------------------------------------------
function checkP9_totality() {
  const rng = mulberry32(775009);
  const shapes = [undefined, null, {}, { algorithm_id: X }, { algorithm_id: X, seed: '0' }, { algorithm_id: X, seed: '0', n: 10 },
    { algorithm_id: null, seed: null, n: null, k: null }, { algorithm_id: 5, seed: 5, n: 'x', k: 'y' }];
  for (let i = 0; i < 60; i++) shapes.push({ algorithm_id: pickNasty(rng), seed: pickNasty(rng), n: pickNasty(rng), k: pickNasty(rng) });
  let checked = 0, violations = 0;
  const CODES = ['ALGORITHM_UNSUPPORTED', 'SEED_NOT_STRING', 'SEED_GRAMMAR', 'N_OUT_OF_RANGE', 'K_OUT_OF_RANGE'];
  for (const pp of shapes) {
    checked++;
    try {
      const r = compute(pp);
      const o = r && r.output_payload;
      if (!o || (o.status !== 'ok' && o.status !== 'rejected')) violations++;
      else if (o.status === 'rejected' && CODES.indexOf(o.rejection_reason) < 0) violations++;
      else if (o.status === 'rejected' && o.selected_indices !== null) violations++;
      else if (o.status === 'ok' && !Array.isArray(o.selected_indices)) violations++;
    } catch (e) {
      violations++;
    }
  }
  return { name: 'P9_totality_over_hostile_inputs', checked, violations };
}

// ---- P10: determinism, shape, commitment echo vs node:crypto ------------------------------------
function checkP10_determinism() {
  const pps = [
    { algorithm_id: X, seed: '42', n: 10, k: 5 },
    { algorithm_id: S, seed: 'ainumbers', n: 10, k: 10 },
    { algorithm_id: D, seed: 'ab'.repeat(32), n: 50, k: 25 },
    { algorithm_id: 'nope', seed: 'x', n: 5, k: 1 },
  ];
  let checked = 0, violations = 0;
  for (const pp of pps) {
    checked++;
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    if (a !== b) violations++;
    const r = compute(pp);
    violations += findShapeViolations(r).length;
    const o = r.output_payload;
    checked++;
    if (o.seed_origin !== 'declared') violations++;
    if (o.status === 'ok') {
      const canon = o.seed; // the kernel echoes the canonical seed string each mode commits to
      if (o.seed_commitment !== 'sha256:' + sha256utf8(canon)) violations++;
      if (!Number.isInteger(o.draws_used) || o.draws_used < o.k) violations++;
    }
  }
  return { name: 'P10_determinism_shape_commitment_echo', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_vigna(),
  checkP2_differential_art371(),
  checkP3_differential_art774(),
  checkP4_nextBelow(),
  checkP5_sampleProperties(),
  checkP6_shuffle(),
  checkP7_stringSeed(),
  checkP8_drbg(),
  checkP9_totality(),
  checkP10_determinism(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
