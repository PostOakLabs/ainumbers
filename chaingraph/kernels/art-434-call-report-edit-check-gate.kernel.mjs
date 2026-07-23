import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-434-call-report-edit-check-gate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_call_report_edit_checks',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FFIEC Call Report published edit-check battery, per
// BANKING-OCG-BUILD-SPEC.md §4.1 ("published FFIEC edit checks as
// decision-gate nodes"). Consumes the art-432 (Schedule RC) and art-433
// (Schedule RC-R) output payloads and re-runs a curated set of FFIEC-style
// cross-schedule validity/quality edit checks -- the same class of check the
// FFIEC's own Call Report edit-check system runs against filed data before
// CDR publication. Each check yields a pass/fail verdict; the node's overall
// gate_status follows the §27 Human Accountability gate-policy vocabulary
// (`auto_pass` when every check passes, `review_required` when any FATAL
// check fails), so this node can sit directly in front of a §27
// dual_control/review_required gate on export or submission-evidence chains.
// BOUNDARY: this is a curated representative battery (balance identity,
// capital-stack ordering, ratio-vs-component consistency), not the FFIEC's
// full published edit-check catalog (thousands of checks) -- it does not
// claim FFIEC edit-check completeness. Pure ECMA-262 arithmetic only -- no
// Math.pow, no Date.now/new Date(), no Math.random, no Intl/toLocaleString.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function check(id, severity, description, passed) {
  return { id, severity, description, passed: !!passed };
}

export function compute(pp) {
  pp = pp || {};
  const rc = pp.rc_output_payload || {};
  const rcr = pp.rcr_output_payload || {};
  const roundingToleranceUsd = Math.max(0, safeNum(pp.rounding_tolerance_usd, 1));

  const compliance_flags = [];
  if (!pp.rc_output_payload) compliance_flags.push('EDITCHECK_RC_PAYLOAD_MISSING');
  if (!pp.rcr_output_payload) compliance_flags.push('EDITCHECK_RCR_PAYLOAD_MISSING');

  const totalAssetsUsd = safeNum(rc.total_assets_usd, 0);
  const totalLiabUsd = safeNum(rc.total_liabilities_usd, 0);
  const totalEquityUsd = safeNum(rc.total_equity_capital_usd, 0);
  const cet1Usd = safeNum(rcr.cet1_capital_usd, 0);
  const tier1Usd = safeNum(rcr.tier1_capital_usd, 0);
  const totalCapitalUsd = safeNum(rcr.total_capital_usd, 0);
  const totalRwaUsd = safeNum(rcr.total_rwa_usd, 0);
  const ratios = rcr.ratios || {};

  const checks = [
    // Type 1: intra-Schedule RC balance identity (mirrors art-432's own
    // check, re-verified here as a standalone gate input).
    check('EDIT-RC-01', 'fatal', 'Total assets (RCON2170) equals Total liabilities (RCON2948) plus Total equity capital (RCON3210), within rounding tolerance.',
      Math.abs(r2(totalAssetsUsd - (totalLiabUsd + totalEquityUsd))) <= roundingToleranceUsd),
    check('EDIT-RC-02', 'fatal', 'Total assets is non-negative.', totalAssetsUsd >= 0),
    check('EDIT-RC-03', 'fatal', 'Total equity capital is non-negative.', totalEquityUsd >= 0),
    // Type 2: cross-schedule RC <-> RC-R consistency and capital-stack
    // ordering (CET1 <= Tier1 <= Total capital), mirroring the published
    // FFIEC RC-R capital-component ordering edits.
    check('EDIT-RCR-01', 'fatal', 'CET1 capital does not exceed Tier 1 capital.', cet1Usd <= tier1Usd + roundingToleranceUsd),
    check('EDIT-RCR-02', 'fatal', 'Tier 1 capital does not exceed Total capital.', tier1Usd <= totalCapitalUsd + roundingToleranceUsd),
    check('EDIT-RCR-03', 'fatal', 'Total risk-weighted assets is positive.', totalRwaUsd > 0),
    check('EDIT-RCR-04', 'warning', 'Reported CET1 ratio is arithmetically consistent with CET1 capital / total RWA.',
      totalRwaUsd > 0 ? Math.abs(safeNum(ratios.cet1_ratio_pct, 0) - (cet1Usd / totalRwaUsd)) < 0.0005 : true),
    check('EDIT-RCR-05', 'warning', 'Reported total capital ratio is arithmetically consistent with Total capital / total RWA.',
      totalRwaUsd > 0 ? Math.abs(safeNum(ratios.total_capital_ratio_pct, 0) - (totalCapitalUsd / totalRwaUsd)) < 0.0005 : true),
    // Type 3: entity/period presence (a filed Call Report cannot be anonymous
    // or undated).
    check('EDIT-META-01', 'fatal', 'Schedule RC and RC-R report the same entity_id.', String(rc.entity_id || '') === String(rcr.entity_id || '') && !!rc.entity_id),
    check('EDIT-META-02', 'fatal', 'Schedule RC and RC-R report the same reporting_period.', String(rc.reporting_period || '') === String(rcr.reporting_period || '') && !!rc.reporting_period),
  ];

  const fatalFailures = checks.filter((c) => c.severity === 'fatal' && !c.passed);
  const warningFailures = checks.filter((c) => c.severity === 'warning' && !c.passed);
  for (const f of fatalFailures) compliance_flags.push('EDITCHECK_FAIL_' + f.id);
  for (const f of warningFailures) compliance_flags.push('EDITCHECK_WARN_' + f.id);

  // §27 Human Accountability gate-policy vocabulary (auto_pass |
  // review_required | dual_control(N) | escalate | hold | reject |
  // emergency_override) -- this node emits auto_pass/review_required only;
  // any escalation beyond that is a downstream HA gate's decision, not this
  // kernel's.
  const gateStatus = fatalFailures.length > 0 ? 'review_required' : 'auto_pass';

  const output_payload = {
    entity_id: String(rc.entity_id || rcr.entity_id || ''),
    reporting_period: String(rc.reporting_period || rcr.reporting_period || ''),
    report_form: 'FFIEC 031',
    rounding_tolerance_usd: roundingToleranceUsd,
    checks,
    check_count: checks.length,
    fatal_failure_count: fatalFailures.length,
    warning_failure_count: warningFailures.length,
    all_fatal_passed: fatalFailures.length === 0,
    gate_status: gateStatus,
    coverage_note: 'Curated representative edit-check battery (balance identity, capital-stack ordering, ratio-vs-component consistency, cross-schedule entity/period match) -- not the FFIEC published edit-check catalog\'s full check count.',
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
