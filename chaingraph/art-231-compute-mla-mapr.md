# Compute MLA MAPR (closed-end)

Computes the Military Annual Percentage Rate for CLOSED-END consumer credit and tests it against the 36 percent limit that 10 USC 987(b) imposes and 32 CFR 232.4(b) sets out. 32 CFR 232.4(c)(2)(i) directs that a closed-end MAPR is calculated by Regulation Z's own rules for the annual percentage rate, based on the wider charge set in 232.4(c)(1), so this node solves the Appendix J actuarial equation from a cash-flow schedule instead of dividing charges by an original principal. A fraction of a unit-period is priced at simple interest per Appendix J (b)(6), only whole unit-periods compound, and the annual figure is the unit-period rate multiplied by the unit-periods in a year per (b)(1). A single advance repaid by a single payment takes its term as the unit-period per (b)(4)(ii), with 365 divided by the days in the term as the unit-periods per year per (b)(5)(vi) and (b)(5)(vii), so the term is day-granular and a 45-day loan is expressible rather than quantised to whole months. Every charge 232.4(c)(1) includes carries its own input: credit insurance premiums, debt cancellation contract fees and debt suspension agreement fees under (c)(1)(i), credit-related ancillary product fees under (c)(1)(ii), finance charges under (c)(1)(iii)(A), application fees under (c)(1)(iii)(B), and participation fees under (c)(1)(iii)(C). Each of them moves the reported rate. The application-fee exception in (c)(1)(iii)(B) is evaluated as the three conjunctive predicates the text states, a Federal credit union or insured depository institution creditor, a short-term small amount loan, and a fee charged not more than once in any rolling 12-month period; with anything less than all three the fee stays in. SCOPE, stated plainly: open-end credit is OUT OF SCOPE. 32 CFR 232.4(c)(2)(ii)(A) prices open-end credit on the balance for a billing cycle under 12 CFR 1026.14(c) and (d), and 232.4(c)(2)(ii)(B) governs a billing cycle with no balance. Neither is computed here, and a call declaring an open-end class or a credit card account returns no rate rather than a closed-end number. Because the bona fide fee exclusion in 232.4(d)(1) reaches only a credit card account under an open-end plan, no such exclusion is available on this path, so a caller-declared bona fide amount is recorded and included anyway. A charge is modelled as collected at consummation and deducted from the amount financed, except a finance charge, which is carried by the payment schedule and never deducted twice. A rate is reported only when a sign-change bracket was established and narrowed, so a schedule with no non-negative rate returns no figure rather than a guess. A schedule of more than 600 payments is out of scope and also returns no rate: that ceiling is a declared structural limit of this node, not a rule of law, and it keeps the work done per call bounded by a constant rather than by a caller-supplied payment count. RELATED NODE, so the two MLA MAPR nodes are told apart: this node DERIVES the payment schedule itself from described loan terms, an amount advanced repaid either by a single payment at a stated term in days or by a level installment series, so it is the one to reach for when the cash flows are not already in hand. Where a caller ALREADY HOLDS the cash flows, art-616-mla-mapr-actuarial-recompute recomputes the same closed-end MAPR by the same Appendix J actuarial method directly from those caller-supplied cash flows and charges, deriving no schedule of its own. DoD MLA rule 80 FR 43560 (22 July 2015): effective 1 October 2015, compliance required from 3 October 2016 and from 3 October 2017 for credit card accounts.

- Page: https://ainumbers.co/chaingraph/art-231-compute-mla-mapr.html
- Markdown twin: https://ainumbers.co/chaingraph/art-231-compute-mla-mapr.md
- MCP tool: compute_mla_mapr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- ancillary_product_fee_total (unknown, required)
- application_fee (unknown, required)
- application_fee_once_in_rolling_12_months (boolean, required)
- bona_fide_fee_claimed_total (unknown, required)
- credit_class (unknown, required)
- credit_insurance_premium_total (unknown, required)
- creditor_is_fcu_or_idi (boolean, required)
- debt_cancellation_fee_total (unknown, required)
- debt_suspension_fee_total (unknown, required)
- finance_charge_total (unknown, required)
- is_credit_card (boolean, required)
- is_short_term_small_amount_loan (boolean, required)
- loan_amount (unknown, required)
- participation_fee_annual (unknown, required)
- payment_amount (unknown, required)
- payment_count (number, optional): Count
- payment_structure (unknown, required)
- payments_per_year (number, optional)
- term_days (number, optional): Duration in days

## Outputs

- amount_advanced (integer, optional)
- amount_financed_mapr (integer, optional)
- application_fee_carve_out_applied (boolean, optional)
- application_fee_carve_out_predicates (object, optional)
- approaching_cap_threshold_basis (string, optional)
- approaching_cap_threshold_pct (integer, optional)
- bona_fide_exclusion_available (boolean, optional)
- bona_fide_fee_claimed_total (integer, optional)
- bracketed (boolean, optional)
- charge_breakdown (array, optional)
- converged (boolean, optional)
- credit_class (string, optional)
- exceeds_cap (boolean, optional)
- finance_charge_in_schedule (number, optional)
- in_scope (boolean, optional)
- iterations (integer, optional)
- mapr_cap_pct (integer, optional)
- mapr_determined (boolean, optional)
- mapr_pct (number, optional)
- max_payment_count (integer, optional)
- method_basis (string, optional)
- payment_amount (number, optional)
- payment_count (integer, optional)
- payment_count_exceeds_limit (boolean, optional)
- payment_structure (string, optional)
- payment_total (number, optional)
- periodic_rate (number, optional)
- pii_note (string, optional)
- prepaid_includable_charges (integer, optional)
- regulatory_basis (string, optional)
- scope_note (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- term_days (integer, optional)
- total_excluded_charges (integer, optional)
- total_includable_charges (number, optional)
- unit_periods_per_year (number, optional)

## Sample

```json
{
  "credit_class": "closed_end",
  "payment_structure": "single_payment",
  "loan_amount": 500,
  "term_days": 45,
  "finance_charge_total": 28.44
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_mla_mapr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
