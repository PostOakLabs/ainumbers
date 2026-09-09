# Post-Quantum Cryptography Migration

End-to-end PQC migration: crypto asset inventory (NISTIR 8547) > HNDL quantum risk scoring > phased migration roadmap (FIPS 203/204/205) > crypto-agility readiness score.

- Page: https://ainumbers.co/chaingraph/chains/pqc-migration.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-migration.md

## Workflow chain: Post-Quantum Cryptography Migration

End-to-end PQC migration: crypto asset inventory (NISTIR 8547) > HNDL quantum risk scoring > phased migration roadmap (FIPS 203/204/205) > crypto-agility readiness score.

Domain: Post-Quantum Cryptography

### Steps

1. 499-crypto-asset-inventory-classifier
   classified_assets and algorithm_status feed Stage 2 HNDL risk scoring
2. 500-hndl-quantum-risk-scorer
   hndl_priority per system feed Stage 3 roadmap
3. 501-pqc-migration-roadmap-builder
   migration_phases and target_algorithms feed Stage 4 agility assessment
4. 502-crypto-agility-readiness-scorer
   Exports composite PQC migration Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
