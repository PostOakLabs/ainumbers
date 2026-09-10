# Card Scheme Dispute Management

Card dispute reason-code mapping > card economics optimisation > chargeback representment building: composite card scheme dispute management mandate.

- Page: https://ainumbers.co/chaingraph/chains/card-scheme-dispute-management.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/card-scheme-dispute-management.md

## Workflow chain: Card Scheme Dispute Management

Card dispute reason-code mapping > card economics optimisation > chargeback representment building: composite card scheme dispute management mandate.

Domain: Fraud & Dispute

### Steps

1. 227-card-dispute-reason-code-mapper
   dispute_reason_codes and representment_eligibility feed Stage 2 card economics optimisation
2. 85-card-economics-optimizer
   card_cost_impact and dispute_economics feed Stage 3 chargeback representment builder
3. 41-chargeback-representment-builder
   representment_package and composite_dispute_mandate - final card dispute mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
