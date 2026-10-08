# EU AML Single Rulebook (AMLR)

Obliged-entity scope > UBO / beneficial ownership > cash limit & EDD classification > CDD policy > readiness. AMLR (Regulation (EU) 2024/1624) applies from 10 Jul 2027.

- Page: https://ainumbers.co/chaingraph/chains/amlr-single-rulebook.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/amlr-single-rulebook.md

## Workflow chain: EU AML Single Rulebook (AMLR)

Obliged-entity scope > UBO / beneficial ownership > cash limit & EDD classification > CDD policy > readiness. AMLR (Regulation (EU) 2024/1624) applies from 10 Jul 2027.

Domain: EU Digital ID & Consumer Credit

### Steps

1. 485-amlr-obliged-entity-scope-mapper
   entity_type and obligations feed Stage 2 UBO mapping
2. 486-amlr-ubo-beneficial-ownership-mapper
   ubo_tier and edd_triggers feed Stage 3 cash/EDD classifier
3. 487-amlr-cash-limit-edd-classifier
   cash_verdict and edd_flags feed Stage 4 CDD policy builder
4. 488-amlr-cdd-policy-builder
   cdd_tier_config feeds Stage 5 readiness
5. 350-amla-2027-readiness-gap-analyzer
   Exports composite AML Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
