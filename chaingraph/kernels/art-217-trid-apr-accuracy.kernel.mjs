import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-217-trid-apr-accuracy';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_trid_apr_accuracy',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Reg Z §1026.22(a) APR accuracy tolerance.
// Regular transactions: disclosed APR must be within 1/8 of 1% (0.125%) of actual APR.
// Irregular transactions: within 1/4 of 1% (0.25%) of actual APR.
//
// Overstatement (disclosed > actual) is within tolerance UP TO the applicable threshold.
// Understatement (disclosed < actual - threshold) is a violation.
// Both are capped at the same absolute threshold for the overstatement-tolerance asymmetry note.
//
// Irregular transaction definition per §1026.22(a)(3): multiple advances, irregular payment
// periods, or irregular payment amounts (any non-conforming payment schedule).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// Classify irregularity: determines which tolerance (1/8 or 1/4) to use.
function classifyIrregularity(pp) {
  const reasons = [];
  if (safeNum(pp.num_advances, 1) > 1) reasons.push('multiple_advances');
  if (pp.irregular_payment_periods === true) reasons.push('irregular_payment_periods');
  if (pp.irregular_payment_amounts === true) reasons.push('irregular_payment_amounts');
  if (pp.has_demand_feature === true) reasons.push('demand_feature');
  const irregular = reasons.length > 0;
  return { irregular, irregularity_reasons: reasons };
}

export function compute(pp) {
  pp = pp || {};

  const disclosed_apr = safeNum(pp.disclosed_apr_pct, 0);
  const actual_apr = safeNum(pp.actual_apr_pct, 0);

  if (!Number.isFinite(disclosed_apr) || !Number.isFinite(actual_apr)) {
    return {
      output_payload: { verdict: 'error', error: 'non_finite_apr_input' },
      compliance_flags: ['APR_INPUT_ERROR'],
    };
  }

  const { irregular, irregularity_reasons } = classifyIrregularity(pp);
  const tolerance_pct = irregular ? 0.25 : 0.125;

  const difference = r4(disclosed_apr - actual_apr); // positive = overstated
  const abs_diff = Math.abs(difference);
  const within_tolerance = r4(abs_diff) <= tolerance_pct + 1e-6; // floating-point margin

  // Verdict logic per §1026.22(a):
  //   |disclosed - actual| <= tolerance → accurate
  //   disclosed > actual (overstated) and within tolerance → accurate (overstatement OK up to threshold)
  //   disclosed > actual + tolerance (overstated > threshold) → overstated_violation
  //   disclosed < actual - tolerance (understated) → understated_violation
  let verdict;
  if (within_tolerance) {
    verdict = difference >= 0 ? 'accurate_overstated_ok' : 'accurate';
  } else if (difference > 0) {
    verdict = 'overstated_violation'; // overstated beyond tolerance
  } else {
    verdict = 'understated_violation'; // TILA violation
  }

  const compliance_flags = [];
  if (verdict === 'understated_violation') compliance_flags.push('TRID_APR_UNDERSTATED_VIOLATION');
  if (verdict === 'overstated_violation') compliance_flags.push('TRID_APR_OVERSTATED_VIOLATION');

  const output_payload = {
    verdict,
    disclosed_apr_pct: r4(disclosed_apr),
    actual_apr_pct: r4(actual_apr),
    difference_pct: difference, // disclosed minus actual; positive = overstated
    abs_difference_pct: r4(abs_diff),
    tolerance_pct,
    within_tolerance,
    is_irregular_transaction: irregular,
    irregularity_reasons,
    headroom_pct: r4(tolerance_pct - abs_diff), // positive = room remaining; negative = over
    regulatory_basis: 'Reg Z §1026.22(a), 12 CFR 1026.22 APR accuracy tolerance',
    note: '1/8 pp tolerance for regular transactions; 1/4 pp for irregular (multiple advances, irregular periods, or irregular amounts). Overstatement within tolerance is not a TILA violation; understatement is.',
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
