# Derivatives Margin Workbench

Computes three related derivatives calculations from one declared position: event-market linear PnL (settlement vs strike, scalar payoff), margin health (unrealized PnL, buffer, liquidation price, leverage) against a caller-declared venue margin model (regulated-DCM or offshore-perp class, with its own initial/maintenance margin rates rather than an internal per-venue lookup table), and, when a second position is supplied, two-leg correlation-VaR cross-margin efficiency (siloed vs shared capital requirement). Scope: closed-form pedagogical approximations of the same computations live risk engines run, not a stress-grid or SPAN-style margin system, and not financial advice.

- Page: https://ainumbers.co/tools/656-derivatives-margin-workbench.html
- Markdown twin: https://ainumbers.co/tools/656-derivatives-margin-workbench.md
- MCP tool: compute_derivatives_margin_workbench (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "event_market": {
    "side": "long",
    "strike": 3.5,
    "settlement_value": 4.1,
    "unit_value": 200,
    "n_contracts": 1,
    "min_price": 0,
    "max_price": 10
  },
  "margin": {
    "side": "long",
    "entry_price": 50000,
    "mark_price": 52000,
    "notional": 50000,
    "margin_posted": 8000,
    "margin_mode": "isolated",
    "venue_margin_model": {
      "class": "regulated_dcm",
      "label": "CME-style regulated DCM",
      "imr": 0.1,
      "mmr": 0.05
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_derivatives_margin_workbench` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
