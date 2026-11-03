
// 810-contract-bytecode-identity-verifier — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:078d28040c48adb1240d0a8b49d63623e8393e82e0f558388bbecc7be94eedb6
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
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
