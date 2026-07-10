import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-181-sii-ifrs17-reconciliation-bridger';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_sii_ifrs17',
  mandate_type: 'compliance_mandate', gpu: false,
};

// SII↔IFRS 17 technical-provision reconciliation bridge.
// SII: BE + risk margin. IFRS 17: FCF + RA + CSM.
// EIOPA research (FSI Insights 2022) finds RA is typically 33–44% lower than
// the SII risk margin for life insurance. Flags if bridge delta exceeds 10% of
// SII technical provisions. NaN-safe numeric throughout.
export function compute(pp) {
  const { provisions = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const sii_bel  = g(provisions.sii_best_estimate);
  const sii_rm   = g(provisions.sii_risk_margin);
  const ifrs_fcf = g(provisions.ifrs17_fcf);
  const ifrs_ra  = g(provisions.ifrs17_ra);
  const ifrs_csm = g(provisions.ifrs17_csm);

  const sii_tp   = sii_bel + sii_rm;
  const ifrs_icl = ifrs_fcf + ifrs_ra + ifrs_csm;

  const bridge_delta = sii_tp - ifrs_icl;
  const rel_delta    = sii_tp > 0 ? Math.abs(bridge_delta / sii_tp) : 0;
  const bridge_within_tolerance = rel_delta <= 0.1;

  const relative_bridge_delta_pct = Math.round(rel_delta * 10000) / 100;
  const ra_vs_rm_ratio = sii_rm > 0 ? Math.round((ifrs_ra / sii_rm) * 10000) / 100 : 0;

  const bel_fcf_delta = sii_bel - ifrs_fcf;
  const rm_ra_delta   = sii_rm - ifrs_ra;

  const compliance_flags = [];
  compliance_flags.push('SII_IFRS17_RECONCILIATION_ASSESSED');
  if (bridge_within_tolerance) compliance_flags.push('SII_IFRS17_BRIDGE_WITHIN_TOLERANCE');
  else                         compliance_flags.push('SII_IFRS17_BRIDGE_OUTSIDE_TOLERANCE');
  if (ifrs_csm > 0)            compliance_flags.push('SII_IFRS17_CSM_PRESENT');
  if (sii_rm > 0 && ra_vs_rm_ratio < 57) compliance_flags.push('SII_RA_BELOW_EIOPA_BENCHMARK');

  return {
    output_payload: {
      sii_technical_provisions: sii_tp,
      ifrs17_insurance_contract_liabilities: ifrs_icl,
      bridge_delta,
      bridge_within_tolerance,
      relative_bridge_delta_pct,
      ra_vs_risk_margin_ratio_pct: ra_vs_rm_ratio,
      bel_fcf_delta,
      rm_ra_delta,
      sii_best_estimate: sii_bel,
      sii_risk_margin: sii_rm,
      ifrs17_fcf: ifrs_fcf,
      ifrs17_ra: ifrs_ra,
      ifrs17_csm: ifrs_csm,
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
