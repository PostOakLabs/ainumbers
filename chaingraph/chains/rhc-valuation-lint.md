# Robinhood Chain Valuation Lint

Single-step chain linting a Robinhood Chain stock-token USD valuation expression for the corporate-action double-count bug against the Chainlink 8-decimal feed.

- Page: https://ainumbers.co/chaingraph/chains/rhc-valuation-lint.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rhc-valuation-lint.md

## Workflow chain: Robinhood Chain Valuation Lint

Single-step chain linting a Robinhood Chain stock-token USD valuation expression for the corporate-action double-count bug against the Chainlink 8-decimal feed.

Domain: Digital-Asset Rails

### Steps

1. art-319-rhc-valuation-linter
   verdict, correct_value, and corrected_expression feed the lint record.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
