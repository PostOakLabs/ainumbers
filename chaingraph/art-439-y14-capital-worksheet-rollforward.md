# FR Y-14 Capital Worksheet Roll-Forward & Cross-Check

Rolls forward a caller-declared FR Y-14A/Q capital worksheet (CET1, additional Tier 1, Tier 2) from beginning balance through period additions and deductions to an ending balance, applies a caller-declared published-scenario adjustment (e.g. a Federal Reserve DFAST/CCAR severely-adverse published-scenario delta), and cross-checks the computed ending total capital against a caller-declared reported total-capital figure sourced from another schedule (e.g. FR Y-9C Schedule HC-R, art-436) within a caller-declared tolerance. Not a filer - produces evidence artifacts and worksheet totals only, never a submission. All roll-forward line items, the scenario adjustment amount, and the cross-check reference figure are caller-declared; this tool performs only roll-forward arithmetic (beginning + additions - deductions + scenario adjustment = ending) and a tolerance comparison, never capital-component classification, scenario modeling, or projection - firm capital-planning models (PPNR, loss forecasts, scenario translation into balance-sheet impact) stay strictly outside this boundary. Complements art-436 (BHC Schedule HC-R capital) as an independent roll-forward/cross-check, not a replacement for it.

- Page: https://ainumbers.co/chaingraph/art-439-y14-capital-worksheet-rollforward.html
- Markdown twin: https://ainumbers.co/chaingraph/art-439-y14-capital-worksheet-rollforward.md
- MCP tool: rollforward_y14_capital_worksheet (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- additions (number, required)
- beginning_balances (number, required)
- constants_version (unknown, required)
- cross_check (unknown, required)
- deductions (number, required)
- entity_id (unknown, required)
- published_scenario (number, required)
- reporting_period (unknown, required)

## Outputs

- boundary_note (string, optional)
- constants_version (string, optional)
- cross_check (object, optional)
- ending_tier1_capital_usd (integer, optional)
- ending_total_capital_usd (integer, optional)
- entity_id (string, optional)
- published_scenario (object, optional)
- report_form (string, optional)
- reporting_period (string, optional)
- rollforward (object, optional)
- worksheet (string, optional)

## Sample

```json
{
  "entity_id": "FDIC-CERT-3510",
  "reporting_period": "2026-03-31",
  "constants_version": "2026-07-23.y14-capital-rollforward-v1",
  "beginning_balances": {
    "cet1": 180000000,
    "at1": 8000000,
    "t2": 14000000
  },
  "additions": {
    "cet1": 9000000,
    "at1": 0,
    "t2": 1000000
  },
  "deductions": {
    "cet1": 2130000,
    "at1": 0,
    "t2": 0
  },
  "published_scenario": {
    "name": "2026 Federal Reserve Severely Adverse Scenario",
    "citation": "12 CFR 252.146; FRB DFAST 2026 Scenarios, published 2026-02-06",
    "cet1_adjustment_usd": 0,
    "at1_adjustment_usd": 0,
    "t2_adjustment_usd": 0
  },
  "cross_check": {
    "reported_total_capital_usd": 209870000,
    "tolerance_usd": 1000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `rollforward_y14_capital_worksheet` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
