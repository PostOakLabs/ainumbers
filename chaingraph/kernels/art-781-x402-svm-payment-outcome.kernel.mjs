// @ts-nocheck — this file inlines the full _noble-ed25519.bundle.mjs vendored library
// (same pattern as art-652/art-703/art-780): the bundle is not checkJs-clean and is never
// edited by hand, so type checking is off for the whole file rather than the vendored bytes.
// art-781-x402-svm-payment-outcome — deterministic clause-verdict recompute of an x402
// `exact`-scheme Solana payment. The caller pastes the decoded transaction message fields
// (instruction list), the x402 PaymentRequirements, the mint's declared token program and
// fee configuration, and optionally Ed25519 signature checks over caller-pasted bytes. The
// node recomputes, clause by clause, whether the payment meets its requirements under the
// pinned spec text and under the pinned reference facilitator, and exposes every place the
// two readings disagree as a DIVERGES verdict. It is a verifier of pasted values only: it
// never funds, initiates, custodies, checks a live balance or calls any payment API.
//
// PROVENANCE (primary text re-pinned at claim 2026-10-29; all pins recorded in the PR):
//   1. x402-foundation/x402 (the canonical repo; coinbase/x402 is a stale fork carrying
//      pre-June text) at commit e4a086819f419e9395acbbdc1679fe6627029ff7,
//      specs/schemes/exact/scheme_exact_svm.md (640 lines at that commit):
//        L5    "a client MUST effect an on-chain payment of an exact amount" (outcome framing);
//        L150  S1.1 required outcome: "A transfer of at least PaymentRequirements.amount";
//        L166-174 S1.2 identification: correct mint, correct destination account "the ATA
//              derived from payTo + asset under the relevant token program", correct amount,
//              correct token program (spl-token or token-2022);
//        L187-192 S1.4 exactly one matching transfer across top-level and CPI, "amount >=
//              required", zero or more than one matching transfer MUST be rejected, and
//              "A matching transfer MAY exceed PaymentRequirements.amount (overpayment is
//              tolerated to accommodate smart wallets with internal fee rounding); it MUST
//              NOT be less";
//        L200+ S1.5 Transaction Versions (MUST): extra.transactionVersions carries JSON
//              integers 0 and/or 1 only, default [0] when absent, non-integer or "legacy"
//              entries fail closed with unsupported_transaction_version;
//        L215  legacy (unversioned) messages are deprecated and never advertised;
//        L276-292 S2.1.1 Fee Payer Isolation: the feePayer MUST NOT appear in the accounts
//              list of any instruction, MUST NOT be invoked as a program, MUST NOT be used
//              as authority, source or delegate; bounded exception: the feePayer MAY appear
//              as the payment recipient when feePayer == payTo;
//        L410-411 Path 1 memo rule: when extra.memo is present exactly one Memo instruction
//              MUST exist and its data MUST match extra.memo encoded UTF-8;
//        L418-421 Path 1 enforces "exact amount match" on both layouts (the spec's own
//              static-path paragraph);
//        L446  S3.4 fallback: when inner instructions are unavailable, the destination ATA
//              balance delta (a net quantity on a transfer-fee mint) MUST be >= required.
//   2. Same repo and commit, reference TypeScript facilitator,
//      typescript/packages/mechanisms/svm/src/exact/facilitator/scheme.ts (1331 lines):
//        L1160 static path rejects amount !== BigInt(requirements.amount) (exact);
//        L1112-1115 static self-spend check: the facilitator's own signers must not be the
//              transfer authority;
//        L359-364 and L767-774 transaction-version admission (peekWireTransactionVersion,
//              isAcceptedTransactionVersion, ErrUnsupportedTransactionVersion).
//      typescript/packages/mechanisms/svm/src/exact/facilitator/smartWalletVerification.ts
//      (863 lines):
//        L657-662 accepts t.amount >= requiredAmount (gross instruction amount);
//        L727-781 accepts t.amount >= requiredAmount for inner transfers;
//        L795-803 accepts balanceAfter - balanceBefore >= requiredAmount (net delta);
//        L837-844 accepts the same net delta across both token programs.
//   3. Kora advisories (GitHub advisory records, fetched 2026-10-29):
//        GHSA-725g-w329-g7qr "kora-lib: Token-2022 Transfer Fee Not Deducted During Payment
//              Verification", severity field medium, published 2026-03-12, patched_versions
//              null on the record (no fixed-version field);
//        GHSA-x442-m7cc-hr92 "kora-lib: Unrecognized Instruction Types Create Empty Stubs
//              That Bypass Fee Payer Policy", severity field medium, published 2026-03-12,
//              patched_versions null on the record.
//      Both advisories hit exactly the seams this node exposes (fee deduction and fee-payer
//      policy); the node cites them as facts, it does not rate them.
//   4. ATA derivation and the off-curve test are the pinned functions copied from
//      art-780-solana-pda-ata-audit (this row's chain predecessor), whose own pins are:
//      solana-labs/solana 7700cb3128c1f19820de67b81aa45d18f73d2ac0 sdk/program/src/pubkey.rs
//      (create_program_address L585-616, try_find_program_address L510-545, bumps 255 down
//      to 1, MAX_SEEDS 16, MAX_SEED_LEN 32, marker "ProgramDerivedAddress");
//      solana-program/associated-token-account 4004274dfb861e09570af873b46cb0b0919e8df0
//      interface/src/address.rs L67-74 (ATA seeds [wallet, token program id, mint] under
//      ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL); spl-token-2022-interface 3.1.2
//      src/lib.rs L29 (Token-2022 id). Copied by hand into this kernel, never imported
//      across node kernels.
//   5. Transfer-fee arithmetic is the art-715 idiom copied by hand: withheld =
//      0 when basis points or amount is zero, else min(ceil(amount*bps/10000), maximum_fee)
//      with 128-bit intermediates (BigInt), Token-2022 transfer-fee extension semantics.
//   CLAUSE DROP, recorded honestly: the staged premise marked Transaction V1
//   spec-undefined. At the pinned commit that clause is dead: spec S1.5 (L200+) defines
//   version-1 acceptance normatively (extra.transactionVersions, integers 0/1, default [0],
//   fail-closed unsupported_transaction_version) and the reference implements the same rule
//   (scheme.ts L359-364, L767-774). Spec and reference now agree, so this node implements
//   the version-admission rule as a PASS/FAIL clause instead of reporting SPEC_UNDEFINED.
//   The remaining clauses (exact vs >=, gross vs net on transfer-fee mints, the smart-wallet
//   paths, wrong-program ATA derivation) still disagree between the readings, which is the
//   node's reason to exist.
//
// PRIMITIVES: SHA-256, Ed25519 point decompression and Ed25519 signature verification are
// the vendored chaingraph/kernels/_noble-ed25519.bundle.mjs (@noble/curves 2.2.0 +
// @noble/hashes 2.2.0), inlined below byte-identical (same inline pattern as
// art-129/art-284/art-598/art-652/art-780; the worker vendor step copies kernel files only,
// so sibling-module imports of the bundle would break the worker bundle). base58 is a local
// copy matching _head.mjs b58e / _proof.mjs b58d. Zero new vendoring.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network,
// no RPC, no fetch, no balance lookup, no facilitator call. Vocabulary: PASS, FAIL, DIVERGES,
// SPEC_UNDEFINED only; never safe, unsafe, risk or intent.
//
// Limits, restated: the node sees the instructions the caller pastes (top-level by default;
// pasted inner instructions are matched too). The spec S1.1 rule spans the full CPI trace,
// so a smart-wallet payment the caller cannot paste inner instructions for gets an honest
// "not supplied" fact, never a verdict the bytes cannot support. Lookup-table contents must
// be pasted resolved; missing ones are reported, never guessed. Splits (extra.splits) are
// out of scope for this version and refused.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-781-x402-svm-payment-outcome';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_x402_svm_outcome',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Pinned algorithm constants.
const PDA_MARKER_UTF8 = 'ProgramDerivedAddress';
const MAX_SEEDS = 16;        // create_program_address: seeds.len() > 16 -> MaxSeedLengthExceeded
const MAX_SEED_LEN = 32;     // per-seed byte cap
const BUMP_MAX = 255;        // try_find_program_address starts at u8::MAX
const BUMP_MIN = 1;          // and tries 255 candidates: 255 down to 1; 0 is never tried
const ATA_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const CLASSIC_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ADDRESS_BYTES = 32;
const BPS_DENOM = 10000n;    // art-715 idiom

// base58 (local copy matching _head.mjs b58encode / _proof.mjs b58decode; no cross-kernel
// import — same discipline as art-652/art-780 local copies).
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(bytes) {
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = ''; for (let k = 0; k < zeros; k++) out += '1';
  for (let q = digits.length - 1; q >= 0; q--) out += B58[digits[q]];
  return out;
}
function b58decode(str) {
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < str.length; i++) {
    const carry = B58.indexOf(str[i]); if (carry < 0) throw new Error('bad base58 char');
    let c = carry;
    for (let j = 0; j < bytes.length; j++) { c += bytes[j] * 58; bytes[j] = c & 0xff; c >>= 8; }
    while (c) { bytes.push(c & 0xff); c >>= 8; }
  }
  if (bytes.length === 1 && bytes[0] === 0) bytes.length = 0;
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
  return out;
}
function parseAddress(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 64) return null;
  let bytes;
  try { bytes = b58decode(s); } catch { return null; }
  if (bytes.length !== ADDRESS_BYTES) return null;
  return bytes;
}
function bytesToHex(b) { let o = ''; for (let i = 0; i < b.length; i++) o += b[i].toString(16).padStart(2, '0'); return o; }
function hexToBytes(h) {
  if (typeof h !== 'string' || h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) return null;
  const out = new Uint8Array(h.length / 2);
  for (let k = 0; k < out.length; k++) out[k] = parseInt(h.slice(k * 2, k * 2 + 2), 16);
  return out;
}

// Guest-safe UTF-8 encode (same copy as art-780: no TextEncoder, surrogate pairs handled,
// lone surrogates become U+FFFD exactly like TextEncoder).
function utf8Encode(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        i++;
      } else out.push(0xef, 0xbf, 0xbd);
    } else if (c >= 0xd800 && c <= 0xdfff) out.push(0xef, 0xbf, 0xbd);
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}
function isNonEmptyString(s) { return typeof s === 'string' && s.length > 0; }

function parseU64Decimal(s) {
  if (typeof s !== 'string' || !/^(0|[1-9][0-9]*)$/.test(s)) return null;
  if (s.length > 20) return null;
  const v = BigInt(s);
  if (v > 18446744073709551615n) return null; // u64
  return v;
}
function parseU16Decimal(s) {
  if (typeof s !== 'string' || !/^(0|[1-9][0-9]*)$/.test(s)) return null;
  const v = BigInt(s);
  if (v > 65535n) return null;
  return v;
}

// Off-curve test (pin 4: bytes_are_curve_point -> CompressedEdwardsY decompress).
function isOnCurve(bytes32) {
  try { __noble.ed25519.Point.fromHex(bytesToHex(bytes32)); return true; } catch { return false; }
}

// create_program_address semantics for one candidate bump (pin 4, copied from art-780):
// preimage = seeds (in declared order) || [bump] || program_id || "ProgramDerivedAddress".
function deriveWithBump(seedBytes, bump, programIdBytes) {
  const parts = [];
  for (const s of seedBytes) parts.push(s);
  parts.push(new Uint8Array([bump]));
  parts.push(programIdBytes);
  parts.push(utf8Encode(PDA_MARKER_UTF8));
  let len = 0; for (const p of parts) len += p.length;
  const pre = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { pre.set(p, off); off += p.length; }
  return __noble.sha256(pre);
}

// try_find_program_address semantics: candidate bumps 255 down to 1, first off-curve wins.
function findCanonical(seedBytes, programIdBytes) {
  for (let bump = BUMP_MAX; bump >= BUMP_MIN; bump--) {
    const h = deriveWithBump(seedBytes, bump, programIdBytes);
    if (!isOnCurve(h)) return { bump, address: b58encode(h) };
  }
  return null;
}

// Associated token account under a token program: seeds [wallet, token_program, mint]
// under the ATA program (pin 4; the function art-780 audited, copied by hand).
function ataFor(walletBytes, tokenProgramBytes, mintBytes) {
  const ataProgramBytes = parseAddress(ATA_PROGRAM_ID);
  const r = findCanonical([walletBytes, tokenProgramBytes, mintBytes], ataProgramBytes);
  return r; // { bump, address } | null
}

// art-715 idiom, copied by hand: withheld transfer fee on a Token-2022 transfer-fee mint.
// 0 when bps == 0 or amount == 0; else min(ceil(amount*bps/10000), maximum_fee), 128-bit
// intermediates.
function ceilDiv(n, d) { return (n + d - 1n) / d; }
function transferFee(amount, bps, maxFee) {
  if (bps === 0n || amount === 0n) return 0n;
  const raw = amount * bps;
  const ceiled = ceilDiv(raw, BPS_DENOM);
  return ceiled > maxFee ? maxFee : ceiled;
}

const SPEC_PIN = 'x402-foundation/x402 at commit e4a086819f419e9395acbbdc1679fe6627029ff7 (canonical repo), specs/schemes/exact/scheme_exact_svm.md';
const REF_PIN = 'typescript/packages/mechanisms/svm/src/exact/facilitator/{scheme.ts,smartWalletVerification.ts} at the same commit';
const GHSA_PIN = 'GHSA-725g-w329-g7qr and GHSA-x442-m7cc-hr92, severity field medium on both records, patched_versions null on both (GitHub advisory API, 2026-10-29)';

const REFUSAL_FIELDS = () => ({
  requirements_echo: null, transaction_version: null, instruction_summary: null,
  recipient_atas: null, matching_transfers: null, net_received: null,
  signature_checks: null, verdicts: null, clause_summary: null, note: null,
});

function refusal(code, detail) {
  return {
    output_payload: { error: code.toLowerCase(), detail, domain_errors: [{ code, text: detail }], ...REFUSAL_FIELDS() },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

const VALID_INSTRUCTION_KINDS = ['transfer_checked', 'memo', 'compute_unit_limit', 'compute_unit_price', 'other'];
const VALID_TOKEN_PROGRAMS = ['spl-token', 'token-2022'];
function tokenProgramAddress(tp) {
  if (tp === 'spl-token') return CLASSIC_TOKEN_PROGRAM_ID;
  if (tp === 'token-2022') return TOKEN_2022_PROGRAM_ID;
  return null;
}

/**
 * compute(pp) — pure clause-verdict recompute kernel (values only; nothing on-chain is read,
 * no facilitator is called, no balance is looked up).
 * pp: {
 *   requirements: {
 *     asset: string,           // mint address, base58 (32 bytes)
 *     amount: string,          // required amount, decimal string, u64 range (base units)
 *     pay_to: string,          // recipient wallet, base58 (32 bytes)
 *     extra: {
 *       fee_payer: string,     // sponsor fee payer, base58 (32 bytes); REQUIRED
 *       memo?: string,         // required memo text when present
 *       transaction_versions?: number[]  // JSON integers 0 and/or 1; default [0]
 *     }
 *   },
 *   transaction: {
 *     version: 'legacy' | 0 | 1,
 *     instructions: [ { kind: 'transfer_checked', token_program: 'spl-token'|'token-2022',
 *                       source, destination, authority (base58), amount (decimal string),
 *                       decimals (number), is_inner?: true }
 *                   | { kind: 'memo', text: string }
 *                   | { kind: 'compute_unit_limit', units: number }
 *                   | { kind: 'compute_unit_price', micro_lamports: string }
 *                   | { kind: 'other', program_id: string, accounts: [string] } ]
 *   },
 *   mint: {
 *     token_program: 'spl-token' | 'token-2022',
 *     decimals: number,
 *     transfer_fee?: { transfer_fee_basis_points: string, maximum_fee: string }  // decimal strings
 *   },
 *   signature_checks?: [ { public_key: string (base58), message_hex: string,
 *                          signature_hex: string (128 hex chars) } ]
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = deNull(pp || {});

  // ---- requirements -------------------------------------------------------
  if (!pp.requirements || typeof pp.requirements !== 'object' || Array.isArray(pp.requirements)) {
    return refusal('REQUIREMENTS_MALFORMED', 'requirements must be an object { asset, amount, pay_to, extra { fee_payer, memo?, transaction_versions? } }.');
  }
  const rq = pp.requirements;
  const assetBytes = parseAddress(rq.asset);
  if (assetBytes === null) return refusal('REQUIREMENTS_MALFORMED', 'requirements.asset must be a base58 string decoding to 32 bytes (the mint address); got ' + JSON.stringify(rq.asset ?? null) + '.');
  const requiredAmount = parseU64Decimal(rq.amount);
  if (requiredAmount === null) return refusal('AMOUNT_INVALID', 'requirements.amount must be a decimal string in u64 range (base units); got ' + JSON.stringify(rq.amount ?? null) + '.');
  const payToBytes = parseAddress(rq.pay_to);
  if (payToBytes === null) return refusal('REQUIREMENTS_MALFORMED', 'requirements.pay_to must be a base58 string decoding to 32 bytes (the recipient wallet); got ' + JSON.stringify(rq.pay_to ?? null) + '.');

  const ex = rq.extra && typeof rq.extra === 'object' && !Array.isArray(rq.extra) ? rq.extra : {};
  if (ex.splits !== undefined) {
    return refusal('SPLITS_NOT_SUPPORTED', 'requirements.extra.splits is out of scope for this version (single-payee charges only); the spec S5 multi-payee rules are not implemented here.');
  }
  if (ex.transaction_url !== undefined || ex.max_fee_sponsored !== undefined) {
    return refusal('EXTRA_MALFORMED', 'requirements.extra carries unsupported fields; this version reads fee_payer, memo and transaction_versions only.');
  }
  const feePayerBytes = parseAddress(ex.fee_payer);
  if (feePayerBytes === null) return refusal('EXTRA_MALFORMED', 'requirements.extra.fee_payer must be a base58 string decoding to 32 bytes (the sponsor fee payer; the facilitator /supported response carries it); got ' + JSON.stringify(ex.fee_payer ?? null) + '.');
  if (ex.memo !== undefined && typeof ex.memo !== 'string') {
    return refusal('EXTRA_MALFORMED', 'requirements.extra.memo, when present, must be a string (the memo text the transfer must carry).');
  }
  // transaction_versions: absent -> [0]; entries must be the JSON integers 0/1 only.
  let versionsField = ex.transaction_versions;
  if (versionsField === undefined) versionsField = [0];
  if (!Array.isArray(versionsField)) {
    return refusal('EXTRA_MALFORMED', 'requirements.extra.transaction_versions, when present, must be an array of the JSON integers 0 and/or 1 (spec S1.5); got ' + JSON.stringify(ex.transaction_versions ?? null) + '.');
  }
  for (const v of versionsField) {
    if (typeof v !== 'number' || !Number.isInteger(v) || (v !== 0 && v !== 1)) {
      return refusal('EXTRA_MALFORMED', 'requirements.extra.transaction_versions entries must be the JSON integers 0 and/or 1; a string, null, "legacy" or any other integer is invalid and fails closed (spec S1.5); got ' + JSON.stringify(v) + '.');
    }
  }
  const acceptedVersions = versionsField;
  const feePayer = ex.fee_payer;

  // ---- transaction --------------------------------------------------------
  if (!pp.transaction || typeof pp.transaction !== 'object' || Array.isArray(pp.transaction)) {
    return refusal('TRANSACTION_MALFORMED', 'transaction must be an object { version, instructions[] } with the decoded message fields pasted by the caller.');
  }
  const txVersionRaw = pp.transaction.version;
  let txVersion;
  if (txVersionRaw === 'legacy') txVersion = 'legacy';
  else if (txVersionRaw === 0 || txVersionRaw === 1) txVersion = txVersionRaw;
  else return refusal('TRANSACTION_MALFORMED', 'transaction.version must be "legacy", 0 or 1; got ' + JSON.stringify(txVersionRaw ?? null) + '.');
  if (!Array.isArray(pp.transaction.instructions)) {
    return refusal('TRANSACTION_MALFORMED', 'transaction.instructions must be an array of decoded instruction objects.');
  }
  const instructions = [];
  for (let i = 0; i < pp.transaction.instructions.length; i++) {
    const raw = pp.transaction.instructions[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '] must be an object.');
    }
    if (!VALID_INSTRUCTION_KINDS.includes(raw.kind)) {
      return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].kind must be one of ' + VALID_INSTRUCTION_KINDS.map(k => JSON.stringify(k)).join(', ') + '; got ' + JSON.stringify(raw.kind ?? null) + '.');
    }
    const ins = { index: i, kind: raw.kind, is_inner: raw.is_inner === true };
    if (raw.is_inner !== undefined && raw.is_inner !== true && raw.is_inner !== false) {
      return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].is_inner, when present, must be a boolean (true marks a caller-pasted inner/CPI instruction).');
    }
    if (raw.kind === 'transfer_checked') {
      if (!VALID_TOKEN_PROGRAMS.includes(raw.token_program)) {
        return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].token_program must be "spl-token" or "token-2022" for a transfer_checked instruction; got ' + JSON.stringify(raw.token_program ?? null) + '.');
      }
      ins.token_program = raw.token_program;
      ins.source = parseAddress(raw.source);
      if (ins.source === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].source must be a base58 32-byte address.');
      ins.mint = parseAddress(raw.mint);
      if (ins.mint === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].mint must be a base58 32-byte address.');
      ins.destination = parseAddress(raw.destination);
      if (ins.destination === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].destination must be a base58 32-byte address.');
      ins.authority = parseAddress(raw.authority);
      if (ins.authority === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].authority must be a base58 32-byte address.');
      ins.amount = parseU64Decimal(raw.amount);
      if (ins.amount === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].amount must be a decimal string in u64 range.');
      if (typeof raw.decimals !== 'number' || !Number.isInteger(raw.decimals) || raw.decimals < 0 || raw.decimals > 9) {
        return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].decimals must be an integer 0..9 (the TransferChecked decimals operand).');
      }
      ins.decimals = raw.decimals;
      ins.source_s = raw.source; ins.mint_s = raw.mint; ins.destination_s = raw.destination; ins.authority_s = raw.authority;
    } else if (raw.kind === 'memo') {
      if (typeof raw.text !== 'string') {
        return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].text must be a string for a memo instruction.');
      }
      ins.text = raw.text;
    } else if (raw.kind === 'compute_unit_limit') {
      if (typeof raw.units !== 'number' || !Number.isInteger(raw.units) || raw.units < 0 || raw.units > 4294967295) {
        return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].units must be an integer 0..4294967295 (u32).');
      }
      ins.units = raw.units;
    } else if (raw.kind === 'compute_unit_price') {
      const m = parseU64Decimal(raw.micro_lamports);
      if (m === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].micro_lamports must be a decimal string in u64 range.');
      ins.micro_lamports = m;
    } else { // other
      const pid = parseAddress(raw.program_id);
      if (pid === null) return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].program_id must be a base58 32-byte address for an "other" instruction.');
      ins.program_id_s = raw.program_id;
      if (!Array.isArray(raw.accounts) || raw.accounts.some(a => parseAddress(a) === null)) {
        return refusal('INSTRUCTION_MALFORMED', 'transaction.instructions[' + i + '].accounts must be an array of base58 32-byte addresses (paste them ALT-resolved; missing lookup-table contents fail closed).');
      }
      ins.accounts_s = raw.accounts.slice();
    }
    instructions.push(ins);
  }

  // ---- mint ---------------------------------------------------------------
  if (!pp.mint || typeof pp.mint !== 'object' || Array.isArray(pp.mint)) {
    return refusal('MINT_CONFIG_MALFORMED', 'mint must be an object { token_program, decimals, transfer_fee? } describing the asset the requirements name.');
  }
  if (!VALID_TOKEN_PROGRAMS.includes(pp.mint.token_program)) {
    return refusal('MINT_CONFIG_MALFORMED', 'mint.token_program must be "spl-token" or "token-2022" (the program the mint lives under).');
  }
  if (typeof pp.mint.decimals !== 'number' || !Number.isInteger(pp.mint.decimals) || pp.mint.decimals < 0 || pp.mint.decimals > 9) {
    return refusal('MINT_CONFIG_MALFORMED', 'mint.decimals must be an integer 0..9.');
  }
  const mintDecimals = pp.mint.decimals;
  let feeBps = null, feeMax = null;
  if (pp.mint.transfer_fee !== undefined) {
    const tf = pp.mint.transfer_fee;
    if (!tf || typeof tf !== 'object' || Array.isArray(tf)) {
      return refusal('MINT_CONFIG_MALFORMED', 'mint.transfer_fee must be an object { transfer_fee_basis_points, maximum_fee } with decimal-string values (Token-2022 transfer-fee extension).');
    }
    feeBps = parseU16Decimal(tf.transfer_fee_basis_points);
    if (feeBps === null) return refusal('MINT_CONFIG_MALFORMED', 'mint.transfer_fee.transfer_fee_basis_points must be a decimal string in u16 range.');
    feeMax = parseU64Decimal(tf.maximum_fee);
    if (feeMax === null) return refusal('MINT_CONFIG_MALFORMED', 'mint.transfer_fee.maximum_fee must be a decimal string in u64 range.');
  }
  const declaredTokenProgram = pp.mint.token_program;

  // ---- signature checks (optional; caller-pasted bytes only) --------------
  let sigChecks = null;
  if (pp.signature_checks !== undefined) {
    if (!Array.isArray(pp.signature_checks)) {
      return refusal('SIGNATURE_CHECK_MALFORMED', 'signature_checks, when present, must be an array of { public_key, message_hex, signature_hex }.');
    }
    sigChecks = [];
    for (let i = 0; i < pp.signature_checks.length; i++) {
      const sc = pp.signature_checks[i];
      if (!sc || typeof sc !== 'object' || Array.isArray(sc)) {
        return refusal('SIGNATURE_CHECK_MALFORMED', 'signature_checks[' + i + '] must be an object { public_key, message_hex, signature_hex }.');
      }
      const pkBytes = parseAddress(sc.public_key);
      if (pkBytes === null) return refusal('SIGNATURE_CHECK_MALFORMED', 'signature_checks[' + i + '].public_key must be a base58 32-byte Ed25519 public key.');
      const msg = hexToBytes(sc.message_hex);
      if (msg === null) return refusal('SIGNATURE_CHECK_MALFORMED', 'signature_checks[' + i + '].message_hex must be an even-length hex string (the caller-pasted signed bytes).');
      const sig = hexToBytes(sc.signature_hex);
      if (sig === null || sig.length !== 64) {
        return refusal('SIGNATURE_CHECK_MALFORMED', 'signature_checks[' + i + '].signature_hex must be a 128-hex-character (64-byte) Ed25519 signature.');
      }
      let valid = false;
      try { valid = __noble.ed25519.verify(sig, msg, pkBytes); } catch { valid = false; }
      sigChecks.push({ public_key: sc.public_key, message_hex: sc.message_hex, signature_hex: sc.signature_hex, valid });
    }
  }

  // ==== recomputation ======================================================

  // -- recipient ATAs under both token programs (art-780 derivation, pin 4)
  const declaredProgramAddress = tokenProgramAddress(declaredTokenProgram);
  const classicProgramAddress = CLASSIC_TOKEN_PROGRAM_ID;
  const ataDeclared = ataFor(payToBytes, parseAddress(declaredProgramAddress), assetBytes);
  const ataClassic = declaredTokenProgram === 'spl-token'
    ? ataDeclared
    : ataFor(payToBytes, parseAddress(classicProgramAddress), assetBytes);
  const atasDiffer = ataDeclared !== null && ataClassic !== null && ataDeclared.address !== ataClassic.address;

  // -- matching transfers: kind transfer_checked, mint == asset, destination ==
  //    the ATA under that instruction's OWN token program (spec S1.2: the ATA under the
  //    relevant token program), across top-level and pasted inner instructions.
  const transfers = instructions.filter(t => t.kind === 'transfer_checked');
  const matching = [];
  for (const t of transfers) {
    if (t.mint_s !== rq.asset) continue;
    const expected = ataFor(payToBytes, parseAddress(tokenProgramAddress(t.token_program)), assetBytes);
    if (expected !== null && t.destination_s === expected.address) matching.push({ ins: t, expected_ata: expected.address });
  }
  const unique = matching.length === 1;
  const match = unique ? matching[0].ins : null;

  // wrong-program ATA: the destination equals the ATA under the OTHER token program while
  // the mint is declared under a different one (the substitution free derivations hide).
  let wrongProgramAta = false;
  let wrongProgramDetail = null;
  if (!unique) {
    for (const t of transfers) {
      if (t.mint_s !== rq.asset) continue;
      const otherProgram = t.token_program === 'token-2022' ? 'spl-token' : 'token-2022';
      const otherAta = ataFor(payToBytes, parseAddress(tokenProgramAddress(otherProgram)), assetBytes);
      const ownAta = ataFor(payToBytes, parseAddress(tokenProgramAddress(t.token_program)), assetBytes);
      if (otherAta !== null && t.destination_s === otherAta.address && (ownAta === null || t.destination_s !== ownAta.address)) {
        wrongProgramAta = true;
        wrongProgramDetail = 'instruction ' + t.index + ' destination is the ATA under ' + otherProgram + ' while the instruction carries token_program ' + JSON.stringify(t.token_program);
      }
    }
  }

  // -- fee math (art-715 idiom)
  let gross = null, withheld = null, net = null;
  if (match !== null) {
    gross = match.amount;
    if (feeBps !== null) {
      withheld = transferFee(gross, feeBps, feeMax);
    } else {
      withheld = 0n;
    }
    net = gross - withheld;
  }

  // -- clause verdicts
  const verdicts = [];
  const compliance_flags = [];

  // 1) amount rule
  {
    const specReading = SPEC_PIN + ' L150 (S1.1: a transfer of at least PaymentRequirements.amount) and L187-L192 (S1.4: a matching transfer MAY exceed the amount, overpayment is tolerated; it MUST NOT be less): >= required';
    const refReading = REF_PIN + ': scheme.ts L1160 rejects amount !== requirements.amount (static path, exact); smartWalletVerification.ts L657-L662 and L727-L781 accept t.amount >= requiredAmount; L795-L803 and L837-L844 accept balanceAfter - balanceBefore >= requiredAmount';
    let verdict, evidence;
    if (match === null) {
      verdict = 'FAIL';
      evidence = 'no unique matching transfer exists, so no amount reading can accept (spec S1.4 rejects zero and ambiguous matches)';
    } else if (match.amount < requiredAmount) {
      verdict = 'FAIL';
      evidence = 'instruction amount ' + match.amount.toString() + ' is less than required ' + requiredAmount.toString() + ': every reading rejects (S1.4 MUST NOT be less; scheme.ts L1160; smartWalletVerification.ts L662)';
      compliance_flags.push('AMOUNT_BELOW_REQUIRED');
    } else if (match.amount > requiredAmount) {
      verdict = 'DIVERGES';
      evidence = 'instruction amount ' + match.amount.toString() + ' exceeds required ' + requiredAmount.toString() + ': the spec outcome accepts (S1.4 overpayment tolerated) while the static path rejects (scheme.ts L1160 exact inequality)';
      compliance_flags.push('AMOUNT_OVERPAYMENT_DIVERGES');
    } else {
      verdict = 'PASS';
      evidence = 'instruction amount ' + match.amount.toString() + ' equals required ' + requiredAmount.toString() + ': every reading accepts';
    }
    verdicts.push({ clause: 'amount_rule', question: 'does the matched transfer carry the required amount', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 2) exactly one matching transfer
  {
    const specReading = SPEC_PIN + ' L187-L189 (S1.4: exactly one transfer MUST match across top-level instructions and the full CPI trace; zero matches MUST be rejected; more than one MUST be rejected as ambiguous)';
    const refReading = REF_PIN + ': scheme.ts parses the single TransferChecked in the static layout; smartWalletVerification.ts L727-L781 collects matching inner transfers and L781 accepts when matching.length >= 1';
    let verdict, evidence;
    if (matching.length === 1) {
      verdict = 'PASS';
      evidence = 'exactly one pasted instruction (index ' + match.index + ') is a TransferChecked of the required mint to the recomputed destination ATA under its own token program';
    } else if (matching.length === 0) {
      verdict = 'FAIL';
      evidence = 'zero matching transfers among ' + transfers.length + ' pasted transfer_checked instruction(s)' + (wrongProgramDetail !== null ? '; ' + wrongProgramDetail : '');
      compliance_flags.push('NO_MATCHING_TRANSFER');
    } else {
      verdict = 'FAIL';
      evidence = matching.length + ' pasted instructions match mint and destination ATA, which the spec S1.4 rejects as ambiguous (potential double-payment)';
      compliance_flags.push('AMBIGUOUS_MATCHING_TRANSFERS');
    }
    verdicts.push({ clause: 'single_matching_transfer', question: 'is there exactly one transfer matching mint, destination ATA and token program', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 3) destination ATA correctness
  {
    const specReading = SPEC_PIN + ' L166-L174 (S1.2: correct destination account, the ATA derived from pay_to and asset under the relevant token program; correct token program, spl-token or token-2022)';
    const refReading = REF_PIN + ': scheme.ts derives the expected ATA for the parsed TransferChecked; the derivation under the classic program only is the wrong-derivation class the pinned ATA source deprecates for Token-2022 mints';
    let verdict, evidence;
    if (wrongProgramAta) {
      verdict = 'FAIL';
      evidence = wrongProgramDetail + '; the mint is declared under ' + JSON.stringify(declaredTokenProgram) + ', so the classic-program ATA is not the account the requirements name';
      compliance_flags.push('WRONG_PROGRAM_ATA');
    } else if (unique) {
      verdict = 'PASS';
      evidence = 'instruction ' + match.index + ' destination equals the recomputed ATA under ' + match.token_program + ' (' + matching[0].expected_ata + ')';
    } else if (matching.length === 0) {
      verdict = 'FAIL';
      evidence = 'no pasted transfer lands on the recomputed destination ATA under either token program (declared-program ATA ' + (ataDeclared === null ? 'null' : ataDeclared.address) + ', classic-program ATA ' + (ataClassic === null ? 'null' : ataClassic.address) + ')';
      compliance_flags.push('WRONG_PROGRAM_ATA');
    } else {
      verdict = 'FAIL';
      evidence = matching.length + ' pasted transfers land on the recomputed ATA; the single-transfer rule fails before the destination rule can pass';
    }
    verdicts.push({ clause: 'destination_ata', question: 'does the matched transfer pay the recomputed recipient ATA under the relevant token program', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 4) fee-payer isolation
  {
    const specReading = SPEC_PIN + ' L276-L292 (S2.1.1: the feePayer MUST NOT appear in the accounts list of any instruction, MUST NOT be invoked as a program, MUST NOT be an authority, source or delegate; the feePayer MAY appear as the payment recipient when feePayer == pay_to)';
    const refReading = REF_PIN + ': the static path checks that the facilitator signers are not the transfer authority (scheme.ts L1112-L1115); the account-by-account isolation scan above implements the spec rule, which is broader than that single check';
    const violations = [];
    for (const t of transfers) {
      if (t.source_s === feePayer) violations.push('instruction ' + t.index + ' lists the fee payer as transfer source');
      if (t.authority_s === feePayer) violations.push('instruction ' + t.index + ' lists the fee payer as transfer authority');
      if (t.destination_s === feePayer && !(feePayer === rq.pay_to)) violations.push('instruction ' + t.index + ' lists the fee payer as transfer destination while fee_payer != pay_to');
    }
    for (const t of instructions) {
      if (t.kind === 'other') {
        if (t.program_id_s === feePayer) violations.push('instruction ' + t.index + ' invokes the fee payer as a program');
        for (let k = 0; k < t.accounts_s.length; k++) {
          if (t.accounts_s[k] === feePayer) violations.push('instruction ' + t.index + ' account[' + k + '] is the fee payer');
        }
      }
    }
    let verdict, evidence;
    if (violations.length === 0) {
      verdict = 'PASS';
      evidence = 'the fee payer ' + feePayer + ' appears in no pasted instruction account, is no transfer source or authority, and is invoked as no program' + (feePayer === rq.pay_to ? '; the fee payer equals pay_to, the recipient exception the spec allows' : '');
    } else {
      verdict = 'FAIL';
      evidence = violations.join('; ');
      compliance_flags.push('FEE_PAYER_ISOLATION_VIOLATED');
    }
    verdicts.push({ clause: 'fee_payer_isolation', question: 'is the fee payer absent from every instruction account and role', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 5) net received on a transfer-fee mint
  {
    const specReading = SPEC_PIN + ' L446 (S3.4 fallback: the destination ATA balance delta, a net quantity on a transfer-fee mint, MUST be >= the required amount); the spec text never mentions the Token-2022 transfer-fee extension by name (no transfer-fee or withheld wording anywhere in the document)';
    const refReading = REF_PIN + ': scheme.ts L1160 compares the gross instruction amount; smartWalletVerification.ts L795-L803 and L837-L844 compare the net balance delta; GHSA-725g-w329-g7qr (kora-lib, Token-2022 Transfer Fee Not Deducted During Payment Verification, severity medium) hits exactly this seam';
    let verdict, evidence;
    if (match === null) {
      verdict = 'FAIL';
      evidence = 'no unique matching transfer, so neither a gross nor a net reading has a transfer to judge';
    } else {
      const staticAccepts = match.amount === requiredAmount;
      const netAccepts = net >= requiredAmount;
      if (staticAccepts && netAccepts) {
        verdict = 'PASS';
        evidence = 'gross ' + gross.toString() + ' equals required and net ' + net.toString() + ' is at least required' + (withheld > 0n ? ' (withheld ' + withheld.toString() + ' deducted from the gross by the transfer-fee arithmetic)' : '') + ': both readings accept';
      } else if (!staticAccepts && !netAccepts) {
        verdict = 'FAIL';
        evidence = 'gross ' + gross.toString() + ' and net ' + net.toString() + ' both fail their readings against required ' + requiredAmount.toString();
        if (net < requiredAmount && withheld > 0n) compliance_flags.push('NET_BELOW_REQUIRED_ON_FEE_MINT');
      } else {
        verdict = 'DIVERGES';
        evidence = (staticAccepts
          ? 'gross ' + gross.toString() + ' equals required so the static path accepts, but net ' + net.toString() + ' is below required after the ' + withheld.toString() + ' withheld fee, so the balance-delta reading rejects'
          : 'gross ' + gross.toString() + ' fails the static exact reading, but net ' + net.toString() + ' is at least required so the balance-delta reading accepts')
          + (feeBps !== null ? ' (transfer_fee_basis_points ' + feeBps.toString() + ', maximum_fee ' + feeMax.toString() + ')' : '');
        compliance_flags.push('GROSS_NET_DIVERGES_ON_FEE_MINT');
      }
    }
    verdicts.push({ clause: 'net_amount_on_fee_mint', question: 'does the recipient net at least the required amount after any Token-2022 transfer fee', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 6) memo rule
  {
    const specReading = SPEC_PIN + ' L410-L411 (Path 1: when extra.memo is present the facilitator MUST verify exactly one Memo instruction exists and its data matches extra.memo encoded UTF-8)';
    const refReading = REF_PIN + ': the memo count and byte match run on the static layout (scheme.ts memoInstructions filter) and mirror on Path 2 (smartWalletVerification memo enforcement)';
    const memoInstructions = instructions.filter(t => t.kind === 'memo');
    let verdict, evidence;
    if (ex.memo === undefined) {
      verdict = 'PASS';
      evidence = 'requirements.extra.memo is absent, so the memo rule does not bind; ' + memoInstructions.length + ' memo instruction(s) pasted are counted as layout facts only';
    } else {
      const matches = memoInstructions.filter(t => utf8Encode(t.text).length === utf8Encode(ex.memo).length && t.text === ex.memo);
      if (memoInstructions.length === 1 && matches.length === 1) {
        verdict = 'PASS';
        evidence = 'exactly one memo instruction pasted and its text equals extra.memo byte for byte (UTF-8)';
      } else {
        verdict = 'FAIL';
        evidence = memoInstructions.length + ' memo instruction(s) pasted, ' + matches.length + ' matching extra.memo; the rule needs exactly one match';
        compliance_flags.push('MEMO_MISMATCH');
      }
    }
    verdicts.push({ clause: 'memo_rule', question: 'when a memo is required, does exactly one memo instruction carry it byte for byte', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 7) transaction-version admission (the clause the re-pin converted from
  //    spec-undefined to spec-defined; see the drop note above)
  {
    const specReading = SPEC_PIN + ' L200+ (S1.5: extra.transactionVersions carries the JSON integers 0 and/or 1, default [0] when absent; a message version outside the advertised set fails closed as unsupported_transaction_version) and L215 (legacy messages are deprecated and never advertised)';
    const refReading = REF_PIN + ': scheme.ts L359-L364 and L767-L774 read the wire version before signature work (peekWireTransactionVersion, isAcceptedTransactionVersion) and refuse with ErrUnsupportedTransactionVersion';
    let verdict, evidence;
    if (txVersion === 'legacy') {
      verdict = 'FAIL';
      evidence = 'the pasted message is legacy (unversioned); legacy is deprecated and never advertised, so it is outside every accepted set';
      compliance_flags.push('VERSION_NOT_ACCEPTED');
    } else if (acceptedVersions.includes(txVersion)) {
      verdict = 'PASS';
      evidence = 'message version ' + txVersion + ' is inside the advertised set [' + acceptedVersions.join(', ') + ']';
    } else {
      verdict = 'FAIL';
      evidence = 'message version ' + txVersion + ' is outside the advertised set [' + acceptedVersions.join(', ') + ']' + (ex.transaction_versions === undefined ? ' (absent extra.transaction_versions defaults to [0], spec S1.5)' : '');
      compliance_flags.push('VERSION_NOT_ACCEPTED');
    }
    verdicts.push({ clause: 'transaction_version', question: 'is the pasted message version one the requirements advertise', spec_reading: specReading, reference_reading: refReading, verdict, evidence });
  }

  // 8) client signature checks (optional, caller-pasted bytes)
  if (sigChecks !== null) {
    const specReading = SPEC_PIN + ' L96 (the transaction field is a base64-encoded, serialized, partially-signed versioned Solana transaction; signature verification runs over the caller-pasted bytes, never a re-serialization by this node)';
    const refReading = REF_PIN + ': signature verification is Ed25519 over the wire bytes; this node performs the same check on the bytes the caller pastes';
    const allValid = sigChecks.every(s => s.valid);
    verdicts.push({
      clause: 'client_signature',
      question: 'do the pasted Ed25519 signatures verify over the pasted bytes',
      spec_reading: specReading, reference_reading: refReading,
      verdict: allValid ? 'PASS' : 'FAIL',
      evidence: sigChecks.length + ' signature check(s) pasted, ' + sigChecks.filter(s => s.valid).length + ' valid',
    });
    if (!allValid) compliance_flags.push('SIGNATURE_INVALID');
  }

  // ---- assembly -----------------------------------------------------------
  const clause_summary = {
    pass: verdicts.filter(v => v.verdict === 'PASS').length,
    fail: verdicts.filter(v => v.verdict === 'FAIL').length,
    diverges: verdicts.filter(v => v.verdict === 'DIVERGES').length,
    spec_undefined: verdicts.filter(v => v.verdict === 'SPEC_UNDEFINED').length,
  };

  const instruction_summary = instructions.map(t => {
    const row = { index: t.index, kind: t.kind, is_inner: t.is_inner === true };
    if (t.kind === 'transfer_checked') {
      row.token_program = t.token_program;
      row.program_id = tokenProgramAddress(t.token_program);
      row.mint = t.mint_s; row.source = t.source_s; row.destination = t.destination_s; row.authority = t.authority_s;
      row.amount = t.amount.toString(); row.decimals = t.decimals;
    } else if (t.kind === 'memo') {
      row.program_id = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'; row.text_length = utf8Encode(t.text).length;
    } else if (t.kind === 'compute_unit_limit') {
      row.program_id = 'ComputeBudget111111111111111111111111111111'; row.units = t.units;
    } else if (t.kind === 'compute_unit_price') {
      row.program_id = 'ComputeBudget111111111111111111111111111111'; row.micro_lamports = t.micro_lamports.toString();
    } else {
      row.program_id = t.program_id_s; row.account_count = t.accounts_s.length;
    }
    return row;
  });

  const output_payload = {
    requirements_echo: {
      asset: rq.asset, amount: requiredAmount.toString(), pay_to: rq.pay_to,
      fee_payer: feePayer,
      memo: ex.memo === undefined ? null : ex.memo,
      transaction_versions: acceptedVersions.slice(),
      splits_present: false,
    },
    transaction_version: {
      pasted: txVersion === 'legacy' ? 'legacy' : txVersion,
      accepted_set: acceptedVersions.slice(),
      accepted: txVersion !== 'legacy' && acceptedVersions.includes(txVersion),
    },
    instruction_summary,
    recipient_atas: {
      declared_token_program: declaredTokenProgram,
      ata_under_declared_token_program: ataDeclared === null ? null : { address: ataDeclared.address, bump: ataDeclared.bump },
      ata_under_classic_token_program: ataClassic === null ? null : { address: ataClassic.address, bump: ataClassic.bump },
      ata_addresses_differ: declaredTokenProgram === 'spl-token' ? false : atasDiffer,
      wrong_program_ata: wrongProgramAta,
    },
    matching_transfers: {
      transfer_checked_count: transfers.length,
      matching_count: matching.length,
      unique: unique,
      matched_instruction_index: match === null ? null : match.index,
    },
    net_received: match === null ? null : {
      gross_amount: gross.toString(),
      transfer_fee_declared: feeBps !== null,
      transfer_fee_basis_points: feeBps === null ? '0' : feeBps.toString(),
      maximum_fee: feeMax === null ? '0' : feeMax.toString(),
      withheld: withheld.toString(),
      net_amount: net.toString(),
    },
    signature_checks: sigChecks,
    verdicts,
    clause_summary,
    note: 'Clause-verdict recompute of an x402 exact-scheme Solana payment over pasted values only. Spec readings pinned at ' + SPEC_PIN + '; reference readings at ' + REF_PIN + '. The amount clause is where the readings split: the spec outcome definition accepts overpayment (S1.4 L187-L192) while the static path rejects any amount inequality (scheme.ts L1160), and the smart-wallet paths accept gross >= (smartWalletVerification.ts L657-L662, L727-L781) and net-delta >= (L795-L803, L837-L844). On a Token-2022 transfer-fee mint the static path compares the gross instruction amount while the balance-delta readings compare the net, so one payment can pass one path and fail another; the withheld amount is min(ceil(gross*bps/10000), maximum_fee), the Token-2022 arithmetic (copied from the estate transfer-fee node). Both Kora advisories name these seams (' + GHSA_PIN + '). Transaction V1 is no longer spec-undefined: S1.5 (L200+) defines version admission and the reference implements it (scheme.ts L359-L364, L767-L774), so the staged spec-undefined clause was dropped at the re-pin and replaced by this admission rule. The recipient ATA is derived under both token programs with the chain predecessor derivation (seeds [wallet, token program id, mint] under ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL). Limits: only pasted instructions are matched (top-level plus any the caller marks is_inner); the spec S1 rule spans the full CPI trace, so a smart-wallet payment whose inner instructions are not pasted shows matching_count 0, never a verdict the bytes cannot support; lookup-table accounts must be pasted resolved; splits are refused. This kernel reads nothing on-chain, calls no facilitator, checks no balance and moves no funds; verdict vocabulary is PASS, FAIL, DIVERGES, SPEC_UNDEFINED.',
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

/* ===== BEGIN deterministic transcendental math (vendored noble ed25519 + sha256 bundle, inlined; excluded from the mutation surface by the named mutateSurfaceSplits entry in mutation-tiers.config.json) ===== */
const __noble = (() => {
/* Vendored: @noble/curves (ed25519 EdDSA verify path only) + @noble/hashes (sha2: sha256/sha512)
   v2.2.0 (MIT, (c) Paul Miller paulmillr.com). Self-contained ESM bundle exporting
   { ed25519, sha256, sha512 }. DO NOT hand-edit -- rebuild from pinned source.

   Source: @noble/curves@2.2.0 and @noble/hashes@2.2.0 npm dist tarballs, resolved from the
   local npm cache and integrity-verified by recomputing SHA-512 over the tarball bytes:
     @noble/curves  2.2.0  sha512-T/BoHgFXirb0ENSPBquzX0rcjXeM6Lo892a2jlYJkqk83LqZx0l1Of7DzlKJ6jkpvMrkHSnAcgb5JegL8SeIkQ==
     @noble/hashes  2.2.0  sha512-IYqDGiTXab6FniAgnSdZwgWbomxpy9FtYvLKs7wCUs2a8RkITG+DFGO1DM9cr+E3/RgADRpFjrKVaJ1z6sjtEg==
   Same v2.2.0 pin already vendored in chaingraph/kernels/_noble-bn254.bundle.mjs and
   _noble-secp256k1.bundle.mjs.

   Flattening method: every source module is wrapped in an IIFE returning its export object, and
   cross-module imports become destructuring assignments from those objects. Consequence: FUNCTION
   BODIES ARE BYTE-IDENTICAL to the pinned npm dist -- no identifier was renamed and no top-level
   binding was disambiguated (the IIFE scope removes the name collisions that forced renames in
   the secp256k1 bundle). Only `import`/`export` boilerplate was removed.

   Deleted from the vendored ed25519.js -- ALL of it unreachable from ed25519.verify(): ed25519ctx,
   ed25519ph, ed25519_domain, ed25519_FROST, x25519/montgomery, ristretto255 (+ its hasher, OPRF and
   FROST), elligator2 hash-to-curve, and ED25519_TORSION_SUBGROUP. The verify path this bundle keeps
   is edwards()/eddsa() over the ed25519 curve with ZIP-215 semantics, exactly as upstream configures
   it. sha256 is exported alongside sha512 because both come from the same vendored sha2.js and
   art-284 needs SHA-256 for its did:webvh entry hashing.

   Also deleted: @noble/hashes utils.js's nextTick()/asyncLoop() pair, which exists only for the
   async KDFs (pbkdf2/scrypt/argon2) and none of those are vendored. asyncLoop calls Date.now(),
   which the kernel-determinism lint hard-bans, so it is removed rather than shipped unreachable.

   WHY THIS EXISTS: QuickJS inside the RISC Zero zkVM guest has NO WebCrypto -- `crypto.subtle` is
   ABSENT, not merely async. Kernels that verified Ed25519 signatures through crypto.subtle therefore
   computed nothing in-guest and sealed empty journals. noble's ed25519.verify is synchronous pure JS,
   so the kernels become sync and the receipt attests the real verification. */

// ── @noble/hashes utils.js (v2.2.0, MIT, Paul Miller) ────────────────────────────────────────────────────────
const H_utils = (() => {
/**
 * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
 * @param a - value to test
 * @returns `true` when the value is a Uint8Array-compatible view.
 * @example
 * Check whether a value is a Uint8Array-compatible view.
 * ```ts
 * isBytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function isBytes(a) {
    // Plain `instanceof Uint8Array` is too strict for some Buffer / proxy / cross-realm cases.
    // The fallback still requires a real ArrayBuffer view, so plain
    // JSON-deserialized `{ constructor: ... }` spoofing is rejected, and
    // `BYTES_PER_ELEMENT === 1` keeps the fallback on byte-oriented views.
    return (a instanceof Uint8Array ||
        (ArrayBuffer.isView(a) &&
            a.constructor.name === 'Uint8Array' &&
            'BYTES_PER_ELEMENT' in a &&
            a.BYTES_PER_ELEMENT === 1));
}
/**
 * Asserts something is a non-negative integer.
 * @param n - number to validate
 * @param title - label included in thrown errors
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a non-negative integer option.
 * ```ts
 * anumber(32, 'length');
 * ```
 */
function anumber(n, title = '') {
    if (typeof n !== 'number') {
        const prefix = title && `"${title}" `;
        throw new TypeError(`${prefix}expected number, got ${typeof n}`);
    }
    if (!Number.isSafeInteger(n) || n < 0) {
        const prefix = title && `"${title}" `;
        throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
    }
}
/**
 * Asserts something is Uint8Array.
 * @param value - value to validate
 * @param length - optional exact length constraint
 * @param title - label included in thrown errors
 * @returns The validated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate that a value is a byte array.
 * ```ts
 * abytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function abytes(value, length, title = '') {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== undefined;
    if (!bytes || (needsLen && len !== length)) {
        const prefix = title && `"${title}" `;
        const ofLen = needsLen ? ` of length ${length}` : '';
        const got = bytes ? `length=${len}` : `type=${typeof value}`;
        const message = prefix + 'expected Uint8Array' + ofLen + ', got ' + got;
        if (!bytes)
            throw new TypeError(message);
        throw new RangeError(message);
    }
    return value;
}
/**
 * Copies bytes into a fresh Uint8Array.
 * Buffer-style slices can alias the same backing store, so callers that need ownership should copy.
 * @param bytes - source bytes to clone
 * @returns Freshly allocated copy of `bytes`.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Clone a byte array before mutating it.
 * ```ts
 * const copy = copyBytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function copyBytes(bytes) {
    // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
    // because callers use it at byte-validation boundaries before mutating the detached copy.
    return Uint8Array.from(abytes(bytes));
}
/**
 * Asserts something is a wrapped hash constructor.
 * @param h - hash constructor to validate
 * @throws On wrong argument types or invalid hash wrapper shape. {@link TypeError}
 * @throws On invalid hash metadata ranges or values. {@link RangeError}
 * @throws If the hash metadata allows empty outputs or block sizes. {@link Error}
 * @example
 * Validate a callable hash wrapper.
 * ```ts
 * import { ahash } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * ahash(sha256);
 * ```
 */
function ahash(h) {
    if (typeof h !== 'function' || typeof h.create !== 'function')
        throw new TypeError('Hash must wrapped by utils.createHasher');
    anumber(h.outputLen);
    anumber(h.blockLen);
    // HMAC and KDF callers treat these as real byte lengths; allowing zero lets fake wrappers pass
    // validation and can produce empty outputs instead of failing fast.
    if (h.outputLen < 1)
        throw new Error('"outputLen" must be >= 1');
    if (h.blockLen < 1)
        throw new Error('"blockLen" must be >= 1');
}
/**
 * Asserts a hash instance has not been destroyed or finished.
 * @param instance - hash instance to validate
 * @param checkFinished - whether to reject finalized instances
 * @throws If the hash instance has already been destroyed or finalized. {@link Error}
 * @example
 * Validate that a hash instance is still usable.
 * ```ts
 * import { aexists } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aexists(hash);
 * ```
 */
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/**
 * Asserts output is a sufficiently-sized byte array.
 * @param out - destination buffer
 * @param instance - hash instance providing output length
 * Oversized buffers are allowed; downstream code only promises to fill the first `outputLen` bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a caller-provided digest buffer.
 * ```ts
 * import { aoutput } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aoutput(new Uint8Array(hash.outputLen), hash);
 * ```
 */
function aoutput(out, instance) {
    abytes(out, undefined, 'digestInto() output');
    const min = instance.outputLen;
    if (out.length < min) {
        throw new RangeError('"digestInto() output" expected to be of length >=' + min);
    }
}
/**
 * Casts a typed array view to Uint8Array.
 * @param arr - source typed array
 * @returns Uint8Array view over the same buffer.
 * @example
 * Reinterpret a typed array as bytes.
 * ```ts
 * u8(new Uint32Array([1, 2]));
 * ```
 */
function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Casts a typed array view to Uint32Array.
 * `arr.byteOffset` must already be 4-byte aligned or the platform
 * Uint32Array constructor will throw.
 * @param arr - source typed array
 * @returns Uint32Array view over the same buffer.
 * @example
 * Reinterpret a byte array as 32-bit words.
 * ```ts
 * u32(new Uint8Array(8));
 * ```
 */
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/**
 * Zeroizes typed arrays in place. Warning: JS provides no guarantees.
 * @param arrays - arrays to overwrite with zeros
 * @example
 * Zeroize sensitive buffers in place.
 * ```ts
 * clean(new Uint8Array([1, 2, 3]));
 * ```
 */
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/**
 * Creates a DataView for byte-level manipulation.
 * @param arr - source typed array
 * @returns DataView over the same buffer region.
 * @example
 * Create a DataView over an existing buffer.
 * ```ts
 * createView(new Uint8Array(4));
 * ```
 */
function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Rotate-right operation for uint32 values.
 * @param word - source word
 * @param shift - shift amount in bits
 * @returns Rotated word.
 * @example
 * Rotate a 32-bit word to the right.
 * ```ts
 * rotr(0x12345678, 8);
 * ```
 */
function rotr(word, shift) {
    return (word << (32 - shift)) | (word >>> shift);
}
/**
 * Rotate-left operation for uint32 values.
 * @param word - source word
 * @param shift - shift amount in bits
 * @returns Rotated word.
 * @example
 * Rotate a 32-bit word to the left.
 * ```ts
 * rotl(0x12345678, 8);
 * ```
 */
function rotl(word, shift) {
    return (word << shift) | ((word >>> (32 - shift)) >>> 0);
}
/** Whether the current platform is little-endian. */
const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/**
 * Byte-swap operation for uint32 values.
 * @param word - source word
 * @returns Word with reversed byte order.
 * @example
 * Reverse the byte order of a 32-bit word.
 * ```ts
 * byteSwap(0x11223344);
 * ```
 */
function byteSwap(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
/**
 * Conditionally byte-swaps one 32-bit word on big-endian platforms.
 * @param n - source word
 * @returns Original or byte-swapped word depending on platform endianness.
 * @example
 * Normalize a 32-bit word for host endianness.
 * ```ts
 * swap8IfBE(0x11223344);
 * ```
 */
const swap8IfBE = isLE
    ? (n) => n
    : (n) => byteSwap(n) >>> 0;
/**
 * Byte-swaps every word of a Uint32Array in place.
 * @param arr - array to mutate
 * @returns The same array after mutation; callers pass live state arrays here.
 * @example
 * Reverse the byte order of every word in place.
 * ```ts
 * byteSwap32(new Uint32Array([0x11223344]));
 * ```
 */
function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap(arr[i]);
    }
    return arr;
}
/**
 * Conditionally byte-swaps a Uint32Array on big-endian platforms.
 * @param u - array to normalize for host endianness
 * @returns Original or byte-swapped array depending on platform endianness.
 *   On big-endian runtimes this mutates `u` in place via `byteSwap32(...)`.
 * @example
 * Normalize a word array for host endianness.
 * ```ts
 * swap32IfBE(new Uint32Array([0x11223344]));
 * ```
 */
const swap32IfBE = isLE
    ? (u) => u
    : byteSwap32;
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin = /* @__PURE__ */ (() => 
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
/**
 * Convert byte array to hex string.
 * Uses the built-in function when available and assumes it matches the tested
 * fallback semantics.
 * @param bytes - bytes to encode
 * @returns Lowercase hexadecimal string.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Convert bytes to lowercase hexadecimal.
 * ```ts
 * bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])); // 'cafe0123'
 * ```
 */
function bytesToHex(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin)
        return bytes.toHex();
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @param hex - hexadecimal string to decode
 * @returns Decoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Decode lowercase hexadecimal into bytes.
 * ```ts
 * hexToBytes('cafe0123'); // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 * ```
 */
function hexToBytes(hex) {
    if (typeof hex !== 'string')
        throw new TypeError('hex string expected, got ' + typeof hex);
    if (hasHexBuiltin) {
        try {
            return Uint8Array.fromHex(hex);
        }
        catch (error) {
            if (error instanceof SyntaxError)
                throw new RangeError(error.message);
            throw error;
        }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
        throw new RangeError('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}
/**
 * Converts string to bytes using UTF8 encoding.
 * Built-in doesn't validate input to be string: we do the check.
 * Non-ASCII details are delegated to the platform `TextEncoder`.
 * @param str - string to encode
 * @returns UTF-8 encoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Encode a string as UTF-8 bytes.
 * ```ts
 * utf8ToBytes('abc'); // Uint8Array.from([97, 98, 99])
 * ```
 */
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new TypeError('string expected');
    return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}
/**
 * Helper for KDFs: consumes Uint8Array or string.
 * String inputs are UTF-8 encoded; byte-array inputs stay aliased to the caller buffer.
 * @param data - user-provided KDF input
 * @param errorTitle - label included in thrown errors
 * @returns Byte representation of the input.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Normalize KDF input to bytes.
 * ```ts
 * kdfInputToBytes('password');
 * ```
 */
function kdfInputToBytes(data, errorTitle = '') {
    if (typeof data === 'string')
        return utf8ToBytes(data);
    return abytes(data, undefined, errorTitle);
}
/**
 * Copies several Uint8Arrays into one.
 * @param arrays - arrays to concatenate
 * @returns Concatenated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Concatenate multiple byte arrays.
 * ```ts
 * concatBytes(new Uint8Array([1]), new Uint8Array([2]));
 * ```
 */
function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
/**
 * Merges default options and passed options.
 * @param defaults - base option object
 * @param opts - user overrides
 * @returns Merged option object. The merge mutates `defaults` in place.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Merge user overrides onto default options.
 * ```ts
 * checkOpts({ dkLen: 32 }, { asyncTick: 10 });
 * ```
 */
function checkOpts(defaults, opts) {
    if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
        throw new TypeError('options must be object or undefined');
    const merged = Object.assign(defaults, opts);
    return merged;
}
/**
 * Creates a callable hash function from a stateful class constructor.
 * @param hashCons - hash constructor or factory
 * @param info - optional metadata such as DER OID
 * @returns Frozen callable hash wrapper with `.create()`.
 *   Wrapper construction eagerly calls `hashCons(undefined)` once to read
 *   `outputLen` / `blockLen`, so constructor side effects happen at module
 *   init time.
 * @example
 * Wrap a stateful hash constructor into a callable helper.
 * ```ts
 * import { createHasher } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const wrapped = createHasher(sha256.create, { oid: sha256.oid });
 * wrapped(new Uint8Array([1]));
 * ```
 */
function createHasher(hashCons, info = {}) {
    const hashC = (msg, opts) => hashCons(opts)
        .update(msg)
        .digest();
    const tmp = hashCons(undefined);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
}
/**
 * Cryptographically secure PRNG backed by `crypto.getRandomValues`.
 * @param bytesLength - number of random bytes to generate
 * @returns Random bytes.
 * The platform `getRandomValues()` implementation still defines any
 * single-call length cap, and this helper rejects oversize requests
 * with a stable library `RangeError` instead of host-specific errors.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @throws If the current runtime does not provide `crypto.getRandomValues`. {@link Error}
 * @example
 * Generate a fresh random key or nonce.
 * ```ts
 * const key = randomBytes(16);
 * ```
 */
function randomBytes(bytesLength = 32) {
    // Match the repo's other length-taking helpers instead of relying on Uint8Array coercion.
    anumber(bytesLength, 'bytesLength');
    const cr = typeof globalThis === 'object' ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== 'function')
        throw new Error('crypto.getRandomValues must be defined');
    // Web Cryptography API Level 2 Section 10.1.1:
    // if `byteLength > 65536`, throw `QuotaExceededError`.
    // Keep the guard explicit so callers can see the quota in code
    // instead of discovering it by reading the spec or host errors.
    // This wrapper surfaces the same quota as a stable library RangeError.
    if (bytesLength > 65536)
        throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
}
/**
 * Creates OID metadata for NIST hashes with prefix `06 09 60 86 48 01 65 03 04 02`.
 * @param suffix - final OID byte for the selected hash.
 *   The helper accepts any byte even though only the documented NIST hash
 *   suffixes are meaningful downstream.
 * @returns Object containing the DER-encoded OID.
 * @example
 * Build OID metadata for a NIST hash.
 * ```ts
 * oidNist(0x01);
 * ```
 */
const oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix]),
});
//# sourceMappingURL=utils.js.map
  return { isBytes, anumber, abytes, copyBytes, ahash, aexists, aoutput, u8, u32, clean, createView, rotr, rotl, isLE, byteSwap, swap8IfBE, byteSwap32, swap32IfBE, bytesToHex, hexToBytes, utf8ToBytes, kdfInputToBytes, concatBytes, checkOpts, createHasher, randomBytes, oidNist };
})();

// ── @noble/hashes _u64.js (v2.2.0, MIT, Paul Miller) ─────────────────────────────────────────────────────────
const H_u64 = (() => {
const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n = /* @__PURE__ */ BigInt(32);
// Split bigint into two 32-bit halves. With `le=true`, returned fields become `{ h: low, l: high
// }` to match little-endian word order rather than the property names.
function fromBig(n, le = false) {
    if (le)
        return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
    return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
// Split bigint list into `[highWords, lowWords]` when `le=false`; with `le=true`, the first array
// holds the low halves because `fromBig(...)` swaps the semantic meaning of `h` and `l`.
function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
        const { h, l } = fromBig(lst[i], le);
        [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
}
// Combine explicit `(high, low)` 32-bit halves into a bigint; `>>> 0` normalizes signed JS
// bitwise results back to uint32 first, and little-endian callers must swap.
const toBig = (h, l) => (BigInt(h >>> 0) << _32n) | BigInt(l >>> 0);
// High 32-bit half of a 64-bit logical right shift for `s` in `0..31`.
const shrSH = (h, _l, s) => h >>> s;
// Low 32-bit half of a 64-bit logical right shift, valid for `s` in `1..31`.
const shrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
// High 32-bit half of a 64-bit right rotate, valid for `s` in `1..31`.
const rotrSH = (h, l, s) => (h >>> s) | (l << (32 - s));
// Low 32-bit half of a 64-bit right rotate, valid for `s` in `1..31`.
const rotrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
// High 32-bit half of a 64-bit right rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotrBH = (h, l, s) => (h << (64 - s)) | (l >>> (s - 32));
// Low 32-bit half of a 64-bit right rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotrBL = (h, l, s) => (h >>> (s - 32)) | (l << (64 - s));
// High 32-bit half of a 64-bit right rotate for `s === 32`; this is just the swapped low half.
const rotr32H = (_h, l) => l;
// Low 32-bit half of a 64-bit right rotate for `s === 32`; this is just the swapped high half.
const rotr32L = (h, _l) => h;
// High 32-bit half of a 64-bit left rotate, valid for `s` in `1..31`.
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
// Low 32-bit half of a 64-bit left rotate, valid for `s` in `1..31`.
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
// High 32-bit half of a 64-bit left rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
// Low 32-bit half of a 64-bit left rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));
// Add two split 64-bit words and return the split `{ h, l }` sum.
// JS uses 32-bit signed integers for bitwise operations, so we cannot simply shift the carry out
// of the low sum and instead use division.
function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
}
// Addition with more than 2 elements
// Unmasked low-word accumulator for 3-way addition; pass the raw result into `add3H(...)`.
const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
// High-word finalize step for 3-way addition; `low` must be the untruncated output of `add3L(...)`.
const add3H = (low, Ah, Bh, Ch) => (Ah + Bh + Ch + ((low / 2 ** 32) | 0)) | 0;
// Unmasked low-word accumulator for 4-way addition; pass the raw result into `add4H(...)`.
const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
// High-word finalize step for 4-way addition; `low` must be the untruncated output of `add4L(...)`.
const add4H = (low, Ah, Bh, Ch, Dh) => (Ah + Bh + Ch + Dh + ((low / 2 ** 32) | 0)) | 0;
// Unmasked low-word accumulator for 5-way addition; pass the raw result into `add5H(...)`.
const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
// High-word finalize step for 5-way addition; `low` must be the untruncated output of `add5L(...)`.
const add5H = (low, Ah, Bh, Ch, Dh, Eh) => (Ah + Bh + Ch + Dh + Eh + ((low / 2 ** 32) | 0)) | 0;
// prettier-ignore

// Canonical grouped namespace for callers that prefer one object.
// Named exports stay for direct imports.
// prettier-ignore
const u64 = {
    fromBig, split, toBig,
    shrSH, shrSL,
    rotrSH, rotrSL, rotrBH, rotrBL,
    rotr32H, rotr32L,
    rotlSH, rotlSL, rotlBH, rotlBL,
    add, add3L, add3H, add4L, add4H, add5H, add5L,
};
// Default export mirrors named `u64` for compatibility with object-style imports.

//# sourceMappingURL=_u64.js.map
  return { add, add3H, add3L, add4H, add4L, add5H, add5L, fromBig, rotlBH, rotlBL, rotlSH, rotlSL, rotr32H, rotr32L, rotrBH, rotrBL, rotrSH, rotrSL, shrSH, shrSL, split, toBig };
})();

// ── @noble/hashes _md.js (v2.2.0, MIT, Paul Miller) ──────────────────────────────────────────────────────────
const H_md = (() => {
  const { abytes, aexists, aoutput, clean, createView } = H_utils;
/**
 * Internal Merkle-Damgard hash utils.
 * @module
 */

/**
 * Shared 32-bit conditional boolean primitive reused by SHA-256, SHA-1, and MD5 `F`.
 * Returns bits from `b` when `a` is set, otherwise from `c`.
 * The XOR form is equivalent to MD5's `F(X,Y,Z) = XY v not(X)Z` because the masked terms never
 * set the same bit.
 * @param a - selector word
 * @param b - word chosen when selector bit is set
 * @param c - word chosen when selector bit is clear
 * @returns Mixed 32-bit word.
 * @example
 * Combine three words with the shared 32-bit choice primitive.
 * ```ts
 * Chi(0xffffffff, 0x12345678, 0x87654321);
 * ```
 */
function Chi(a, b, c) {
    return (a & b) ^ (~a & c);
}
/**
 * Shared 32-bit majority primitive reused by SHA-256 and SHA-1.
 * Returns bits shared by at least two inputs.
 * @param a - first input word
 * @param b - second input word
 * @param c - third input word
 * @returns Mixed 32-bit word.
 * @example
 * Combine three words with the shared 32-bit majority primitive.
 * ```ts
 * Maj(0xffffffff, 0x12345678, 0x87654321);
 * ```
 */
function Maj(a, b, c) {
    return (a & b) ^ (a & c) ^ (b & c);
}
/**
 * Merkle-Damgard hash construction base class.
 * Could be used to create MD5, RIPEMD, SHA1, SHA2.
 * Accepts only byte-aligned `Uint8Array` input, even when the underlying spec describes bit
 * strings with partial-byte tails.
 * @param blockLen - internal block size in bytes
 * @param outputLen - digest size in bytes
 * @param padOffset - trailing length field size in bytes
 * @param isLE - whether length and state words are encoded in little-endian
 * @example
 * Use a concrete subclass to get the shared Merkle-Damgard update/digest flow.
 * ```ts
 * import { _SHA1 } from '@noble/hashes/legacy.js';
 * const hash = new _SHA1();
 * hash.update(new Uint8Array([97, 98, 99]));
 * hash.digest();
 * ```
 */
class HashMD {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    // For partial updates less than block size
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(blockLen, outputLen, padOffset, isLE) {
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
    }
    update(data) {
        aexists(this);
        abytes(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            // Fast path only when there is no buffered partial block: `take === blockLen` implies
            // `this.pos === 0`, so we can process full blocks directly from the input view.
            if (take === blockLen) {
                const dataView = createView(data);
                for (; blockLen <= len - pos; pos += blockLen)
                    this.process(dataView, pos);
                continue;
            }
            buffer.set(data.subarray(pos, pos + take), this.pos);
            this.pos += take;
            pos += take;
            if (this.pos === blockLen) {
                this.process(view, 0);
                this.pos = 0;
            }
        }
        this.length += data.length;
        this.roundClean();
        return this;
    }
    digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        // Padding
        // We can avoid allocation of buffer for padding completely if it
        // was previously not allocated here. But it won't change performance.
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        // append the bit '1' to the message
        buffer[pos++] = 0b10000000;
        clean(this.buffer.subarray(pos));
        // we have less than padOffset left in buffer, so we cannot put length in
        // current block, need process it and pad again
        if (this.padOffset > blockLen - pos) {
            this.process(view, 0);
            pos = 0;
        }
        // Pad until full block byte with zeros
        for (let i = pos; i < blockLen; i++)
            buffer[i] = 0;
        // `padOffset` reserves the whole length field. For SHA-384/512 the high 64 bits stay zero from
        // the padding fill above, and JS will overflow before user input can make that half non-zero.
        // So we only need to write the low 64 bits here.
        view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = createView(out);
        const len = this.outputLen;
        // NOTE: we do division by 4 later, which must be fused in single op with modulo by JIT
        if (len % 4)
            throw new Error('_sha2: outputLen must be aligned to 32bit');
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
            throw new Error('_sha2: outputLen bigger than state');
        for (let i = 0; i < outLen; i++)
            oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        // Copy before destroy(): subclasses wipe `buffer` during cleanup, but `digest()` must return
        // fresh bytes to the caller.
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
    }
    _cloneInto(to) {
        to ||= new this.constructor();
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        // Only partial-block bytes need copying: when `length % blockLen === 0`, `pos === 0` and
        // later `update()` / `digestInto()` overwrite `to.buffer` from the start before reading it.
        if (length % blockLen)
            to.buffer.set(buffer);
        return to;
    }
    clone() {
        return this._cloneInto();
    }
}
/**
 * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
 * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
 */
/** Initial SHA256 state from RFC 6234 Section 6.1: the first 32 bits of the fractional parts of the
 * square roots of the first eight prime numbers. Exported as a shared table; callers must treat
 * it as read-only because constructors copy words from it by index. */
const SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
/** Initial SHA224 state `H(0)` from RFC 6234 Section 6.1. Exported as a shared table; callers must
 * treat it as read-only because constructors copy words from it by index. */
const SHA224_IV = /* @__PURE__ */ Uint32Array.from([
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4,
]);
/** Initial SHA384 state from RFC 6234 Section 6.3: eight RFC 64-bit `H(0)` words stored as sixteen
 * big-endian 32-bit halves. Derived from the fractional parts of the square roots of the ninth
 * through sixteenth prime numbers. Exported as a shared table; callers must treat it as read-only
 * because constructors copy halves from it by index. */
const SHA384_IV = /* @__PURE__ */ Uint32Array.from([
    0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939,
    0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4,
]);
/** Initial SHA512 state from RFC 6234 Section 6.3: eight RFC 64-bit `H(0)` words stored as sixteen
 * big-endian 32-bit halves. Derived from the fractional parts of the square roots of the first
 * eight prime numbers. Exported as a shared table; callers must treat it as read-only because
 * constructors copy halves from it by index. */
const SHA512_IV = /* @__PURE__ */ Uint32Array.from([
    0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
    0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
]);
//# sourceMappingURL=_md.js.map
  return { Chi, Maj, HashMD, SHA256_IV, SHA224_IV, SHA384_IV, SHA512_IV };
})();

// ── @noble/hashes sha2.js (v2.2.0, MIT, Paul Miller) ─────────────────────────────────────────────────────────
const H_sha2 = (() => {
  const { Chi, HashMD, Maj, SHA224_IV, SHA256_IV, SHA384_IV, SHA512_IV } = H_md;
  const u64 = H_u64;
  const { clean, createHasher, oidNist, rotr } = H_utils;
/**
 * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
 * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
 * Check out {@link https://www.rfc-editor.org/rfc/rfc4634 | RFC 4634} and
 * {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf | FIPS 180-4}.
 * @module
 */



/**
 * SHA-224 / SHA-256 round constants from RFC 6234 Section 5.1: the first 32 bits
 * of the cube roots of the first 64 primes (2..311).
 */
// prettier-ignore
const SHA256_K = /* @__PURE__ */ Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
/** Reusable SHA-224 / SHA-256 message schedule buffer `W_t` from RFC 6234 Section 6.2 step 1. */
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
/** Internal SHA-224 / SHA-256 compression engine from RFC 6234 Section 6.2. */
class SHA2_32B extends HashMD {
    constructor(outputLen) {
        super(64, outputLen, 8, false);
    }
    get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
    }
    process(view, offset) {
        // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
        for (let i = 0; i < 16; i++, offset += 4)
            SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
            const W15 = SHA256_W[i - 15];
            const W2 = SHA256_W[i - 2];
            const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
            const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
            SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
        }
        // Compression function main loop, 64 rounds
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
            const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
            const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
            const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
            const T2 = (sigma0 + Maj(A, B, C)) | 0;
            H = G;
            G = F;
            F = E;
            E = (D + T1) | 0;
            D = C;
            C = B;
            B = A;
            A = (T1 + T2) | 0;
        }
        // Add the compressed chunk to the current hash value
        A = (A + this.A) | 0;
        B = (B + this.B) | 0;
        C = (C + this.C) | 0;
        D = (D + this.D) | 0;
        E = (E + this.E) | 0;
        F = (F + this.F) | 0;
        G = (G + this.G) | 0;
        H = (H + this.H) | 0;
        this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
        clean(SHA256_W);
    }
    destroy() {
        // HashMD callers route post-destroy usability through `destroyed`; zeroizing alone still leaves
        // update()/digest() callable on reused instances.
        this.destroyed = true;
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
    }
}
/** Internal SHA-256 hash class grounded in RFC 6234 Section 6.2. */
class _SHA256 extends SHA2_32B {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    A = SHA256_IV[0] | 0;
    B = SHA256_IV[1] | 0;
    C = SHA256_IV[2] | 0;
    D = SHA256_IV[3] | 0;
    E = SHA256_IV[4] | 0;
    F = SHA256_IV[5] | 0;
    G = SHA256_IV[6] | 0;
    H = SHA256_IV[7] | 0;
    constructor() {
        super(32);
    }
}
/** Internal SHA-224 hash class grounded in RFC 6234 Section 6.2 and Section 8.5. */
class _SHA224 extends SHA2_32B {
    A = SHA224_IV[0] | 0;
    B = SHA224_IV[1] | 0;
    C = SHA224_IV[2] | 0;
    D = SHA224_IV[3] | 0;
    E = SHA224_IV[4] | 0;
    F = SHA224_IV[5] | 0;
    G = SHA224_IV[6] | 0;
    H = SHA224_IV[7] | 0;
    constructor() {
        super(28);
    }
}
// SHA2-512 is slower than sha256 in js because u64 operations are slow.
// SHA-384 / SHA-512 round constants from RFC 6234 Section 5.2:
// 80 full 64-bit words split into high/low halves.
// prettier-ignore
const K512 = /* @__PURE__ */ (() => u64.split([
    '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
    '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
    '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
    '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
    '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
    '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
    '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
    '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
    '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
    '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
    '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
    '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
    '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
    '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
    '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
    '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
    '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
    '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
    '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
    '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
].map(n => BigInt(n))))();
const SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
const SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
// Reusable high-half schedule buffer for the RFC 6234 Section 6.4 64-bit `W_t` words.
const SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
// Reusable low-half schedule buffer for the RFC 6234 Section 6.4 64-bit `W_t` words.
const SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
/** Internal SHA-384 / SHA-512 compression engine from RFC 6234 Section 6.4. */
class SHA2_64B extends HashMD {
    constructor(outputLen) {
        super(128, outputLen, 16, false);
    }
    // prettier-ignore
    get() {
        const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
        this.Ah = Ah | 0;
        this.Al = Al | 0;
        this.Bh = Bh | 0;
        this.Bl = Bl | 0;
        this.Ch = Ch | 0;
        this.Cl = Cl | 0;
        this.Dh = Dh | 0;
        this.Dl = Dl | 0;
        this.Eh = Eh | 0;
        this.El = El | 0;
        this.Fh = Fh | 0;
        this.Fl = Fl | 0;
        this.Gh = Gh | 0;
        this.Gl = Gl | 0;
        this.Hh = Hh | 0;
        this.Hl = Hl | 0;
    }
    process(view, offset) {
        // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
        for (let i = 0; i < 16; i++, offset += 4) {
            SHA512_W_H[i] = view.getUint32(offset);
            SHA512_W_L[i] = view.getUint32((offset += 4));
        }
        for (let i = 16; i < 80; i++) {
            // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
            const W15h = SHA512_W_H[i - 15] | 0;
            const W15l = SHA512_W_L[i - 15] | 0;
            const s0h = u64.rotrSH(W15h, W15l, 1) ^ u64.rotrSH(W15h, W15l, 8) ^ u64.shrSH(W15h, W15l, 7);
            const s0l = u64.rotrSL(W15h, W15l, 1) ^ u64.rotrSL(W15h, W15l, 8) ^ u64.shrSL(W15h, W15l, 7);
            // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
            const W2h = SHA512_W_H[i - 2] | 0;
            const W2l = SHA512_W_L[i - 2] | 0;
            const s1h = u64.rotrSH(W2h, W2l, 19) ^ u64.rotrBH(W2h, W2l, 61) ^ u64.shrSH(W2h, W2l, 6);
            const s1l = u64.rotrSL(W2h, W2l, 19) ^ u64.rotrBL(W2h, W2l, 61) ^ u64.shrSL(W2h, W2l, 6);
            // SHA512_W[i] = s0 + s1 + SHA512_W[i - 7] + SHA512_W[i - 16];
            const SUMl = u64.add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
            const SUMh = u64.add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
            SHA512_W_H[i] = SUMh | 0;
            SHA512_W_L[i] = SUMl | 0;
        }
        let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        // Compression function main loop, 80 rounds
        for (let i = 0; i < 80; i++) {
            // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
            const sigma1h = u64.rotrSH(Eh, El, 14) ^ u64.rotrSH(Eh, El, 18) ^ u64.rotrBH(Eh, El, 41);
            const sigma1l = u64.rotrSL(Eh, El, 14) ^ u64.rotrSL(Eh, El, 18) ^ u64.rotrBL(Eh, El, 41);
            //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
            const CHIh = (Eh & Fh) ^ (~Eh & Gh);
            const CHIl = (El & Fl) ^ (~El & Gl);
            // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
            // prettier-ignore
            const T1ll = u64.add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
            const T1h = u64.add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
            const T1l = T1ll | 0;
            // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
            const sigma0h = u64.rotrSH(Ah, Al, 28) ^ u64.rotrBH(Ah, Al, 34) ^ u64.rotrBH(Ah, Al, 39);
            const sigma0l = u64.rotrSL(Ah, Al, 28) ^ u64.rotrBL(Ah, Al, 34) ^ u64.rotrBL(Ah, Al, 39);
            const MAJh = (Ah & Bh) ^ (Ah & Ch) ^ (Bh & Ch);
            const MAJl = (Al & Bl) ^ (Al & Cl) ^ (Bl & Cl);
            Hh = Gh | 0;
            Hl = Gl | 0;
            Gh = Fh | 0;
            Gl = Fl | 0;
            Fh = Eh | 0;
            Fl = El | 0;
            ({ h: Eh, l: El } = u64.add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
            Dh = Ch | 0;
            Dl = Cl | 0;
            Ch = Bh | 0;
            Cl = Bl | 0;
            Bh = Ah | 0;
            Bl = Al | 0;
            const All = u64.add3L(T1l, sigma0l, MAJl);
            Ah = u64.add3H(All, T1h, sigma0h, MAJh);
            Al = All | 0;
        }
        // Add the compressed chunk to the current hash value
        ({ h: Ah, l: Al } = u64.add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
        ({ h: Bh, l: Bl } = u64.add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
        ({ h: Ch, l: Cl } = u64.add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
        ({ h: Dh, l: Dl } = u64.add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
        ({ h: Eh, l: El } = u64.add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
        ({ h: Fh, l: Fl } = u64.add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
        ({ h: Gh, l: Gl } = u64.add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
        ({ h: Hh, l: Hl } = u64.add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
        this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
        clean(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
        // HashMD callers route post-destroy usability through `destroyed`; zeroizing alone still leaves
        // update()/digest() callable on reused instances.
        this.destroyed = true;
        clean(this.buffer);
        this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
/** Internal SHA-512 hash class grounded in RFC 6234 Section 6.3 and Section 6.4. */
class _SHA512 extends SHA2_64B {
    Ah = SHA512_IV[0] | 0;
    Al = SHA512_IV[1] | 0;
    Bh = SHA512_IV[2] | 0;
    Bl = SHA512_IV[3] | 0;
    Ch = SHA512_IV[4] | 0;
    Cl = SHA512_IV[5] | 0;
    Dh = SHA512_IV[6] | 0;
    Dl = SHA512_IV[7] | 0;
    Eh = SHA512_IV[8] | 0;
    El = SHA512_IV[9] | 0;
    Fh = SHA512_IV[10] | 0;
    Fl = SHA512_IV[11] | 0;
    Gh = SHA512_IV[12] | 0;
    Gl = SHA512_IV[13] | 0;
    Hh = SHA512_IV[14] | 0;
    Hl = SHA512_IV[15] | 0;
    constructor() {
        super(64);
    }
}
/** Internal SHA-384 hash class grounded in RFC 6234 Section 6.3 and Section 6.4. */
class _SHA384 extends SHA2_64B {
    Ah = SHA384_IV[0] | 0;
    Al = SHA384_IV[1] | 0;
    Bh = SHA384_IV[2] | 0;
    Bl = SHA384_IV[3] | 0;
    Ch = SHA384_IV[4] | 0;
    Cl = SHA384_IV[5] | 0;
    Dh = SHA384_IV[6] | 0;
    Dl = SHA384_IV[7] | 0;
    Eh = SHA384_IV[8] | 0;
    El = SHA384_IV[9] | 0;
    Fh = SHA384_IV[10] | 0;
    Fl = SHA384_IV[11] | 0;
    Gh = SHA384_IV[12] | 0;
    Gl = SHA384_IV[13] | 0;
    Hh = SHA384_IV[14] | 0;
    Hl = SHA384_IV[15] | 0;
    constructor() {
        super(48);
    }
}
/**
 * Truncated SHA512/256 and SHA512/224.
 * SHA512_IV is XORed with 0xa5a5a5a5a5a5a5a5, then used as "intermediary" IV of SHA512/t.
 * Then t hashes string to produce result IV.
 * See the repo-side derivation recipe in `test/misc/sha2-gen-iv.js`.
 * These IV literals are checked against that script rather than a dedicated
 * local RFC section.
 */
/** SHA-512/224 IV derived by the SHA-512/t recipe in `test/misc/sha2-gen-iv.js` and
 * stored as sixteen big-endian 32-bit halves. */
const T224_IV = /* @__PURE__ */ Uint32Array.from([
    0x8c3d37c8, 0x19544da2, 0x73e19966, 0x89dcd4d6, 0x1dfab7ae, 0x32ff9c82, 0x679dd514, 0x582f9fcf,
    0x0f6d2b69, 0x7bd44da8, 0x77e36f73, 0x04c48942, 0x3f9d85a8, 0x6a1d36c8, 0x1112e6ad, 0x91d692a1,
]);
/** SHA-512/256 IV derived by the SHA-512/t recipe in `test/misc/sha2-gen-iv.js` and
 * stored as sixteen big-endian 32-bit halves. */
const T256_IV = /* @__PURE__ */ Uint32Array.from([
    0x22312194, 0xfc2bf72c, 0x9f555fa3, 0xc84c64c2, 0x2393b86b, 0x6f53b151, 0x96387719, 0x5940eabd,
    0x96283ee2, 0xa88effe3, 0xbe5e1e25, 0x53863992, 0x2b0199fc, 0x2c85b8aa, 0x0eb72ddc, 0x81c52ca2,
]);
/** Internal SHA-512/224 hash class using the derived `T224_IV` and the shared
 * RFC 6234 Section 6.4 compression engine. */
class _SHA512_224 extends SHA2_64B {
    Ah = T224_IV[0] | 0;
    Al = T224_IV[1] | 0;
    Bh = T224_IV[2] | 0;
    Bl = T224_IV[3] | 0;
    Ch = T224_IV[4] | 0;
    Cl = T224_IV[5] | 0;
    Dh = T224_IV[6] | 0;
    Dl = T224_IV[7] | 0;
    Eh = T224_IV[8] | 0;
    El = T224_IV[9] | 0;
    Fh = T224_IV[10] | 0;
    Fl = T224_IV[11] | 0;
    Gh = T224_IV[12] | 0;
    Gl = T224_IV[13] | 0;
    Hh = T224_IV[14] | 0;
    Hl = T224_IV[15] | 0;
    constructor() {
        super(28);
    }
}
/** Internal SHA-512/256 hash class using the derived `T256_IV` and the shared
 * RFC 6234 Section 6.4 compression engine. */
class _SHA512_256 extends SHA2_64B {
    Ah = T256_IV[0] | 0;
    Al = T256_IV[1] | 0;
    Bh = T256_IV[2] | 0;
    Bl = T256_IV[3] | 0;
    Ch = T256_IV[4] | 0;
    Cl = T256_IV[5] | 0;
    Dh = T256_IV[6] | 0;
    Dl = T256_IV[7] | 0;
    Eh = T256_IV[8] | 0;
    El = T256_IV[9] | 0;
    Fh = T256_IV[10] | 0;
    Fl = T256_IV[11] | 0;
    Gh = T256_IV[12] | 0;
    Gl = T256_IV[13] | 0;
    Hh = T256_IV[14] | 0;
    Hl = T256_IV[15] | 0;
    constructor() {
        super(32);
    }
}
/**
 * SHA2-256 hash function from RFC 4634. In JS it's the fastest: even faster than Blake3. Some info:
 *
 * - Trying 2^128 hashes would get 50% chance of collision, using birthday attack.
 * - BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 * - Each sha256 hash is executing 2^18 bit operations.
 * - Good 2024 ASICs can do 200Th/sec with 3500 watts of power, corresponding to 2^36 hashes/joule.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-256.
 * ```ts
 * sha256(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha256 = /* @__PURE__ */ createHasher(() => new _SHA256(), 
/* @__PURE__ */ oidNist(0x01));
/**
 * SHA2-224 hash function from RFC 4634.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-224.
 * ```ts
 * sha224(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha224 = /* @__PURE__ */ createHasher(() => new _SHA224(), 
/* @__PURE__ */ oidNist(0x04));
/**
 * SHA2-512 hash function from RFC 4634.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-512.
 * ```ts
 * sha512(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha512 = /* @__PURE__ */ createHasher(() => new _SHA512(), 
/* @__PURE__ */ oidNist(0x03));
/**
 * SHA2-384 hash function from RFC 4634.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-384.
 * ```ts
 * sha384(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha384 = /* @__PURE__ */ createHasher(() => new _SHA384(), 
/* @__PURE__ */ oidNist(0x02));
/**
 * SHA2-512/256 "truncated" hash function, with improved resistance to length extension attacks.
 * See the paper on {@link https://eprint.iacr.org/2010/548.pdf | truncated SHA512}.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-512/256.
 * ```ts
 * sha512_256(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha512_256 = /* @__PURE__ */ createHasher(() => new _SHA512_256(), 
/* @__PURE__ */ oidNist(0x06));
/**
 * SHA2-512/224 "truncated" hash function, with improved resistance to length extension attacks.
 * See the paper on {@link https://eprint.iacr.org/2010/548.pdf | truncated SHA512}.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-512/224.
 * ```ts
 * sha512_224(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha512_224 = /* @__PURE__ */ createHasher(() => new _SHA512_224(), 
/* @__PURE__ */ oidNist(0x05));
//# sourceMappingURL=sha2.js.map
  return { _SHA256, _SHA224, _SHA512, _SHA384, _SHA512_224, _SHA512_256, sha256, sha224, sha512, sha384, sha512_256, sha512_224 };
})();

// ── @noble/curves utils.js (v2.2.0, MIT, Paul Miller) ────────────────────────────────────────────────────────
const C_utils = (() => {
  const { abytes: abytes_, anumber: anumber_, bytesToHex: bytesToHex_, concatBytes: concatBytes_, hexToBytes: hexToBytes_, isBytes: isBytes_, randomBytes: randomBytes_ } = H_utils;
/**
 * Hex, bytes and number utilities.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */

/**
 * Validates that a value is a byte array.
 * @param value - Value to validate.
 * @param length - Optional exact byte length.
 * @param title - Optional field name.
 * @returns Original byte array.
 * @example
 * Reject non-byte input before passing data into curve code.
 *
 * ```ts
 * abytes(new Uint8Array(1));
 * ```
 */
const abytes = (value, length, title) => abytes_(value, length, title);
/**
 * Validates that a value is a non-negative safe integer.
 * @param n - Value to validate.
 * @param title - Optional field name.
 * @example
 * Validate a numeric length before allocating buffers.
 *
 * ```ts
 * anumber(1);
 * ```
 */
const anumber = anumber_;
/**
 * Encodes bytes as lowercase hex.
 * @param bytes - Bytes to encode.
 * @returns Lowercase hex string.
 * @example
 * Serialize bytes as hex for logging or fixtures.
 *
 * ```ts
 * bytesToHex(Uint8Array.of(1, 2, 3));
 * ```
 */
const bytesToHex = bytesToHex_;
/**
 * Concatenates byte arrays.
 * @param arrays - Byte arrays to join.
 * @returns Concatenated bytes.
 * @example
 * Join domain-separated chunks into one buffer.
 *
 * ```ts
 * concatBytes(Uint8Array.of(1), Uint8Array.of(2));
 * ```
 */
const concatBytes = (...arrays) => concatBytes_(...arrays);
/**
 * Decodes lowercase or uppercase hex into bytes.
 * @param hex - Hex string to decode.
 * @returns Decoded bytes.
 * @example
 * Parse fixture hex into bytes before hashing.
 *
 * ```ts
 * hexToBytes('0102');
 * ```
 */
const hexToBytes = (hex) => hexToBytes_(hex);
/**
 * Checks whether a value is a Uint8Array.
 * @param a - Value to inspect.
 * @returns `true` when `a` is a Uint8Array.
 * @example
 * Branch on byte input before decoding it.
 *
 * ```ts
 * isBytes(new Uint8Array(1));
 * ```
 */
const isBytes = isBytes_;
/**
 * Reads random bytes from the platform CSPRNG.
 * @param bytesLength - Number of random bytes to read.
 * @returns Fresh random bytes.
 * @example
 * Generate a random seed for a keypair.
 *
 * ```ts
 * randomBytes(2);
 * ```
 */
const randomBytes = (bytesLength) => randomBytes_(bytesLength);
const _0n = /* @__PURE__ */ BigInt(0);
const _1n = /* @__PURE__ */ BigInt(1);
/**
 * Validates that a flag is boolean.
 * @param value - Value to validate.
 * @param title - Optional field name.
 * @returns Original value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Reject non-boolean option flags early.
 *
 * ```ts
 * abool(true);
 * ```
 */
function abool(value, title = '') {
    if (typeof value !== 'boolean') {
        const prefix = title && `"${title}" `;
        throw new TypeError(prefix + 'expected boolean, got type=' + typeof value);
    }
    return value;
}
/**
 * Validates that a value is a non-negative bigint or safe integer.
 * @param n - Value to validate.
 * @returns The same validated value.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate one integer-like value before serializing it.
 *
 * ```ts
 * abignumber(1n);
 * ```
 */
function abignumber(n) {
    if (typeof n === 'bigint') {
        if (!isPosBig(n))
            throw new RangeError('positive bigint expected, got ' + n);
    }
    else
        anumber(n);
    return n;
}
/**
 * Validates that a value is a safe integer.
 * @param value - Integer to validate.
 * @param title - Optional field name.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a window size before scalar arithmetic uses it.
 *
 * ```ts
 * asafenumber(1);
 * ```
 */
function asafenumber(value, title = '') {
    if (typeof value !== 'number') {
        const prefix = title && `"${title}" `;
        throw new TypeError(prefix + 'expected number, got type=' + typeof value);
    }
    if (!Number.isSafeInteger(value)) {
        const prefix = title && `"${title}" `;
        throw new RangeError(prefix + 'expected safe integer, got ' + value);
    }
}
/**
 * Encodes a bigint into even-length big-endian hex.
 * The historical "unpadded" name only means "no fixed-width field padding"; odd-length hex still
 * gets one leading zero nibble so the result always represents whole bytes.
 * @param num - Number to encode.
 * @returns Big-endian hex string.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Encode a scalar into hex without a `0x` prefix.
 *
 * ```ts
 * numberToHexUnpadded(255n);
 * ```
 */
function numberToHexUnpadded(num) {
    const hex = abignumber(num).toString(16);
    return hex.length & 1 ? '0' + hex : hex;
}
/**
 * Parses a big-endian hex string into bigint.
 * Accepts odd-length hex through the native `BigInt('0x' + hex)` parser and currently surfaces the
 * same native `SyntaxError` for malformed hex instead of wrapping it in a library-specific error.
 * @param hex - Hex string without `0x`.
 * @returns Parsed bigint value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Parse a scalar from fixture hex.
 *
 * ```ts
 * hexToNumber('ff');
 * ```
 */
function hexToNumber(hex) {
    if (typeof hex !== 'string')
        throw new TypeError('hex string expected, got ' + typeof hex);
    return hex === '' ? _0n : BigInt('0x' + hex); // Big Endian
}
// BE: Big Endian, LE: Little Endian
/**
 * Parses big-endian bytes into bigint.
 * @param bytes - Bytes in big-endian order.
 * @returns Parsed bigint value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Read a scalar encoded in network byte order.
 *
 * ```ts
 * bytesToNumberBE(Uint8Array.of(1, 0));
 * ```
 */
function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex_(bytes));
}
/**
 * Parses little-endian bytes into bigint.
 * @param bytes - Bytes in little-endian order.
 * @returns Parsed bigint value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Read a scalar encoded in little-endian form.
 *
 * ```ts
 * bytesToNumberLE(Uint8Array.of(1, 0));
 * ```
 */
function bytesToNumberLE(bytes) {
    return hexToNumber(bytesToHex_(copyBytes(abytes_(bytes)).reverse()));
}
/**
 * Encodes a bigint into fixed-length big-endian bytes.
 * @param n - Number to encode.
 * @param len - Output length in bytes. Must be greater than zero.
 * @returns Big-endian byte array.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Serialize a scalar into a 32-byte field element.
 *
 * ```ts
 * numberToBytesBE(255n, 2);
 * ```
 */
function numberToBytesBE(n, len) {
    anumber_(len);
    if (len === 0)
        throw new RangeError('zero length');
    n = abignumber(n);
    const hex = n.toString(16);
    // Detect overflow before hex parsing so oversized values don't leak the shared odd-hex error.
    if (hex.length > len * 2)
        throw new RangeError('number too large');
    return hexToBytes_(hex.padStart(len * 2, '0'));
}
/**
 * Encodes a bigint into fixed-length little-endian bytes.
 * @param n - Number to encode.
 * @param len - Output length in bytes.
 * @returns Little-endian byte array.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Serialize a scalar for little-endian protocols.
 *
 * ```ts
 * numberToBytesLE(255n, 2);
 * ```
 */
function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
}
// Unpadded, rarely used
/**
 * Encodes a bigint into variable-length big-endian bytes.
 * @param n - Number to encode.
 * @returns Variable-length big-endian bytes.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Serialize a bigint without fixed-width padding.
 *
 * ```ts
 * numberToVarBytesBE(255n);
 * ```
 */
function numberToVarBytesBE(n) {
    return hexToBytes_(numberToHexUnpadded(abignumber(n)));
}
// Compares 2 u8a-s in kinda constant time
/**
 * Compares two byte arrays in constant-ish time.
 * @param a - Left byte array.
 * @param b - Right byte array.
 * @returns `true` when bytes match.
 * @example
 * Compare two encoded points without early exit.
 *
 * ```ts
 * equalBytes(Uint8Array.of(1), Uint8Array.of(1));
 * ```
 */
function equalBytes(a, b) {
    a = abytes(a);
    b = abytes(b);
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
/**
 * Copies Uint8Array. We can't use u8a.slice(), because u8a can be Buffer,
 * and Buffer#slice creates mutable copy. Never use Buffers!
 * @param bytes - Bytes to copy.
 * @returns Detached copy.
 * @example
 * Make an isolated copy before mutating serialized bytes.
 *
 * ```ts
 * copyBytes(Uint8Array.of(1, 2, 3));
 * ```
 */
function copyBytes(bytes) {
    // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
    // because callers use it at byte-validation boundaries before mutating the detached copy.
    return Uint8Array.from(abytes(bytes));
}
/**
 * Decodes 7-bit ASCII string to Uint8Array, throws on non-ascii symbols
 * Should be safe to use for things expected to be ASCII.
 * Returns exact same result as `TextEncoder` for ASCII or throws.
 * @param ascii - ASCII input text.
 * @returns Encoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Encode an ASCII domain-separation tag.
 *
 * ```ts
 * asciiToBytes('ABC');
 * ```
 */
function asciiToBytes(ascii) {
    if (typeof ascii !== 'string')
        throw new TypeError('ascii string expected, got ' + typeof ascii);
    return Uint8Array.from(ascii, (c, i) => {
        const charCode = c.charCodeAt(0);
        if (c.length !== 1 || charCode > 127) {
            throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
        }
        return charCode;
    });
}
// Historical name: this accepts non-negative bigints, including zero.
const isPosBig = (n) => typeof n === 'bigint' && _0n <= n;
/**
 * Checks whether a bigint lies inside a half-open range.
 * @param n - Candidate value.
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 * @returns `true` when the value is inside the range.
 * @example
 * Check whether a candidate scalar fits the field order.
 *
 * ```ts
 * inRange(2n, 1n, 3n);
 * ```
 */
function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
/**
 * Asserts `min <= n < max`. NOTE: upper bound is exclusive.
 * @param title - Value label for error messages.
 * @param n - Candidate value.
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 * Wrong-type inputs are not separated from out-of-range values here: they still flow through the
 * shared `RangeError` path because this is only a throwing wrapper around `inRange(...)`.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Assert that a bigint stays within one half-open range.
 *
 * ```ts
 * aInRange('x', 2n, 1n, 256n);
 * ```
 */
function aInRange(title, n, min, max) {
    // Why min <= n < max and not a (min < n < max) OR b (min <= n <= max)?
    // consider P=256n, min=0n, max=P
    // - a for min=0 would require -1:          `inRange('x', x, -1n, P)`
    // - b would commonly require subtraction:  `inRange('x', x, 0n, P - 1n)`
    // - our way is the cleanest:               `inRange('x', x, 0n, P)
    if (!inRange(n, min, max))
        throw new RangeError('expected valid ' + title + ': ' + min + ' <= n < ' + max + ', got ' + n);
}
// Bit operations
/**
 * Calculates amount of bits in a bigint.
 * Same as `n.toString(2).length`
 * TODO: merge with nLength in modular
 * @param n - Value to inspect.
 * @returns Bit length.
 * @throws If the value is negative. {@link Error}
 * @example
 * Measure the bit length of a scalar before serialization.
 *
 * ```ts
 * bitLen(8n);
 * ```
 */
function bitLen(n) {
    // Size callers in this repo only use non-negative orders / scalars, so negative inputs are a
    // contract bug and must not silently collapse to zero bits.
    if (n < _0n)
        throw new Error('expected non-negative bigint, got ' + n);
    let len;
    for (len = 0; n > _0n; n >>= _1n, len += 1)
        ;
    return len;
}
/**
 * Gets single bit at position.
 * NOTE: first bit position is 0 (same as arrays)
 * Same as `!!+Array.from(n.toString(2)).reverse()[pos]`
 * @param n - Source value.
 * @param pos - Bit position. Negative positions are passed through to raw
 *   bigint shift semantics; because the mask is built as `1n << pos`,
 *   they currently collapse to `0n` and make the helper a no-op.
 * @returns Bit as bigint.
 * @example
 * Gets single bit at position.
 *
 * ```ts
 * bitGet(5n, 0);
 * ```
 */
function bitGet(n, pos) {
    return (n >> BigInt(pos)) & _1n;
}
/**
 * Sets single bit at position.
 * @param n - Source value.
 * @param pos - Bit position. Negative positions are passed through to raw bigint shift semantics,
 *   so they currently behave like left shifts.
 * @param value - Whether the bit should be set.
 * @returns Updated bigint.
 * @example
 * Sets single bit at position.
 *
 * ```ts
 * bitSet(0n, 1, true);
 * ```
 */
function bitSet(n, pos, value) {
    const mask = _1n << BigInt(pos);
    // Clearing needs AND-not here; OR with zero leaves an already-set bit untouched.
    return value ? n | mask : n & ~mask;
}
/**
 * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
 * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
 * @param n - Number of bits. Negative widths are currently passed through to raw bigint shift
 *   semantics and therefore produce `-1n`.
 * @returns Bitmask value.
 * @example
 * Calculate mask for N bits.
 *
 * ```ts
 * bitMask(4);
 * ```
 */
const bitMask = (n) => (_1n << BigInt(n)) - _1n;
/**
 * Minimal HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
 * @param hashLen - Hash output size in bytes. Callers are expected to pass a positive length; `0`
 *   is not rejected here and would make the internal generate loop non-progressing.
 * @param qByteLen - Requested output size in bytes. Callers are expected to pass a positive length.
 * @param hmacFn - HMAC implementation.
 * @returns Function that will call DRBG until the predicate returns anything
 *   other than `undefined`.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Build a deterministic nonce generator for RFC6979-style signing.
 *
 * ```ts
 * import { createHmacDrbg } from '@noble/curves/utils.js';
 * import { hmac } from '@noble/hashes/hmac.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const drbg = createHmacDrbg(32, 32, (key, msg) => hmac(sha256, key, msg));
 * const seed = new Uint8Array(32);
 * drbg(seed, (bytes) => bytes);
 * ```
 */
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
    anumber_(hashLen, 'hashLen');
    anumber_(qByteLen, 'qByteLen');
    if (typeof hmacFn !== 'function')
        throw new TypeError('hmacFn must be a function');
    // creates Uint8Array
    const u8n = (len) => new Uint8Array(len);
    const NULL = Uint8Array.of();
    const byte0 = Uint8Array.of(0x00);
    const byte1 = Uint8Array.of(0x01);
    const _maxDrbgIters = 1000;
    // Step B, Step C: set hashLen to 8*ceil(hlen/8).
    // Minimal non-full-spec HMAC-DRBG from NIST 800-90 for RFC6979 signatures.
    let v = u8n(hashLen);
    // Steps B and C of RFC6979 3.2.
    let k = u8n(hashLen);
    let i = 0; // Iterations counter, will throw when over 1000
    const reset = () => {
        v.fill(1);
        k.fill(0);
        i = 0;
    };
    // hmac(k)(v, ...values)
    const h = (...msgs) => hmacFn(k, concatBytes(v, ...msgs));
    const reseed = (seed = NULL) => {
        // HMAC-DRBG reseed() function. Steps D-G
        k = h(byte0, seed); // k = hmac(k || v || 0x00 || seed)
        v = h(); // v = hmac(k || v)
        if (seed.length === 0)
            return;
        k = h(byte1, seed); // k = hmac(k || v || 0x01 || seed)
        v = h(); // v = hmac(k || v)
    };
    const gen = () => {
        // HMAC-DRBG generate() function
        if (i++ >= _maxDrbgIters)
            throw new Error('drbg: tried max amount of iterations');
        let len = 0;
        const out = [];
        while (len < qByteLen) {
            v = h();
            const sl = v.slice();
            out.push(sl);
            len += v.length;
        }
        return concatBytes(...out);
    };
    const genUntil = (seed, pred) => {
        reset();
        reseed(seed); // Steps D-G
        let res = undefined; // Step H: grind until the predicate accepts a candidate.
        // Falsy values like 0 are valid outputs.
        while ((res = pred(gen())) === undefined)
            reseed();
        reset();
        return res;
    };
    return genUntil;
}
/**
 * Validates declared required and optional field types on a plain object.
 * Extra keys are intentionally ignored because many callers validate only the subset they use from
 * richer option bags or runtime objects.
 * @param object - Object to validate.
 * @param fields - Required field types.
 * @param optFields - Optional field types.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Check user options before building a curve helper.
 *
 * ```ts
 * validateObject({ flag: true }, { flag: 'boolean' });
 * ```
 */
function validateObject(object, fields = {}, optFields = {}) {
    if (Object.prototype.toString.call(object) !== '[object Object]')
        throw new TypeError('expected valid options object');
    function checkField(fieldName, expectedType, isOpt) {
        // Config/data fields must be explicit own properties, but runtime objects such as Field
        // instances intentionally satisfy required method slots via their shared prototype.
        if (!isOpt && expectedType !== 'function' && !Object.hasOwn(object, fieldName))
            throw new TypeError(`param "${fieldName}" is invalid: expected own property`);
        const val = object[fieldName];
        if (isOpt && val === undefined)
            return;
        const current = typeof val;
        if (current !== expectedType || val === null)
            throw new TypeError(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
    }
    const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
}
/**
 * Throws not implemented error.
 * @returns Never returns.
 * @throws If the unfinished code path is reached. {@link Error}
 * @example
 * Surface the placeholder error from an unfinished code path.
 *
 * ```ts
 * try {
 *   notImplemented();
 * } catch {}
 * ```
 */
const notImplemented = () => {
    throw new Error('not implemented');
};
//# sourceMappingURL=utils.js.map
  return { abytes, anumber, bytesToHex, concatBytes, hexToBytes, isBytes, randomBytes, abool, abignumber, asafenumber, numberToHexUnpadded, hexToNumber, bytesToNumberBE, bytesToNumberLE, numberToBytesBE, numberToBytesLE, numberToVarBytesBE, equalBytes, copyBytes, asciiToBytes, inRange, aInRange, bitLen, bitGet, bitSet, bitMask, createHmacDrbg, validateObject, notImplemented };
})();

// ── @noble/curves abstract/modular.js (v2.2.0, MIT, Paul Miller) ─────────────────────────────────────────────
const C_modular = (() => {
  const { abool, abytes, anumber, asafenumber, bitLen, bytesToNumberBE, bytesToNumberLE, numberToBytesBE, numberToBytesLE, validateObject } = C_utils;
/**
 * Utils for modular division and fields.
 * Field over 11 is a finite (Galois) field is integer number operations `mod 11`.
 * There is no division: it is replaced by modular multiplicative inverse.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */

// Numbers aren't used in x25519 / x448 builds
// prettier-ignore
const _0n = /* @__PURE__ */ BigInt(0), _1n = /* @__PURE__ */ BigInt(1), _2n = /* @__PURE__ */ BigInt(2);
// prettier-ignore
const _3n = /* @__PURE__ */ BigInt(3), _4n = /* @__PURE__ */ BigInt(4), _5n = /* @__PURE__ */ BigInt(5);
// prettier-ignore
const _7n = /* @__PURE__ */ BigInt(7), _8n = /* @__PURE__ */ BigInt(8), _9n = /* @__PURE__ */ BigInt(9);
const _16n = /* @__PURE__ */ BigInt(16);
/**
 * @param a - Dividend value.
 * @param b - Positive modulus.
 * @returns Reduced value in `[0, b)` only when `b` is positive.
 * @throws If the modulus is not positive. {@link Error}
 * @example
 * Normalize a bigint into one field residue.
 *
 * ```ts
 * mod(-1n, 5n);
 * ```
 */
function mod(a, b) {
    if (b <= _0n)
        throw new Error('mod: expected positive modulus, got ' + b);
    const result = a % b;
    return result >= _0n ? result : b + result;
}
/**
 * Efficiently raise num to a power with modular reduction.
 * Unsafe in some contexts: uses ladder, so can expose bigint bits.
 * Low-level helper: callers that need canonical residues must pass a valid `num` for the chosen
 * modulus instead of relying on the `power===0/1` fast paths to normalize it.
 * @param num - Base value.
 * @param power - Exponent value.
 * @param modulo - Reduction modulus.
 * @returns Modular exponentiation result.
 * @throws If the modulus or exponent is invalid. {@link Error}
 * @example
 * Raise one bigint to a modular power.
 *
 * ```ts
 * pow(2n, 6n, 11n) // 64n % 11n == 9n
 * ```
 */
function pow(num, power, modulo) {
    return FpPow(Field(modulo), num, power);
}
/**
 * Does `x^(2^power)` mod p. `pow2(30, 4)` == `30^(2^4)`.
 * Low-level helper: callers that need canonical residues must pass a valid `x` for the chosen
 * modulus; the `power===0` fast path intentionally returns the input as-is.
 * @param x - Base value.
 * @param power - Number of squarings.
 * @param modulo - Reduction modulus.
 * @returns Repeated-squaring result.
 * @throws If the exponent is negative. {@link Error}
 * @example
 * Apply repeated squaring inside one field.
 *
 * ```ts
 * pow2(3n, 2n, 11n);
 * ```
 */
function pow2(x, power, modulo) {
    if (power < _0n)
        throw new Error('pow2: expected non-negative exponent, got ' + power);
    let res = x;
    while (power-- > _0n) {
        res *= res;
        res %= modulo;
    }
    return res;
}
/**
 * Inverses number over modulo.
 * Implemented using the {@link https://brilliant.org/wiki/extended-euclidean-algorithm/ | extended Euclidean algorithm}.
 * @param number - Value to invert.
 * @param modulo - Positive modulus.
 * @returns Multiplicative inverse.
 * @throws If the modulus is invalid or the inverse does not exist. {@link Error}
 * @example
 * Compute one modular inverse with the extended Euclidean algorithm.
 *
 * ```ts
 * invert(3n, 11n);
 * ```
 */
function invert(number, modulo) {
    if (number === _0n)
        throw new Error('invert: expected non-zero number');
    if (modulo <= _0n)
        throw new Error('invert: expected positive modulus, got ' + modulo);
    // Fermat's little theorem "CT-like" version inv(n) = n^(m-2) mod m is 30x slower.
    let a = mod(number, modulo);
    let b = modulo;
    // prettier-ignore
    let x = _0n, y = _1n, u = _1n, v = _0n;
    while (a !== _0n) {
        const q = b / a;
        const r = b - a * q;
        const m = x - u * q;
        const n = y - v * q;
        // prettier-ignore
        b = a, a = r, x = u, y = v, u = m, v = n;
    }
    const gcd = b;
    if (gcd !== _1n)
        throw new Error('invert: does not exist');
    return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
    const F = Fp;
    if (!F.eql(F.sqr(root), n))
        throw new Error('Cannot find square root');
}
// Not all roots are possible! Example which will throw:
// const NUM =
// n = 72057594037927816n;
// Fp = Field(BigInt('0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab'));
function sqrt3mod4(Fp, n) {
    const F = Fp;
    const p1div4 = (F.ORDER + _1n) / _4n;
    const root = F.pow(n, p1div4);
    assertIsSquare(F, root, n);
    return root;
}
// Equivalent `q = 5 (mod 8)` square-root formula (Atkin-style), not the RFC Appendix I.2 CMOV
// pseudocode verbatim.
function sqrt5mod8(Fp, n) {
    const F = Fp;
    const p5div8 = (F.ORDER - _5n) / _8n;
    const n2 = F.mul(n, _2n);
    const v = F.pow(n2, p5div8);
    const nv = F.mul(n, v);
    const i = F.mul(F.mul(nv, _2n), v);
    const root = F.mul(nv, F.sub(i, F.ONE));
    assertIsSquare(F, root, n);
    return root;
}
// Based on RFC9380, Kong algorithm
// prettier-ignore
function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE)); //  1. c1 = sqrt(-1) in F, i.e., (c1^2) == -1 in F
    const c2 = tn(Fp_, c1); //  2. c2 = sqrt(c1) in F, i.e., (c2^2) == c1 in F
    const c3 = tn(Fp_, Fp_.neg(c1)); //  3. c3 = sqrt(-c1) in F, i.e., (c3^2) == -c1 in F
    const c4 = (P + _7n) / _16n; //  4. c4 = (q + 7) / 16        # Integer arithmetic
    return ((Fp, n) => {
        const F = Fp;
        let tv1 = F.pow(n, c4); //  1. tv1 = x^c4
        let tv2 = F.mul(tv1, c1); //  2. tv2 = c1 * tv1
        const tv3 = F.mul(tv1, c2); //  3. tv3 = c2 * tv1
        const tv4 = F.mul(tv1, c3); //  4. tv4 = c3 * tv1
        const e1 = F.eql(F.sqr(tv2), n); //  5.  e1 = (tv2^2) == x
        const e2 = F.eql(F.sqr(tv3), n); //  6.  e2 = (tv3^2) == x
        tv1 = F.cmov(tv1, tv2, e1); //  7. tv1 = CMOV(tv1, tv2, e1)  # Select tv2 if (tv2^2) == x
        tv2 = F.cmov(tv4, tv3, e2); //  8. tv2 = CMOV(tv4, tv3, e2)  # Select tv3 if (tv3^2) == x
        const e3 = F.eql(F.sqr(tv2), n); //  9.  e3 = (tv2^2) == x
        const root = F.cmov(tv1, tv2, e3); // 10.  z = CMOV(tv1, tv2, e3)   # Select sqrt from tv1 & tv2
        assertIsSquare(F, root, n);
        return root;
    });
}
/**
 * Tonelli-Shanks square root search algorithm.
 * This implementation is variable-time: it searches data-dependently for the first non-residue `Z`
 * and for the smallest `i` in the main loop, unlike RFC 9380 Appendix I.4's constant-time shape.
 * 1. {@link https://eprint.iacr.org/2012/685.pdf | eprint 2012/685}, page 12
 * 2. Square Roots from 1; 24, 51, 10 to Dan Shanks
 * @param P - field order
 * @returns function that takes field Fp (created from P) and number n
 * @throws If the field is too small, non-prime, or the square root does not exist. {@link Error}
 * @example
 * Construct a square-root helper for primes that need Tonelli-Shanks.
 *
 * ```ts
 * import { Field, tonelliShanks } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const sqrt = tonelliShanks(17n)(Fp, 4n);
 * ```
 */
function tonelliShanks(P) {
    // Initialization (precomputation).
    // Caching initialization could boost perf by 7%.
    if (P < _3n)
        throw new Error('sqrt is not defined for small field');
    // Factor P - 1 = Q * 2^S, where Q is odd
    let Q = P - _1n;
    let S = 0;
    while (Q % _2n === _0n) {
        Q /= _2n;
        S++;
    }
    // Find the first quadratic non-residue Z >= 2
    let Z = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
        // Basic primality test for P. After x iterations, chance of
        // not finding quadratic non-residue is 2^x, so 2^1000.
        if (Z++ > 1000)
            throw new Error('Cannot find square root: probably non-prime P');
    }
    // Fast-path; usually done before Z, but we do "primality test".
    if (S === 1)
        return sqrt3mod4;
    // Slow-path
    // TODO: test on Fp2 and others
    let cc = _Fp.pow(Z, Q); // c = z^Q
    const Q1div2 = (Q + _1n) / _2n;
    return function tonelliSlow(Fp, n) {
        const F = Fp;
        if (F.is0(n))
            return n;
        // Check if n is a quadratic residue using Legendre symbol
        if (FpLegendre(F, n) !== 1)
            throw new Error('Cannot find square root');
        // Initialize variables for the main loop
        let M = S;
        let c = F.mul(F.ONE, cc); // c = z^Q, move cc from field _Fp into field Fp
        let t = F.pow(n, Q); // t = n^Q, first guess at the fudge factor
        let R = F.pow(n, Q1div2); // R = n^((Q+1)/2), first guess at the square root
        // Main loop
        // while t != 1
        while (!F.eql(t, F.ONE)) {
            if (F.is0(t))
                return F.ZERO; // if t=0 return R=0
            let i = 1;
            // Find the smallest i >= 1 such that t^(2^i) ≡ 1 (mod P)
            let t_tmp = F.sqr(t); // t^(2^1)
            while (!F.eql(t_tmp, F.ONE)) {
                i++;
                t_tmp = F.sqr(t_tmp); // t^(2^2)...
                if (i === M)
                    throw new Error('Cannot find square root');
            }
            // Calculate the exponent for b: 2^(M - i - 1)
            const exponent = _1n << BigInt(M - i - 1); // bigint is important
            const b = F.pow(c, exponent); // b = 2^(M - i - 1)
            // Update variables
            M = i;
            c = F.sqr(b); // c = b^2
            t = F.mul(t, c); // t = (t * b^2)
            R = F.mul(R, b); // R = R*b
        }
        return R;
    };
}
/**
 * Square root for a finite field. Will try optimized versions first:
 *
 * 1. P ≡ 3 (mod 4)
 * 2. P ≡ 5 (mod 8)
 * 3. P ≡ 9 (mod 16)
 * 4. Tonelli-Shanks algorithm
 *
 * Different algorithms can give different roots, it is up to user to decide which one they want.
 * For example there is FpSqrtOdd/FpSqrtEven to choose a root by oddness
 * (used for hash-to-curve).
 * @param P - Field order.
 * @returns Square-root helper. The generic fallback inherits Tonelli-Shanks' variable-time
 *   behavior and this selector assumes prime-field-style integer moduli.
 * @throws If the field is unsupported or the square root does not exist. {@link Error}
 * @example
 * Choose the square-root helper appropriate for one field modulus.
 *
 * ```ts
 * import { Field, FpSqrt } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const sqrt = FpSqrt(17n)(Fp, 4n);
 * ```
 */
function FpSqrt(P) {
    // P ≡ 3 (mod 4) => √n = n^((P+1)/4)
    if (P % _4n === _3n)
        return sqrt3mod4;
    // P ≡ 5 (mod 8) => Atkin algorithm, page 10 of https://eprint.iacr.org/2012/685.pdf
    if (P % _8n === _5n)
        return sqrt5mod8;
    // P ≡ 9 (mod 16) => Kong algorithm, page 11 of https://eprint.iacr.org/2012/685.pdf (algorithm 4)
    if (P % _16n === _9n)
        return sqrt9mod16(P);
    // Tonelli-Shanks algorithm
    return tonelliShanks(P);
}
/**
 * @param num - Value to inspect.
 * @param modulo - Field modulus.
 * @returns `true` when the least-significant little-endian bit is set.
 * @throws If the modulus is invalid for `mod(...)`. {@link Error}
 * @example
 * Inspect the low bit used by little-endian sign conventions.
 *
 * ```ts
 * isNegativeLE(3n, 11n);
 * ```
 */
const isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n) === _1n;
// prettier-ignore
// Arithmetic-only subset checked by validateField(). This is intentionally not the full runtime
// IField contract: helpers like `isValidNot0`, `invertBatch`, `toBytes`, `fromBytes`, `cmov`, and
// field-specific extras like `isOdd` are left to the callers that actually need them.
const FIELD_FIELDS = [
    'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
    'eql', 'add', 'sub', 'mul', 'pow', 'div',
    'addN', 'subN', 'mulN', 'sqrN'
];
/**
 * @param field - Field implementation.
 * @returns Validated field. This only checks the arithmetic subset needed by generic helpers; it
 *   does not guarantee full runtime-method coverage for serialization, batching, `cmov`, or
 *   field-specific extras beyond positive `BYTES` / `BITS`.
 * @throws If the field shape or numeric metadata are invalid. {@link Error}
 * @example
 * Check that a field implementation exposes the operations curve code expects.
 *
 * ```ts
 * import { Field, validateField } from '@noble/curves/abstract/modular.js';
 * const Fp = validateField(Field(17n));
 * ```
 */
function validateField(field) {
    const initial = {
        ORDER: 'bigint',
        BYTES: 'number',
        BITS: 'number',
    };
    const opts = FIELD_FIELDS.reduce((map, val) => {
        map[val] = 'function';
        return map;
    }, initial);
    validateObject(field, opts);
    // Runtime field implementations must expose real integer byte/bit sizes; fractional / NaN /
    // infinite metadata leaks through validateObject(type='number') but breaks encoders and caches.
    asafenumber(field.BYTES, 'BYTES');
    asafenumber(field.BITS, 'BITS');
    // Runtime field implementations must expose positive byte/bit sizes; zero leaks through the
    // numeric shape checks above but still breaks encoding helpers and cached-length assumptions.
    if (field.BYTES < 1 || field.BITS < 1)
        throw new Error('invalid field: expected BYTES/BITS > 0');
    if (field.ORDER <= _1n)
        throw new Error('invalid field: expected ORDER > 1, got ' + field.ORDER);
    return field;
}
// Generic field functions
/**
 * Same as `pow` but for Fp: non-constant-time.
 * Unsafe in some contexts: uses ladder, so can expose bigint bits.
 * @param Fp - Field implementation.
 * @param num - Base value.
 * @param power - Exponent value.
 * @returns Powered field element.
 * @throws If the exponent is negative. {@link Error}
 * @example
 * Raise one field element to a public exponent.
 *
 * ```ts
 * import { Field, FpPow } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const x = FpPow(Fp, 3n, 5n);
 * ```
 */
function FpPow(Fp, num, power) {
    const F = Fp;
    if (power < _0n)
        throw new Error('invalid exponent, negatives unsupported');
    if (power === _0n)
        return F.ONE;
    if (power === _1n)
        return num;
    let p = F.ONE;
    let d = num;
    while (power > _0n) {
        if (power & _1n)
            p = F.mul(p, d);
        d = F.sqr(d);
        power >>= _1n;
    }
    return p;
}
/**
 * Efficiently invert an array of Field elements.
 * Exception-free. Zero-valued field elements stay `undefined` unless `passZero` is enabled.
 * @param Fp - Field implementation.
 * @param nums - Values to invert.
 * @param passZero - map 0 to 0 (instead of undefined)
 * @returns Inverted values.
 * @example
 * Invert several field elements with one shared inversion.
 *
 * ```ts
 * import { Field, FpInvertBatch } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const inv = FpInvertBatch(Fp, [1n, 2n, 4n]);
 * ```
 */
function FpInvertBatch(Fp, nums, passZero = false) {
    const F = Fp;
    const inverted = new Array(nums.length).fill(passZero ? F.ZERO : undefined);
    // Walk from first to last, multiply them by each other MOD p
    const multipliedAcc = nums.reduce((acc, num, i) => {
        if (F.is0(num))
            return acc;
        inverted[i] = acc;
        return F.mul(acc, num);
    }, F.ONE);
    // Invert last element
    const invertedAcc = F.inv(multipliedAcc);
    // Walk from last to first, multiply them by inverted each other MOD p
    nums.reduceRight((acc, num, i) => {
        if (F.is0(num))
            return acc;
        inverted[i] = F.mul(acc, inverted[i]);
        return F.mul(acc, num);
    }, invertedAcc);
    return inverted;
}
/**
 * @param Fp - Field implementation.
 * @param lhs - Dividend value.
 * @param rhs - Divisor value.
 * @returns Division result.
 * @throws If the divisor is non-invertible. {@link Error}
 * @example
 * Divide one field element by another.
 *
 * ```ts
 * import { Field, FpDiv } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const x = FpDiv(Fp, 6n, 3n);
 * ```
 */
function FpDiv(Fp, lhs, rhs) {
    const F = Fp;
    return F.mul(lhs, typeof rhs === 'bigint' ? invert(rhs, F.ORDER) : F.inv(rhs));
}
/**
 * Legendre symbol.
 * Legendre constant is used to calculate Legendre symbol (a | p)
 * which denotes the value of a^((p-1)/2) (mod p).
 *
 * * (a | p) ≡ 1    if a is a square (mod p), quadratic residue
 * * (a | p) ≡ -1   if a is not a square (mod p), quadratic non residue
 * * (a | p) ≡ 0    if a ≡ 0 (mod p)
 * @param Fp - Field implementation.
 * @param n - Value to inspect.
 * @returns Legendre symbol.
 * @throws If the field returns an invalid Legendre symbol value. {@link Error}
 * @example
 * Compute the Legendre symbol of one field element.
 *
 * ```ts
 * import { Field, FpLegendre } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const symbol = FpLegendre(Fp, 4n);
 * ```
 */
function FpLegendre(Fp, n) {
    const F = Fp;
    // We can use 3rd argument as optional cache of this value
    // but seems unneeded for now. The operation is very fast.
    const p1mod2 = (F.ORDER - _1n) / _2n;
    const powered = F.pow(n, p1mod2);
    const yes = F.eql(powered, F.ONE);
    const zero = F.eql(powered, F.ZERO);
    const no = F.eql(powered, F.neg(F.ONE));
    if (!yes && !zero && !no)
        throw new Error('invalid Legendre symbol result');
    return yes ? 1 : zero ? 0 : -1;
}
/**
 * @param Fp - Field implementation.
 * @param n - Value to inspect.
 * @returns `true` when `Fp.sqrt(n)` exists. This includes `0`, even though strict "quadratic
 *   residue" terminology often reserves that name for the non-zero square class.
 * @throws If the field returns an invalid Legendre symbol value. {@link Error}
 * @example
 * Check whether one field element has a square root in the field.
 *
 * ```ts
 * import { Field, FpIsSquare } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const isSquare = FpIsSquare(Fp, 4n);
 * ```
 */
function FpIsSquare(Fp, n) {
    const l = FpLegendre(Fp, n);
    // Zero is a square too: 0 = 0^2, and Fp.sqrt(0) already returns 0.
    return l !== -1;
}
/**
 * @param n - Curve order. Callers are expected to pass a positive order.
 * @param nBitLength - Optional cached bit length. Callers are expected to pass a positive cached
 *   value when overriding the derived bit length.
 * @returns Byte and bit lengths.
 * @throws If the order or cached bit length is invalid. {@link Error}
 * @example
 * Measure the encoding sizes needed for one modulus.
 *
 * ```ts
 * nLength(255n);
 * ```
 */
function nLength(n, nBitLength) {
    // Bit size, byte size of CURVE.n
    if (nBitLength !== undefined)
        anumber(nBitLength);
    if (n <= _0n)
        throw new Error('invalid n length: expected positive n, got ' + n);
    if (nBitLength !== undefined && nBitLength < 1)
        throw new Error('invalid n length: expected positive bit length, got ' + nBitLength);
    const bits = bitLen(n);
    // Cached bit lengths smaller than ORDER would truncate serialized scalars/elements and poison
    // any math that relies on the derived field metadata.
    if (nBitLength !== undefined && nBitLength < bits)
        throw new Error(`invalid n length: expected bit length (${bits}) >= n.length (${nBitLength})`);
    const _nBitLength = nBitLength !== undefined ? nBitLength : bits;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
}
// Keep the lazy sqrt cache off-instance so Field(...) can return a frozen object. Otherwise the
// cached helper write would keep the field surface externally mutable.
const FIELD_SQRT = new WeakMap();
class _Field {
    ORDER;
    BITS;
    BYTES;
    isLE;
    ZERO = _0n;
    ONE = _1n;
    _lengths;
    _mod;
    constructor(ORDER, opts = {}) {
        // ORDER <= 1 is degenerate: ONE would not be a valid field element and helpers like pow/inv
        // would stop modeling field arithmetic.
        if (ORDER <= _1n)
            throw new Error('invalid field: expected ORDER > 1, got ' + ORDER);
        let _nbitLength = undefined;
        this.isLE = false;
        if (opts != null && typeof opts === 'object') {
            // Cached bit lengths are trusted here and should already be positive / consistent with ORDER.
            if (typeof opts.BITS === 'number')
                _nbitLength = opts.BITS;
            if (typeof opts.sqrt === 'function')
                // `_Field.prototype` is frozen below, so custom sqrt hooks must become own properties
                // explicitly instead of relying on writable prototype shadowing via assignment.
                Object.defineProperty(this, 'sqrt', { value: opts.sqrt, enumerable: true });
            if (typeof opts.isLE === 'boolean')
                this.isLE = opts.isLE;
            if (opts.allowedLengths)
                this._lengths = Object.freeze(opts.allowedLengths.slice());
            if (typeof opts.modFromBytes === 'boolean')
                this._mod = opts.modFromBytes;
        }
        const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
        if (nByteLength > 2048)
            throw new Error('invalid field: expected ORDER of <= 2048 bytes');
        this.ORDER = ORDER;
        this.BITS = nBitLength;
        this.BYTES = nByteLength;
        Object.freeze(this);
    }
    create(num) {
        return mod(num, this.ORDER);
    }
    isValid(num) {
        if (typeof num !== 'bigint')
            throw new TypeError('invalid field element: expected bigint, got ' + typeof num);
        return _0n <= num && num < this.ORDER; // 0 is valid element, but it's not invertible
    }
    is0(num) {
        return num === _0n;
    }
    // is valid and invertible
    isValidNot0(num) {
        return !this.is0(num) && this.isValid(num);
    }
    isOdd(num) {
        return (num & _1n) === _1n;
    }
    neg(num) {
        return mod(-num, this.ORDER);
    }
    eql(lhs, rhs) {
        return lhs === rhs;
    }
    sqr(num) {
        return mod(num * num, this.ORDER);
    }
    add(lhs, rhs) {
        return mod(lhs + rhs, this.ORDER);
    }
    sub(lhs, rhs) {
        return mod(lhs - rhs, this.ORDER);
    }
    mul(lhs, rhs) {
        return mod(lhs * rhs, this.ORDER);
    }
    pow(num, power) {
        return FpPow(this, num, power);
    }
    div(lhs, rhs) {
        return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
    }
    // Same as above, but doesn't normalize
    sqrN(num) {
        return num * num;
    }
    addN(lhs, rhs) {
        return lhs + rhs;
    }
    subN(lhs, rhs) {
        return lhs - rhs;
    }
    mulN(lhs, rhs) {
        return lhs * rhs;
    }
    inv(num) {
        return invert(num, this.ORDER);
    }
    sqrt(num) {
        // Caching sqrt helpers speeds up sqrt9mod16 by 5x and Tonelli-Shanks by about 10% without keeping
        // the field instance itself mutable.
        let sqrt = FIELD_SQRT.get(this);
        if (!sqrt)
            FIELD_SQRT.set(this, (sqrt = FpSqrt(this.ORDER)));
        return sqrt(this, num);
    }
    toBytes(num) {
        // Serialize fixed-width limbs without re-validating the field range. Callers that need a
        // canonical encoding must pass a valid element; some protocols intentionally serialize raw
        // residues here and reduce or validate them elsewhere.
        return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
    }
    fromBytes(bytes, skipValidation = false) {
        abytes(bytes);
        const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
        if (allowedLengths) {
            // `allowedLengths` must list real positive byte lengths; otherwise empty input would get
            // padded into zero and silently decode as a field element.
            if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
                throw new Error('Field.fromBytes: expected ' + allowedLengths + ' bytes, got ' + bytes.length);
            }
            const padded = new Uint8Array(BYTES);
            // isLE add 0 to right, !isLE to the left.
            padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
            bytes = padded;
        }
        if (bytes.length !== BYTES)
            throw new Error('Field.fromBytes: expected ' + BYTES + ' bytes, got ' + bytes.length);
        let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
        if (modFromBytes)
            scalar = mod(scalar, ORDER);
        if (!skipValidation)
            if (!this.isValid(scalar))
                throw new Error('invalid field element: outside of range 0..ORDER');
        // Range validation is optional here because some protocols intentionally decode raw residues
        // and reduce or validate them elsewhere.
        return scalar;
    }
    // TODO: we don't need it here, move out to separate fn
    invertBatch(lst) {
        return FpInvertBatch(this, lst);
    }
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov(a, b, condition) {
        // Field elements have `isValid(...)`; the CMOV branch bit is a direct runtime input, so reject
        // non-boolean selectors here instead of letting JS truthiness silently change arithmetic.
        abool(condition, 'condition');
        return condition ? b : a;
    }
}
// Freeze the shared method surface too; otherwise callers can still poison every Field instance by
// monkey-patching `_Field.prototype` even if each instance is frozen.
Object.freeze(_Field.prototype);
/**
 * Creates a finite field. Major performance optimizations:
 * * 1. Denormalized operations like mulN instead of mul.
 * * 2. Identical object shape: never add or remove keys.
 * * 3. Frozen stable object shape; the lazy sqrt cache lives in a module-level `WeakMap`.
 * Fragile: always run a benchmark on a change.
 * Security note: operations and low-level serializers like `toBytes` don't check `isValid` for
 * all elements for performance and protocol-flexibility reasons; callers are responsible for
 * supplying valid elements when they need canonical field behavior.
 * This is low-level code, please make sure you know what you're doing.
 *
 * Note about field properties:
 * * CHARACTERISTIC p = prime number, number of elements in main subgroup.
 * * ORDER q = similar to cofactor in curves, may be composite `q = p^m`.
 *
 * @param ORDER - field order, probably prime, or could be composite
 * @param opts - Field options such as bit length or endianness. See {@link FieldOpts}.
 * @returns Frozen field instance with a stable object shape. This wrapper forwards `opts` straight
 *   into `_Field`, so it inherits `_Field`'s assumptions about cached sizes and `allowedLengths`.
 * @example
 * Construct one prime field with optional overrides.
 *
 * ```ts
 * Field(11n);
 * ```
 */
function Field(ORDER, opts = {}) {
    return new _Field(ORDER, opts);
}
// Generic random scalar, we can do same for other fields if via Fp2.mul(Fp2.ONE, Fp2.random)?
// This allows unsafe methods like ignore bias or zero. These unsafe, but often used in different protocols (if deterministic RNG).
// which mean we cannot force this via opts.
// Not sure what to do with randomBytes, we can accept it inside opts if wanted.
// Probably need to export getMinHashLength somewhere?
// random(bytes?: Uint8Array, unsafeAllowZero = false, unsafeAllowBias = false) {
//   const LEN = !unsafeAllowBias ? getMinHashLength(ORDER) : BYTES;
//   if (bytes === undefined) bytes = randomBytes(LEN); // _opts.randomBytes?
//   const num = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
//   // `mod(x, 11)` can sometimes produce 0. `mod(x, 10) + 1` is the same, but no 0
//   const reduced = unsafeAllowZero ? mod(num, ORDER) : mod(num, ORDER - _1n) + _1n;
//   return reduced;
// },
/**
 * @param Fp - Field implementation.
 * @param elm - Value to square-root.
 * @returns Odd square root when two roots exist. The special case `elm = 0` still returns `0`,
 *   which is the only square root but is not odd.
 * @throws If the field lacks oddness checks or the square root does not exist. {@link Error}
 * @example
 * Select the odd square root when two roots exist.
 *
 * ```ts
 * import { Field, FpSqrtOdd } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const root = FpSqrtOdd(Fp, 4n);
 * ```
 */
function FpSqrtOdd(Fp, elm) {
    const F = Fp;
    if (!F.isOdd)
        throw new Error("Field doesn't have isOdd");
    const root = F.sqrt(elm);
    return F.isOdd(root) ? root : F.neg(root);
}
/**
 * @param Fp - Field implementation.
 * @param elm - Value to square-root.
 * @returns Even square root.
 * @throws If the field lacks oddness checks or the square root does not exist. {@link Error}
 * @example
 * Select the even square root when two roots exist.
 *
 * ```ts
 * import { Field, FpSqrtEven } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const root = FpSqrtEven(Fp, 4n);
 * ```
 */
function FpSqrtEven(Fp, elm) {
    const F = Fp;
    if (!F.isOdd)
        throw new Error("Field doesn't have isOdd");
    const root = F.sqrt(elm);
    return F.isOdd(root) ? F.neg(root) : root;
}
/**
 * Returns total number of bytes consumed by the field element.
 * For example, 32 bytes for usual 256-bit weierstrass curve.
 * @param fieldOrder - number of field elements, usually CURVE.n. Callers are expected to pass an
 *   order greater than 1.
 * @returns byte length of field
 * @throws If the field order is not a bigint. {@link Error}
 * @example
 * Read the fixed-width byte length of one field.
 *
 * ```ts
 * getFieldBytesLength(255n);
 * ```
 */
function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== 'bigint')
        throw new Error('field order must be bigint');
    // Valid field elements are in 0..ORDER-1, so ORDER <= 1 would make the encoded range degenerate.
    if (fieldOrder <= _1n)
        throw new Error('field order must be greater than 1');
    // Valid field elements are < ORDER, so the maximal encoded element is ORDER - 1.
    const bitLength = bitLen(fieldOrder - _1n);
    return Math.ceil(bitLength / 8);
}
/**
 * Returns minimal amount of bytes that can be safely reduced
 * by field order.
 * Should be 2^-128 for 128-bit curve such as P256.
 * This is the reduction / modulo-bias lower bound; higher-level helpers may still impose a larger
 * absolute floor for policy reasons.
 * @param fieldOrder - number of field elements greater than 1, usually CURVE.n.
 * @returns byte length of target hash
 * @throws If the field order is invalid. {@link Error}
 * @example
 * Compute the minimum hash length needed for field reduction.
 *
 * ```ts
 * getMinHashLength(255n);
 * ```
 */
function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
}
/**
 * "Constant-time" private key generation utility.
 * Can take (n + n/2) or more bytes of uniform input e.g. from CSPRNG or KDF
 * and convert them into private scalar, with the modulo bias being negligible.
 * Needs at least 48 bytes of input for 32-byte private key. The implementation also keeps a hard
 * 16-byte minimum even when `getMinHashLength(...)` is smaller, so toy-small inputs do not look
 * accidentally acceptable for real scalar derivation.
 * See {@link https://research.kudelskisecurity.com/2020/07/28/the-definitive-guide-to-modulo-bias-and-how-to-avoid-it/ | Kudelski's modulo-bias guide},
 * {@link https://csrc.nist.gov/publications/detail/fips/186/5/final | FIPS 186-5 appendix A.2}, and
 * {@link https://www.rfc-editor.org/rfc/rfc9380#section-5 | RFC 9380 section 5}. Unlike RFC 9380
 * `hash_to_field`, this helper intentionally maps into the non-zero private-scalar range `1..n-1`.
 * @param key - Uniform input bytes.
 * @param fieldOrder - Size of subgroup.
 * @param isLE - interpret hash bytes as LE num
 * @returns valid private scalar
 * @throws If the hash length or field order is invalid for scalar reduction. {@link Error}
 * @example
 * Map hash output into a private scalar range.
 *
 * ```ts
 * mapHashToField(new Uint8Array(48).fill(1), 255n);
 * ```
 */
function mapHashToField(key, fieldOrder, isLE = false) {
    abytes(key);
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = Math.max(getMinHashLength(fieldOrder), 16);
    // No toy-small inputs: the helper is for real scalar derivation, not tiny test curves. No huge
    // inputs: easier to reason about JS timing / allocation behavior.
    if (len < minLen || len > 1024)
        throw new Error('expected ' + minLen + '-1024 bytes of input, got ' + len);
    const num = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
    // `mod(x, 11)` can sometimes produce 0. `mod(x, 10) + 1` is the same, but no 0
    const reduced = mod(num, fieldOrder - _1n) + _1n;
    return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
//# sourceMappingURL=modular.js.map
  return { mod, pow, pow2, invert, tonelliShanks, FpSqrt, isNegativeLE, validateField, FpPow, FpInvertBatch, FpDiv, FpLegendre, FpIsSquare, nLength, Field, FpSqrtOdd, FpSqrtEven, getFieldBytesLength, getMinHashLength, mapHashToField };
})();

// ── @noble/curves abstract/curve.js (v2.2.0, MIT, Paul Miller) ───────────────────────────────────────────────
const C_curve = (() => {
  const { bitLen, bitMask, validateObject } = C_utils;
  const { Field, FpInvertBatch, validateField } = C_modular;
/**
 * Methods for elliptic curve multiplication by scalars.
 * Contains wNAF, pippenger.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */


const _0n = /* @__PURE__ */ BigInt(0);
const _1n = /* @__PURE__ */ BigInt(1);
/**
 * Validates the static surface of a point constructor.
 * This is only a cheap sanity check for the constructor hooks and fields consumed by generic
 * factories; it does not certify `BASE`/`ZERO` semantics or prove the curve implementation itself.
 * @param Point - Runtime point constructor.
 * @throws On missing constructor hooks or malformed field metadata. {@link TypeError}
 * @example
 * Check that one point constructor exposes the static hooks generic helpers need.
 *
 * ```ts
 * import { ed25519 } from '@noble/curves/ed25519.js';
 * import { validatePointCons } from '@noble/curves/abstract/curve.js';
 * validatePointCons(ed25519.Point);
 * ```
 */
function validatePointCons(Point) {
    const pc = Point;
    if (typeof pc !== 'function')
        throw new TypeError('Point must be a constructor');
    // validateObject only accepts plain objects, so copy the constructor statics into one bag first.
    validateObject({
        Fp: pc.Fp,
        Fn: pc.Fn,
        fromAffine: pc.fromAffine,
        fromBytes: pc.fromBytes,
        fromHex: pc.fromHex,
    }, {
        Fp: 'object',
        Fn: 'object',
        fromAffine: 'function',
        fromBytes: 'function',
        fromHex: 'function',
    });
    validateField(pc.Fp);
    validateField(pc.Fn);
}
/**
 * Computes both candidates first, but the final selection still branches on `condition`, so this
 * is not a strict constant-time CMOV primitive.
 * @param condition - Whether to negate the point.
 * @param item - Point-like value.
 * @returns Original or negated value.
 * @example
 * Keep the point or return its negation based on one boolean branch.
 *
 * ```ts
 * import { negateCt } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const maybeNegated = negateCt(true, p256.Point.BASE);
 * ```
 */
function negateCt(condition, item) {
    const neg = item.negate();
    return condition ? neg : item;
}
/**
 * Takes a bunch of Projective Points but executes only one
 * inversion on all of them. Inversion is very slow operation,
 * so this improves performance massively.
 * Optimization: converts a list of projective points to a list of identical points with Z=1.
 * Input points are left as-is; the normalized points are returned as fresh instances.
 * @param c - Point constructor.
 * @param points - Projective points.
 * @returns Fresh projective points reconstructed from normalized affine coordinates.
 * @example
 * Batch-normalize projective points with a single shared inversion.
 *
 * ```ts
 * import { normalizeZ } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const points = normalizeZ(p256.Point, [p256.Point.BASE, p256.Point.BASE.double()]);
 * ```
 */
function normalizeZ(c, points) {
    const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
    return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
    if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
        throw new Error('invalid window size, expected [1..' + bits + '], got W=' + W);
}
function calcWOpts(W, scalarBits) {
    validateW(W, scalarBits);
    const windows = Math.ceil(scalarBits / W) + 1; // W=8 33. Not 32, because we skip zero
    const windowSize = 2 ** (W - 1); // W=8 128. Not 256, because we skip zero
    const maxNumber = 2 ** W; // W=8 256
    const mask = bitMask(W); // W=8 255 == mask 0b11111111
    const shiftBy = BigInt(W); // W=8 8
    return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
    const { windowSize, mask, maxNumber, shiftBy } = wOpts;
    let wbits = Number(n & mask); // extract W bits.
    let nextN = n >> shiftBy; // shift number by W bits.
    // What actually happens here:
    // const highestBit = Number(mask ^ (mask >> 1n));
    // let wbits2 = wbits - 1; // skip zero
    // if (wbits2 & highestBit) { wbits2 ^= Number(mask); // (~);
    // split if bits > max: +224 => 256-32
    if (wbits > windowSize) {
        // we skip zero, which means instead of `>= size-1`, we do `> size`
        wbits -= maxNumber; // -32, can be maxNumber - wbits, but then we need to set isNeg here.
        nextN += _1n; // +256 (carry)
    }
    const offsetStart = window * windowSize;
    const offset = offsetStart + Math.abs(wbits) - 1; // -1 because we skip zero; ignore when isZero
    const isZero = wbits === 0; // is current window slice a 0?
    const isNeg = wbits < 0; // is current window slice negative?
    const isNegF = window % 2 !== 0; // fake branch noise only
    const offsetF = offsetStart; // fake branch noise only
    return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
    if (!Array.isArray(points))
        throw new Error('array expected');
    points.forEach((p, i) => {
        if (!(p instanceof c))
            throw new Error('invalid point at index ' + i);
    });
}
function validateMSMScalars(scalars, field) {
    if (!Array.isArray(scalars))
        throw new Error('array of scalars expected');
    scalars.forEach((s, i) => {
        if (!field.isValid(s))
            throw new Error('invalid scalar at index ' + i);
    });
}
// Since points in different groups cannot be equal (different object constructor),
// we can have single place to store precomputes.
// Allows to make points frozen / immutable.
const pointPrecomputes = new WeakMap();
const pointWindowSizes = new WeakMap();
function getW(P) {
    // To disable precomputes:
    // return 1;
    // `1` is also the uncached sentinel: use the ladder / non-precomputed path.
    return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
    // Internal invariant: a non-zero remainder here means the wNAF window decomposition or loop
    // count is inconsistent, not that the original caller provided a bad scalar.
    if (n !== _0n)
        throw new Error('invalid wNAF');
}
/**
 * Elliptic curve multiplication of Point by scalar. Fragile.
 * Table generation takes **30MB of ram and 10ms on high-end CPU**,
 * but may take much longer on slow devices. Actual generation will happen on
 * first call of `multiply()`. By default, `BASE` point is precomputed.
 *
 * Scalars should always be less than curve order: this should be checked inside of a curve itself.
 * Creates precomputation tables for fast multiplication:
 * - private scalar is split by fixed size windows of W bits
 * - every window point is collected from window's table & added to accumulator
 * - since windows are different, same point inside tables won't be accessed more than once per calc
 * - each multiplication is 'Math.ceil(CURVE_ORDER / 𝑊) + 1' point additions (fixed for any scalar)
 * - +1 window is neccessary for wNAF
 * - wNAF reduces table size: 2x less memory + 2x faster generation, but 10% slower multiplication
 *
 * TODO: research returning a 2d JS array of windows instead of a single window.
 * This would allow windows to be in different memory locations.
 * @param Point - Point constructor.
 * @param bits - Scalar bit length.
 * @example
 * Elliptic curve multiplication of Point by scalar.
 *
 * ```ts
 * import { wNAF } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const ladder = new wNAF(p256.Point, p256.Point.Fn.BITS);
 * ```
 */
class wNAF {
    BASE;
    ZERO;
    Fn;
    bits;
    // Parametrized with a given Point class (not individual point)
    constructor(Point, bits) {
        this.BASE = Point.BASE;
        this.ZERO = Point.ZERO;
        this.Fn = Point.Fn;
        this.bits = bits;
    }
    // non-const time multiplication ladder
    _unsafeLadder(elm, n, p = this.ZERO) {
        let d = elm;
        while (n > _0n) {
            if (n & _1n)
                p = p.add(d);
            d = d.double();
            n >>= _1n;
        }
        return p;
    }
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @param point - Point instance
     * @param W - window size
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(point, W) {
        const { windows, windowSize } = calcWOpts(W, this.bits);
        const points = [];
        let p = point;
        let base = p;
        for (let window = 0; window < windows; window++) {
            base = p;
            points.push(base);
            // i=1, bc we skip 0
            for (let i = 1; i < windowSize; i++) {
                base = base.add(p);
                points.push(base);
            }
            p = base.double();
        }
        return points;
    }
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * More compact implementation:
     * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
     * @returns real and fake (for const-time) points
     */
    wNAF(W, precomputes, n) {
        // Scalar should be smaller than field order
        if (!this.Fn.isValid(n))
            throw new Error('invalid scalar');
        // Accumulators
        let p = this.ZERO;
        let f = this.BASE;
        // This code was first written with assumption that 'f' and 'p' will never be infinity point:
        // since each addition is multiplied by 2 ** W, it cannot cancel each other. However,
        // there is negate now: it is possible that negated element from low value
        // would be the same as high element, which will create carry into next window.
        // It's not obvious how this can fail, but still worth investigating later.
        const wo = calcWOpts(W, this.bits);
        for (let window = 0; window < wo.windows; window++) {
            // (n === _0n) is handled and not early-exited. isEven and offsetF are used for noise
            const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
            n = nextN;
            if (isZero) {
                // bits are 0: add garbage to fake point
                // Important part for const-time getPublicKey: add random "noise" point to f.
                f = f.add(negateCt(isNegF, precomputes[offsetF]));
            }
            else {
                // bits are 1: add to result point
                p = p.add(negateCt(isNeg, precomputes[offset]));
            }
        }
        assert0(n);
        // Return both real and fake points so JIT keeps the noise path alive.
        // Known caveat: negate/carry interactions can still drive `f` to infinity even when `p` is not,
        // which weakens the noise path and leaves this only "less const-time" by about one bigint mul.
        return { p, f };
    }
    /**
     * Implements unsafe EC multiplication using precomputed tables
     * and w-ary non-adjacent form.
     * @param acc - accumulator point to add result of multiplication
     * @returns point
     */
    wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
        const wo = calcWOpts(W, this.bits);
        for (let window = 0; window < wo.windows; window++) {
            if (n === _0n)
                break; // Early-exit, skip 0 value
            const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
            n = nextN;
            if (isZero) {
                // Window bits are 0: skip processing.
                // Move to next window.
                continue;
            }
            else {
                const item = precomputes[offset];
                acc = acc.add(isNeg ? item.negate() : item); // Re-using acc allows to save adds in MSM
            }
        }
        assert0(n);
        return acc;
    }
    getPrecomputes(W, point, transform) {
        // Cache key is only point identity plus the remembered window size; callers must not reuse the
        // same point with incompatible `transform(...)` layouts and expect a separate cache entry.
        let comp = pointPrecomputes.get(point);
        if (!comp) {
            comp = this.precomputeWindow(point, W);
            if (W !== 1) {
                // Doing transform outside of if brings 15% perf hit
                if (typeof transform === 'function')
                    comp = transform(comp);
                pointPrecomputes.set(point, comp);
            }
        }
        return comp;
    }
    cached(point, scalar, transform) {
        const W = getW(point);
        return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
    }
    unsafe(point, scalar, transform, prev) {
        const W = getW(point);
        if (W === 1)
            return this._unsafeLadder(point, scalar, prev); // For W=1 ladder is ~x2 faster
        return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
    }
    // We calculate precomputes for elliptic curve point multiplication
    // using windowed method. This specifies window size and
    // stores precomputed values. Usually only base point would be precomputed.
    createCache(P, W) {
        validateW(W, this.bits);
        pointWindowSizes.set(P, W);
        pointPrecomputes.delete(P);
    }
    hasCache(elm) {
        return getW(elm) !== 1;
    }
}
/**
 * Endomorphism-specific multiplication for Koblitz curves.
 * Cost: 128 dbl, 0-256 adds.
 * @param Point - Point constructor.
 * @param point - Input point.
 * @param k1 - First non-negative absolute scalar chunk.
 * @param k2 - Second non-negative absolute scalar chunk.
 * @returns Partial multiplication results.
 * @example
 * Endomorphism-specific multiplication for Koblitz curves.
 *
 * ```ts
 * import { mulEndoUnsafe } from '@noble/curves/abstract/curve.js';
 * import { secp256k1 } from '@noble/curves/secp256k1.js';
 * const parts = mulEndoUnsafe(secp256k1.Point, secp256k1.Point.BASE, 3n, 5n);
 * ```
 */
function mulEndoUnsafe(Point, point, k1, k2) {
    let acc = point;
    let p1 = Point.ZERO;
    let p2 = Point.ZERO;
    while (k1 > _0n || k2 > _0n) {
        if (k1 & _1n)
            p1 = p1.add(acc);
        if (k2 & _1n)
            p2 = p2.add(acc);
        acc = acc.double();
        k1 >>= _1n;
        k2 >>= _1n;
    }
    return { p1, p2 };
}
/**
 * Pippenger algorithm for multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
 * 30x faster vs naive addition on L=4096, 10x faster than precomputes.
 * For N=254bit, L=1, it does: 1024 ADD + 254 DBL. For L=5: 1536 ADD + 254 DBL.
 * Algorithmically constant-time (for same L), even when 1 point + scalar, or when scalar = 0.
 * @param c - Curve Point constructor
 * @param points - array of L curve points
 * @param scalars - array of L scalars (aka secret keys / bigints)
 * @returns MSM result point. Empty input is accepted and returns the identity.
 * @throws If the point set, scalar set, or MSM sizing is invalid. {@link Error}
 * @example
 * Pippenger algorithm for multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
 *
 * ```ts
 * import { pippenger } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const point = pippenger(p256.Point, [p256.Point.BASE, p256.Point.BASE.double()], [2n, 3n]);
 * ```
 */
function pippenger(c, points, scalars) {
    // If we split scalars by some window (let's say 8 bits), every chunk will only
    // take 256 buckets even if there are 4096 scalars, also re-uses double.
    // TODO:
    // - https://eprint.iacr.org/2024/750.pdf
    // - https://tches.iacr.org/index.php/TCHES/article/view/10287
    // 0 is accepted in scalars
    const fieldN = c.Fn;
    validateMSMPoints(points, c);
    validateMSMScalars(scalars, fieldN);
    const plength = points.length;
    const slength = scalars.length;
    if (plength !== slength)
        throw new Error('arrays of points and scalars must have equal length');
    // if (plength === 0) throw new Error('array must be of length >= 2');
    const zero = c.ZERO;
    const wbits = bitLen(BigInt(plength));
    let windowSize = 1; // bits
    if (wbits > 12)
        windowSize = wbits - 3;
    else if (wbits > 4)
        windowSize = wbits - 2;
    else if (wbits > 0)
        windowSize = 2;
    const MASK = bitMask(windowSize);
    const buckets = new Array(Number(MASK) + 1).fill(zero); // +1 for zero array
    const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
    let sum = zero;
    for (let i = lastBits; i >= 0; i -= windowSize) {
        buckets.fill(zero);
        for (let j = 0; j < slength; j++) {
            const scalar = scalars[j];
            const wbits = Number((scalar >> BigInt(i)) & MASK);
            buckets[wbits] = buckets[wbits].add(points[j]);
        }
        let resI = zero; // not using this will do small speed-up, but will lose ct
        // Skip first bucket, because it is zero
        for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
            sumI = sumI.add(buckets[j]);
            resI = resI.add(sumI);
        }
        sum = sum.add(resI);
        if (i !== 0)
            for (let j = 0; j < windowSize; j++)
                sum = sum.double();
    }
    return sum;
}
/**
 * Precomputed multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
 * @param c - Curve Point constructor
 * @param points - array of L curve points
 * @param windowSize - Precompute window size.
 * @returns Function which multiplies points with scalars. The closure accepts
 *   `scalars.length <= points.length`, and omitted trailing scalars are treated as zero.
 * @throws If the point set or precompute window is invalid. {@link Error}
 * @example
 * Precomputed multi-scalar multiplication (MSM, Pa + Qb + Rc + ...).
 *
 * ```ts
 * import { precomputeMSMUnsafe } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const msm = precomputeMSMUnsafe(p256.Point, [p256.Point.BASE], 4);
 * const point = msm([3n]);
 * ```
 */
function precomputeMSMUnsafe(c, points, windowSize) {
    /**
     * Performance Analysis of Window-based Precomputation
     *
     * Base Case (256-bit scalar, 8-bit window):
     * - Standard precomputation requires:
     *   - 31 additions per scalar × 256 scalars = 7,936 ops
     *   - Plus 255 summary additions = 8,191 total ops
     *   Note: Summary additions can be optimized via accumulator
     *
     * Chunked Precomputation Analysis:
     * - Using 32 chunks requires:
     *   - 255 additions per chunk
     *   - 256 doublings
     *   - Total: (255 × 32) + 256 = 8,416 ops
     *
     * Memory Usage Comparison:
     * Window Size | Standard Points | Chunked Points
     * ------------|-----------------|---------------
     *     4-bit   |     520         |      15
     *     8-bit   |    4,224        |     255
     *    10-bit   |   13,824        |   1,023
     *    16-bit   |  557,056        |  65,535
     *
     * Key Advantages:
     * 1. Enables larger window sizes due to reduced memory overhead
     * 2. More efficient for smaller scalar counts:
     *    - 16 chunks: (16 × 255) + 256 = 4,336 ops
     *    - ~2x faster than standard 8,191 ops
     *
     * Limitations:
     * - Not suitable for plain precomputes (requires 256 constant doublings)
     * - Performance degrades with larger scalar counts:
     *   - Optimal for ~256 scalars
     *   - Less efficient for 4096+ scalars (Pippenger preferred)
     */
    const fieldN = c.Fn;
    validateW(windowSize, fieldN.BITS);
    validateMSMPoints(points, c);
    const zero = c.ZERO;
    const tableSize = 2 ** windowSize - 1; // table size (without zero)
    const chunks = Math.ceil(fieldN.BITS / windowSize); // chunks of item
    const MASK = bitMask(windowSize);
    const tables = points.map((p) => {
        const res = [];
        for (let i = 0, acc = p; i < tableSize; i++) {
            res.push(acc);
            acc = acc.add(p);
        }
        return res;
    });
    return (scalars) => {
        validateMSMScalars(scalars, fieldN);
        if (scalars.length > points.length)
            throw new Error('array of scalars must be smaller than array of points');
        let res = zero;
        for (let i = 0; i < chunks; i++) {
            // No need to double if accumulator is still zero.
            if (res !== zero)
                for (let j = 0; j < windowSize; j++)
                    res = res.double();
            const shiftBy = BigInt(chunks * windowSize - (i + 1) * windowSize);
            for (let j = 0; j < scalars.length; j++) {
                const n = scalars[j];
                const curr = Number((n >> shiftBy) & MASK);
                if (!curr)
                    continue; // skip zero scalars chunks
                res = res.add(tables[j][curr - 1]);
            }
        }
        return res;
    };
}
function createField(order, field, isLE) {
    if (field) {
        // Reuse supplied field overrides as-is; `isLE` only affects freshly constructed fallback
        // fields, and validateField() below only checks the arithmetic subset, not full byte/cmov
        // behavior.
        if (field.ORDER !== order)
            throw new Error('Field.ORDER must match order: Fp == p, Fn == n');
        validateField(field);
        return field;
    }
    else {
        return Field(order, { isLE });
    }
}
/**
 * Validates basic CURVE shape and field membership, then creates fields.
 * This does not prove that the generator is on-curve, that subgroup/order data are consistent, or
 * that the curve equation itself is otherwise sane.
 * @param type - Curve family.
 * @param CURVE - Curve parameters.
 * @param curveOpts - Optional field overrides:
 *   - `Fp` (optional): Optional base-field override.
 *   - `Fn` (optional): Optional scalar-field override.
 * @param FpFnLE - Whether field encoding is little-endian.
 * @returns Frozen curve parameters and fields.
 * @throws If the curve parameters or field overrides are invalid. {@link Error}
 * @example
 * Build curve fields from raw constants before constructing a curve instance.
 *
 * ```ts
 * const curve = createCurveFields('weierstrass', {
 *   p: 17n,
 *   n: 19n,
 *   h: 1n,
 *   a: 2n,
 *   b: 2n,
 *   Gx: 5n,
 *   Gy: 1n,
 * });
 * ```
 */
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
    if (FpFnLE === undefined)
        FpFnLE = type === 'edwards';
    if (!CURVE || typeof CURVE !== 'object')
        throw new Error(`expected valid ${type} CURVE object`);
    for (const p of ['p', 'n', 'h']) {
        const val = CURVE[p];
        if (!(typeof val === 'bigint' && val > _0n))
            throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
    const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
    const _b = type === 'weierstrass' ? 'b' : 'd';
    const params = ['Gx', 'Gy', 'a', _b];
    for (const p of params) {
        // @ts-ignore
        if (!Fp.isValid(CURVE[p]))
            throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    CURVE = Object.freeze(Object.assign({}, CURVE));
    return { CURVE, Fp, Fn };
}
/**
 * @param randomSecretKey - Secret-key generator.
 * @param getPublicKey - Public-key derivation helper.
 * @returns Keypair generator.
 * @example
 * Build a `keygen()` helper from existing secret-key and public-key primitives.
 *
 * ```ts
 * import { createKeygen } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const keygen = createKeygen(p256.utils.randomSecretKey, p256.getPublicKey);
 * const pair = keygen();
 * ```
 */
function createKeygen(randomSecretKey, getPublicKey) {
    return function keygen(seed) {
        const secretKey = randomSecretKey(seed);
        return { secretKey, publicKey: getPublicKey(secretKey) };
    };
}
//# sourceMappingURL=curve.js.map
  return { validatePointCons, negateCt, normalizeZ, wNAF, mulEndoUnsafe, pippenger, precomputeMSMUnsafe, createCurveFields, createKeygen };
})();

// ── @noble/curves abstract/edwards.js (v2.2.0, MIT, Paul Miller) ─────────────────────────────────────────────
const C_edwards = (() => {
  const { abool, abytes, aInRange, asafenumber, bytesToHex, bytesToNumberLE, concatBytes, copyBytes, hexToBytes, isBytes, notImplemented, validateObject, randomBytes: wcRandomBytes } = C_utils;
  const { createCurveFields, createKeygen, normalizeZ, wNAF } = C_curve;
/**
 * Twisted Edwards curve. The formula is: ax² + y² = 1 + dx²y².
 * For design rationale of types / exports, see weierstrass module documentation.
 * Untwisted Edwards curves exist, but they aren't used in real-world protocols.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */


// Be friendly to bad ECMAScript parsers by not using bigint literals
// prettier-ignore
const _0n = /* @__PURE__ */ BigInt(0), _1n = /* @__PURE__ */ BigInt(1), _2n = /* @__PURE__ */ BigInt(2), _8n = /* @__PURE__ */ BigInt(8);
// Affine Edwards-equation check only; this does not prove subgroup membership, canonical
// encoding, prime-order base-point requirements, or identity exclusion.
function isEdValidXY(Fp, CURVE, x, y) {
    const x2 = Fp.sqr(x);
    const y2 = Fp.sqr(y);
    const left = Fp.add(Fp.mul(CURVE.a, x2), y2);
    const right = Fp.add(Fp.ONE, Fp.mul(CURVE.d, Fp.mul(x2, y2)));
    return Fp.eql(left, right);
}
/**
 * @param params - Curve parameters. See {@link EdwardsOpts}.
 * @param extraOpts - Optional helpers and overrides. See {@link EdwardsExtraOpts}.
 * @returns Edwards point constructor. Generator validation here only checks
 *   that `(Gx, Gy)` satisfies the affine Edwards equation.
 *   RFC 8032 base-point constraints like `B != (0,1)` and `[L]B = 0`
 *   are left to the caller's chosen parameters, since eager subgroup
 *   validation here adds about 10-15ms to heavyweight imports like ed448.
 *   The returned constructor also eagerly marks `Point.BASE` for W=8
 *   precompute caching. Some code paths still assume
 *   `Fp.BYTES === Fn.BYTES`, so mismatched byte lengths are not fully audited here.
 * @throws If the curve parameters or Edwards overrides are invalid. {@link Error}
 * @example
 * ```ts
 * import { edwards } from '@noble/curves/abstract/edwards.js';
 * import { jubjub } from '@noble/curves/misc.js';
 * // Build a point constructor from explicit curve parameters, then use its base point.
 * const Point = edwards(jubjub.Point.CURVE());
 * Point.BASE.toHex();
 * ```
 */
function edwards(params, extraOpts = {}) {
    const opts = extraOpts;
    const validated = createCurveFields('edwards', params, opts, opts.FpFnLE);
    const { Fp, Fn } = validated;
    let CURVE = validated.CURVE;
    const { h: cofactor } = CURVE;
    validateObject(opts, {}, { uvRatio: 'function' });
    // Important:
    // There are some places where Fp.BYTES is used instead of nByteLength.
    // So far, everything has been tested with curves of Fp.BYTES == nByteLength.
    // TODO: test and find curves which behave otherwise.
    const MASK = _2n << (BigInt(Fn.BYTES * 8) - _1n);
    const modP = (n) => Fp.create(n); // Function overrides
    // sqrt(u/v)
    const uvRatio = opts.uvRatio === undefined
        ? (u, v) => {
            try {
                return { isValid: true, value: Fp.sqrt(Fp.div(u, v)) };
            }
            catch (e) {
                return { isValid: false, value: _0n };
            }
        }
        : opts.uvRatio;
    // Validate whether the passed curve params are valid.
    // equation ax² + y² = 1 + dx²y² should work for generator point.
    if (!isEdValidXY(Fp, CURVE, CURVE.Gx, CURVE.Gy))
        throw new Error('bad curve params: generator point');
    /**
     * Asserts coordinate is valid: 0 <= n < MASK.
     * Coordinates >= Fp.ORDER are allowed for zip215.
     */
    function acoord(title, n, banZero = false) {
        const min = banZero ? _1n : _0n;
        aInRange('coordinate ' + title, n, min, MASK);
        return n;
    }
    function aedpoint(other) {
        if (!(other instanceof Point))
            throw new Error('EdwardsPoint expected');
    }
    // Extended Point works in extended coordinates: (X, Y, Z, T) ∋ (x=X/Z, y=Y/Z, T=xy).
    // https://en.wikipedia.org/wiki/Twisted_Edwards_curve#Extended_coordinates
    class Point {
        // base / generator point
        static BASE = new Point(CURVE.Gx, CURVE.Gy, _1n, modP(CURVE.Gx * CURVE.Gy));
        // zero / infinity / identity point
        static ZERO = new Point(_0n, _1n, _1n, _0n); // 0, 1, 1, 0
        // math field
        static Fp = Fp;
        // scalar field
        static Fn = Fn;
        X;
        Y;
        Z;
        T;
        constructor(X, Y, Z, T) {
            this.X = acoord('x', X);
            this.Y = acoord('y', Y);
            this.Z = acoord('z', Z, true);
            this.T = acoord('t', T);
            Object.freeze(this);
        }
        static CURVE() {
            return CURVE;
        }
        /**
         * Create one extended Edwards point from affine coordinates.
         * Does NOT validate that the point is on-curve or torsion-free.
         * Use `.assertValidity()` on adversarial inputs.
         */
        static fromAffine(p) {
            if (p instanceof Point)
                throw new Error('extended point not allowed');
            const { x, y } = p || {};
            acoord('x', x);
            acoord('y', y);
            return new Point(x, y, _1n, modP(x * y));
        }
        // Uses algo from RFC8032 5.1.3.
        static fromBytes(bytes, zip215 = false) {
            const len = Fp.BYTES;
            const { a, d } = CURVE;
            bytes = copyBytes(abytes(bytes, len, 'point'));
            abool(zip215, 'zip215');
            const normed = copyBytes(bytes); // copy again, we'll manipulate it
            const lastByte = bytes[len - 1]; // select last byte
            normed[len - 1] = lastByte & ~0x80; // clear last bit
            const y = bytesToNumberLE(normed);
            // zip215=true is good for consensus-critical apps. =false follows RFC8032 / NIST186-5.
            // RFC8032 prohibits >= p, but ZIP215 doesn't
            // zip215=true:  0 <= y < MASK (2^256 for ed25519)
            // zip215=false: 0 <= y < P (2^255-19 for ed25519)
            const max = zip215 ? MASK : Fp.ORDER;
            aInRange('point.y', y, _0n, max);
            // Ed25519: x² = (y²-1)/(dy²+1) mod p. Ed448: x² = (y²-1)/(dy²-1) mod p. Generic case:
            // ax²+y²=1+dx²y² => y²-1=dx²y²-ax² => y²-1=x²(dy²-a) => x²=(y²-1)/(dy²-a)
            const y2 = modP(y * y); // denominator is always non-0 mod p.
            const u = modP(y2 - _1n); // u = y² - 1
            const v = modP(d * y2 - a); // v = d y² + 1.
            let { isValid, value: x } = uvRatio(u, v); // √(u/v)
            if (!isValid)
                throw new Error('bad point: invalid y coordinate');
            const isXOdd = (x & _1n) === _1n; // There are 2 square roots. Use x_0 bit to select proper
            const isLastByteOdd = (lastByte & 0x80) !== 0; // x_0, last bit
            if (!zip215 && x === _0n && isLastByteOdd)
                // if x=0 and x_0 = 1, fail
                throw new Error('bad point: x=0 and x_0=1');
            if (isLastByteOdd !== isXOdd)
                x = modP(-x); // if x_0 != x mod 2, set x = p-x
            return Point.fromAffine({ x, y });
        }
        static fromHex(hex, zip215 = false) {
            return Point.fromBytes(hexToBytes(hex), zip215);
        }
        get x() {
            return this.toAffine().x;
        }
        get y() {
            return this.toAffine().y;
        }
        precompute(windowSize = 8, isLazy = true) {
            wnaf.createCache(this, windowSize);
            if (!isLazy)
                this.multiply(_2n); // random number
            return this;
        }
        // Useful in fromAffine() - not for fromBytes(), which always created valid points.
        assertValidity() {
            const p = this;
            const { a, d } = CURVE;
            // Keep generic Edwards validation fail-closed on the neutral point.
            // Even though ZERO is algebraically valid and can roundtrip through encodings, higher-level
            // callers often reach it only through broken hash/scalar plumbing; rejecting it here avoids
            // silently treating that degenerate state as an ordinary public point.
            if (p.is0())
                throw new Error('bad point: ZERO'); // TODO: optimize, with vars below?
            // Equation in affine coordinates: ax² + y² = 1 + dx²y²
            // Equation in projective coordinates (X/Z, Y/Z, Z):  (aX² + Y²)Z² = Z⁴ + dX²Y²
            const { X, Y, Z, T } = p;
            const X2 = modP(X * X); // X²
            const Y2 = modP(Y * Y); // Y²
            const Z2 = modP(Z * Z); // Z²
            const Z4 = modP(Z2 * Z2); // Z⁴
            const aX2 = modP(X2 * a); // aX²
            const left = modP(Z2 * modP(aX2 + Y2)); // (aX² + Y²)Z²
            const right = modP(Z4 + modP(d * modP(X2 * Y2))); // Z⁴ + dX²Y²
            if (left !== right)
                throw new Error('bad point: equation left != right (1)');
            // In Extended coordinates we also have T, which is x*y=T/Z: check X*Y == Z*T
            const XY = modP(X * Y);
            const ZT = modP(Z * T);
            if (XY !== ZT)
                throw new Error('bad point: equation left != right (2)');
        }
        // Compare one point to another.
        equals(other) {
            aedpoint(other);
            const { X: X1, Y: Y1, Z: Z1 } = this;
            const { X: X2, Y: Y2, Z: Z2 } = other;
            const X1Z2 = modP(X1 * Z2);
            const X2Z1 = modP(X2 * Z1);
            const Y1Z2 = modP(Y1 * Z2);
            const Y2Z1 = modP(Y2 * Z1);
            return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
        }
        is0() {
            return this.equals(Point.ZERO);
        }
        negate() {
            // Flips point sign to a negative one (-x, y in affine coords)
            return new Point(modP(-this.X), this.Y, this.Z, modP(-this.T));
        }
        // Fast algo for doubling Extended Point.
        // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
        // Cost: 4M + 4S + 1*a + 6add + 1*2.
        double() {
            const { a } = CURVE;
            const { X: X1, Y: Y1, Z: Z1 } = this;
            const A = modP(X1 * X1); // A = X12
            const B = modP(Y1 * Y1); // B = Y12
            const C = modP(_2n * modP(Z1 * Z1)); // C = 2*Z12
            const D = modP(a * A); // D = a*A
            const x1y1 = X1 + Y1;
            const E = modP(modP(x1y1 * x1y1) - A - B); // E = (X1+Y1)2-A-B
            const G = D + B; // G = D+B
            const F = G - C; // F = G-C
            const H = D - B; // H = D-B
            const X3 = modP(E * F); // X3 = E*F
            const Y3 = modP(G * H); // Y3 = G*H
            const T3 = modP(E * H); // T3 = E*H
            const Z3 = modP(F * G); // Z3 = F*G
            return new Point(X3, Y3, Z3, T3);
        }
        // Fast algo for adding 2 Extended Points.
        // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
        // Cost: 9M + 1*a + 1*d + 7add.
        add(other) {
            aedpoint(other);
            const { a, d } = CURVE;
            const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
            const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
            const A = modP(X1 * X2); // A = X1*X2
            const B = modP(Y1 * Y2); // B = Y1*Y2
            const C = modP(T1 * d * T2); // C = T1*d*T2
            const D = modP(Z1 * Z2); // D = Z1*Z2
            const E = modP((X1 + Y1) * (X2 + Y2) - A - B); // E = (X1+Y1)*(X2+Y2)-A-B
            const F = D - C; // F = D-C
            const G = D + C; // G = D+C
            const H = modP(B - a * A); // H = B-a*A
            const X3 = modP(E * F); // X3 = E*F
            const Y3 = modP(G * H); // Y3 = G*H
            const T3 = modP(E * H); // T3 = E*H
            const Z3 = modP(F * G); // Z3 = F*G
            return new Point(X3, Y3, Z3, T3);
        }
        subtract(other) {
            // Validate before calling `negate()` so wrong inputs fail with the point guard
            // instead of leaking a foreign `negate()` error.
            aedpoint(other);
            return this.add(other.negate());
        }
        // Constant-time multiplication.
        multiply(scalar) {
            // 1 <= scalar < L
            // Keep the subgroup-scalar contract strict instead of reducing 0 / n to ZERO.
            // In keygen/signing-style callers, those values usually mean broken hash/scalar plumbing,
            // and failing closed is safer than silently producing the identity point.
            if (!Fn.isValidNot0(scalar))
                throw new RangeError('invalid scalar: expected 1 <= sc < curve.n');
            const { p, f } = wnaf.cached(this, scalar, (p) => normalizeZ(Point, p));
            return normalizeZ(Point, [p, f])[0];
        }
        // Non-constant-time multiplication. Uses double-and-add algorithm.
        // It's faster, but should only be used when you don't care about
        // an exposed private key e.g. sig verification.
        // Keeps the same subgroup-scalar contract: 0 is allowed for public-scalar callers, but
        // n and larger values are rejected instead of being reduced mod n to the identity point.
        multiplyUnsafe(scalar) {
            // 0 <= scalar < L
            if (!Fn.isValid(scalar))
                throw new RangeError('invalid scalar: expected 0 <= sc < curve.n');
            if (scalar === _0n)
                return Point.ZERO;
            if (this.is0() || scalar === _1n)
                return this;
            return wnaf.unsafe(this, scalar, (p) => normalizeZ(Point, p));
        }
        // Checks if point is of small order.
        // If you add something to small order point, you will have "dirty"
        // point with torsion component.
        // Clears cofactor and checks if the result is 0.
        isSmallOrder() {
            return this.clearCofactor().is0();
        }
        // Multiplies point by curve order and checks if the result is 0.
        // Returns `false` is the point is dirty.
        isTorsionFree() {
            return wnaf.unsafe(this, CURVE.n).is0();
        }
        // Converts Extended point to default (x, y) coordinates.
        // Can accept precomputed Z^-1 - for example, from invertBatch.
        toAffine(invertedZ) {
            const p = this;
            let iz = invertedZ;
            const { X, Y, Z } = p;
            const is0 = p.is0();
            if (iz == null)
                iz = is0 ? _8n : Fp.inv(Z); // 8 was chosen arbitrarily
            const x = modP(X * iz);
            const y = modP(Y * iz);
            const zz = Fp.mul(Z, iz);
            if (is0)
                return { x: _0n, y: _1n };
            if (zz !== _1n)
                throw new Error('invZ was invalid');
            return { x, y };
        }
        clearCofactor() {
            if (cofactor === _1n)
                return this;
            return this.multiplyUnsafe(cofactor);
        }
        toBytes() {
            const { x, y } = this.toAffine();
            // Fp.toBytes() allows non-canonical encoding of y (>= p).
            const bytes = Fp.toBytes(y);
            // Each y has 2 valid points: (x, y), (x,-y).
            // When compressing, it's enough to store y and use the last byte to encode sign of x
            bytes[bytes.length - 1] |= x & _1n ? 0x80 : 0;
            return bytes;
        }
        toHex() {
            return bytesToHex(this.toBytes());
        }
        toString() {
            return `<Point ${this.is0() ? 'ZERO' : this.toHex()}>`;
        }
    }
    const wnaf = new wNAF(Point, Fn.BITS);
    // Keep constructor work cheap: subgroup/generator validation belongs to the caller's curve
    // parameters, and doing the extra checks here adds about 10-15ms to heavy module imports.
    // Callers that construct custom curves are responsible for supplying the correct base point.
    // try {
    //   Point.BASE.assertValidity();
    //   if (!Point.BASE.isTorsionFree()) throw new Error('bad point: not in prime-order subgroup');
    // } catch {
    //   throw new Error('bad curve params: generator point');
    // }
    // Tiny toy curves can have scalar fields narrower than 8 bits. Skip the
    // eager W=8 cache there instead of rejecting an otherwise valid constructor.
    if (Fn.BITS >= 8)
        Point.BASE.precompute(8); // Enable precomputes. Slows down first publicKey computation by 20ms.
    Object.freeze(Point.prototype);
    Object.freeze(Point);
    return Point;
}
/**
 * Base class for prime-order points like Ristretto255 and Decaf448.
 * These points eliminate cofactor issues by representing equivalence classes
 * of Edwards curve points. Multiple Edwards representatives can describe the
 * same abstract wrapper element, so wrapper validity is not the same thing as
 * the hidden representative being torsion-free.
 * @param ep - Backing Edwards point.
 * @example
 * Base class for prime-order points like Ristretto255 and Decaf448.
 *
 * ```ts
 * import { ristretto255 } from '@noble/curves/ed25519.js';
 * const point = ristretto255.Point.BASE.multiply(2n);
 * ```
 */
class PrimeEdwardsPoint {
    static BASE;
    static ZERO;
    static Fp;
    static Fn;
    ep;
    /**
     * Wrap one internal Edwards representative directly.
     * This is not a canonical encoding boundary: alternate Edwards
     * representatives may still describe the same abstract wrapper element.
     */
    constructor(ep) {
        this.ep = ep;
    }
    // Static methods that must be implemented by subclasses
    static fromBytes(_bytes) {
        notImplemented();
    }
    static fromHex(_hex) {
        notImplemented();
    }
    get x() {
        return this.toAffine().x;
    }
    get y() {
        return this.toAffine().y;
    }
    // Common implementations
    clearCofactor() {
        // no-op for the abstract prime-order wrapper group; this is about the
        // wrapper element, not the hidden Edwards representative.
        return this;
    }
    assertValidity() {
        // Keep wrapper validity at the abstract-group boundary. Canonical decode
        // may choose Edwards representatives that differ by small torsion, so
        // checking `this.ep.isTorsionFree()` here would reject valid wrapper points.
        this.ep.assertValidity();
    }
    /**
     * Return affine coordinates of the current internal Edwards representative.
     * This is a convenience helper, not a canonical Ristretto/Decaf encoding.
     * Equal abstract elements may expose different `x` / `y`; use
     * `toBytes()` / `fromBytes()` for canonical roundtrips.
     */
    toAffine(invertedZ) {
        return this.ep.toAffine(invertedZ);
    }
    toHex() {
        return bytesToHex(this.toBytes());
    }
    toString() {
        return this.toHex();
    }
    isTorsionFree() {
        // Abstract Ristretto/Decaf elements are already prime-order even when the
        // hidden Edwards representative is not torsion-free.
        return true;
    }
    isSmallOrder() {
        return false;
    }
    add(other) {
        this.assertSame(other);
        return this.init(this.ep.add(other.ep));
    }
    subtract(other) {
        this.assertSame(other);
        return this.init(this.ep.subtract(other.ep));
    }
    multiply(scalar) {
        return this.init(this.ep.multiply(scalar));
    }
    multiplyUnsafe(scalar) {
        return this.init(this.ep.multiplyUnsafe(scalar));
    }
    double() {
        return this.init(this.ep.double());
    }
    negate() {
        return this.init(this.ep.negate());
    }
    precompute(windowSize, isLazy) {
        this.ep.precompute(windowSize, isLazy);
        // Keep the wrapper identity stable like the backing Edwards API instead of
        // allocating a fresh wrapper around the same cached point.
        return this;
    }
}
/**
 * Initializes EdDSA signatures over given Edwards curve.
 * @param Point - Edwards point constructor.
 * @param cHash - Hash function.
 * @param eddsaOpts - Optional signature helpers. See {@link EdDSAOpts}.
 * @returns EdDSA helper namespace.
 * @throws If the hash function, options, or derived point operations are invalid. {@link Error}
 * @example
 * Initializes EdDSA signatures over given Edwards curve.
 *
 * ```ts
 * import { eddsa } from '@noble/curves/abstract/edwards.js';
 * import { jubjub } from '@noble/curves/misc.js';
 * import { sha512 } from '@noble/hashes/sha2.js';
 * const sigs = eddsa(jubjub.Point, sha512);
 * const { secretKey, publicKey } = sigs.keygen();
 * const msg = new TextEncoder().encode('hello noble');
 * const sig = sigs.sign(msg, secretKey);
 * const isValid = sigs.verify(sig, msg, publicKey);
 * ```
 */
function eddsa(Point, cHash, eddsaOpts = {}) {
    if (typeof cHash !== 'function')
        throw new Error('"hash" function param is required');
    const hash = cHash;
    const opts = eddsaOpts;
    validateObject(opts, {}, {
        adjustScalarBytes: 'function',
        randomBytes: 'function',
        domain: 'function',
        prehash: 'function',
        zip215: 'boolean',
        mapToCurve: 'function',
    });
    const { prehash } = opts;
    const { BASE, Fp, Fn } = Point;
    const outputLen = hash.outputLen;
    const expectedLen = 2 * Fp.BYTES;
    // When hash metadata is available, reject incompatible EdDSA wrappers at construction time
    // instead of deferring the mismatch until the first keygen/sign call.
    if (outputLen !== undefined) {
        asafenumber(outputLen, 'hash.outputLen');
        if (outputLen !== expectedLen)
            throw new Error(`hash.outputLen must be ${expectedLen}, got ${outputLen}`);
    }
    const randomBytes = opts.randomBytes === undefined ? wcRandomBytes : opts.randomBytes;
    const adjustScalarBytes = opts.adjustScalarBytes === undefined
        ? (bytes) => bytes
        : opts.adjustScalarBytes;
    const domain = opts.domain === undefined
        ? (data, ctx, phflag) => {
            abool(phflag, 'phflag');
            if (ctx.length || phflag)
                throw new Error('Contexts/pre-hash are not supported');
            return data;
        }
        : opts.domain; // NOOP
    // Parse an EdDSA digest as a little-endian integer and reduce it modulo the scalar field order.
    function modN_LE(hash) {
        return Fn.create(bytesToNumberLE(hash)); // Not Fn.fromBytes: it has length limit
    }
    // Get the hashed private scalar per RFC8032 5.1.5
    function getPrivateScalar(key) {
        const len = lengths.secretKey;
        abytes(key, lengths.secretKey, 'secretKey');
        // Hash private key with curve's hash function to produce uniformingly random input
        // Check byte lengths: ensure(64, h(ensure(32, key)))
        const hashed = abytes(hash(key), 2 * len, 'hashedSecretKey');
        // Slice before clamping so in-place adjustors don't corrupt the prefix half.
        const head = adjustScalarBytes(hashed.slice(0, len)); // clear first half bits, produce FE
        const prefix = hashed.slice(len, 2 * len); // second half is called key prefix (5.1.6)
        const scalar = modN_LE(head); // The actual private scalar
        return { head, prefix, scalar };
    }
    /** Convenience method that creates public key from scalar. RFC8032 5.1.5
     * Also exposes the derived scalar/prefix tuple and point form reused by sign().
     */
    function getExtendedPublicKey(secretKey) {
        const { head, prefix, scalar } = getPrivateScalar(secretKey);
        const point = BASE.multiply(scalar); // Point on Edwards curve aka public key
        const pointBytes = point.toBytes();
        return { head, prefix, scalar, point, pointBytes };
    }
    /** Calculates EdDSA pub key. RFC8032 5.1.5. */
    function getPublicKey(secretKey) {
        return getExtendedPublicKey(secretKey).pointBytes;
    }
    // Hash domain-separated chunks into a little-endian scalar modulo the group order.
    function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
        const msg = concatBytes(...msgs);
        return modN_LE(hash(domain(msg, abytes(context, undefined, 'context'), !!prehash)));
    }
    /** Signs message with secret key. RFC8032 5.1.6 */
    function sign(msg, secretKey, options = {}) {
        msg = abytes(msg, undefined, 'message');
        if (prehash)
            msg = prehash(msg); // for ed25519ph etc.
        const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
        const r = hashDomainToScalar(options.context, prefix, msg); // r = dom2(F, C) || prefix || PH(M)
        // RFC 8032 5.1.6 allows r mod L = 0, and SUPERCOP ref10 accepts the resulting identity-point
        // signature.
        // We intentionally keep the safe multiply() rejection here so a miswired all-zero hash provider
        // fails loudly instead of silently producing a degenerate signature.
        const R = BASE.multiply(r).toBytes(); // R = rG
        const k = hashDomainToScalar(options.context, R, pointBytes, msg); // R || A || PH(M)
        const s = Fn.create(r + k * scalar); // S = (r + k * s) mod L
        if (!Fn.isValid(s))
            throw new Error('sign failed: invalid s'); // 0 <= s < L
        const rs = concatBytes(R, Fn.toBytes(s));
        return abytes(rs, lengths.signature, 'result');
    }
    // Keep the shared helper strict by default: RFC 8032 / NIST-style wrappers should reject
    // non-canonical encodings unless they explicitly opt into ZIP-215's more permissive decode rules.
    const verifyOpts = {
        zip215: opts.zip215,
    };
    /**
     * Verifies EdDSA signature against message and public key. RFC 8032 Section Section 5.1.7 and 5.2.7.
     * A cofactored verification equation is checked.
     */
    function verify(sig, msg, publicKey, options = verifyOpts) {
        // Preserve the wrapper-selected default for `{}` / `{ zip215: undefined }`, not just omitted opts.
        const { context } = options;
        const zip215 = options.zip215 === undefined ? !!verifyOpts.zip215 : options.zip215;
        const len = lengths.signature;
        sig = abytes(sig, len, 'signature');
        msg = abytes(msg, undefined, 'message');
        publicKey = abytes(publicKey, lengths.publicKey, 'publicKey');
        if (zip215 !== undefined)
            abool(zip215, 'zip215');
        if (prehash)
            msg = prehash(msg); // for ed25519ph, etc
        const mid = len / 2;
        const r = sig.subarray(0, mid);
        const s = bytesToNumberLE(sig.subarray(mid, len));
        let A, R, SB;
        try {
            // ZIP-215 is more permissive than RFC 8032 / NIST186-5. Use it only for wrappers that
            // explicitly want consensus-style unreduced encoding acceptance.
            // zip215=true:  0 <= y < MASK (2^256 for ed25519)
            // zip215=false: 0 <= y < P (2^255-19 for ed25519)
            A = Point.fromBytes(publicKey, zip215);
            R = Point.fromBytes(r, zip215);
            SB = BASE.multiplyUnsafe(s); // 0 <= s < l is done inside
        }
        catch (error) {
            return false;
        }
        // RFC 8032 Section Section 5.1.7/5.2.7 and FIPS 186-5 Section Section 7.7.2/7.8.2 only decode A' and check the cofactored
        // verification equation; they do not add a separate low-order-public-key rejection here.
        // Strict mode still rejects small-order A' intentionally for SBS-style non-repudiation and to
        // avoid ambiguous verification outcomes where unusual low-order keys can make distinct
        // key/signature/message combinations verify.
        if (!zip215 && A.isSmallOrder())
            return false;
        // ZIP-215 accepts noncanonical / unreduced point encodings, so the challenge hash must use the
        // exact signature/public-key bytes rather than canonicalized re-encodings of the decoded points.
        const k = hashDomainToScalar(context, r, publicKey, msg);
        const RkA = R.add(A.multiplyUnsafe(k));
        // Check the cofactored verification equation via the curve cofactor h.
        // [h][S]B = [h]R + [h][k]A'
        return RkA.subtract(SB).clearCofactor().is0();
    }
    const _size = Fp.BYTES; // 32 for ed25519, 57 for ed448
    const lengths = {
        secretKey: _size,
        publicKey: _size,
        signature: 2 * _size,
        seed: _size,
    };
    function randomSecretKey(seed) {
        seed = seed === undefined ? randomBytes(lengths.seed) : seed;
        return abytes(seed, lengths.seed, 'seed');
    }
    function isValidSecretKey(key) {
        return isBytes(key) && key.length === lengths.secretKey;
    }
    function isValidPublicKey(key, zip215) {
        try {
            // Preserve the wrapper-selected default for omitted / `undefined` ZIP-215 flags here too.
            return !!Point.fromBytes(key, zip215 === undefined ? verifyOpts.zip215 : zip215);
        }
        catch (error) {
            return false;
        }
    }
    const utils = {
        getExtendedPublicKey,
        randomSecretKey,
        isValidSecretKey,
        isValidPublicKey,
        /**
         * Converts ed public key to x public key. Uses formula:
         * - ed25519:
         *   - `(u, v) = ((1+y)/(1-y), sqrt(-486664)*u/x)`
         *   - `(x, y) = (sqrt(-486664)*u/v, (u-1)/(u+1))`
         * - ed448:
         *   - `(u, v) = ((y-1)/(y+1), sqrt(156324)*u/x)`
         *   - `(x, y) = (sqrt(156324)*u/v, (1+u)/(1-u))`
         */
        toMontgomery(publicKey) {
            const { y } = Point.fromBytes(publicKey);
            const size = lengths.publicKey;
            const is25519 = size === 32;
            if (!is25519 && size !== 57)
                throw new Error('only defined for 25519 and 448');
            const u = is25519 ? Fp.div(_1n + y, _1n - y) : Fp.div(y - _1n, y + _1n);
            return Fp.toBytes(u);
        },
        toMontgomerySecret(secretKey) {
            const size = lengths.secretKey;
            abytes(secretKey, size);
            const hashed = hash(secretKey.subarray(0, size));
            return adjustScalarBytes(hashed).subarray(0, size);
        },
    };
    Object.freeze(lengths);
    Object.freeze(utils);
    return Object.freeze({
        keygen: createKeygen(randomSecretKey, getPublicKey),
        getPublicKey,
        sign,
        verify,
        utils,
        Point,
        lengths,
    });
}
//# sourceMappingURL=edwards.js.map
  return { edwards, PrimeEdwardsPoint, eddsa };
})();

// ── @noble/curves ed25519.js (v2.2.0, MIT, Paul Miller) ──────────────────────────────────────────────────────
const C_ed25519 = (() => {
  const { sha512 } = H_sha2;
  const { eddsa, edwards } = C_edwards;
  const { isNegativeLE, mod, pow2 } = C_modular;
// prettier-ignore
const _0n = /* @__PURE__ */ BigInt(0), _1n = /* @__PURE__ */ BigInt(1), _2n = /* @__PURE__ */ BigInt(2), _3n = /* @__PURE__ */ BigInt(3);
// prettier-ignore
const _5n = /* @__PURE__ */ BigInt(5), _8n = /* @__PURE__ */ BigInt(8);
// P = 2n**255n - 19n
const ed25519_CURVE_p = /* @__PURE__ */ BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed');
// N = 2n**252n + 27742317777372353535851937790883648493n
// a = Fp.create(BigInt(-1))
// d = -121665/121666 a.k.a. Fp.neg(121665 * Fp.inv(121666))
const ed25519_CURVE = /* @__PURE__ */ (() => ({
    p: ed25519_CURVE_p,
    n: BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed'),
    h: _8n,
    a: BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec'),
    d: BigInt('0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3'),
    Gx: BigInt('0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a'),
    Gy: BigInt('0x6666666666666666666666666666666666666666666666666666666666666658'),
}))();
function ed25519_pow_2_252_3(x) {
    // prettier-ignore
    const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
    const P = ed25519_CURVE_p;
    const x2 = (x * x) % P;
    const b2 = (x2 * x) % P; // x^3, 11
    const b4 = (pow2(b2, _2n, P) * b2) % P; // x^15, 1111
    const b5 = (pow2(b4, _1n, P) * x) % P; // x^31
    const b10 = (pow2(b5, _5n, P) * b5) % P;
    const b20 = (pow2(b10, _10n, P) * b10) % P;
    const b40 = (pow2(b20, _20n, P) * b20) % P;
    const b80 = (pow2(b40, _40n, P) * b40) % P;
    const b160 = (pow2(b80, _80n, P) * b80) % P;
    const b240 = (pow2(b160, _80n, P) * b80) % P;
    const b250 = (pow2(b240, _10n, P) * b10) % P;
    const pow_p_5_8 = (pow2(b250, _2n, P) * x) % P;
    // ^ This is x^((p-5)/8); multiply by x once more to get x^((p+3)/8).
    return { pow_p_5_8, b2 };
}
// Mutates and returns the provided 32-byte buffer in place.
function adjustScalarBytes(bytes) {
    // Section 5: For X25519, in order to decode 32 random bytes as an integer scalar,
    // set the three least significant bits of the first byte
    bytes[0] &= 248; // 0b1111_1000
    // and the most significant bit of the last to zero,
    bytes[31] &= 127; // 0b0111_1111
    // set the second most significant bit of the last byte to 1
    bytes[31] |= 64; // 0b0100_0000
    return bytes;
}
// √(-1) aka √(a) aka 2^((p-1)/4)
// Fp.sqrt(Fp.neg(1))
const ED25519_SQRT_M1 = /* @__PURE__ */ BigInt('19681161376707505956807079304988542015446066515923890162744021073123829784752');
// sqrt(u/v). Returns `{ isValid, value }`; on non-squares `value` is still a
// dummy root-shaped field element so callers can stay constant-time.
function uvRatio(u, v) {
    const P = ed25519_CURVE_p;
    const v3 = mod(v * v * v, P); // v³
    const v7 = mod(v3 * v3 * v, P); // v⁷
    // (p+3)/8 and (p-5)/8
    const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
    let x = mod(u * v3 * pow, P); // (uv³)(uv⁷)^(p-5)/8
    const vx2 = mod(v * x * x, P); // vx²
    const root1 = x; // First root candidate
    const root2 = mod(x * ED25519_SQRT_M1, P); // Second root candidate
    const useRoot1 = vx2 === u; // If vx² = u (mod p), x is a square root
    const useRoot2 = vx2 === mod(-u, P); // If vx² = -u, set x <-- x * 2^((p-1)/4)
    const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P); // There is no valid root, vx² = -u√(-1)
    if (useRoot1)
        x = root1;
    if (useRoot2 || noRoot)
        x = root2; // We return root2 anyway, for const-time
    if (isNegativeLE(x, P))
        x = mod(-x, P);
    return { isValid: useRoot1 || useRoot2, value: x };
}
const ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
// Public field alias stays stricter than the RFC 8032 Appendix A sample code:
// `Fp.inv(0)` throws instead of returning `0`.
const Fp = /* @__PURE__ */ (() => ed25519_Point.Fp)();
const Fn = /* @__PURE__ */ (() => ed25519_Point.Fn)();
// RFC 8032 `dom2` helper for ctx/ph variants only. Plain Ed25519 keeps the
// empty-domain path in `ed()` and would be wrong if routed through this helper.
function ed(opts) {
    // Ed25519 keeps ZIP-215 default verification semantics for consensus compatibility.
    return eddsa(ed25519_Point, sha512, Object.assign({ adjustScalarBytes, zip215: true }, opts));
}
/**
 * ed25519 curve with EdDSA signatures.
 * Seeded `keygen(seed)` / `utils.randomSecretKey(seed)` reuse the provided
 * 32-byte seed buffer instead of copying it.
 * @example
 * Generate one Ed25519 keypair, sign a message, and verify it.
 *
 * ```js
 * import { ed25519 } from '@noble/curves/ed25519.js';
 * const { secretKey, publicKey } = ed25519.keygen();
 * // const publicKey = ed25519.getPublicKey(secretKey);
 * const msg = new TextEncoder().encode('hello noble');
 * const sig = ed25519.sign(msg, secretKey);
 * const isValid = ed25519.verify(sig, msg, publicKey); // ZIP215
 * // RFC8032 / FIPS 186-5
 * const isValid2 = ed25519.verify(sig, msg, publicKey, { zip215: false });
 * ```
 */
const ed25519 = /* @__PURE__ */ ed({});
  return { ed25519 };
})();

// ── bundle surface ────────────────────────────────────────────────────────────
const ed25519 = C_ed25519.ed25519;
const sha256 = H_sha2.sha256;
const sha512 = H_sha2.sha512;


  return { ed25519, sha256, sha512 };
})();
/* ===== END deterministic transcendental math ===== */
