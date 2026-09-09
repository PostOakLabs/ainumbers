# Forfaiting vs Factoring vs Invoice Discounting Economics

Compares net proceeds and effective annual cost across forfaiting (medium/long-term trade receivables, non-recourse PV discount), factoring with recourse, factoring without recourse, and invoice discounting for a receivables portfolio. Models advance rates, discount rates, service fees, and arrangement costs; returns per-instrument net proceeds, effective annual cost, a cost ranking, and the cheapest/highest-proceeds instrument. Provable node counterpart to tools/425-forfaiting-factoring-economics.html.

- Page: https://ainumbers.co/chaingraph/art-479-compare-receivables-finance-economics.html
- Markdown twin: https://ainumbers.co/chaingraph/art-479-compare-receivables-finance-economics.md
- MCP tool: compare_receivables_finance_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- currency (unknown, required)
- factoring_advance_rate_pct (unknown, required): Percentage value
- factoring_finance_charge_pct (unknown, required): Percentage value
- factoring_service_fee_pct (unknown, required): Percentage value
- forfaiting_arrangement_fee_pct (unknown, required): Percentage value
- forfaiting_discount_rate_pct (unknown, required): Percentage value
- id_advance_rate_pct (unknown, required): Percentage value
- id_discount_charge_pct (unknown, required): Percentage value
- id_service_fee_pct (unknown, required): Percentage value
- invoice_value (unknown, required)
- nr_factoring_advance_rate_pct (unknown, required): Percentage value
- nr_factoring_finance_charge_pct (unknown, required): Percentage value
- nr_factoring_service_fee_pct (unknown, required): Percentage value
- num_debtors (unknown, required)
- obligor_quality (unknown, required)
- tenor_days (unknown, required): Duration in days

## Outputs

- cheapest_instrument (string, optional)
- cost_ranking (array, optional)
- highest_proceeds_instrument (string, optional)
- portfolio (object, optional)
- results (object, optional)

## Sample

```json
{
  "invoice_value": 1000000,
  "tenor_days": 90,
  "currency": "USD",
  "obligor_quality": "sub_ig",
  "num_debtors": "mid",
  "forfaiting_discount_rate_pct": 6.5,
  "forfaiting_commitment_fee_pct": 0.5,
  "forfaiting_arrangement_fee_pct": 0.5,
  "factoring_advance_rate_pct": 85,
  "factoring_service_fee_pct": 1,
  "factoring_finance_charge_pct": 7,
  "nr_factoring_advance_rate_pct": 82,
  "nr_factoring_service_fee_pct": 1.8,
  "nr_factoring_finance_charge_pct": 7.5,
  "id_advance_rate_pct": 80,
  "id_discount_charge_pct": 6.5,
  "id_service_fee_pct": 0.2
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_receivables_finance_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
