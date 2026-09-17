# Agent-Service Metering & Marketplace Economics Modeler

Educational unit-economics modeler for agent-service micropayment marketplaces: per-call pricing, x402 V2 batch-settlement savings, marketplace take-rate, net margin, break-even volume, and sensitivity analysis across batch sizes. Not pricing or financial advice.

- Page: https://ainumbers.co/chaingraph/art-63-agent-service-metering-modeler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-63-agent-service-metering-modeler.md
- MCP tool: model_agent_service_metering (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- marketplace (unknown, optional)
- pricing (boolean, required)
- settlement (unknown, optional)
- usage (unknown, optional)

## Outputs

- batch (boolean, optional)
- batch_savings_pct (number, optional)
- batch_size (integer, optional)
- breakeven_calls_day (integer, optional)
- currency (string, optional)
- gross_revenue_day (integer, optional)
- model (string, optional)
- net_margin_day (integer, optional)
- net_margin_pct (number, optional)
- note (string, optional)
- rail (string, optional)
- sensitivity (array, optional)
- settlement_cost_day (integer, optional)
- status_asof (string, optional)
- take_and_infra_day (integer, optional)
- unit_price_minor (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `model_agent_service_metering` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
