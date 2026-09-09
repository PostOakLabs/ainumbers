# Runtime Agent-Payment Fraud Surveillance

W-E. Spend-policy violation detection (art-02) -> agent-network/collusion graph (mms-03) -> payment-velocity anomaly monitoring (ml-03). Runtime fraud surveillance over an autonomous agent's payment stream.

- Page: https://ainumbers.co/chaingraph/chains/agent-economy-fraud-runtime.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-economy-fraud-runtime.md

## Workflow chain: Runtime Agent-Payment Fraud Surveillance

W-E. Spend-policy violation detection (art-02) -> agent-network/collusion graph (mms-03) -> payment-velocity anomaly monitoring (ml-03). Runtime fraud surveillance over an autonomous agent's payment stream.

Domain: Agent Economy

### Steps

1. art-02-agent-spend-policy-simulator
   policy violations (H1) feed the graph engine
2. mms-03-app-fraud-graph
   network red flags (H2) feed the anomaly detector
3. ml-03-timeseries-anomaly-detector
   Exports composite runtime-fraud artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
