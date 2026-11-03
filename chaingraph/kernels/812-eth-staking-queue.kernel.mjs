import { executionHash } from './_hash.mjs';

// 812-eth-staking-queue: compute a validator's exit, consolidation and activation queue epochs and
// its withdrawal sweep wait from declared consensus-layer queue state and the balance-based churn
// rules. Integer (BigInt) math only. The wait follows from the declared state and the published
// rules; it is not a forecast, and the node reads no chain.
//
// DETERMINISM: compute() is a pure function of pp. No clock, no randomness, no network, no
// TextEncoder. Closed form throughout: every queue and sweep figure is a single ceil-division.
// There is no loop of any kind, so no loop is bounded by a caller value.

const TOOL_ID = '812-eth-staking-queue';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'project_eth_validator_queue_wait',
  mandate_type: 'compliance_control', gpu: false,
};

const UINT64_MAX = 18446744073709551615n;
const INC = 1000000000n;                     // EFFECTIVE_BALANCE_INCREMENT
const MIN_CHURN = 128000000000n;             // MIN_PER_EPOCH_CHURN_LIMIT_ELECTRA
const MAX_ACT_EXIT_CHURN = 256000000000n;    // MAX_PER_EPOCH_ACTIVATION_EXIT_CHURN_LIMIT
const CHURN_LIMIT_QUOTIENT = 65536n;
const MAX_SEED_LOOKAHEAD = 4n;
const MIN_WITHDRAWABILITY_DELAY = 256n;
const MAX_DEPOSITS_PER_EPOCH = 16n;          // MAX_PENDING_DEPOSITS_PER_EPOCH
const SWEEP_MAX_VALIDATORS = 16384n;         // MAX_VALIDATORS_PER_WITHDRAWALS_SWEEP
const WITHDRAWALS_PER_PAYLOAD = 16n;         // MAX_WITHDRAWALS_PER_PAYLOAD
const SLOTS_PER_EPOCH = 32n;
const MAX_EB = { 0: 32000000000n, 1: 32000000000n, 2: 2048000000000n };

// Accepts a safe integer or a base-10 digit string; anything else is null.
/** @param {unknown} v @returns {bigint | null} */
function toBig(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? BigInt(v) : null;
  if (typeof v === 'string' && /^[0-9]+$/.test(v)) return BigInt(v);
  return null;
}

function refuse(code) {
  return { output_payload: { refused: true, refusal_code: code }, compliance_flags: ['INPUT_REFUSED'] };
}

/** @param {bigint | null} b */
const s = (b) => (b === null ? null : b.toString());
/** @param {bigint} a @param {bigint} b */
const ceilDiv = (a, b) => (a + b - 1n) / b;

// Absent or null section = not requested. Anything else must be a plain object.
function section(v) {
  if (v === undefined || v === null) return { absent: true };
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  return { absent: false, v };
}

// Read the named integer fields of an object; null if any is missing or malformed.
/** @param {any} obj @param {string[]} keys @returns {Record<string, bigint> | null} */
function ints(obj, keys) {
  /** @type {Record<string, bigint>} */
  const out = {};
  for (const k of keys) {
    const b = toBig(obj[k]);
    if (b === null) return null;
    out[k] = b;
  }
  return out;
}

// The exit and consolidation queues share one closed form: start a fresh epoch's allowance when the
// declared earliest epoch is behind the activation-exit lookahead, then add whole epochs of churn.
/** @param {bigint} stateEarliest @param {bigint} stateToConsume @param {bigint} balance @param {bigint} currentEpoch @param {bigint} churn */
function queueEpoch(stateEarliest, stateToConsume, balance, currentEpoch, churn) {
  const floor = currentEpoch + 1n + MAX_SEED_LOOKAHEAD;
  let earliest = stateEarliest > floor ? stateEarliest : floor;
  let toConsume = stateEarliest < earliest ? churn : stateToConsume;
  if (balance > toConsume) {
    const add = (balance - toConsume - 1n) / churn + 1n;
    earliest += add;
    toConsume += add * churn;
  }
  return { epoch: earliest, remaining: toConsume - balance };
}

export function compute(pp) {
  pp = pp || {};
  const top = ints(pp, ['total_active_balance_gwei', 'current_epoch', 'withdrawal_credential_prefix']);
  if (top === null) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  const sps = pp.seconds_per_slot === undefined || pp.seconds_per_slot === null ? null : toBig(pp.seconds_per_slot);
  if (sps === null && pp.seconds_per_slot !== undefined && pp.seconds_per_slot !== null) return refuse('NON_NEGATIVE_INTEGER_INPUTS');

  const ex = section(pp.exit);
  const co = section(pp.consolidation);
  const ac = section(pp.activation);
  const sw = section(pp.sweep);
  if (!ex || !co || !ac || !sw) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  const exI = ex.absent ? null : ints(ex.v, ['state_earliest_exit_epoch', 'state_exit_balance_to_consume_gwei', 'exit_balance_gwei']);
  const coI = co.absent ? null : ints(co.v, ['state_earliest_consolidation_epoch', 'state_consolidation_balance_to_consume_gwei', 'consolidation_balance_gwei']);
  const acI = ac.absent ? null : ints(ac.v, ['deposit_balance_to_consume_gwei', 'pending_deposit_balance_ahead_gwei', 'pending_deposit_count_ahead', 'deposit_amount_gwei', 'finality_lag_epochs']);
  const swI = sw.absent ? null : ints(sw.v, ['validator_count', 'next_withdrawal_validator_index', 'target_validator_index', 'withdrawable_count_ahead', 'prior_withdrawals_per_slot']);
  if ((!ex.absent && !exI) || (!co.absent && !coI) || (!ac.absent && !acI) || (!sw.absent && !swI)) return refuse('NON_NEGATIVE_INTEGER_INPUTS');

  const all = [top.total_active_balance_gwei, top.current_epoch, sps ?? 0n];
  for (const o of [exI, coI, acI, swI]) if (o) all.push(...Object.values(o));
  if (all.some((x) => x > UINT64_MAX)) return refuse('UINT64_RANGE');

  const T = top.total_active_balance_gwei;
  const cur = top.current_epoch;
  const prefix = top.withdrawal_credential_prefix;
  if (T === 0n) return refuse('TOTAL_ACTIVE_BALANCE_ZERO');
  if (prefix !== 0n && prefix !== 1n && prefix !== 2n) return refuse('UNKNOWN_WITHDRAWAL_PREFIX');
  const maxEb = MAX_EB[Number(prefix)];
  const ebs = [];
  if (exI) ebs.push(exI.exit_balance_gwei);
  if (coI) ebs.push(coI.consolidation_balance_gwei);
  if (ebs.some((x) => x > maxEb)) return refuse('EFFECTIVE_BALANCE_EXCEEDS_MAXEB');
  if (ebs.some((x) => x % INC !== 0n)) return refuse('EFFECTIVE_BALANCE_NOT_INCREMENT_MULTIPLE');
  if (swI) {
    if (swI.prior_withdrawals_per_slot >= WITHDRAWALS_PER_PAYLOAD) return refuse('PRIOR_WITHDRAWALS_OUT_OF_RANGE');
    const n = swI.validator_count;
    if (n === 0n || swI.target_validator_index >= n || swI.next_withdrawal_validator_index >= n) return refuse('TARGET_INDEX_OUT_OF_RANGE');
  }
  if (acI && acI.pending_deposit_count_ahead === 0n && acI.pending_deposit_balance_ahead_gwei > 0n) return refuse('DEPOSIT_COUNT_BALANCE_MISMATCH');

  // Churn limits.
  let bal = T / CHURN_LIMIT_QUOTIENT;
  if (bal < MIN_CHURN) bal = MIN_CHURN;
  bal -= bal % INC;
  const actExit = bal < MAX_ACT_EXIT_CHURN ? bal : MAX_ACT_EXIT_CHURN;
  const consChurn = bal - actExit;
  if (coI && consChurn === 0n) return refuse('CONSOLIDATION_CHURN_ZERO');

  /** @param {bigint | null} slots */
  const secs = (slots) => (sps === null || slots === null ? null : slots * sps);
  /** @param {bigint | null} e */
  const epochSecs = (e) => (e === null ? null : secs((e - cur) * SLOTS_PER_EPOCH));

  // Exit queue.
  let exitEpoch = null;
  let exitRemaining = null;
  let withdrawable = null;
  if (exI) {
    const q = queueEpoch(exI.state_earliest_exit_epoch, exI.state_exit_balance_to_consume_gwei, exI.exit_balance_gwei, cur, actExit);
    exitEpoch = q.epoch;
    exitRemaining = q.remaining;
    withdrawable = exitEpoch + MIN_WITHDRAWABILITY_DELAY;
  }

  // Consolidation queue.
  let consEpoch = null;
  let consRemaining = null;
  if (coI) {
    const q = queueEpoch(coI.state_earliest_consolidation_epoch, coI.state_consolidation_balance_to_consume_gwei, coI.consolidation_balance_gwei, cur, consChurn);
    consEpoch = q.epoch;
    consRemaining = q.remaining;
  }

  // Activation: churn is consumed by pending-deposit processing, at most 16 deposits per epoch.
  let appliedEpoch = null;
  let activationEpoch = null;
  let activationWait = null;
  let activationLowerBound = null;
  if (acI) {
    const need = acI.pending_deposit_balance_ahead_gwei + acI.deposit_amount_gwei;
    const carry = acI.deposit_balance_to_consume_gwei;
    let k = need > carry ? ceilDiv(need - carry, actExit) : 1n;
    const kCount = ceilDiv(acI.pending_deposit_count_ahead + 1n, MAX_DEPOSITS_PER_EPOCH);
    if (kCount > k) k = kCount;
    // Churn binds every epoch only when the deposits ahead average at least churn / 16.
    activationLowerBound = acI.pending_deposit_balance_ahead_gwei * MAX_DEPOSITS_PER_EPOCH < actExit * acI.pending_deposit_count_ahead;
    appliedEpoch = cur + k - 1n;
    activationEpoch = appliedEpoch + 7n + acI.finality_lag_epochs;
    activationWait = activationEpoch - cur;
  }

  // Withdrawal sweep.
  let sweepSlots = null;
  let sweepLowerBound = null;
  let sweepCredential = null;
  if (swI) {
    const n = swI.validator_count;
    const dist = (swI.target_validator_index - swI.next_withdrawal_validator_index + n) % n;
    if (swI.withdrawable_count_ahead > dist) return refuse('WITHDRAWABLE_AHEAD_EXCEEDS_DISTANCE');
    const byScan = dist / SWEEP_MAX_VALIDATORS + 1n;
    const byPayload = ceilDiv(swI.withdrawable_count_ahead + 1n, WITHDRAWALS_PER_PAYLOAD - swI.prior_withdrawals_per_slot);
    sweepSlots = byScan > byPayload ? byScan : byPayload;
    sweepLowerBound = !(swI.withdrawable_count_ahead === 0n && swI.prior_withdrawals_per_slot === 0n);
    sweepCredential = prefix !== 0n;
  }

  return {
    output_payload: {
      refused: false,
      balance_churn_limit_gwei: s(bal),
      activation_exit_churn_limit_gwei: s(actExit),
      consolidation_churn_limit_gwei: s(consChurn),
      activation_exit_churn_at_cap: actExit === MAX_ACT_EXIT_CHURN,
      exit_epoch: s(exitEpoch),
      exit_balance_to_consume_after_gwei: s(exitRemaining),
      withdrawable_epoch: s(withdrawable),
      consolidation_epoch: s(consEpoch),
      consolidation_balance_to_consume_after_gwei: s(consRemaining),
      deposit_applied_epoch: s(appliedEpoch),
      activation_epoch: s(activationEpoch),
      activation_wait_epochs: s(activationWait),
      activation_wait_is_lower_bound: activationLowerBound,
      sweep_slots_to_target: s(sweepSlots),
      sweep_slots_is_lower_bound: sweepLowerBound,
      sweep_target_has_execution_credential: sweepCredential,
      seconds_to_exit_epoch: s(epochSecs(exitEpoch)),
      seconds_to_withdrawable_epoch: s(epochSecs(withdrawable)),
      seconds_to_consolidation_epoch: s(epochSecs(consEpoch)),
      seconds_to_activation_epoch: s(epochSecs(activationEpoch)),
      seconds_to_sweep_target: s(secs(sweepSlots)),
    },
    compliance_flags: [],
  };
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
