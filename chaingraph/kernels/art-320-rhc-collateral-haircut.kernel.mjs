/**
 * art-320-rhc-collateral-haircut.kernel.mjs
 * Halt + Staleness Collateral Haircut — Robinhood Chain stock tokens as collateral.
 * Composes downstream of check_tokenized_collateral_eligibility + calculate_repo_haircut in the
 * chain (see RHC-WAVE-BUILD-SPEC.md §RHC-4); this kernel layers the feed-staleness / sequencer /
 * halt haircut on top of the base haircut those nodes supply.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-320-rhc-collateral-haircut';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'compute_stock_token_collateral_haircut',
  mandate_type: 'collateral_mandate',
  gpu:          false,
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

export function compute(pp) {
  const {
    position_value,
    base_haircut,          // from calculate_repo_haircut, pasted
    feed_round = {},        // { timestamp, round_id, heartbeat_seconds }
    current_time,
    sequencer_uptime = {},  // { is_up, since_timestamp, grace_period_seconds }
    underlying_market_state = {}, // { is_halted }
  } = pp;

  const finiteCore = [position_value, base_haircut, current_time].every(v => typeof v === 'number' && Number.isFinite(v));
  if (!finiteCore) {
    const output_payload = { verdict: 'INVALID_INPUT', liquidation_risk: 'unknown', final_haircut: null, adjusted_collateral_value: null };
    return { output_payload, compliance_flags: ['RHC_HAIRCUT_INPUT_INVALID'] };
  }

  const feed_stale = typeof feed_round.timestamp === 'number' && typeof feed_round.heartbeat_seconds === 'number'
    ? (current_time - feed_round.timestamp) > feed_round.heartbeat_seconds
    : true;

  const seq_since = typeof sequencer_uptime.since_timestamp === 'number' ? sequencer_uptime.since_timestamp : null;
  const seq_grace = typeof sequencer_uptime.grace_period_seconds === 'number' ? sequencer_uptime.grace_period_seconds : 0;
  const sequencer_down = sequencer_uptime.is_up === false;
  const sequencer_down_within_grace = sequencer_down && seq_since !== null && (current_time - seq_since) <= seq_grace;
  const sequencer_down_grace_expired = sequencer_down && seq_since !== null && (current_time - seq_since) > seq_grace;

  const underlying_halted = underlying_market_state.is_halted === true;

  let extra_haircut = 0;
  if (feed_stale) extra_haircut += 0.10;
  if (sequencer_down_within_grace) extra_haircut += 0.05;
  const liquidation_blocked = sequencer_down_grace_expired || underlying_halted;
  if (liquidation_blocked) extra_haircut += 0.15;

  const final_haircut = clamp01(base_haircut + extra_haircut);
  const adjusted_collateral_value = position_value * (1 - final_haircut);

  let liquidation_risk = 'normal';
  if (liquidation_blocked) liquidation_risk = 'blocked';
  else if (feed_stale || sequencer_down_within_grace) liquidation_risk = 'elevated';

  const output_payload = {
    verdict: liquidation_risk === 'blocked' ? 'LIQUIDATION_BLOCKED' : 'HAIRCUT_COMPUTED',
    feed_stale,
    sequencer_down_within_grace,
    sequencer_down_grace_expired,
    underlying_halted,
    base_haircut,
    extra_haircut,
    final_haircut,
    adjusted_collateral_value,
    liquidation_risk,
  };

  const compliance_flags = liquidation_risk === 'blocked' ? ['RHC_LIQUIDATION_BLOCKED'] : liquidation_risk === 'elevated' ? ['RHC_HAIRCUT_ELEVATED'] : ['RHC_HAIRCUT_NORMAL'];
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
