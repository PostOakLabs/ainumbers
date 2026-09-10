# Tempo On-Chain AML

W-E chain. TIP-403 freeze/allowlist pre-check → TIP-20 batch AML + FATF Travel Rule screening → typology risk scoring.

- Page: https://ainumbers.co/chaingraph/chains/tempo-onchain-aml.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-onchain-aml.md

## Workflow chain: Tempo On-Chain AML

W-E chain. TIP-403 freeze/allowlist pre-check → TIP-20 batch AML + FATF Travel Rule screening → typology risk scoring.

Domain: Digital-Asset Rails

### Steps

1. art-37-tempo-stablecoin-issuance
   tip403_controls verified before batch screening
2. art-38-tempo-onchain-aml
   sar_determination, travel_rule_attestation, and execution_hash feed Stage 3 typology scoring
3. art-10-amla-transaction-typology-risk-scorer
   Exports composite AML + Travel Rule mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
