# Tempo Payments Business Case

CFO-level cost-and-savings model for migrating a payment flow (payroll / remittance / merchant settlement) from card/SWIFT/ACH/SEPA to Tempo. Outputs annual savings in USD and bps, break-even months, finality improvement (days → 600ms), and a CFO memo. ISO 20022 pacs.008-subset artifact; instructed_amount, debtor, creditor, remittance_information.

- Page: https://ainumbers.co/chaingraph/art-35-tempo-payments-business-case.html
- Markdown twin: https://ainumbers.co/chaingraph/art-35-tempo-payments-business-case.md
- MCP tool: model_tempo_payment_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- impl_months (unknown, optional)
- monthly_volume (unknown, optional)
- rail (unknown, optional)
- stablecoin (unknown, optional)
- tx_amount_usd (unknown, optional): Amount in US dollars

## Outputs

- annual_saving_usd (number, optional)
- break_even_months (number, optional)
- impl_cost_usd (integer, optional)
- monthly_saving_usd (number, optional)
- per_tx_incumbent_usd (integer, optional)
- per_tx_saving_usd (number, optional)
- per_tx_tempo_usd (number, optional)
- rail (string, optional)
- saving_bps (integer, optional)
- stablecoin (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "rail": "swift",
  "stablecoin": "usdc",
  "tx_amount_usd": 10000,
  "monthly_volume": 500,
  "impl_months": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_tempo_payment_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
