# Agent Economy Runtime Fit Diagnostic

12-question A-F readiness diagnostic for the agent-economy runtime / post-trade layer (x402 V2 batch settlement, AP2 PaymentReceipt, Human-Not-Present autonomy, reconciliation, metering, runtime fraud). Grades an agent platform/operator and routes to the right agent-economy chain.

- Page: https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.md
- MCP tool: run_agent_economy_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_volume_txns_per_day (any, optional): type not evidenced by kernel source
- batch_settlement (any, optional): type not evidenced by kernel source
- dispute_path (any, optional): type not evidenced by kernel source
- hnp_autonomy (any, optional): type not evidenced by kernel source
- mandate_binding (any, optional): type not evidenced by kernel source
- metering_basis (any, optional): type not evidenced by kernel source
- operator_type (any, optional): type not evidenced by kernel source
- receipt_standard (any, optional): type not evidenced by kernel source
- recon_model (any, optional): type not evidenced by kernel source
- runtime_fraud_controls (any, optional): type not evidenced by kernel source
- settlement_protocol (any, optional): type not evidenced by kernel source
- spend_controls (any, optional): type not evidenced by kernel source

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
