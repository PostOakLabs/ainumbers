# Arc CCTP v2 Transfer

W-G chain. Validate CCTP v2 cross-chain USDC transfer: fires when ≥2 Arc fit dimensions score >0.

- Page: https://ainumbers.co/chaingraph/chains/arc-cctp-transfer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-cctp-transfer.md

## Workflow chain: Arc CCTP v2 Transfer

W-G chain. Validate CCTP v2 cross-chain USDC transfer: fires when ≥2 Arc fit dimensions score >0.

Domain: Digital-Asset Rails

### Steps

1. art-42-arc-fit-diagnostic
   cctp_routing_flag, arc_score → CCTP v2 transfer validation
2. art-47-arc-cctp-transfer
   grade, v1_migration_required, hook_risk - CCTP v2 validated - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Treasury queued a burn-and-mint to a chain missing from the operations runbook. What does the transfer check say about that destination?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-cctp-transfer"} and read `art-47-arc-cctp-transfer.verdict`.
Re-run with `inputs` for `art-47-arc-cctp-transfer`, reusing the values that result echoed, with `dest_domain` set to "moonbeam". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-cctp-transfer.html
