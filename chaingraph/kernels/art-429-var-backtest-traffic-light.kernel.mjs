import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-429-var-backtest-traffic-light';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_var_backtest_traffic_light',
  mandate_type: 'capital_assessment', gpu: false,
};

// Basel traffic-light VaR backtesting: counts exceptions (actual daily P&L loss exceeding
// the model's VaR estimate) over a rolling <=250-trading-day window, then looks up the
// green/yellow/red zone + capital multiplier per the Basel Committee's 1996 Amendment to
// the Capital Accord to Incorporate Market Risks, Part V (retained under BCBS d457, Jan
// 2019, IMA backtesting). Exception-count + zone + multiplier lookup ONLY -- does not
// compute VaR itself and does not apply the multiplier to a capital charge.
// BANKING-OCG-BUILD-SPEC.md §3.6.

const CONSTANTS_VERSION = 'BASEL-VAR-BACKTEST-TRAFFIC-LIGHT-2026-07-23-V1';
const SOURCE = 'Basel Committee on Banking Supervision, Amendment to the Capital Accord to Incorporate Market Risks (Jan 1996), Part V, "The Basel Committee\'s backtesting framework" -- 250 trading-day rolling window comparing actual daily P&L against the 99% 1-day VaR estimate; green (0-4 exceptions, multiplier 3.00), yellow (5-9 exceptions, stepped multiplier 3.40-3.85), red (10+ exceptions, multiplier 4.00 floor). Retained under BCBS d457 "Minimum capital requirements for market risk" (Jan 2019) internal-models-approach backtesting provisions.';
const WINDOW_DAYS_STANDARD = 250;

// exception count (0-9) -> Basel multiplier; 10+ = red floor 4.00.
const MULTIPLIER_TABLE = [3.00, 3.00, 3.00, 3.00, 3.00, 3.40, 3.50, 3.65, 3.75, 3.85];
const RED_MULTIPLIER = 4.00;
const YELLOW_MIN = 5;
const RED_MIN = 10;

function g(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function zoneFor(count) {
  if (count >= RED_MIN) return 'RED';
  if (count >= YELLOW_MIN) return 'YELLOW';
  return 'GREEN';
}

function multiplierFor(count) {
  if (count >= RED_MIN) return RED_MULTIPLIER;
  return MULTIPLIER_TABLE[count];
}

export function compute(pp) {
  pp = pp || {};
  const all_observations = Array.isArray(pp.observations) ? pp.observations : [];
  const truncated = all_observations.length > WINDOW_DAYS_STANDARD;
  const observations = truncated ? all_observations.slice(-WINDOW_DAYS_STANDARD) : all_observations;
  const window_days = observations.length;

  const exception_indices = [];
  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i] || {};
    const pnl = g(obs.pnl);
    const var_estimate = Math.abs(g(obs.var_estimate));
    if (pnl < -var_estimate) exception_indices.push(i);
  }

  const exception_count = exception_indices.length;
  const zone = zoneFor(exception_count);
  const multiplier = multiplierFor(exception_count);
  const full_window = window_days === WINDOW_DAYS_STANDARD;

  const output_payload = {
    window_days,
    full_window,
    truncated_to_250: truncated,
    exception_count,
    exception_indices,
    zone,
    multiplier,
    rule_status: 'final',
    constants_version: CONSTANTS_VERSION,
    source: SOURCE,
    disambiguation: 'compute_var_backtest_traffic_light performs ONLY the Basel traffic-light exception count + zone + multiplier lookup over a supplied <=250-trading-day P&L/VaR series. It does NOT compute VaR itself, does NOT apply the multiplier to a capital charge (RWA/capital math is left to the bank\'s market-risk capital engine), and is not a hypothetical-vs-actual P&L attribution tool.',
  };

  const compliance_flags = ['BASEL_VAR_BACKTEST_TRAFFIC_LIGHT_COMPUTED', 'ZONE_' + zone];
  if (!full_window) compliance_flags.push('PARTIAL_WINDOW_UNDER_250_DAYS');

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
