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

## Covered

Obligations of the cited rule text that this tool implements, each with test vectors on both the passing and the refusing side:

- O1: for each month of the plan year that an enrollee participates, the enrollee may elect the monthly cap arrangement and the sponsor determines the applicable monthly cap
- O3: first month of participation: the monthly cap equals the annual OOP threshold minus incurred costs, divided by the number of months remaining in the plan year including the current month
- O4: first month, clause (A): the calculation applies when the out-of-pocket costs incurred in the month are less than the maximum monthly cap defined in this paragraph
- O6: subsequent months: the monthly cap equals the sum of amounts still owed from an earlier month but not yet billed, plus any additional out-of-pocket costs incurred, divided by the count of months left in the plan year, current month included
- O8: months remaining in the plan year includes the current month, determined under paragraph (c)(3)
- O9: the monthly cap election does not affect TrOOP amounts; costs under the arrangement are treated as incurred at adjudication, and amounts owed but not yet billed must not be double-counted

## Not covered

Obligations of the cited rule text that this tool does not implement:

- O5: the calculator takes no opt-in date input; clause (B) timing is outside the modeled surface
- O7: eligible drug costs are a declared input (incurred TrOOP cents); drug coverage eligibility is not modeled
- O10: no input carries dispensing dates or day-supply spans, so extended-supply attribution is not modeled
- O11: branch is strictly first_month or subsequent_month; mid-year switching semantics are not modeled
