import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-282-social-security-claiming-optimizer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'optimize_social_security_claim_age',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Social Security claiming-age decision support (Social Security Act Sec.202/216(l);
// 20 CFR 404.409-410). Inputs are USER-SUPPLIED off the claimant's own SSA statement --
// no SSA API, no PII stored. Computes: Full Retirement Age (FRA) by birth year;
// early-claim reduction (5/9 of 1% per month for the first 36 months before FRA, 5/12
// of 1% per month beyond that -- Sec.202(q)); delayed retirement credit (2/3 of 1% per
// month, i.e. 8%/year, for months worked past FRA up to age 70 -- Sec.202(w));
// earnings-test withholding below FRA (labeled-snapshot annual exempt amount,
// $1-for-$2 withholding above it -- Sec.203(f)); lifetime present value at 62, FRA, 70,
// and the user's chosen claim age (annuity-style PV loop, portable +-*'/ only, no
// engine transcendentals); and the 62-vs-70 undiscounted break-even age. Pure
// arithmetic, NaN-safe, zero network, zero PII (no SSN/name ever accepted).
const SS_EARNINGS_TEST_ANNUAL_LIMIT_2026 = 23400; // labeled snapshot, user-overridable -- re-verify annually

function fraYears(birthYear) {
  const y = Number.isFinite(Number(birthYear)) ? Number(birthYear) : 1960;
  if (y <= 1937) return 65;
  if (y >= 1943 && y <= 1954) return 66;
  if (y >= 1960) return 67;
  if (y >= 1955 && y <= 1959) {
    // FRA rises 2 months per birth year from 66 (1954) to 67 (1960)
    return 66 + (y - 1954) * (2 / 12);
  }
  // 1938-1942: FRA rises 2 months per birth year from 65 to 66
  return 65 + (y - 1937) * (2 / 12);
}

function monthlyFactor(claimAgeYears, fraYearsVal) {
  const claimMonths = Math.round(claimAgeYears * 12);
  const fraMonths = Math.round(fraYearsVal * 12);
  const diff = claimMonths - fraMonths;
  if (diff === 0) return 1;
  if (diff < 0) {
    const early = -diff;
    const first36 = early < 36 ? early : 36;
    const rest = early > 36 ? early - 36 : 0;
    const reduction = first36 * (5 / 9 / 100) + rest * (5 / 12 / 100);
    return 1 - reduction;
  }
  const delayedMonths = diff;
  return 1 + delayedMonths * (2 / 3 / 100);
}

function pvOfAnnuity(annualAmount, years, discountRatePct) {
  const r = discountRatePct / 100;
  let pv = 0;
  let discountFactor = 1;
  for (let t = 0; t < years; t++) {
    pv += annualAmount / discountFactor;
    discountFactor *= (1 + r);
  }
  return pv;
}

export function compute(pp) {
  const { claimant = {} } = pp;
  const g = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

  const birthYear = g(claimant.birthYear, 1960);
  const pia = g(claimant.pia, 0);
  const claimAge = Math.min(70, Math.max(62, g(claimant.claimAge, 67)));
  const earningsIfWorking = g(claimant.earningsIfWorking, 0);
  const discountRatePct = g(claimant.discountRatePct, 3);
  const longevityAge = Math.min(110, Math.max(claimAge + 1, g(claimant.longevityAge, 85)));

  const fra = fraYears(birthYear);

  const candidateAges = [62, fra, 70, claimAge];
  const candidates = candidateAges.map((age) => {
    const factor = monthlyFactor(age, fra);
    const monthlyBenefit = pia * factor;
    const years = Math.max(0, longevityAge - age);
    const withheld = age < fra
      ? Math.min(monthlyBenefit * 12, Math.max(0, earningsIfWorking - SS_EARNINGS_TEST_ANNUAL_LIMIT_2026) / 2)
      : 0;
    const annualNet = monthlyBenefit * 12 - withheld;
    const lifetimePV = pvOfAnnuity(annualNet, years, discountRatePct);
    return { age, monthlyBenefit, annualNet, lifetimePV };
  });

  let best = candidates[0];
  for (const c of candidates) if (c.lifetimePV > best.lifetimePV) best = c;
  const recommendedClaimAge = best.age;

  const c62 = candidates[0], c70 = candidates[2];
  let breakEvenAge = null;
  for (let age = 70; age <= 100; age++) {
    const cum62 = c62.annualNet * Math.max(0, age - 62);
    const cum70 = c70.annualNet * Math.max(0, age - 70);
    if (cum70 >= cum62) { breakEvenAge = age; break; }
  }

  const userChoice = candidates[3];
  const compliance_flags = ['SS_CLAIMING_AGE_MODELED'];
  if (userChoice.age < fra && earningsIfWorking > SS_EARNINGS_TEST_ANNUAL_LIMIT_2026) compliance_flags.push('SS_EARNINGS_TEST_WITHHOLDING_APPLIES');
  if (recommendedClaimAge !== userChoice.age) compliance_flags.push('SS_ALTERNATE_CLAIM_AGE_HAS_HIGHER_PV');

  return {
    output_payload: {
      birthYear,
      fullRetirementAge: fra,
      pia,
      claimAge: userChoice.age,
      monthlyBenefitAtClaimAge: userChoice.monthlyBenefit,
      recommendedClaimAge,
      lifetimePV: userChoice.lifetimePV,
      breakEvenAge62vs70: breakEvenAge,
      earningsTestAnnualLimit: SS_EARNINGS_TEST_ANNUAL_LIMIT_2026,
      longevityAge,
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
