import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-439-y14-capital-worksheet-rollforward';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'rollforward_y14_capital_worksheet',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FR Y-14A/Q capital worksheet roll-forward + inter-schedule cross-check
// kernel, per BANKING-OCG-BUILD-SPEC.md §5.1. Given caller-declared beginning
// balances, period additions/deductions, and a caller-declared published-
// scenario adjustment (e.g. a Federal Reserve DFAST/CCAR severely-adverse
// published-scenario delta) per capital component (CET1, additional Tier 1,
// Tier 2), rolls each component forward to an ending balance and cross-checks
// the resulting ending total capital against a caller-declared reported
// total-capital figure sourced from another schedule (e.g. FR Y-9C Schedule
// HC-R, art-436) within a caller-declared tolerance. BOUNDARY: every roll-
// forward line item, the scenario adjustment amount, and the cross-check
// reference figure are caller-declared; this kernel performs only roll-
// forward arithmetic (beginning + additions - deductions + scenario
// adjustment = ending) and a tolerance comparison. It does not model capital
// plans, forecast PPNR/losses, or translate a scenario into balance-sheet
// impact -- firm capital-planning models stay strictly outside this
// boundary. Pure ECMA-262 arithmetic only -- no Math.pow, no
// Date.now/new Date(), no Math.random, no Intl/toLocaleString.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function rollComponent(pp, key) {
  const beginning = safeNum(pp.beginning_balances && pp.beginning_balances[key], 0);
  const additions = safeNum(pp.additions && pp.additions[key], 0);
  const deductions = safeNum(pp.deductions && pp.deductions[key], 0);
  const scenarioAdj = safeNum(pp.published_scenario && pp.published_scenario[key + '_adjustment_usd'], 0);
  const ending = r2(beginning + additions - deductions + scenarioAdj);
  return { beginning_usd: r2(beginning), additions_usd: r2(additions), deductions_usd: r2(deductions), scenario_adjustment_usd: r2(scenarioAdj), ending_usd: ending };
}

export function compute(pp) {
  pp = pp || {};
  const entityId = String(pp.entity_id || '').trim();
  const reportingPeriod = String(pp.reporting_period || '').trim();
  const constantsVersion = String(pp.constants_version || '').trim();
  const scenarioName = String((pp.published_scenario && pp.published_scenario.name) || '').trim();
  const scenarioCitation = String((pp.published_scenario && pp.published_scenario.citation) || '').trim();

  const cet1 = rollComponent(pp, 'cet1');
  const at1 = rollComponent(pp, 'at1');
  const t2 = rollComponent(pp, 't2');

  const endingTier1Usd = r2(cet1.ending_usd + at1.ending_usd);
  const endingTotalCapitalUsd = r2(endingTier1Usd + t2.ending_usd);

  const crossCheck = pp.cross_check || {};
  const reportedTotalCapitalUsd = safeNum(crossCheck.reported_total_capital_usd, null);
  const toleranceUsd = safeNum(crossCheck.tolerance_usd, 0);
  const hasReference = reportedTotalCapitalUsd !== null;
  const deltaUsd = hasReference ? r2(endingTotalCapitalUsd - reportedTotalCapitalUsd) : null;
  const crossCheckPass = hasReference ? Math.abs(deltaUsd) <= toleranceUsd : null;

  const compliance_flags = [];
  if (!entityId) compliance_flags.push('Y14RF_ENTITY_ID_MISSING');
  if (!reportingPeriod) compliance_flags.push('Y14RF_REPORTING_PERIOD_MISSING');
  if (!constantsVersion) compliance_flags.push('Y14RF_CONSTANTS_VERSION_UNPINNED');
  if (cet1.ending_usd < 0) compliance_flags.push('Y14RF_CET1_ENDING_NEGATIVE');
  if (at1.ending_usd < 0) compliance_flags.push('Y14RF_AT1_ENDING_NEGATIVE');
  if (t2.ending_usd < 0) compliance_flags.push('Y14RF_T2_ENDING_NEGATIVE');
  if (hasReference && !crossCheckPass) compliance_flags.push('Y14RF_CROSS_CHECK_MISMATCH');
  if (!hasReference) compliance_flags.push('Y14RF_CROSS_CHECK_REFERENCE_ABSENT');

  const output_payload = {
    entity_id: entityId,
    reporting_period: reportingPeriod,
    report_form: 'FR Y-14A/Q',
    worksheet: 'Regulatory Capital Instruments and Components Roll-Forward',
    constants_version: constantsVersion,
    published_scenario: { name: scenarioName, citation: scenarioCitation },
    rollforward: { cet1, at1, t2 },
    ending_tier1_capital_usd: endingTier1Usd,
    ending_total_capital_usd: endingTotalCapitalUsd,
    cross_check: {
      reported_total_capital_usd: hasReference ? r2(reportedTotalCapitalUsd) : null,
      tolerance_usd: r2(toleranceUsd),
      delta_usd: deltaUsd,
      pass: crossCheckPass,
    },
    boundary_note: 'Every roll-forward line item, the scenario adjustment amount, and the cross-check reference figure are caller-declared; this kernel performs only roll-forward arithmetic and a tolerance comparison. It does not model capital plans, forecast PPNR/losses, or translate a scenario into balance-sheet impact -- firm capital-planning models stay strictly outside this boundary.',
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
