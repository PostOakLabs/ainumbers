/**
 * art-496-l1-continuous-fee-runway.kernel.mjs
 * Avalanche Evergreen L1 continuous-fee TCO and depletion-runway model.
 *
 * ACP-77 replaced the 2000 AVAX stake / Primary-Network-validation requirement with a continuous,
 * dynamic P-Chain fee drawn from an L1 balance that depletes and needs refills. The fee rate is
 * NEVER baked in: it rises with ecosystem-wide validator count and is always a caller input, with
 * a documented reference point only as the default when none is supplied. Fee growth is a second,
 * separate caller input (an annual percentage), stepped once per 12-month year against the fee
 * rate. Growth is applied by plain multiplication at year boundaries rather than a fractional
 * Math.pow -- transcendental functions are banned from kernels (check-kernel-determinism.mjs):
 * a twelfth-root or exp/log path can diverge in its last bit between a JS host and the zkVM guest,
 * which would move execution_hash non-reproducibly. Annual-step multiplication uses only +,-,*,/,
 * which IEEE754 double arithmetic guarantees bit-identical across any conforming implementation.
 *
 * The novel output is months_to_depletion / depletion_offset_days: an Evergreen L1 whose P-Chain
 * balance empties stops validating, and nobody models that date. TCO alone would just be a cost
 * calculator; the runway projection is the reason this node exists.
 *
 * Simulation is bounded by MAX_HORIZON_MONTHS so a zero-burn input (zero validators, zero fee,
 * zero infra cost) resolves to a defined months_to_depletion of null rather than an unbounded loop
 * or an Infinity leaking into the artifact. Pure decision kernel: no clock, no randomness, no
 * network, no storage, no chain observation. as_of is caller supplied; buildArtifact takes `now`
 * via options for generated_at only.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-496-l1-continuous-fee-runway';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mandate_type: 'compliance_mandate',
  mcp_name:     'model_l1_fee_runway',
  gpu:          false,
};

// ACP-77 launch reference point (~1.33 AVAX/month/validator). Docs-grade, STEP-0 re-verified
// 2026-07-31 against Avalanche's ACP-77 continuous-fee description. NEVER treated as current --
// the live fee rises with ecosystem-wide validator count and callers should supply their own.
const DEFAULT_FEE_RATE_AVAX_PER_VALIDATOR_MONTH = 1.33;
const DEFAULT_TARGET_RUNWAY_MONTHS = 12;
const MAX_HORIZON_MONTHS = 1200; // 100 years -- finite simulation cap, never an unbounded loop

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function nonNeg(v) { const n = num(v); return n === null ? null : Math.max(0, n); }

// I-JSON: an integer beyond 2^53 is emitted as a string rather than a lossy number.
function ijson(v) {
  if (v === null) return null;
  return Number.isSafeInteger(v) ? v : String(v);
}

// Fee rate at each month index up to `months` (0-based), stepped by annualGrowthMultiplier once
// every 12 months via plain multiplication -- never a fractional exponent.
function buildFeeRateSchedule(feeRateMonth0, annualGrowthMultiplier, months) {
  const rates = new Array(months);
  let rate = feeRateMonth0;
  for (let t = 0; t < months; t++) {
    if (t > 0 && t % 12 === 0) rate *= annualGrowthMultiplier;
    rates[t] = rate;
  }
  return rates;
}

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = ['L1_RUNWAY_MODELED'];
  const rationale = [];

  const validator_count = nonNeg(pp.validator_count) ?? 0;
  if (nonNeg(pp.validator_count) === null) {
    rationale.push('No validator_count was supplied, so 0 was assumed -- the continuous-fee component of the burn is zero at that assumption.');
  }

  let fee_rate_defaulted = false;
  let fee_rate_avax_per_validator_month = nonNeg(pp.fee_rate_avax_per_validator_month);
  if (fee_rate_avax_per_validator_month === null) {
    fee_rate_avax_per_validator_month = DEFAULT_FEE_RATE_AVAX_PER_VALIDATOR_MONTH;
    fee_rate_defaulted = true;
    compliance_flags.push('FEE_RATE_DEFAULTED');
    rationale.push('No fee_rate_avax_per_validator_month was supplied, so the ' + DEFAULT_FEE_RATE_AVAX_PER_VALIDATOR_MONTH + ' AVAX/month ACP-77 launch reference point was assumed. The live continuous fee rises with ecosystem-wide validator count; supply a current figure to remove this assumption.');
  }

  const fee_growth_rate_annual_pct = nonNeg(pp.fee_growth_rate_annual_pct) ?? 0;
  const annual_growth_multiplier = 1 + fee_growth_rate_annual_pct / 100;

  const infra_cost_annual = nonNeg(pp.infra_cost_annual) ?? 0;
  const infra_cost_month0 = infra_cost_annual / 12;

  const current_balance = nonNeg(pp.current_balance) ?? 0;
  const as_of = num(pp.as_of) ?? 0;

  let target_runway_months = nonNeg(pp.target_runway_months);
  if (target_runway_months === null) {
    target_runway_months = DEFAULT_TARGET_RUNWAY_MONTHS;
    rationale.push('No target_runway_months was supplied, so a ' + DEFAULT_TARGET_RUNWAY_MONTHS + ' month target runway was assumed for the refill calculation.');
  }
  target_runway_months = Math.min(target_runway_months, MAX_HORIZON_MONTHS);

  const suppliedHorizon = nonNeg(pp.horizon_months);
  const horizon_months = Math.min(suppliedHorizon === null ? MAX_HORIZON_MONTHS : suppliedHorizon, MAX_HORIZON_MONTHS);

  const schedule_months = Math.max(horizon_months, target_runway_months);
  const fee_rate_schedule = buildFeeRateSchedule(fee_rate_avax_per_validator_month, annual_growth_multiplier, schedule_months);

  // Annual TCO at the caller's as_of point, for the headline figure and its breakdown.
  const fee_component_annual = validator_count * fee_rate_avax_per_validator_month * 12;
  const annual_tco = fee_component_annual + infra_cost_annual;
  const has_positive_burn = fee_component_annual > 0 || infra_cost_annual > 0;

  let months_to_depletion = null;
  let depletion_offset_days = null;
  let balance_exhausted_at_as_of = false;

  if (current_balance <= 0 && has_positive_burn) {
    balance_exhausted_at_as_of = true;
    months_to_depletion = 0;
    depletion_offset_days = 0;
    compliance_flags.push('L1_BALANCE_EXHAUSTED');
    compliance_flags.push('ESCALATION_RAISED');
    rationale.push('current_balance is already at or below zero while the modeled monthly burn is positive, so the L1 has already stopped validating under this model.');
  } else {
    let balance = current_balance;
    let depleted = false;
    for (let t = 0; t < horizon_months; t++) {
      const cost = validator_count * fee_rate_schedule[t] + infra_cost_month0;
      if (cost <= 0) continue; // zero burn this month -- balance unchanged, loop still terminates at horizon_months
      balance -= cost;
      if (balance <= 0) {
        months_to_depletion = t + 1;
        depletion_offset_days = Math.round(months_to_depletion * 30.4375);
        depleted = true;
        break;
      }
    }
    if (!depleted) {
      rationale.push('Balance did not deplete within the ' + horizon_months + ' month model horizon under these inputs, so months_to_depletion is reported as null rather than an unbounded projection.');
    }
  }

  let runway_flag;
  if (balance_exhausted_at_as_of) {
    runway_flag = 'L1_BALANCE_EXHAUSTED';
  } else if (months_to_depletion !== null && months_to_depletion < target_runway_months) {
    runway_flag = 'L1_RUNWAY_SHORT';
    compliance_flags.push('L1_RUNWAY_SHORT');
    compliance_flags.push('ESCALATION_RAISED');
    rationale.push('months_to_depletion (' + months_to_depletion + ') is short of the ' + target_runway_months + ' month target runway.');
  } else {
    runway_flag = 'L1_RUNWAY_OK';
    compliance_flags.push('L1_RUNWAY_OK');
  }

  // Refill required to reach the caller-supplied target runway: cost of exactly target_runway_months
  // of simulated burn from as_of, less what is already on hand, floored at zero.
  let cost_to_target_runway = 0;
  for (let t = 0; t < target_runway_months; t++) {
    cost_to_target_runway += validator_count * fee_rate_schedule[t] + infra_cost_month0;
  }
  const refill_amount_required = Math.max(0, cost_to_target_runway - current_balance);

  return {
    output_payload: {
      validator_count: ijson(validator_count),
      fee_rate_avax_per_validator_month,
      fee_rate_defaulted,
      fee_growth_rate_annual_pct,
      infra_cost_annual,
      current_balance,
      as_of: ijson(as_of),
      annual_tco,
      breakdown: {
        fee_component_annual,
        infra_component_annual: infra_cost_annual,
      },
      months_to_depletion: months_to_depletion === null ? null : ijson(months_to_depletion),
      depletion_offset_days: depletion_offset_days === null ? null : ijson(depletion_offset_days),
      target_runway_months: ijson(target_runway_months),
      refill_amount_required,
      horizon_months: ijson(horizon_months),
      runway_flag,
      rationale,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
