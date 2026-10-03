# Arc Reserve Compliance

W-F chain. Full reserve compliance workflow: xReserve linter for GENIUS/MiCA + StableFX risk elimination.

- Page: https://ainumbers.co/chaingraph/chains/arc-reserve-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-reserve-compliance.md

## Workflow chain: Arc Reserve Compliance

W-F chain. Full reserve compliance workflow: xReserve linter for GENIUS/MiCA + StableFX risk elimination.

Domain: Digital-Asset Rails

### Steps

1. art-45-arc-xreserve-linter
   compliance_verdict, grade feed Stage 2 StableFX risk model
2. art-44-arc-stablefx-model
   pvp_verdict, annual_benefit - Exports reserve compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The issuer's tokens accrue a small yield for treasury. What does the reserve linter say once that earning flag is turned on?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-reserve-compliance"} and read `art-45-arc-xreserve-linter.verdict`.
Re-run with `inputs` for `art-45-arc-xreserve-linter`, reusing the values that result echoed, with `yield_enabled` set to true. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-reserve-compliance.html
