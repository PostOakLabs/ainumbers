# Deterministic Amortization Schedule

Demonstrator node for the shared _amort.bundle.mjs kernel: a deterministic amortization-schedule engine over seven closed day-count conventions (six calendar conventions from ISDA 2006 Definitions Section 4.16 - 30/360 US, 30E/360, 30E/360 (ISDA), Actual/360, Actual/365 Fixed, Actual/Actual (ISDA) - plus UNIT_PERIOD for lease/revenue schedules that discount over equal periods rather than calendar day counts). Computes, per period, the effective-interest method's period_fraction, periodic_rate, interest, principal_component and closing_balance, each an independently-declared rounding step, plus a mandatory final-period plug that absorbs rounding residue so the schedule amortizes to exactly zero within a declared bound. Supports a bracketed-bisection rate solve (art-215's discipline, generalized: constant 200-step bound, sign-change bracket required before any rate is reported, no Newton/secant), scoped honestly to UNIT_PERIOD only - a calendar convention's period_fraction is a real-valued fraction of a year that need not align with the solver's ordinal-integer-period PV formula, so calendar conventions require a caller-supplied annual_rate rather than a mismatched solve. Mid-stream remeasurement is modeled as schedule SEGMENTATION, never mutation: a new segment's opening balance is always the prior segment's exact closing balance, asserted as a continuity_invariant, with the prior segment retained unmodified. No engine transcendentals anywhere (SPEC.md Section 18.5): every exponent is an integer computed by repeated squaring and every rounding step multiplies by a literal power-of-ten, never Math.pow. This is a reusable shared kernel's demonstrator, not itself an ASC 842 / ASC 606 / CECL wave-specific tool - waves 6, 7 and 10 inline this bundle directly rather than calling this node.

- Page: https://ainumbers.co/chaingraph/art-626-deterministic-amortization-schedule.html
- Markdown twin: https://ainumbers.co/chaingraph/art-626-deterministic-amortization-schedule.md
- MCP tool: compute_deterministic_amortization_schedule (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- principal (number, required)
- annual_rate (number, optional)
- convention (string, required)
- periods_per_year (number, optional)
- periods (array, required)
- solve_rate (boolean, optional)
- apply_final_plug (boolean, optional)
- max_plug (number, optional)
- remeasurement (object, optional)

## Outputs

- convention (string,null, optional)
- periods_per_year (number, optional)
- schedule (array,null, optional)
- rate_solve (object,null, optional)
- final_plug (object,null, optional)
- remeasurement (object,null, optional)
- rounding_steps (array, optional)
- bounds (object, optional)
- day_count_source (string,null, optional)
- note (string, optional)

## Sample

```json
{
  "principal": 1200,
  "annual_rate": 0.12,
  "convention": "UNIT_PERIOD",
  "periods_per_year": 12,
  "periods": [
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": false
    },
    {
      "unit_fraction": 1,
      "payment": 106.6,
      "is_termination": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_deterministic_amortization_schedule` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
