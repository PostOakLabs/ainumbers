import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-356-compute-oprisk-sma-2026';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_oprisk_sma_2026',
  mandate_type: 'capital_assessment', gpu: false,
};

// Basel Standardized Measurement Approach (SMA) for operational-risk capital,
// per the July 2026 US Basel Endgame reproposal (three-NPR package proposed
// 2026-03-19, comment period closed 2026-06-18, final rule expected ~Q4 2026,
// effective 2027). rule_status: "proposed" -- re-pin at finalization.
//
// METHOD:
//   1. BUSINESS INDICATOR (BI) = ILDC (interest/lease/dividend component)
//      + SC (services component) + FC (financial component), each supplied
//      pre-averaged over the trailing 3 years (upstream absolute-value/netting
//      per BCBS d424 para 24-30 assumed already applied to the inputs).
//   2. BUSINESS INDICATOR COMPONENT (BIC): marginal coefficients applied to BI
//      across three buckets (BCBS d424 para 32, Table 1; US-proposal USD
//      thresholds mirror the BCBS EUR bucket structure 1:1 for this worked
//      example): bucket 1 <= $1bn @ 12%, bucket 2 $1bn-$30bn @ 15%, bucket 3
//      > $30bn @ 18%. Applied MARGINALLY (not average-rate on the whole BI).
//   3. INTERNAL LOSS MULTIPLIER (ILM): ILM = ln(e - 1 + LC/BIC), where
//      LC (loss component) = 15 x the 10-year average annual operational-risk
//      loss. The 2026 US reproposal -- like its 2023 predecessor -- NEUTRALIZES
//      the ILM to 1 for all US banking organizations regardless of internal
//      loss experience (verify at finalization: this is the single most
//      contested provision in the package and a live candidate for reversal).
//      When neutralized, LC/loss history is not required. When not neutralized
//      (use_us_ilm_neutralization: false, e.g. modeling a non-US jurisdiction
//      or a possible reversal), fewer than 5 years of loss history defaults
//      ILM to 1 per BCBS d424 para 40 (insufficient data -> no multiplier).
//   4. OPERATIONAL RISK CAPITAL (ORC) = BIC x ILM.
//   5. RWA = ORC x 12.5 (the standard capital-to-RWA conversion factor).
//
// constants_version: BASEL-SMA-US-2026-PROPOSAL-2026-03-19 (bucket coefficients
// and ILM-neutralization stance per the reproposed rule text; NOT final).
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random. Math.log is a native transcendental (permitted, not _detmath;
// only power-series/polyfilled transcendentals require the inline-never-import
// rule). All dollar figures rounded to 2 decimal places (r2). Finite gate:
// non-finite/absent numeric inputs default to 0, never NaN/Infinity.

const BUCKET_1_MAX = 1_000_000_000; // $1bn
const BUCKET_2_MAX = 30_000_000_000; // $30bn
const BUCKET_1_RATE = 0.12;
const BUCKET_2_RATE = 0.15;
const BUCKET_3_RATE = 0.18;
const LOSS_COMPONENT_MULTIPLIER = 15;
const RWA_CAPITAL_CONVERSION = 12.5;
const MIN_LOSS_YEARS = 5;
const CONSTANTS_VERSION = 'BASEL-SMA-US-2026-PROPOSAL-2026-03-19';

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function marginalBIC(bi) {
  const b1 = Math.min(bi, BUCKET_1_MAX);
  const b2 = Math.max(0, Math.min(bi, BUCKET_2_MAX) - BUCKET_1_MAX);
  const b3 = Math.max(0, bi - BUCKET_2_MAX);
  return { bic: BUCKET_1_RATE * b1 + BUCKET_2_RATE * b2 + BUCKET_3_RATE * b3, b1, b2, b3 };
}

export function compute(pp) {
  pp = pp || {};

  const ildc = safeNum(pp.ildc_avg, 0);
  const sc = safeNum(pp.sc_avg, 0);
  const fc = safeNum(pp.fc_avg, 0);
  const useUsNeutralization = pp.use_us_ilm_neutralization !== false;
  const annualLosses = Array.isArray(pp.annual_op_losses) ? pp.annual_op_losses.map((v) => safeNum(v, 0)) : [];

  const compliance_flags = [];

  const businessIndicator = Math.max(0, r2(ildc + sc + fc));

  const { bic: bicRaw, b1, b2, b3 } = marginalBIC(businessIndicator);
  const businessIndicatorComponent = r2(bicRaw);

  let bucket;
  if (b3 > 0) { bucket = 3; compliance_flags.push('OPRISK_BUCKET_3_ABOVE_30BN'); }
  else if (b2 > 0) { bucket = 2; compliance_flags.push('OPRISK_BUCKET_2_1BN_TO_30BN'); }
  else { bucket = 1; compliance_flags.push('OPRISK_BUCKET_1_UP_TO_1BN'); }

  let internalLossMultiplier = 1;
  let lossComponent = 0;
  let averageAnnualLoss = 0;

  if (useUsNeutralization) {
    compliance_flags.push('ILM_NEUTRALIZED_US_VARIANT');
  } else if (annualLosses.length < MIN_LOSS_YEARS) {
    compliance_flags.push('ILM_INSUFFICIENT_LOSS_HISTORY_DEFAULT_1');
  } else {
    averageAnnualLoss = r2(annualLosses.reduce((a, b) => a + b, 0) / annualLosses.length);
    lossComponent = r2(LOSS_COMPONENT_MULTIPLIER * averageAnnualLoss);
    if (businessIndicatorComponent > 0) {
      const ratio = lossComponent / businessIndicatorComponent;
      internalLossMultiplier = Math.log(Math.E - 1 + ratio);
      compliance_flags.push(internalLossMultiplier > 1 ? 'ILM_ABOVE_ONE_LOSS_HISTORY_PENALIZES' : 'ILM_AT_OR_BELOW_ONE');
    } else {
      compliance_flags.push('ILM_UNDEFINED_ZERO_BIC_DEFAULT_1');
    }
  }

  const operationalRiskCapital = r2(businessIndicatorComponent * internalLossMultiplier);
  const rwa = r2(operationalRiskCapital * RWA_CAPITAL_CONVERSION);

  const output_payload = {
    business_indicator: businessIndicator,
    business_indicator_component: businessIndicatorComponent,
    bucket,
    internal_loss_multiplier: r2(internalLossMultiplier),
    loss_component: lossComponent,
    average_annual_loss: averageAnnualLoss,
    operational_risk_capital: operationalRiskCapital,
    rwa,
    ildc_avg: r2(ildc),
    sc_avg: r2(sc),
    fc_avg: r2(fc),
    use_us_ilm_neutralization: useUsNeutralization,
    constants_version: CONSTANTS_VERSION,
    rule_status: 'proposed',
    regulatory_basis: 'BCBS d424 (Dec 2017 Basel III finalization) Standardized Measurement Approach for operational risk, as carried into the US Basel Endgame reproposal (three NPRs proposed 2026-03-19, comment period closed 2026-06-18): Business Indicator Component via marginal bucket coefficients (12%/15%/18% at $1bn/$30bn), Internal Loss Multiplier neutralized to 1 for US banking organizations per the reproposal (contested provision, subject to change at finalization), RWA = Operational Risk Capital x 12.5.',
    note: 'Bucket coefficients applied MARGINALLY, not as a flat rate on the whole Business Indicator. ILM neutralization is a US-specific reproposal choice, not a BCBS-standard default -- set use_us_ilm_neutralization:false to model the non-neutralized ILM (BCBS d424 formula) with annual_op_losses supplied.',
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
