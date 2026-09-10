# Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator

Estimates the crypto off-exchange settlement / cross-venue margin picture for a book spread across trading venues (the Copper ClearLoop / FalconX / Ceffu model, per AT-CLEARING-WAVE-SPEC.md CW-1): the net cross-venue margin requirement after a declared netting offset against the sum of each venue's own isolated margin, the capital freed and capital efficiency of MPC-custody off-exchange settlement vs on-exchange isolated margin, the financing cost of running the book at a declared leverage multiple checked against a caller-declared program leverage cap (e.g. ClearLoop Loans up to 4x / FalconX up to 5x), and a plain counterparty/custody-risk framing string. Netting percentages, leverage caps and program names are caller-declared, version-pinned fixtures, never fetched or hard-coded. Distinct from the shipped TradFi treasury-clearing cluster (art-48..51), which addresses the US Treasury cash/repo clearing mandate and CME-FICC Combined Portfolio margining - this node is the crypto prime-brokerage analogue. This receipt attests our computation over the user's declared positions and venue terms - it does not verify those positions and is not a margin call, a settlement instruction, or investment advice.

- Page: https://ainumbers.co/chaingraph/art-406-cross-venue-margin-estimator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-406-cross-venue-margin-estimator.md
- MCP tool: estimate_cross_venue_margin_capital (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- constants_version (unknown, required)
- cross_margin_offset_pct (number, optional): Percentage value
- custody_model (unknown, required)
- financing_apr_pct (number, optional): Percentage value
- financing_horizon_days (number, optional): Duration in days
- leverage_multiple (number, optional)
- leverage_program_cap_multiple (number, optional)
- leverage_program_name (unknown, required)
- venue_positions (array, required)

## Outputs

- capital_efficiency_pct (number, optional)
- capital_freed_usd (integer, optional)
- constants_version (string, optional)
- counterparty_risk_framing (string, optional)
- cross_margin_offset_pct (number, optional)
- cross_venue_margin_requirement_usd (integer, optional)
- custody_model (string, optional)
- disambiguation (string, optional)
- financed_amount_usd (number, optional)
- financing_apr_pct (integer, optional)
- financing_cost_usd (number, optional)
- financing_horizon_days (integer, optional)
- financing_notional_usd (integer, optional)
- leverage_multiple (integer, optional)
- leverage_program_cap_multiple (integer, optional)
- leverage_program_name (string, optional)
- sum_isolated_margin_usd (integer, optional)
- venue_count (integer, optional)
- venue_positions (array, optional)

## Sample

```json
{
  "venue_positions": [
    {
      "venue": "bybit",
      "gross_notional_usd": 500000,
      "isolated_margin_requirement_usd": 100000
    },
    {
      "venue": "deribit",
      "gross_notional_usd": 300000,
      "isolated_margin_requirement_usd": 60000
    },
    {
      "venue": "okx",
      "gross_notional_usd": 200000,
      "isolated_margin_requirement_usd": 40000
    }
  ],
  "cross_margin_offset_pct": 0.35,
  "leverage_multiple": 3,
  "leverage_program_cap_multiple": 4,
  "leverage_program_name": "ClearLoop Loans",
  "financing_apr_pct": 8,
  "financing_horizon_days": 30,
  "custody_model": "mpc_off_exchange_bankruptcy_remote",
  "constants_version": "2026-07-19.clearloop-falconx-v1"
}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_cross_venue_margin_capital` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
