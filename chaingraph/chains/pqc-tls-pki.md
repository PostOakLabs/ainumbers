# TLS / X.509 PKI PQC Migration Plan

CBOM inventory (499) -> TLS + PKI migration sequencing, hybrid vs composite strategy (ART-86) -> Merkle integrity (cry-04). The PKI protocol-migration workhorse, built on the live inventory tool.

- Page: https://ainumbers.co/chaingraph/chains/pqc-tls-pki.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-tls-pki.md

## Workflow chain: TLS / X.509 PKI PQC Migration Plan

CBOM inventory (499) -> TLS + PKI migration sequencing, hybrid vs composite strategy (ART-86) -> Merkle integrity (cry-04). The PKI protocol-migration workhorse, built on the live inventory tool.

Domain: Post-Quantum Cryptography

### Steps

1. 499-crypto-asset-inventory-classifier
   classified PKI-relevant assets (H1) feed the planner
2. art-86-tls-pki-migration-planner
   sequenced plan (H2) feeds the verifier
3. cry-04-merkle-batch-verifier
   Exports composite TLS/PKI plan artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
