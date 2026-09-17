# DORA ICT Cascade Simulator

Monte Carlo cascade simulation of ICT incident propagation across a financial-institution dependency graph under DORA (EU) 2022/2554. 500 stochastic BFS paths; models failure propagation, recovery, and concentration risk.

- Page: https://ainumbers.co/chaingraph/pnr-01-dora-ict-cascade-simulator.html
- Markdown twin: https://ainumbers.co/chaingraph/pnr-01-dora-ict-cascade-simulator.md
- MCP tool: simulate_ict_cascade (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "topology": "bank_core",
  "failure_node": "nosuch_node",
  "n_paths": 50,
  "seed": 42
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_ict_cascade` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
