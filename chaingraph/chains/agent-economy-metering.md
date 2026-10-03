# Agent-Service Metering & Marketplace Economics

W-D. Metering + marketplace unit economics (ART-63) -> x402 settlement cost/finality (art-03) -> usage/billing anomaly monitoring (ml-03). Models the economics of an agent-service micropayment marketplace. Educational estimator.

- Page: https://ainumbers.co/chaingraph/chains/agent-economy-metering.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-economy-metering.md

## Workflow chain: Agent-Service Metering & Marketplace Economics

W-D. Metering + marketplace unit economics (ART-63) -> x402 settlement cost/finality (art-03) -> usage/billing anomaly monitoring (ml-03). Models the economics of an agent-service micropayment marketplace. Educational estimator.

Domain: Agent Economy

### Steps

1. art-63-agent-service-metering-modeler
   unit economics (H1) feed the settlement modeler
2. art-03-x402-settlement-modeler
   settlement cost (H2) feeds the anomaly detector
3. ml-03-timeseries-anomaly-detector
   Exports composite metering artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our metering feed watches for billing anomalies. If the series carries six injected spikes, how many periods get flagged?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-economy-metering"} and read `ml-03-timeseries-anomaly-detector.anomalies_flagged`.
Re-run with `inputs` for `ml-03-timeseries-anomaly-detector`, reusing the values that result echoed, with `nAnomalies` set to 6. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-economy-metering.html
