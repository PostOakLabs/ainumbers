# Tempo Zone Disclosure

W-F chain. Operator AML screen on full Zone tx set → selective-disclosure attestation → ZK compliance proof.

- Page: https://ainumbers.co/chaingraph/chains/tempo-zone-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-zone-disclosure.md

## Workflow chain: Tempo Zone Disclosure

W-F chain. Operator AML screen on full Zone tx set → selective-disclosure attestation → ZK compliance proof.

Domain: Digital-Asset Rails

### Steps

1. art-38-tempo-onchain-aml
   aml_verdict and execution_hash (H1) feed Stage 2 zone disclosure attestation
2. art-39-tempo-zone-disclosure
   zone_attestation verdict and execution_hash (H2) feed Stage 3 ZK proof generation
3. cry-01-zk-compliance-proof-generator
   Exports privacy-and-auditability attestation + ZK proof - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
