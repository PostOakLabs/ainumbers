import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-456-globe-safe-harbour-tests';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'evaluate_globe_safe_harbour_tests',
  mandate_type: 'compliance_control', gpu: false,
};

// GloBE transitional CbCR safe-harbour test evaluator kernel (OECD Pillar Two,
// Dec 2022 Agreed Administrative Guidance on the Transitional CbCR Safe
// Harbour). Runs the three independent per-jurisdiction tests -- de minimis,
// simplified ETR, routine profits -- and returns each as a separately gated
// verdict plus an overall safe_harbour_met / deemed_zero_topup flag (ANY ONE
// passing test satisfies the safe harbour). Pure arithmetic: elections, DTA
// characterization, and the SBIE amount itself are HUMAN JUDGMENT and enter
// here only as policy-parameter inputs (sbie_amount is supplied directly --
// recomputing it is art-455's job, not this kernel's). Thresholds and the
// simplified-ETR transition-rate table are versioned policy_parameters with
// OECD-published defaults, never hardcoded-only. NaN-safe. Zero network,
// zero PII.

const DEFAULT_DE_MINIMIS_REVENUE_EUR = 10_000_000;
const DEFAULT_DE_MINIMIS_PROFIT_EUR = 1_000_000;
const DEFAULT_SIMPLIFIED_ETR_RATES = { 2023: 0.15, 2024: 0.15, 2025: 0.16, 2026: 0.17 };

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

export function compute(pp) {
  pp = pp || {};

  const revenue_eur = n(pp.revenue_eur, 0);
  const profit_before_tax_eur = n(pp.profit_before_tax_eur, 0);
  const simplified_covered_taxes = n(pp.simplified_covered_taxes, 0);
  const fiscal_year = Math.round(n(pp.fiscal_year, 2024));
  const sbie_amount = n(pp.sbie_amount, 0);

  const de_minimis_revenue_threshold_eur = n(pp.de_minimis_revenue_threshold_eur, DEFAULT_DE_MINIMIS_REVENUE_EUR);
  const de_minimis_profit_threshold_eur = n(pp.de_minimis_profit_threshold_eur, DEFAULT_DE_MINIMIS_PROFIT_EUR);
  const simplified_etr_rate_table = (pp.simplified_etr_rate_table && typeof pp.simplified_etr_rate_table === 'object')
    ? pp.simplified_etr_rate_table
    : DEFAULT_SIMPLIFIED_ETR_RATES;

  const compliance_flags = [];

  // Test 1: de minimis -- both thresholds must hold.
  const de_minimis_revenue_ok = revenue_eur < de_minimis_revenue_threshold_eur;
  const de_minimis_profit_ok = profit_before_tax_eur < de_minimis_profit_threshold_eur;
  const de_minimis_pass = de_minimis_revenue_ok && de_minimis_profit_ok;
  const de_minimis_test = {
    test_id: 'de_minimis',
    pass: de_minimis_pass,
    reasoning: de_minimis_pass
      ? `Revenue EUR ${revenue_eur} < threshold EUR ${de_minimis_revenue_threshold_eur} AND profit before tax EUR ${profit_before_tax_eur} < threshold EUR ${de_minimis_profit_threshold_eur}.`
      : `Fails: revenue EUR ${revenue_eur} ${de_minimis_revenue_ok ? '<' : '>='} threshold EUR ${de_minimis_revenue_threshold_eur}; profit before tax EUR ${profit_before_tax_eur} ${de_minimis_profit_ok ? '<' : '>='} threshold EUR ${de_minimis_profit_threshold_eur}.`,
    inputs: { revenue_eur, profit_before_tax_eur, de_minimis_revenue_threshold_eur, de_minimis_profit_threshold_eur },
  };

  // Test 2: simplified ETR -- auto-pass on non-positive profit (ETR undefined).
  const applicable_rate = n(simplified_etr_rate_table[fiscal_year], n(simplified_etr_rate_table[String(fiscal_year)], null));
  const nonpositive_profit = profit_before_tax_eur <= 0;
  let simplified_etr_pass;
  let simplified_etr_value = null;
  let simplified_etr_reasoning;

  if (nonpositive_profit) {
    simplified_etr_pass = true;
    simplified_etr_reasoning = `Profit before tax EUR ${profit_before_tax_eur} is non-positive; simplified ETR is undefined per OECD guidance -- test auto-passes.`;
    compliance_flags.push('SIMPLIFIED_ETR_AUTO_PASS_NONPOSITIVE_PROFIT');
  } else if (applicable_rate === null) {
    simplified_etr_pass = false;
    simplified_etr_reasoning = `No transition rate found in simplified_etr_rate_table for fiscal_year ${fiscal_year}; cannot evaluate -- treated as fail.`;
    compliance_flags.push('SIMPLIFIED_ETR_NO_RATE_FOR_FISCAL_YEAR');
  } else {
    simplified_etr_value = simplified_covered_taxes / profit_before_tax_eur;
    simplified_etr_pass = simplified_etr_value >= applicable_rate;
    simplified_etr_reasoning = simplified_etr_pass
      ? `Simplified ETR ${(simplified_etr_value * 100).toFixed(2)}% >= applicable transition rate ${(applicable_rate * 100).toFixed(2)}% (FY${fiscal_year}).`
      : `Simplified ETR ${(simplified_etr_value * 100).toFixed(2)}% < applicable transition rate ${(applicable_rate * 100).toFixed(2)}% (FY${fiscal_year}).`;
  }

  const simplified_etr_test = {
    test_id: 'simplified_etr',
    pass: simplified_etr_pass,
    reasoning: simplified_etr_reasoning,
    inputs: {
      simplified_covered_taxes, profit_before_tax_eur, fiscal_year,
      applicable_rate, simplified_etr_value, nonpositive_profit,
    },
  };

  // Test 3: routine profits -- profit before tax <= supplied SBIE amount.
  const routine_profits_pass = profit_before_tax_eur <= sbie_amount;
  const routine_profits_test = {
    test_id: 'routine_profits',
    pass: routine_profits_pass,
    reasoning: routine_profits_pass
      ? `Profit before tax EUR ${profit_before_tax_eur} <= SBIE amount EUR ${sbie_amount}.`
      : `Profit before tax EUR ${profit_before_tax_eur} > SBIE amount EUR ${sbie_amount}.`,
    inputs: { profit_before_tax_eur, sbie_amount },
  };

  const tests = [de_minimis_test, simplified_etr_test, routine_profits_test];
  const safe_harbour_met = tests.some((t) => t.pass);
  const deemed_zero_topup = safe_harbour_met;

  compliance_flags.push('SAFE_HARBOUR_TESTS_EVALUATED');
  if (safe_harbour_met) compliance_flags.push('SAFE_HARBOUR_MET');
  else compliance_flags.push('SAFE_HARBOUR_NOT_MET');

  return {
    output_payload: {
      fiscal_year,
      tests,
      safe_harbour_met,
      deemed_zero_topup,
      passing_test_ids: tests.filter((t) => t.pass).map((t) => t.test_id),
    },
    compliance_flags,
  };
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
