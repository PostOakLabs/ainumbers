import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-448-ifrs17-loss-component-tracker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'track_ifrs17_loss_component_rollforward',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IFRS 17 para 50 loss-component roll-forward: opening + additional (new
// onerous recognition) - reversal (subsequent favourable experience,
// capped so it never reverses more than exists) + other adjustments,
// then release to P&L is capped at the pre-release balance. Delta over
// art-178 (CSM roll-forward), which resets the loss component to a single
// period's shortfall and does not track its own multi-period roll-forward.
// NaN-safe on every numeric input.
export function compute(pp) {
  const { loss_component = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const opening    = g(loss_component.opening_lc);
  const additional = g(loss_component.additional_lc);
  const reversal    = g(loss_component.reversal_lc);
  const release      = g(loss_component.release_to_pnl);
  const other_adj  = g(loss_component.other_adj);

  const available_to_reverse = opening + additional + other_adj;
  const reversal_excess = reversal > available_to_reverse && available_to_reverse >= 0;
  const reversal_capped = Math.min(reversal, Math.max(available_to_reverse, 0));

  const pre_release = opening + additional - reversal_capped + other_adj;
  const release_excess = release > pre_release && pre_release >= 0;
  const release_capped = Math.min(release, Math.max(pre_release, 0));

  const closing_lc = Math.max(pre_release - release_capped, 0);
  const fully_reversed = closing_lc === 0 && opening > 0;
  const lc_valid = !reversal_excess && !release_excess;

  const compliance_flags = [];
  compliance_flags.push('IFRS17_LOSS_COMPONENT_ROLLFORWARD_ASSESSED');
  if (lc_valid) compliance_flags.push('IFRS17_LOSS_COMPONENT_VALID');
  if (reversal_excess) compliance_flags.push('IFRS17_LOSS_COMPONENT_REVERSAL_EXCESS');
  if (release_excess) compliance_flags.push('IFRS17_LOSS_COMPONENT_RELEASE_EXCESS');
  if (fully_reversed) compliance_flags.push('IFRS17_LOSS_COMPONENT_FULLY_REVERSED');

  return {
    output_payload: {
      closing_lc,
      opening_lc: opening,
      additional_lc: additional,
      reversal_lc: reversal,
      release_to_pnl: release,
      other_adj,
      pre_release,
      fully_reversed,
      lc_valid,
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
