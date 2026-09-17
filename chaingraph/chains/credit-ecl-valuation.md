# Credit ECL & Valuation

IFRS9 macro-overlay calculation > credit risk rating calibration > CVA calculator: composite credit ECL and valuation mandate.

- Page: https://ainumbers.co/chaingraph/chains/credit-ecl-valuation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/credit-ecl-valuation.md

## Workflow chain: Credit ECL & Valuation

IFRS9 macro-overlay calculation > credit risk rating calibration > CVA calculator: composite credit ECL and valuation mandate.

Domain: Bank Capital & Credit Risk

### Steps

1. 196-ifrs9-macro-overlay-calculator
   macro_overlay_adjustments and ecl_impact feed Stage 2 credit risk rating calibration
2. 197-credit-risk-rating-calculator
   credit_ratings and pd_estimates feed Stage 3 CVA calculator
3. 200-cva-calculator
   cva_fair_value and composite_credit_mandate - final credit ECL/valuation mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
