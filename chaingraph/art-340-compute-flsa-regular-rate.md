# FLSA Regular Rate & Overtime Calculator

FLSA regular rate of pay and overtime premium per 29 CFR 778, Subpart C, including nondiscretionary-bonus reallocation into the regular rate (778.110, 778.208-778.209) and the 0.5x overtime premium for hours over 40 in the workweek (778.107). Federal only, not legal advice; state daily/weekly overtime rules out of scope. Multi-workweek bonus proration is the caller's responsibility: nondiscretionary_bonus_amount is the portion already allocated to the single workweek being computed. Not compute_gross_to_net or compute_federal_withholding, which handle payroll tax withholding rather than wage-hour overtime obligations.

- Page: https://ainumbers.co/chaingraph/art-340-compute-flsa-regular-rate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-340-compute-flsa-regular-rate.md
- MCP tool: compute_flsa_regular_rate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- discretionary_bonus_excluded (number, optional)
- hourly_rate (number, optional)
- hours_worked_week (number, optional)
- nondiscretionary_bonus_amount (number, optional)
- other_includable_pay (number, optional)

## Outputs

- constants_version (string, optional)
- discretionary_bonus_excluded (integer, optional)
- hourly_rate (integer, optional)
- hours_worked_week (integer, optional)
- nondiscretionary_bonus_amount (integer, optional)
- note (string, optional)
- other_includable_pay (integer, optional)
- overtime_hours (integer, optional)
- overtime_premium_pay (number, optional)
- regular_rate (number, optional)
- regulatory_basis (string, optional)
- straight_time_pay (integer, optional)
- total_pay_due (number, optional)
- total_remuneration (integer, optional)

## Sample

```json
{
  "hours_worked_week": 45,
  "hourly_rate": 15,
  "other_includable_pay": 30,
  "nondiscretionary_bonus_amount": 100
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_flsa_regular_rate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
