# PQC Timeline & Migration Fit Diagnostic

Single-node D0 diagnostic mapping a crypto estate to CNSA 2.0 / EU-2030 / G7 / DORA milestones. Routes to the existing pqc-migration chain (inventory/HNDL/roadmap/agility, tools 499-502) and to the new protocol chains.

- Page: https://ainumbers.co/chaingraph/chains/pqc-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-fit.md

## Workflow chain: PQC Timeline & Migration Fit Diagnostic

Single-node D0 diagnostic mapping a crypto estate to CNSA 2.0 / EU-2030 / G7 / DORA milestones. Routes to the existing pqc-migration chain (inventory/HNDL/roadmap/agility, tools 499-502) and to the new protocol chains.

Domain: Post-Quantum Cryptography

### Steps

1. art-85-pqc-timeline-fit-diagnostic
   readiness grade routes to pqc-migration (existing spine) / pqc-tls-pki / pqc-swift-iso20022 / pqc-fido-webauthn / pqc-blockchain-risk / pqc-hndl-protocol-plan / pqc-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The board asked whether we are on track for the post-quantum deadlines. What grade does our current programme earn?
Run the AINumbers MCP tool `run_chain` with {"chain":"pqc-fit"} and read `art-85-pqc-timeline-fit-diagnostic.readiness_grade`.
Re-run with `inputs` for `art-85-pqc-timeline-fit-diagnostic`, reusing the values that result echoed, with `crypto_inventory_status` set to "complete". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/pqc-fit.html
