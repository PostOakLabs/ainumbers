import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-617-m3p-monthly-cap-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_m3p_monthly_cap',
  mandate_type: 'payment_policy', gpu: false,
};

// Medicare Prescription Payment Plan (M3P) maximum monthly cap, 42 CFR 423.137(c)(1)(i)
// (first month of participation) and (c)(1)(ii) (every subsequent month). Source text and
// digests: research/M3P-CAP-BUILD-1-SPEC.md. Both formulas reduce to one rounding-sensitive
// step once the fixed policy parameter is stripped out (build spec section 3):
//   first month:       numerator_cents = annual_oop_threshold_cents - incurred_TrOOP_cents
//   subsequent month:  numerator_cents = remaining_owed_cents + newly_incurred_cents
//   cap_cents = round_half_up_cents(numerator_cents / months_remaining)               (c)(3)
// "months_remaining" includes the current month (c)(3). The annual out-of-pocket threshold
// is a PLAN-YEAR-INDEXED figure CMS republishes each year -- never a bare literal here, always
// looked up from PLAN_YEAR_PARAMS below by policy_parameters.plan_year, with its own source
// digest carried into the output for provenance. A future plan year adds a new keyed entry;
// existing entries are never overwritten (build spec section 1).
//
// ROUNDING: 42 CFR 423.137 states no explicit rounding rule for the division step (confirmed
// by direct read of the retrieved clause text). Per the build spec's oracle discipline this is
// "declared -- clause silent": three independent CMS-sourced worked examples (423.137(b)(2):
// 2000/12=166.67; CMS Final Part Two Guidance section 50.2: 2000/3=666.67; 2000/11=181.82) are
// each consistent with round-half-up-to-the-cent and with no other tested mode, so that is the
// declared behavior here. Implemented with EXACT INTEGER arithmetic (floor + remainder compare),
// never floating-point division -- every quantity in this kernel is already integer cents, so
// there is no IEEE-754 boundary to be unsound about; the enumeration harness confirms this over
// the full declared domain rather than assuming it.
//
// DOMAIN (build spec section 3, derived not assumed): a legitimate in-domain participant's
// incurred out-of-pocket cost cannot exceed the annual threshold (423.137(a)/(c)(4) -- past the
// threshold the enrollee owes $0 further cost sharing), so numerator_cents in [0,
// annual_oop_threshold_cents] by construction in both branches, and months_remaining is 1..12
// for the first-month branch ((c)(1)(i)(B): electing before the plan year starts uses the first
// active month) and 1..11 for the subsequent-month branch (it can only ever follow a first
// month, so it never occurs in month 1 of the plan year). Inputs outside these ranges are a
// real UI possibility (a mistyped amount) and are REJECTED here, never clamped or silently
// coerced -- valid_input:false, no cap computed, and the specific violated bound named, so the
// declared domain the enumeration totality claim covers is exactly what compute() accepts.
//
// Verify-only: recomputes the CMS formula from caller-declared inputs. It does not track a real
// enrollee's true out-of-pocket accumulation, does not decide plan enrollment, and does not
// assert that any actual M3P participant's bill is correct -- estimate only, not an official CMS
// or plan communication.

const PLAN_YEAR_PARAMS = {
  2026: {
    annual_oop_threshold_cents: 210000,
    source: 'CMS Final CY 2026 Part D Redesign Program Instructions fact sheet',
    source_digest: 'sha256:6eb8797d77cf892afb41f9fb5be0889ccc7504e770f323f7295c66f3ee49ac2d',
  },
};
const DEFAULT_PLAN_YEAR = 2026;

function isInt(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v); }

// round_half_up_cents(numerator, months) via exact integer floor + remainder compare --
// equivalent to round(numerator/months) for non-negative numerator/months but with no
// floating-point division anywhere in the decision.
function roundHalfUpCents(numeratorCents, monthsRemaining) {
  const q = Math.floor(numeratorCents / monthsRemaining);
  const r = numeratorCents - q * monthsRemaining;
  return (2 * r >= monthsRemaining) ? q + 1 : q;
}

export function compute(pp) {
  pp = pp || {};
  const errors = [];

  const planYear = (pp.plan_year === undefined || pp.plan_year === null) ? DEFAULT_PLAN_YEAR : pp.plan_year;
  const planParams = PLAN_YEAR_PARAMS[planYear];
  if (!planParams) errors.push(`plan_year ${JSON.stringify(planYear)} has no declared annual_oop_threshold_cents entry`);

  const branch = pp.branch;
  if (branch !== 'first_month' && branch !== 'subsequent_month') {
    errors.push('branch must be exactly "first_month" or "subsequent_month"');
  }

  const threshold = planParams ? planParams.annual_oop_threshold_cents : null;
  let numeratorCents = null;
  let numeratorBreakdown = null;

  if (planParams && branch === 'first_month') {
    const incurred = pp.incurred_TrOOP_cents;
    if (!isInt(incurred) || incurred < 0 || incurred > threshold) {
      errors.push(`incurred_TrOOP_cents must be an integer in [0, ${threshold}] (42 CFR 423.137(c)(1)(i))`);
    } else {
      numeratorCents = threshold - incurred;
      numeratorBreakdown = { incurred_TrOOP_cents: incurred, annual_oop_threshold_cents: threshold };
    }
  } else if (planParams && branch === 'subsequent_month') {
    const remaining = pp.remaining_owed_cents;
    const newly = pp.newly_incurred_cents;
    if (!isInt(remaining) || remaining < 0 || remaining > threshold) {
      errors.push(`remaining_owed_cents must be an integer in [0, ${threshold}]`);
    } else if (!isInt(newly) || newly < 0 || newly > threshold) {
      errors.push(`newly_incurred_cents must be an integer in [0, ${threshold}]`);
    } else if (remaining + newly > threshold) {
      errors.push(`remaining_owed_cents + newly_incurred_cents (${remaining + newly}) exceeds the annual threshold (${threshold}) -- every dollar counted in either counts once against the same annual threshold (42 CFR 423.137(c)(4))`);
    } else {
      numeratorCents = remaining + newly;
      numeratorBreakdown = { remaining_owed_cents: remaining, newly_incurred_cents: newly };
    }
  }

  const monthsMax = branch === 'first_month' ? 12 : (branch === 'subsequent_month' ? 11 : null);
  const monthsRemaining = pp.months_remaining;
  if (monthsMax !== null) {
    if (!isInt(monthsRemaining) || monthsRemaining < 1 || monthsRemaining > monthsMax) {
      errors.push(`months_remaining must be an integer in [1, ${monthsMax}] for branch "${branch}" (42 CFR 423.137(c)(3))`);
    }
  } else if (monthsRemaining !== undefined) {
    // branch itself invalid -- months_remaining bound cannot be stated, but still require an integer if present
    if (!isInt(monthsRemaining) || monthsRemaining < 1) errors.push('months_remaining must be a positive integer');
  }

  const validInput = errors.length === 0 && numeratorCents !== null && isInt(monthsRemaining) && monthsRemaining >= 1 && monthsRemaining <= monthsMax;

  let capCents = null;
  if (validInput) capCents = roundHalfUpCents(numeratorCents, monthsRemaining);

  const compliance_flags = [];
  if (validInput) compliance_flags.push('M3P_MONTHLY_CAP_COMPUTED');
  else compliance_flags.push('M3P_INPUT_OUT_OF_DECLARED_DOMAIN');

  const output_payload = {
    plan_year: planYear,
    branch: (branch === 'first_month' || branch === 'subsequent_month') ? branch : null,
    valid_input: validInput,
    domain_errors: errors,
    annual_oop_threshold_cents: threshold,
    annual_oop_threshold_source: planParams ? planParams.source : null,
    annual_oop_threshold_source_digest: planParams ? planParams.source_digest : null,
    numerator_cents: numeratorCents,
    numerator_breakdown: numeratorBreakdown,
    months_remaining: isInt(monthsRemaining) ? monthsRemaining : null,
    cap_cents: capCents,
    cap_dollars_display: capCents === null ? null : (capCents / 100).toFixed(2),
    rounding_mode: 'half_up',
    rounding_precision: 'cents',
    rounding_oracle: 'declared -- clause silent; 42 CFR 423.137 states no explicit rounding rule for the division step. Three independent CMS-sourced worked examples (423.137(b)(2): 2000/12=166.67; CMS Final Part Two Guidance section 50.2: 2000/3=666.67, 2000/11=181.82) are each consistent with round-half-up-to-the-cent and no other tested mode.',
    regulatory_basis: '42 CFR 423.137(a) general; (b)(1)-(2) definitions; (c)(1)(i) first-month formula; (c)(1)(ii) subsequent-month formula; (c)(3) months-remaining includes the current month; (c)(4) impact on true out-of-pocket accumulation.',
    note: 'Verify-only recomputation of the CMS Medicare Prescription Payment Plan monthly cap formula from caller-declared inputs. It does not track a real enrollee\'s true out-of-pocket accumulation, does not enroll anyone in M3P, and does not assert that any actual participant\'s bill is correct. Estimate only -- not an official CMS or plan communication, and not financial or legal advice.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
