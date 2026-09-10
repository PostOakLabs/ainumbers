# Supervisory Scenario Replay (DFAST-lite)

Replays the Fed's published 2026 28-variable supervisory scenario paths (baseline and severely adverse, Q1:2026-Q1:2029) against user-supplied loss and PPNR coefficient functions, producing a quarterly P&L and capital walk. This is a replay of user functions over official published inputs, not the Fed's model and not a DFAST submission.

- Page: https://ainumbers.co/chaingraph/art-370-supervisory-scenario-replay.html
- Markdown twin: https://ainumbers.co/chaingraph/art-370-supervisory-scenario-replay.md
- MCP tool: replay_supervisory_scenario (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- loss_function (unknown, required)
- ppnr_function (unknown, required)
- quarterly_distribution_mn (unknown, required): Amount in millions
- rwa_mn (unknown, required): Amount in millions
- scenario (unknown, required)
- starting_capital_mn (unknown, required): Amount in millions
- tax_rate (unknown, required)

## Outputs

- ending_capital_mn (number, optional)
- not_a_submission (string, optional)
- quarters (array, optional)
- scenario (string, optional)
- scenario_release_date (string, optional)
- scenario_set_digest (string, optional)
- scenario_source_url (string, optional)
- starting_capital_mn (integer, optional)
- trough_capital_mn (integer, optional)
- trough_capital_ratio_pct (number, optional)
- trough_quarter (string, optional)

## Sample

```json
{
  "scenario": "severely_adverse",
  "starting_capital_mn": 5000,
  "rwa_mn": 40000,
  "tax_rate": 0.21,
  "loss_function": {
    "intercept": 50,
    "coefficients": {
      "unemployment_rate": 25,
      "house_price_index": -0.4,
      "cre_price_index": -0.3
    }
  },
  "ppnr_function": {
    "intercept": 300,
    "coefficients": {
      "real_gdp_growth": 8,
      "treasury_10y_yield": 10
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `replay_supervisory_scenario` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
