import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-298-aca-affordability-safe-harbor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_aca_affordability_safe_harbor',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Version-pinned §4980H(a)(1)(B) affordability percentage + FPL default, confirmed against
// IRS Rev. Proc. 2025-25 (2026 affordability percentage) at build time (2026-07-13).
// The rate-of-pay harbor's 130-hour monthly-hours figure is a fixed §4980H regulatory
// constant (Treas. Reg. §1.36B-2(c)(3)(v)(A)(4)), not an annually-indexed table value.
const RATE_OF_PAY_MONTHLY_HOURS = 130;

const PARAMS = {
  '2026': {
    affordability_pct: 0.0996, // Rev. Proc. 2025-25
    fpl_mainland_annual_default: 15650, // 2025 FPL single filer, used by calendar-year 2026 plans (HHS)
    source: 'IRS Rev. Proc. 2025-25 (2026 affordability pct); 2025 HHS FPL guideline (calendar-year 2026 FPL safe harbor)',
  },
};

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function harborVerdict(basisMonthlyMax, premium) {
  if (basisMonthlyMax === null) return { computed: false, monthly_max_employee_contribution: null, affordable: null };
  return { computed: true, monthly_max_employee_contribution: basisMonthlyMax, affordable: premium <= basisMonthlyMax };
}

export function compute(pp) {
  const taxYear = typeof pp.tax_year === 'string' && PARAMS[pp.tax_year] ? pp.tax_year : null;
  const premium = num(pp.lowest_cost_self_only_monthly_premium);

  if (!taxYear || premium === null) {
    return {
      output_payload: {
        tax_year: taxYear,
        affordability_pct: null,
        harbors: { w2: { computed: false, monthly_max_employee_contribution: null, affordable: null }, rate_of_pay: { computed: false, monthly_max_employee_contribution: null, affordable: null }, fpl: { computed: false, monthly_max_employee_contribution: null, affordable: null } },
        satisfies_any_harbor: null,
        harbors_satisfied: [],
        error: !taxYear ? 'unsupported_or_missing_tax_year' : 'missing_lowest_cost_self_only_monthly_premium',
      },
      compliance_flags: ['ACA_AFFORDABILITY_PARAMETER_NOT_SUPPLIED'],
    };
  }

  const { affordability_pct, fpl_mainland_annual_default } = PARAMS[taxYear];
  const w2Wages = num(pp.w2_box1_wages_annual);
  const hourlyRate = num(pp.hourly_rate);
  const fplAnnual = num(pp.fpl_mainland_annual) ?? fpl_mainland_annual_default;

  const w2Max = w2Wages !== null ? (w2Wages * affordability_pct) / 12 : null;
  const rateOfPayMax = hourlyRate !== null ? (hourlyRate * RATE_OF_PAY_MONTHLY_HOURS * affordability_pct) : null;
  const fplMax = (fplAnnual * affordability_pct) / 12;

  const harbors = {
    w2: harborVerdict(w2Max, premium),
    rate_of_pay: harborVerdict(rateOfPayMax, premium),
    fpl: harborVerdict(fplMax, premium),
  };

  const harbors_satisfied = Object.keys(harbors).filter((k) => harbors[k].computed && harbors[k].affordable);
  const anyComputed = Object.keys(harbors).some((k) => harbors[k].computed);
  const satisfies_any_harbor = anyComputed ? harbors_satisfied.length > 0 : null;

  const compliance_flags = ['ACA_AFFORDABILITY_ASSESSED'];
  compliance_flags.push(satisfies_any_harbor ? 'ACA_AFFORDABILITY_SAFE_HARBOR_SATISFIED' : 'ACA_AFFORDABILITY_SAFE_HARBOR_NOT_SATISFIED');

  return {
    output_payload: {
      tax_year: taxYear,
      affordability_pct,
      lowest_cost_self_only_monthly_premium: premium,
      harbors,
      satisfies_any_harbor,
      harbors_satisfied,
      error: null,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
