// 829-safe-tx-hash-recompute — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:60f4ab23d5ec5710081df25793e9ee65e04141114c12d370882a8cc288a54397
// spec: research/SAFE-TX-PIN-2026-11.md (typehashes sections 2, selector table section 3)
// human_sign_off: PENDING
//
// The Safe repository publishes no fixed 32-byte hash vectors (pin section 4), so the oracle here is
// an INDEPENDENT second implementation: a compact BigInt Keccak-f[1600] written in this file that shares
// no code with the kernel's vendored noble bundle, applied to the layout read from the pinned
// Safe.sol / GnosisSafe.sol encodeTransactionData bodies. The two Safe-sourced fixed constants (the
// DOMAIN_SEPARATOR_TYPEHASH and SAFE_TX_TYPEHASH) are asserted verbatim. Fixture vectors are
// self-generated and labelled as such in the fixtures file.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/829-safe-tx-hash-recompute.proptest.mjs

import { compute } from '../829-safe-tx-hash-recompute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '829-safe-tx-hash-recompute';

// ---------- independent Keccak-256 (original padding 0x01, not SHA3) ----------
const M64 = (1n << 64n) - 1n;
const RC = [];
{
  let r = 1;
  for (let i = 0; i < 24; i++) {
    let c = 0n;
    for (let j = 0; j < 7; j++) {
      if (r & 1) c |= 1n << BigInt((1 << j) - 1);
      r = (r << 1) ^ ((r & 0x80) ? 0x171 : 0);
    }
    RC.push(c);
  }
}
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const rotl = (x, n) => n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64;
function f1600(s) {
  for (let round = 0; round < 24; round++) {
    const C = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) s[x + 5 * y] ^= D;
    }
    const B = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5 * y] = B[x + 5 * y] ^ ((B[((x + 1) % 5) + 5 * y] ^ M64) & B[((x + 2) % 5) + 5 * y]);
    s[0] ^= RC[round];
  }
}
function keccak256(bytes) {
  const rate = 136;
  const p = Array.from(bytes);
  p.push(0x01);
  while (p.length % rate !== 0) p.push(0);
  p[p.length - 1] |= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < p.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(p[off + 8 * i + b]);
      s[i] ^= lane;
    }
    f1600(s);
  }
  const out = [];
  for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out.push(Number((s[i] >> BigInt(8 * b)) & 0xffn));
  return Uint8Array.from(out);
}
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const utf8 = (s) => new TextEncoder().encode(s);
const fromHex = (h) => {
  const s = h.replace(/^0x/, '');
  const out = [];
  for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16));
  return Uint8Array.from(out);
};
const cat = (...a) => { const o = []; for (const x of a) o.push(...x); return Uint8Array.from(o); };
const word = (n) => fromHex(BigInt(n).toString(16).padStart(64, '0'));
const addrWord = (a) => fromHex(a.replace(/^0x/, '').padStart(64, '0'));

const SAFE_DOMAIN_TH = '47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218';
const SAFE_TX_TH = 'bb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';

function refHashes(p) {
  const dth = keccak256(utf8('EIP712Domain(uint256 chainId,address verifyingContract)'));
  const sth = keccak256(utf8('SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)'));
  const dom = keccak256(cat(dth, word(p.chainId), addrWord(p.safe)));
  const msg = keccak256(cat(sth, addrWord(p.to), word(p.value), keccak256(fromHex(p.data || '0x')), word(p.operation), word(p.safeTxGas), word(p.baseGas), word(p.gasPrice), addrWord(p.gasToken), addrWord(p.refundReceiver), word(p.nonce)));
  const fin = keccak256(cat(Uint8Array.from([0x19, 0x01]), dom, msg));
  return { dth: hex(dth), sth: hex(sth), dom: '0x' + hex(dom), msg: '0x' + hex(msg), fin: '0x' + hex(fin) };
}

const Z = '0x0000000000000000000000000000000000000000';
const BASE = { version: '1.3.0', chainId: 1, safe: '0x1111111111111111111111111111111111111111', to: '0x2222222222222222222222222222222222222222', value: '0', data: '0x', operation: 0, safeTxGas: 0, baseGas: 0, gasPrice: 0, gasToken: Z, refundReceiver: Z, nonce: 0 };

const SIGS = [
  ['transfer(address,uint256)', 'token'], ['approve(address,uint256)', 'approval'], ['transferFrom(address,address,uint256)', 'token'],
  ['setApprovalForAll(address,bool)', 'approval'], ['addOwnerWithThreshold(address,uint256)', 'admin'], ['removeOwner(address,address,uint256)', 'admin'],
  ['swapOwner(address,address,address)', 'admin'], ['changeThreshold(uint256)', 'admin'], ['enableModule(address)', 'admin'],
  ['setGuard(address)', 'admin'], ['setFallbackHandler(address)', 'admin'],
];

function randHex(rng, bytes) { let s = ''; for (let i = 0; i < bytes; i++) s += Math.floor(rng() * 256).toString(16).padStart(2, '0'); return s; }
function randUint(rng) { return BigInt('0x' + randHex(rng, 1 + Math.floor(rng() * 32))); }
function randCase(rng) {
  const data = rng() < 0.3 ? '0x' : '0x' + randHex(rng, Math.floor(rng() * 200));
  return {
    version: ['1.3.0', '1.4.1', '1.5.0'][Math.floor(rng() * 3)], chainId: randUint(rng).toString(), safe: '0x' + randHex(rng, 20), to: '0x' + randHex(rng, 20),
    value: randUint(rng).toString(), data, operation: rng() < 0.5 ? 0 : 1, safeTxGas: randUint(rng).toString(), baseGas: randUint(rng).toString(),
    gasPrice: randUint(rng).toString(), gasToken: rng() < 0.5 ? Z : '0x' + randHex(rng, 20), refundReceiver: rng() < 0.5 ? Z : '0x' + randHex(rng, 20), nonce: randUint(rng).toString(),
  };
}

const rng = mulberry32(0x5afe807);

function checkPinnedTypehashes() {
  const r = refHashes(BASE);
  const out = compute(BASE).output_payload;
  const v = Number(r.dth !== SAFE_DOMAIN_TH) + Number(r.sth !== SAFE_TX_TH) + Number(out.domain_typehash !== '0x' + SAFE_DOMAIN_TH) + Number(out.safe_tx_typehash !== '0x' + SAFE_TX_TH);
  return { name: 'safe_sourced_typehash_constants_match', checked: 4, violations: v };
}

function checkIndependentHashParity() {
  let v = 0; const N = 150;
  for (let i = 0; i < N; i++) {
    const p = randCase(rng);
    const o = compute(p).output_payload;
    const r = refHashes(p);
    if (o.verdict !== 'HASH_COMPUTED' || o.domain_hash !== r.dom || o.message_hash !== r.msg || o.safe_tx_hash !== r.fin) v++;
  }
  return { name: 'independent_keccak_parity_domain_message_safeTxHash', checked: N, violations: v };
}

function checkSelectorTable() {
  let v = 0; let n = 0;
  for (const [sig, cls] of SIGS) {
    const sel = '0x' + hex(keccak256(utf8(sig)).slice(0, 4));
    const nargs = sig.split(',').length - (sig.endsWith('()') ? 1 : 0);
    let args = '';
    for (let i = 0; i < nargs; i++) args += sig.split('(')[1].replace(')', '').split(',')[i] === 'address' ? '0'.repeat(24) + '4'.repeat(40) : '0'.repeat(63) + '1';
    const o = compute({ ...BASE, to: BASE.safe, data: sel + args }).output_payload;
    n++;
    const ok = o.decoded_call.status === 'decoded' && o.decoded_call.selector === sel && o.decoded_call.signature === sig;
    const clsOk = cls === 'admin' ? o.risk_flags.includes('ADMIN_CALL_ON_SAFE') : cls === 'approval' ? o.risk_flags.includes('TOKEN_APPROVAL') : true;
    if (!ok || !clsOk) v++;
  }
  const ms = '0x' + hex(keccak256(utf8('multiSend(bytes)')).slice(0, 4));
  const m = compute({ ...BASE, operation: 1, data: ms + '00'.repeat(64) }).output_payload;
  n++;
  if (m.decoded_call.selector !== ms || !m.risk_flags.includes('MULTISEND_NESTED_NOT_DECODED') || !m.risk_flags.includes('DELEGATECALL')) v++;
  return { name: 'selector_table_matches_independent_keccak_and_flags_fire', checked: n, violations: v };
}

function checkDelegatecallFlag() {
  let v = 0; const N = 60;
  for (let i = 0; i < N; i++) {
    const p = randCase(rng);
    const o = compute(p).output_payload;
    if (o.risk_flags.includes('DELEGATECALL') !== (p.operation === 1)) v++;
  }
  return { name: 'delegatecall_flag_iff_operation_1', checked: N, violations: v };
}

function checkUnknownSelectorNeverCleared() {
  let v = 0; const N = 60;
  const known = new Set(SIGS.map(([s]) => hex(keccak256(utf8(s)).slice(0, 4))));
  for (let i = 0; i < N; i++) {
    const sel = randHex(rng, 4);
    if (known.has(sel) || sel === hex(keccak256(utf8('multiSend(bytes)')).slice(0, 4))) continue;
    const o = compute({ ...BASE, data: '0x' + sel + randHex(rng, 32) }).output_payload;
    if (o.decoded_call.status !== 'not_decoded' || !o.risk_flags.includes('CALL_NOT_DECODED') || /\bsafe\b|cleared/i.test(JSON.stringify(o.decoded_call.reason).replace(/not cleared/g, ''))) v++;
  }
  return { name: 'unknown_selector_is_not_decoded_never_safe', checked: N, violations: v };
}

function checkVersionRefusal() {
  let v = 0; const vers = ['1.2.0', '1.1.1', '1.0.0', '', '1.3', '1.6.0', 'v1.3.0', null, 130];
  for (const ver of vers) {
    const r = compute({ ...BASE, version: ver });
    const o = r.output_payload;
    if (o.verdict !== 'REFUSED' || o.refusal_code !== 'UNSUPPORTED_SAFE_VERSION' || o.safe_tx_hash !== null || !r.compliance_flags.includes('INPUT_REFUSED')) v++;
  }
  return { name: 'unsupported_version_refused_without_hashes', checked: vers.length, violations: v };
}

function checkFieldSensitivity() {
  let v = 0; let n = 0;
  const base = compute(BASE).output_payload.safe_tx_hash;
  const muts = { chainId: 5, safe: '0x1111111111111111111111111111111111111112', to: '0x2222222222222222222222222222222222222223', value: '1', data: '0x00', operation: 1, safeTxGas: 1, baseGas: 1, gasPrice: 1, gasToken: '0x0000000000000000000000000000000000000001', refundReceiver: '0x0000000000000000000000000000000000000001', nonce: 1 };
  for (const k of Object.keys(muts)) { n++; if (compute({ ...BASE, [k]: muts[k] }).output_payload.safe_tx_hash === base) v++; }
  n++; if (compute({ ...BASE, version: '1.5.0' }).output_payload.safe_tx_hash !== base) v++; // layout identical across supported versions
  return { name: 'every_field_moves_safeTxHash_and_versions_share_layout', checked: n, violations: v };
}

function checkMalformedAndDeterminism() {
  let v = 0; let n = 0;
  for (const k of Object.keys(BASE).filter((x) => x !== 'data' && x !== 'version')) {
    for (const bad of [undefined, null, 'zz', -1, 1.5, {}, []]) {
      n++;
      let r;
      try { r = compute({ ...BASE, [k]: bad }); } catch (e) { v++; continue; }
      const o = r.output_payload;
      if (o.verdict !== 'INDETERMINATE' || o.safe_tx_hash !== null || !r.compliance_flags.includes('INPUT_REFUSED')) v++;
    }
  }
  const a = JSON.stringify(compute(BASE)); const b = JSON.stringify(compute(BASE)); n++; if (a !== b) v++;
  for (const junk of [null, undefined, 5, 'x', []]) { n++; try { if (compute(junk).output_payload.verdict !== 'REFUSED') v++; } catch (e) { v++; } }
  return { name: 'malformed_inputs_refuse_without_throwing_and_deterministic', checked: n, violations: v };
}

function checkComplianceFlags() {
  let v = 0; let n = 0;
  // compliance_flags sits beside output_payload, so the fixture oracle (which deep-compares
  // output_payload only) is structurally blind to it; these exact-array checks are its coverage.
  const cases = [
    [BASE, ['SAFE_TX_HASH_COMPUTED']],
    [{ ...BASE, to: BASE.safe, value: '1' }, ['SAFE_TX_HASH_COMPUTED', 'SAFE_TX_VALUE_SENT_TO_SELF']],
    [{ ...BASE, operation: 1, data: '0x' + '11'.repeat(5) }, ['SAFE_TX_HASH_COMPUTED', 'SAFE_TX_CALL_NOT_DECODED', 'SAFE_TX_DELEGATECALL']],
  ];
  for (const [p, want] of cases) {
    n++;
    if (JSON.stringify(compute(p).compliance_flags) !== JSON.stringify(want)) v++;
  }
  n++;
  const refused = compute({ ...BASE, version: '1.2.0' }).compliance_flags;
  if (JSON.stringify(refused) !== JSON.stringify(['INPUT_REFUSED', 'SAFE_TX_HASH_NOT_COMPUTED'])) v++;
  return { name: 'compliance_flags_mirror_risk_and_verdict', checked: n, violations: v };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkPinnedTypehashes(),
  checkIndependentHashParity(),
  checkSelectorTable(),
  checkDelegatecallFlag(),
  checkUnknownSelectorNeverCleared(),
  checkVersionRefusal(),
  checkFieldSensitivity(),
  checkMalformedAndDeterminism(),
  checkComplianceFlags(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
