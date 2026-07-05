import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-266-reconcile-commission-statement';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

export function compute(policy_parameters) {
  const {
    statement_lines = [],
    tolerance_pct = 1.0,
  } = policy_parameters;

  const line_results = [];
  let total_expected = 0;
  let total_stated = 0;

  for (const line of statement_lines) {
    const {
      agent_id,
      gross_premium = 0,
      commission_rate_pct = 0,
      split_pct = 100,
      stated_commission = 0,
    } = line;

    // Expected = gross_premium * (commission_rate_pct/100) * (split_pct/100)
    const expected = Math.round(gross_premium * (commission_rate_pct / 100) * (split_pct / 100) * 100) / 100;
    const diff = Math.round((stated_commission - expected) * 100) / 100;
    const abs_diff = diff < 0 ? -diff : diff;
    const diff_pct = expected !== 0
      ? Math.round((abs_diff / expected) * 10000) / 100
      : (abs_diff > 0 ? 999 : 0);

    const within_tolerance = diff_pct <= tolerance_pct;

    let discrepancy_type = 'NONE';
    if (!within_tolerance) {
      if (Math.abs(stated_commission - expected) < 0.01) {
        discrepancy_type = 'NONE';
      } else if (gross_premium > 0 && Math.abs(stated_commission - gross_premium * (commission_rate_pct / 100)) < 0.01) {
        discrepancy_type = 'SPLIT_ERROR';
      } else if (gross_premium > 0 && Math.abs(stated_commission - gross_premium * (split_pct / 100) * (commission_rate_pct / 100) * 1.1) < 0.01) {
        discrepancy_type = 'RATE_ERROR';
      } else {
        discrepancy_type = 'UNKNOWN';
      }
    }

    line_results.push({
      agent_id,
      gross_premium,
      commission_rate_pct,
      split_pct,
      expected_commission: expected,
      stated_commission,
      discrepancy_amount: diff,
      discrepancy_pct: diff_pct,
      within_tolerance,
      discrepancy_type,
    });

    total_expected += expected;
    total_stated += stated_commission;
  }

  total_expected = Math.round(total_expected * 100) / 100;
  total_stated = Math.round(total_stated * 100) / 100;

  const total_diff = Math.round((total_stated - total_expected) * 100) / 100;
  const total_abs_diff = total_diff < 0 ? -total_diff : total_diff;
  const total_discrepancy_pct = total_expected !== 0
    ? Math.round((total_abs_diff / total_expected) * 10000) / 100
    : (total_abs_diff > 0 ? 999 : 0);

  const has_discrepancy = total_discrepancy_pct > tolerance_pct;

  // Classify overall discrepancy
  let discrepancy_classification = 'WITHIN_TOLERANCE';
  if (has_discrepancy) {
    const flagTypes = line_results.filter(l => !l.within_tolerance).map(l => l.discrepancy_type);
    if (flagTypes.every(t => t === 'RATE_ERROR')) discrepancy_classification = 'RATE_ERROR';
    else if (flagTypes.every(t => t === 'SPLIT_ERROR')) discrepancy_classification = 'SPLIT_ERROR';
    else discrepancy_classification = 'MIXED';
  }

  return {
    has_discrepancy,
    line_count: statement_lines.length,
    total_expected,
    total_stated,
    discrepancy_amount: total_diff,
    discrepancy_pct: total_discrepancy_pct,
    tolerance_pct,
    discrepancy_classification,
    line_results,
    table_version: 'COMMISSION-RECONCILIATION-V2024',
    table_source: 'Carrier commission reconciliation standard: gross_premium * commission_rate_pct * split_pct/100; ICM Commission Reconciliation Best Practices 2024; AICPA Industry Best Practices for Insurance Commission Accounting.',
    regulatory_basis: 'ASC 606 (Revenue from Contracts with Customers): agent commissions are variable consideration; discrepancies require investigation and potential revision of estimated transaction price. AFP Commission Management Survey 2024: 3-7% of commission payments contain material discrepancies. ZERO PII: premium amounts, rates, and split percentages only.',
    pii_note: 'ZERO PII: gross premium amounts, commission rates, and split percentages only. No agent name, SSN, NPN, policyholder, or personal data enters this kernel.',
    not_legal_advice: 'Not accounting or legal advice. Commission reconciliation results require review by qualified CPAs before financial statement adjustments.',
  };
}

export async function buildArtifact(policy_parameters, opts = {}) {
  const output_payload = compute(policy_parameters);
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    chaingraph_version: '0.4.0',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    policy_parameters,
    output_payload,
    execution_hash,
  };
}
