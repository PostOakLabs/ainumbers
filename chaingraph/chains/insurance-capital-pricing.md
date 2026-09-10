# Insurance Capital & Pricing Adequacy

Embedded insurance pricing model > Solvency II SCR calculation > NAIC RBC calculation > ratemaking adequacy assessment > claims reserve adequacy: composite insurance capital mandate.

- Page: https://ainumbers.co/chaingraph/chains/insurance-capital-pricing.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/insurance-capital-pricing.md

## Workflow chain: Insurance Capital & Pricing Adequacy

Embedded insurance pricing model > Solvency II SCR calculation > NAIC RBC calculation > ratemaking adequacy assessment > claims reserve adequacy: composite insurance capital mandate.

Domain: Insurance & Reinsurance

### Steps

1. 446-embedded-insurance-pricing-modeller
   pricing_model and embedded_structure feed Stage 2 Solvency II SCR calc
2. 447-solvency-ii-scr-calculator
   scr_capital_requirement and buffer feed Stage 3 NAIC RBC calculation
3. 457-naic-rbc-calculator
   rbc_ratio and jurisdiction_comparison feed Stage 4 ratemaking adequacy
4. 459-insurance-ratemaking-adequacy
   pricing_adequacy and combined_ratio feed Stage 5 claims reserve adequacy
5. 462-claims-reserve-adequacy-checker
   reserve_adequacy and composite_capital_mandate - final insurance capital mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
