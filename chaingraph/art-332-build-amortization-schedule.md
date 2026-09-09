# Amortization Schedule Builder

Deterministic amortization schedule builder covering level-payment, ARM (index plus margin, periodic and lifetime caps, recast), interest-only, balloon, and temporary buydown (2-1 or 3-2-1) structures, per the unit-period and odd-days conventions in 12 CFR 1026 Appendix J. Returns the full period-by-period schedule (principal, interest, ending balance), totals, a schedule_digest, and advances/payments arrays shaped for direct use as the actuarial APR solver's input. Cents-integer fixed-point math throughout; no floating-point drift.

- Page: https://ainumbers.co/chaingraph/art-332-build-amortization-schedule.html
- Markdown twin: https://ainumbers.co/chaingraph/art-332-build-amortization-schedule.md
- MCP tool: build_amortization_schedule (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- buydown_schedule (array, required)
- buydown_type (unknown, required)
- io_periods (number, optional)
- lifetime_cap_pct (number, optional): Percentage value
- lifetime_floor_pct (number, optional): Percentage value
- loan_amount (number, optional)
- margin_pct (number, optional): Percentage value
- nominal_amortization_periods (number, required)
- note_rate_pct (number, optional): Percentage value
- num_payments (number, optional)
- odd_days (number, optional): Duration in days
- payment_amount (number, optional)
- periodic_cap_pct (number, optional): Percentage value
- periods_per_year (number, optional)
- rate_changes (array, required)
- recast (boolean, required)
- schedule_type (unknown, required)
- unit_period_days (number, optional): Duration in days

## Outputs

- advances (array, optional)
- loan_amount (integer, optional)
- note (string, optional)
- note_rate_pct (integer, optional)
- num_payments (integer, optional)
- odd_days (integer, optional)
- payment_amount (number, optional)
- payments (array, optional)
- periods_per_year (integer, optional)
- regulatory_basis (string, optional)
- schedule (array, optional)
- schedule_type (string, optional)
- totals (object, optional)
- unit_period_days (integer, optional)

## Sample

```json
{
  "schedule_type": "level_payment",
  "loan_amount": 6000,
  "note_rate_pct": 12,
  "num_payments": 24,
  "periods_per_year": 12
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_amortization_schedule` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
