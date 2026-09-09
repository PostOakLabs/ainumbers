# TRID APR Accuracy Verifier

TRID APR accuracy check per Reg Z §1026.22(a). Verifies disclosed APR against actual APR within 1/8 percentage point tolerance for regular transactions or 1/4 percentage point for irregular transactions. Returns verdict: accurate, accurate_overstated_ok, understated_violation, or overstated_violation. APR understatement is a TILA violation; overstatement within tolerance is not.

- Page: https://ainumbers.co/chaingraph/art-217-trid-apr-accuracy.html
- Markdown twin: https://ainumbers.co/chaingraph/art-217-trid-apr-accuracy.md
- MCP tool: verify_trid_apr_accuracy (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- actual_apr_pct (number, optional): Percentage value
- disclosed_apr_pct (number, optional): Percentage value
- has_demand_feature (boolean, required)
- irregular_payment_amounts (boolean, required)
- irregular_payment_periods (boolean, required)
- num_advances (number, optional)

## Outputs

- abs_difference_pct (number, optional)
- actual_apr_pct (number, optional)
- difference_pct (number, optional)
- disclosed_apr_pct (number, optional)
- headroom_pct (number, optional)
- irregularity_reasons (array, optional)
- is_irregular_transaction (boolean, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- tolerance_pct (number, optional)
- verdict (string, optional)
- within_tolerance (boolean, optional)

## Sample

```json
{
  "disclosed_apr_pct": 6.875,
  "actual_apr_pct": 6.82
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_trid_apr_accuracy` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
