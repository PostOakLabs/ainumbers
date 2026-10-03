# MAR-Crypto Surveillance Readiness

Market-abuse arrangements (PPAET/STOR/insider-list/manipulation) per Arts 86-92 + Dec-2024 RTS, assessed on synthetic order batches (ART-103) -> audit receipt (cry-05). Synthetic data only.

- Page: https://ainumbers.co/chaingraph/chains/mica-mar-surveillance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-mar-surveillance.md

## Workflow chain: MAR-Crypto Surveillance Readiness

Market-abuse arrangements (PPAET/STOR/insider-list/manipulation) per Arts 86-92 + Dec-2024 RTS, assessed on synthetic order batches (ART-103) -> audit receipt (cry-05). Synthetic data only.

Domain: Digital-Asset Rails

### Steps

1. art-103-mar-crypto-surveillance-readiness
   surveillance grade + gaps (H1) feed the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite MAR artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Surveillance budget review. Are our MAR arrangements for crypto-asset trading ready for the RTS supervisory pass?
Run the AINumbers MCP tool `run_chain` with {"chain":"mica-mar-surveillance"} and read `art-103-mar-crypto-surveillance-readiness.surveillance_grade`.
Re-run with `inputs` for `art-103-mar-crypto-surveillance-readiness`, reusing the values that result echoed, with `inputs` changed so the four surveillance arrangements are in place or ready. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mica-mar-surveillance.html
