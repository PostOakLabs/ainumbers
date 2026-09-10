# Securitisation Payment Waterfall Recomputation

Recomputes a securitisation payment waterfall for one stated period from the aggregate available funds and the priority ladder the investor already holds, then compares the result against what the investor report says was paid. The allocation is derived here by running the ladder, not lifted from the report, so the comparison has independent provenance on both sides rather than re-adding a published column. The ladder, every cap, every trigger threshold and every diversion come from the caller transaction documents: no deal library, no bundled ladder, no market convention threshold and no rate or index table is held here, and the ladder reference the caller pins is carried in the artifact and shown on screen so a later amendment makes an old receipt dated rather than wrong. Steps whose amount is set by a document that is not public, such as a trustee fee or a senior expense governed by a fee letter, are declared asserted by the caller and are reported as asserted inputs rather than as figures this tool derived. A failing test suppresses only the step identifiers the caller declared against that test, so divert behaviour is never inferred from a test name or from convention. Absent any asserted allocations the run is reported as recompute only, which is its own state and never agreement. Money is fixed point in integer minor units throughout with two decimal display, ratio tests are compared by integer cross multiplication so no division occurs on the comparison path, and zero available funds, an empty ladder and a zero ratio denominator each resolve to a defined result rather than to a not a number. No Article 7 disclosure template is read, validated or asserted anywhere, and the arithmetic needs no loan level data. Stated boundary: a shortfall or a difference against the report is an arithmetic finding about the ladder and figures supplied. It forecasts nothing, models no scenario, performs no credit or rating analysis, and makes no assertion that the deal was paid correctly or that it complies with anything.

- Page: https://ainumbers.co/chaingraph/art-509-recompute-payment-waterfall.html
- Markdown twin: https://ainumbers.co/chaingraph/art-509-recompute-payment-waterfall.md
- MCP tool: recompute_payment_waterfall (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asserted_allocations (unknown, required)
- available_funds (unknown, required)
- available_funds_minor_units (unknown, required)
- currency (string, required)
- deal_ref (unknown, required)
- ladder_ref (unknown, required)
- period_label (unknown, required)
- priority_ladder (unknown, required)
- tests (unknown, required)

## Outputs

- asserted_step_count (integer, optional)
- available_funds_by_ledger (array, optional)
- basis (object, optional)
- citations (object, optional)
- comparison_basis (string, optional)
- comparison_state (string, optional)
- currency (string, optional)
- deal_ref (string, optional)
- diff (array, optional)
- first_unfunded_step (string, optional)
- ladder_ref (object, optional)
- minor_unit_exponent (integer, optional)
- no_template_claim (string, optional)
- note (string, optional)
- period_label (string, optional)
- rationale (array, optional)
- recompute_only_note (string, optional)
- recomputed_step_count (integer, optional)
- rejected_inputs (array, optional)
- residual_by_ledger (array, optional)
- residual_display (string, optional)
- residual_minor_units (integer, optional)
- step_count (integer, optional)
- steps (array, optional)
- test_results (array, optional)
- total_available_display (string, optional)
- total_available_minor_units (integer, optional)
- total_paid_display (string, optional)
- total_paid_minor_units (integer, optional)
- total_shortfall_display (string, optional)
- total_shortfall_minor_units (integer, optional)

## Sample

```json
{
  "period_label": "2025-07 collection period",
  "deal_ref": "SYNTH-2025-A",
  "currency": "EUR",
  "ladder_ref": {
    "document_ref": "SYNTHETIC PROSPECTUS SYNTH-2025-A",
    "section_ref": "Priority of Payments, items a to f",
    "version": "1.0",
    "dated": "2025-05-01"
  },
  "available_funds": [
    {
      "ledger": "interest",
      "amount_minor_units": 12500000
    }
  ],
  "priority_ladder": [
    {
      "step_id": "a",
      "label": "Trustee fee",
      "basis": "Fee letter, not a public document",
      "ledger": "interest",
      "amount_due_minor_units": 150000,
      "amount_source": "asserted"
    },
    {
      "step_id": "b",
      "label": "Senior expenses",
      "basis": "Fee letter, not a public document",
      "ledger": "interest",
      "amount_due_minor_units": 350000,
      "amount_source": "asserted",
      "cap_minor_units": 400000
    },
    {
      "step_id": "c",
      "label": "Class A interest",
      "basis": "Prospectus interest provisions",
      "ledger": "interest",
      "amount_due_minor_units": 6200000
    },
    {
      "step_id": "d",
      "label": "Cash reserve replenishment",
      "basis": "Prospectus reserve provisions",
      "ledger": "interest",
      "amount_due_minor_units": 4000000,
      "cap_minor_units": 4000000
    },
    {
      "step_id": "e",
      "label": "Class B interest",
      "basis": "Prospectus interest provisions",
      "ledger": "interest",
      "amount_due_minor_units": 2400000
    }
  ],
  "tests": [
    {
      "test_id": "credit-enhancement",
      "label": "Credit enhancement test",
      "basis": "Threshold declared by the caller from the transaction documents",
      "comparator": "gte",
      "measured_numerator": 1450,
      "measured_denominator": 10000,
      "threshold_numerator": 1000,
      "threshold_denominator": 10000
    }
  ],
  "asserted_allocations": [
    {
      "step_id": "a",
      "amount_minor_units": 150000
    },
    {
      "step_id": "b",
      "amount_minor_units": 350000
    },
    {
      "step_id": "c",
      "amount_minor_units": 6200000
    },
    {
      "step_id": "d",
      "amount_minor_units": 4000000
    },
    {
      "step_id": "e",
      "amount_minor_units": 1800000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_payment_waterfall` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
