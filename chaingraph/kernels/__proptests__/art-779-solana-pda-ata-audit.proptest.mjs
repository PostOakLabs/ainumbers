// @ts-nocheck — floor file: node:crypto/Buffer reference section needs it (precedent _rca-01-detmath-snapshot.mjs).
// art-779-solana-pda-ata-audit property-test floor.
// kernel_digest_at_authoring: sha256:cefd23d3e42426f406a46d4672b972845e648d1e31792f91d42a01e132763444
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md section 3. Shape:
//   - Fixture-oracle gate (GATES the exit code): every fixture vector's spec_pins are resolved
//     against the kernel's compute() result. The corpus is anchored on the three PDA addresses
//     PUBLISHED in the pinned primary text itself (solana-labs/solana at
//     7700cb3128c1f19820de67b81aa45d18f73d2ac0, sdk/program/src/pubkey.rs test_create_program_address
//     L892-930), so it is not a round-trip self-test.
//   - P1 independent reference: a full find/create_program_address reimplementation written here
//     from the pinned clause text, using node:crypto SHA-256 and a separately structured BigInt
//     Ed25519 decompression (mod-p arithmetic, no noble), plus its own base58. Anchored against
//     the three published goldens, then compared with the kernel over randomized tuples
//     (derived hash, on/off-curve, canonical bump and address, claimed_matches).
//   - P2 canonical invariants: canonical_address equals the recomputation at canonical_bump;
//     every bump above canonical up to 255 is on-curve (checked over a window above the
//     canonical bump); claimed_bump_is_canonical is exactly (bump === canonical_bump).
//   - P3 substitution property: the first off-curve bump below the canonical one (within a
//     window) yields a second valid address DIFFERENT from the canonical address: the
//     substitution class the node exists to expose.
//   - P4 refusal matrix: every named refusal fires with its exact error string, INPUT_REFUSED
//     flag, a domain_errors entry and a detail naming the offending field; every refusal leaves
//     every audit output null.
//   - P5 flag order and ATA grid: the multi-flag order is pinned exactly, and the ATA block is
//     exercised across declared program ids (Token-2022, classic, other) asserting the
//     mismatch boolean and the side-by-side addresses.
//   - P6 determinism: identical pp in, byte-identical result out, twice.
// float:no — no floating point anywhere. ZERO external dependencies — pure Node built-ins.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-779-solana-pda-ata-audit.proptest.mjs

import { compute } from '../art-779-solana-pda-ata-audit.kernel.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const P = (1n << 255n) - 19n;
const ED_D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
const BPF = 'BPFLoaderUpgradeab1e11111111111111111111111';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const CLASSIC = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ANY_ADDR = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'; // well-known on-curve address, used as a pasted value

// ---------------------------------------------------------------- reference implementation
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function refB58d(str) {
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const val = [];
  let m = 0n; for (let i = zeros; i < str.length; i++) { const c = B58.indexOf(str[i]); if (c < 0) throw new Error('bad b58'); m = m * 58n + BigInt(c); }
  while (m > 0n) { val.unshift(Number(m & 0xffn)); m >>= 8n; }
  if (val.length === 1 && val[0] === 0) val.length = 0;
  return Buffer.concat([Buffer.alloc(zeros), Buffer.from(val)]);
}
function refB58e(buf) {
  let n = 0n; for (const b of buf) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  let zeros = 0; while (zeros < buf.length && buf[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + s;
}
function mod(a) { const r = a % P; return r < 0n ? r + P : r; }
function modPow(b, e) { let r = 1n, bb = mod(b); while (e > 0n) { if (e & 1n) r = mod(r * bb); bb = mod(bb * bb); e >>= 1n; } return r; }
function refOnCurve(b) {
  // y is the low 255 bits little-endian (the 0x80 bit of byte 31 is the x parity, not part of y).
  // The sign bit never affects whether the encoding decompresses. A masked y >= p is
  // non-canonical and rejected by the strict parser the kernel uses; such hashes are
  // statistically unreachable (probability ~2^-129) and are asserted equal in both paths
  // whenever they occur in the sweeps.
  let y = 0n; for (let i = 0; i < 31; i++) y |= BigInt(b[i]) << BigInt(8 * i);
  y |= BigInt(b[31] & 0x7f) << 248n;
  if (y >= P) return false;
  const num = mod(y * y - 1n), den = mod(ED_D * y * y + 1n);
  const xx = mod(num * modPow(den, P - 2n));
  return modPow(xx, (P - 1n) / 2n) === 1n;
}
function refHash(seedBufs, bump, progBuf) {
  const parts = [...seedBufs, Buffer.from([bump]), progBuf, Buffer.from('ProgramDerivedAddress')];
  return createHash('sha256').update(Buffer.concat(parts)).digest();
}
function refFind(seedBufs, progBuf) {
  for (let bump = 255; bump >= 1; bump--) {
    const h = refHash(seedBufs, bump, progBuf);
    if (!refOnCurve(h)) return { bump, address: refB58e(h) };
  }
  return null;
}

// ---------------------------------------------------------------- fixture oracle
function getPath(root, key) {
  const parts = key.replace(/\]/g, '').split(/[.[]/).filter(Boolean);
  let cur = root;
  for (const p of parts) { if (cur === null || cur === undefined) return undefined; cur = cur[p]; }
  return cur;
}
function fixtureOracle() {
  const fxPath = path.resolve(__dirname, '..', 'fixtures', 'art-779-solana-pda-ata-audit.fixtures.json');
  const doc = JSON.parse(readFileSync(fxPath, 'utf8'));
  const violations = [];
  let checked = 0;
  for (const v of doc.vectors) {
    const r = compute(v.policy_parameters);
    const root = { ...r, ...r.output_payload };
    for (const [key, expected] of Object.entries(v.spec_pins || {})) {
      const got = getPath(root, key);
      if (JSON.stringify(got) !== JSON.stringify(expected)) violations.push(`${v.name}: ${key} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`);
      checked++;
    }
  }
  return { name: 'fixture_oracle', vectors: doc.vectors.length, pins: checked, violations: violations.slice(0, 8), detail: violations };
}

// ---------------------------------------------------------------- P1: reference equivalence
// Deterministic PRNG (xorshift64) so the run is reproducible.
let seed = 0x5eed1a2b3c4d5e6fn;
const U64M = (1n << 64n) - 1n;
function rnd() { seed ^= seed << 13n; seed &= U64M; seed ^= seed >> 7n; seed ^= seed << 17n; seed &= U64M; return seed; }
function rndSeedStr() { const n = Number(rnd() % 9n); let s = 's'; for (let i = 0; i < n; i++) s += String.fromCharCode(97 + Number(rnd() % 26n)); return s; }

function checkP1() {
  const violations = [];
  // anchor the reference itself on the published goldens first
  const anchor = [
    { seeds: [''], bump: 1, want: 'BwqrghZA2htAcqq8dzP1WDAhTXYTYWj7CHxF5j7TDBAe' },
    { seeds: ['\u2609'], bump: 0, want: '13yWmRpaTR4r5nAktwLqMpRNr28tnVUZw26rTvPSSB19' },
    { seeds: [refB58d('SeedPubey1111111111111111111111111111111111')], bump: 1, want: '976ymqVnfE32QFe6NfGDctSvVa36LWnvYxhU6G2232YL' },
  ];
  const progB = refB58d(BPF);
  for (const a of anchor) {
    const h = refHash(a.seeds.map((s) => (typeof s === 'string' ? Buffer.from(s, 'utf8') : s)), a.bump, progB);
    if (refB58e(h) !== a.want) violations.push(`P1 anchor broken: ${refB58e(h)} != ${a.want}`);
  }
  // randomized equivalence
  for (let t = 0; t < 40; t++) {
    const nSeeds = Number(rnd() % 3n);
    const seeds = [];
    const seedBufs = [];
    for (let i = 0; i < nSeeds; i++) { const s = rndSeedStr() + i; seeds.push({ data: s, encoding: 'utf8' }); seedBufs.push(Buffer.from(s, 'utf8')); }
    const bump = Number(rnd() % 256n);
    const refHashAt = refHash(seedBufs, bump, progB);
    const refCanonical = refFind(seedBufs, progB);
    const claimed = refB58e(refHashAt); // claim exactly the recomputation; matches must be true
    const r = compute({ program_id: BPF, seeds, bump, claimed_address: claimed });
    const o = r.output_payload;
    if (o.derived_hash_base58 !== refB58e(refHashAt)) violations.push(`P1 derived t=${t}`);
    if (o.on_curve !== refOnCurve(refHashAt)) violations.push(`P1 on_curve t=${t}`);
    if (o.claimed_matches !== true) violations.push(`P1 claimed_matches t=${t}`);
    if (o.canonical_bump !== (refCanonical === null ? null : refCanonical.bump)) violations.push(`P1 canonical bump t=${t}`);
    if (o.canonical_address !== (refCanonical === null ? null : refCanonical.address)) violations.push(`P1 canonical address t=${t}`);
    if (o.claimed_bump_is_canonical !== (refCanonical === null ? null : refCanonical.bump === bump)) violations.push(`P1 canonicality bool t=${t}`);
    // reference agreement on the flag that matters most
    const wantNonCanonical = refCanonical !== null && refCanonical.bump !== bump;
    if (r.compliance_flags.includes('NON_CANONICAL_BUMP_CLAIMED') !== wantNonCanonical) violations.push(`P1 flag t=${t}`);
  }
  return { name: 'P1_reference_equivalence', cases: 40 + anchor.length, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------------------------------------------------------------- P2: canonical invariants
function checkP2() {
  const violations = [];
  for (let t = 0; t < 12; t++) {
    const s = rndSeedStr() + t;
    const seeds = [{ data: s, encoding: 'utf8' }];
    const r = compute({ program_id: BPF, seeds, bump: 1, claimed_address: ANY_ADDR });
    const o = r.output_payload;
    if (o.canonical_bump === null) { violations.push(`P2 no canonical for t=${t}`); continue; }
    // canonical address == recomputation at the canonical bump
    const at = compute({ program_id: BPF, seeds, bump: o.canonical_bump, claimed_address: ANY_ADDR });
    if (at.output_payload.derived_hash_base58 !== o.canonical_address) violations.push(`P2 canonical address mismatch t=${t}`);
    if (at.output_payload.on_curve !== false) violations.push(`P2 canonical bump on-curve t=${t}`);
    // every bump above the canonical one (window of 12) is on-curve: definitional
    for (let b = o.canonical_bump + 1; b <= Math.min(255, o.canonical_bump + 12); b++) {
      const rb = compute({ program_id: BPF, seeds, bump: b, claimed_address: ANY_ADDR });
      if (rb.output_payload.on_curve !== true) violations.push(`P2 bump ${b} above canonical ${o.canonical_bump} not on-curve t=${t}`);
    }
    // canonicality boolean is exactly equality with the canonical bump
    for (const b of [o.canonical_bump, o.canonical_bump === 0 ? 1 : 0, 255]) {
      const rb = compute({ program_id: BPF, seeds, bump: b, claimed_address: ANY_ADDR });
      if (rb.output_payload.claimed_bump_is_canonical !== (b === o.canonical_bump)) violations.push(`P2 canonicality bool b=${b} t=${t}`);
    }
  }
  return { name: 'P2_canonical_invariants', cases: 12, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------------------------------------------------------------- P3: substitution property
function checkP3() {
  const violations = [];
  let substitutionCases = 0;
  for (let t = 0; t < 12; t++) {
    const s = rndSeedStr() + 'x' + t;
    const seeds = [{ data: s, encoding: 'utf8' }];
    const base = compute({ program_id: BPF, seeds, bump: 255, claimed_address: ANY_ADDR });
    const cb = base.output_payload.canonical_bump;
    if (cb === null || cb <= 1) continue;
    for (let b = cb - 1; b >= Math.max(1, cb - 12); b--) {
      const rb = compute({ program_id: BPF, seeds, bump: b, claimed_address: ANY_ADDR });
      if (rb.output_payload.on_curve === true) continue;
      // second valid address, different from canonical
      if (rb.output_payload.derived_hash_base58 === base.output_payload.canonical_address) violations.push(`P3 second address equals canonical t=${t} b=${b}`);
      if (rb.output_payload.claimed_bump_is_canonical !== false) violations.push(`P3 non-canonical bump marked canonical t=${t} b=${b}`);
      if (!rb.compliance_flags.includes('NON_CANONICAL_BUMP_CLAIMED')) violations.push(`P3 missing substitution flag t=${t} b=${b}`);
      substitutionCases++;
      break;
    }
  }
  if (substitutionCases === 0) violations.push('P3 found no substitution case (unexpected: probability ~1 per seed)');
  return { name: 'P3_substitution_class', cases: substitutionCases, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------------------------------------------------------------- P4: refusal matrix
const REFUSAL_CASES = [
  { name: 'program_id_empty', pp: { program_id: '', seeds: [], bump: 1, claimed_address: ANY_ADDR }, code: 'PROGRAM_ID_INVALID', field: 'program_id' },
  { name: 'program_id_not_32_bytes', pp: { program_id: 'abc', seeds: [], bump: 1, claimed_address: ANY_ADDR }, code: 'PROGRAM_ID_INVALID', field: 'program_id' },
  { name: 'seeds_not_array', pp: { program_id: BPF, seeds: {}, bump: 1, claimed_address: ANY_ADDR }, code: 'SEEDS_MALFORMED', field: 'seeds' },
  { name: 'seed_encoding_unknown', pp: { program_id: BPF, seeds: [{ data: 'aa', encoding: 'base64' }], bump: 1, claimed_address: ANY_ADDR }, code: 'SEEDS_MALFORMED', field: 'encoding' },
  { name: 'seed_data_number', pp: { program_id: BPF, seeds: [{ data: 7, encoding: 'utf8' }], bump: 1, claimed_address: ANY_ADDR }, code: 'SEEDS_MALFORMED', field: 'data' },
  { name: 'bump_float', pp: { program_id: BPF, seeds: [], bump: 1.5, claimed_address: ANY_ADDR }, code: 'BUMP_INVALID', field: 'bump' },
  { name: 'bump_negative', pp: { program_id: BPF, seeds: [], bump: -1, claimed_address: ANY_ADDR }, code: 'BUMP_INVALID', field: 'bump' },
  { name: 'bump_string', pp: { program_id: BPF, seeds: [], bump: '254', claimed_address: ANY_ADDR }, code: 'BUMP_INVALID', field: 'bump' },
  { name: 'claimed_address_not_base58', pp: { program_id: BPF, seeds: [], bump: 1, claimed_address: '0OIl' }, code: 'CLAIMED_ADDRESS_INVALID', field: 'claimed_address' },
  { name: 'claimed_address_short', pp: { program_id: BPF, seeds: [], bump: 1, claimed_address: 'BwqrghZA2htAcqq8dzP1WDAhTXYTYWj7CHxF5j7TDB' }, code: 'CLAIMED_ADDRESS_INVALID', field: 'claimed_address' },
  { name: 'ata_wallet_only', pp: { program_id: BPF, seeds: [], bump: 1, claimed_address: ANY_ADDR, wallet: ANY_ADDR }, code: 'ATA_TRIPLE_MALFORMED', field: 'wallet' },
  { name: 'ata_mint_bad', pp: { program_id: BPF, seeds: [], bump: 1, claimed_address: ANY_ADDR, wallet: ANY_ADDR, mint: 'zzz', token_program_id: T22 }, code: 'ATA_TRIPLE_MALFORMED', field: 'mint' },
];
function checkP4_refusalMatrix() {
  const violations = [];
  for (const c of REFUSAL_CASES) {
    const r = compute(c.pp);
    const o = r.output_payload;
    if (o.error !== c.code.toLowerCase()) violations.push(`${c.name}: error got ${o.error}`);
    if (!Array.isArray(o.domain_errors) || o.domain_errors[0]?.code !== c.code) violations.push(`${c.name}: domain_errors code`);
    if (typeof o.detail !== 'string' || !o.detail.includes(c.field)) violations.push(`${c.name}: detail must name ${c.field}, got ${JSON.stringify(o.detail)}`);
    if (JSON.stringify(r.compliance_flags) !== '["INPUT_REFUSED"]') violations.push(`${c.name}: flags ${JSON.stringify(r.compliance_flags)}`);
    for (const k of ['derived_hash_base58', 'claimed_matches', 'canonical_bump', 'canonical_address', 'claimed_bump_is_canonical', 'ata_derivation']) {
      if (o[k] !== null && o[k] !== undefined) violations.push(`${c.name}: refusal left ${k} non-null`);
    }
  }
  return { name: 'P4_refusal_matrix', cases: REFUSAL_CASES.length, violations: violations.length, detail: violations.slice(0, 6) };
}

// ---------------------------------------------------------------- P5: flag order + ATA grid
function checkP5() {
  const violations = [];
  // multi-flag order: length limit (33-byte seed), on-curve, mismatch, non-canonical
  const longHex = '00'.repeat(33);
  const r5 = compute({ program_id: BPF, seeds: [{ data: longHex, encoding: 'hex' }], bump: 255, claimed_address: ANY_ADDR });
  if (JSON.stringify(r5.compliance_flags) !== JSON.stringify(['SEED_LENGTH_EXCEEDS_MAX'])) violations.push(`P5 length-only: ${JSON.stringify(r5.compliance_flags)}`);
  // on-curve + mismatch + non-canonical together (oc0 at 255, claimed some other address)
  const oc = compute({ program_id: BPF, seeds: [{ data: 'oc0', encoding: 'utf8' }], bump: 255, claimed_address: ANY_ADDR });
  const wantOc = ['CLAIMED_BUMP_ON_CURVE', 'CLAIMED_ADDRESS_MISMATCH', 'NON_CANONICAL_BUMP_CLAIMED'];
  if (JSON.stringify(oc.compliance_flags) !== JSON.stringify(wantOc)) violations.push(`P5 on-curve order: ${JSON.stringify(oc.compliance_flags)}`);
  // ATA grid across declared program ids
  const W = ANY_ADDR, M = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  for (const [prog, isT22] of [[T22, true], [CLASSIC, false], [BPF, false]]) {
    const r = compute({ program_id: BPF, seeds: [{ data: 'vault', encoding: 'utf8' }], bump: 254, claimed_address: ANY_ADDR, wallet: W, mint: M, token_program_id: prog });
    const ata = r.output_payload.ata_derivation;
    if (!ata) { violations.push('P5 ata missing'); continue; }
    if (ata.declared_token_program_is_token_2022 !== isT22) violations.push(`P5 t22 bool for ${prog}`);
    const classic = refFind([refB58d(W), refB58d(CLASSIC), refB58d(M)], refB58d(ATA_PROGRAM));
    const declared = refFind([refB58d(W), refB58d(prog), refB58d(M)], refB58d(ATA_PROGRAM));
    if (ata.ata_under_classic_token_program.address !== classic.address) violations.push(`P5 classic ata for ${prog}`);
    if (ata.ata_under_declared_token_program.address !== declared.address) violations.push(`P5 declared ata for ${prog}`);
    const wantMismatch = isT22 && declared.address !== classic.address;
    if (ata.token_program_mismatch !== wantMismatch) violations.push(`P5 mismatch bool for ${prog}`);
    if (r.compliance_flags.includes('TOKEN_PROGRAM_MISMATCH') !== wantMismatch) violations.push(`P5 mismatch flag for ${prog}`);
  }
  // no ATA triple: ata_derivation null, no ATA flags
  const rno = compute({ program_id: BPF, seeds: [{ data: 'vault', encoding: 'utf8' }], bump: 254, claimed_address: 'HbSEsJZ7N5uN1mEBaVuFVMXDARHcq4e4AmPoWDQbgrzq' });
  if (rno.output_payload.ata_derivation !== null) violations.push('P5 ata must be null without the triple');
  return { name: 'P5_flag_order_and_ata_grid', cases: 8, violations: violations.length, detail: violations.slice(0, 6) };
}

// ---------------------------------------------------------------- P6: determinism
function checkP6() {
  const pp = {
    program_id: BPF,
    seeds: [{ data: 'vault', encoding: 'utf8' }, { data: '00ff', encoding: 'hex' }],
    bump: 254,
    claimed_address: 'HbSEsJZ7N5uN1mEBaVuFVMXDARHcq4e4AmPoWDQbgrzq',
    wallet: ANY_ADDR,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    token_program_id: T22,
  };
  const a = JSON.stringify(compute(pp));
  const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
  return { name: 'P6_determinism', cases: 1, violations: a === b ? 0 : 1, detail: a === b ? [] : ['P6 two runs differ'] };
}

// ---------------------------------------------------------------- run
const oracle = fixtureOracle();
const oracleOk = oracle.violations.length === 0;
results.fixture_oracle = { name: oracle.name, vectors: oracle.vectors, pins: oracle.pins, violations: oracle.violations.length };
results.properties.push(checkP1());
results.properties.push(checkP2());
results.properties.push(checkP3());
results.properties.push(checkP4_refusalMatrix());
results.properties.push(checkP5());
results.properties.push(checkP6());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
console.log(JSON.stringify({
  tool: 'art-779-solana-pda-ata-audit',
  fixture_oracle: results.fixture_oracle,
  properties: results.properties,
  verdict: (oracleOk && !anyPropertyViolation) ? 'GREEN' : 'RED',
}, null, 1));

process.exit(oracleOk && !anyPropertyViolation ? 0 : 1);
