# Sustainability Disclosure & SFDR Compliance

SFDR Article 8/9 fund classification > EU Taxonomy CapEx/revenue alignment > CSRD double-materiality > TCFD/ISSB climate risk > SFDR PAI indicator calculation: composite sustainability-disclosure mandate.

- Page: https://ainumbers.co/chaingraph/chains/sustainability-disclosure-sfdr.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sustainability-disclosure-sfdr.md

## Workflow chain: Sustainability Disclosure & SFDR Compliance

SFDR Article 8/9 fund classification > EU Taxonomy CapEx/revenue alignment > CSRD double-materiality > TCFD/ISSB climate risk > SFDR PAI indicator calculation: composite sustainability-disclosure mandate.

Domain: Climate & Sustainable Finance

### Steps

1. 353-sfdr-article89-fund-classification-checker
   article_classification and disclosure_obligations feed Stage 2 taxonomy alignment
2. 354-eu-taxonomy-capex-revenue-alignment-scorer
   taxonomy_capex_score and dnsh_flags feed Stage 3 CSRD double-materiality
3. 355-csrd-double-materiality-assessment-builder
   material_topics and impact_scores feed Stage 4 TCFD/ISSB climate risk builder
4. 364-tcfd-issb-climate-risk-builder
   climate_risk_disclosure and scenarios feed Stage 5 SFDR PAI calculator
5. 384-sfdr-pai-indicator-calculator
   pai_indicators and compliance_assessment - final SFDR disclosure mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
