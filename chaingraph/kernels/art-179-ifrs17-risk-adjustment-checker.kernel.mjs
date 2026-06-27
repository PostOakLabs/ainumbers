import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-179-ifrs17-risk-adjustment-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_ifrs17_risk_adjustment',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IFRS 17 risk-adjustment disclosure validator. Checks technique validity
// (VaR/CTE/CoC/other), confidence-level disclosure for VaR/CTE, and onerous-
// contract loss-component recognition. Terminal node of ifrs17-measurement-conformance.
export function compute(pp) {
  const { risk_adjustment = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const ra_amount         = g(risk_adjustment.ra_amount);
  const confidence_level  = g(risk_adjustment.confidence_level_pct);
  const disclosed         = risk_adjustment.disclosed === true;
  const onerous_identified = risk_adjustment.onerous_contracts_identified === true;
  const loss_recognized    = risk_adjustment.loss_component_recognized === true;

  const VALID_TECHNIQUES = ['VaR', 'CTE', 'CoC', 'other'];
  const technique    = typeof risk_adjustment.technique === 'string' ? risk_adjustment.technique : '';
  const technique_ok = VALID_TECHNIQUES.includes(technique);

  // VaR and CTE require an explicit confidence-level disclosure
  const needs_confidence = technique === 'VaR' || technique === 'CTE';
  const confidence_disclosed = needs_confidence
    ? (confidence_level > 0 && confidence_level <= 100)
    : disclosed;

  const onerous_properly_handled = !onerous_identified || loss_recognized;

  const gaps = [];
  if (!technique_ok)                          gaps.push('technique_not_valid');
  if (!disclosed)                             gaps.push('not_disclosed');
  if (needs_confidence && !confidence_disclosed) gaps.push('confidence_level_not_disclosed');
  if (ra_amount <= 0)                         gaps.push('ra_amount_zero_or_negative');
  if (!onerous_properly_handled)              gaps.push('loss_component_not_recognized');

  const ra_valid = gaps.length === 0;

  const compliance_flags = { IFRS17_RISK_ADJUSTMENT_ASSESSED: true };
  if (ra_valid)            compliance_flags.IFRS17_RISK_ADJUSTMENT_VALID = true;
  if (onerous_identified)  compliance_flags.IFRS17_ONEROUS_CONTRACTS_IDENTIFIED = true;
  if (loss_recognized)     compliance_flags.IFRS17_LOSS_COMPONENT_RECOGNIZED = true;
  if (!ra_valid)           compliance_flags.IFRS17_RISK_ADJUSTMENT_GAPS = true;

  return {
    output_payload: {
      ra_valid,
      ra_amount,
      technique,
      technique_ok,
      confidence_level_pct: confidence_level,
      confidence_disclosed,
      disclosed,
      onerous_contracts_identified: onerous_identified,
      loss_component_recognized: loss_recognized,
      onerous_properly_handled,
      gaps,
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
