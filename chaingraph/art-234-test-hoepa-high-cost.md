# HOEPA High-Cost Mortgage Trigger Test

Tests all three HOEPA high-cost mortgage triggers per Reg Z §1026.32(a)(1): (i) APR trigger (APOR+6.5pp first-lien, APOR+8.5pp subordinate or dwelling below $50k); (ii) points-and-fees trigger (5% of loan or $1,380 floor, 2026, FR 2025-22773); (iii) prepayment penalty trigger (>36 months or >2% of prepaid amount). Outputs is_high_cost plus which triggers fired. Consumes art-220 (lookup_reg_z_thresholds) for the pinned HOEPA threshold table. Use test_hpml_escrow (art-235) for HPML escrow, not HOEPA. Use check_qm_points_and_fees (art-218) for the QM points-and-fees ability-to-repay test.

- Page: https://ainumbers.co/chaingraph/art-234-test-hoepa-high-cost.html
- Markdown twin: https://ainumbers.co/chaingraph/art-234-test-hoepa-high-cost.md
- MCP tool: test_hoepa_high_cost (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- apor_pct (number, optional): Percentage value
- apr_pct (number, optional): Percentage value
- has_prepayment_penalty (boolean, required)
- is_small_dwelling (boolean, required)
- lien_type (unknown, required)
- loan_amount (number, optional)
- points_and_fees (number, optional)
- prepayment_penalty_pct (number, optional): Percentage value
- prepayment_penalty_period_months (number, optional)
- year (number, optional)

## Outputs

- apor_pct (number, optional)
- apr_pct (number, optional)
- apr_spread_pct (integer, optional)
- apr_threshold_basis (string, optional)
- apr_threshold_pct (number, optional)
- apr_trigger_met (boolean, optional)
- consumes (string, optional)
- fr_citation (string, optional)
- has_prepayment_penalty (boolean, optional)
- is_high_cost (boolean, optional)
- is_small_dwelling (boolean, optional)
- lien_type (string, optional)
- loan_amount (integer, optional)
- note (string, optional)
- points_and_fees (integer, optional)
- points_fees_floor (integer, optional)
- points_fees_limit (integer, optional)
- points_fees_limit_pct (integer, optional)
- points_fees_trigger_met (boolean, optional)
- pp_pct_limit (integer, optional)
- pp_period_limit_months (integer, optional)
- prepayment_penalty_pct (integer, optional)
- prepayment_penalty_period_months (integer, optional)
- prepayment_penalty_trigger_met (boolean, optional)
- regulatory_basis (string, optional)
- table_version (string, optional)
- triggers_fired (array, optional)
- year (integer, optional)

## Sample

```json
{
  "apr_pct": 12.5,
  "apor_pct": 5.5,
  "lien_type": "first",
  "is_small_dwelling": false,
  "loan_amount": 400000,
  "points_and_fees": 5000,
  "has_prepayment_penalty": false,
  "prepayment_penalty_period_months": 0,
  "prepayment_penalty_pct": 0,
  "year": 2026
}
```

## Verify

Run the sample policy_parameters through MCP tool `test_hoepa_high_cost` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
