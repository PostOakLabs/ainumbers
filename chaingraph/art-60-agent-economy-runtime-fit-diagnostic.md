# Agent Economy Runtime Fit Diagnostic

12-question A-F readiness diagnostic for the agent-economy runtime / post-trade layer (x402 V2 batch settlement, AP2 PaymentReceipt, Human-Not-Present autonomy, reconciliation, metering, runtime fraud). Grades an agent platform/operator and routes to the right agent-economy chain.

- Page: https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.md
- MCP tool: run_agent_economy_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_volume_txns_per_day (unknown, optional)
- batch_settlement (unknown, optional)
- dispute_path (unknown, optional)
- hnp_autonomy (unknown, optional)
- mandate_binding (unknown, optional)
- metering_basis (unknown, optional)
- operator_type (unknown, optional)
- receipt_standard (unknown, optional)
- recon_model (unknown, optional)
- runtime_fraud_controls (unknown, optional)
- settlement_protocol (unknown, optional)
- spend_controls (unknown, optional)

## Outputs

- dim_scores (object, optional)
- hnp_risk_flag (string, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (integer, optional)
- primary_recommendation (string, optional)
- remediation_checklist (array, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_agent_economy_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
