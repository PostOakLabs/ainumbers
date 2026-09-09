# Tempo Fit Diagnostic

12-question A–F diagnostic grading an organisation's Tempo adoption fit across four dimensions: Issue (TIP-20/GENIUS PPSI), Payments (cost wedge), Agent (MPP/HTTP 402), Commerce (agentic checkout). Routing engine maps score profile to the correct chain. OCG v0.3.1 artifact; dct:conformsTo party-identification.jsonld.

- Page: https://ainumbers.co/chaingraph/art-34-tempo-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-34-tempo-fit-diagnostic.md
- MCP tool: run_tempo_fit_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "q1_regulatory_approval": "yes",
  "q2_reserve_management": "yes",
  "q3_attestation_readiness": "yes",
  "q4_payment_volume": "no",
  "q5_cross_border_volume": "no",
  "q6_settlement_latency_requirement": "no",
  "q7_agent_payments_live": "no",
  "q8_mpp_integration": "no",
  "q9_api_key_management": "no",
  "q10_merchant_acceptance": "no",
  "q11_checkout_flow": "no",
  "q12_refund_handling": "no"
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_tempo_fit_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
