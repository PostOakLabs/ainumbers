# Agent Identity Publishing Readiness (Visa TAP / Mastercard Agent Pay)

Audit key freshness and rotation posture (art-132) then crosswalk identity posture to Visa TAP, Mastercard Agent Pay, and Web Bot Auth acceptance criteria (art-133) then emit a directory-publish readiness verdict with a precise gap list (art-134). Supply-side of the Ed25519 identity substrate.

- Page: https://ainumbers.co/chaingraph/chains/agent-identity-publishing.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-identity-publishing.md

## Workflow chain: Agent Identity Publishing Readiness (Visa TAP / Mastercard Agent Pay)

Audit key freshness and rotation posture (art-132) then crosswalk identity posture to Visa TAP, Mastercard Agent Pay, and Web Bot Auth acceptance criteria (art-133) then emit a directory-publish readiness verdict with a precise gap list (art-134). Supply-side of the Ed25519 identity substrate.

Domain: AI & Agent Governance

### Steps

1. art-132-agent-key-rotation-auditor
   Rotation posture feeds payment-rail crosswalk
2. art-133-agent-payment-rail-trust-crosswalk
   Rail trust gaps feed publish-readiness diagnostic
3. art-134-agent-directory-publish-readiness
   Exports directory-publish verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
