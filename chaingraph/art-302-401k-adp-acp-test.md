# 401(k) ADP/ACP Nondiscrimination Tester

Runs the IRC §401(k)(3) Actual Deferral Percentage test and the §401(m)(2) Actual Contribution Percentage test from supplied HCE vs NHCE deferral/match percentages (current-year or prior-year method), applying the fixed statutory permitted-disparity limits (1.25x, or 2 percentage points and 2x, whichever is greater). ACP is optional. Returns per-test pass/fail and the percentage-point excess if failed - a simplified excess figure, not a full leveling-method dollar correction schedule. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-302-401k-adp-acp-test.html
- Markdown twin: https://ainumbers.co/chaingraph/art-302-401k-adp-acp-test.md
- MCP tool: run_401k_adp_acp_test (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- acp_hce_pct (unknown, required): Percentage value
- acp_nhce_pct (unknown, required): Percentage value
- adp_hce_pct (unknown, required): Percentage value
- adp_nhce_pct (unknown, required): Percentage value
- method (unknown, required)

## Outputs

- acp (object, optional)
- adp (object, optional)
- all_tests_pass (boolean, optional)
- error (string, optional)
- method (string, optional)

## Sample

```json
{
  "method": "current_year",
  "adp_hce_pct": 0.06,
  "adp_nhce_pct": 0.05,
  "acp_hce_pct": 0.04,
  "acp_nhce_pct": 0.035
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_401k_adp_acp_test` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
