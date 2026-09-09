# M3P Monthly Cap Calculator

Recomputes the Medicare Prescription Payment Plan (M3P) maximum monthly cap under 42 CFR 423.137(c)(1)(i) (first month of participation) and (c)(1)(ii) (every subsequent month), verified by exhaustive enumeration over the full declared cents/months domain (4,830,023 states). The annual out-of-pocket threshold is a plan-year-indexed CMS figure, carried as a keyed, source-digested policy parameter rather than a bare constant - CY2026 is $2,100. Rounding is declared half-up-to-the-cent, since the regulation states no explicit rounding rule for the division step; the declaration is backed by three independent CMS-sourced worked examples and implemented with exact integer arithmetic, never floating-point division. A caller-declared numerator or months value outside the declared domain is rejected with a named reason, never clamped or silently coerced. Verify-only: recomputes the formula from caller-declared inputs, does not track a real enrollee's true out-of-pocket accumulation, does not enroll anyone in M3P, and does not assert that any actual participant's bill is correct.

- Page: https://ainumbers.co/tools/617-m3p-monthly-cap-calculator.html
- Markdown twin: https://ainumbers.co/tools/617-m3p-monthly-cap-calculator.md
- MCP tool: compute_m3p_monthly_cap (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "branch": "first_month",
  "incurred_TrOOP_cents": 10000,
  "months_remaining": 12
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_m3p_monthly_cap` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
