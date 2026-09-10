# APP Fraud Graph Simulator

Monte Carlo BFS simulation of Authorised Push Payment (APP) fraud propagation across a payment-account graph. UK PSR reimbursement framing. Zero-egress.

- Page: https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.html
- Markdown twin: https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.md
- MCP tool: simulate_app_fraud_graph (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_app_fraud_graph` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
