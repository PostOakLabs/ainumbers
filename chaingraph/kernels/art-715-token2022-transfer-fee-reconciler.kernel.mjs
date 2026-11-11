import { executionHash } from './_hash.mjs';

// art-715-token2022-transfer-fee-reconciler — Token-2022 transfer-fee payment reconciler.
// Given a mint's transfer-fee schedule, a TransferChecked amount, the execution epoch and the
// amount a payment verifier credited, recomputes the fee the program withholds and the net the
// recipient receives, then reconciles the credited amount against that net. Reproduces the
// Kora GHSA-725g defect class (a verifier crediting the pre-fee amount) and the x402 SVM
// consumer-path divergence (gross-accept on one path, net-accept on the other).
//
// PROVENANCE (SOLANA-B1-TRANSFER-FEE-NODE-1): the arithmetic is PORTED FROM THE PINNED CLAUSES
// D1-D3 of research/solana/B1-TRANSFER-FEE-BUILD-SPEC-2026-10-01.md (registry pins by #2166).
// No bytes are copied from the Solana or Kora sources: the rules below restate the pinned text's
// behaviour — R-1 epoch schedule pick, R-2 ceiling fee with maximum cap in 128-bit intermediates,
// R-3 net + withheld, R-4 declared-fee check, R-6 inverse (smaller amount chosen, overflow null).
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. It runs unmodified inside the QuickJS-ng zkVM guest (GUEST-BUILTIN-GATE-1). All
// amounts are BigInt end to end: u64 exceeds 2^53, so JS Number is NEVER used for amounts
// (spec section 5 integer-only discipline; no floating point anywhere).

const TOOL_ID = 'art-715-token2022-transfer-fee-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_token2022_transfer_fee',
  mandate_type: 'settlement_mandate', gpu: false,
};

const U64_MAX = (1n << 64n) - 1n;
const U16_MAX = (1n << 16n) - 1n;
const BPS_DENOM = 10000n;
const U128_MAX = (1n << 128n) - 1n;

// Decimal-string <-> BigInt. Inputs and outputs are decimal strings (spec section 5).
function parseU64(s) {
  if (typeof s !== 'string' || !/^[0-9]+$/.test(s)) return null;
  let v = 0n;
  for (let __i = 0; __i < s.length; __i++) { const ch = s[__i]; v = v * 10n + BigInt(ch.charCodeAt(0) - 48); if (v > U64_MAX) return null; }
  return v;
}
function parseU16(s) {
  const v = parseU64(s);
  if (v === null || v > U16_MAX) return null;
  return v;
}
function dec(v) { return v.toString(10); }

// R-1 Schedule (D2): newer if execution_epoch >= newer.epoch, else older.
function pickSchedule(epoch, older, newer) {
  return epoch >= newer.epoch ? newer : older;
}

// R-2 Fee (D1): 0 when bps == 0 or amount == 0; else min(ceil(amount*bps/10000), maximum_fee),
// ceiling via floor((n + d - 1)/d), intermediates 128-bit (BigInt is unbounded; the u128 check
// mirrors the source's intermediates and refuses past them instead of wrapping).
function ceilDiv(n, d) { return (n + d - 1n) / d; }
function transferFee(amount, feeConf) {
  if (feeConf.bps === 0n || amount === 0n) return 0n;
  const raw = amount * feeConf.bps; // 128-bit intermediate (amount:u64 * bps:u16 fits u128? only checked below)
  if (raw > U128_MAX) return null; // overflow -> structured refusal, never a wrapped value
  const ceiled = ceilDiv(raw, BPS_DENOM);
  return ceiled > feeConf.maxFee ? feeConf.maxFee : ceiled;
}

// R-6 Inverse (D1): smallest pre-fee amount whose forward net equals `net`; smaller amount chosen
// when rounding makes it non-unique; null on overflow / no representable preimage.
function minPreFeeForNet(net, feeConf) {
  if (net < 0n) return null;
  const { bps, maxFee } = feeConf;
  if (bps === 0n) return net <= U64_MAX ? net : null;
  const candidates = [];
  if (bps < BPS_DENOM) {
    const denom = BPS_DENOM - bps;
    const pre = ceilDiv(net * BPS_DENOM, denom); // uncapped region: pre - ceil(pre*bps/10000) = net
    candidates.push(pre);
  }
  const preCapped = net + maxFee; // capped region: fee == maximum_fee
  candidates.push(preCapped);
  let best = null;
  for (const pre of candidates) {
    if (pre > U64_MAX) continue; // overflow -> this candidate is not representable
    if (pre - transferFee(pre, feeConf) === net) {
      if (best === null || pre < best) best = pre;
    }
  }
  return best;
}

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail, extra = {}) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      schedule: null,
      fee: null,
      net: null,
      withheld_added: null,
      min_pre_fee_for_net: null,
      reconciliation: null,
      credited_minus_net: null,
      epoch_race: null,
      consumer_view: null,
      ...extra,
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

const FEE_CONF_FIELDS = ['epoch', 'maximum_fee', 'transfer_fee_basis_points'];

// Parses one { epoch, maximum_fee, transfer_fee_basis_points } authority; all decimal strings.
function parseFeeConf(raw, name) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { err: refusal('FEE_SCHEDULE_MALFORMED', name + ' must be an object { epoch, maximum_fee, transfer_fee_basis_points } with decimal-string values.') };
  }
  for (const f of FEE_CONF_FIELDS) {
    if (raw[f] === undefined) {
      return { err: refusal('FEE_SCHEDULE_MALFORMED', name + '.' + f + ' is required (decimal string, u64 range; transfer_fee_basis_points is u16).') };
    }
  }
  const epoch = parseU64(raw.epoch);
  if (epoch === null) return { err: refusal('FEE_SCHEDULE_MALFORMED', name + '.epoch must be a decimal string in u64 range; got ' + JSON.stringify(raw.epoch ?? null) + '.') };
  const maxFee = parseU64(raw.maximum_fee);
  if (maxFee === null) return { err: refusal('FEE_SCHEDULE_MALFORMED', name + '.maximum_fee must be a decimal string in u64 range; got ' + JSON.stringify(raw.maximum_fee ?? null) + '.') };
  const bps = parseU16(raw.transfer_fee_basis_points);
  if (bps === null) return { err: refusal('FEE_SCHEDULE_MALFORMED', name + '.transfer_fee_basis_points must be a decimal string in u16 range; got ' + JSON.stringify(raw.transfer_fee_basis_points ?? null) + '.') };
  return { conf: { epoch, maxFee, bps } };
}

/**
 * compute(pp) — pure decision kernel.
 * pp: {
 *   older_transfer_fee: { epoch, maximum_fee, transfer_fee_basis_points },  // decimal strings
 *   newer_transfer_fee: { epoch, maximum_fee, transfer_fee_basis_points },  // decimal strings
 *   amount,                       // TransferChecked amount, pre-fee, decimal string (u64)
 *   execution_epoch,              // Clock epoch the transfer executes in, decimal string (u64)
 *   instruction,                  // 'TransferChecked' | 'TransferCheckedWithFee'
 *   declared_fee,                 // WithFee only: the fee the instruction states, decimal string
 *   credited_amount,              // what the verifier credited, decimal string (u64)
 *   verifier_epoch,               // optional: epoch the verifier used, decimal string (u64)
 *   required_amount               // optional: payee's required amount, decimal string (u64)
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = deNull(pp || {});

  const olderP = parseFeeConf(pp.older_transfer_fee, 'older_transfer_fee');
  if (olderP.err) return olderP.err;
  const newerP = parseFeeConf(pp.newer_transfer_fee, 'newer_transfer_fee');
  if (newerP.err) return newerP.err;
  const older = olderP.conf, newer = newerP.conf;

  const executionEpoch = parseU64(pp.execution_epoch);
  if (executionEpoch === null) return refusal('EXECUTION_EPOCH_INVALID', 'execution_epoch must be a decimal string in u64 range; got ' + JSON.stringify(pp.execution_epoch ?? null) + '.');

  const amount = parseU64(pp.amount);
  if (amount === null) return refusal('AMOUNT_INVALID', 'amount must be a decimal string in u64 range; got ' + JSON.stringify(pp.amount ?? null) + '.');

  const instruction = pp.instruction;
  if (instruction !== 'TransferChecked' && instruction !== 'TransferCheckedWithFee') {
    // R-5: unchecked transfers are out of scope; a plain Transfer from an account carrying the
    // fee extension fails with MintRequiredForTransfer (D3). The node accepts only the two
    // checked instructions and names the program error in its refusal.
    return refusal('MINT_REQUIRED_FOR_TRANSFER',
      "instruction must be 'TransferChecked' or 'TransferCheckedWithFee': a plain " + JSON.stringify(instruction ?? null) +
      ' from an account carrying the transfer-fee extension fails with MintRequiredForTransfer because the fee extension requires the mint to compute the fee.');
  }

  let declaredFee = null;
  if (instruction === 'TransferCheckedWithFee') {
    declaredFee = parseU64(pp.declared_fee);
    if (declaredFee === null) return refusal('DECLARED_FEE_INVALID', 'declared_fee must be a decimal string in u64 range for TransferCheckedWithFee; got ' + JSON.stringify(pp.declared_fee ?? null) + '.');
  }

  const credited = parseU64(pp.credited_amount);
  if (credited === null) return refusal('CREDITED_AMOUNT_INVALID', 'credited_amount must be a decimal string in u64 range; got ' + JSON.stringify(pp.credited_amount ?? null) + '.');

  let verifierEpoch = null;
  if (pp.verifier_epoch !== undefined) {
    verifierEpoch = parseU64(pp.verifier_epoch);
    if (verifierEpoch === null) return refusal('VERIFIER_EPOCH_INVALID', 'verifier_epoch must be a decimal string in u64 range when supplied; got ' + JSON.stringify(pp.verifier_epoch ?? null) + '.');
  }
  let requiredAmount = null;
  if (pp.required_amount !== undefined) {
    requiredAmount = parseU64(pp.required_amount);
    if (requiredAmount === null) return refusal('REQUIRED_AMOUNT_INVALID', 'required_amount must be a decimal string in u64 range when supplied; got ' + JSON.stringify(pp.required_amount ?? null) + '.');
  }

  const compliance_flags = [];

  // R-1: schedule at the execution epoch.
  const active = pickSchedule(executionEpoch, older, newer);
  const scheduleName = active === newer ? 'newer' : 'older';

  // R-8: epoch race — a different schedule at the verifier's epoch.
  let epochRace = null;
  if (verifierEpoch !== null && pickSchedule(verifierEpoch, older, newer) !== active) {
    epochRace = 'EPOCH_SCHEDULE_DIVERGENCE';
    compliance_flags.push('EPOCH_SCHEDULE_DIVERGENCE');
  }

  // R-2/R-3: fee and net.
  const fee = transferFee(amount, active);
  if (fee === null) return refusal('FEE_OVERFLOW', 'computing the transfer fee overflowed the 128-bit intermediate; the operation is refused, not wrapped.');
  if (fee > amount) return refusal('NET_UNDERFLOW', 'the computed fee (' + dec(fee) + ') exceeds the transfer amount (' + dec(amount) + '); the subtraction would underflow, so the operation is refused.');
  const net = amount - fee;

  // R-4: declared fee (WithFee only) — the program fails the instruction with FeeMismatch.
  let feeMismatch = null;
  if (instruction === 'TransferCheckedWithFee' && declaredFee !== fee) {
    feeMismatch = 'FeeMismatch';
    compliance_flags.push('FEE_MISMATCH');
  }

  // R-6: inverse, informational.
  const minPre = minPreFeeForNet(net, active);
  const minPreStr = minPre === null ? null : dec(minPre);

  // R-7: reconciliation of the credited amount against the net.
  let reconciliation;
  let creditedMinusNet;
  if (credited === net) {
    reconciliation = 'MATCH';
    creditedMinusNet = '0';
  } else if (credited > net) {
    reconciliation = 'OVER_CREDITED';
    creditedMinusNet = dec(credited - net);
  } else {
    reconciliation = 'UNDER_CREDITED';
    creditedMinusNet = '-' + dec(net - credited);
  }

  // R-9: consumer view (informational, when required_amount is given).
  let consumerView = null;
  if (requiredAmount !== null) {
    const staticAccept = amount === requiredAmount;          // gross amount match (x402 exact)
    const balanceDeltaAccept = net >= requiredAmount;        // net amount tolerance (balance delta)
    const divergence = staticAccept !== balanceDeltaAccept;
    if (divergence) compliance_flags.push('CONSUMER_PATH_DIVERGENCE');
    consumerView = {
      required_amount: dec(requiredAmount),
      x402_static_path_accept: staticAccept,
      x402_balance_delta_path_accept: balanceDeltaAccept,
      consumer_path_divergence: divergence,
      note: 'The x402 SVM exact scheme compares the gross TransferChecked amount, while a balance-delta verification sees the post-fee net; the spec text tolerates overpayment (net >= required) and never mentions transfer fees.',
    };
  }

  const output_payload = {
    schedule: scheduleName,
    fee: dec(fee),
    net: dec(net),
    withheld_added: dec(fee),
    fee_mismatch: feeMismatch,
    declared_fee: instruction === 'TransferCheckedWithFee' ? dec(declaredFee) : null,
    min_pre_fee_for_net: minPreStr,
    reconciliation,
    credited_amount: dec(credited),
    credited_minus_net: creditedMinusNet,
    epoch_race: epochRace,
    execution_epoch: dec(executionEpoch),
    verifier_epoch: verifierEpoch === null ? null : dec(verifierEpoch),
    consumer_view: consumerView,
    note: 'Fee arithmetic ports the Token-2022 transfer-fee extension: ceiling(amount * bps / 10,000) capped at maximum_fee, computed in 128-bit intermediates, with the newer schedule applying from its epoch on. The Kora GHSA-725g defect class is a verifier crediting the pre-fee amount; OVER_CREDITED with credited_minus_net = fee reproduces it.',
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
