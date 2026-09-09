# ASC 340-40 Commission Amortization

Computes ASC 340-40-25-4 practical expedient (contract_term_months <= 12 -> expense immediately, apply_expedient=true) and full straight-line amortization schedules for longer-term capitalized incremental costs of obtaining a contract under ASC 606. Returns apply_expedient (bool), monthly_amortization, cumulative_amortized_pct, and remaining_book_value per commission line. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/art-265-amortize-asc606-commissions.html
- Markdown twin: https://ainumbers.co/chaingraph/art-265-amortize-asc606-commissions.md
- MCP tool: amortize_asc606_commissions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amortization_period_override_months (unknown, optional)
- contract_term_months (unknown, optional)
- impairment_indicators (unknown, optional)
- incremental_cost (unknown, optional)
- renewal_commensurate (unknown, optional)
- renewal_cost (unknown, optional)

## Outputs

- amortization_period_months (integer, optional)
- annual_amortization (integer, optional)
- apply_expedient (boolean, optional)
- asc340_40_compliant (boolean, optional)
- carrying_amount (integer, optional)
- impairment_flag (boolean, optional)
- incremental_cost_test_passed (boolean, optional)
- monthly_amortization (integer, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- renewal_treatment (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_amortization_periods (integer, optional)

## Sample

```json
{
  "incremental_cost": 12000,
  "contract_term_months": 6,
  "renewal_commensurate": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `amortize_asc606_commissions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
