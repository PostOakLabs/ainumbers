// art-599-gleif-snapshot-digest.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:0b3902db12128174f906bfc436ef14f2415464d9bd58aa2215b3e5e2d1be2a7b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class B -- SHA-256 hashing + ISO
// 17442 mod-97 check-digit arithmetic, integer-only). NOT a proof, NOT Dafny.
// float_sensitive: NO -- mod97() is integer modular arithmetic; the SHA-256 core is Uint32Array
// bitwise arithmetic. No IEEE-754 division or fractional comparison anywhere in compute().
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a differential
// re-derivation of the inlined SHA-256 against Node's own WebCrypto (P2 -- the kernel's own
// _sha256/_utf8Bytes exist ONLY because the zkVM guest lacks crypto.subtle/TextEncoder; this floor
// runs in plain Node, which HAS both, so it can differentially verify the inlined implementation
// against the real primitive it stands in for), the ISO 17442 mod-97 check-digit invariant enumerated
// over every remainder class 0..96 (P3, A-class-shaped bounded enumeration per the kernel's reused
// art-246 algorithm), a metamorphic determinism + single-byte-flip-changes-digest property (P4), and
// forced categorical boundary cases (P5: empty source_text, LastUpdateDate extraction precedence over
// caller_last_update_date, malformed LEI shapes).

import { compute } from '../art-599-gleif-snapshot-digest.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-599-gleif-snapshot-digest.fixtures.json');
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
const rand = mulberry32(0x599D169);
function randAscii(rng, n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(33 + Math.floor(rng() * 90)); return s; }

// ---------- P1: totality ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { source_text: '' }, { source_text: 123 }, { lei: null }, { lei: 'too-short' },
    { lei: '!!!!!!!!!!!!!!!!!!!!' }, { source_format: 'bogus' },
    { source_text: '<LEIRecord></LEIRecord>' },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (typeof o.snapshot_captured !== 'boolean') violations++;
    if (typeof o.source_format !== 'string') violations++;
    if (!Array.isArray(out.compliance_flags)) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: differential — inlined SHA-256 vs Node WebCrypto (the primitive it stands in for) ----------
async function checkP2_differential_sha256_vs_webcrypto() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 60; i++) {
    checked++;
    const text = i === 0 ? '' : randAscii(rand, 1 + Math.floor(rand() * 200));
    const { output_payload: o } = compute({ source_text: text });
    const expectedBytes = new TextEncoder().encode(text);
    const expectedDigest = expectedBytes.length > 0
      ? Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', expectedBytes))).map((b) => b.toString(16).padStart(2, '0')).join('')
      : null;
    if (o.source_sha256 !== expectedDigest) violations++;
  }
  // non-ASCII / surrogate-pair coverage (the kernel's _utf8Bytes hand-rolls surrogate handling)
  const unicodeSamples = ['héllo wörld', '中文测试', '🌍🚀', 'a😀b'];
  for (const text of unicodeSamples) {
    checked++;
    const { output_payload: o } = compute({ source_text: text });
    const expectedDigest = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (o.source_sha256 !== expectedDigest) violations++;
  }
  return { name: 'P2_differential_inlined_sha256_vs_node_webcrypto', trials: checked, violations };
}

// ---------- P3: A-class-shaped bounded enumeration — ISO 17442 mod-97 check digit over every
// remainder class 0..96, confirming exactly remainder==1 is accepted (the algorithm's defining
// invariant, per the kernel's own reused art-246 implementation) ----------
function checkP3_enumeration_mod97_boundary() {
  let violations = 0, checked = 0;
  // Fixed 18-char numeric-alpha prefix + 2 check digits swept 00..99 covers every remainder 0..96
  // multiple times (mod 97 over ~1.4e29 possible 18-char prefixes is not exhaustively enumerable,
  // but sweeping the trailing 2 digits against a FIXED valid prefix enumerates every remainder the
  // check digit space can produce for that prefix — the A-class-shaped cheap invariant this floor
  // spec section 3 calls for, not a full-domain claim).
  const prefix = '549300ABCDEFGHIJK'; // 17 chars + we append 1 digit + 2 check digits = 20
  for (let cd = 0; cd <= 99; cd++) {
    checked++;
    const candidate = prefix + '1' + String(cd).padStart(2, '0');
    const { output_payload: o } = compute({ lei: candidate });
    // valid iff mod-97 remainder is exactly 1 -- re-derive independently via the same reused algorithm
    // shape (integer arithmetic, digit-by-digit), not by importing the kernel's function.
    const charDigits = candidate.split('').map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 48 && code <= 57) return c;
      if (code >= 65 && code <= 90) return String(code - 55);
      return '';
    }).join('');
    let remainder = 0;
    for (let i = 0; i < charDigits.length; i++) remainder = (remainder * 10 + Number(charDigits[i])) % 97;
    const expectedValid = remainder === 1;
    if (o.lei_checksum_valid !== expectedValid) violations++;
  }
  return { name: 'P3_enumeration_mod97_check_digit_boundary_sweep', trials: checked, violations };
}

// ---------- P4: metamorphic — determinism, single-byte-flip changes digest, LEI trimmed/uppercased ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 100; i++) {
    checked++;
    const text = randAscii(rand, 10 + Math.floor(rand() * 50));
    const pp = { source_text: text };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;

    // flip one character -> digest must change
    const idx = Math.floor(rand() * text.length);
    const tampered = text.slice(0, idx) + String.fromCharCode((text.charCodeAt(idx) + 1) % 128 || 33) + text.slice(idx + 1);
    if (tampered !== text) {
      const t = compute({ source_text: tampered }).output_payload;
      if (t.source_sha256 === a.source_sha256) violations++;
    }
  }
  // LEI case/whitespace normalization: lowercase and padded input must normalize to the same result
  // as the canonical uppercase trimmed form.
  const validLei = '5493001KJTIIGC8Y1R12';
  { checked++;
    const canon = compute({ lei: validLei }).output_payload;
    const lower = compute({ lei: '  ' + validLei.toLowerCase() + '  ' }).output_payload;
    if (canon.lei !== lower.lei) violations++;
    if (canon.lei_checksum_valid !== lower.lei_checksum_valid) violations++; }
  return { name: 'P4_metamorphic_determinism_tamper_changes_digest_lei_normalization', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty source_text -> no snapshot captured, null digest
  { checked++;
    const { output_payload: o } = compute({ source_text: '' });
    if (o.snapshot_captured !== false) violations++;
    if (o.source_sha256 !== null) violations++; }
  // XML LastUpdateDate extraction takes precedence over caller_last_update_date
  { checked++;
    const xml = '<LEIRecord><Registration><LastUpdateDate>2026-01-01T00:00:00.000Z</LastUpdateDate></Registration></LEIRecord>';
    const { output_payload: o } = compute({ source_text: xml, last_update_date: '2020-01-01' });
    if (o.last_update_date !== '2026-01-01T00:00:00.000Z') violations++;
    if (o.last_update_date_source !== 'record_xml') violations++; }
  // no XML element present -> falls back to caller_supplied
  { checked++;
    const { output_payload: o } = compute({ source_text: 'plain csv text', last_update_date: '2020-01-01' });
    if (o.last_update_date !== '2020-01-01') violations++;
    if (o.last_update_date_source !== 'caller_supplied') violations++; }
  // empty LEI -> null, not false/error
  { checked++;
    const { output_payload: o } = compute({ lei: '' });
    if (o.lei !== null) violations++;
    if (o.lei_checksum_valid !== null) violations++; }
  // wrong-length LEI -> false, not null
  { checked++;
    const { output_payload: o } = compute({ lei: '12345' });
    if (o.lei_checksum_valid !== false) violations++; }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(await checkP2_differential_sha256_vs_webcrypto());
results.properties.push(checkP3_enumeration_mod97_boundary());
results.properties.push(checkP4_metamorphic());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-599-gleif-snapshot-digest',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
