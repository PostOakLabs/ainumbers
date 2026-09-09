# Direct Indexing Fit Screen

Computes a direct-indexing fit screen from caller-declared synthetic inputs: the net benefit in basis points is the declared expected tax alpha minus the declared fee delta (direct-indexing fee minus ETF expense ratio), rounded half-up to 2 decimal places with the arithmetic restated in a trace. The verdict reports the sign of that declared arithmetic only (FIT_POSITIVE, FIT_NEGATIVE, FIT_NEUTRAL). When the caller also declares a holding period and an alpha-exhaustion horizon, the node adds an exhaustion warning; when the caller declares a concentrated stock position, it adds an unwind note. This is a deterministic calculator over declared numbers: it is never advice, never an optimizer, and it prices no costs it has not been given. Zero storage, zero network, no runtime clock.

- Page: https://ainumbers.co/chaingraph/art-685-direct-indexing-fit-screen.html
- Markdown twin: https://ainumbers.co/chaingraph/art-685-direct-indexing-fit-screen.md
- MCP tool: compute_direct_indexing_fit_screen (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "portfolio_value": 250000,
  "di_fee_bps": 9,
  "etf_expense_bps": 3,
  "expected_tax_alpha_bps": 45
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_direct_indexing_fit_screen` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
