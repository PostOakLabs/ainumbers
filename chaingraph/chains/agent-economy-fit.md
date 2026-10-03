# Agent Economy Runtime Fit Diagnostic

Single-node D0 diagnostic grading an agent platform/operator A-F across settlement rail, receipt & mandate, HNP autonomy, reconciliation, metering, and runtime fraud for the agent-economy runtime layer; routes to the right agent-economy chain.

- Page: https://ainumbers.co/chaingraph/chains/agent-economy-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-economy-fit.md

## Workflow chain: Agent Economy Runtime Fit Diagnostic

Single-node D0 diagnostic grading an agent platform/operator A-F across settlement rail, receipt & mandate, HNP autonomy, reconciliation, metering, and runtime fraud for the agent-economy runtime layer; routes to the right agent-economy chain.

Domain: Agent Economy

### Steps

1. art-60-agent-economy-runtime-fit-diagnostic
   dim_scores and primary_recommendation route to agent-economy-batch-settlement / agent-economy-payment-receipt / agent-economy-autonomous-guardrail / agent-economy-metering / agent-economy-fraud-runtime / agent-economy-marketplace / agent-economy-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The readiness diagnostic scored our agent runtime. If we adopt the x402 V2 rail, how far does the score climb?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-economy-fit"} and read `art-60-agent-economy-runtime-fit-diagnostic.overall_score`.
Re-run with `inputs` for `art-60-agent-economy-runtime-fit-diagnostic`, reusing the values that result echoed, with `settlement_protocol` set to "x402-v2". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-economy-fit.html
