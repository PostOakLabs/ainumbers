# Agent Authorization & Lifecycle

Audit scoped and revocable MCP tool grants: each tool carries an explicit scope, a revocation endpoint is configured, and token rotation posture is healthy (art-150) → validate the agent on-behalf-of (OBO) mandate: subject, bounded scope, intent, and non-expired validity window; mismatch or expiry returns REFUSE (art-151) → validate that the long-running task state transitions are legal per the new MCP specification state machine (art-152). Exports lifecycle attestation with execution_hash: final stage.

- Page: https://ainumbers.co/chaingraph/chains/agent-authorization-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-authorization-lifecycle.md

## Workflow chain: Agent Authorization & Lifecycle

Audit scoped and revocable MCP tool grants: each tool carries an explicit scope, a revocation endpoint is configured, and token rotation posture is healthy (art-150) → validate the agent on-behalf-of (OBO) mandate: subject, bounded scope, intent, and non-expired validity window; mismatch or expiry returns REFUSE (art-151) → validate that the long-running task state transitions are legal per the new MCP specification state machine (art-152). Exports lifecycle attestation with execution_hash: final stage.

Domain: AI & Agent Governance

### Steps

1. art-150-mcp-tool-scope-revocation-auditor
   Scope and revocation audit feeds OBO mandate validator
2. art-151-agent-obo-mandate-validator
   OBO mandate verdict feeds task lifecycle validator
3. art-152-mcp-task-lifecycle-validator
   Exports task lifecycle validity with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
