# On-Chain Repo Haircut Calculator

Compute repo haircut with Canton 24/7 collateral valuation versus legacy weekend gap. Applies Basel CRE22 supervisory haircuts and BCBS d349 SFT minimum haircut floors. GMRA/SFTR reporting output.

- Page: https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.html
- Markdown twin: https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.md
- MCP tool: calculate_repo_haircut (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collateral_type (string, required)
- notional (number, required)
- currency (string, optional)
- tenor (string, required)
- counterparty (string, required)
- canton_247 (boolean, optional)
- custodied (boolean, optional)
- cross_border (boolean, optional)
- concentration_pct (number, optional)

## Outputs

- base_haircut_pct (number, optional)
- total_haircut_pct (number, optional)
- sft_floor_applied (boolean, optional)
- initial_margin (number, optional)
- vm_threshold (number, optional)
- canton_haircut_pct (number, optional)
- legacy_haircut_pct (number, optional)
- weekend_saving_pct (number, optional)
- flags (array, optional)

## Sample

```json
{
  "collateral_type": "ust_10y",
  "notional_usd": 10000000,
  "tenor": "overnight",
  "cross_border": false,
  "counterparty_type": "bank",
  "canton247": true,
  "concentration_pct": 10
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_repo_haircut` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
