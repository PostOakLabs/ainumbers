# Valuation Double-Count / Decimal Linter

Lints Robinhood Chain stock-token USD valuation expressions for the double-count bug: the Chainlink price feed already includes corporate actions, so multiplying raw balance by price and then by uiMultiplier applies the same corporate action twice. Compares the tested valuation against the correct expression and flags the double-count when present, with the corrected formula returned. High hit-rate node for any developer writing a valuation path against 18-decimal stock tokens and an 8-decimal feed. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.md
- MCP tool: lint_stock_token_valuation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- applied_multiplier_in_expression (unknown, optional)
- chainlink_price_usd (unknown, optional): Amount in US dollars
- computed_usd_value_under_test (unknown, optional)
- raw_balance (unknown, optional)
- ui_multiplier (unknown, optional)

## Outputs

- computed_usd_value_under_test (integer, optional)
- correct_value (integer, optional)
- corrected_expression (string, optional)
- delta (integer, optional)
- discrepancy (string, optional)
- double_counted_value (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "raw_balance": 10,
  "chainlink_price_usd": 250,
  "ui_multiplier": 2,
  "computed_usd_value_under_test": 2500,
  "applied_multiplier_in_expression": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_stock_token_valuation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
