import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-301-section125-ndt';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_section125_ndt',
  mandate_type: 'compliance_mandate', gpu: false,
};

// The eligibility-ratio and contributions-and-benefits thresholds below follow the commonly
// applied §410(b)-style ratio-percentage analogy for §125 cafeteria-plan nondiscrimination
// testing. The IRS proposed regulations under §125(g)(3) (REG-142695-05, 2007) have never
// been finalized; plan sponsors rely on a reasonable, good-faith interpretation pending final
// rules. DRAFT — this threshold pair is a practitioner-consensus figure, not a citable final
// regulatory text; re-verify against any future IRS final rule.
const ELIGIBILITY_RATIO_THRESHOLD = 0.70; // DRAFT — no finalized §125(g)(3) regs
const BENEFITS_RATIO_THRESHOLD = 1.0; // DRAFT — same basis

// Key-employee concentration limit is a fixed statutory constant, IRC §125(b)(2) — not
// annually indexed, no DRAFT-PIN needed.
const KEY_CONCENTRATION_LIMIT = 0.25;

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function posNum(v) {
  const n = num(v);
  return n !== null && n >= 0 ? n : null;
}

export function compute(pp) {
  const nhceEligible = posNum(pp.nhce_eligible_count);
  const nhceTotal = posNum(pp.nhce_total_count);
  const hceEligible = posNum(pp.hce_eligible_count);
  const hceTotal = posNum(pp.hce_total_count);
  const nhceBenefitPct = num(pp.nhce_avg_benefit_pct);
  const hceBenefitPct = num(pp.hce_avg_benefit_pct);
  const keyElected = posNum(pp.key_employee_elected_total);
  const totalElected = posNum(pp.total_elected_all_participants);

  const missing =
    nhceEligible === null || nhceTotal === null || hceEligible === null || hceTotal === null ||
    nhceBenefitPct === null || hceBenefitPct === null || keyElected === null || totalElected === null ||
    nhceTotal === 0 || hceTotal === 0 || totalElected === 0;

  if (missing) {
    return {
      output_payload: {
        eligibility: { nhce_eligibility_rate: null, hce_eligibility_rate: null, ratio: null, threshold: ELIGIBILITY_RATIO_THRESHOLD, pass: null },
        benefits: { nhce_avg_benefit_pct: null, hce_avg_benefit_pct: null, ratio: null, threshold: BENEFITS_RATIO_THRESHOLD, pass: null },
        concentration: { concentration_ratio: null, limit: KEY_CONCENTRATION_LIMIT, pass: null },
        all_tests_pass: null,
        error: 'missing_required_count_parameter',
      },
      compliance_flags: ['ACA_S125_NDT_PARAMETER_NOT_SUPPLIED'],
    };
  }

  const nhce_eligibility_rate = nhceEligible / nhceTotal;
  const hce_eligibility_rate = hceEligible / hceTotal;
  const eligibility_ratio = hce_eligibility_rate > 0 ? nhce_eligibility_rate / hce_eligibility_rate : null;
  const eligibility_pass = eligibility_ratio !== null ? eligibility_ratio >= ELIGIBILITY_RATIO_THRESHOLD : null;

  const benefits_ratio = hceBenefitPct > 0 ? nhceBenefitPct / hceBenefitPct : null;
  const benefits_pass = benefits_ratio !== null ? benefits_ratio >= BENEFITS_RATIO_THRESHOLD : null;

  const concentration_ratio = keyElected / totalElected;
  const concentration_pass = concentration_ratio <= KEY_CONCENTRATION_LIMIT;

  const all_tests_pass = eligibility_pass === true && benefits_pass === true && concentration_pass === true;

  const compliance_flags = ['ACA_S125_NDT_ASSESSED'];
  compliance_flags.push(eligibility_pass ? 'ACA_S125_ELIGIBILITY_PASS' : 'ACA_S125_ELIGIBILITY_FAIL');
  compliance_flags.push(benefits_pass ? 'ACA_S125_BENEFITS_PASS' : 'ACA_S125_BENEFITS_FAIL');
  compliance_flags.push(concentration_pass ? 'ACA_S125_CONCENTRATION_PASS' : 'ACA_S125_CONCENTRATION_FAIL');

  return {
    output_payload: {
      eligibility: { nhce_eligibility_rate, hce_eligibility_rate, ratio: eligibility_ratio, threshold: ELIGIBILITY_RATIO_THRESHOLD, pass: eligibility_pass },
      benefits: { nhce_avg_benefit_pct: nhceBenefitPct, hce_avg_benefit_pct: hceBenefitPct, ratio: benefits_ratio, threshold: BENEFITS_RATIO_THRESHOLD, pass: benefits_pass },
      concentration: { concentration_ratio, limit: KEY_CONCENTRATION_LIMIT, pass: concentration_pass },
      all_tests_pass,
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
