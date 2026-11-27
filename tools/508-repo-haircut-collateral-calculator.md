# On-Chain Repo Haircut Calculator

Compute repo haircut with Canton 24/7 collateral valuation versus legacy weekend gap. Applies Basel CRE22 supervisory haircuts and BCBS d349 SFT minimum haircut floors. GMRA/SFTR reporting output.

- Page: https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.html
- Markdown twin: https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.md
- MCP tool: calculate_repo_haircut (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collateral_type (string, optional): Collateral class (case-insensitive). Unrecognised values fall back to a 4.0 percent base haircut.
- notional_usd (number, required): Repo notional in US dollars. A missing or non-numeric value is treated as 0, which yields zero margin.
- tenor (string, optional): Repo tenor (case-insensitive). 6m and open_term add a roll-risk adjustment.
- counterparty_type (string, optional): Counterparty type (case-insensitive). hedge_fund adds a counterparty surcharge; any other value, for example bank, adds none.
- canton247 (boolean, optional): True to value on Canton 24/7 atomic settlement (no weekend-gap adjustment) when computing initial margin.
- cross_border (boolean, optional): True to add the cross-border adjustment.
- concentration_pct (number, optional): Collateral concentration in percent. Above 20 adds a concentration adjustment.

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
