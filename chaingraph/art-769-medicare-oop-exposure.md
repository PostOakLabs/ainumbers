# Medicare Out-of-Pocket Exposure

Medicare out-of-pocket exposure modeler ported from ApexLogics Apex #152 (AL-166). For a declared plan year it walks a modelled year of utilisation through Part A benefit-period cost sharing, the Part B deductible and coinsurance and the Part D deductible-then-coinsurance walk capped at the plan-year threshold, then reports the residual left after a coverage structure (Original Medicare only, Medigap Plan G, Medigap Plan N, or Medicare Advantage), annual premiums including the Part B income-related tier (0-5) and the Part D income-related adjustment, and a routine, rough and worst-case spread. Integer US cents with exact round-half-up basis-point division; the node reads no clock. Out-of-domain inputs, including an income tier outside 0-5, are refused with named errors, never coerced. Plan G and Plan N carry no annual ceiling. The worst-case spend multiplier is an optional modelling assumption (default 4). Verify-only: it prices no actual plan, does not model Part B excess charges, non-covered services, or days beyond 150 inpatient and 100 SNF, and is an estimate, not an official CMS, SSA or plan communication.

- Page: https://ainumbers.co/chaingraph/art-769-medicare-oop-exposure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-769-medicare-oop-exposure.md
- MCP tool: compute_medicare_oop_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- plan_year (integer, required): Plan year whose published parameters apply (2026 declared). Must be a number; a string, null or undeclared year is a named error.
- coverage_structure (string, required): Coverage the residual is measured against: OriginalOnly, PlanG, PlanN (no annual ceiling) or Advantage (plan MOOP).
- irmaa_tier (integer, required): Income-related tier 0-5 (six CMS 2026 Part B bands). Sets Part B premium and Part D adjustment. Any other value is refused.
- benefit_periods (integer, required): Non-negative integer count of Part A benefit periods in the year. Zero means no admission and no Part A deductible.
- days_per_period (integer, required): Non-negative integer inpatient days per benefit period: 1-60 deductible, 61-90 quarter, 91-150 half; after 150 not costed.
- snf_days (integer, required): Non-negative integer SNF days per benefit period: 1-20 in full, 21-100 coinsurance, 101+ not covered and not costed.
- part_b_approved_charges_cents (integer, required): Non-negative integer cents: Medicare-approved Part B charges for the year. Deductible first, then 20 percent.
- annual_drug_cost_cents (integer, required): Non-negative integer cents: annual gross covered Part D drug cost; the walk is capped at the plan-year threshold.
- part_d_deductible_cents (integer, required): Non-negative integer cents: plan Part D deductible; above the plan-year maximum it is clamped and the clamp is reported.
- supplemental_monthly_premium_cents (integer, required): Non-negative integer cents: Medigap or Advantage monthly premium, charged for twelve months. Zero means none.
- advantage_moop_cents (integer, required): Non-negative integer cents: Advantage in-network maximum out-of-pocket for Part A and B. Zero means not entered.
- advantage_coinsurance_pct (integer, required): Integer 0-100: Advantage medical coinsurance percent, applied to Part A cost sharing plus post-deductible Part B.
- worst_case_spend_multiplier (integer, optional): Optional integer 1-100, default 4: worst-case multiplier on Part B and drug spend. A modelling assumption, not a CMS figure.

## Sample

```json
{
  "coverage_structure": "OriginalOnly",
  "irmaa_tier": 0,
  "benefit_periods": 1,
  "days_per_period": 5,
  "snf_days": 0,
  "part_b_approved_charges_cents": 600000,
  "annual_drug_cost_cents": 250000,
  "part_d_deductible_cents": 61500,
  "supplemental_monthly_premium_cents": 16500,
  "advantage_moop_cents": 550000,
  "advantage_coinsurance_pct": 20,
  "plan_year": 2026
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_medicare_oop_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
