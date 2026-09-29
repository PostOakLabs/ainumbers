// art-700-authorization-payload-linter.proptest.mjs -- class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:6f656bb896a5c568378f091572e1c6bcf1d22803b6929de33b9315eb3771d6ac
// spec: GASLESS-AUTH-EVIDENCE-BUILD-SPEC.md section 3 (workspace root, AUTH-PAYLOAD-LINTER-1).
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: NO -- every quantity the kernel
// compares is a BigInt and every classification decision is string equality, so there is no
// tolerance anywhere in this file.
//
// Checks: fixture-oracle gate, determinism, output shape, a differential re-derivation of the
// EIP-712 encodeType (independent recursion + Set, versus the kernel's explicit stack), the
// absence invariant that an undeclared policy member can never produce CLEAR, the conformance
// algebra, mode discipline for the blind-hash and undeclared-mode paths, the lookalike invariant
// under member reordering, the injected-member invariant, and threshold monotonicity.
//
// Run: node chaingraph/kernels/__proptests__/art-700-authorization-payload-linter.proptest.mjs
//
// MUTATION-MODE TRIAL CAP (same shape as pnr-01's PNR01-MUTATION-MC-COST-1 cap, see that
// header): under the mutation tier (scripts/run-mutation-tier.mjs, Stryker 8.7.1 command
// runner) each of the kernel's 2,054 mutants (measured at the first tier run,
// 2026-09-29) re-runs this whole floor, so the full-trial counts cost ~1.07 s per
// mutant and 2,054 x 1.07 s / 2 runners exceeds the tier's 600 s per-kernel bound --
// the measured result is the MUTATION-TIER TIMEOUT hard fail
// (MUTATION-TIER-HANG-MMS03-PNR01-1 shape), i.e. the tier can never complete, let
// alone report a score. The proptest may therefore cap its RANDOM trial counts IN
// MUTATION MODE, detected two ways (both pnr-01 verbatim): (a) the seam Stryker
// itself owns -- CommandTestRunner.mutantRun() sets env __STRYKER_ACTIVE_MUTANT__
// for MUTANT runs; (b) the tier sandbox cwd -- the tier copies this proptest into
// %TEMP%\ain-mutation-tier-<pid>\ and runs the Stryker INITIAL DRY RUN there too,
// so __dirname under that root marks dry-run context (Stryker's own dryRunTimeout
// would otherwise kill a full-trial dry run before any mutant executes). OUTSIDE
// mutation mode nothing changes: full trials (1200/1200/1200/1200/1200 + 5 + 100 +
// 400 + 400 + 400 + the 28 fixture vectors), the shipped floor, byte-identical
// behavior. INSIDE the tier (dry run or mutant run) the random trial counts are
// capped (default 25; override with documented env PROPFLOOR_TRIAL_CAP, a positive
// integer, invalid values throw). The fixture oracle is NEVER capped -- it is the
// exact-output gate over all 28 golden vectors and the cheap per-mutant kill
// backbone. Every property is deterministic (seeded mulberry32; a capped run takes
// the first N draws of the same shared stream), so a violation found under the cap
// is found under full trials too -- kill power can only be affected by violations
// that first surface on a late draw.

import { compute } from '../art-700-authorization-payload-linter.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KERNEL_ID = 'art-700-authorization-payload-linter';
const rand = mulberry32(0x700A17);

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const A1 = '0x1111111111111111111111111111111111111111';
const A2 = '0x2222222222222222222222222222222222222222';
const ZERO = '0x0000000000000000000000000000000000000000';

const DOMAIN_TYPE_4 = [
  { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
];
const DOMAIN_TYPE_3 = [
  { name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const ERC2612 = [
  { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];
const TOKEN_PERMISSIONS = [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }];
const PERMIT_TRANSFER_FROM = [
  { name: 'permitted', type: 'TokenPermissions' }, { name: 'spender', type: 'address' },
  { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
];
const EIP3009 = [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
];

const POLICY_CHECK_IDS = [
  'CHAIN_MISMATCH_ACTIVE', 'CHAIN_NOT_ALLOWED', 'VERIFYING_CONTRACT_NOT_ALLOWED',
  'AMOUNT_ABOVE_POLICY', 'VALIDITY_BEYOND_POLICY', 'EXPIRED', 'NOT_YET_VALID',
  'SPENDER_NOT_ALLOWLISTED', 'PAYEE_NOT_ALLOWLISTED', 'SPENDER_NOT_DECLARED_CONTRACT',
  'EIP3009_TRANSFER_TO_CONTRACT', 'DELEGATE_NOT_ALLOWLISTED',
  'X402_METHOD_NOT_OFFLINE_CHECKABLE', 'X402_AMOUNT_MISMATCH', 'X402_PAYTO_MISMATCH',
  'X402_ASSET_MISMATCH', 'X402_NETWORK_MISMATCH', 'PAYLOAD_DIVERGES_FROM_INTENT',
  'ERC7730_DESCRIPTOR_MISMATCH',
];

function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function statusOf(op, id) {
  for (const c of op.checks) if (c.id === id) return c.status;
  return null;
}

// ---------- generators over the declared modes ----------
function erc2612PP(rng) {
  return {
    mode: 'typed_data',
    typed_data: {
      domain: { name: 'USD Coin', version: '2', chainId: 1, verifyingContract: USDC },
      types: { EIP712Domain: DOMAIN_TYPE_4, Permit: ERC2612 },
      primaryType: 'Permit',
      message: {
        owner: A1, spender: A2, value: String(randInt(rng, 1, 1000000)),
        nonce: String(randInt(rng, 0, 50)), deadline: String(randInt(rng, 1000000000, 2100000000)),
      },
    },
  };
}
function permit2PP(rng) {
  return {
    mode: 'typed_data',
    typed_data: {
      domain: { name: 'Permit2', chainId: 8453, verifyingContract: PERMIT2 },
      types: { EIP712Domain: DOMAIN_TYPE_3, PermitTransferFrom: PERMIT_TRANSFER_FROM, TokenPermissions: TOKEN_PERMISSIONS },
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: { token: USDC, amount: String(randInt(rng, 1, 1000000)) },
        spender: A2, nonce: String(randInt(rng, 0, 500)), deadline: String(randInt(rng, 1000000000, 2100000000)),
      },
    },
  };
}
function eip3009PP(rng) {
  return {
    mode: 'typed_data',
    typed_data: {
      domain: { name: 'USD Coin', version: '2', chainId: 1, verifyingContract: USDC },
      types: { EIP712Domain: DOMAIN_TYPE_4, TransferWithAuthorization: EIP3009 },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: A1, to: A2, value: String(randInt(rng, 1, 1000000)), validAfter: '0',
        validBefore: String(randInt(rng, 1000000000, 2100000000)), nonce: '0x' + '0a'.repeat(32),
      },
    },
  };
}
function tuplePP(rng) {
  return {
    mode: 'eip7702_tuple',
    tuple: {
      chain_id: pick(rng, [0, 1, 8453]),
      address: pick(rng, [A1, A2, ZERO]),
      nonce: String(randInt(rng, 0, 1000)),
    },
    signature: { r: '0x' + '11'.repeat(32), s: '0x' + '22'.repeat(32), y_parity: pick(rng, [0, 1]) },
  };
}
function rawHashPP() { return { mode: 'raw_hash', raw_hash: '0x' + 'de'.repeat(32) }; }

function randomPP(rng) {
  const r = rng();
  if (r < 0.08) return { mode: pick(rng, ['calldata', '', 'TYPED_DATA']) };
  if (r < 0.12) return {};
  if (r < 0.20) return rawHashPP();
  if (r < 0.40) return tuplePP(rng);
  if (r < 0.62) return erc2612PP(rng);
  if (r < 0.82) return permit2PP(rng);
  return eip3009PP(rng);
}

// ---------- mutation-mode trial cap (see header) ----------
const MUTATION_MODE =
  process.env.__STRYKER_ACTIVE_MUTANT__ !== undefined ||
  __dirname.replace(/\\/g, '/').includes('/ain-mutation-tier-');
let mutationTrials = 25; // default per-mutant cap; full trials remain the default outside the tier
if (process.env.PROPFLOOR_TRIAL_CAP !== undefined) {
  const cap = Number(process.env.PROPFLOOR_TRIAL_CAP);
  if (!Number.isInteger(cap) || cap <= 0) {
    throw new Error(`PROPFLOOR_TRIAL_CAP must be a positive integer, got "${process.env.PROPFLOOR_TRIAL_CAP}"`);
  }
  mutationTrials = cap;
}
const TRIALS = MUTATION_MODE ? mutationTrials : 1200;
const SMALL_TRIALS = MUTATION_MODE ? mutationTrials : 400; // P7/P8/P9 loops
const capped = (n) => (MUTATION_MODE ? Math.min(n, mutationTrials) : n);

// ---------- P1: determinism ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape, no NaN/undefined ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload } = compute(randomPP(rand));
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3 (differential): encodeType re-derived independently ----------
// The kernel walks referenced structs with an explicit stack; this re-derivation uses recursion
// over a Set and builds the member list with reduce, then asserts the reported encode_type and the
// resulting classification agree with a table lookup over the canonical strings.
const CANONICAL = {
  'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)': 'ERC2612_PERMIT',
  'Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)': 'DAI_LEGACY_PERMIT',
  'PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)': 'PERMIT2_PERMIT_TRANSFER_FROM',
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)': 'EIP3009_TRANSFER_WITH_AUTHORIZATION',
};
function refEncodeType(primary, types) {
  const seen = new Set();
  const visit = (name) => {
    if (!Array.isArray(types[name])) return;
    for (const f of types[name]) {
      const base = f.type.split('[')[0];
      if (base !== primary && Array.isArray(types[base]) && !seen.has(base)) { seen.add(base); visit(base); }
    }
  };
  visit(primary);
  const one = (name) => name + '(' + types[name].reduce((acc, f) => acc.concat([f.type + ' ' + f.name]), []).join(',') + ')';
  return one(primary) + [...seen].sort().map(one).join('');
}
function checkP3_encodetype_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = pick(rand, [erc2612PP, permit2PP, eip3009PP])(rand);
    const td = pp.typed_data;
    const { output_payload: op } = compute(pp);
    checked++;
    const ref = refEncodeType(td.primaryType, td.types);
    if (op.classification.encode_type !== ref) violations++;
    if (op.classification.standard !== (CANONICAL[ref] || 'UNRECOGNIZED')) violations++;
  }
  return { name: 'P3_encodetype_differential', checked, violations };
}

// ---------- P4: the absence invariant -- an undeclared policy member never yields CLEAR ----------
// This is the failure the node exists to avoid: a check that quietly passes because nobody
// declared what it was supposed to compare against.
function checkP4_absence_never_clear() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    delete pp.policy;
    const { output_payload: op } = compute(pp);
    checked++;
    for (const id of POLICY_CHECK_IDS) {
      const s = statusOf(op, id);
      if (s !== null && s !== 'NOT_EVALUATED') violations++;
      if (s === 'NOT_EVALUATED' && op.not_evaluated.indexOf(id) === -1) violations++;
    }
  }
  return { name: 'P4_undeclared_policy_never_clear', checked, violations };
}

// ---------- P5: conformance algebra follows exactly from the check statuses ----------
function checkP5_conformance_algebra() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: op, compliance_flags } = compute(randomPP(rand));
    checked++;
    const evaluated = op.checks.filter((c) => c.status !== 'NOT_EVALUATED');
    const flagged = evaluated.filter((c) => c.status === 'FLAGGED');
    const expected = evaluated.length === 0 ? 'INDETERMINATE' : (flagged.length > 0 ? 'DEVIATES' : 'CONFORMS');
    if (op.policy_conformance !== expected) violations++;
    if (op.evaluated_count !== evaluated.length) violations++;
    if (op.flagged_count !== flagged.length) violations++;
    if (op.not_evaluated.length + evaluated.length !== op.checks.length) violations++;
    for (const c of flagged) if (compliance_flags.indexOf('FLAGGED_' + c.id) === -1) violations++;
    // flag-mirror doctrine: the caveat carrier is present on every run
    if (!Array.isArray(op.warnings)) violations++;
    // every check carries the full reporting triple
    for (const c of op.checks) {
      if (typeof c.id !== 'string' || ['FLAGGED', 'CLEAR', 'NOT_EVALUATED'].indexOf(c.status) === -1) violations++;
      if (!Object.prototype.hasOwnProperty.call(c, 'field_path')) violations++;
      if (!Object.prototype.hasOwnProperty.call(c, 'observed')) violations++;
      if (!Object.prototype.hasOwnProperty.call(c, 'policy')) violations++;
    }
  }
  return { name: 'P5_conformance_algebra', checked, violations };
}

// ---------- P6: mode discipline ----------
function checkP6_mode_discipline() {
  let violations = 0, checked = 0;
  for (const bad of [{}, { mode: 'calldata' }, { mode: 'TYPED_DATA' }, { mode: 42 }, { mode: '' }]) {
    const { output_payload: op, compliance_flags } = compute(bad);
    checked++;
    if (op.policy_conformance !== 'INDETERMINATE') violations++;
    if (op.checks.length !== 0) violations++;
    if (compliance_flags.indexOf('MODE_NOT_DECLARED') === -1) violations++;
    if (op.classification.standard !== 'NOT_CLASSIFIED') violations++;
  }
  for (let i = 0; i < capped(100); i++) {
    const { output_payload: op } = compute(rawHashPP());
    checked++;
    if (statusOf(op, 'BLIND_SIGNATURE') !== 'FLAGGED') violations++;
    if (op.classification.standard !== 'BLIND_HASH') violations++;
    for (const c of op.checks) {
      if (c.id !== 'BLIND_SIGNATURE' && c.status !== 'NOT_EVALUATED') violations++;
    }
    if (op.display.length !== 0) violations++;
  }
  return { name: 'P6_mode_discipline', checked, violations };
}

// ---------- P7: the lookalike invariant under member reordering ----------
// Reordering the members of a canonical struct changes the encoding, so the payload can never keep
// its recognised label, and the known name must raise the lookalike flag.
function checkP7_lookalike_under_reordering() {
  let violations = 0, checked = 0;
  for (let i = 0; i < SMALL_TRIALS; i++) {
    const pp = pick(rand, [erc2612PP, eip3009PP])(rand);
    const td = pp.typed_data;
    const fields = td.types[td.primaryType].slice();
    const a = randInt(rand, 0, fields.length - 1);
    let b = randInt(rand, 0, fields.length - 1);
    if (a === b) b = (b + 1) % fields.length;
    const swapped = fields.slice();
    swapped[a] = fields[b];
    swapped[b] = fields[a];
    td.types[td.primaryType] = swapped;
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.classification.standard !== 'UNRECOGNIZED') violations++;
    if (statusOf(op, 'LOOKALIKE_TYPE') !== 'FLAGGED') violations++;
    if (statusOf(op, 'UNRECOGNIZED_TYPE') !== 'FLAGGED') violations++;
    if (op.policy_conformance !== 'DEVIATES') violations++;
  }
  return { name: 'P7_lookalike_under_member_reordering', checked, violations };
}

// ---------- P8: an injected member is always caught ----------
function checkP8_injected_member() {
  let violations = 0, checked = 0;
  for (let i = 0; i < SMALL_TRIALS; i++) {
    const pp = pick(rand, [erc2612PP, permit2PP, eip3009PP])(rand);
    const clean = compute(pp).output_payload;
    checked++;
    if (statusOf(clean, 'MESSAGE_FIELD_NOT_IN_TYPES') !== 'CLEAR') violations++;
    pp.typed_data.message['injected' + i] = A1;
    const dirty = compute(pp).output_payload;
    if (statusOf(dirty, 'MESSAGE_FIELD_NOT_IN_TYPES') !== 'FLAGGED') violations++;
    if (dirty.policy_conformance !== 'DEVIATES') violations++;
  }
  return { name: 'P8_injected_member_always_flagged', checked, violations };
}

// ---------- P9: threshold monotonicity on the per-token maximum ----------
// A maximum below the signed amount always flags; a maximum at or above it never does.
function checkP9_threshold_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < SMALL_TRIALS; i++) {
    const pp = permit2PP(rand);
    const amount = BigInt(pp.typed_data.message.permitted.amount);
    const below = { ...pp, policy: { max_amount_by_token: { [USDC]: (amount - 1n).toString() } } };
    const atOrAbove = { ...pp, policy: { max_amount_by_token: { [USDC]: (amount + BigInt(randInt(rand, 0, 5000))).toString() } } };
    checked++;
    if (statusOf(compute(below).output_payload, 'AMOUNT_ABOVE_POLICY') !== 'FLAGGED') violations++;
    if (statusOf(compute(atOrAbove).output_payload, 'AMOUNT_ABOVE_POLICY') !== 'CLEAR') violations++;
  }
  return { name: 'P9_amount_threshold_monotonicity', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_encodetype_differential(),
  checkP4_absence_never_clear(),
  checkP5_conformance_algebra(),
  checkP6_mode_discipline(),
  checkP7_lookalike_under_reordering(),
  checkP8_injected_member(),
  checkP9_threshold_monotonicity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test${MUTATION_MODE ? ` (mutation-mode trial cap applied: ${mutationTrials}; fixture oracle never capped)` : ' (full trials)'}.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
