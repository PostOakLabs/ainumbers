// art-751-sha256-hmac-digest-demonstrator -- class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:dd59994be22b706a37764b59b362aa949096494b0dc2496180865a0c49f8aaba
// spec: ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.0.1 (bundle + demonstrator) + Sec.4 (composition contract)
//       + board row SHARED-SHA256-BUNDLE-1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md, class K). NOT a proof, NOT Dafny. Internal
// engineering QC only.
//
// INDEPENDENT ORACLE: every differential property compares the kernel's pure-JS SHA-256 / HMAC
// against node:crypto (createHash / createHmac), an implementation that shares no code with the
// kernel. The published vectors (NIST FIPS 180-4 example messages, RFC 4231 test cases 1 to 7) are
// hard-coded literals below, not derived from either implementation.
//
// Checks: fixture-oracle gate, NIST vectors (P1), RFC 4231 cases 1-7 (P2), random-bytes differential
// vs node:crypto across every padding residue (P3), HMAC differential across key lengths on both
// sides of the 64-byte block (P4), UTF-8 differential vs Buffer incl. surrogates (P5), totality over
// hostile inputs (P6), determinism (P7), output-shape sanity (P8), and the inlined-region
// byte-identity manual drift check against _sha256.bundle.mjs (P9, build spec Sec.4.2).
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-751-sha256-hmac-digest-demonstrator.proptest.mjs

import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-751-sha256-hmac-digest-demonstrator.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32, pickNasty, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-751-sha256-hmac-digest-demonstrator';
const HERE = dirname(fileURLToPath(import.meta.url));

const hexOf = (buf) => Buffer.from(buf).toString('hex');
// bytes are carried as hex strings throughout: the checkJs Buffer stub has no alloc()/from(array)
const repHex = (byte, n) => ((byte < 16 ? '0' : '') + byte.toString(16)).repeat(n);
const randHex = (rng, n) => { let s = ''; for (let i = 0; i < n; i++) { const b = Math.floor(rng() * 256); s += (b < 16 ? '0' : '') + b.toString(16); } return s; };
const fromHex = (h) => Buffer.from(h, 'hex');
const digestOf = (pp) => compute(pp).output_payload.digest_hex;

// ---- P1: NIST FIPS 180-4 example messages (literal expected values) -------------------------------
function checkP1_nist() {
  const cases = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu', 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
  ];
  let violations = 0;
  for (const [msg, want] of cases) {
    if (digestOf({ input: msg }) !== want) violations++;
    if (digestOf({ input: hexOf(Buffer.from(msg)), input_encoding: 'hex' }) !== want) violations++;
  }
  // the one-million-'a' message exceeds the kernel's declared 64 KiB bound and must be refused, not hashed
  const big = compute({ input: 'a'.repeat(1000000) }).output_payload;
  if (big.status !== 'rejected' || big.rejection_reason !== 'INPUT_TOO_LARGE') violations++;
  return { name: 'P1_nist_fips180_4_vectors', checked: cases.length * 2 + 1, violations };
}

// ---- P2: RFC 4231 test cases 1-7 (literal expected values; case 5 compares the 128-bit prefix) ------
function checkP2_rfc4231() {
  const asc = (s) => hexOf(Buffer.from(s));
  const cases = [
    [repHex(0x0b, 20), asc('Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'],
    [asc('Jefe'), asc('what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'],
    [repHex(0xaa, 20), repHex(0xdd, 50), '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe'],
    [Array.from({ length: 25 }, (_, i) => (i + 1 < 16 ? '0' : '') + (i + 1).toString(16)).join(''), repHex(0xcd, 50), '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b'],
    [repHex(0x0c, 20), asc('Test With Truncation'), 'a3b6167473100ee06e0c796c2955552b'],
    [repHex(0xaa, 131), asc('Test Using Larger Than Block-Size Key - Hash Key First'), '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54'],
    [repHex(0xaa, 131), asc('This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.'), '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2'],
  ];
  let violations = 0;
  for (const [key, data, want] of cases) {
    const got = digestOf({ mode: 'hmac_sha256', input: data, input_encoding: 'hex', key_hex: key });
    if (typeof got !== 'string' || !got.startsWith(want) || (want.length === 64 && got !== want)) violations++;
  }
  return { name: 'P2_rfc4231_cases_1_to_7', checked: cases.length, violations };
}

// ---- P3: random-bytes differential vs node:crypto across every padding residue ---------------------
function checkP3_shaDifferential() {
  const rng = mulberry32(751003);
  let checked = 0, violations = 0;
  for (let n = 0; n <= 300; n++) {
    const h = randHex(rng, n);
    checked++;
    const want = createHash('sha256').update(fromHex(h)).digest('hex');
    if (digestOf({ input: h, input_encoding: 'hex' }) !== want) violations++;
  }
  for (const n of [1000, 4096, 65535, 65536]) {
    const h = randHex(rng, n);
    checked++;
    if (digestOf({ input: h, input_encoding: 'hex' }) !== createHash('sha256').update(fromHex(h)).digest('hex')) violations++;
  }
  return { name: 'P3_sha256_differential_vs_node_crypto', checked, violations };
}

// ---- P4: HMAC differential across key lengths either side of the 64-byte block ----------------------
function checkP4_hmacDifferential() {
  const rng = mulberry32(751004);
  let checked = 0, violations = 0;
  const keyLens = [1, 2, 31, 32, 33, 63, 64, 65, 66, 100, 127, 128, 129, 200];
  for (const kl of keyLens) {
    for (let t = 0; t < 12; t++) {
      const key = randHex(rng, kl);
      const msg = randHex(rng, Math.floor(rng() * 200));
      checked++;
      const want = createHmac('sha256', fromHex(key)).update(fromHex(msg)).digest('hex');
      if (digestOf({ mode: 'hmac_sha256', input: msg, input_encoding: 'hex', key_hex: key }) !== want) violations++;
    }
  }
  return { name: 'P4_hmac_sha256_differential_vs_node_crypto', checked, violations };
}

// ---- P5: UTF-8 path differential vs Buffer (surrogate pairs, lone surrogates, 2/3/4-byte) -----------
function checkP5_utf8() {
  const rng = mulberry32(751005);
  const pool = ['a', 'Z', '0', ' ', 'é', 'ß', 'ࠀ', '世', '￿', '😀', '\ud800', '\udbff', '\udc00', '\udfff', '\u0000', '\u007f', '\u0080', '߿'];
  let checked = 0, violations = 0;
  for (let t = 0; t < 600; t++) {
    const len = Math.floor(rng() * 40);
    let s = '';
    for (let i = 0; i < len; i++) s += pool[Math.floor(rng() * pool.length)];
    checked++;
    const want = createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
    if (digestOf({ input: s }) !== want) violations++;
  }
  return { name: 'P5_utf8_encoder_differential_vs_buffer', checked, violations };
}

// ---- P6: totality over hostile inputs ---------------------------------------------------------------
function checkP6_totality() {
  const rng = mulberry32(751006);
  let checked = 0, violations = 0;
  const shapes = [undefined, null, {}, { input: null }, { input: [] }, { input: {} }, { mode: null, input: 'a' }, { mode: 5, input: 'a' },
    { input: 'a', input_encoding: null }, { mode: 'hmac_sha256', input: 'a', key_hex: 5 }, { mode: 'hmac_sha256', input: 'a', key_hex: '' }];
  for (let i = 0; i < 80; i++) shapes.push({ input: pickNasty(rng), mode: pickNasty(rng), input_encoding: pickNasty(rng), key_hex: pickNasty(rng) });
  for (const pp of shapes) {
    checked++;
    try {
      const r = compute(pp);
      const o = r && r.output_payload;
      if (!o || (o.status !== 'ok' && o.status !== 'rejected')) violations++;
      else if (o.status === 'rejected' && (o.digest_hex !== null || typeof o.rejection_reason !== 'string')) violations++;
      else if (o.status === 'ok' && !/^[0-9a-f]{64}$/.test(o.digest_hex)) violations++;
    } catch (e) {
      violations++;
    }
  }
  return { name: 'P6_totality_over_hostile_inputs', checked, violations };
}

// ---- P7: determinism -----------------------------------------------------------------------------
function checkP7_determinism() {
  const pps = [{ input: 'abc' }, { mode: 'hmac_sha256', input: 'abc', key_hex: '00ff' }, { input: 'zz', input_encoding: 'hex' }, {}];
  let violations = 0;
  for (const pp of pps) {
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    if (a !== b) violations++;
  }
  return { name: 'P7_determinism', checked: pps.length, violations };
}

// ---- P8: output-shape sanity ----------------------------------------------------------------------
function checkP8_shape() {
  let violations = 0, checked = 0;
  for (const pp of [{ input: 'abc' }, { mode: 'hmac_sha256', input: 'abc', key_hex: 'aa' }, { mode: 'nope', input: 'abc' }, {}]) {
    checked++;
    const r = compute(pp);
    violations += findShapeViolations(r).length;
    if (r.output_payload.algorithm_id !== 'sha-256') violations++;
    if (!r.compliance_flags || typeof r.compliance_flags !== 'object') violations++;
  }
  return { name: 'P8_output_shape_and_algorithm_id_echo', checked, violations };
}

// ---- P9: inlined region is byte-identical to the bundle (build spec Sec.4.2 manual drift check) -----
function checkP9_inlineIdentity() {
  const bundle = readFileSync(join(HERE, '..', '_sha256.bundle.mjs'), 'utf8');
  const kernel = readFileSync(join(HERE, '..', KERNEL_ID + '.kernel.mjs'), 'utf8');
  const marker = '\nexport const ALGORITHM_ID';
  const cut = bundle.indexOf(marker);
  let violations = 0;
  if (cut < 0 || bundle.indexOf(marker, cut + 1) !== -1) violations++;
  else if (!kernel.includes(bundle.slice(0, cut).trim())) violations++;
  return { name: 'P9_inlined_region_byte_identical_to_bundle', checked: 1, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
void deepEqual;
const properties = [
  checkP1_nist(),
  checkP2_rfc4231(),
  checkP3_shaDifferential(),
  checkP4_hmacDifferential(),
  checkP5_utf8(),
  checkP6_totality(),
  checkP7_determinism(),
  checkP8_shape(),
  checkP9_inlineIdentity(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
