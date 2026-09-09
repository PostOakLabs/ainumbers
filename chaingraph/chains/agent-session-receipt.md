# Agent Session Receipt

Aggregate N execution_hashes from an agent session into one SHA-256 Merkle-root session receipt (CRY-05) > regulator-framed prompt (PTG-01). One tamper-evident audit object for EU AI Act Art. 12 / DORA.

- Page: https://ainumbers.co/chaingraph/chains/agent-session-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-session-receipt.md

## Workflow chain: Agent Session Receipt

Aggregate N execution_hashes from an agent session into one SHA-256 Merkle-root session receipt (CRY-05) > regulator-framed prompt (PTG-01). One tamper-evident audit object for EU AI Act Art. 12 / DORA.

Domain: AI & Agent Governance

### Steps

1. cry-05-agent-action-audit-trail-aggregator
   session_receipt_root (Merkle root over all session execution_hashes) feeds Stage 2 prompt generation
2. ptg-01-ap2-prompt-template-generator
   Generates a regulator-framed prompt citing the full session receipt - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
