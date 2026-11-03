import { executionHash } from './_hash.mjs';

// 813-eth-staking-accounting: recompute one validator's one-epoch reward, penalty and
// slashing accounting in Gwei from declared consensus-layer state. Integer (BigInt) math only.
// Recompute from the published spec on declared inputs; not an earnings forecast, no chain reads.
//
// DETERMINISM: compute() is a pure function of pp. No clock, no randomness, no network, no
// TextEncoder. Loops: integer_squareroot (bounded by the input magnitude, at most about 64
// rounds for a Uint64 input), the fixed 3-flag loop, and the inclusion list, which is capped at
// MAX_INCLUSIONS. No loop is bounded by a caller policy value.

const TOOL_ID = '813-eth-staking-accounting';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_eth_epoch_accounting',
  mandate_type: 'compliance_control', gpu: false,
};

const UINT64_MAX = 18446744073709551615n;
const INC = 1000000000n;                 // EFFECTIVE_BALANCE_INCREMENT
const BASE_REWARD_FACTOR = 64n;
const WEIGHT_DENOM = 64n;
const WEIGHTS = [14n, 26n, 14n];         // source, target, head
const SYNC_WEIGHT = 2n;
const PROPOSER_WEIGHT = 8n;
const SLOTS_PER_EPOCH = 32n;
const SYNC_COMMITTEE_SIZE = 512n;
const BIAS = 4n;                         // INACTIVITY_SCORE_BIAS
const RECOVERY = 16n;                    // INACTIVITY_SCORE_RECOVERY_RATE
const MIN_SLASH_QUOT = 4096n;            // MIN_SLASHING_PENALTY_QUOTIENT_ELECTRA
const WB_QUOT = 4096n;                   // WHISTLEBLOWER_REWARD_QUOTIENT_ELECTRA
const EPOCHS_PER_SLASHINGS_VECTOR = 8192n;
const MIN_WITHDRAWABILITY_DELAY = 256n;
const MAX_EB = { 0: 32000000000n, 1: 32000000000n, 2: 2048000000000n };
const MAX_INCLUSIONS = 64;
const PROPOSER_ATT_DENOM = ((WEIGHT_DENOM - PROPOSER_WEIGHT) * WEIGHT_DENOM) / PROPOSER_WEIGHT; // 448

// Newton iteration for floor(sqrt(n)); n is at most UINT64_MAX.
function isqrt(n) {
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

// Accepts a safe integer or a base-10 digit string; anything else is null.
function toBig(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? BigInt(v) : null;
  if (typeof v === 'string' && /^[0-9]+$/.test(v)) return BigInt(v);
  return null;
}

function refuse(code) {
  // `issues` mirrors compliance_flags in output_payload (ART806-MIRROR-ISSUES-1).
  const issues = [code];
  return { output_payload: { refused: true, refusal_code: code, issues }, compliance_flags: issues.length > 0 ? ['INPUT_REFUSED'] : [] };
}

const s = (b) => b.toString();
const satSub = (a, b) => (a > b ? a - b : 0n);

export function compute(pp) {
  pp = pp || {};
  const part = pp.participation;
  const sync = pp.sync;
  const slash = pp.slashing;
  if (!part || typeof part !== 'object' || !sync || typeof sync !== 'object' || !slash || typeof slash !== 'object') {
    return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  }
  for (const b of [part.timely_source, part.timely_target, part.timely_head, pp.in_inactivity_leak, sync.in_sync_committee, slash.is_slashed]) {
    if (typeof b !== 'boolean') return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  }
  const eb = toBig(pp.effective_balance_gwei);
  const T = toBig(pp.total_active_balance_gwei);
  const score = toBig(pp.inactivity_score);
  const slotsCounted = toBig(sync.slots_counted);
  const slotsSet = toBig(sync.slots_set);
  const slashingsSum = toBig(slash.slashings_sum_gwei);
  const slashEpoch = toBig(slash.slash_epoch);
  const exitEpoch = toBig(slash.exit_epoch);
  const prefix = toBig(pp.withdrawal_credential_prefix);
  const partBal = Array.isArray(pp.unslashed_participating_balance_gwei) && pp.unslashed_participating_balance_gwei.length === 3
    ? pp.unslashed_participating_balance_gwei.map(toBig) : null;
  const incl = pp.inclusion_attestations == null ? [] : pp.inclusion_attestations;
  if (!Array.isArray(incl)) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  if ([eb, T, score, slotsCounted, slotsSet, slashingsSum, slashEpoch, exitEpoch, prefix].some((x) => x === null) || partBal === null || partBal.some((x) => x === null)) {
    return refuse('NON_NEGATIVE_INTEGER_INPUTS');
  }
  if (incl.length > MAX_INCLUSIONS) return refuse('INCLUSION_LIST_TOO_LONG');
  const inclusions = [];
  for (const e of incl) {
    const f = e && e.newly_set_flags;
    const aeb = e ? toBig(e.effective_balance_gwei) : null;
    if (aeb === null || !Array.isArray(f) || f.length !== 3 || f.some((x) => typeof x !== 'boolean')) return refuse('NON_NEGATIVE_INTEGER_INPUTS');
    inclusions.push({ aeb, f });
  }
  const gwei = [eb, T, slashingsSum, ...partBal, ...inclusions.map((x) => x.aeb)];
  if (gwei.some((x) => x > UINT64_MAX)) return refuse('UINT64_RANGE');
  if (T === 0n) return refuse('TOTAL_ACTIVE_BALANCE_ZERO');
  if (prefix !== 0n && prefix !== 1n && prefix !== 2n) return refuse('UNKNOWN_WITHDRAWAL_PREFIX');
  if (eb > MAX_EB[Number(prefix)] || inclusions.some((x) => x.aeb > MAX_EB[2])) return refuse('EFFECTIVE_BALANCE_EXCEEDS_MAXEB');
  if (eb % INC !== 0n || inclusions.some((x) => x.aeb % INC !== 0n)) return refuse('EFFECTIVE_BALANCE_NOT_INCREMENT_MULTIPLE');
  if (partBal.some((x) => x > T)) return refuse('PARTICIPATING_EXCEEDS_TOTAL');
  if (slotsCounted > SLOTS_PER_EPOCH || slotsSet > slotsCounted) return refuse('SLOTS_COUNTED_EXCEEDS_EPOCH');

  const root = isqrt(T);
  const bpi = (INC * BASE_REWARD_FACTOR) / root;
  const baseReward = (eb / INC) * bpi;
  const totalIncs = T / INC;

  // Flag deltas.
  const hits = [part.timely_source, part.timely_target, part.timely_head];
  const flagRewards = [0n, 0n, 0n];
  const flagPenalties = [0n, 0n, 0n];
  for (let i = 0; i < 3; i++) {
    if (hits[i]) {
      if (!pp.in_inactivity_leak) {
        flagRewards[i] = (baseReward * WEIGHTS[i] * (partBal[i] / INC)) / (totalIncs * WEIGHT_DENOM);
      }
    } else if (i !== 2) {
      flagPenalties[i] = (baseReward * WEIGHTS[i]) / WEIGHT_DENOM;
    }
  }

  // Proposer reward for included attestations.
  let numerator = 0n;
  for (const x of inclusions) {
    const br = (x.aeb / INC) * bpi;
    for (let i = 0; i < 3; i++) if (x.f[i]) numerator += br * WEIGHTS[i];
  }
  const proposerInclusion = numerator / PROPOSER_ATT_DENOM;

  // Sync committee.
  let partReward = 0n;
  let syncDelta = 0n;
  let syncProposer = 0n;
  if (sync.in_sync_committee) {
    const maxPart = (bpi * totalIncs * SYNC_WEIGHT) / WEIGHT_DENOM / SLOTS_PER_EPOCH;
    partReward = maxPart / SYNC_COMMITTEE_SIZE;
    const perSlotProposer = (partReward * PROPOSER_WEIGHT) / (WEIGHT_DENOM - PROPOSER_WEIGHT);
    syncDelta = partReward * slotsSet - partReward * (slotsCounted - slotsSet);
    syncProposer = perSlotProposer * slotsSet;
  }

  // Inactivity score (exact); the penalty needs the pinned quotient, so it is null when owed.
  const missedTarget = !part.timely_target;
  let scoreAfter = missedTarget ? score + BIAS : satSub(score, 1n);
  if (!pp.in_inactivity_leak) scoreAfter = satSub(scoreAfter, RECOVERY);
  const pending = [];
  let inactivityPenalty = '0';
  if (missedTarget && scoreAfter > 0n) {
    inactivityPenalty = null;
    pending.push('inactivity_penalty_gwei');
  }

  // Slashing.
  let initialPenalty = 0n;
  let whistleblower = 0n;
  let proposerCut = 0n;
  let correlated = '0';
  let correlatedEpoch = null;
  if (slash.is_slashed) {
    initialPenalty = eb / MIN_SLASH_QUOT;
    whistleblower = eb / WB_QUOT;
    proposerCut = (whistleblower * PROPOSER_WEIGHT) / WEIGHT_DENOM;
    const a = exitEpoch + MIN_WITHDRAWABILITY_DELAY;
    const b = slashEpoch + EPOCHS_PER_SLASHINGS_VECTOR;
    const withdrawable = a > b ? a : b;
    correlatedEpoch = s(withdrawable - EPOCHS_PER_SLASHINGS_VECTOR / 2n);
    if (slashingsSum >= T) {
      // min(sum * M, T) = T for every M >= 1, so the result does not depend on the multiplier.
      correlated = s((T / totalIncs) * (eb / INC));
    } else {
      correlated = null;
      pending.push('correlated_penalty_gwei');
    }
  }

  const rewards = flagRewards[0] + flagRewards[1] + flagRewards[2] + proposerInclusion + (syncDelta > 0n ? syncDelta : 0n);
  const penalties = flagPenalties[0] + flagPenalties[1] + flagPenalties[2] + (syncDelta < 0n ? -syncDelta : 0n);

  return {
    output_payload: {
      refused: false,
      base_reward_per_increment_gwei: s(bpi),
      base_reward_gwei: s(baseReward),
      flag_rewards_gwei: flagRewards.map(s),
      flag_penalties_gwei: flagPenalties.map(s),
      proposer_inclusion_reward_gwei: s(proposerInclusion),
      sync_participant_reward_per_slot_gwei: s(partReward),
      sync_participant_delta_gwei: s(syncDelta),
      sync_proposer_share_gwei: s(syncProposer),
      inactivity_score_after: s(scoreAfter),
      inactivity_penalty_gwei: inactivityPenalty,
      initial_slashing_penalty_gwei: s(initialPenalty),
      whistleblower_reward_gwei: s(whistleblower),
      proposer_slashing_reward_gwei: s(proposerCut),
      correlated_penalty_gwei: correlated,
      correlated_penalty_epoch: correlatedEpoch,
      net_epoch_delta_gwei: s(rewards - penalties),
      pending_pin: pending,
      issues: [],
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
