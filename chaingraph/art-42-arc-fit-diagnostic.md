# Arc Fit Diagnostic

12-question A–F diagnostic assessing Arc adoption fit across CPN (Circle Payments Network), StableFX 24/7 FX, DvP atomic settlement, and agentic commerce dimensions. Routes to the appropriate Arc chain. CCTP v2 routing branch fires when ≥2 dimensions score >0.

- Page: https://ainumbers.co/chaingraph/art-42-arc-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-42-arc-fit-diagnostic.md
- MCP tool: run_arc_fit_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "q1_cpn_connectivity": "yes",
  "q2_corridor_volume": "yes",
  "q3_settlement_cutoff_pain": "yes",
  "q4_fx_margin_pressure": "yes",
  "q5_herstatt_exposure": "partial",
  "q6_24_7_settlement_need": "no",
  "q7_dvp_trade_type": "no",
  "q8_usyc_collateral_interest": "no",
  "q9_prefunding_cost": "no",
  "q10_agent_payment_volume": "partial",
  "q11_gas_sensitivity": "yes",
  "q12_x402_ap2_adoption": "no"
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_arc_fit_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
