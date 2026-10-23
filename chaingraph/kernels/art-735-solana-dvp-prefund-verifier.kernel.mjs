import { executionHash } from './_hash.mjs';

// art-735-solana-dvp-prefund-verifier — values-only recompute of the DvP pre-funding checklist
// (solana-foundation/dvp) over a PASTED SwapDvp record and mint descriptors. The README's
// funding note requires a funder to verify, BEFORE depositing, that the stored record is owned
// by the DvP program, is exactly SwapDvp::LEN (458) bytes, and carries the agreed terms,
// because CreateDvp is permissionless and a forged create can name attacker destinations
// ("a record is not proof of agreement"). This kernel recomputes that checklist from values the
// caller pasted; it never touches the network, never derives a PDA and never reads a wallet.
//
// PROVENANCE (SOLANA-DVP-PREFUND-VERIFIER-1): every constant below is PORTED FROM THE PINNED
// CLAUSES of SOLANA-DVP-RETRIEVAL-1 (registry: chaingraph/standard/clause-snapshot-registry.json,
// "DvP *" entries @df9919ed; snapshots: research/clause-snapshots/SOLANA-DVP-*.txt):
//   - pinned owner program id: lib.rs declare_id pin ("DvP declare_id @df9919ed"),
//     cross-checked against the docs Program ID table pin.
//   - LEN 458, struct fields (token_program_a/b, mint_a/b_authority, optional
//     earliest_settlement_timestamp None = no lower bound): "DvP SwapDvp struct and LEN @df9919ed".
//   - owner + 458-byte length + terms list before funding: README Notes line 33
//     ("DvP README Instructions and Notes @df9919ed").
//   - expiry rules — only Settle rejects after expiry_timestamp (line 24); earliest must be
//     <= expiry and expiry is capped at one year past creation (line 26); cluster time not
//     wall-clock (line 27): same README pin.
//   - blocked extensions TransferFeeConfig, InterestBearingConfig, ScaledUiAmountConfig,
//     NonTransferable -> BlockedMintExtension ("DvP blocked mint extensions @df9919ed").
//   - hook extras capped at 32 accounts per leg ("DvP transfer-hook account cap @df9919ed",
//     MAX_HOOK_REMAINING_ACCOUNTS = 32; README Notes line 35).
//   - trust flags (accepted as-is, surfaced only): PermanentDelegate, Pausable,
//     MintCloseAuthority, mutable TransferHook, ConfidentialTransfer, DefaultAccountState /
//     freeze authority — blocked-ext pin residual-risk block and README Notes lines 34-35.
// No bytes are copied from the Solana sources: the rules below restate the pinned text's
// behaviour as a values-only recompute.
//
// SCOPE / REFUSAL: the output is a record-vs-terms RECOMPUTE over pasted values. It is NOT
// legal finality and NOT proof of agreement (README Notes line 31: CreateDvp is permissionless,
// "a record is not proof of agreement"). The Cantina audit scope mapping for this program commit
// is UNVERIFIED ("Cantina DvP report scope" pin: the report's repository field names a different
// repo); the audit is never cited as coverage. Zero network calls, zero on-chain writes, no keys.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. Cluster time is a REQUIRED caller input (`now`); the system clock is never read.
// All amounts and timestamps are BigInt end to end via decimal strings; JS Number is never used
// for a u64/i64 value.

const TOOL_ID = 'art-735-solana-dvp-prefund-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_solana_dvp_terms',
  mandate_type: 'settlement_mandate', gpu: false,
};

// Pinned constants (see PROVENANCE above for the exact pin per constant).
const PINNED_OWNER_PROGRAM_ID = 'dvp34bdbcEm4f4FCUjGV4mDAkDshaQR4LkK8fdcsyZq';
const SWAP_DVP_LEN = 458;               // struct LEN pin: 1 + 32*7 + 8*4 + 64 + 32*2 + 32*2 + 1 + 8
const MAX_HOOK_REMAINING_ACCOUNTS = 32; // per leg (hook-cap pin; README Notes line 35)
const ONE_YEAR_SECONDS = 31536000n;     // "more than one year past creation" (README Notes line 26), fixed 365-day year
const I64_MIN = -(2n ** 63n);
const I64_MAX = (2n ** 63n) - 1n;
const U64_MAX = (1n << 64n) - 1n;

const BLOCKED_EXTENSIONS = [
  'TransferFeeConfig', 'InterestBearingConfig', 'ScaledUiAmountConfig', 'NonTransferable',
];
// Short aliases the token-2022 docs also use, mapped to the pinned full names.
const EXTENSION_ALIASES = {
  transferfee: 'TransferFeeConfig',
  interestbearing: 'InterestBearingConfig',
  scaleduiamount: 'ScaledUiAmountConfig',
  nontransferable: 'NonTransferable',
  transferfeeconfig: 'TransferFeeConfig',
  interestbearingconfig: 'InterestBearingConfig',
  scaleduiamountconfig: 'ScaledUiAmountConfig',
  permanentdelegate: 'PermanentDelegate',
  pausable: 'Pausable',
  mintcloseauthority: 'MintCloseAuthority',
  defaulaccountstate: 'DefaultAccountState',
  defaultaccountstate: 'DefaultAccountState',
  transferhook: 'TransferHook',
  confidentialtransfer: 'ConfidentialTransfer',
  confidentialtransferfeeconfig: 'ConfidentialTransferFeeConfig',
};

function parseI64(s) {
  if (typeof s === 'string' && /^-?[0-9]+$/.test(s)) {
    const v = BigInt(s);
    if (v >= I64_MIN && v <= I64_MAX) return v;
    return null;
  }
  if (typeof s === 'number' && Number.isInteger(s) && Math.abs(s) <= 9007199254740991) return BigInt(s);
  return null;
}
function parseU64(s) {
  const v = parseI64(s);
  if (v === null || v < 0n || v > U64_MAX) return null;
  return v;
}
function parseU8(s) {
  const v = parseI64(s);
  if (v === null || v < 0n || v > 255n) return null;
  return v;
}
// A pasted Solana address is treated as an opaque non-empty string (typically base58); this
// kernel never derives, validates a checksum, or resolves an address — it only compares values.
function parseAddress(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 64) return null;
  return s;
}
function parseByteLength(s) {
  const v = parseU64(s);
  if (v === null || v > 65535n) return null;
  return v;
}
/**
 * @param {any} raw
 * @param {string} name
 * @returns {{ err?: string, list?: string[] }}
 */
function parseExtensionList(raw, name) {
  if (raw === undefined || raw === null) return { list: [] };
  if (!Array.isArray(raw)) return { err: name + ' must be an array of extension name strings; got ' + JSON.stringify(raw) + '.' };
  const list = [];
  for (const e of raw) {
    if (typeof e !== 'string') return { err: name + ' entries must be strings; got ' + JSON.stringify(e) + '.' };
    const norm = EXTENSION_ALIASES[e.trim().toLowerCase()];
    if (!norm) return { err: name + ' contains an unrecognised extension name ' + JSON.stringify(e) + '; pass Token-2022 extension names such as "TransferFeeConfig" or "PermanentDelegate".' };
    if (!list.includes(norm)) list.push(norm);
  }
  return { list };
}
function parseBool(raw, name) {
  if (raw === undefined || raw === null) return { val: false };
  if (typeof raw === 'boolean') return { val: raw };
  return { err: name + ' must be a boolean; got ' + JSON.stringify(raw) + '.' };
}

const DISCLAIMER = 'Values-only recompute over pasted data: NOT legal finality and NOT proof of agreement. CreateDvp is permissionless — a record is not proof of agreement (README Notes: the economic terms are not part of the PDA seeds).';
const AUDIT_NOTE = 'The Cantina audit scope mapping for this program commit is UNVERIFIED (the report lists a different repository); this output never cites the audit as coverage.';
const YEAR_NOTE = 'The one-year expiry cap is recomputed against a fixed 365-day year (31,536,000 seconds) from the creation timestamp you supply.';

// Structured refusal — every malformed input returns a non-verdict naming the field, never a
// partial verdict (AUTHORING-STANDARD section 1.3: refusal by construction).
function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      manual_review_required: true,
      prefund_check: 'REFUSED',
      owner_matches: null,
      length_matches: null,
      terms_match: null,
      earliest_within_expiry: null,
      expiry_within_one_year: null,
      expiry_in_future: null,
      no_blocked_extensions: null,
      hook_extras_within_cap: null,
      failed_checks: null,
      trust_flags: [],
      warnings: [],
      record: null,
      disclaimer: DISCLAIMER,
      audit_scope_note: AUDIT_NOTE,
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

const REQUIRED_ADDRESSES = [
  ['user_a', 'party A (cash receiver)'], ['user_b', 'party B (asset receiver)'],
  ['mint_a', 'leg A mint'], ['mint_b', 'leg B mint'],
  ['token_program_a', 'leg A token program'], ['token_program_b', 'leg B token program'],
  ['settlement_authority', 'settlement authority'],
  ['destination_a', "user A's settlement destination"], ['destination_b', "user B's settlement destination"],
  ['mint_a_authority', 'mint A authority captured at Create'], ['mint_b_authority', 'mint B authority captured at Create'],
];

// One mint descriptor: extension list, frozen-by-default flag, freeze-authority flag.
/**
 * @param {any} pp
 * @param {string} leg
 * @returns {{ err?: object, desc?: { extensions: string[], frozenByDefault: boolean, freezeAuthoritySet: boolean } }}
 */
function parseMintDesc(pp, leg) {
  const extP = parseExtensionList(pp['mint_' + leg + '_extensions'], 'mint_' + leg + '_extensions');
  if (extP.err) return { err: refusal('EXTENSION_LIST_MALFORMED', extP.err) };
  const frozenP = parseBool(pp['mint_' + leg + '_frozen_by_default'], 'mint_' + leg + '_frozen_by_default');
  if (frozenP.err) return { err: refusal('FIELD_MALFORMED', frozenP.err) };
  const freezeP = parseBool(pp['mint_' + leg + '_freeze_authority_set'], 'mint_' + leg + '_freeze_authority_set');
  if (freezeP.err) return { err: refusal('FIELD_MALFORMED', freezeP.err) };
  return { desc: { extensions: extP.list, frozenByDefault: frozenP.val, freezeAuthoritySet: freezeP.val } };
}

// The expected-terms block the funder supplies from the agreed deal.
/** @type {Array<[string, boolean]>} */
const EXPECTED_TERMS_FIELDS = [
  ['amount_a', true], ['amount_b', true], ['expiry_timestamp', true],
  ['earliest_settlement_timestamp', false],
  ['user_a', true], ['user_b', true], ['settlement_authority', true],
  ['destination_a', true], ['destination_b', true],
];

function parseExpected(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { err: refusal('EXPECTED_TERMS_REQUIRED', 'expected is required: the funder-supplied agreed terms { amount_a, amount_b, expiry_timestamp, earliest_settlement_timestamp?, user_a, user_b, settlement_authority, destination_a, destination_b }. Without it there is nothing to verify the record against.') };
  }
  const exp = {};
  for (const [f, required] of EXPECTED_TERMS_FIELDS) {
    if (raw[f] === undefined) {
      if (required) return { err: refusal('EXPECTED_TERMS_REQUIRED', 'expected.' + f + ' is required; the pre-funding checklist verifies the stored record against the agreed deal.') };
      exp[f] = null; // absent = no lower bound expected
      continue;
    }
    exp[f] = raw[f];
  }
  const amtA = parseU64(exp.amount_a);
  if (amtA === null) return { err: refusal('EXPECTED_TERMS_MALFORMED', 'expected.amount_a must be a decimal string in u64 range; got ' + JSON.stringify(exp.amount_a) + '.') };
  const amtB = parseU64(exp.amount_b);
  if (amtB === null) return { err: refusal('EXPECTED_TERMS_MALFORMED', 'expected.amount_b must be a decimal string in u64 range; got ' + JSON.stringify(exp.amount_b) + '.') };
  const expExpiry = parseI64(exp.expiry_timestamp);
  if (expExpiry === null) return { err: refusal('EXPECTED_TERMS_MALFORMED', 'expected.expiry_timestamp must be a decimal string in i64 range; got ' + JSON.stringify(exp.expiry_timestamp) + '.') };
  let expEarliest = null;
  if (exp.earliest_settlement_timestamp !== null && exp.earliest_settlement_timestamp !== undefined) {
    expEarliest = parseI64(exp.earliest_settlement_timestamp);
    if (expEarliest === null) return { err: refusal('EXPECTED_TERMS_MALFORMED', 'expected.earliest_settlement_timestamp must be null (no lower bound) or a decimal string in i64 range; got ' + JSON.stringify(exp.earliest_settlement_timestamp) + '.') };
  }
  for (const f of ['user_a', 'user_b', 'settlement_authority', 'destination_a', 'destination_b']) {
    if (parseAddress(exp[f]) === null) return { err: refusal('EXPECTED_TERMS_MALFORMED', 'expected.' + f + ' must be a non-empty address string; got ' + JSON.stringify(exp[f]) + '.') };
  }
  return { expected: { amount_a: amtA, amount_b: amtB, expiry: expExpiry, earliest: expEarliest, user_a: exp.user_a, user_b: exp.user_b, settlement_authority: exp.settlement_authority, destination_a: exp.destination_a, destination_b: exp.destination_b } };
}

function eqStr(a, b) { return a === b; }

/**
 * compute(pp) — pure decision kernel, values only.
 * pp: {
 *   owner_program_id,        // pasted account owner program id, string
 *   byte_length,             // pasted account data length in bytes (458 expected)
 *   user_a, user_b, mint_a, mint_b, token_program_a, token_program_b,
 *   settlement_authority, destination_a, destination_b,          // pasted record fields
 *   mint_a_authority, mint_b_authority,                          // authorities captured at Create
 *   amount_a, amount_b,      // decimal strings (u64)
 *   expiry_timestamp,        // decimal string (i64 unix seconds)
 *   earliest_settlement_timestamp, // optional decimal string or null (None = no lower bound)
 *   creation_timestamp,      // decimal string (i64): the record's creation cluster time
 *   nonce,                   // opaque non-empty string (64-bit random nonce, pasted as text)
 *   mint_a_extensions, mint_b_extensions,   // array of Token-2022 extension names
 *   mint_a_frozen_by_default, mint_b_frozen_by_default,       // bool
 *   mint_a_freeze_authority_set, mint_b_freeze_authority_set, // bool
 *   leg_a_extras_count, leg_b_extras_count, // per-leg hook extra-account counts (u8)
 *   now,                     // REQUIRED cluster unix timestamp (i64) — never the wall clock
 *   expected: { amount_a, amount_b, expiry_timestamp, earliest_settlement_timestamp?, user_a,
 *               user_b, settlement_authority, destination_a, destination_b }
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};

  const owner = parseAddress(pp.owner_program_id);
  if (owner === null) return refusal('OWNER_MALFORMED', 'owner_program_id must be a non-empty program-id string; got ' + JSON.stringify(pp.owner_program_id ?? null) + '.');
  const byteLength = parseByteLength(pp.byte_length);
  if (byteLength === null) return refusal('BYTE_LENGTH_MALFORMED', 'byte_length must be the account data length in bytes (decimal, 0-65535); got ' + JSON.stringify(pp.byte_length ?? null) + '.');
  const now = parseI64(pp.now);
  if (now === null) return refusal('NOW_REQUIRED', 'now is required and must be the CLUSTER unix timestamp in seconds (Clock::unix_timestamp, validator-vote median — cluster time, not wall-clock; never read from the system clock). Pass it explicitly so the expiry checks are deterministic.');
  const creation = parseI64(pp.creation_timestamp);
  if (creation === null) return refusal('CREATION_MALFORMED', 'creation_timestamp must be a decimal string in i64 range (the record\'s creation cluster time); got ' + JSON.stringify(pp.creation_timestamp ?? null) + '.');
  if (typeof pp.nonce !== 'string' || pp.nonce.length === 0) return refusal('NONCE_MALFORMED', 'nonce must be the pasted nonce value as a non-empty string; got ' + JSON.stringify(pp.nonce ?? null) + '.');
  if (pp.nonce.length > 78) return refusal('NONCE_MALFORMED', 'nonce must be the pasted nonce value as a non-empty string of at most 78 characters (a decimal u64 has at most 20 digits; a 32-byte seed hex has 64); got a ' + pp.nonce.length + '-character string.');

  for (const [f, label] of REQUIRED_ADDRESSES) {
    if (parseAddress(pp[f]) === null) return refusal('FIELD_MALFORMED', f + ' (' + label + ') must be a non-empty address string; got ' + JSON.stringify(pp[f] ?? null) + '.');
  }
  const amountA = parseU64(pp.amount_a);
  if (amountA === null) return refusal('AMOUNT_INVALID', 'amount_a must be a decimal string in u64 range; got ' + JSON.stringify(pp.amount_a ?? null) + '.');
  const amountB = parseU64(pp.amount_b);
  if (amountB === null) return refusal('AMOUNT_INVALID', 'amount_b must be a decimal string in u64 range; got ' + JSON.stringify(pp.amount_b ?? null) + '.');
  const expiry = parseI64(pp.expiry_timestamp);
  if (expiry === null) return refusal('EXPIRY_INVALID', 'expiry_timestamp must be a decimal string in i64 range; got ' + JSON.stringify(pp.expiry_timestamp ?? null) + '.');
  let earliest = null;
  if (pp.earliest_settlement_timestamp !== undefined && pp.earliest_settlement_timestamp !== null) {
    earliest = parseI64(pp.earliest_settlement_timestamp);
    if (earliest === null) return refusal('EARLIEST_INVALID', 'earliest_settlement_timestamp must be null (None = no lower bound) or a decimal string in i64 range; got ' + JSON.stringify(pp.earliest_settlement_timestamp) + '.');
  }
  const legA = parseU8(pp.leg_a_extras_count);
  if (legA === null) return refusal('HOOK_EXTRAS_INVALID', 'leg_a_extras_count must be a u8 count (0-255) of hook trailing accounts for leg A; got ' + JSON.stringify(pp.leg_a_extras_count ?? null) + '.');
  const legB = parseU8(pp.leg_b_extras_count);
  if (legB === null) return refusal('HOOK_EXTRAS_INVALID', 'leg_b_extras_count must be a u8 count (0-255) of hook trailing accounts for leg B; got ' + JSON.stringify(pp.leg_b_extras_count ?? null) + '.');

  const mintA = parseMintDesc(pp, 'a');
  if (mintA.err) return mintA.err;
  const mintB = parseMintDesc(pp, 'b');
  if (mintB.err) return mintB.err;

  const expP = parseExpected(pp.expected);
  if (expP.err) return expP.err;
  const expected = expP.expected;

  const compliance_flags = [];
  const warnings = [];

  // ---- Checks (README Notes line 33: verify owner, exact LEN, and the stored terms) ----
  const ownerMatches = eqStr(owner, PINNED_OWNER_PROGRAM_ID);

  // The struct LEN pin: 1 + 32*7 + 8*4 + 64 + 32*2 + 32*2 + 1 + 8 = 458. A look-alike account of
  // any other length is not a SwapDvp.
  const lengthMatches = byteLength === BigInt(SWAP_DVP_LEN);

  // Terms match: amounts, expiry, earliest, user_a/user_b, settlement_authority, both
  // settlement destinations (README Notes line 33 terms list, in the struct pin's order).
  const termsMismatches = [];
  if (amountA !== expected.amount_a) termsMismatches.push('amount_a');
  if (amountB !== expected.amount_b) termsMismatches.push('amount_b');
  if (expiry !== expected.expiry) termsMismatches.push('expiry_timestamp');
  if ((earliest === null ? null : earliest.toString()) !== (expected.earliest === null ? null : expected.earliest.toString())) termsMismatches.push('earliest_settlement_timestamp');
  if (!eqStr(pp.user_a, expected.user_a)) termsMismatches.push('user_a');
  if (!eqStr(pp.user_b, expected.user_b)) termsMismatches.push('user_b');
  if (!eqStr(pp.settlement_authority, expected.settlement_authority)) termsMismatches.push('settlement_authority');
  if (!eqStr(pp.destination_a, expected.destination_a)) termsMismatches.push('destination_a');
  if (!eqStr(pp.destination_b, expected.destination_b)) termsMismatches.push('destination_b');
  const termsMatch = termsMismatches.length === 0;

  // earliest <= expiry when earliest is set (README Notes line 26: it inherits the cap because
  // it must be <= expiry).
  const earliestWithinExpiry = earliest === null ? null : earliest <= expiry;

  // expiry <= creation + one year (README Notes line 26: CreateDvp rejects an expiry more than
  // one year past creation).
  const expiryWithinOneYear = expiry <= creation + ONE_YEAR_SECONDS;

  // expiry must still be in the future at the caller-supplied cluster time (README Notes line
  // 24: only Settle rejects after expiry_timestamp — a funder must not fund a record whose
  // settlement window is already closed).
  const expiryInFuture = expiry > now;

  // Blocked extensions (blocked-ext pin): TransferFeeConfig, InterestBearingConfig,
  // ScaledUiAmountConfig, NonTransferable each fail validate_mint_extensions with
  // BlockedMintExtension — on EITHER leg.
  const blockedFound = [];
  const dA = mintA.desc || { extensions: [], frozenByDefault: false, freezeAuthoritySet: false };
  const dB = mintB.desc || { extensions: [], frozenByDefault: false, freezeAuthoritySet: false };
  const legs = [dA, dB];
  for (let li = 0; li < legs.length; li++) {
    const leg = li === 0 ? 'a' : 'b';
    for (const ext of legs[li].extensions) {
      if (BLOCKED_EXTENSIONS.includes(ext)) blockedFound.push('mint_' + leg + ':' + ext);
    }
  }
  const noBlockedExtensions = blockedFound.length === 0;

  // Hook extras per leg <= 32 (hook-cap pin MAX_HOOK_REMAINING_ACCOUNTS; README Notes line 35:
  // "Hook extras are capped at 32 accounts per leg").
  const hookExtrasWithinCap = legA <= BigInt(MAX_HOOK_REMAINING_ACCOUNTS) && legB <= BigInt(MAX_HOOK_REMAINING_ACCOUNTS);

  // ---- Trust flags (accepted as-is by the program; surfaced only) ----
  const trust_flags = [];
  function trustFor(desc, leg) {
    if (desc.extensions.includes('PermanentDelegate')) trust_flags.push('TRUST_PERMANENT_DELEGATE_MINT_' + leg.toUpperCase());
    if (desc.extensions.includes('Pausable')) trust_flags.push('TRUST_PAUSABLE_MINT_' + leg.toUpperCase());
    if (desc.extensions.includes('MintCloseAuthority')) trust_flags.push('TRUST_MINT_CLOSE_AUTHORITY_MINT_' + leg.toUpperCase());
    if (desc.extensions.includes('TransferHook')) trust_flags.push('TRUST_MUTABLE_TRANSFER_HOOK_MINT_' + leg.toUpperCase());
    if (desc.extensions.includes('ConfidentialTransfer') || desc.extensions.includes('ConfidentialTransferFeeConfig')) trust_flags.push('TRUST_CONFIDENTIAL_TRANSFER_MINT_' + leg.toUpperCase());
    if (desc.extensions.includes('DefaultAccountState') || desc.frozenByDefault || desc.freezeAuthoritySet) trust_flags.push('TRUST_FROZEN_BY_DEFAULT_OR_FREEZE_AUTHORITY_MINT_' + leg.toUpperCase());
  }
  trustFor(dA, 'a');
  trustFor(dB, 'b');

  // ---- Verdict assembly ----
  const checks = {
    owner_matches: ownerMatches,
    length_matches: lengthMatches,
    terms_match: termsMatch,
    earliest_within_expiry: earliestWithinExpiry,
    expiry_within_one_year: expiryWithinOneYear,
    expiry_in_future: expiryInFuture,
    no_blocked_extensions: noBlockedExtensions,
    hook_extras_within_cap: hookExtrasWithinCap,
  };
  const failed_checks = [];
  if (!ownerMatches) failed_checks.push('owner');
  if (!lengthMatches) failed_checks.push('length');
  if (!termsMatch) failed_checks.push('terms');
  if (earliestWithinExpiry === false) failed_checks.push('earliest_after_expiry');
  if (!expiryWithinOneYear) failed_checks.push('expiry_over_one_year');
  if (!expiryInFuture) failed_checks.push('expiry_not_in_future');
  if (!noBlockedExtensions) failed_checks.push('blocked_extension');
  if (!hookExtrasWithinCap) failed_checks.push('hook_extras_over_cap');

  const prefundCheck = failed_checks.length === 0 ? 'PASS' : 'FAIL';

  if (prefundCheck === 'FAIL') compliance_flags.push('PREFUND_CHECK_FAIL');
  for (const f of failed_checks) compliance_flags.push('CHECK_FAIL_' + f.toUpperCase());
  for (const f of trust_flags) compliance_flags.push(f);
  if (termsMismatches.length > 0) warnings.push('Terms differ on: ' + termsMismatches.join(', ') + '. A forged CreateDvp with attacker destinations would fail exactly this check (README Notes: verify stored terms before depositing).');
  if (blockedFound.length > 0) warnings.push('Blocked mint extension(s) present: ' + blockedFound.join(', ') + '. The program rejects these with BlockedMintExtension; funding such a leg strands both legs.');
  if (!hookExtrasWithinCap) warnings.push('Hook extras exceed the 32-per-leg cap; the terminal TransferChecked CPI cannot carry them.');
  if (trust_flags.length > 0) warnings.push('Trusted-authority risks accepted as-is by the program: ' + trust_flags.join(', ') + '. Surface these in settlement UIs rather than presenting such mints as ordinary tokens.');
  if (earliest !== null && earliestWithinExpiry && expiryInFuture && now < earliest) warnings.push('Cluster time is before earliest_settlement_timestamp: Settle additionally rejects until then.');
  warnings.push(DISCLAIMER);
  warnings.push(AUDIT_NOTE);
  warnings.push(YEAR_NOTE);
  warnings.push('Cluster time lag: the cluster clock is a validator-vote median that lags real time ~10-30s and can jump; budget ~60s of drift around expiry and earliest boundaries.');

  const output_payload = {
    prefund_check: prefundCheck,
    owner_matches: ownerMatches,
    length_matches: lengthMatches,
    terms_match: termsMatch,
    terms_mismatches: termsMismatches,
    earliest_within_expiry: earliestWithinExpiry,
    expiry_within_one_year: expiryWithinOneYear,
    expiry_in_future: expiryInFuture,
    no_blocked_extensions: noBlockedExtensions,
    blocked_extensions_found: blockedFound,
    hook_extras_within_cap: hookExtrasWithinCap,
    failed_checks,
    trust_flags,
    warnings,
    record: {
      owner_program_id: owner,
      byte_length: byteLength.toString(),
      user_a: pp.user_a, user_b: pp.user_b,
      mint_a: pp.mint_a, mint_b: pp.mint_b,
      token_program_a: pp.token_program_a, token_program_b: pp.token_program_b,
      settlement_authority: pp.settlement_authority,
      destination_a: pp.destination_a, destination_b: pp.destination_b,
      mint_a_authority: pp.mint_a_authority, mint_b_authority: pp.mint_b_authority,
      amount_a: amountA.toString(), amount_b: amountB.toString(),
      expiry_timestamp: expiry.toString(),
      earliest_settlement_timestamp: earliest === null ? null : earliest.toString(),
      creation_timestamp: creation.toString(),
      nonce: pp.nonce,
      now: now.toString(),
      leg_a_extras_count: legA.toString(), leg_b_extras_count: legB.toString(),
    },
    expected_terms_note: 'Verification is only as good as the expected terms supplied: they come from the funder\'s record of the agreed deal, and supplying the forged record\'s own values as "expected" makes the check circular.',
    disclaimer: DISCLAIMER,
    audit_scope_note: AUDIT_NOTE,
    error_direction: 'conservative_toward_finding',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
