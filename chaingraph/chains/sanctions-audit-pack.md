# Sanctions & Export-Control Audit Pack

W-G convergence terminal. Merkle integrity over the screening decision set (cry-04) -> Merkle-root audit receipt (cry-05) -> regulator/auditor-framed cover memo (ptg-01). Other chains feed in.

- Page: https://ainumbers.co/chaingraph/chains/sanctions-audit-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-audit-pack.md

## Workflow chain: Sanctions & Export-Control Audit Pack

W-G convergence terminal. Merkle integrity over the screening decision set (cry-04) -> Merkle-root audit receipt (cry-05) -> regulator/auditor-framed cover memo (ptg-01). Other chains feed in.

Domain: Sanctions

### Steps

1. cry-04-merkle-batch-verifier
   batch integrity (H1) feeds the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Merkle-root receipt (H2) feeds the memo generator
3. ptg-01-ap2-prompt-template-generator
   Exports composite audit pack with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: After an agent runs the screening audit, does its session carry verifiable receipts for the actions it took?
Run the AINumbers MCP tool `run_chain` with {"chain":"sanctions-audit-pack"} and read `cry-05-agent-action-audit-trail-aggregator.all_proofs_verified`.
Re-run with `inputs` for `cry-05-agent-action-audit-trail-aggregator`, reusing the values that result echoed, with `artifacts` changed so one receipt carrying the run execution hash. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sanctions-audit-pack.html
