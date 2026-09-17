# Arc Paymaster Economics Model

ERC-4337 Paymaster economics model for Arc. Computes gas cost (gasPerUop × gasPriceGwei × 1e-9 × ethPriceUsd), sponsorship break-even, and per-UOp user-facing cost. Comparison: Arc user pays / Arc+Paymaster / Ethereum L1. No ETH bootstrap required on Arc (USDC-as-gas).

- Page: https://ainumbers.co/chaingraph/art-46-arc-paymaster-model.html
- Markdown twin: https://ainumbers.co/chaingraph/art-46-arc-paymaster-model.md
- MCP tool: model_arc_paymaster_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- arc_usdc_per_gas_unit (unknown, optional)
- eth_price_usd (unknown, optional): Amount in US dollars
- gas_per_uop (unknown, optional)
- gas_price_gwei (unknown, optional)
- impl_months (unknown, optional)
- merchant_sponsorship_pct (unknown, optional): Percentage value
- monthly_uops (unknown, optional)

## Outputs

- verdict (string, optional)
- compliance_flags (array, optional)

## Sample

```json
{
  "gas_per_uop": 150000,
  "gas_price_gwei": 30,
  "eth_price_usd": 3500,
  "arc_usdc_per_gas_unit": 0.000001,
  "monthly_uops": 50000,
  "merchant_sponsorship_pct": 80,
  "impl_months": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_arc_paymaster_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
