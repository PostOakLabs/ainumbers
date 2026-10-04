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

### Ask your agent

Question: The desk priced a balance by multiplying the UI rate once more on top of the feed. Did that double-count the multiplier?
Run the AINumbers MCP tool `run_chain` with {"chain":"rhc-valuation-lint"} and read `art-319-rhc-valuation-linter.verdict`.
Re-run with `inputs` for `art-319-rhc-valuation-linter`, reusing the values that result echoed, with `computed_usd_value_under_test` set to 5000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/rhc-valuation-lint.html
