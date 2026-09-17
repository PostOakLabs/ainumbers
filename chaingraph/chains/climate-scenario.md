# Climate Scenario Stress (NGFS / Fit-for-55)

Apply an NGFS / Fit-for-55 scenario path to an exposure set -> stress-adjusted metrics (ART-76) -> audit receipt (cry-05). The bank/insurer climate-risk computation a supervisor re-verifies. Scenario paths are versioned reference data, not the suite financial-shock stress parameters.

- Page: https://ainumbers.co/chaingraph/chains/climate-scenario.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/climate-scenario.md

## Workflow chain: Climate Scenario Stress (NGFS / Fit-for-55)

Apply an NGFS / Fit-for-55 scenario path to an exposure set -> stress-adjusted metrics (ART-76) -> audit receipt (cry-05). The bank/insurer climate-risk computation a supervisor re-verifies. Scenario paths are versioned reference data, not the suite financial-shock stress parameters.

Domain: Climate & Sustainable Finance

### Steps

1. art-76-climate-scenario-applicator
   stressed metrics + per-sector deltas (H1) feed the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite climate-scenario artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
