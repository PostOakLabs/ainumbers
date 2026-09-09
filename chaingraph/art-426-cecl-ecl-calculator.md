# CECL Expected Credit Loss & Allowance Calculator

Computes a deterministic CECL (Current Expected Credit Loss, ASC 326) allowance given caller-supplied PD/LGD/EAD curves, segment exposures, and forecast scenario weights, and reconciles the result against the prior period's allowance balance. Supports WARM (Weighted-Average Remaining Maturity - an annualized historical loss rate x remaining life practical-expedient approach), DCF (full contractual cash-flow projection, discounted at the effective interest rate, with period expected shortfall = contractual payment x PD x LGD), and straight loss-rate (a lifetime historical loss rate applied directly to exposure, no discounting) methods. BOUNDARY: PD/LGD/EAD curves and forecast scenario weights are policy inputs supplied by the caller - human or model judgment - and this kernel performs only the arithmetic combination into per-segment ECL and the allowance rollforward (beginning balance + provision expense - charge-offs + recoveries = ending allowance, checked against the newly computed required allowance). It does not estimate, calibrate, back-test, or validate any PD/LGD/EAD model. Distinct from IFRS9's 3-stage staging regime (see tools 196/198/204, a different accounting standard) - CECL recognizes lifetime expected credit losses from origination with no staging transfer logic.

- Page: https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.md
- MCP tool: calculate_cecl_ecl_allowance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- charge_offs_usd (number, optional): Amount in US dollars
- constants_version (unknown, required)
- forecast_weights (array, required)
- method (unknown, required)
- prior_allowance_balance_usd (number, optional): Amount in US dollars
- recoveries_usd (number, optional): Amount in US dollars
- segments (array, required)

## Outputs

- boundary_note (string, optional)
- charge_offs_usd (integer, optional)
- constants_version (string, optional)
- delta_vs_required_usd (integer, optional)
- disambiguation (string, optional)
- forecast_weights (array, optional)
- method (string, optional)
- prior_allowance_balance_usd (integer, optional)
- provision_expense_usd (integer, optional)
- reconciled_ending_allowance_usd (integer, optional)
- reconciliation_balanced (boolean, optional)
- recoveries_usd (integer, optional)
- segment_count (integer, optional)
- segments (array, optional)
- total_required_allowance_usd (integer, optional)

## Sample

```json
{
  "method": "warm",
  "constants_version": "2026-07-23.cecl-warm-v1",
  "prior_allowance_balance_usd": 500000,
  "charge_offs_usd": 20000,
  "recoveries_usd": 5000,
  "forecast_weights": [
    {
      "scenario": "baseline",
      "weight": 0.6
    },
    {
      "scenario": "downside",
      "weight": 0.4
    }
  ],
  "segments": [
    {
      "segment_id": "retail-auto",
      "exposure_balance_usd": 10000000,
      "remaining_life_years": 3,
      "scenarios": [
        {
          "scenario": "baseline",
          "annual_loss_rate_pct": 0.012
        },
        {
          "scenario": "downside",
          "annual_loss_rate_pct": 0.025
        }
      ]
    },
    {
      "segment_id": "retail-card",
      "exposure_balance_usd": 5000000,
      "remaining_life_years": 2,
      "scenarios": [
        {
          "scenario": "baseline",
          "annual_loss_rate_pct": 0.03
        },
        {
          "scenario": "downside",
          "annual_loss_rate_pct": 0.06
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_cecl_ecl_allowance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
