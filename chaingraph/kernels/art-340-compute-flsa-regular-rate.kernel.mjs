import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-340-compute-flsa-regular-rate';
const TOOL_VERSION = '1.0.0';
const CONSTANTS_VERSION = '2025';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_flsa_regular_rate',
  mandate_type: 'compliance_mandate', gpu: false,
};

// FLSA "regular rate" and overtime premium computation per 29 CFR 778,
// Subpart C (778.107-778.122): all remuneration for a workweek, except the
// 778.200/778.208 statutory exclusions, is divided by total hours worked to
// get the regular rate (778.109); nondiscretionary bonuses (778.110,
// 778.208-778.209) must be included, unlike a true discretionary bonus,
// which is excluded entirely. Overtime premium is 0.5x the regular rate for
// each hour over 40 in the workweek (778.107) -- straight-time pay for
// those hours is already counted once in total remuneration, so only the
// extra half is added.
//
// FEDERAL ONLY. NOT TAX ADVICE / NOT WAGE-HOUR LEGAL ADVICE. State
// overtime and daily-overtime rules (which can be more protective than the
// FLSA) are out of scope for v1. Multi-workweek bonus proration (778.209,
// e.g. a quarterly production bonus attributable to 13 workweeks) is the
// CALLER's responsibility: `nondiscretionary_bonus_amount` here is the
// portion of the bonus already allocated to THIS single workweek, not the
// full bonus. This is declared explicitly rather than guessed at.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random, no Intl/.toLocaleString.

const OVERTIME_THRESHOLD_HOURS = 40;
const OVERTIME_MULTIPLIER = 0.5; // "half-time" premium added atop straight-time pay already in total remuneration

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const hoursWorkedWeek = Math.max(0, safeNum(pp.hours_worked_week, 0));
  const hourlyRate = Math.max(0, safeNum(pp.hourly_rate, 0));
  const nondiscretionaryBonusAmount = Math.max(0, safeNum(pp.nondiscretionary_bonus_amount, 0));
  const otherIncludablePay = Math.max(0, safeNum(pp.other_includable_pay, 0));
  const discretionaryBonusExcluded = Math.max(0, safeNum(pp.discretionary_bonus_excluded, 0));

  const compliance_flags = ['FEDERAL_ONLY_NOT_LEGAL_ADVICE'];

  const straightTimePay = r2(hourlyRate * hoursWorkedWeek);
  const totalRemuneration = r2(straightTimePay + nondiscretionaryBonusAmount + otherIncludablePay);

  const zeroHours = hoursWorkedWeek <= 0;
  const regularRate = zeroHours ? 0 : r2(totalRemuneration / hoursWorkedWeek);
  if (zeroHours) compliance_flags.push('FLSA_ZERO_HOURS');

  const overtimeHours = Math.max(0, r2(hoursWorkedWeek - OVERTIME_THRESHOLD_HOURS));
  const overtimePremiumPay = r2(overtimeHours * regularRate * OVERTIME_MULTIPLIER);
  const totalPayDue = r2(totalRemuneration + overtimePremiumPay);

  if (overtimeHours > 0) compliance_flags.push('FLSA_OVERTIME_OWED');
  if (nondiscretionaryBonusAmount > 0) compliance_flags.push('NONDISCRETIONARY_BONUS_INCLUDED');
  if (discretionaryBonusExcluded > 0) compliance_flags.push('DISCRETIONARY_BONUS_EXCLUDED');
  if (!zeroHours && regularRate < hourlyRate && hourlyRate > 0) compliance_flags.push('REGULAR_RATE_BELOW_BASE_RATE_CHECK');

  const output_payload = {
    regular_rate: regularRate,
    straight_time_pay: straightTimePay,
    total_remuneration: totalRemuneration,
    overtime_hours: overtimeHours,
    overtime_premium_pay: overtimePremiumPay,
    total_pay_due: totalPayDue,
    hours_worked_week: hoursWorkedWeek,
    hourly_rate: hourlyRate,
    nondiscretionary_bonus_amount: nondiscretionaryBonusAmount,
    other_includable_pay: otherIncludablePay,
    discretionary_bonus_excluded: discretionaryBonusExcluded,
    constants_version: CONSTANTS_VERSION,
    regulatory_basis: '29 CFR 778, Subpart C (778.107-778.122): regular rate = all non-excludable remuneration / total hours worked (778.109); nondiscretionary bonuses included (778.110, 778.208-778.209); overtime premium = 0.5x regular rate per hour over 40/week (778.107).',
    note: 'Federal FLSA only; not legal advice. State daily/weekly overtime rules (which may be more protective) out of scope. nondiscretionary_bonus_amount must already be the portion allocated to THIS workweek -- multi-week bonus proration (778.209) is the caller\'s responsibility.',
  };

  return { output_payload, compliance_flags };
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
