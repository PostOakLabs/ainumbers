import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-478-analyze-dc-vs-lc-cost-benefit';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'analyze_dc_vs_lc_cost_benefit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Documentary Collection (D/P, D/A) vs Letter of Credit (Sight/Usance/Confirmed/SBLC) total-cost and
// risk-adjusted cost comparison. Provable node counterpart to tools/423-dc-vs-lc-analyzer.html's
// `runAnalyzer()` fee/break-even math -- ported verbatim so tool<->kernel parity is exact.
//
// Deterministic by construction: no wall clock, no Math.random(). All fee/risk/break-even arithmetic
// is pure ECMA-262 number math on caller-supplied policy_parameters. The one non-arithmetic figure,
// `lc_protection_score`, is an explicitly-labelled HEURISTIC additive rubric (0-100), never presented
// as a computed fact -- see `heuristic: true` on that field and `output_payload.heuristic_note`.
// This kernel does NOT decide UCP 600 Art.14 strict-compliance document examination -- that judgement
// is deliberately uncovered estate-wide (false-precision trap); this tool only compares LC vs DC
// instrument economics, never document conformance.

function num(v, dflt) { var n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : (dflt || 0); }
function str(v) { return typeof v === 'string' ? v : ''; }

export function compute(pp) {
  pp = pp || {};

  var invoice = num(pp.invoiceValueUSD, 0);
  var sellerR = str(pp.sellerCountryRisk) || 'medium';
  var buyerR = str(pp.buyerCountryRisk) || 'medium';
  var buyerRel = str(pp.buyerRelationship) || 'lt2';
  var payDays = num(pp.paymentTermDays, 0);
  var goodsSt = str(pp.goodsStatus) || 'shipped';

  var lcType = str(pp.lcType) || 'sight';
  var lcIssuePct = num(pp.lcIssuancePctPerQuarter, 0);
  var lcAdvising = num(pp.lcAdvisingFeeUSD, 0);
  var lcConfirmPct = num(pp.lcConfirmationPctPerQuarter, 0);
  var lcNegPct = num(pp.lcNegotiationPct, 0);
  var lcAmendFee = num(pp.lcAmendmentFeeUSD, 0);
  var lcAmendCnt = num(pp.lcExpectedAmendments, 0);

  var dcType = str(pp.dcType) || 'dp';
  var dcCollPct = num(pp.dcCollectingCommissionPct, 0);
  var dcRemit = num(pp.dcRemittingFeeUSD, 0);
  var dcProtest = num(pp.dcProtestFeeUSD, 0);
  var dcNonPayPct = num(pp.dcNonPaymentProbabilityPct, 0);

  var quarters = Math.max(1, Math.ceil(payDays / 90));

  var lcIssue = invoice * (lcIssuePct / 100) * quarters;
  var lcConfirm = invoice * (lcConfirmPct / 100) * quarters;
  var lcNeg = invoice * (lcNegPct / 100);
  var lcAmends = lcAmendFee * lcAmendCnt;
  var lcTotalFees = lcIssue + lcAdvising + lcConfirm + lcNeg + lcAmends;

  var dcCollect = invoice * (dcCollPct / 100);
  var dcExpProtest = (dcNonPayPct / 100) * dcProtest;
  var dcTotalFees = dcCollect + dcRemit + dcExpProtest;

  var recoveryRate = 0.60;
  var dcNonPayProb = dcNonPayPct / 100;
  var dcRiskExposure = invoice * dcNonPayProb * (1 - recoveryRate);
  var dcRiskAdj = dcTotalFees + dcRiskExposure;
  var lcRiskAdj = lcTotalFees;

  // HEURISTIC (disclosed, not a computed fact): additive 0-100 rubric approximating LC protection value.
  var lcRiskScore = 50;
  if (buyerR === 'high') lcRiskScore += 20;
  if (buyerR === 'medium') lcRiskScore += 10;
  if (sellerR === 'high') lcRiskScore += 10;
  if (buyerRel === 'new') lcRiskScore += 10;
  if (buyerRel === 'lt2') lcRiskScore += 5;
  if (lcType === 'confirmed_sight' || lcType === 'confirmed_usance') lcRiskScore += 10;
  if (goodsSt === 'manufacture') lcRiskScore += 5;
  lcRiskScore = Math.min(100, lcRiskScore);

  var beDenominator = dcProtest + invoice * (1 - recoveryRate);
  var beNumerator = lcTotalFees - dcCollect - dcRemit;
  var beProb = beDenominator > 0 ? Math.max(0, beNumerator / beDenominator * 100) : 0;

  var lcRecommended = (buyerR === 'high' || buyerR === 'medium' || buyerRel === 'new' || buyerRel === 'lt2' || goodsSt === 'manufacture' || dcNonPayPct >= beProb);
  var recommendation = lcRecommended ? 'LC' : 'DC';

  var compliance_flags = ['DC_VS_LC_COST_BENEFIT_ASSESSED', lcRecommended ? 'LC_RECOMMENDED' : 'DC_MAY_SUFFICE'];

  return {
    output_payload: {
      lcTotalFeesUSD: lcTotalFees,
      dcTotalFeesUSD: dcTotalFees,
      dcRiskExposureUSD: dcRiskExposure,
      lcRiskAdjCostUSD: lcRiskAdj,
      dcRiskAdjCostUSD: dcRiskAdj,
      lcProtectionScore: lcRiskScore,
      lc_protection_score_heuristic: true,
      breakEvenProbabilityPct: beProb,
      recommendation: recommendation,
      heuristic_note: 'lcProtectionScore is a disclosed additive heuristic (0-100), not a computed fact. All USD/percentage figures above it are deterministic fee/break-even arithmetic.',
    },
    compliance_flags: compliance_flags,
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
