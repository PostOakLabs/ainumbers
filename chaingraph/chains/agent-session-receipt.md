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

### Ask your agent

Question: This session's receipts need a summary for a new audience. What prompt does the template generator produce for it?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-session-receipt"} and read `ptg-01-ap2-prompt-template-generator.generated_prompt`.
Re-run with `inputs` for `ptg-01-ap2-prompt-template-generator`, reusing the values that result echoed, with `audience` set to "regulator". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-session-receipt.html
