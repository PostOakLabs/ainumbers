# Agent Identity & Trust-Chain

A2A agent-card + delegated-authority trust-chain validation > KYA-OS identity attestation > spend-policy simulation.

- Page: https://ainumbers.co/chaingraph/chains/agent-identity-trust.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-identity-trust.md

## Workflow chain: Agent Identity & Trust-Chain

A2A agent-card + delegated-authority trust-chain validation > KYA-OS identity attestation > spend-policy simulation.

Domain: AI & Agent Governance

### Steps

1. art-32-a2a-agent-card-trust-chain-validator
   a2a_card + trust-chain verdict and execution_hash feed Stage 2 KYA attestation
2. art-04-agent-identity-attestation-checker
   attestation verdict and execution_hash feed Stage 3 spend-policy simulation
3. art-02-agent-spend-policy-simulator
   Exports the agent-identity-trust policy artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
