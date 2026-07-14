import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-299-aca-esrp-exposure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_esrp_exposure',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Version-pinned §4980H(a)/(b) annual per-employee penalty amounts, confirmed against
// IRS Rev. Proc. 2025-26 at build time (2026-07-13). The 95% offer-rate threshold and the
// first-30-full-time-employees exclusion are fixed §4980H(a) statutory constants (ACA
// §1513, unchanged since 2015), not annually-indexed table values.
const OFFER_RATE_THRESHOLD = 0.95;
const A_EXCLUSION_COUNT = 30;

const PARAMS = {
  '2026': {
    a_annual_per_employee: 3340, // §4980H(a), Rev. Proc. 2025-26
    b_annual_per_employee: 5010, // §4980H(b), Rev. Proc. 2025-26
    source: 'IRS Rev. Proc. 2025-26',
  },
};

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function intCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

export function compute(pp) {
  const taxYear = typeof pp.tax_year === 'string' && PARAMS[pp.tax_year] ? pp.tax_year : null;
  const fulltimeCount = intCount(pp.fulltime_count);
  const offeredMecCount = intCount(pp.offered_mec_count);
  const ptcEmployeeCount = intCount(pp.ptc_employee_count);

  if (!taxYear || fulltimeCount === null || offeredMecCount === null || ptcEmployeeCount === null) {
    return {
      output_payload: {
        tax_year: taxYear,
        coverage_offer_rate: null,
        a_applicable: null,
        b_applicable: null,
        controlling_penalty: null,
        a_exposure_annual: null,
        b_exposure_annual: null,
        a_monthly_per_employee: null,
        b_monthly_per_employee: null,
        error: !taxYear ? 'unsupported_or_missing_tax_year' : 'missing_required_count_parameter',
      },
      compliance_flags: ['ACA_ESRP_PARAMETER_NOT_SUPPLIED'],
    };
  }

  const { a_annual_per_employee, b_annual_per_employee } = PARAMS[taxYear];
  const coverage_offer_rate = fulltimeCount > 0 ? offeredMecCount / fulltimeCount : null;
  const a_applicable = coverage_offer_rate !== null && coverage_offer_rate < OFFER_RATE_THRESHOLD;

  const a_exposure_annual = a_applicable ? Math.max(0, fulltimeCount - A_EXCLUSION_COUNT) * a_annual_per_employee : 0;
  const b_exposure_annual = ptcEmployeeCount * b_annual_per_employee;

  let controlling_penalty = 'none';
  if (a_applicable) controlling_penalty = 'a';
  else if (ptcEmployeeCount > 0) controlling_penalty = 'b';

  const controlling_exposure_annual = controlling_penalty === 'a' ? a_exposure_annual : controlling_penalty === 'b' ? b_exposure_annual : 0;

  const compliance_flags = ['ACA_ESRP_EXPOSURE_ASSESSED'];
  compliance_flags.push(controlling_penalty === 'none' ? 'ACA_ESRP_NO_EXPOSURE' : 'ACA_ESRP_EXPOSURE_' + controlling_penalty.toUpperCase() + '_CONTROLLING');

  return {
    output_payload: {
      tax_year: taxYear,
      coverage_offer_rate,
      offer_rate_threshold: OFFER_RATE_THRESHOLD,
      a_applicable,
      b_applicable: !a_applicable && ptcEmployeeCount > 0,
      controlling_penalty,
      a_exposure_annual,
      b_exposure_annual,
      controlling_exposure_annual,
      a_monthly_per_employee: a_annual_per_employee / 12,
      b_monthly_per_employee: b_annual_per_employee / 12,
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
