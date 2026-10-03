# Agent Audit Trail Conformance

Linear two-step chain for agent audit trail conformance. Step 1 builds an EU AI Act Art 12(2)-conformant decision log record (art-236) with completeness score, chain_position, and anchor instructions. Step 2 validates the record against IETF draft-sharif-agent-audit-trail-00 (art-237), confirming AAT field conformance, sha256_prev_record chain-link format, and trust level. Both steps always run. Use as the lightweight audit-trail path when Annex III high-risk classification (art-238) is already resolved upstream.

- Page: https://ainumbers.co/chaingraph/chains/agent-audit-trail-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-audit-trail-conformance.md

## Workflow chain: Agent Audit Trail Conformance

Linear two-step chain for agent audit trail conformance. Step 1 builds an EU AI Act Art 12(2)-conformant decision log record (art-236) with completeness score, chain_position, and anchor instructions. Step 2 validates the record against IETF draft-sharif-agent-audit-trail-00 (art-237), confirming AAT field conformance, sha256_prev_record chain-link format, and trust level. Both steps always run. Use as the lightweight audit-trail path when Annex III high-risk classification (art-238) is already resolved upstream.

Domain: AI & Agent Governance

### Steps

1. art-236-build-ai-decision-log-record
   Art 12(2) decision log record with art12_completeness_score and anchor instructions. Passes to audit trail validation.
2. art-237-validate-agent-audit-trail
   IETF AAT conformance result and aat_completeness_score. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our agent audit trail chains to the previous record. Does the validator accept the chain when the back-link is malformed?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-audit-trail-conformance"} and read `art-237-validate-agent-audit-trail.conformance_result`.
Re-run with `inputs` for `art-237-validate-agent-audit-trail`, reusing the values that result echoed, with `sha256_prev_record` set to "not-a-hash". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-audit-trail-conformance.html
