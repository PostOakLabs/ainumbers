# Multi-Garnishment Stacking Recomputation

Recomputes, for one stated pay period, how much of an employee's disposable earnings each order in a caller-declared garnishment stack may lawfully withhold, then compares the recomputed per-order withholding against a garnishment notice where one is supplied. Both an employer computing what to withhold and an employee or legal-aid clinic recomputing a notice they received can run the same arithmetic; neither side is privileged. Disposable earnings are computed from caller-supplied gross earnings less legally-required deductions. Each order type carries its own statutory cap: child-support orders use the CCPA Title III tiers of 50, 55, 60 or 65 percent keyed on arrears over 12 weeks and a second family; a federal tax levy is exempt from the CCPA percentage limitations and is capped here only at remaining disposable earnings, with the IRS wage-bracket exempt-amount table named as out of scope; a state levy uses a caller-declared percentage where supplied and otherwise defaults to the general CCPA cap, with no fifty-state table bundled; an HEA Administrative Wage Garnishment order is capped at 15 percent of disposable earnings and by the 30-times-federal-minimum-wage floor; and creditor and other orders use the general CCPA cap of 25 percent or the 30-times floor, whichever is less. Orders are withheld in the priority order the caller supplies, subject to each order's own cap and an aggregate ceiling equal to the single highest individual cap present in the stack, a documented simplification named in the artifact's not_proven list. A dated, caller-overridable federal minimum wage prefill feeds the 30-times floor. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers both an empty order stack and a run where no noticed withholding amounts were supplied to compare against; neither case is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites the Consumer Credit Protection Act Title III, 29 CFR Part 870, DOL Fact Sheet 30, and 34 CFR Part 34 for the Administrative Wage Garnishment cap, each dated for re-verification against primary text. Stated boundary: this is not legal advice, and a divergence against a supplied notice is an arithmetic finding about the order stack and figures supplied here, never a determination that any order is valid, enforceable, or correctly served.

- Page: https://ainumbers.co/chaingraph/art-572-multi-garnishment-stacking-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-572-multi-garnishment-stacking-recompute.md
- MCP tool: recompute_garnishment_stack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- currency (string, required)
- employee_ref (unknown, required)
- federal_minimum_wage_dated (unknown, required)
- federal_minimum_wage_minor_units (unknown, required)
- gross_minor_units (unknown, required)
- legally_required_deductions (unknown, required)
- noticed_amounts (unknown, required)
- orders (unknown, required)
- period_label (unknown, required)
- state_overlay (unknown, required)

## Outputs

- aggregate_cap_display (string, optional)
- aggregate_cap_minor_units (integer, optional)
- ccpa_floor_display (string, optional)
- ccpa_floor_minor_units (integer, optional)
- citations (object, optional)
- comparison_basis (string, optional)
- currency (string, optional)
- diff (array, optional)
- disposable_earnings_display (string, optional)
- disposable_earnings_floored_at_zero (boolean, optional)
- disposable_earnings_minor_units (integer, optional)
- employee_net_display (string, optional)
- employee_net_minor_units (integer, optional)
- employee_ref (string, optional)
- federal_minimum_wage_display (string, optional)
- federal_minimum_wage_minor_units (integer, optional)
- federal_minimum_wage_source (object, optional)
- fence (string, optional)
- first_uncapped_shortfall (string, optional)
- gross_display (string, optional)
- gross_minor_units (integer, optional)
- indeterminate_reason (string, optional)
- legally_required_deductions (array, optional)
- minor_unit_exponent (integer, optional)
- not_proven (array, optional)
- note (string, optional)
- noticed_supplied (boolean, optional)
- order_count (integer, optional)
- orders (array, optional)
- period_label (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- state_overlay (object, optional)
- total_deductions_display (string, optional)
- total_deductions_minor_units (integer, optional)
- total_withheld_display (string, optional)
- total_withheld_minor_units (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "employee_ref": "SYNTH-EMP-001",
  "period_label": "2026-01-15 biweekly pay period",
  "currency": "USD",
  "gross_minor_units": 100000,
  "legally_required_deductions": [
    {
      "label": "Federal income tax withholding",
      "amount_minor_units": 15000
    },
    {
      "label": "FICA",
      "amount_minor_units": 7650
    },
    {
      "label": "State income tax withholding",
      "amount_minor_units": 4000
    }
  ],
  "orders": [
    {
      "order_id": "ord-1",
      "label": "Child support order, county court",
      "type": "child_support",
      "arrears_over_12wk": false,
      "second_family": false,
      "claimed_amount_minor_units": 44010
    },
    {
      "order_id": "ord-2",
      "label": "Creditor garnishment",
      "type": "creditor",
      "claimed_amount_minor_units": 30000
    }
  ],
  "noticed_amounts": [
    {
      "order_id": "ord-1",
      "amount_minor_units": 44010
    },
    {
      "order_id": "ord-2",
      "amount_minor_units": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_garnishment_stack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
