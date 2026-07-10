import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-283-pension-lump-sum-vs-annuity-decision-engine';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_pension_lump_sum_annuity',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Defined-benefit pension lump-sum-vs-annuity decumulation decision support. All
// figures USER-SUPPLIED off the claimant's own pension election paperwork -- no PII
// stored, no plan-administrator API. Computes: present value of the single-life
// annuity stream over the stated life-expectancy horizon (portable +-*'/ compounding
// loop only, no engine transcendentals); an optional flat COLA growth applied to the
// annual payment (labeled assumption, user-overridable, NOT a guaranteed plan term);
// the survivor-option monthly cost (single-life minus joint-survivor payment); the
// break-even discount rate at which the annuity PV equals the lump-sum offer (fixed
// 60-iteration bisection, deterministic and reproducible regardless of engine); and
// the undiscounted break-even age. Recommendation compares annuityPV at the supplied
// personal discount rate against the lump-sum offer. Pure arithmetic, NaN-safe, zero
// network, zero PII.
const DEFAULT_COLA_PCT = 2; // labeled assumption: average pension/SS-style COLA, NOT a guaranteed plan term

function pvOfAnnuity(annualAmount, years, discountRatePct, colaPct) {
  const r = discountRatePct / 100;
  const g = colaPct / 100;
  let pv = 0;
  let payment = annualAmount;
  let discountFactor = 1;
  for (let t = 0; t < years; t++) {
    pv += payment / discountFactor;
    discountFactor *= (1 + r);
    payment *= (1 + g);
  }
  return pv;
}

function findBreakEvenRate(annualAmount, years, colaPct, lumpSum) {
  let lo = -0.5, hi = 1.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pv = pvOfAnnuity(annualAmount, years, mid * 100, colaPct);
    if (pv > lumpSum) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2 * 100;
}

export function compute(pp) {
  const { election = {} } = pp;
  const g = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const b = (v) => v === true;

  const lumpSum = g(election.lumpSum, 0);
  const monthlyAnnuitySingleLife = g(election.monthlyAnnuitySingleLife, 0);
  const monthlyAnnuityJointSurvivor = g(election.monthlyAnnuityJointSurvivor, monthlyAnnuitySingleLife);
  const currentAge = g(election.currentAge, 65);
  const lifeExpectancy = Math.max(currentAge + 1, g(election.lifeExpectancy, 85));
  const discountRatePct = g(election.discountRatePct, 5);
  const survivorPct = [50, 75, 100].includes(Number(election.survivorPct)) ? Number(election.survivorPct) : 50;
  const colaToggle = b(election.colaToggle);
  const colaPct = colaToggle ? DEFAULT_COLA_PCT : 0;

  const years = lifeExpectancy - currentAge;
  const annualSingleLife = monthlyAnnuitySingleLife * 12;
  const annuityPV = pvOfAnnuity(annualSingleLife, years, discountRatePct, colaPct);

  const breakEvenRate = findBreakEvenRate(annualSingleLife, years, colaPct, lumpSum);

  let breakEvenAge = null;
  for (let age = currentAge; age <= currentAge + 60; age++) {
    const cumulative = annualSingleLife * (age - currentAge);
    if (cumulative >= lumpSum) { breakEvenAge = age; break; }
  }

  const survivorOptionCostMonthly = monthlyAnnuitySingleLife - monthlyAnnuityJointSurvivor;
  const recommendation = annuityPV > lumpSum ? 'annuity' : 'lump_sum';

  const compliance_flags = ['PENSION_DECUMULATION_MODELED'];
  if (colaToggle) compliance_flags.push('PENSION_COLA_ASSUMPTION_APPLIED');
  if (recommendation === 'lump_sum') compliance_flags.push('PENSION_LUMP_SUM_FAVORED_AT_STATED_RATE');

  return {
    output_payload: {
      lumpSum,
      annuityPV,
      breakEvenRate,
      breakEvenAge,
      recommendation,
      survivorOptionCostMonthly,
      survivorPct,
      colaApplied: colaToggle,
      reinvestmentRequiredReturn: breakEvenRate,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
