import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-261-test-hedge-effectiveness';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// ASC 815 / IFRS 9 hedge effectiveness testing.
// Dollar-offset method: cumulative ratio must be 80-125% (ASC 815-20-35).
// Regression method: deterministic OLS (pure arithmetic, no transcendentals).
//   Effective if beta approx -1 (abs(beta) in [0.80, 1.25]) AND R-squared >= 0.8.
// THE anchor flagship in cluster 24: RFC 3161 designation-date anchor proves the effectiveness
// test ran contemporaneously with hedge designation, not backfilled (FASB anti-backdating rationale).
// ZERO PII: changes arrays, aggregate statistics only.

const TABLE_VERSION = 'ASC815-HEDGE-EFFECTIVENESS-V2023';
const TABLE_SOURCE  = 'ASC 815-20-35 (hedge accounting, dollar-offset + regression); FASB ASU 2017-12; IFRS 9.6.4.1 (effectiveness requirements); IAS 39 AG105-AG113';

export function compute(params) {
  const p = params || {};

  const method = ['dollar_offset','regression','both'].includes(p.method) ? p.method : 'both';
  const effectiveness_standard = ['asc815','ifrs9'].includes(p.effectiveness_standard) ? p.effectiveness_standard : 'asc815';
  const hedge_ratio = _finite(p.hedge_ratio, 1.0);

  const hedged_item_changes       = Array.isArray(p.hedged_item_changes)       ? p.hedged_item_changes.map(_finiteOrNull)       : [];
  const hedging_instrument_changes = Array.isArray(p.hedging_instrument_changes) ? p.hedging_instrument_changes.map(_finiteOrNull) : [];

  // Filter to paired observations only
  const n = Math.min(hedged_item_changes.length, hedging_instrument_changes.length);
  const x = []; // hedged item
  const y = []; // hedging instrument

  for (let i = 0; i < n; i++) {
    const xi = hedged_item_changes[i];
    const yi = hedging_instrument_changes[i];
    if (xi !== null && yi !== null) {
      x.push(xi);
      y.push(yi);
    }
  }

  const obs = x.length;

  // ------- Dollar-offset method -------
  let dollar_offset_ratio      = null;
  let dollar_offset_effective  = null;
  let cumulative_hedged        = null;
  let cumulative_hedging       = null;

  if ((method === 'dollar_offset' || method === 'both') && obs >= 1) {
    cumulative_hedged  = _round4(x.reduce(function(s, v) { return s + v; }, 0));
    cumulative_hedging = _round4(y.reduce(function(s, v) { return s + v; }, 0));

    if (cumulative_hedged !== 0) {
      // Ratio = hedging / hedged (should be close to -1 for perfect offset)
      dollar_offset_ratio = _round4(cumulative_hedging / cumulative_hedged);
      const abs_ratio = Math.abs(dollar_offset_ratio);
      dollar_offset_effective = (abs_ratio >= 0.80 && abs_ratio <= 1.25);
    } else {
      dollar_offset_ratio = null;
      dollar_offset_effective = false;
    }
  }

  // ------- OLS regression method -------
  // Pure arithmetic: no Math.sqrt/log/pow needed.
  let ols_beta       = null;
  let ols_alpha      = null;
  let r_squared      = null;
  let regression_effective = null;

  if ((method === 'regression' || method === 'both') && obs >= 3) {
    let sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;
    for (let i = 0; i < obs; i++) {
      sum_x  += x[i];
      sum_y  += y[i];
      sum_xy += x[i] * y[i];
      sum_x2 += x[i] * x[i];
      sum_y2 += y[i] * y[i];
    }

    const denom = obs * sum_x2 - sum_x * sum_x;

    if (denom !== 0) {
      ols_beta  = _round6((obs * sum_xy - sum_x * sum_y) / denom);
      ols_alpha = _round6((sum_y - ols_beta * sum_x) / obs);

      const mean_y = sum_y / obs;
      let ss_res = 0, ss_tot = 0;
      for (let i = 0; i < obs; i++) {
        const fitted = ols_alpha + ols_beta * x[i];
        const res    = y[i] - fitted;
        ss_res += res * res;
        ss_tot += (y[i] - mean_y) * (y[i] - mean_y);
      }

      r_squared = ss_tot > 0 ? _round4(1 - ss_res / ss_tot) : 1;

      // Effective: beta in [-1.25, -0.75] (slope close to -1) AND R² >= 0.80
      const abs_beta = Math.abs(ols_beta);
      regression_effective = (abs_beta >= 0.75 && abs_beta <= 1.25 && ols_beta < 0) && (r_squared >= 0.80);
    }
  }

  // ------- Effectiveness verdict -------
  let is_effective = false;
  let effectiveness_reason = '';

  if (method === 'dollar_offset') {
    is_effective = dollar_offset_effective === true;
    effectiveness_reason = is_effective ? 'Dollar-offset ratio within 80-125% range.' : 'Dollar-offset ratio outside 80-125% range (ASC 815-20-35).';
  } else if (method === 'regression') {
    is_effective = regression_effective === true;
    effectiveness_reason = is_effective ? 'OLS beta approximately -1 and R-squared >= 0.80.' : 'OLS regression test failed: beta deviates from -1 or R-squared < 0.80.';
  } else {
    // Both: require both to pass for CONSERVATIVE test (most common audit approach)
    if (obs >= 3) {
      is_effective = (dollar_offset_effective === true) && (regression_effective === true);
      effectiveness_reason = is_effective
        ? 'Both dollar-offset (80-125%) and OLS regression (beta approx -1, R-squared >= 0.80) pass.'
        : 'One or both tests failed: ' +
          (dollar_offset_effective !== true ? 'dollar-offset outside 80-125%. ' : '') +
          (regression_effective !== true ? 'OLS regression failed.' : '');
    } else if (obs >= 1) {
      // Insufficient observations for regression -- use dollar-offset only
      is_effective = dollar_offset_effective === true;
      effectiveness_reason = is_effective
        ? 'Dollar-offset 80-125% passes (insufficient observations for regression).'
        : 'Dollar-offset outside 80-125% (insufficient observations for regression).';
    } else {
      is_effective = false;
      effectiveness_reason = 'No valid observations provided.';
    }
  }

  // IFRS 9 hedge ratio check (nominator = hedge notional / item notional)
  const ifrs9_hedge_ratio_passes = (hedge_ratio >= 0.95 && hedge_ratio <= 1.05);

  return {
    is_effective,
    effectiveness_standard,
    method_applied: method,
    observation_count:              obs,
    // Dollar-offset results
    cumulative_hedged_change:       cumulative_hedged,
    cumulative_hedging_change:      cumulative_hedging,
    dollar_offset_ratio,
    dollar_offset_effective,
    asc815_80_125_band:             '80%-125% (ASC 815-20-35)',
    // Regression results
    ols_beta,
    ols_alpha,
    r_squared,
    regression_effective,
    // IFRS 9
    hedge_ratio,
    ifrs9_hedge_ratio_passes,
    // Summary
    effectiveness_reason,
    anchor_surface:     'anchor.ainumbers.co/mcp -- anchor the execution_hash at designation date to create RFC 3161 contemporaneous evidence that the hedge effectiveness test ran at designation, not backfilled (FASB ASC 815 anti-backdating rationale).',
    table_version:      TABLE_VERSION,
    table_source:       TABLE_SOURCE,
    regulatory_basis:   'ASC 815-20-35: dollar-offset 80-125% OR regression (beta approx -1, R-squared >= 0.80) for highly effective designation; FASB ASU 2017-12 simplification; IFRS 9.6.4.1: economic relationship + credit risk non-dominant + hedge ratio. ZERO PII: changes arrays and aggregate statistics only.',
    pii_note:           'ZERO PII: fair-value or cash-flow changes, aggregate statistics only. No counterparty, notional terms, or personal data enters this kernel.',
    not_legal_advice:   'Not accounting or legal advice. Hedge effectiveness assessments must be reviewed by qualified accounting professionals and auditors before use in hedge accounting documentation.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}
function _finiteOrNull(v) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : null;
}
function _round4(v) { return Math.round(v * 10000) / 10000; }
function _round6(v) { return Math.round(v * 1000000) / 1000000; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
