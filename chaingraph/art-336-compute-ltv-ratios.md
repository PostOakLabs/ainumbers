# LTV/CLTV/HCLTV Ratio Calculator

Loan-to-value, combined LTV, and home-equity combined LTV per Fannie Mae Selling Guide B2-1.1-03 and Freddie Mac Single-Family Seller/Servicer Guide 5401.1. Applies the lesser-of-value-or-price rule for purchases, appraised value for refinances, and includes the full HELOC credit limit (not just the drawn balance) in HCLTV. Feeds art-222-agency-eligibility-matrix as its LTV/CLTV/HCLTV inputs. Not check_agency_eligibility_matrix itself, which performs the full multi-check eligibility decision.

- Page: https://ainumbers.co/chaingraph/art-336-compute-ltv-ratios.html
- Markdown twin: https://ainumbers.co/chaingraph/art-336-compute-ltv-ratios.md
- MCP tool: compute_ltv_ratios (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- appraised_value (number, optional)
- first_lien_amount (number, optional)
- heloc_credit_limit (number, optional)
- sales_price (number, optional)
- subordinate_lien_amount (number, optional)
- transaction_type (unknown, required)

## Outputs

- appraised_value (integer, optional)
- cltv_pct (integer, optional)
- first_lien_amount (integer, optional)
- hcltv_pct (integer, optional)
- heloc_credit_limit (integer, optional)
- ltv_pct (integer, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- sales_price (integer, optional)
- subordinate_lien_amount (integer, optional)
- transaction_type (string, optional)
- value_used (integer, optional)

## Sample

```json
{
  "appraised_value": 500000,
  "sales_price": 490000,
  "first_lien_amount": 392000,
  "subordinate_lien_amount": 0,
  "heloc_credit_limit": 0,
  "transaction_type": "purchase"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_ltv_ratios` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
