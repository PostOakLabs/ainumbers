import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-153-emir-trade-report-field-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_emir_trade_report',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EMIR Refit ISO 20022 (auth.030): a reportable derivative needs both LEIs, a UTI, a UPI, a finite
// notional + currency, effective/maturity dates, asset class, and a valid action type. Caller passes
// the decoded report; this kernel validates the required-field subset structurally. Zero network.
export function compute(pp) {
  const { report = {} } = pp;
  const ACTIONS = ['New', 'Modify', 'Correct', 'Error', 'Terminate', 'Position', 'Revive', 'Valuation'];
  const ASSET = ['IR', 'CR', 'EQ', 'CO', 'FX'];
  const leiOk = (x) => typeof x === 'string' && /^[A-Z0-9]{18}[0-9]{2}$/.test(x);
  const notional = Number.isFinite(Number(report.notional)) ? Number(report.notional) : NaN;
  const notional_ok = Number.isFinite(notional) && notional >= 0;

  const checks = {
    action_type: ACTIONS.includes(report.action_type),
    reporting_cpty_lei: leiOk(report.reporting_counterparty_lei),
    other_cpty_lei: leiOk(report.other_counterparty_lei),
    uti: typeof report.uti === 'string' && report.uti.length > 0,
    upi: typeof report.upi === 'string' && report.upi.length > 0,
    notional: notional_ok,
    currency: typeof report.notional_currency === 'string' && /^[A-Z]{3}$/.test(report.notional_currency),
    effective_date: typeof report.effective_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(report.effective_date),
    asset_class: ASSET.includes(report.asset_class),
  };
  const missing_fields = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const report_valid = missing_fields.length === 0;

  const compliance_flags = { EMIR_TRADE_REPORT_ASSESSED: true };
  compliance_flags[report_valid ? 'EMIR_REPORT_VALID' : 'EMIR_REPORT_INVALID'] = true;
  if (!notional_ok) compliance_flags.NOTIONAL_NON_FINITE_OR_MISSING = true;

  return {
    output_payload: {
      report_valid,
      field_count_checked: Object.keys(checks).length,
      missing_fields,
      action_type: report.action_type ?? null,
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
