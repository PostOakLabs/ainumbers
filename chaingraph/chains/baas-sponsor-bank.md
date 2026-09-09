# BaaS / Sponsor-Bank Oversight & Readiness

Provider selection > FBO account structure > ledger architecture > BSA/AML control mapping > sponsor-bank readiness score.

- Page: https://ainumbers.co/chaingraph/chains/baas-sponsor-bank.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/baas-sponsor-bank.md

## Workflow chain: BaaS / Sponsor-Bank Oversight & Readiness

Provider selection > FBO account structure > ledger architecture > BSA/AML control mapping > sponsor-bank readiness score.

Domain: BaaS & Embedded Finance

### Steps

1. 152-baas-provider-comparator
   provider_shortlist feeds Stage 2 FBO structuring
2. 153-fbo-account-structure-simulator
   fbo_structure and reconciliation_model feed Stage 3 ledger design
3. 154-ledger-architecture-builder
   ledger_topology feeds Stage 4 control mapping
4. 158-fintech-compliance-control-mapper
   control_gaps feed Stage 5 readiness scoring
5. 162-sponsor-bank-readiness-scorer
   Exports BaaS programme Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
