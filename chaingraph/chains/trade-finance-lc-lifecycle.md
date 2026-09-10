# Trade Finance Letter of Credit Lifecycle

LC analysis > MT700 field validation > DC vs LC comparison > forfaiting/factoring economics > trade sanctions compliance: composite trade-finance LC mandate.

- Page: https://ainumbers.co/chaingraph/chains/trade-finance-lc-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/trade-finance-lc-lifecycle.md

## Workflow chain: Trade Finance Letter of Credit Lifecycle

LC analysis > MT700 field validation > DC vs LC comparison > forfaiting/factoring economics > trade sanctions compliance: composite trade-finance LC mandate.

Domain: Digital Trade

### Steps

1. 50-trade-finance-lc-analyser
   lc_terms and discrepancy_risk feed Stage 2 MT700 field validation
2. 420-mt700-lc-field-validator
   mt700_field_errors and swift_compliance feed Stage 3 DC vs LC analysis
3. 423-dc-vs-lc-analyzer
   instrument_comparison and cost_delta feed Stage 4 forfaiting/factoring economics
4. 425-forfaiting-factoring-economics
   financing_economics and receivable_yield feed Stage 5 trade sanctions check
5. 426-trade-sanctions-compliance-checker
   sanctions_clearance and composite_trade_mandate - final trade finance mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
