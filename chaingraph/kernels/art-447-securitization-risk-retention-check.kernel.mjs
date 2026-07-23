import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-447-securitization-risk-retention-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_securitization_risk_retention',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Securitization risk-retention checker -- EU Securitisation Regulation (EU) 2017/2402 Art.6
// (originator/sponsor/original-lender net economic interest >= 5%, retained on an ongoing
// basis, no hedging/sale, retainer must not be established or operate for the sole purpose of
// securitising exposures) and the U.S. Credit Risk Retention Rule (Dodd-Frank Sec.941, Reg RR,
// 12 CFR Part 244: 5% base retention with a Qualified Residential Mortgage (QRM) exemption,
// Sec_.19). Deterministic point-in-time structural check from caller-supplied retention method,
// exposure/retained amounts, and jurisdiction-specific flags -- no valuation model, no live
// exposure feed.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Ratios rounded to 2
// decimals (r2) only at declared output boundaries; a zero-denominator ratio is reported as
// null (finite gate: never NaN/Infinity).

const ALLOWED_METHODS = [
  'vertical_slice',
  'horizontal_first_loss',
  'l_shaped',
  'representative_sample',
  'sellers_interest',
];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }

export function compute(pp) {
  pp = pp || {};

  const jurisdiction = pp.jurisdiction === 'us' ? 'us' : 'eu';
  const method = typeof pp.retention_method === 'string' ? pp.retention_method : '';
  const methodValid = ALLOWED_METHODS.indexOf(method) >= 0;

  const totalExposureMusd = Math.max(0, safeNum(pp.total_securitized_exposure_musd, 0));
  const retainedAmountMusd = Math.max(0, safeNum(pp.retained_amount_musd, 0));
  const actualRetentionPct = totalExposureMusd > 0 ? r2((retainedAmountMusd / totalExposureMusd) * 100) : null;

  const qrmExemptionApplied = jurisdiction === 'us' && !!pp.all_exposures_qrm_qualified;
  const requiredRetentionPct = qrmExemptionApplied ? 0 : 5;

  const soleyPurposeEntityFlag = jurisdiction === 'eu' && !!pp.retainer_is_sole_purpose_entity;
  const hedgingOrSaleDetected = !!pp.retained_interest_hedged_or_sold;

  const breach_reasons = [];
  if (!methodValid) breach_reasons.push('INVALID_RETENTION_METHOD');
  if (requiredRetentionPct > 0) {
    if (actualRetentionPct === null || actualRetentionPct < requiredRetentionPct) {
      breach_reasons.push('RETENTION_BELOW_REQUIRED_THRESHOLD');
    }
  }
  if (soleyPurposeEntityFlag) breach_reasons.push('RETAINER_FAILS_SOLE_PURPOSE_TEST');
  if (hedgingOrSaleDetected) breach_reasons.push('RETAINED_INTEREST_HEDGED_OR_SOLD');

  const compliant = breach_reasons.length === 0;

  const compliance_flags = [compliant ? 'RETENTION_COMPLIANT' : 'RETENTION_NONCOMPLIANT'];

  const output_payload = {
    jurisdiction,
    retention_method: method,
    retention_method_valid: methodValid,
    total_securitized_exposure_musd: r2(totalExposureMusd),
    retained_amount_musd: r2(retainedAmountMusd),
    actual_retention_pct: actualRetentionPct,
    required_retention_pct: requiredRetentionPct,
    qrm_exemption_applied: qrmExemptionApplied,
    retainer_is_sole_purpose_entity: soleyPurposeEntityFlag,
    retained_interest_hedged_or_sold: hedgingOrSaleDetected,
    compliant,
    breach_reasons,
    regulatory_basis: 'EU Securitisation Regulation (EU) 2017/2402 Art.6 (originator/sponsor/original-lender net economic interest, ongoing 5% retention, no hedging/sale, sole-purpose-entity prohibition); U.S. Credit Risk Retention Rule (Dodd-Frank Sec.941, Reg RR, 12 CFR Part 244) 5% base retention with Sec_.19 Qualified Residential Mortgage exemption.',
    note: 'Deterministic structural check from caller-supplied retention method, exposure/retained nominal amounts, and jurisdiction-specific flags for a single reporting date.',
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
