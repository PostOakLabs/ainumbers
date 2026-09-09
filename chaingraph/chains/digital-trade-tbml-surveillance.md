# Trade-Based Money-Laundering Surveillance

W-F. TBML typology screen (art-10) -> network/phantom-entity & circular-trade graph (mms-03) -> invoicing/volume anomaly monitoring (ml-03). Surveillance over a trade flow for TBML patterns.

- Page: https://ainumbers.co/chaingraph/chains/digital-trade-tbml-surveillance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/digital-trade-tbml-surveillance.md

## Workflow chain: Trade-Based Money-Laundering Surveillance

W-F. TBML typology screen (art-10) -> network/phantom-entity & circular-trade graph (mms-03) -> invoicing/volume anomaly monitoring (ml-03). Surveillance over a trade flow for TBML patterns.

Domain: Digital Trade

### Steps

1. art-10-amla-transaction-typology-risk-scorer
   typology risk (H1) feeds the graph engine
2. mms-03-app-fraud-graph
   network red flags (H2) feed the anomaly detector
3. ml-03-timeseries-anomaly-detector
   Exports composite TBML-surveillance artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
