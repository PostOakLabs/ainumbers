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
