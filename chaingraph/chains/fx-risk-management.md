# FX Risk Management & Hedging

FX hedging instrument comparison > SWIFT GPI rail comparison > currency risk exposure heatmap > IBOR transition reference check: composite FX risk management mandate.

- Page: https://ainumbers.co/chaingraph/chains/fx-risk-management.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/fx-risk-management.md

## Workflow chain: FX Risk Management & Hedging

FX hedging instrument comparison > SWIFT GPI rail comparison > currency risk exposure heatmap > IBOR transition reference check: composite FX risk management mandate.

Domain: Corporate Treasury & FX

### Steps

1. 211-fx-hedging-instrument-comparison
   hedging_instruments and cost_comparison feed Stage 2 SWIFT GPI rail comparison
2. 212-swift-gpi-rail-comparator
   gpi_rail_performance and settlement_comparison feed Stage 3 currency risk heatmap
3. 213-currency-risk-exposure-heatmap
   currency_risk_exposure and var_estimates feed Stage 4 IBOR reference checker
4. 214-ibor-transition-reference-checker
   ibor_legacy_exposure and transition_plan - final FX risk management mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
