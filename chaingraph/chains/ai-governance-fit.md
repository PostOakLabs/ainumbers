# EU AI Act High-Risk Fit & Classification Diagnostic

Single-node D0 diagnostic classifying a financial AI system's high-risk status (Annex III) and grading Article 9-15 readiness + provider/deployer split; screens in-force obligations first (Art 5, Art 4, GPAI) and routes to the right ai-governance chain with a do-now vs prepare-ahead checklist.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-fit.md

## Workflow chain: EU AI Act High-Risk Fit & Classification Diagnostic

Single-node D0 diagnostic classifying a financial AI system's high-risk status (Annex III) and grading Article 9-15 readiness + provider/deployer split; screens in-force obligations first (Art 5, Art 4, GPAI) and routes to the right ai-governance chain with a do-now vs prepare-ahead checklist.

Domain: AI Governance

### Steps

1. art-64-ai-act-highrisk-fit-diagnostic
   high_risk_verdict and primary_recommendation route to ai-governance-conformity / ai-governance-fria-monitoring / ai-governance-fairness-bias / ai-governance-credit-ai-conformity / ai-governance-gpai-agentic / ai-governance-resilience-overlap / ai-governance-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Under the EU AI Act, does our credit-scoring system land in the high-risk class once its Annex III profile is declared?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-governance-fit"} and read `art-64-ai-act-highrisk-fit-diagnostic.high_risk_verdict`.
Re-run with `inputs` for `art-64-ai-act-highrisk-fit-diagnostic`, reusing the values that result echoed, with `annex_iii_match` set to "clear-high-risk". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-governance-fit.html
