/**
 * art-317-rhc-multiplier-reconciler.kernel.mjs
 * ERC-8056 Multiplier Reconciler — Robinhood Chain stock-token corporate actions.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-317-rhc-multiplier-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'reconcile_erc8056_multiplier',
  mandate_type: 'collateral_mandate',
  gpu:          false,
};

const EPS = 1e-9;

export function compute(pp) {
  const {
    declared_action = {},
    prior_multiplier,
    current_multiplier,
    raw_balance_before,
    raw_balance_after,
    event_log = [],
  } = pp;

  const discrepancies = [];

  // 1. ratio match
  let computed_ratio = null;
  let expected_ratio = typeof declared_action.ratio === 'number' ? declared_action.ratio : null;
  if (typeof prior_multiplier === 'number' && prior_multiplier > 0 && typeof current_multiplier === 'number') {
    computed_ratio = current_multiplier / prior_multiplier;
  } else {
    discrepancies.push('invalid_prior_multiplier');
  }
  let ratio_match = false;
  if (computed_ratio !== null && expected_ratio !== null) {
    ratio_match = Math.abs(computed_ratio - expected_ratio) < EPS;
    if (!ratio_match) discrepancies.push('multiplier_ratio_mismatch');
  } else if (expected_ratio === null) {
    discrepancies.push('missing_declared_ratio');
  }

  // 2. event log: no missed / no duplicate application
  const seenDates = new Set();
  let duplicate_events = false;
  for (const ev of event_log) {
    if (ev && ev.ex_date) {
      if (seenDates.has(ev.ex_date)) duplicate_events = true;
      seenDates.add(ev.ex_date);
    }
  }
  if (duplicate_events) discrepancies.push('duplicate_event_application');
  const missed_application = event_log.length === 0;
  if (missed_application) discrepancies.push('no_event_log_entry');

  // 3. monotonic sequence against ex-dates
  let monotonic = true;
  for (let i = 1; i < event_log.length; i++) {
    const prev = event_log[i - 1]?.ex_date;
    const cur = event_log[i]?.ex_date;
    if (prev && cur && String(cur) < String(prev)) { monotonic = false; break; }
  }
  if (!monotonic) discrepancies.push('non_monotonic_event_sequence');
  if (event_log.length && declared_action.ex_date) {
    const last = event_log[event_log.length - 1]?.ex_date;
    if (last && last !== declared_action.ex_date) discrepancies.push('declared_ex_date_not_in_event_log');
  }

  // 4. raw balance invariance — raw balances stay static until redemption
  let raw_balance_invariant = null;
  if (typeof raw_balance_before === 'number' && typeof raw_balance_after === 'number') {
    raw_balance_invariant = raw_balance_before === raw_balance_after;
    if (!raw_balance_invariant) discrepancies.push('raw_balance_moved_without_redemption');
  }

  const verdict = discrepancies.length === 0 ? 'RECONCILED' : 'DISCREPANCY';

  const output_payload = {
    verdict,
    declared_action_type: declared_action.type ?? null,
    expected_ratio,
    computed_ratio,
    ratio_match,
    raw_balance_invariant,
    event_count: event_log.length,
    discrepancies,
  };

  const compliance_flags = verdict === 'RECONCILED' ? ['RHC_MULTIPLIER_RECONCILED'] : ['RHC_MULTIPLIER_DISCREPANCY'];

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
