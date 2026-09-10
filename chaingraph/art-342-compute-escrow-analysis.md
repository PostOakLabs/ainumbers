# RESPA Aggregate Escrow Analysis

12 CFR 1024.17 (Reg X) aggregate escrow accounting method: builds a 12-month trial running balance from a starting balance, a monthly escrow deposit, and the projected annual disbursement schedule, compares the low point to the 1/6-of-annual-disbursements cushion target, and classifies the account as balanced, shortage, deficiency, or surplus with the corresponding spread/refund remedy. Not test_hpml_escrow (art-235), which tests whether an escrow account was required to be established in the first place.

- Page: https://ainumbers.co/chaingraph/art-342-compute-escrow-analysis.html
- Markdown twin: https://ainumbers.co/chaingraph/art-342-compute-escrow-analysis.md
- MCP tool: compute_escrow_analysis (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cushion_fraction (number, required)
- disbursements (unknown, required)
- monthly_escrow_payment (number, optional)
- starting_balance (number, optional)

## Outputs

- account_status (string, optional)
- cushion_fraction_used (number, optional)
- cushion_target (integer, optional)
- deficiency_amount (integer, optional)
- low_point_balance (integer, optional)
- low_point_month (integer, optional)
- monthly_deficiency_spread_amount (integer, optional)
- monthly_escrow_payment (integer, optional)
- monthly_shortage_spread_amount (integer, optional)
- new_monthly_escrow_payment (integer, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- shortage_amount (integer, optional)
- shortage_spread_required (boolean, optional)
- spread_vs_target (integer, optional)
- starting_balance (integer, optional)
- surplus_amount (integer, optional)
- surplus_refund_required (boolean, optional)
- total_annual_disbursements (integer, optional)
- trial_balances (array, optional)

## Sample

```json
{
  "starting_balance": 800,
  "monthly_escrow_payment": 250,
  "disbursements": [
    0,
    0,
    600,
    0,
    0,
    1200,
    0,
    0,
    0,
    0,
    0,
    1200
  ],
  "cushion_fraction": 0.16666666666666666
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_escrow_analysis` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
