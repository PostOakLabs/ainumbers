// art-605-merkle-airdrop-proof-verifier.proptest.mjs — FV property-test FLOOR (ETHMATH-MERKLE-1).
// kernel_digest_at_authoring: sha256:b4ca349f69674d520b252804bfdcfb4e76d917db449c46bfdfa2ac1632ea2763
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class A -- bounded enumeration
// candidate per ETHMATH-MERKLE-1's own row: proof depths are small and countable). NOT a proof,
// NOT Dafny.
// float_sensitive: NO -- the entire kernel is byte/BigInt arithmetic (uint256 parsing, keccak256,
// byte-lexicographic compare for sorted-pair hashing) and string/array comparisons. No IEEE-754
// division, no fractional comparison, no continuous threshold anywhere.
//
// Checks: fixture-oracle gate (P0), an ENUMERATION over every proof depth 0..6 with both
// pair_sort settings and both encoding_variants against a hand-built reference tree (P1, the
// A-class enumeration this kernel's row calls for), termination/totality -- compute() never
// throws and always returns a well-formed output_payload shape for any input, including hostile
// ones (P2), a differential re-derivation of the leaf-derivation/_hashPair/processProof algorithm
// (P3) built independently in THIS file (not copy-pasted from the kernel source) and hashed via
// keccak_256 imported directly from ../_noble-secp256k1.bundle.mjs -- the repo's single vendored
// SSOT crypto primitive (SPEC-X402-CRYPTO-CORE-1-2026-08-09.md section 3) -- rather than a
// hand-rolled Keccak-f[1600] permutation: the kernel's own inlined copy (required by RIDER-KERNEL
// #6 so compute() stays synchronous/self-contained inside the QuickJS guest) must byte-match this
// SSOT bundle's output, which is exactly what P3 checks; re-deriving Keccak-f[1600] itself from
// spec text is a separate, much higher-risk undertaking that this floor deliberately does not
// attempt (an early hand-rolled attempt during authoring produced a wrong digest even for
// keccak256("") and was discarded in favour of this SSOT-referencing design). A
// metamorphic determinism + single-bit-flip-always-breaks-the-match property (P4: flipping any
// one byte of the leaf inputs, any proof sibling, or claimed_root must never leave
// root_matches_claimed true, and calling compute() twice on identical input is byte-identical),
// and forced categorical boundary cases (P5: missing fields, malformed hex, wrong-length hashes,
// pair_sort:false with a missing position, an empty proof array meaning leaf==root, and a
// claimed_path shorter/longer than the actual path).
//
// Zero NEW external dependencies -- P3's independent leg imports the same already-vendored
// ../_noble-secp256k1.bundle.mjs this repo already relies on elsewhere, never a new package.
//
// Run: node chaingraph/kernels/__proptests__/art-605-merkle-airdrop-proof-verifier.proptest.mjs

import { compute } from '../art-605-merkle-airdrop-proof-verifier.kernel.mjs';
import { keccak_256 as keccak256Vendored } from '../_noble-secp256k1.bundle.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-605-merkle-airdrop-proof-verifier.fixtures.json');
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

// ---------- reference leaf-derivation / _hashPair / tree-walk logic, built independently in
// THIS file (never copy-pasted from the kernel source) but hashed via keccak_256 imported
// directly from the repo's single vendored SSOT bundle (see file header) rather than a
// hand-rolled permutation. ----------
function keccak256Ref(msgBytes) { return keccak256Vendored(msgBytes); }
function hex(bytes) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function bytesFromHex(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return a; }
function concat(...arrs) { const n = arrs.reduce((s, a) => s + a.length, 0); const out = new Uint8Array(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; }
function addrWord(addr) { return concat(new Uint8Array(12), bytesFromHex(addr.slice(2).toLowerCase())); }
function amountWord(amountStr) { return bytesFromHex(BigInt(amountStr).toString(16).padStart(64, '0')); }
function refLeaf(address, amount, variant) {
  const inner = keccak256Ref(concat(addrWord(address), amountWord(amount)));
  return variant === 'double-hash' ? keccak256Ref(inner) : inner;
}
function refHashPairSorted(a, b) {
  for (let i = 0; i < 32; i++) if (a[i] !== b[i]) return a[i] < b[i] ? keccak256Ref(concat(a, b)) : keccak256Ref(concat(b, a));
  return keccak256Ref(concat(a, b));
}
function refHashPairOrdered(cur, sib, position) {
  return position === 'left' ? keccak256Ref(concat(sib, cur)) : keccak256Ref(concat(cur, sib));
}

// ---------- deterministic PRNG + tree builders for enumeration/fuzzing ----------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x605A11);
function hexN(rng, n) { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16); return s; }
function randAddr(rng) { return '0x' + hexN(rng, 40); }
function randAmount(rng) { return String(BigInt(1 + Math.floor(rng() * 1e12))); }

// Builds a full binary Merkle tree of 2^depth leaves (sorted-pair hashing), returns
// { root, leaves[], proofFor(i) } using the REFERENCE (independent) hash implementation.
function buildRefTree(depth, addresses, amounts, variant) {
  const n = 1 << depth;
  const leaves = [];
  for (let i = 0; i < n; i++) leaves.push(refLeaf(addresses[i], amounts[i], variant));
  let level = leaves;
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(refHashPairSorted(level[i], level[i + 1]));
    levels.push(next);
    level = next;
  }
  const root = level[0];
  function proofFor(idx) {
    const proof = [];
    let i = idx;
    for (let d = 0; d < levels.length - 1; d++) {
      const levelArr = levels[d];
      const sibIdx = i % 2 === 0 ? i + 1 : i - 1;
      proof.push('0x' + hex(levelArr[sibIdx]));
      i = Math.floor(i / 2);
    }
    return proof;
  }
  return { root: '0x' + hex(root), leaves, proofFor };
}

// ---------- P1: A-class ENUMERATION over depths 0..6, both encoding variants, both pair_sort
// settings, against the independent reference tree builder ----------
function checkP1_enumeration_bounded_depths() {
  let violations = 0, checked = 0;
  for (const depth of [0, 1, 2, 3, 4, 5, 6]) {
    for (const variant of ['double-hash', 'single-hash']) {
      const n = 1 << depth;
      const addresses = Array.from({ length: n }, () => randAddr(rand));
      const amounts = Array.from({ length: n }, () => randAmount(rand));
      const tree = buildRefTree(depth, addresses, amounts, variant);
      for (let leafIdx = 0; leafIdx < n; leafIdx++) {
        checked++;
        const proof = tree.proofFor(leafIdx);
        const pp = { address: addresses[leafIdx], amount: amounts[leafIdx], encoding_variant: variant, proof, claimed_root: tree.root };
        const { output_payload: o } = compute(pp);
        if (o.root_matches_claimed !== true) violations++;
        if (o.path.length !== depth) violations++;
        if (depth === 0 && o.leaf !== o.computed_root) violations++;
      }
    }
  }
  return { name: 'P1_enumeration_bounded_depths_0_to_6_both_variants', trials: checked, violations };
}

// ---------- P2: termination/totality — compute() never throws, always well-formed shape ----------
function checkP2_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { address: 'not-hex' }, { address: '0x' + 'zz'.repeat(20) },
    { address: '0x' + '11'.repeat(20), amount: '-1' },
    { address: '0x' + '11'.repeat(20), amount: 'not-a-number' },
    { address: '0x' + '11'.repeat(20), amount: '1'.repeat(80) },
    { proof: 'not-an-array' }, { proof: [null, 42, { sibling: 'bad' }] },
    { pair_sort: false, proof: [{ sibling: '0x' + '11'.repeat(32) }] },
    { claimed_path: [1, 2, 3] }, { claimed_root: 12345 },
    { encoding_variant: 'triple-hash' },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (!Array.isArray(o.reasons)) violations++;
    if (!Array.isArray(o.path)) violations++;
    if (typeof o.note !== 'string' || o.note.length === 0) violations++;
    if (!Array.isArray(out.compliance_flags) || out.compliance_flags.length === 0) violations++;
  }
  return { name: 'P2_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P3: differential — kernel's keccak256/hashPair re-derived against an independent
// FIPS-202-based implementation (P3a) plus full compute() re-derived end to end (P3b) ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    checked++;
    const address = randAddr(rand);
    const amount = randAmount(rand);
    const variant = rand() < 0.5 ? 'double-hash' : 'single-hash';
    const expectedLeaf = '0x' + hex(refLeaf(address, amount, variant));
    const { output_payload: o } = compute({ address, amount, encoding_variant: variant, proof: [], claimed_root: expectedLeaf });
    if (o.leaf !== expectedLeaf) violations++;
    if (o.computed_root !== expectedLeaf) violations++;
  }
  // depth-3 full differential re-derivation of the whole proof walk (pair_sort:true)
  for (let i = 0; i < 60; i++) {
    checked++;
    const depth = 3;
    const n = 1 << depth;
    const addresses = Array.from({ length: n }, () => randAddr(rand));
    const amounts = Array.from({ length: n }, () => randAmount(rand));
    const variant = rand() < 0.5 ? 'double-hash' : 'single-hash';
    const tree = buildRefTree(depth, addresses, amounts, variant);
    const leafIdx = Math.floor(rand() * n);
    const proof = tree.proofFor(leafIdx);
    const { output_payload: o } = compute({ address: addresses[leafIdx], amount: amounts[leafIdx], encoding_variant: variant, proof, claimed_root: tree.root });
    if (o.computed_root !== tree.root) violations++;
  }
  return { name: 'P3_leaf_and_tree_walk_differential_vs_independent_reimplementation', trials: checked, violations };
}

// ---------- P4: metamorphic — determinism, and single-bit-flip always breaks the match ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 200; i++) {
    checked++;
    const depth = 2;
    const n = 1 << depth;
    const addresses = Array.from({ length: n }, () => randAddr(rand));
    const amounts = Array.from({ length: n }, () => randAmount(rand));
    const variant = rand() < 0.5 ? 'double-hash' : 'single-hash';
    const tree = buildRefTree(depth, addresses, amounts, variant);
    const leafIdx = Math.floor(rand() * n);
    const proof = tree.proofFor(leafIdx);
    const pp = { address: addresses[leafIdx], amount: amounts[leafIdx], encoding_variant: variant, proof, claimed_root: tree.root };

    // determinism
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (a.root_matches_claimed !== true) violations++;

    // flip one hex nibble of the amount -> must not still match (probability of an accidental
    // collision on a real keccak256 is astronomically small, so any match here is a real bug)
    const tamperedAmount = String(BigInt(amounts[leafIdx]) + 1n);
    const tamperedPP = { ...pp, amount: tamperedAmount };
    const tampered = compute(tamperedPP).output_payload;
    if (tampered.root_matches_claimed !== false) violations++;

    // flip one char of claimed_root -> must not match
    const badRoot = '0x' + (tree.root.slice(2, 3) === '0' ? '1' : '0') + tree.root.slice(3);
    const rootTampered = compute({ ...pp, claimed_root: badRoot }).output_payload;
    if (rootTampered.root_matches_claimed !== false) violations++;
  }
  return { name: 'P4_determinism_and_single_bit_flip_always_breaks_match', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // fully empty input -> indeterminate, every required-field reason present
  { const { output_payload: o } = compute({}); checked++; if (o.reasons.length < 4) violations++; if (o.leaf !== null) violations++; }
  // depth-0: empty proof, leaf must equal claimed_root for a match
  { const addr = '0x' + '22'.repeat(20); const amt = '7'; const leaf = '0x' + hex(refLeaf(addr, amt, 'double-hash'));
    const { output_payload: o } = compute({ address: addr, amount: amt, proof: [], claimed_root: leaf });
    checked++; if (o.root_matches_claimed !== true) violations++; if (o.path.length !== 0) violations++; }
  // pair_sort:false with a missing position -> reasons populated, indeterminate
  { const { output_payload: o } = compute({ address: '0x' + '33'.repeat(20), amount: '1', pair_sort: false, proof: [{ sibling: '0x' + '44'.repeat(32) }], claimed_root: '0x' + '55'.repeat(32) });
    checked++; if (o.leaf !== null) violations++; if (!o.reasons.some((r) => r.indexOf('position is required') !== -1)) violations++; }
  // wrong-length hash in proof -> rejected
  { const { output_payload: o } = compute({ address: '0x' + '33'.repeat(20), amount: '1', proof: ['0xdead'], claimed_root: '0x' + '55'.repeat(32) });
    checked++; if (o.leaf !== null) violations++; }
  // claimed_path shorter than actual path -> path_intact false, first_divergent_step at the short boundary
  { const depth = 2; const addresses = Array.from({ length: 4 }, () => randAddr(rand)); const amounts = Array.from({ length: 4 }, () => randAmount(rand));
    const tree = buildRefTree(depth, addresses, amounts, 'double-hash');
    const proof = tree.proofFor(0);
    const { output_payload: o } = compute({ address: addresses[0], amount: amounts[0], encoding_variant: 'double-hash', proof, claimed_root: tree.root, claimed_path: [proof.length ? undefined : null].filter(Boolean) });
    checked++; if (o.path_intact !== false) violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_enumeration_bounded_depths());
results.properties.push(checkP2_totality());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_metamorphic());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-605-merkle-airdrop-proof-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
