# Parental Leave Income Gap

Parental-leave income gap planner ported from ApexLogics Apex #131 (AL-138). From an annual base salary, an effective tax rate, monthly household and baby expenses, partner monthly take-home, current savings, an employer paid/partial leave structure, a state PFL/SDI program with 2025-vintage rate and weekly cap, a PFL duration and a total leave duration, the node computes the week-by-week leave schedule (employer pay by phase, state benefit haircut at half the tax rate, partner pass-through, a 1.05x-of-net no-windfall cap, net per week), the total income gap (sum of negative weekly nets), average monthly leave income, monthly shortfall, savings needed, and post-return recovery months (finite ceil of gap over surplus, or the 999 display sentinel when surplus is non-positive, distinguished by recovery_finite), with verdict bands at covered and half-covered. Out-of-domain inputs are rejected by throw with a named reason. State rates/caps are the Apex 2025 schedule kept verbatim for fixture parity; the official 2026 schedules differ on every state row (payload DIFFERS.md D1-D6, CITES.md G1-G6), the L351 half-rate benefit haircut is ungrounded (CITES.md U2), and the falsy-default idiom of the Apex page is deliberately not reproduced (D10), with every vintage and grounding flag carried in the output.

- Page: https://ainumbers.co/chaingraph/art-766-parental-leave-income-gap.html
- Markdown twin: https://ainumbers.co/chaingraph/art-766-parental-leave-income-gap.md
- MCP tool: parental_leave_income_gap (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- base_salary (number, required): Annual base salary in dollars (gross); drives weekly gross/net and the state PFL base (Apex L122/L344).
- tax_rate_pct (number, required): Effective tax rate as a PERCENT; divided by 100 internally. Net pay is haircut fully, the state benefit at half rate (ungrounded assumption U2).
- monthly_expenses (number, required): Monthly household expenses in dollars, before baby expense (Apex L130).
- partner_income (number, required): Partner/spouse monthly take-home income in dollars; steady through leave and after return (Apex L136).
- savings (number, required): Current savings in dollars; compared against the gap, never drawn down arithmetically (Apex L140).
- employer_paid_weeks (number, required): Employer-paid leave weeks at full net pay, starting week 1 (Apex L150).
- employer_partial_weeks (number, required): Employer partial-pay weeks immediately after the full-pay weeks (Apex L153).
- employer_partial_pct (number, required): Employer partial-pay rate as a PERCENT of net weekly pay; divided by 100 internally (Apex L158).
- state_program (string, required): State PFL/SDI program selector; rates/caps use the Apex 2025 schedule (kernel STATE_PFL_RATES_2025 / STATE_CAPS_WEEKLY_2025).
- state_pfl_weeks (number, required): State PFL/SDI duration in weeks, concurrent from week 1 (Apex L177).
- custom_pfl_rate_pct (number, required): Custom state PFL wage-replacement rate as a PERCENT, used only when state_program is custom; divided by 100 internally (Apex L181).
- total_leave_weeks (integer, required): Total leave duration in weeks including FMLA unpaid weeks; drives the schedule loop (Apex L187).
- baby_expense (number, required): New recurring monthly baby expense in dollars (diapers, formula, nursery), starting month 1 (Apex L190).

## Outputs

- total_gap (number, optional)
- avg_leave_monthly (number, optional)
- shortfall_monthly (number, optional)
- savings_needed (number, optional)
- recovery_months (number, optional)
- recovery_finite (boolean, optional)
- is_fully_covered (boolean, optional)
- verdict (string, optional)
- weekly_gross (number, optional)
- weekly_net (number, optional)
- weekly_expenses (number, optional)
- weekly_partner (number, optional)
- state_pfl_rate (number, optional)
- state_pfl_weekly (number, optional)
- state_cap (number, optional)
- state_cap_binds (boolean, optional)
- return_monthly_net (number, optional)
- surplus_per_month (number, optional)
- rows (array, optional)
- compliance_flags (array, optional)

## Sample

```json
{
  "base_salary": 85000,
  "tax_rate_pct": 22,
  "monthly_expenses": 6500,
  "partner_income": 4000,
  "savings": 20000,
  "employer_paid_weeks": 6,
  "employer_partial_weeks": 2,
  "employer_partial_pct": 60,
  "state_program": "none",
  "state_pfl_weeks": 8,
  "custom_pfl_rate_pct": 60,
  "total_leave_weeks": 16,
  "baby_expense": 1200
}
```

## Verify

Run the sample policy_parameters through MCP tool `parental_leave_income_gap` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
