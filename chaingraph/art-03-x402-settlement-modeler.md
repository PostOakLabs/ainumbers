# x402 Settlement Cost & Finality Modeler

Rail-selection and finality recommendation across x402 (HTTP 402), Stripe USDC, card, ACH, and SWIFT. Per-transaction cost, eligibility scoring, micropayment support, cross-border flags. ~69k active agents / 165M+ x402 txns (2026).

- Page: https://ainumbers.co/chaingraph/art-03-x402-settlement-modeler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-03-x402-settlement-modeler.md
- MCP tool: model_x402_settlement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amount_usd (number, required)
- monthly_volume (number, optional)
- payment_type (string, optional)
- finality_requirement (string, optional)

## Outputs

- eligible_rails (array, optional)
- finality_sec (integer, optional)
- monthly_cost_usd (integer, optional)
- per_tx_fee_usd (number, optional)
- recommended_rail (string, optional)

## Sample

```json
{
  "amount_usd": 0.05,
  "monthly_volume": 10000,
  "payment_type": "micropayment",
  "finality_requirement": "instant",
  "gas_tier": "low",
  "chargeback_profile": "low"
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_x402_settlement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
