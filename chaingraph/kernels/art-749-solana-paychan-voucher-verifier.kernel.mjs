import { executionHash } from './_hash.mjs';

// art-749-solana-paychan-voucher-verifier — values-only check of a Solana
// payment-channels voucher message against trusted channel terms.
//
// The voucher is the 50-byte Ed25519-signed message the payment-channels
// program reads through the Instructions sysvar. This kernel recomputes the
// wire-layout parse and the settle arithmetic by pure byte inspection: layout
// (exactly 50 bytes), magic tag/version bytes, channel-address binding,
// u64 little-endian cumulative amount against the trusted deposit ceiling and
// the settled watermark, i64 little-endian expiry against a supplied clock,
// and an optional supersession comparison against a second voucher message.
// It reproduces the program's own pre-signature check sequence (the same
// order the on-chain validator applies after the Ed25519 precompile has
// proven the signature) so a funder, merchant or auditor can see every
// non-cryptographic reason a voucher would settle or fail, with no RPC, no
// key and no signature library.
//
// OUT OF SCOPE, stated in every output: the Ed25519 signature itself is NOT
// verified here (the caller asserts the authorized signer as claimed), and
// nothing is read from chain — every channel term is a trusted input.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(),
// no network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM
// guest (GUEST-BUILTIN-GATE-1): no TextEncoder/atob/btoa/URL is used, and all
// numeric fields are BigInt end to end (u64 exceeds 2^53, so JS Number is
// NEVER used for amounts or timestamps — no floating point anywhere).

const TOOL_ID = 'art-749-solana-paychan-voucher-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_solana_paychan_voucher',
  mandate_type: 'payment_mandate', gpu: false,
};

const U64_MAX = (1n << 64n) - 1n;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;

// Pinned wire constants of the voucher message.
const VOUCHER_LEN = 50;
const MAGIC_0 = 0x56;
const MAGIC_1 = 0x01;
const OFF_CHANNEL_ID = 2;
const OFF_CUMULATIVE = 34;
const OFF_EXPIRES_AT = 42;
// Channel-incarnation recency window of the program (slots); reported as
// pinned context in the output — it gates `open`, never the voucher checks.
const OPEN_SLOT_WINDOW = 1500;

function dec(v) { return v.toString(10); }

function parseU64(s) {
  if (typeof s !== 'string' || !/^[0-9]+$/.test(s)) return null;
  let v = 0n;
  for (let __i = 0; __i < s.length; __i++) { const ch = s[__i]; v = v * 10n + BigInt(ch.charCodeAt(0) - 48); if (v > U64_MAX) return null; }
  return v;
}

function parseI64(s) {
  if (typeof s !== 'string' || !/^-?[0-9]+$/.test(s)) return null;
  const neg = s.startsWith('-');
  const v = parseU64(neg ? s.slice(1) : s);
  if (v === null) return null;
  const out = neg ? -v : v;
  if (out < I64_MIN || out > I64_MAX) return null;
  return out;
}

// Pure base58 (Bitcoin alphabet) decoder for 32-byte Solana addresses: the decoded
// byte length (leading '1' zeros plus value bytes) must be exactly 32.
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = new Map(B58_ALPHABET.split('').map((c, i) => [c, i]));
function base58Decode32(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 50) return null;
  let n = 0n;
  let zeros = 0;
  for (let i = 0; i < s.length; i++) {
    const val = B58_MAP.get(s[i]);
    if (val === undefined) return null;
    if (val === 0 && n === 0n) { zeros++; continue; }
    n = n * 58n + BigInt(val);
  }
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const valueLen = n === 0n ? 0 : hex.length / 2;
  if (zeros + valueLen !== 32) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < valueLen; i++) out[31 - i] = parseInt(hex.slice(hex.length - 2 * (i + 1), hex.length - 2 * i), 16);
  return out;
}

function hexToBytes(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().toLowerCase().replace(/^0x/, '');
  if (t.length === 0 || t.length % 2 !== 0 || !/^[0-9a-f]+$/.test(t)) return null;
  const out = new Uint8Array(t.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b) {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

function refusal(code, detail, extra = {}) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      checks: null,
      all_pass: null,
      settle_delta: null,
      cumulative_amount: null,
      expires_at: null,
      voucher: null,
      second_voucher: null,
      pinned_constants: null,
      out_of_scope: 'the Ed25519 signature is NOT verified here and nothing is read from chain',
      ...extra,
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

// Parse a 50-byte voucher message into its fields (assumes length is checked).
function parseVoucher(bytes) {
  return {
    magic_ok: bytes[0] === MAGIC_0 && bytes[1] === MAGIC_1,
    channel_id_hex: bytesToHex(bytes.slice(OFF_CHANNEL_ID, OFF_CUMULATIVE)),
    cumulative: (() => {
      let v = 0n;
      for (let i = OFF_CUMULATIVE + 7; i >= OFF_CUMULATIVE; i--) v = (v << 8n) | BigInt(bytes[i]);
      return v; // 8 bytes LE -> u64 always in range
    })(),
    expires_at: (() => {
      let v = 0n;
      for (let i = OFF_EXPIRES_AT + 7; i >= OFF_EXPIRES_AT; i--) v = (v << 8n) | BigInt(bytes[i]);
      return BigInt.asIntN(64, v); // i64 LE
    })(),
  };
}

/**
 * compute(pp) — pure decision kernel.
 * pp: {
 *   voucher_hex,        // the 50-byte voucher message, hex (0x prefix tolerated)
 *   channel_pda,        // the trusted channel PDA address, base58
 *   deposit_ceiling,    // trusted escrowed deposit, decimal string (u64)
 *   settled_watermark,  // trusted current settled amount, decimal string (u64)
 *   current_time,       // trusted unix time in seconds, decimal string (i64)
 *   mint,               // optional trusted mint, informational passthrough
 *   authorized_signer,  // optional claimed signer pubkey, base58 — NOT verified
 *   second_voucher_hex  // optional second voucher message, hex
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = deNull(pp || {});

  const voucherBytes = hexToBytes(pp.voucher_hex);
  if (voucherBytes === null) {
    return refusal('VOUCHER_MALFORMED', 'voucher_hex must be a hex string (even length, 0..9 a..f, optional 0x prefix); got ' + JSON.stringify(pp.voucher_hex ?? null) + '.');
  }

  const channelBytes = base58Decode32(pp.channel_pda);
  if (channelBytes === null) {
    return refusal('CHANNEL_PDA_INVALID', 'channel_pda must be a base58 Solana address decoding to exactly 32 bytes; got ' + JSON.stringify(pp.channel_pda ?? null) + '.');
  }

  const deposit = parseU64(pp.deposit_ceiling);
  if (deposit === null) return refusal('DEPOSIT_CEILING_INVALID', 'deposit_ceiling must be a decimal string in u64 range; got ' + JSON.stringify(pp.deposit_ceiling ?? null) + '.');

  const settled = parseU64(pp.settled_watermark);
  if (settled === null) return refusal('SETTLED_WATERMARK_INVALID', 'settled_watermark must be a decimal string in u64 range; got ' + JSON.stringify(pp.settled_watermark ?? null) + '.');

  const now = parseI64(pp.current_time);
  if (now === null) return refusal('CURRENT_TIME_INVALID', 'current_time must be a decimal string unix time in i64 range; got ' + JSON.stringify(pp.current_time ?? null) + '.');

  const compliance_flags = [];
  const checks = {
    length_is_50: voucherBytes.length === VOUCHER_LEN,
    magic_is_56_01: false,
    channel_id_matches_pda: false,
    cumulative_within_deposit_ceiling: false,
    cumulative_above_settled_watermark: false,
    not_expired: false,
  };

  const lenOk = checks.length_is_50;
  let v = null;
  if (lenOk) {
    v = parseVoucher(voucherBytes);
    checks.magic_is_56_01 = v.magic_ok;
    checks.channel_id_matches_pda = v.channel_id_hex === bytesToHex(channelBytes);
    checks.cumulative_within_deposit_ceiling = v.cumulative <= deposit;
    // Strictly monotonic watermark, mirroring the program's own check: a
    // cumulative amount at or below the settled watermark is stale.
    checks.cumulative_above_settled_watermark = v.cumulative > settled;
    checks.not_expired = v.expires_at === 0n || now < v.expires_at;
  }

  const allPass = Object.values(checks).every(Boolean);
  if (!allPass) {
    if (!checks.length_is_50) compliance_flags.push('VOUCHER_BAD_LENGTH');
    if (checks.length_is_50 && !checks.magic_is_56_01) compliance_flags.push('VOUCHER_BAD_MAGIC');
    if (checks.length_is_50 && checks.magic_is_56_01 && !checks.channel_id_matches_pda) compliance_flags.push('CHANNEL_MISMATCH');
    if (checks.length_is_50 && checks.magic_is_56_01 && checks.channel_id_matches_pda && !checks.cumulative_within_deposit_ceiling) compliance_flags.push('OVER_DEPOSIT');
    if (checks.length_is_50 && checks.magic_is_56_01 && checks.channel_id_matches_pda && checks.cumulative_within_deposit_ceiling && !checks.cumulative_above_settled_watermark) compliance_flags.push('STALE_WATERMARK');
    if (checks.length_is_50 && checks.magic_is_56_01 && checks.channel_id_matches_pda && checks.cumulative_within_deposit_ceiling && checks.cumulative_above_settled_watermark && !checks.not_expired) compliance_flags.push('VOUCHER_EXPIRED');
  }

  const settleDelta = lenOk && checks.cumulative_above_settled_watermark ? v.cumulative - settled : null;

  // Optional supersession: a second voucher with a lower or equal cumulative
  // amount is superseded by the first.
  let second = null;
  if (pp.second_voucher_hex !== undefined) {
    const secondBytes = hexToBytes(pp.second_voucher_hex);
    if (secondBytes === null) {
      return refusal('SECOND_VOUCHER_MALFORMED', 'second_voucher_hex, when supplied, must be a hex string (even length, 0..9 a..f, optional 0x prefix); got ' + JSON.stringify(pp.second_voucher_hex ?? null) + '.');
    }
    if (secondBytes.length !== VOUCHER_LEN) {
      compliance_flags.push('SECOND_VOUCHER_BAD_LENGTH');
      second = { well_formed: false, superseded_by_first: null, cumulative_amount: null, note: 'second voucher is not 50 bytes; layout checks are undefined and it is treated as not comparable.' };
    } else {
      const sv = parseVoucher(secondBytes);
      if (!sv.magic_ok) {
        compliance_flags.push('SECOND_VOUCHER_BAD_MAGIC');
        second = { well_formed: false, superseded_by_first: null, cumulative_amount: dec(sv.cumulative), note: 'second voucher magic bytes are not 0x56 0x01; not comparable.' };
      } else if (sv.channel_id_hex !== bytesToHex(channelBytes)) {
        compliance_flags.push('SECOND_VOUCHER_CHANNEL_MISMATCH');
        second = { well_formed: false, superseded_by_first: null, cumulative_amount: dec(sv.cumulative), note: 'second voucher binds a different channel; not comparable.' };
      } else {
        const superseded = sv.cumulative <= v.cumulative;
        second = {
          well_formed: true,
          cumulative_amount: dec(sv.cumulative),
          superseded_by_first: superseded,
          second_cumulative_minus_first: (sv.cumulative >= v.cumulative ? sv.cumulative - v.cumulative : -(v.cumulative - sv.cumulative)).toString(10),
          note: superseded
            ? 'the second voucher moves the watermark no further than the first and is superseded by it.'
            : 'the second voucher has a strictly higher cumulative amount; it would advance the watermark beyond the first.',
        };
      }
    }
  }

  const output_payload = {
    checks,
    all_pass: allPass,
    settle_delta: settleDelta === null ? null : dec(settleDelta),
    cumulative_amount: lenOk ? dec(v.cumulative) : null,
    expires_at: lenOk ? dec(v.expires_at) : null,
    channel_id_hex: lenOk ? v.channel_id_hex : null,
    voucher: { length: voucherBytes.length, hex_prefix_stripped: true },
    second_voucher: second,
    pinned_constants: {
      voucher_len: VOUCHER_LEN,
      magic: [MAGIC_0, MAGIC_1],
      offsets: { channel_id: OFF_CHANNEL_ID, cumulative_amount: OFF_CUMULATIVE, expires_at: OFF_EXPIRES_AT },
      field_sizes: { channel_id: 32, cumulative_amount: 8, expires_at: 8 },
      open_slot_window: OPEN_SLOT_WINDOW,
    },
    trusted_terms: {
      deposit_ceiling: dec(deposit),
      settled_watermark: dec(settled),
      current_time: dec(now),
      mint: typeof pp.mint === 'string' ? pp.mint : null,
      authorized_signer: typeof pp.authorized_signer === 'string' ? pp.authorized_signer : null,
    },
    out_of_scope: 'the Ed25519 signature is NOT verified here (the authorized signer is a trusted claim) and nothing is read from chain',
    note: 'Checks mirror the program validator in its own order after the Ed25519 precompile has proven the signature: exact 50-byte layout, magic tag/version, channel-address binding, deposit cap, strictly monotonic watermark, expiry (0 disables). settle_delta is the amount a settle of this voucher would add to the channel.',
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
