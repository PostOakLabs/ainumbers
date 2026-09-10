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
