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
