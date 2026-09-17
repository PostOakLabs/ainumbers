# Certified Payroll / Prevailing Wage Recomputation

Recomputes, for one stated certified-payroll week, whether each worker on a caller-declared payroll was paid at or above the wage-determination rate for their classification, with Contract Work Hours and Safety Standards Act overtime applied at time-and-a-half on the basic hourly rate and fringe due straight-time for every hour. A prime contractor verifying a subcontractor's weekly payroll and a Section 6418 credit-transferee or tax-equity investor diligencing a developer's prevailing-wage math before purchasing transferred credits can run the identical arithmetic; neither side is privileged. Where a submitted certified payroll is also supplied, the recomputed required gross for each worker, derived here from the wage determination and declared hours rather than lifted from the submission, is compared against it field by field. In PWA mode, any deficiency found triggers an IRC Section 45(b)(7)-(8) correction-payment and penalty computation re-verified against primary text at build: the wage-differential component of the correction is tripled on a declared intentional disregard, interest accrues at the Section 6621 underpayment rate with six percentage points substituted for three, and the penalty is five thousand dollars per underpaid worker for the stated period, ten thousand on intentional disregard, with annual aggregation across periods left to the caller since this kernel is single-run and stateless. An optional apprentice-ratio check compares a declared permitted ratio against declared journeyman and apprentice counts without a bundled fifty-state or program table and without reassigning excess-apprentice hours to the journeyman rate, both named in the artifact's not_proven list. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers an empty wage determination, an empty payroll, a payroll row whose classification is not found in the wage determination, and a run where no submitted certified payroll was supplied to compare against; none of these cases is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites the Davis-Bacon Act at 40 U.S.C. Section 3141 and following, 29 CFR Part 5, the Contract Work Hours and Safety Standards Act at 40 U.S.C. Section 3701 and following, IRC Section 45(b)(7)-(8) and its final regulations, and DOL Form WH-347, each dated for re-verification against primary text; no WH-347 expiration or sunset date is encoded because research turned up conflicting secondary-source dates. Stated boundary: this is not tax or legal advice, and a divergence against a submitted payroll is an arithmetic finding about the wage determination and hours supplied here, never a determination that any classification, hours, or correction figure is legally or factually correct.

- Page: https://ainumbers.co/chaingraph/art-574-certified-payroll-prevailing-wage-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-574-certified-payroll-prevailing-wage-recompute.md
- MCP tool: recompute_certified_payroll_pwa (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- apprentice_program (unknown, required)
- currency (string, required)
- intentional_disregard (boolean, required)
- irc_6621_underpayment_rate_percent (unknown, required)
- payroll_rows (unknown, required)
- project_ref (unknown, required)
- pwa_mode (boolean, required)
- submitted_payroll (unknown, required)
- underpayment_days (number, required): Duration in days
- wage_determination (unknown, required)
- week_ending_label (unknown, required)

## Outputs

- apprentice_check (string, optional)
- citations (object, optional)
- comparison_basis (string, optional)
- currency (string, optional)
- deficient_worker_count (integer, optional)
- diff (array, optional)
- fence (string, optional)
- indeterminate_reason (string, optional)
- minor_unit_exponent (integer, optional)
- not_proven (array, optional)
- note (string, optional)
- payroll_rows (array, optional)
- project_ref (string, optional)
- pwa_mode (boolean, optional)
- pwa_result (object, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- submitted_supplied (boolean, optional)
- total_deficiency_display (string, optional)
- total_deficiency_minor_units (integer, optional)
- verdict (string, optional)
- wage_determination (array, optional)
- week_ending_label (string, optional)

## Sample

```json
{
  "project_ref": "SYNTH-PROJ-574-A",
  "week_ending_label": "2026-08-01 payroll week",
  "currency": "USD",
  "pwa_mode": true,
  "wage_determination": [
    {
      "classification": "Electrician",
      "base_rate_minor_units": 4200,
      "fringe_rate_minor_units": 1100
    }
  ],
  "payroll_rows": [
    {
      "worker_id": "W-1",
      "classification": "Electrician",
      "st_hours": 40,
      "ot_hours": 4,
      "rate_paid_minor_units": 4200,
      "fringe_paid_minor_units": 1100
    }
  ],
  "submitted_payroll": [
    {
      "worker_id": "W-1",
      "gross_minor_units": 241600
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_certified_payroll_pwa` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
