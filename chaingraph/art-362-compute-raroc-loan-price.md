# RAROC Loan Pricing Calculator

Risk-Adjusted Return on Capital (RAROC) loan pricing per Basel II BCBS 128 (2006) / Basel III BCBS 189 (2010) simplified public approximation of the IRB economic-capital formula (single-factor Vasicek model at 99.9% confidence, or the SA risk-weight bucket table). Returns RAROC versus hurdle rate, economic capital, net income waterfall, and the break-even spread. Provable node counterpart to tools/437-raroc-loan-pricing.html; simplified public approximation, not a substitute for an internally approved IRB model.

- Page: https://ainumbers.co/chaingraph/art-362-compute-raroc-loan-price.html
- Markdown twin: https://ainumbers.co/chaingraph/art-362-compute-raroc-loan-price.md
- MCP tool: compute_raroc_loan_price (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- arrangement_fee_bps (number, optional): Amount in basis points
- benchmark_rate_pct (number, optional): Percentage value
- capital_approach (unknown, required)
- capital_buffer_bps (number, optional): Amount in basis points
- commitment_fee_bps (number, optional): Amount in basis points
- cost_of_funds_pct (number, optional): Percentage value
- ead_musd (number, optional)
- hurdle_rate_pct (number, optional): Percentage value
- lgd_pct (number, optional): Percentage value
- margin_bps (number, optional): Amount in basis points
- operating_cost_kusd (number, optional)
- pd_pct (number, optional): Percentage value
- tax_rate_pct (number, optional): Percentage value
- tenor_years (number, optional)
- utilization_pct (number, optional): Percentage value

## Outputs

- break_even_gap_bps (integer, optional)
- break_even_spread_bps (integer, optional)
- capital_approach (string, optional)
- drawn_musd (number, optional)
- economic_capital_musd (number, optional)
- expected_loss_musd (number, optional)
- funding_cost_musd (number, optional)
- gross_revenue_musd (number, optional)
- hurdle_rate_pct (integer, optional)
- net_income_after_tax_musd (number, optional)
- net_income_before_tax_musd (number, optional)
- note (string, optional)
- operating_cost_musd (number, optional)
- raroc_pct (integer, optional)
- regulatory_basis (string, optional)
- undrawn_musd (number, optional)
- value_creating (boolean, optional)
- value_spread_pct (integer, optional)

## Sample

```json
{
  "ead_musd": 50,
  "tenor_years": 5,
  "margin_bps": 250,
  "benchmark_rate_pct": 5.25,
  "arrangement_fee_bps": 50,
  "commitment_fee_bps": 30,
  "utilization_pct": 85,
  "pd_pct": 0.18,
  "lgd_pct": 40,
  "capital_approach": "airb",
  "capital_buffer_bps": 300,
  "hurdle_rate_pct": 12,
  "cost_of_funds_pct": 4.8,
  "operating_cost_kusd": 100,
  "tax_rate_pct": 25
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_raroc_loan_price` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
