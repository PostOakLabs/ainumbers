# Sales OTE & Commission Analyzer

Gross W-2 model for a sales OTE offer ported from ApexLogics Apex #89 (AL-96): base salary plus variable pay as a function of quota attainment, with an optional accelerator tier (strictly inactive at or below the threshold) and an optional recoverable draw with a months-to-payback figure and a clawback-elevated flag. Reports the base commission rate (ote-base)/quota, the at-target variable and total (always evaluated at exactly 100% attainment), a flat-rate after-tax figure, the base/variable split with a high/moderate/low risk label at 60%/40% of OTE in variable pay, a six-level attainment scenario ladder (50/75/100/125/150/200), and an accelerator insight row at 150%. Refuses ote <= base and base <= 0 with named reasons in Apex guard order, and refuses a non-calendar as_of: the node reads no clock, as_of is an input. Every numeric input is read with the Apex `||` default semantics, so an explicit 0 is replaced by the default and reported in apex_zero_coercion_applied with an APEX_ZERO_COERCION_APPLIED flag. The node computes NO tax liability (after_tax_at_target is gross times one flat caller rate, not the 2026 marginal schedule, which the kernel records as named literals from Rev. Proc. 2025-32 sec. 4.01 without applying), NO FLSA regular rate and NO overtime. The risk cuts, the 6-month clawback threshold and the 25-point highlight bucket are the Apex tool's own editorial constants with no cited source; the advertised BLS OEWS 2024 vintage is not present in the compute and was not carried across (payload DIFFERS.md D-1..D-4, CITES.md UNGROUNDED).

- Page: https://ainumbers.co/chaingraph/art-756-sales-ote-commission-analyzer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-756-sales-ote-commission-analyzer.md
- MCP tool: analyze_sales_ote_commission (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, required): Calendar date as YYYY-MM-DD, a real date. The node reads no clock; this is the only date the kernel sees. Invalid dates are refused REFUSED_BAD_AS_OF.
- base_salary (number, required): Annual base salary USD, strictly positive and below ote, else refused BASE_NOT_POSITIVE or OTE_NOT_ABOVE_BASE. Explicit 0 coerces to default 0.
- ote (number, required): On-Target Earnings USD: total target W-2. Must strictly exceed base_salary; equal is refused OTE_NOT_ABOVE_BASE.
- quota (number, required): Annual quota in USD. Scales only the displayed base commission rate (ote - base)/quota; it cancels in the accelerated branch. Coerced to 1 when 0.
- attainment_pct (number, required): Quota attainment percent (100 = 100%). At-target column always uses 100%; this selects the highlighted ladder row. Coerced to 100 when 0.
- federal_tax_rate_pct (number, required): Flat federal rate percent on gross W-2. NOT a tax computation: no standard deduction, bracket stacking, state tax or FICA. Coerced to 32 when 0.
- has_accelerator (boolean, required): True to apply the accelerator tier. The accelerator fields are still read unconditionally but never affect any output when false.
- accelerator_threshold_pct (number, required): Attainment percent above which the multiplier applies; STRICTLY inactive at the threshold. Coerced to 100 when 0.
- accelerator_multiplier (number, required): Multiplier on the base commission rate above the threshold, e.g. 1.5 = 150%. Applied only when has_accelerator is true. Coerced to 1.5 when 0.
- has_draw (boolean, required): True to model a recoverable draw against future commissions. When false the draw block is absent and draw_monthly is read but unused.
- draw_monthly (number, required): Monthly draw advance in USD, applied only when has_draw is true and > 0. Annual draw is draw_monthly * 12. Coerced to 0 when 0, disabling the block.

## Sample

```json
{
  "as_of": "2026-10-13",
  "base_salary": 75000,
  "ote": 150000,
  "quota": 1000000,
  "attainment_pct": 100,
  "federal_tax_rate_pct": 32,
  "accelerator_threshold_pct": 100,
  "accelerator_multiplier": 1.5,
  "draw_monthly": 5000,
  "has_accelerator": true,
  "has_draw": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `analyze_sales_ote_commission` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
