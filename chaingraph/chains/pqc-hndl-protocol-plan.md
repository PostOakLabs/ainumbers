# HNDL-Prioritised Protocol Migration Plan

CBOM inventory (499) -> HNDL quantum-risk scoring (500) -> TLS/PKI migration sequencing (ART-86) -> audit receipt (cry-05). Extends the inventory+HNDL data into an exposure-prioritised protocol plan - the step beyond the existing pqc-migration roadmap chain.

- Page: https://ainumbers.co/chaingraph/chains/pqc-hndl-protocol-plan.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-hndl-protocol-plan.md

## Workflow chain: HNDL-Prioritised Protocol Migration Plan

CBOM inventory (499) -> HNDL quantum-risk scoring (500) -> TLS/PKI migration sequencing (ART-86) -> audit receipt (cry-05). Extends the inventory+HNDL data into an exposure-prioritised protocol plan - the step beyond the existing pqc-migration roadmap chain.

Domain: Post-Quantum Cryptography

### Steps

1. 499-crypto-asset-inventory-classifier
   classified assets (H1) feed the HNDL scorer
2. 500-hndl-quantum-risk-scorer
   HNDL priority (H2) feeds the TLS/PKI planner
3. art-86-tls-pki-migration-planner
   exposure-prioritised protocol plan (H3) feeds the aggregator
4. cry-05-agent-action-audit-trail-aggregator
   Exports composite HNDL-protocol artifact with execution_hash (H4) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
