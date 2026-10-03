# Agentic AI & GPAI Governance

W-D. Agentic-AI autonomy + GPAI/systemic-risk classification (ART-67, Arts 53-55 IN FORCE 2 Aug 2025) -> agent identity & authorization (art-04) -> agent/MCP self-attestation (art-33). Governs the autonomous AI agents that transact on the runtime - the reflexive tie between AINumbers' agent rails and AI governance.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-gpai-agentic.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-gpai-agentic.md

## Workflow chain: Agentic AI & GPAI Governance

W-D. Agentic-AI autonomy + GPAI/systemic-risk classification (ART-67, Arts 53-55 IN FORCE 2 Aug 2025) -> agent identity & authorization (art-04) -> agent/MCP self-attestation (art-33). Governs the autonomous AI agents that transact on the runtime - the reflexive tie between AINumbers' agent rails and AI governance.

Domain: AI Governance

### Steps

1. art-67-agentic-ai-risk-classifier
   governance_tier and gpai_class (H1) feed the identity checker
2. art-04-agent-identity-attestation-checker
   attestation verdict (H2) feeds the self-attestation pack
3. art-33-mcp-server-self-attestation-pack
   Exports composite agentic-governance artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Procurement wants to swap the agent foundation model for a proprietary one. What changes in the resulting GPAI classification and obligation set?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-governance-gpai-agentic"} and read `art-67-agentic-ai-risk-classifier.gpai_class`.
Re-run with `inputs` for `art-67-agentic-ai-risk-classifier`, reusing the values that result echoed, with `model` changed so type is proprietary, systemic_designation no. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-governance-gpai-agentic.html
