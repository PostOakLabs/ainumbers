# Tempo MPP Agent Mandate

W-C chain. Decode MPP session → AP2 mandate chain validation → agent spend-policy simulation → KYA identity attestation.

- Page: https://ainumbers.co/chaingraph/chains/tempo-mpp-agent.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-mpp-agent.md

## Workflow chain: Tempo MPP Agent Mandate

W-C chain. Decode MPP session → AP2 mandate chain validation → agent spend-policy simulation → KYA identity attestation.

Domain: Digital-Asset Rails

### Steps

1. art-36-tempo-mpp-agent-mandate
   session_mandate and execution_hash (H1) + AP2 mapping feed Stage 2 mandate validation
2. art-01-ap2-mandate-chain-validator
   ap2_mandate verdict and execution_hash (H2) feed Stage 3 spend-policy simulation
3. art-02-agent-spend-policy-simulator
   spend_policy verdict and execution_hash (H3) feed Stage 4 KYA attestation
4. art-04-agent-identity-attestation-checker
   Exports composite MPP agent mandate with execution_hash (H4) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
