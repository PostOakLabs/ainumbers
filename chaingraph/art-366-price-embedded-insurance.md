# Embedded Insurance Pricing Modeller

Embedded-insurance unit economics for a platform attaching per-transaction coverage: per-transaction premium, monthly/annual gross written premium, net written premium after reinsurance cession, expected losses, commission and opex cost, underwriting profit, combined ratio, expense ratio, and breakeven loss ratio. Ports the calculation from tools/446-embedded-insurance-pricing-modeller.html into a provable kernel. Losses apply against net written premium while commission and opex apply against gross written premium - the source tool's own simplification, ported as-is.

- Page: https://ainumbers.co/chaingraph/art-366-price-embedded-insurance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-366-price-embedded-insurance.md
- MCP tool: price_embedded_insurance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attach_rate_pct (number, optional): Percentage value
- commission_pct (number, optional): Percentage value
- item_value (number, optional)
- loss_ratio_pct (number, optional): Percentage value
- monthly_tx (number, optional)
- opex_pct (number, optional): Percentage value
- premium_pct (number, optional): Percentage value
- reins_pct (number, optional): Percentage value

## Outputs

- annual_gwp (integer, optional)
- breakeven_loss_ratio_pct (number, optional)
- combined_ratio_pct (integer, optional)
- commission_cost (integer, optional)
- expected_losses (integer, optional)
- expense_ratio_pct (integer, optional)
- monthly_gwp (integer, optional)
- net_written_premium (integer, optional)
- note (string, optional)
- opex_cost (integer, optional)
- per_tx_premium (number, optional)
- underwriting_profit (integer, optional)

## Sample

```json
{
  "item_value": 350,
  "premium_pct": 3.5,
  "attach_rate_pct": 12,
  "monthly_tx": 50000,
  "loss_ratio_pct": 55,
  "commission_pct": 25,
  "opex_pct": 12,
  "reins_pct": 30
}
```

## Verify

Run the sample policy_parameters through MCP tool `price_embedded_insurance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
