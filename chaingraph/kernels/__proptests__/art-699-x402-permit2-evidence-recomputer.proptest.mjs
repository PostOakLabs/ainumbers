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

// ---- X402-PERMIT2-EVIDENCE-1 tier-floor strengthening (2026-09-29) ----
// The branch's first completed mutation-tier measurement scored money-math 58% (907/1565)
// against the 60% floor (chaingraph/kernels/mutation-tiers.config.json moneyMathBreakFloor).
// Survivor analysis of that Stryker report grouped the kills the floor was missing into:
// (a) compliance_flags is not part of output_payload, so the fixture oracle cannot see it and
//     no property pinned an exact flag array -- flag-string and flag-array mutants all
//     survived; (b) whole negative/edge branches of compute() that neither the 24 fixture
//     vectors nor the ten properties above ever reach (rejected numeric forms, network
//     identifier forms, permit_single width guards and its own window/expiry classification,
//     the sponsored-approval leg's negative arms, the handoff echo records, signature-form
//     edges, domain canonicality). The properties below are targeted deterministic cases over
//     exactly those branches. Test strength only: the kernel file is untouched, and every
//     expectation restates the behavior the kernel already ships (GASLESS-AUTH-EVIDENCE-
//     BUILD-SPEC.md section 2).

const SIG_R = 'aa'.repeat(32);
const ERC6492_BARE = '0x' + '6492'.repeat(16);
// Public secp256k1 group order and its half; the half-order boundary drives the low-s fact.
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const HALF_ORDER = SECP256K1_N >> 1n;

function sig65(r, s, vByte) {
  return '0x' + r.toString(16).padStart(64, '0') + s.toString(16).padStart(64, '0') + vByte.toString(16).padStart(2, '0');
}

function hasStr(list, needle) {
  for (let i = 0; i < list.length; i++) {
    if (typeof list[i] === 'string' && list[i].indexOf(needle) >= 0) return true;
  }
  return false;
}

function flagsEqual(flags, want) {
  return flags.length === want.length && want.every((f, i) => flags[i] === f);
}

// Numeric fields accept bigint, decimal string, 0x-hex string and safe number for the SAME
// value and must produce the identical digest and message; the rejected forms must propagate
// the exact per-field refusal rather than being coerced.
function checkNumericInputForms() {
  const hex = (v) => '0x' + BigInt(v).toString(16);
  const viaBigint = {
    ...BASE(),
    chainId: 84532n,
    nonce: 513n,
    deadline: 1790000600n,
    permitted: { token: TOKEN, amount: 10000n },
    witness: { to: PAY_TO, validAfter: 1790000000n },
  };
  const viaNumber = { ...viaBigint, chainId: 84532, nonce: 513, deadline: 1790000600, permitted: { token: TOKEN, amount: 10000 }, witness: { to: PAY_TO, validAfter: 1790000000 } };
  const viaHex = { ...viaBigint, chainId: hex(84532), nonce: '0x201', deadline: hex(1790000600), permitted: { token: TOKEN, amount: hex(10000) }, witness: { to: PAY_TO, validAfter: hex(1790000000) } };
  const decimal = { ...BASE(), nonce: '513' }; // BASE already carries these values as decimal strings
  const gold = compute(decimal).output_payload;
  let violations = 0;
  for (const pp of [viaBigint, viaNumber, viaHex]) {
    const got = compute(pp).output_payload;
    if (got.digest !== gold.digest || got.digest === null) violations++;
    if (got.message.permitted.amount !== '10000' || got.message.nonce !== '513') violations++;
    if (got.nonce_facts.nonce_word_pos !== '2' || got.nonce_facts.nonce_bit_pos !== 1) violations++;
  }
  // rejected forms, per field: each must yield the field's own refusal text, INDETERMINATE
  const bad = ['-5', '1.5', '1e3', '', '   ', '0x', '12abc', '0X1A'];
  const badValues = [...bad, 1.5, null, true, {}, [], 2n ** 256n];
  for (const v of badValues) {
    const r = compute({ ...BASE(), chainId: v });
    if (r.output_payload.verdict !== 'INDETERMINATE' || r.output_payload.digest !== null) violations++;
    if (!hasStr(r.output_payload.errors, 'chainId is required and must be a non-negative uint256')) violations++;
  }
  // a decimal string is one more accepted spelling of the same value
  if (compute({ ...decimal, chainId: '84532' }).output_payload.digest !== gold.digest) violations++;
  // zero is a legal uint256, not an absence
  const zero = compute({ ...BASE(), chainId: 0 });
  if (zero.output_payload.digest === null || zero.output_payload.domain.chain_id !== '0') violations++;
  return { name: 'numeric_input_forms_and_refusals', checked: 3 * 3 + badValues.length + 2, violations };
}

// The requirement's network identifier: eip155:<digits> and a bare numeric string are
// comparable; anything else (including an empty or whitespace network) reports not-comparable
// with its own reason, and a different chain id raises the mismatch flag.
function checkNetworkIdentifierForms() {
  const req = (network) => ({ scheme: 'exact', network, asset: TOKEN, payTo: PAY_TO, amount: '10000' });
  let violations = 0;
  let checked = 0;
  const bindingFor = (network) => compute({ ...BASE(), requirement: req(network) }).output_payload.x402_binding;
  const sameChain = bindingFor('eip155:84532');
  checked++;
  if (sameChain.chain_matches_network !== true || sameChain.network_comparison_note !== null) violations++;
  const bare = bindingFor('84532');
  checked++;
  if (bare.chain_matches_network !== true) violations++;
  const other = bindingFor('eip155:1');
  checked++;
  if (other.chain_matches_network !== false) violations++;
  const rOther = compute({ ...BASE(), requirement: req('eip155:1') });
  if (rOther.compliance_flags.indexOf('X402_PERMIT2_NETWORK_MISMATCH') < 0) violations++;
  if (!hasStr(rOther.output_payload.warnings, 'should refuse')) violations++;
  const alien = bindingFor('eip155:abc');
  checked++;
  if (alien.chain_matches_network !== null || !hasStr([alien.network_comparison_note], 'is not an eip155 chain reference')) violations++;
  const absent = bindingFor(undefined);
  checked++;
  if (absent.chain_matches_network !== null || !hasStr([absent.network_comparison_note], 'network absent')) violations++;
  const blank = bindingFor('   ');
  checked++;
  if (blank.chain_matches_network !== null || !hasStr([blank.network_comparison_note], 'network absent')) violations++;
  return { name: 'network_identifier_forms_are_distinguished', checked, violations };
}

// An unrecognized scheme leaves the amount rule unapplied: NOT_EVALUATED, scheme null, and the
// dedicated warning. The same requirement without any amount stays silent about amounts.
function checkUnrecognizedSchemeNeverApproximated() {
  const req = (over) => ({ scheme: 'exact', network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO, amount: '10000', ...over });
  let violations = 0;
  const wrongCase = compute({ ...BASE(), requirement: req({ scheme: 'EXACT' }) }).output_payload;
  if (wrongCase.x402_binding.amount_vs_requirement !== 'NOT_EVALUATED' || wrongCase.x402_binding.scheme !== null) violations++;
  if (!hasStr(wrongCase.warnings, 'no recognised scheme')) violations++;
  const noScheme = compute({ ...BASE(), requirement: req({ scheme: '' }) }).output_payload;
  if (noScheme.x402_binding.amount_vs_requirement !== 'NOT_EVALUATED') violations++;
  const noAmount = compute({ ...BASE(), requirement: { scheme: 'exact', network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO } }).output_payload;
  if (noAmount.x402_binding.amount_vs_requirement !== 'NOT_EVALUATED') violations++;
  if (noAmount.x402_binding.requirement_amount !== null) violations++;
  return { name: 'unrecognized_scheme_reports_not_evaluated', checked: 4, violations };
}

// permit_single's own window (sigDeadline) and allowance-expiry classification, including the
// boundary where the declared time equals the deadline or expiration.
function checkPermitSingleWindowAndExpiry() {
  const single = (over) => ({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount: '1000000', expiration: '1790001000', nonce: '7' },
    spender: PROXY, sigDeadline: '1790007200', ...over,
  });
  let violations = 0;
  const within = compute(single({ now_unix: '1790000500' })).output_payload;
  if (within.allowance_expiry.classification !== 'WITHIN' || within.window.deadline_status !== 'WITHIN') violations++;
  if (within.window.deadline !== '1790007200' || within.window.valid_after !== null) violations++;
  if (within.nonce_facts.nonce_space !== 'allowance_transfer_sequential' || within.nonce_facts.sequential_nonce !== '7') violations++;
  const boundary = compute(single({ now_unix: '1790001000' })).output_payload;
  if (boundary.allowance_expiry.classification !== 'WITHIN') violations++;
  const expired = compute(single({ now_unix: '1790001001' }));
  if (expired.output_payload.allowance_expiry.classification !== 'EXPIRED') violations++;
  if (expired.compliance_flags.indexOf('X402_PERMIT2_ALLOWANCE_EXPIRED') < 0) violations++;
  // the window's deadline is sigDeadline, still in the future at this clock
  if (expired.output_payload.window.deadline_status !== 'WITHIN') violations++;
  const windowGone = compute(single({ now_unix: '1790009999' }));
  if (windowGone.output_payload.window.deadline_status !== 'EXPIRED') violations++;
  if (windowGone.compliance_flags.indexOf('X402_PERMIT2_WINDOW_EXPIRED') < 0) violations++;
  const noClock = compute(single({})).output_payload;
  if (noClock.allowance_expiry.classification !== 'NOT_EVALUATED' || noClock.window.deadline_status !== 'NOT_EVALUATED') violations++;
  if (noClock.allowance_expiry.expiration_is_zero !== false || noClock.allowance_expiry.expiration !== '1790001000') violations++;
  return { name: 'permit_single_window_and_expiry_classification', checked: 9, violations };
}

// The allowance shape's field-width guards: uint160 amount and uint48 expiration/nonce refuse
// at 2^160 / 2^48 and accept the boundary minus one.
function checkPermitSingleWidthGuards() {
  let violations = 0;
  const withAmount = (amount) => compute({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount, expiration: '1790001000', nonce: '7' },
    spender: PROXY, sigDeadline: '1790007200',
  });
  const wide = withAmount((1n << 160n).toString());
  if (!hasStr(wide.output_payload.errors, 'details.amount exceeds the 160-bit width this message shape encodes')) violations++;
  if (wide.output_payload.digest !== null || wide.compliance_flags.indexOf('X402_PERMIT2_INDETERMINATE') < 0) violations++;
  const edgeAmount = withAmount((1n << 160n) - 1n).output_payload;
  if (edgeAmount.digest === null || edgeAmount.message.details.amount !== (1n << 160n) - 1n + '') violations++;
  const wideNonce = compute({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount: '1', expiration: '1790001000', nonce: (1n << 48n).toString() },
    spender: PROXY, sigDeadline: '1790007200',
  });
  if (!hasStr(wideNonce.output_payload.errors, 'details.nonce exceeds the 48-bit width this message shape encodes')) violations++;
  const wideExpiry = compute({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount: '1', expiration: (1n << 48n).toString(), nonce: '7' },
    spender: PROXY, sigDeadline: '1790007200',
  });
  if (!hasStr(wideExpiry.output_payload.errors, 'details.expiration exceeds the 48-bit width this message shape encodes')) violations++;
  const edgeNonce = compute({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount: '1', expiration: '1790001000', nonce: (1n << 48n) - 1n + '' },
    spender: PROXY, sigDeadline: '1790007200',
  }).output_payload;
  if (edgeNonce.digest === null) violations++;
  return { name: 'permit_single_width_guards_at_boundaries', checked: 6, violations };
}

// The sponsored-approval leg: every sub-fact and every negative arm, the exact flag vocabulary,
// and the handoff_612 record the downstream ERC-2612 node consumes.
function checkSponsoredApprovalLeg() {
  const base = {
    ...BASE(),
    requirement: { scheme: 'exact', network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO, amount: '10000', extra: { name: 'USD Coin', version: '2' } },
    now_unix: '1790000300',
  };
  const ext = (over) => ({
    from: '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23',
    asset: TOKEN, spender: PERMIT2, amount: '20000', nonce: '9',
    deadline: '1790007200', signature: '0xbe' + '00'.repeat(31), version: '2',
    ...over,
  });
  let violations = 0;
  let checked = 0;
  const full = compute({ ...base, eip2612GasSponsoring: ext({}) });
  checked++;
  const f = full.output_payload;
  if (f.sponsored_approval.spender_is_canonical_permit2 !== true || f.sponsored_approval.owner_matches_from !== true || f.sponsored_approval.amount_covers_permitted !== true) violations++;
  if (f.sponsored_approval.deadline_status !== 'WITHIN' || f.sponsored_approval.extension_schema_version !== '2') violations++;
  if (!flagsEqual(full.compliance_flags, ['X402_PERMIT2_SPONSORED_APPROVAL_PRESENT', 'X402_PERMIT2_DIGEST_RECOMPUTED'])) violations++;
  const h = f.handoff_612;
  if (!h || h.name !== 'USD Coin' || h.version !== '2' || h.chainId !== '84532' || h.verifyingContract !== TOKEN.toLowerCase()) violations++;
  if (h.owner !== '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23' || h.spender !== PERMIT2.toLowerCase() || h.value !== '20000' || h.nonce !== '9' || h.deadline !== '1790007200') violations++;
  if (h.signature !== '0xbe' + '00'.repeat(31)) violations++;

  const ownerMismatch = compute({ ...base, eip2612GasSponsoring: ext({ from: '0x1111111111111111111111111111111111111111' }) });
  checked++;
  if (ownerMismatch.output_payload.sponsored_approval.owner_matches_from !== false) violations++;
  if (ownerMismatch.compliance_flags.indexOf('X402_PERMIT2_SPONSORED_OWNER_MISMATCH') < 0) violations++;

  const short = compute({ ...base, eip2612GasSponsoring: ext({ amount: '9999' }) });
  checked++;
  if (short.output_payload.sponsored_approval.amount_covers_permitted !== false) violations++;
  if (short.compliance_flags.indexOf('X402_PERMIT2_SPONSORED_AMOUNT_SHORT') < 0) violations++;
  const exactCeiling = compute({ ...base, eip2612GasSponsoring: ext({ amount: '10000' }) }).output_payload;
  if (exactCeiling.sponsored_approval.amount_covers_permitted !== true) violations++;

  const stale = compute({ ...base, eip2612GasSponsoring: ext({ deadline: '1790000100' }) });
  checked++;
  if (stale.output_payload.sponsored_approval.deadline_status !== 'EXPIRED') violations++;
  if (stale.compliance_flags.indexOf('X402_PERMIT2_SPONSORED_WINDOW_EXPIRED') < 0) violations++;
  const noClock = compute({ ...base, eip2612GasSponsoring: ext({}) }).output_payload; // clock present in base
  if (noClock.sponsored_approval.deadline_status !== 'WITHIN') violations++;
  const clockless = compute({ ...base, now_unix: undefined, eip2612GasSponsoring: ext({}) }).output_payload;
  if (clockless.sponsored_approval.deadline_status !== 'NOT_EVALUATED') violations++;

  const incomplete = compute({ ...base, requirement: { ...base.requirement, extra: undefined }, eip2612GasSponsoring: ext({}) });
  checked++;
  if (incomplete.compliance_flags.indexOf('X402_PERMIT2_SPONSORED_DOMAIN_INCOMPLETE') < 0) violations++;
  if (incomplete.output_payload.handoff_612.name !== null || incomplete.output_payload.handoff_612.version !== null) violations++;
  if (!hasStr(incomplete.output_payload.warnings, 'is a schema version and is never used here')) violations++;

  const noSig = compute({ ...base, eip2612GasSponsoring: ext({ signature: '   ' }) });
  checked++;
  if (!hasStr(noSig.output_payload.sponsored_approval.errors, 'eip2612GasSponsoring.signature must be supplied')) violations++;

  const empty = compute({ ...base, eip2612GasSponsoring: {} });
  checked++;
  if (empty.output_payload.sponsored_approval.errors.length !== 7) violations++;
  if (!hasStr(empty.output_payload.sponsored_approval.errors, 'eip2612GasSponsoring.from must be a 20-byte hex address')) violations++;
  if (!hasStr(empty.output_payload.sponsored_approval.errors, 'eip2612GasSponsoring.amount must be a non-negative uint256')) violations++;
  if (!hasStr(empty.output_payload.sponsored_approval.errors, 'eip2612GasSponsoring.deadline must be a non-negative uint256')) violations++;

  const alienSpender = compute({ ...base, eip2612GasSponsoring: ext({ spender: '0x2222222222222222222222222222222222222222' }) });
  checked++;
  if (alienSpender.compliance_flags.indexOf('X402_PERMIT2_SPONSORED_SPENDER_NOT_CANONICAL') < 0) violations++;
  if (alienSpender.output_payload.sponsored_approval.spender_is_canonical_permit2 !== false) violations++;
  return { name: 'sponsored_approval_leg_facts_and_handoff', checked, violations };
}

// The signer-recovery handoff record echoes the claimed signer and the parsed signature parts
// byte-exactly, or carries a null claimedFrom with its own warning.
function checkHandoff591Echo() {
  const from = '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23';
  const r = 0x1234n;
  let violations = 0;
  let checked = 0;
  const legacy = (s, vByte) => compute({ ...BASE(), from, signature: sig65(r, s, vByte) });
  const h28 = legacy(HALF_ORDER - 5n, 28);
  checked++;
  const hh = h28.output_payload.handoff_591;
  if (!hh || hh.claimedFrom !== from || hh.yParity !== 1 || hh.r !== '0x' + r.toString(16).padStart(64, '0')) violations++;
  if (hh.s !== '0x' + (HALF_ORDER - 5n).toString(16).padStart(64, '0') || hh.digest !== h28.output_payload.digest) violations++;
  if (h28.output_payload.signature_form.v_form !== 'legacy_27_28' || h28.output_payload.signature_form.s_above_half_order !== false) violations++;
  const h27 = legacy(5n, 27);
  checked++;
  if (h27.output_payload.handoff_591.yParity !== 0 || h27.output_payload.signature_form.v_onchain_compatible !== true) violations++;
  const claimed = compute({ ...BASE(), from: null, signature: sig65(r, 5n, 28) });
  checked++;
  if (claimed.output_payload.handoff_591.claimedFrom !== null) violations++;
  if (!hasStr(claimed.output_payload.warnings, 'no claimed signer was supplied')) violations++;
  const noSig = compute({ ...BASE(), from });
  checked++;
  if (noSig.output_payload.handoff_591 !== null) violations++;
  return { name: 'handoff_591_echoes_recovery_inputs', checked, violations };
}

// Signature-form edges: the raw y-parity forms, an unrecognized final byte, malformed hex,
// the compact form's parity unpacking both ways, the bare wrapper marker, s padding and the
// exact half-order boundary of the low-s fact.
function checkSignatureFormEdges() {
  let violations = 0;
  let checked = 0;
  const S_ONES = BigInt('0x' + '01'.repeat(32));
  const form = (sig) => compute({ ...BASE(), signature: sig }).output_payload.signature_form;
  const raw0 = form(sig65(0xaan, S_ONES, 0x00));
  checked++;
  if (raw0.v_form !== 'raw_y_parity' || raw0.v_onchain_compatible !== false || raw0.y_parity !== 0) violations++;
  if (!hasStr(raw0.notes, 'raw y-parity byte of 0')) violations++;
  const raw1 = form(sig65(0xaan, S_ONES, 0x01));
  checked++;
  if (raw1.y_parity !== 1 || raw1.ecdsa_recovery_applicable !== true) violations++;
  const weird = form(sig65(0xaan, S_ONES, 0x2d));
  checked++;
  if (weird.v_form !== 'unrecognised' || weird.ecdsa_recovery_applicable !== false) violations++;
  if (!hasStr(weird.notes, 'neither a raw y-parity bit nor the 27/28')) violations++;
  if (compute({ ...BASE(), signature: sig65(0xaan, S_ONES, 0x2d) }).output_payload.handoff_591 !== null) violations++;

  const odd = form('abc');
  checked++;
  if (odd.signature_length_class !== 'other-non-ecdsa' || odd.signature_byte_length !== null) violations++;
  if (!hasStr(odd.notes, 'not an even-length hex string')) violations++;
  const nonHex = form('0x' + 'zz'.repeat(4));
  checked++;
  if (nonHex.signature_length_class !== 'other-non-ecdsa' || !hasStr(nonHex.notes, 'not an even-length hex string')) violations++;

  const compactHigh = form('0x' + SIG_R + ((1n << 255n) | 5n).toString(16).padStart(64, '0'));
  checked++;
  if (compactHigh.signature_length_class !== '64-eip2098' || compactHigh.y_parity !== 1 || compactHigh.v_onchain_compatible !== true) violations++;
  if (compactHigh.s !== '0x' + '05'.padStart(64, '0')) violations++;
  const compactLow = form('0x' + SIG_R + 5n.toString(16).padStart(64, '0'));
  checked++;
  if (compactLow.y_parity !== 0 || compactLow.s_above_half_order !== false) violations++;

  const bare6492 = form(ERC6492_BARE);
  checked++;
  if (bare6492.signature_length_class !== 'erc6492-wrapped' || bare6492.erc6492_wrapped !== true) violations++;
  if (bare6492.signature_byte_length !== 32) violations++;

  const tinyS = compute({ ...BASE(), from: null, signature: sig65(1n, 1n, 27) }).output_payload.signature_form;
  checked++;
  if (tinyS.s !== '0x' + '0'.repeat(63) + '1') violations++;

  const atHalf = compute({ ...BASE(), signature: sig65(2n, HALF_ORDER, 28) }).output_payload.signature_form;
  checked++;
  if (atHalf.s_above_half_order !== false) violations++;
  const aboveHalf = compute({ ...BASE(), signature: sig65(2n, HALF_ORDER + 1n, 28) });
  checked++;
  if (aboveHalf.output_payload.signature_form.s_above_half_order !== true) violations++;
  if (aboveHalf.compliance_flags.indexOf('X402_PERMIT2_SIGNATURE_HIGH_S') < 0) violations++;

  const notEcdsa = compute({ ...BASE(), signature: '0x' + 'ab'.repeat(10) });
  checked++;
  if (notEcdsa.compliance_flags.indexOf('X402_PERMIT2_SIGNATURE_NOT_ECDSA') < 0) violations++;
  const nonCompat = compute({ ...BASE(), signature: '0x' + SIG_R + '01'.repeat(32) + '00' });
  checked++;
  if (nonCompat.compliance_flags.indexOf('X402_PERMIT2_SIGNATURE_V_NOT_ONCHAIN_COMPATIBLE') < 0) violations++;
  return { name: 'signature_form_edges_and_low_s_boundary', checked, violations };
}

// Domain handling: checksummed/uppercase input normalizes to the same digest, a non-canonical
// Permit2 address is reported rather than rejected, and the domain refuses a version by either
// spelling of the field.
function checkDomainCanonicalityAndRefusals() {
  let violations = 0;
  let checked = 0;
  const gold = compute(BASE()).output_payload;
  const checksum = compute({ ...BASE(), verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' });
  checked++;
  if (checksum.output_payload.digest !== gold.digest || checksum.output_payload.domain.verifying_contract !== PERMIT2.toLowerCase()) violations++;
  if (checksum.output_payload.domain.verifying_contract_is_canonical_permit2 !== true) violations++;
  const upperX = compute({ ...BASE(), verifyingContract: '0X' + PERMIT2.slice(2) });
  checked++;
  if (upperX.output_payload.digest !== gold.digest) violations++;

  const other = compute({ ...BASE(), verifyingContract: '0x1111111111111111111111111111111111111111' });
  checked++;
  if (other.output_payload.domain.verifying_contract_is_canonical_permit2 !== false) violations++;
  if (other.compliance_flags.indexOf('X402_PERMIT2_DOMAIN_NOT_CANONICAL') < 0) violations++;
  if (!hasStr(other.output_payload.warnings, 'is not the canonical Permit2 deployment')) violations++;
  if (other.output_payload.digest === null) violations++;

  const short39 = compute({ ...BASE(), verifyingContract: '0x' + 'a'.repeat(39) });
  checked++;
  if (!hasStr(short39.output_payload.errors, 'verifyingContract is required and must be a 20-byte hex address')) violations++;
  const notString = compute({ ...BASE(), verifyingContract: 42 });
  checked++;
  if (!hasStr(notString.output_payload.errors, 'verifyingContract is required and must be a 20-byte hex address')) violations++;

  const nestedVersion = compute({ ...BASE(), domain: { version: '1' } });
  checked++;
  if (nestedVersion.compliance_flags.indexOf('X402_PERMIT2_DOMAIN_VERSION_REFUSED') < 0) violations++;
  if (!hasStr(nestedVersion.output_payload.errors, 'exactly three fields')) violations++;
  if (!flagsEqual(nestedVersion.compliance_flags, ['X402_PERMIT2_DOMAIN_VERSION_REFUSED', 'X402_PERMIT2_INDETERMINATE'])) violations++;

  // destination fields normalize case: an uppercase payTo still matches the witness destination
  const upperPayTo = compute({
    ...BASE(),
    requirement: { scheme: 'exact', network: 'eip155:84532', asset: TOKEN.toUpperCase(), payTo: PAY_TO.toUpperCase(), amount: '10000' },
  }).output_payload;
  checked++;
  if (upperPayTo.x402_binding.witness_to_matches_pay_to !== true || upperPayTo.x402_binding.token_matches_asset !== true) violations++;
  return { name: 'domain_canonicality_and_refusals', checked, violations };
}

// Every batch message shape is refused by name, and each refusal carries the batch reason and
// the variant-refused flag (the flag is invisible to the fixture oracle, which diffs only
// output_payload, so it is pinned here).
function checkBatchVariantsRefused() {
  const batches = ['permit_batch_transfer_from', 'x402_batch_witness_transfer', 'permit_batch'];
  let violations = 0;
  for (const v of batches) {
    const r = compute({ ...BASE(), variant: v });
    if (r.output_payload.verdict !== 'INDETERMINATE' || r.output_payload.digest !== null) violations++;
    if (!hasStr(r.output_payload.errors, 'is a batch message shape and is refused in this version')) violations++;
    if (!flagsEqual(r.compliance_flags, ['X402_PERMIT2_VARIANT_REFUSED', 'X402_PERMIT2_INDETERMINATE'])) violations++;
  }
  return { name: 'batch_variants_refused_by_name_with_flag', checked: batches.length * 3, violations };
}

// Amount-mismatch outcomes carry their flag and warning; the ceiling rule and the exact rule
// also hold on the allowance shape, where the signed amount is the details amount.
function checkAmountRelationFlagsAndSingleShape() {
  const req = (amount, scheme) => ({ scheme, network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO, amount });
  let violations = 0;
  let checked = 0;
  const exactMiss = compute({ ...BASE(), permitted: { token: TOKEN, amount: '10000' }, requirement: req('9999', 'exact') });
  checked++;
  if (exactMiss.output_payload.x402_binding.amount_vs_requirement !== 'NOT_EQUAL') violations++;
  if (exactMiss.compliance_flags.indexOf('X402_PERMIT2_AMOUNT_MISMATCH') < 0) violations++;
  if (!hasStr(exactMiss.output_payload.warnings, 'does not hold against the signed amount')) violations++;
  const uptoOver = compute({ ...BASE(), permitted: { token: TOKEN, amount: '10000' }, requirement: req('20000', 'upto') });
  checked++;
  if (uptoOver.output_payload.x402_binding.amount_vs_requirement !== 'EXCEEDS_CEILING') violations++;
  if (uptoOver.compliance_flags.indexOf('X402_PERMIT2_AMOUNT_MISMATCH') < 0) violations++;
  const uptoEqual = compute({ ...BASE(), permitted: { token: TOKEN, amount: '10000' }, requirement: req('10000', 'upto') }).output_payload;
  checked++;
  if (uptoEqual.x402_binding.amount_vs_requirement !== 'EQUAL_TO_CEILING') violations++;

  const single = (amount) => compute({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount, expiration: '1790001000', nonce: '7' },
    spender: PROXY, sigDeadline: '1790007200',
    requirement: req(amount, 'exact'),
  }).output_payload;
  checked++;
  if (single('555').x402_binding.amount_vs_requirement !== 'EQUAL') violations++;
  const singleSponsor = compute({
    variant: 'permit_single', chainId: 84532, verifyingContract: PERMIT2,
    details: { token: TOKEN, amount: '555', expiration: '1790001000', nonce: '7' },
    spender: PROXY, sigDeadline: '1790007200',
    requirement: req('444', 'upto'),
  }).output_payload;
  checked++;
  if (singleSponsor.x402_binding.amount_vs_requirement !== 'WITHIN_CEILING') violations++;
  if (singleSponsor.x402_binding.signed_amount !== '555' || singleSponsor.x402_binding.requirement_amount !== '444') violations++;
  return { name: 'amount_relation_flags_and_allowance_shape_rule', checked, violations };
}

// The unordered-bitmap decomposition at its boundaries, the tri-state nonce fact, and the
// sequential space of the allowance shape never carrying bitmap fields.
function checkNonceBitmapBoundariesAndTriState() {
  let violations = 0;
  let checked = 0;
  const facts = (nonce) => compute({ ...BASE(), nonce }).output_payload.nonce_facts;
  const z = facts('0');
  checked++;
  if (z.nonce_word_pos !== '0' || z.nonce_bit_pos !== 0) violations++;
  const max8 = facts('255');
  checked++;
  if (max8.nonce_word_pos !== '0' || max8.nonce_bit_pos !== 255) violations++;
  const spill = facts('256');
  checked++;
  if (spill.nonce_word_pos !== '1' || spill.nonce_bit_pos !== 0) violations++;
  const used = compute({ ...BASE(), nonce_already_used: true });
  checked++;
  if (used.output_payload.nonce_facts.nonce_already_used !== true) violations++;
  if (used.compliance_flags.indexOf('X402_PERMIT2_NONCE_DECLARED_USED') < 0) violations++;
  if (!hasStr(used.output_payload.warnings, 'reads no chain')) violations++;
  const fresh = compute({ ...BASE(), nonce_already_used: false }).output_payload;
  checked++;
  if (fresh.nonce_facts.nonce_already_used !== false) violations++;
  if (compute({ ...BASE(), nonce_already_used: false }).compliance_flags.indexOf('X402_PERMIT2_NONCE_DECLARED_USED') >= 0) violations++;
  const tri = compute({ ...BASE(), nonce_already_used: 'true' }).output_payload;
  checked++;
  if (tri.nonce_facts.nonce_already_used !== null) violations++;
  return { name: 'nonce_bitmap_boundaries_and_tri_state_fact', checked, violations };
}

// _str trims before recognizing: a padded variant and a padded scheme are the same inputs.
function checkTrimmedStringFormsAccepted() {
  let violations = 0;
  const padded = compute({ ...BASE(), variant: '  x402_witness_transfer  ' }).output_payload;
  if (padded.digest !== compute(BASE()).output_payload.digest) violations++;
  const paddedScheme = compute({
    ...BASE(),
    requirement: { scheme: '  exact  ', network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO, amount: '10000' },
  }).output_payload;
  if (paddedScheme.x402_binding.scheme !== 'exact' || paddedScheme.x402_binding.amount_vs_requirement !== 'EQUAL') violations++;
  return { name: 'trimmed_string_forms_are_recognized', checked: 2, violations: violations };
}

// Exact compliance_flags pins for the clean and refused shapes -- the flag channel is not part
// of output_payload, so without these pins a mutant that adds, drops or renames a flag survives
// every other check.
function checkComplianceFlagPins() {
  let violations = 0;
  let checked = 0;
  const clean = compute(BASE());
  checked++;
  if (!flagsEqual(clean.compliance_flags, ['X402_PERMIT2_DIGEST_RECOMPUTED'])) violations++;
  const unknown = compute({ ...BASE(), variant: 'not_a_variant' });
  checked++;
  if (!flagsEqual(unknown.compliance_flags, ['X402_PERMIT2_VARIANT_REFUSED', 'X402_PERMIT2_INDETERMINATE'])) violations++;
  const version = compute({ ...BASE(), version: '1' });
  checked++;
  if (!flagsEqual(version.compliance_flags, ['X402_PERMIT2_DOMAIN_VERSION_REFUSED', 'X402_PERMIT2_INDETERMINATE'])) violations++;
  const absent = compute({ ...BASE(), permitted: undefined });
  checked++;
  if (absent.compliance_flags.indexOf('X402_PERMIT2_DIGEST_RECOMPUTED') >= 0) violations++;
  if (absent.compliance_flags.indexOf('X402_PERMIT2_INDETERMINATE') < 0) violations++;
  if (!hasStr(absent.output_payload.errors, 'permitted.token is required and must be a 20-byte hex address')) violations++;
  if (!hasStr(absent.output_payload.errors, 'permitted.amount is required and must be a non-negative uint256')) violations++;
  // the transfer shapes refuse their missing fields by name, too
  const bare = compute({ ...BASE(), spender: undefined, nonce: undefined, deadline: undefined });
  checked++;
  if (!hasStr(bare.output_payload.errors, 'spender is required and must be a 20-byte hex address')) violations++;
  if (!hasStr(bare.output_payload.errors, 'nonce is required and must be a non-negative uint256')) violations++;
  if (!hasStr(bare.output_payload.errors, 'deadline is required and must be a non-negative uint256')) violations++;
  const bareWitness = compute({ ...BASE(), witness: undefined });
  checked++;
  if (!hasStr(bareWitness.output_payload.errors, 'witness.to is required and must be a 20-byte hex address')) violations++;
  if (!hasStr(bareWitness.output_payload.errors, 'witness.validAfter is required and must be a non-negative uint256')) violations++;
  return { name: 'compliance_flag_pins_and_field_refusals', checked, violations };
}

// The x402 witness window at both boundaries, and the transfer shapes' absent witness fields.
function checkWitnessWindowBoundaries() {
  let violations = 0;
  const at = (now) => compute({ ...BASE(), now_unix: String(now) });
  const active = at(1790000000).output_payload.window;
  if (active.valid_after_status !== 'ACTIVE' || active.valid_after !== '1790000000') violations++;
  const early = compute({ ...BASE(), now_unix: '1789999999' });
  if (early.output_payload.window.valid_after_status !== 'NOT_YET_VALID') violations++;
  if (early.compliance_flags.indexOf('X402_PERMIT2_NOT_YET_VALID') < 0) violations++;
  const atDeadline = at(1790000600).output_payload.window;
  if (atDeadline.deadline_status !== 'WITHIN') violations++;
  const unwitnessed = compute({ ...BASE(), variant: 'permit_transfer_from', requirement: { scheme: 'exact', network: 'eip155:84532', asset: TOKEN, payTo: PAY_TO, amount: '10000' } }).output_payload;
  if (unwitnessed.window.valid_after !== null || unwitnessed.window.valid_after_status !== 'NOT_EVALUATED') violations++;
  if (unwitnessed.x402_binding.witness_to_matches_pay_to !== null) violations++;
  if (unwitnessed.type_string.indexOf('PermitTransferFrom(') !== 0) violations++;
  return { name: 'witness_window_boundaries_and_unwitnessed_shape', checked: 6, violations };
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
  checkNumericInputForms(),
  checkNetworkIdentifierForms(),
  checkUnrecognizedSchemeNeverApproximated(),
  checkPermitSingleWindowAndExpiry(),
  checkPermitSingleWidthGuards(),
  checkSponsoredApprovalLeg(),
  checkHandoff591Echo(),
  checkSignatureFormEdges(),
  checkDomainCanonicalityAndRefusals(),
  checkBatchVariantsRefused(),
  checkAmountRelationFlagsAndSingleShape(),
  checkNonceBitmapBoundariesAndTriState(),
  checkTrimmedStringFormsAccepted(),
  checkComplianceFlagPins(),
  checkWitnessWindowBoundaries(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
