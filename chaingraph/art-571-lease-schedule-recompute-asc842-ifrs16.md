# Lease Schedule Recompute - ASC 842 / IFRS 16

Recomputes the present value of a declared lease payment schedule and the full effective-interest amortization - liability and right-of-use asset - under ASC 842 and IFRS 16 side by side, from a caller-declared discount rate and payment schedule. Runs the ASC 842 five-criterion finance-vs-operating classification test: ownership transfer, a purchase option reasonably certain of exercise, and specialized-asset status are always caller-declared; the major-part-of-economic-life and substantially-all-of-fair-value criteria are computed against the common 75%/90% bright lines only when the caller elects them, and otherwise are caller-declared judgment inputs - an election is always labeled as such, never silently defaulted. IFRS 16 applies a single on-balance-sheet lessee model with no operating/finance distinction. Optionally diffs the ASC 842 or IFRS 16 closing liability at each payment date against a counterparty-supplied preparer schedule within a declared tolerance, returning MATCHES, DIVERGES, or INDETERMINATE when no preparer schedule is supplied or preparer dates do not appear in the computed schedule. Payment timing (arrears - payments at period end, the ordinary annuity - or advance - payments at period start, the annuity due) is a required declared input, never defaulted: the declared convention gates which payment dates are admissible, and the present value always follows the declared dates. The discount rate is always a declared input, never inferred or derived. On every computed run the output carries an evidence_handover stage: the disclosure figures each regime produced (initial liability and ROU asset, total payments and total interest over the term, final closing liability) plus the pointer to the offline evidence-handover bundle tool that packages this receipt - referenced, never executed, by this kernel. Performs arithmetic only over caller-declared terms; does not source a discount rate, does not determine what qualifies as a specialized asset, and reproduces no FASB or IASB standard text - citations are to paragraph numbers only. Clause: ASC 842 (FASB ASC Topic 842), classification criteria at ASC 842-10-25-2 through 25-3; IFRS 16, effective 2019-01-01.

- Page: https://ainumbers.co/chaingraph/art-571-lease-schedule-recompute-asc842-ifrs16.html
- Markdown twin: https://ainumbers.co/chaingraph/art-571-lease-schedule-recompute-asc842-ifrs16.md
- MCP tool: recompute_lease_schedule_asc842_ifrs16 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- classification_inputs (unknown, required)
- compare_regime (string, required)
- diff_tolerance_minor (unknown, required)
- discount_rate_annual (number, required)
- initial_direct_costs_minor (unknown, required)
- lease_incentives_minor (unknown, required)
- lease_term (unknown, required)
- payment_schedule (array, required)
- preparer_schedule (array, required)
- timing (unknown, required)

## Outputs

- asc842 (object, optional)
- clause_note (string, optional)
- decision (object, optional)
- diff (object, optional)
- elections (array, optional)
- findings (array, optional)
- ifrs16 (object, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "discount_rate_annual": 0.06,
  "lease_term": {
    "commencement_date": "2026-01-01",
    "end_date": "2029-01-01"
  },
  "payment_schedule": [
    {
      "date": "2027-01-01",
      "amount_minor": 1000000
    },
    {
      "date": "2028-01-01",
      "amount_minor": 1000000
    },
    {
      "date": "2029-01-01",
      "amount_minor": 1000000
    }
  ],
  "initial_direct_costs_minor": 10000,
  "lease_incentives_minor": 5000,
  "classification_inputs": {
    "ownership_transfers": false,
    "purchase_option_reasonably_certain": false,
    "specialized_asset": false,
    "major_part_bright_line_elected": true,
    "economic_life_years": 4,
    "substantially_all_bright_line_elected": true,
    "fair_value_minor": 2813556
  },
  "preparer_schedule": [
    {
      "date": "2027-01-01",
      "liability_balance_minor": 1833251
    },
    {
      "date": "2028-01-01",
      "liability_balance_minor": 943246
    },
    {
      "date": "2029-01-01",
      "liability_balance_minor": 0
    }
  ],
  "compare_regime": "asc842",
  "diff_tolerance_minor": 0,
  "timing": "arrears"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_lease_schedule_asc842_ifrs16` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
