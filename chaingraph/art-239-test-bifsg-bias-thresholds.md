# BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169)

Tests BIFSG proxy bias thresholds under Colorado SB 21-169 / Reg. 10-1-1 for insurance AI models. ZERO PII: accepts aggregate regression outputs only (p-value, marginal effect %, premium delta per $1,000 face) - no individual applicant data, proxy scores, or demographic identifiers enter this kernel. Statistical prong: p < 0.05 AND marginal effect >= 5 percentage points. Premium prong (standalone): premium >= 5% above average per $1,000 face. Annual attestation due December 1: anchor execution_hash at anchor.ainumbers.co/mcp (COMPOSE, do not rebuild). Disambiguates from compute_disparity_metrics (art-229): that node applies ECOA/HMDA 4/5ths adverse impact rule for lending; this node applies Colorado SB 21-169 p-value and premium-rate bias tests for insurance AI.

- Page: https://ainumbers.co/chaingraph/art-239-test-bifsg-bias-thresholds.html
- Markdown twin: https://ainumbers.co/chaingraph/art-239-test-bifsg-bias-thresholds.md
- MCP tool: test_bifsg_bias_thresholds (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attestation_year (number, optional)
- marginal_effect_pct (number, optional): Percentage value
- model_type (unknown, required)
- p_value (number, optional)
- premium_per_1000_above_avg_pct (number, optional): Percentage value
- test_context (unknown, required)

## Outputs

- anchor_instruction (string, optional)
- attestation_deadline (string, optional)
- attestation_year (integer, optional)
- bias_detected (boolean, optional)
- do_now (array, optional)
- marginal_effect_flag (boolean, optional)
- marginal_effect_pct (number, optional)
- marginal_effect_threshold_pp (integer, optional)
- model_type (string, optional)
- p_value (number, optional)
- p_value_significant (boolean, optional)
- p_value_threshold (number, optional)
- pii_note (string, optional)
- premium_flag (boolean, optional)
- premium_per_1000_above_avg_pct (integer, optional)
- premium_threshold_pct (integer, optional)
- regulatory_basis (string, optional)
- remediation_required (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- test_context (string, optional)
- test_result (string, optional)

## Sample

```json
{
  "p_value": 0.02,
  "marginal_effect_pct": 7.3,
  "test_context": "approval_rate",
  "model_type": "underwriting",
  "attestation_year": 2026
}
```

## Verify

Run the sample policy_parameters through MCP tool `test_bifsg_bias_thresholds` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
