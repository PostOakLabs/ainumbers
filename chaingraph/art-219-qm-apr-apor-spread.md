# QM APR-APOR Spread Classifier

QM APR-APOR spread test per Reg Z §1026.43(e)(2)(vi) and §1026.43(b)(4). Classifies a loan as general_qm_safe_harbor, general_qm_rebuttable_presumption, or general_qm_fail based on spread versus APOR and HPCT threshold. Size-adjusted thresholds for first-lien standard (2.25 pp), small loan (3.5 pp), manufactured housing (6.5 pp), and subordinate lien (3.5 pp). Caller must supply APOR from the FFIEC weekly rate spread table.

- Page: https://ainumbers.co/chaingraph/art-219-qm-apr-apor-spread.html
- Markdown twin: https://ainumbers.co/chaingraph/art-219-qm-apr-apor-spread.md
- MCP tool: classify_qm_apr_apor_spread (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- apor_pct (number, optional): Percentage value
- apr_pct (number, optional): Percentage value
- is_manufactured_housing (boolean, required)
- lien_type (unknown, required)
- loan_amount (number, optional)
- year (number, optional)

## Outputs

- apor_pct (integer, optional)
- applicable_threshold_pct (number, optional)
- apr_pct (number, optional)
- fr_citation (string, optional)
- general_qm_pass (boolean, optional)
- headroom_pct (number, optional)
- hpct_threshold_pct (number, optional)
- is_hpct (boolean, optional)
- is_manufactured_housing (boolean, optional)
- lien_type (string, optional)
- loan_amount (integer, optional)
- note (string, optional)
- qm_status (string, optional)
- regulatory_basis (string, optional)
- spread_pct (number, optional)
- threshold_basis (string, optional)
- year (integer, optional)

## Sample

```json
{
  "apr_pct": 6.875,
  "apor_pct": 5,
  "lien_type": "first",
  "loan_amount": 450000,
  "year": 2026
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_qm_apr_apor_spread` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
