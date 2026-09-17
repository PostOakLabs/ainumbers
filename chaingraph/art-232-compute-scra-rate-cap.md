# Compute SCRA Rate Cap

Computes the SCRA 6% interest rate cap per 50 USC §3937 for pre-service loan obligations. Calculates covered months, excess interest, and forgiveness amount. Excess interest is always forgiven (not deferred) per 50 USC §3937(a)(2). Checks servicemember notification requirement. Flags SCRA_RATE_CAP_VIOLATION (original rate > 6%) and SCRA_NOTIFICATION_MISSING. Table: SCRA-50USC3937-2022.

- Page: https://ainumbers.co/chaingraph/art-232-compute-scra-rate-cap.html
- Markdown twin: https://ainumbers.co/chaingraph/art-232-compute-scra-rate-cap.md
- MCP tool: compute_scra_rate_cap (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- covered_months (number, optional)
- is_pre_service_obligation (boolean, required)
- loan_balance (number, optional)
- original_rate_pct (number, optional): Percentage value
- servicemember_notified (boolean, required)

## Outputs

- capped_rate_pct (integer, optional)
- covered_months (integer, optional)
- effective_rate_pct (integer, optional)
- exceeds_cap (boolean, optional)
- excess_forgiven (boolean, optional)
- excess_rate_pct (integer, optional)
- interest_delta_forgiven (integer, optional)
- is_pre_service_obligation (boolean, optional)
- loan_balance (integer, optional)
- original_rate_pct (integer, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- retroactive_credit (integer, optional)
- scra_note (string, optional)
- servicemember_notified (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_interest_at_cap (integer, optional)
- total_interest_at_original_rate (integer, optional)

## Sample

```json
{
  "original_rate_pct": 8,
  "loan_balance": 10000,
  "covered_months": 12,
  "is_pre_service_obligation": true,
  "servicemember_notified": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_scra_rate_cap` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
