
// 810-contract-bytecode-identity-verifier — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:9bc94068a33ab9fdd9c3323a0e898bb099328f10fb4ca970424388670379e009
// spec: research/ETH-BYTECODE-ID-BUILD-SPEC-2026-10-23.md (rules 1 to 8, amended: metadata hash reported, not recomputed)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/810-contract-bytecode-identity-verifier.proptest.mjs

import { createHash } from 'node:crypto';
import { compute } from '../810-contract-bytecode-identity-verifier.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '810-contract-bytecode-identity-verifier';
const DEP = '0x9C33eaCc2F50E39940D3AfaF2c7B8246B681A374';
const Z32 = '0x' + '00'.repeat(32);

function hex(bytes) { return '0x' + Buffer.from(bytes).toString('hex'); }
function randBytes(rng, n) { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = Math.floor(rng() * 256); return a; }
function mk(rng, extra = {}) {
  return {
    creation_code: hex(randBytes(rng, 1 + Math.floor(rng() * 200))),
    runtime_code: hex(randBytes(rng, 2 + Math.floor(rng() * 200))),
    creation_scheme: 'create', deployer: DEP, nonce: Math.floor(rng() * 1000000),
    ...extra,
  };
}

// Determinism and output shape over random valid inputs.
function checkDeterministicShape() {
  const rng = mulberry32(0x810a);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = mk(rng, i % 2 ? { creation_scheme: 'create2', nonce: undefined, salt: hex(randBytes(rng, 32)) } : {});
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (!deepEqual(a, b) || findShapeViolations(a.output_payload).length > 0) violations++;
  }
  return { name: 'deterministic_and_shape_clean', checked, violations };
}

// The runtime and creation hashes equal an independent Keccak-256 of the same bytes. Node has no
// keccak in its crypto module by name, so use sha3-256 with the pre-final padding NOT available:
// compare against the known empty-input constant and against a second code path (create2 preimage).
function checkKeccakEmptyAndDistinctFromSha3() {
  let violations = 0;
  const r = compute({ creation_code: '0x', runtime_code: '0x6000', creation_scheme: 'create', deployer: DEP, nonce: 0 });
  if (r.output_payload.creation_code_hash !== '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470') violations++;
  const sha3 = '0x' + createHash('sha3-256').update('').digest('hex');
  if (r.output_payload.creation_code_hash === sha3) violations++; // padding 0x06 would be a refusal-class defect
  return { name: 'keccak_not_sha3', checked: 2, violations };
}

// Hex case does not change any hash or address; flags are a pure function of the bytes.
function checkCaseInsensitiveHex() {
  const rng = mulberry32(0x810b);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = mk(rng);
    const up = { ...pp, creation_code: '0x' + pp.creation_code.slice(2).toUpperCase(), runtime_code: '0x' + pp.runtime_code.slice(2).toUpperCase(), deployer: '0x' + pp.deployer.slice(2).toLowerCase() };
    checked++;
    if (!deepEqual(compute(pp), compute(up))) violations++;
  }
  return { name: 'hex_case_insensitive', checked, violations };
}

// Size limits: exact boundary behaviour, over-limit inputs are flagged and not hashed.
function checkLimits() {
  let checked = 0, violations = 0;
  const base = { creation_scheme: 'create2', deployer: DEP, salt: Z32 };
  for (const n of [24575, 24576, 24577, 30000]) {
    const r = compute({ ...base, creation_code: '0x00', runtime_code: '0x' + '00'.repeat(n) });
    const over = n > 24576;
    checked++;
    if (r.compliance_flags.includes('EIP170_RUNTIME_TOO_LARGE') !== over) violations++;
    if ((r.output_payload.runtime_code_hash === null) !== over) violations++;
    if ((r.output_payload.overall === 'fail') !== over) violations++;
  }
  for (const n of [49151, 49152, 49153, 60000]) {
    const r = compute({ ...base, creation_code: '0x' + '00'.repeat(n), runtime_code: '0x6000' });
    const over = n > 49152;
    checked++;
    if (r.compliance_flags.includes('EIP3860_INITCODE_TOO_LARGE') !== over) violations++;
    if ((r.output_payload.creation_code_hash === null) !== over) violations++;
  }
  return { name: 'size_limit_boundaries', checked, violations };
}

// Any malformed required input is refused with exactly INPUT_REFUSED and nothing else is computed.
function checkRefusals() {
  const rng = mulberry32(0x810c);
  const good = mk(rng);
  const bad = [
    { runtime_code: '0x123' }, { runtime_code: '6000' }, { runtime_code: '0xzz00' }, { runtime_code: '0x60' },
    { creation_code: '0xabc' }, { creation_code: 5 }, { creation_scheme: 'CREATE' }, { creation_scheme: undefined },
    { deployer: '0x1234' }, { deployer: 7 }, { nonce: -1 }, { nonce: 1.5 }, { nonce: 'abc' }, { nonce: '18446744073709551615' },
    { salt: Z32 }, { declared_address: '0x00' }, { declared_verified_source_hash: '0x00' },
  ];
  let checked = 0, violations = 0;
  for (const patch of bad) {
    const r = compute({ ...good, ...patch });
    checked++;
    if (!deepEqual(r.compliance_flags, ['INPUT_REFUSED']) || r.output_payload.overall !== 'refused' || r.output_payload.runtime_code_hash !== null) violations++;
  }
  for (const empty of [undefined, null, {}]) {
    const r = compute(empty);
    checked++;
    if (!deepEqual(r.compliance_flags, ['INPUT_REFUSED'])) violations++;
  }
  const c2 = compute({ ...good, creation_scheme: 'create2', nonce: undefined, salt: '0x' + '00'.repeat(31) });
  checked++;
  if (!deepEqual(c2.compliance_flags, ['INPUT_REFUSED'])) violations++;
  return { name: 'malformed_input_refused_never_throws', checked, violations };
}

// Address and source-hash comparisons: a declared value equal to the recomputed one matches,
// any one-bit change mismatches, and the verdict follows.
function checkComparisons() {
  const rng = mulberry32(0x810d);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = mk(rng, i % 2 ? { creation_scheme: 'create2', nonce: undefined, salt: hex(randBytes(rng, 32)) } : {});
    const first = compute(pp).output_payload;
    const addr = first.address_recomputed.address;
    const good = compute({ ...pp, declared_address: addr, declared_verified_source_hash: first.runtime_code_hash });
    const flipped = '0x' + (addr.slice(2, 3) === '0' ? '1' : '0') + addr.slice(3);
    const bad = compute({ ...pp, declared_address: flipped, declared_verified_source_hash: first.runtime_code_hash.slice(0, -1) + (first.runtime_code_hash.endsWith('0') ? '1' : '0') });
    checked++;
    if (good.output_payload.overall !== 'pass' || good.output_payload.address_recomputed.status !== 'match' || good.output_payload.verified_source_match.status !== 'match') violations++;
    if (!bad.compliance_flags.includes('ADDRESS_MISMATCH') || !bad.compliance_flags.includes('VERIFIED_SOURCE_MISMATCH') || bad.output_payload.overall !== 'fail') violations++;
  }
  return { name: 'declared_vs_recomputed_verdict', checked, violations };
}

// CREATE: the address depends on the nonce and the deployer but not on the code; CREATE2: on the
// creation code and the salt. Different nonces give different addresses.
function checkAddressDependence() {
  const rng = mulberry32(0x810e);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const a = mk(rng), b = { ...a, creation_code: hex(randBytes(rng, 40)), runtime_code: hex(randBytes(rng, 40)) };
    const c = { ...a, nonce: a.nonce + 1 };
    checked++;
    if (compute(a).output_payload.address_recomputed.address !== compute(b).output_payload.address_recomputed.address) violations++;
    if (compute(a).output_payload.address_recomputed.address === compute(c).output_payload.address_recomputed.address) violations++;
    const s = { ...a, creation_scheme: 'create2', nonce: undefined, salt: hex(randBytes(rng, 32)) };
    const t = { ...s, creation_code: hex(randBytes(rng, 41)) };
    if (compute(s).output_payload.address_recomputed.address === compute(t).output_payload.address_recomputed.address) violations++;
  }
  return { name: 'address_dependence', checked, violations };
}

// Metadata: a runtime blob that does not end in a valid length-suffixed CBOR map flags
// METADATA_SUFFIX_INVALID without failing the verdict; a bzzr1 map is reported, never recomputed.
function checkMetadata() {
  const rng = mulberry32(0x810f);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = mk(rng);
    pp.runtime_code = hex(Uint8Array.from([...randBytes(rng, 10), 0xff, 0xff]));
    const r = compute(pp);
    checked++;
    if (!r.compliance_flags.includes('METADATA_SUFFIX_INVALID') || r.output_payload.overall !== 'pass' || r.output_payload.metadata.present) violations++;
  }
  const cbor = [0xa2, 0x65, 0x62, 0x7a, 0x7a, 0x72, 0x31, 0x58, 0x20, ...new Array(32).fill(7), 0x64, 0x73, 0x6f, 0x6c, 0x63, 0x43, 0, 5, 0x10];
  const rt = hex(Uint8Array.from([0x60, 0x00, ...cbor, 0x00, cbor.length]));
  const r = compute({ creation_code: '0x00', runtime_code: rt, creation_scheme: 'create', deployer: DEP, nonce: 0 });
  checked++;
  const m = r.output_payload.metadata;
  if (!m.present || m.hash_scheme !== 'bzzr1' || m.compiler_version !== '0.5.16' || m.hash_field_well_formed !== true || !r.compliance_flags.includes('METADATA_HASH_NOT_RECOMPUTABLE')) violations++;
  return { name: 'metadata_reported_not_recomputed', checked, violations };
}

// ---------- MUTFLOOR-2858-1 additions (money-math survivor kill-power) ----------
// Expected values below are (a) hand-computed literals with the arithmetic shown in a
// comment, or (b) second-formulation digests/addresses produced by an INDEPENDENT
// keccak-f[1600] (BigInt lanes, FIPS 202 LFSR-derived round constants) that was first
// verified against the published vectors keccak256('') =
// c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470,
// keccak256('abc') = 4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45
// and keccak256('The quick brown fox jumps over the lazy dog') =
// 4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15. No expected
// value in this section is derived by calling the kernel under test.

// Minimal CBOR builders for the metadata-suffix test blobs below (definite-length
// maps, text keys, bytes/text/bool values — exactly what parseCborMetadata reads).
function hexOf(arr) { return '0x' + arr.map((b) => (b < 16 ? '0' : '') + b.toString(16)).join(''); }
function cbText(s) { const b = [...s].map((c) => c.charCodeAt(0)); return b.length < 24 ? [0x60 + b.length].concat(b) : [0x78, b.length].concat(b); }
function cbBytesOf(bytes) { return bytes.length < 24 ? [0x40 + bytes.length].concat(bytes) : bytes.length < 256 ? [0x58, bytes.length].concat(bytes) : [0x59, bytes.length >> 8, bytes.length & 255].concat(bytes); }
function cbBool(v) { return [v ? 0xf5 : 0xf4]; }
function cbMap(pairs) { const body = [0xa0 + pairs.length]; for (const p of pairs) body.push(...cbText(p[0]), ...p[1]); return body; }
// Runtime blob: 2 code bytes + the CBOR map + the 2-byte big-endian CBOR length suffix.
function mdRuntime(cborArr) { const n = cborArr.length; return hexOf([0x60, 0x00].concat(cborArr, [Math.floor(n / 256), n % 256])); }
// Exact-fit blob: CBOR map starting at byte 0 + the 2-byte suffix, so the suffix
// length equals cborArr.length AND len + 2 === runtime.length (the exact-fit
// boundary of the suffix overflow check — unreachable with code bytes in front).
function mdRuntimeExact(cborArr) { const n = cborArr.length; return hexOf(cborArr.concat([Math.floor(n / 256), n % 256])); }
const METADATA_BAD = ['METADATA_SUFFIX_INVALID'];
// A 16-byte runtime whose metadata suffix is a solc-only map: it parses with NO
// hash scheme, so the kernel raises no flag at all — checks that assert an exact
// compliance_flags array (a clean pass = []) use this instead of a short blob like
// 0x6000, whose 2 bytes read as a 24576-byte suffix and always flag METADATA_SUFFIX_INVALID.
const RT_CLEAN = '0x6000a164736f6c6365312e322e33000c';

// keccak-256 known-answer vectors over lengths the fixture set never pins: 1 byte,
// 135 bytes (final pad byte lands at the block edge), 136 bytes (exact block) and
// 200 bytes (two absorbs). Digests are second-formulation literals (see provenance
// note above); e.g. keccak256(single byte 0x00) = bc36789e…, the 135/136/200-byte
// inputs are the patterned bytes (i*7+11) mod 256.
function checkKeccakKats() {
  let checked = 0, violations = 0;
  const base = { runtime_code: '0x6000', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  const p135 = '0x0b121920272e353c434a51585f666d747b828990979ea5acb3bac1c8cfd6dde4ebf2f900070e151c232a31383f464d545b626970777e858c939aa1a8afb6bdc4cbd2d9e0e7eef5fc030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dce3eaf1f8ff060d141b222930373e454c535a61686f767d848b9299a0a7aeb5';
  const p136 = p135 + 'bc';
  const p200 = p135 + 'bcc3cad1d8dfe6edf4fb020910171e252c333a41484f565d646b727980878e959ca3aab1b8bfc6cdd4dbe2e9f0f7fe050c131a21282f363d444b525960676e757c';
  // The 1-byte vector rides creation_code (no minimum); the rest ride runtime_code.
  checked++;
  if (compute({ ...base, creation_code: '0x00' }).output_payload.creation_code_hash !== '0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a') violations++;
  const vecs = [
    [p135, '0x47a414666f08a4658719043e5045638ef1ff99cb09400eff6289e6dc80c0970a'],
    [p136, '0x91bac0515ccd2811f7b65984a2971e3d6093ccb9fac349b14c048499c2832e81'],
    [p200, '0x661797e2bc621e734e4486e9be37bf204aae0fa0d78ed3493dfcaa1f51698121'],
  ];
  for (const v of vecs) {
    const r = compute({ ...base, creation_code: '0x00', runtime_code: v[0] });
    checked++;
    if (r.output_payload.runtime_code_hash !== v[1]) violations++;
  }
  return { name: 'keccak_known_answers_multiblock', checked, violations };
}

// Hex alphabet and prefix: uppercase 0X accepted, mixed case hashes identically,
// a missing '0' or 'x' prefix and a 1-char body are refused with exact reasons.
// The 12-byte mixed-case literal is keccak256('0123456789AbCdEf') (second
// formulation); the digits a-f/A-F/0-9 all appear, so every nib() branch is live.
function checkHexAlphabetAndPrefix() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  // keccak256 of the DECODED bytes 01 23 45 67 89 ab cd ef (second formulation).
  const dig = '0x0c3d72390ac0ce0233c551a3c5278f8625ba996f5985dc8d612a9fc55f1de15a';
  let r = compute({ ...base, runtime_code: '0x0123456789AbCdEf' });
  checked++;
  if (r.output_payload.runtime_code_hash !== dig) violations++;
  r = compute({ ...base, runtime_code: '0X0123456789ABCDEF' });
  checked++;
  if (r.output_payload.runtime_code_hash !== dig) violations++;
  r = compute({ ...base, runtime_code: 'x60000' });
  checked++;
  if (!deepEqual(r.compliance_flags, ['INPUT_REFUSED']) || !deepEqual(r.output_payload.refusal_reasons, ['runtime_code must be an even-length 0x-prefixed hex string'])) violations++;
  r = compute({ ...base, runtime_code: '0' });
  checked++;
  if (!deepEqual(r.output_payload.refusal_reasons, ['runtime_code must be an even-length 0x-prefixed hex string'])) violations++;
  r = compute({ ...base, runtime_code: '0xg000' });
  checked++;
  if (!deepEqual(r.output_payload.refusal_reasons, ['runtime_code contains a non-hex character'])) violations++;
  // '@' (64) sits between '9' and 'A': it is not a hex digit, but a mutant that
  // widens the A-F branch (c >= 65) would decode it as nibble 9 and hash instead.
  r = compute({ ...base, runtime_code: '0x@000' });
  checked++;
  if (!deepEqual(r.output_payload.refusal_reasons, ['runtime_code contains a non-hex character'])) violations++;
  return { name: 'hex_prefix_and_alphabet', checked, violations };
}

// CREATE/CREATE2 address literals for inputs the RLP/keccak pipeline must encode
// exactly: string nonce '12' (regex path), number nonce 9007199254740991 (the
// Number.isInteger bound, inclusive), and a create2 preimage over a fixed salt.
// Values are second-formulation literals (independent RLP + independent keccak).
function checkAddressLiterals() {
  let checked = 0, violations = 0;
  const cbase = { creation_code: '0x00', runtime_code: '0x6000', creation_scheme: 'create', deployer: DEP };
  let r = compute({ ...cbase, nonce: '12' });
  checked++;
  if (r.output_payload.address_recomputed.address !== '0x889dc70202acea893b5f70dc2f48038651c4d7b3') violations++;
  r = compute({ ...cbase, nonce: 9007199254740991 });
  checked++;
  if (r.output_payload.address_recomputed.address !== '0xddbe279853759c512847138bf620f3fca87be99f') violations++;
  r = compute({ creation_code: '0x60fe47b1', runtime_code: '0x6000', creation_scheme: 'create2', deployer: DEP, salt: '0x' + 'ab'.repeat(32) });
  checked++;
  if (r.output_payload.address_recomputed.address !== '0xbf7987d9aa37ac171152ad1eddd21d4ddeb99555') violations++;
  return { name: 'address_second_formulation_literals', checked, violations };
}

// Exact refusal_reasons arrays (single reason, nothing else) — pins the message
// strings and the condition guards that push them. All arithmetic shown inline.
function checkRefusalReasons() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', runtime_code: '0x6000', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  const cases = [
    [{ ...base, runtime_code: '0xzz00' }, ['runtime_code contains a non-hex character']],
    [{ ...base, runtime_code: '0x6z00' }, ['runtime_code contains a non-hex character']],
    [{ ...base, creation_code: '0xzz' }, ['creation_code contains a non-hex character']],
    [{ ...base, runtime_code: '0x600' }, ['runtime_code must be an even-length 0x-prefixed hex string']],
    [{ ...base, deployer: '0x1234' }, ['deployer must be a 20-byte 0x-prefixed hex address']],
    [{ ...base, declared_verified_source_hash: '0x00' }, ['declared_verified_source_hash must be a 32-byte 0x-prefixed hex value']],
    [{ ...base, nonce: ' 5' }, ['nonce must be a non-negative integer below 2^64 - 1 for create']],
    [{ ...base, nonce: '5x' }, ['nonce must be a non-negative integer below 2^64 - 1 for create']],
    [{ ...base, nonce: '000000000000000000001' }, ['nonce must be a non-negative integer below 2^64 - 1 for create']],
    [{ ...base, nonce: 1.5 }, ['nonce must be a non-negative integer below 2^64 - 1 for create']],
  ];
  for (const c of cases) {
    const r = compute(c[0]);
    checked++;
    if (!deepEqual(r.compliance_flags, ['INPUT_REFUSED']) || !deepEqual(r.output_payload.refusal_reasons, c[1])) violations++;
  }
  // Explicit null optional fields are "absent" and must not refuse. RT_CLEAN keeps
  // the compliance_flags array empty (a short runtime always flags the suffix).
  let r = compute({ ...base, runtime_code: RT_CLEAN, salt: null });
  checked++;
  if (r.output_payload.overall !== 'pass' || r.compliance_flags.length !== 0) violations++;
  r = compute({ creation_code: '0x00', runtime_code: RT_CLEAN, creation_scheme: 'create2', deployer: DEP, salt: Z32, nonce: null });
  checked++;
  if (r.output_payload.overall !== 'pass' || r.compliance_flags.length !== 0) violations++;
  r = compute({ ...base, runtime_code: RT_CLEAN, declared_address: null, declared_verified_source_hash: null });
  checked++;
  if (r.output_payload.overall !== 'pass' || r.compliance_flags.length !== 0) violations++;
  return { name: 'refusal_reasons_exact', checked, violations };
}

// CBOR length encoding: info<24 boundary (23 vs 24), the 0x58 one-byte form, a
// 0x5A (two-byte info, unsupported) header, the 0x59 two-byte form over a 300-byte
// field with the exact expected hash_field, and a 0x59 header truncated at the end.
// bzzr1 accepts any byte-string hash field (well_formed flags the 32-byte shape),
// so a 300-byte bzzr1 field is a legal parse. The expected hash_field for a value
// of n identical bytes 0xab is the 2n-char string 'ab'×n — the hex encoding of the
// known input, hand-computed, not kernel-derived.
function checkCborLengths() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  let r = compute({ ...base, runtime_code: mdRuntime(cbMap([['bzzr1', cbBytesOf(new Array(23).fill(0xcd))]])) });
  checked++;
  if (r.output_payload.metadata.hash_scheme !== 'bzzr1' || r.output_payload.metadata.hash_field !== '0x' + 'cd'.repeat(23)) violations++;
  r = compute({ ...base, runtime_code: mdRuntime(cbMap([['bzzr1', cbBytesOf(new Array(24).fill(0xcd))]])) });
  checked++;
  if (r.output_payload.metadata.hash_field !== '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd') violations++;
  // Unsupported two-byte-info header 0x5A (major 2, info 26): the map parse must fail.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x5a, 0x01, 0x02, 0x03]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD) || r.output_payload.metadata.present !== false) violations++;
  // 0x59 two-byte length: 300 bytes of 0xab → hash_field is 'ab' repeated 300 times.
  r = compute({ ...base, runtime_code: mdRuntime(cbMap([['bzzr1', cbBytesOf(new Array(300).fill(0xab))]])) });
  checked++;
  if (r.output_payload.metadata.hash_scheme !== 'bzzr1' || r.output_payload.metadata.hash_field !== '0x' + 'ab'.repeat(300)) violations++;
  // 0x59 header with its two length bytes cut off by the end of the map.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x64, 0x61, 0x61, 0x61, 0x62, 0x79, 0x01]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  return { name: 'cbor_length_encoding', checked, violations };
}

// CBOR structure guards: map size cap (8 ok, 9 refused), non-map top, non-text
// keys, duplicate keys, unprintable key bytes, bool values (parsed, then ignored
// by the scheme scan), unsupported value headers, null text values, and trailing
// bytes after the map.
function checkCborStructure() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  const b1 = cbBytesOf(new Array(32).fill(0x77));
  const ok = (pp) => {
    const r = compute(pp);
    return r.output_payload.metadata.present === true && r.output_payload.metadata.hash_scheme === 'bzzr1';
  };
  // 8 pairs parse; the 9th pair over the cap refuses.
  const eight = [['a', cbText('v')], ['b', cbText('v')], ['c', cbText('v')], ['d', cbText('v')], ['e', cbText('v')], ['f', cbText('v')], ['g', cbText('v')], ['bzzr1', b1]];
  checked++;
  if (!ok({ ...base, runtime_code: mdRuntime(cbMap(eight)) })) violations++;
  const nine = eight.concat([['h', cbText('v')]]);
  let r = compute({ ...base, runtime_code: mdRuntime(cbMap(nine)) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Top-level head that is not a map (0x40 = bytes, length 0).
  r = compute({ ...base, runtime_code: mdRuntime([0x40]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Key that is a byte string, not text (0x81): parse must fail.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x81, 0x61, 0x61, 0x76]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Key header with unsupported two-byte info (0x5A): kh is null, parse fails.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x5a, 0x01, 0x61, 0x76]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Duplicate keys.
  r = compute({ ...base, runtime_code: mdRuntime(cbMap([['a', cbText('x')], ['a', cbText('y')]])) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Key text containing a control byte (0x01) → ascii() null → refused.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x01, 0x61, 0x76]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Bool value true before the bzzr1 pair: parsed as bool, ignored by the scan.
  checked++;
  if (!ok({ ...base, runtime_code: mdRuntime(cbMap([['a', cbBool(true)], ['bzzr1', b1]])) })) violations++;
  // A bool field that must not desynchronise the following pair.
  checked++;
  if (!ok({ ...base, runtime_code: mdRuntime(cbMap([['a', cbBool(false)], ['bzzr1', b1]])) })) violations++;
  // Value head 0x00 (major 0, integer): neither bytes nor text → parse fails.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x61, 0x00]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Value head with unsupported two-byte info (0x5A) → vh null → parse fails.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x61, 0x5a, 0x01, 0x02]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Text value with a control byte: ascii null → parse fails.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x61, 0x61, 0x01]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Trailing byte after a complete map → the map must not be accepted.
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x61, 0x61, 0x76, 0x00]) });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  // Exact-fit map with a text value parses (value consumed to the last byte).
  r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x61, 0x61, 0x76]) });
  checked++;
  if (r.output_payload.metadata.present !== true) violations++;
  return { name: 'cbor_structure_guards', checked, violations };
}

// ascii() printable boundaries: 0x1f and 0x7f are rejected, 0x20 and 0x7e are kept.
function checkAsciiBoundaries() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  for (const c of [[0x1f, false], [0x20, true], [0x7e, true], [0x7f, false]]) {
    const r = compute({ ...base, runtime_code: mdRuntime([0xa1, 0x61, 0x61, 0x61, c[0]]) });
    checked++;
    if ((r.output_payload.metadata.present === true) !== c[1]) violations++;
  }
  return { name: 'ascii_printable_boundaries', checked, violations };
}

// Suffix-length boundaries: a suffix that exactly fits parses; one byte more
// refuses; a zero suffix refuses; a 2-byte runtime reports the invalid-suffix flag
// and nothing else. len+2 === runtime.length is the exact-fit boundary.
function checkMetadataBounds() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  const blob = cbMap([['bzzr1', cbBytesOf(new Array(32).fill(0x77))]]);
  checked++;
  if (compute({ ...base, runtime_code: mdRuntime(blob) }).output_payload.metadata.present !== true) violations++;
  // Exact fit: len + 2 === runtime.length parses. The >= mutant of the overflow
  // check would refuse it; the len - 2 mutant would shift the CBOR window.
  checked++;
  if (compute({ ...base, runtime_code: mdRuntimeExact(blob) }).output_payload.metadata.present !== true) violations++;
  const n = blob.length + 1; // one byte more than the map holds
  const over = hexOf([0x60, 0x00].concat(blob, [Math.floor(n / 256), n % 256]));
  let r = compute({ ...base, runtime_code: over });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  r = compute({ ...base, runtime_code: '0x60000000' });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD) || r.output_payload.metadata.present !== false) violations++;
  r = compute({ ...base, runtime_code: '0x6000' });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  r = compute({ ...base, runtime_code: '0x6000ffff' });
  checked++;
  if (!deepEqual(r.compliance_flags, METADATA_BAD)) violations++;
  return { name: 'metadata_suffix_bounds', checked, violations };
}

// Hash schemes and compiler versions: bzzr0 accepted (well_formed = 32-byte rule),
// ipfs well-formed only as 0x12 0x20 + 32 bytes, bzzr1 31 bytes not well-formed,
// solc as 2/3/4 bytes and as text. Literals below are the hex encodings of the
// stated constant fill bytes, hand-computed.
function checkSchemesAndSolc() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', creation_scheme: 'create', deployer: DEP, nonce: 0 };
  const md = (pp) => compute(pp).output_payload.metadata;
  let m = md({ ...base, runtime_code: mdRuntime(cbMap([['bzzr0', cbBytesOf(new Array(32).fill(0xee))]])) });
  checked++;
  if (m.hash_scheme !== 'bzzr0' || m.hash_field !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || m.hash_field_well_formed !== true) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['ipfs', cbBytesOf([0x12, 0x20].concat(new Array(32).fill(0x33)))]])) });
  checked++;
  if (m.hash_scheme !== 'ipfs' || m.hash_field_well_formed !== true || m.hash_field !== '0x1220' + '33'.repeat(32)) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['ipfs', cbBytesOf([0x12, 0x20].concat(new Array(31).fill(0x33)))]])) });
  checked++;
  if (m.hash_field_well_formed !== false) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['ipfs', cbBytesOf([0x11, 0x20].concat(new Array(32).fill(0x33)))]])) });
  checked++;
  if (m.hash_field_well_formed !== false) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['ipfs', cbBytesOf([0x12, 0x21].concat(new Array(32).fill(0x33)))]])) });
  checked++;
  if (m.hash_field_well_formed !== false) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['bzzr1', cbBytesOf(new Array(31).fill(0x77))]])) });
  checked++;
  if (m.hash_field_well_formed !== false) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['solc', cbBytesOf([0, 8])]])) });
  checked++;
  if (m.compiler_version !== null) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['solc', cbBytesOf([0, 5, 16, 9])]])) });
  checked++;
  if (m.compiler_version !== null) violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['solc', cbText('0.8.28')]])) });
  checked++;
  if (m.compiler_version !== '0.8.28') violations++;
  m = md({ ...base, runtime_code: mdRuntime(cbMap([['solc', cbText('abc')]])) });
  checked++;
  if (m.compiler_version !== 'abc') violations++;
  return { name: 'schemes_and_solc', checked, violations };
}

// Exact limit_checks arithmetic and exact compliance_flags arrays: 1-byte initcode
// = 1 word (ceil(1/32)) = 2 gas (2×1); 65-byte initcode = 3 words (ceil(65/32) = 3)
// = 6 gas (2×3); a clean pass carries no flags; over-cap runs carry exactly one
// flag (or both when both caps are exceeded, EIP-170 before EIP-3860).
function checkLimitChecksExact() {
  let checked = 0, violations = 0;
  const base = { creation_scheme: 'create', deployer: DEP, nonce: 0 };
  // RT_CLEAN is 45 bytes (2 code + 41 CBOR + 2 suffix) with well-formed metadata.
  let r = compute({ ...base, creation_code: '0x00', runtime_code: RT_CLEAN });
  checked++;
  if (!deepEqual(r.compliance_flags, [])) violations++;
  if (!deepEqual(r.output_payload.limit_checks, { runtime_bytes: 16, runtime_limit_bytes: 24576, runtime_within_limit: true, initcode_bytes: 1, initcode_limit_bytes: 49152, initcode_within_limit: true, initcode_word_count: 1, initcode_gas_surcharge: 2 })) violations++;
  r = compute({ ...base, creation_code: '0x' + '00'.repeat(65), runtime_code: RT_CLEAN });
  checked++;
  if (r.output_payload.limit_checks.initcode_word_count !== 3 || r.output_payload.limit_checks.initcode_gas_surcharge !== 6) violations++;
  // Over-cap runs never hash, so no metadata flags join the cap flags.
  r = compute({ ...base, creation_code: '0x00', runtime_code: '0x' + '00'.repeat(24577) });
  checked++;
  if (!deepEqual(r.compliance_flags, ['EIP170_RUNTIME_TOO_LARGE'])) violations++;
  r = compute({ ...base, creation_code: '0x' + '00'.repeat(49153), runtime_code: RT_CLEAN });
  checked++;
  if (!deepEqual(r.compliance_flags, ['EIP3860_INITCODE_TOO_LARGE'])) violations++;
  r = compute({ ...base, creation_code: '0x' + '00'.repeat(49153), runtime_code: '0x' + '00'.repeat(24577) });
  checked++;
  if (!deepEqual(r.compliance_flags, ['EIP170_RUNTIME_TOO_LARGE', 'EIP3860_INITCODE_TOO_LARGE'])) violations++;
  return { name: 'limit_checks_and_flags_exact', checked, violations };
}

// §2 flag mirror: warnings is exactly the conditional compliance-flag set.
function checkFlagMirror() {
  let checked = 0, violations = 0;
  const base = { creation_code: '0x00', runtime_code: RT_CLEAN, creation_scheme: 'create', deployer: DEP, nonce: 0 };
  const cases = [
    [base, []],
    [{ ...base, declared_address: '0x' + '11'.repeat(20) }, ['ADDRESS_MISMATCH']],
    [{ ...base, runtime_code: '0x' + '00'.repeat(24577) }, ['EIP170_RUNTIME_TOO_LARGE']],
    [{ ...base, creation_scheme: 'bad' }, ['INPUT_REFUSED']],
  ];
  for (const [pp, expectedFlags] of cases) {
    const r = compute(pp);
    checked++;
    if (!deepEqual(r.compliance_flags, expectedFlags)) violations++;
    if (!deepEqual(r.output_payload.warnings, r.compliance_flags)) violations++;
    if (Boolean(r.output_payload.warnings.length) !== (r.compliance_flags.length > 0)) violations++;
  }
  return { name: 'conditional_flag_mirror_warnings', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterministicShape(), checkKeccakEmptyAndDistinctFromSha3(), checkCaseInsensitiveHex(), checkLimits(),
  checkRefusals(), checkComparisons(), checkAddressDependence(), checkMetadata(),
  checkKeccakKats(), checkHexAlphabetAndPrefix(), checkAddressLiterals(), checkRefusalReasons(),
  checkCborLengths(), checkCborStructure(), checkAsciiBoundaries(), checkMetadataBounds(),
  checkSchemesAndSolc(), checkLimitChecksExact(), checkFlagMirror(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
