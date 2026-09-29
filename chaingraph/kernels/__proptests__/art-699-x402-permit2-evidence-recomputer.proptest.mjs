// art-699-x402-permit2-evidence-recomputer — class-K property-test FLOOR (X402-PERMIT2-EVIDENCE-1).
// kernel_digest_at_authoring: sha256:610d0247168f9ed0ac30b0c745503f178fb840da35d67b3fb9f3342801021ba5
// spec: GASLESS-AUTH-EVIDENCE-BUILD-SPEC.md §2
// human_sign_off: PENDING
//
// Class-K floor per FV-PBT-FLOOR-BUILD-SPEC.md — a cheap invariant subset over the declared
// domain, not a totality proof. The primary correctness anchor is the fixture oracle, whose three
// goldens were cross-checked against an independent from-spec typed-data encoder (see the
// fixtures file note). The properties below are the structural invariants a digest recomputer
// must hold whatever the hash arithmetic does, plus the two ENCODING NEGATIVE CONTROLS the build
// spec names: injecting a version field into the three-field domain must move the digest, and
// swapping the two appended referenced types must move the typehash. Both are computed here
// against a small local encoder rather than asserted against a stored constant, so a kernel that
// silently normalized either one away would fail rather than pass on a stale golden.
//
// float:no — every input is a caller-supplied hex or decimal string normalized to BigInt or
// bytes, never a float. ZERO external dependencies beyond the repo's own vendored keccak_256.
// READ-ONLY with respect to the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-699-x402-permit2-evidence-recomputer.proptest.mjs

import { compute } from '../art-699-x402-permit2-evidence-recomputer.kernel.mjs';
import { keccak_256 } from '../_noble-secp256k1.bundle.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-699-x402-permit2-evidence-recomputer';

const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const PROXY = '0x402085c248EeA27D92E8b30b2C58ed07f9E20001';
const TOKEN = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const PAY_TO = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';

const BASE = () => ({
  variant: 'x402_witness_transfer',
  chainId: 84532,
  verifyingContract: PERMIT2,
  permitted: { token: TOKEN, amount: '10000' },
  spender: PROXY,
  nonce: '1701411834604692317316873037158841057',
  deadline: '1790000600',
  witness: { to: PAY_TO, validAfter: '1790000000' },
  from: '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23',
});

// ---- a small local encoder, used only by the two encoding negative controls ----
const enc = (s) => new TextEncoder().encode(s);
const hx = (b) => '0x' + Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
const unhex = (h) => { const s = h.replace(/^0x/i, ''); const o = new Uint8Array(s.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return o; };
const cat = (...a) => { const n = a.reduce((t, x) => t + x.length, 0); const o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const w256 = (v) => { let h = BigInt(v).toString(16); if (h.length % 2) h = '0' + h; const b = unhex(h); const o = new Uint8Array(32); o.set(b, 32 - b.length); return o; };
const wAddr = (a) => { const o = new Uint8Array(32); o.set(unhex(a), 12); return o; };

const TOKEN_PERMISSIONS = 'TokenPermissions(address token,uint256 amount)';
const WITNESS = 'Witness(address to,uint256 validAfter)';
const STUB = 'PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)';
const CANONICAL_TYPE = STUB + TOKEN_PERMISSIONS + WITNESS;
const SWAPPED_TYPE = STUB + WITNESS + TOKEN_PERMISSIONS;

function witnessDigest(domainFields, typeString) {
  const pp = BASE();
  const domainTypeString = domainFields === 4
    ? 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
    : 'EIP712Domain(string name,uint256 chainId,address verifyingContract)';
  const domainParts = [keccak_256(enc(domainTypeString)), keccak_256(enc('Permit2'))];
  if (domainFields === 4) domainParts.push(keccak_256(enc('1')));
  domainParts.push(w256(pp.chainId), wAddr(PERMIT2));
  const ds = keccak_256(cat(...domainParts));
  const tp = keccak_256(cat(keccak_256(enc(TOKEN_PERMISSIONS)), wAddr(TOKEN), w256(pp.permitted.amount)));
  const wi = keccak_256(cat(keccak_256(enc(WITNESS)), wAddr(PAY_TO), w256(pp.witness.validAfter)));
  const sh = keccak_256(cat(keccak_256(enc(typeString)), tp, wAddr(PROXY), w256(pp.nonce), w256(pp.deadline), wi));
  return hx(keccak_256(cat(Uint8Array.from([0x19, 0x01]), ds, sh)));
}

// ---------- properties ----------

// The kernel agrees with a locally, independently encoded digest for the declared shape.
function checkAgreesWithLocalEncoder() {
  const got = compute(BASE()).output_payload.digest;
  const want = witnessDigest(3, CANONICAL_TYPE);
  return { name: 'digest_agrees_with_independent_local_encoding', checked: 1, violations: got === want ? 0 : 1 };
}

// NEGATIVE CONTROL: a four-field domain is a different domain, so the digest must move.
function checkDomainVersionMovesDigest() {
  const three = witnessDigest(3, CANONICAL_TYPE);
  const four = witnessDigest(4, CANONICAL_TYPE);
  const kernelThree = compute(BASE()).output_payload.digest;
  // And the kernel must refuse rather than quietly ignore a supplied version field.
  const refused = compute({ ...BASE(), version: '1' });
  const ok = three !== four
    && kernelThree === three
    && refused.output_payload.verdict === 'INDETERMINATE'
    && refused.compliance_flags.indexOf('X402_PERMIT2_DOMAIN_VERSION_REFUSED') >= 0;
  return { name: 'injected_domain_version_moves_digest_and_is_refused', checked: 3, violations: ok ? 0 : 1 };
}

// NEGATIVE CONTROL: the appended referenced types are ordered, so swapping them must move the
// typehash, and the kernel must be carrying the canonical order.
function checkWitnessTypeOrderMatters() {
  const canonical = hx(keccak_256(enc(CANONICAL_TYPE)));
  const swapped = hx(keccak_256(enc(SWAPPED_TYPE)));
  const kernelTypehash = compute(BASE()).output_payload.typehash;
  const ok = canonical !== swapped && kernelTypehash === canonical;
  return { name: 'swapped_referenced_type_order_moves_typehash', checked: 2, violations: ok ? 0 : 1 };
}

// Any variant outside the closed set is refused, never approximated.
function checkUnknownVariantRefused(rng) {
  const allowed = ['x402_witness_transfer', 'permit_transfer_from', 'permit_single'];
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 200; i++) {
    const v = 'v' + Math.floor(rng() * 1e9).toString(36);
    if (allowed.indexOf(v) >= 0) continue;
    checked++;
    const r = compute({ ...BASE(), variant: v });
    if (r.output_payload.verdict !== 'INDETERMINATE' || r.output_payload.digest !== null) violations++;
    if (r.compliance_flags.indexOf('X402_PERMIT2_VARIANT_REFUSED') < 0) violations++;
  }
  return { name: 'unknown_variant_is_refused_with_no_digest', checked, violations };
}

// The unordered bitmap decomposition is lossless: word * 256 + bit reconstructs the nonce.
function checkNonceDecomposition(rng) {
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 200; i++) {
    const n = (BigInt(Math.floor(rng() * 2 ** 32)) << 40n) | BigInt(Math.floor(rng() * 2 ** 32));
    const f = compute({ ...BASE(), nonce: n.toString() }).output_payload.nonce_facts;
    checked++;
    if (f === null) { violations++; continue; }
    if (f.nonce_space !== 'signature_transfer_unordered_bitmap') violations++;
    if ((BigInt(f.nonce_word_pos) << 8n) + BigInt(f.nonce_bit_pos) !== n) violations++;
  }
  return { name: 'bitmap_nonce_decomposition_is_lossless', checked, violations };
}

// An absent optional context never becomes a pass: it reports NOT_EVALUATED or null.
function checkAbsentContextNeverPasses() {
  const r = compute(BASE()).output_payload;
  const b = r.x402_binding;
  const ok = b.requirement_declared === false
    && b.amount_vs_requirement === 'NOT_EVALUATED'
    && b.token_matches_asset === null
    && b.witness_to_matches_pay_to === null
    && b.chain_matches_network === null
    && r.window.deadline_status === 'NOT_EVALUATED'
    && r.window.valid_after_status === 'NOT_EVALUATED'
    && r.nonce_facts.nonce_already_used === null;
  return { name: 'absent_optional_context_reports_not_evaluated', checked: 8, violations: ok ? 0 : 1 };
}

// The scheme changes the amount rule: under exact the amounts must be equal, under upto the
// signed amount is a ceiling. The two never collapse into one relation.
function checkSchemeAwareAmounts(rng) {
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 150; i++) {
    const signed = BigInt(1 + Math.floor(rng() * 1e9));
    const settled = BigInt(Math.floor(rng() * 2e9));
    const base = { ...BASE(), permitted: { token: TOKEN, amount: signed.toString() } };
    const req = { network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO, amount: settled.toString() };
    const exact = compute({ ...base, requirement: { ...req, scheme: 'exact' } }).output_payload.x402_binding.amount_vs_requirement;
    const upto = compute({ ...base, requirement: { ...req, scheme: 'upto' } }).output_payload.x402_binding.amount_vs_requirement;
    checked += 2;
    if (exact !== (settled === signed ? 'EQUAL' : 'NOT_EQUAL')) violations++;
    const wantUpto = settled === signed ? 'EQUAL_TO_CEILING' : (settled < signed ? 'WITHIN_CEILING' : 'EXCEEDS_CEILING');
    if (upto !== wantUpto) violations++;
  }
  return { name: 'amount_rule_is_scheme_aware', checked, violations };
}

// Signature form classification is a pure function of the bytes, and the wrapper marker wins over
// a coincidental 65-byte tail.
function checkSignatureFormClasses() {
  const cases = [
    ['0x' + 'aa'.repeat(64) + '1b', '65', true],
    ['0x' + 'aa'.repeat(64) + '00', '65', false],
    ['0x' + 'aa'.repeat(64) + '01', '65', false],
    ['0x' + 'aa'.repeat(64), '64-eip2098', true],
    ['0x' + 'aa'.repeat(64) + '1b' + '6492'.repeat(16), 'erc6492-wrapped', null],
    ['0x' + 'aa'.repeat(10), 'other-non-ecdsa', null],
  ];
  let violations = 0;
  for (const [sig, cls, compat] of cases) {
    const f = compute({ ...BASE(), signature: sig }).output_payload.signature_form;
    if (f.signature_length_class !== cls) violations++;
    if (compat !== null && f.v_onchain_compatible !== compat) violations++;
  }
  return { name: 'signature_form_classification', checked: cases.length, violations };
}

// An expiration of zero is the current block only, never a missing expiry.
function checkZeroExpirationIsCurrentBlockOnly() {
  const pp = {
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount: '1000000', expiration: '0', nonce: '3' },
    spender: PROXY, sigDeadline: '1790007200', now_unix: '1790000300',
  };
  const r = compute(pp);
  const a = r.output_payload.allowance_expiry;
  const ok = a !== null
    && a.expiration_is_zero === true
    && a.classification === 'CURRENT_BLOCK_ONLY'
    && r.compliance_flags.indexOf('X402_PERMIT2_ALLOWANCE_CURRENT_BLOCK_ONLY') >= 0
    && r.output_payload.nonce_facts.nonce_space === 'allowance_transfer_sequential';
  return { name: 'zero_expiration_is_current_block_only', checked: 4, violations: ok ? 0 : 1 };
}

// Determinism: the same input twice produces byte-identical output.
function checkDeterminism(rng) {
  let violations = 0;
  const n = 100;
  for (let i = 0; i < n; i++) {
    const pp = { ...BASE(), nonce: String(Math.floor(rng() * 1e12)), deadline: String(1700000000 + Math.floor(rng() * 1e8)) };
    if (!deepEqual(compute(pp), compute(pp))) violations++;
  }
  return { name: 'determinism', checked: n, violations };
}

// ---------- run ----------
const rng = mulberry32(699);
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkAgreesWithLocalEncoder(),
  checkDomainVersionMovesDigest(),
  checkWitnessTypeOrderMatters(),
  checkUnknownVariantRefused(rng),
  checkNonceDecomposition(rng),
  checkAbsentContextNeverPasses(),
  checkSchemeAwareAmounts(rng),
  checkSignatureFormClasses(),
  checkZeroExpirationIsCurrentBlockOnly(),
  checkDeterminism(rng),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
