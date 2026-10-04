# Fuzzy-Match Calibration

Fuzzy-match FPR/recall scoring + threshold calibration on a synthetic labelled name-pair set (ART-93) -> audit receipt (cry-05). Tunes the matching engine without touching real names.

- Page: https://ainumbers.co/chaingraph/chains/sanctions-fuzzy-calibration.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-fuzzy-calibration.md

## Workflow chain: Fuzzy-Match Calibration

Fuzzy-match FPR/recall scoring + threshold calibration on a synthetic labelled name-pair set (ART-93) -> audit receipt (cry-05). Tunes the matching engine without touching real names.

Domain: Sanctions

### Steps

1. art-93-fuzzy-match-calibration-scorer
   calibration grade + threshold recommendation (H1) feed the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite calibration artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A calibration run sits three steps deep in an agent chain. What aggregate depth does its audit trail record?
Run the AINumbers MCP tool `run_chain` with {"chain":"sanctions-fuzzy-calibration"} and read `cry-05-agent-action-audit-trail-aggregator.aggregator_chain_depth`.
Re-run with `inputs` for `cry-05-agent-action-audit-trail-aggregator`, reusing the values that result echoed, with `artifacts` changed so one receipt whose chain depth is 3. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sanctions-fuzzy-calibration.html
