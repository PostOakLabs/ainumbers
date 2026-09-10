# Private Student Loan Disclosure & Rescission Checker

Checks a private-education-loan disclosure-element checklist across the three 12 CFR 1026.46-48 stages (application/solicitation, approval, final), the HEOA self-certification-form presence requirement, and computes the 3-business-day right-to-cancel window from a declared final-disclosure date (skipping weekends and any declared holiday dates). Federal Income-Driven Repayment (IDR) calculations are explicitly out of scope v1 - flagged as a future rider trigger, not built, because those formulas churn on a policy cycle distinct from the stable 1026.46-48 requirements checked here.

- Page: https://ainumbers.co/chaingraph/art-405-check-private-student-loan-disclosures.html
- Markdown twin: https://ainumbers.co/chaingraph/art-405-check-private-student-loan-disclosures.md
- MCP tool: check_private_student_loan_disclosures (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- application_stage (object, optional)
- approval_stage (object, optional)
- completeness_grade (string, optional)
- compliant (boolean, optional)
- disambiguation (string, optional)
- elements_checked (integer, optional)
- federal_idr_note (string, optional)
- federal_idr_out_of_scope (boolean, optional)
- final_stage (object, optional)
- gap_count (integer, optional)
- regulatory_basis (string, optional)
- rescission (object, optional)
- self_certification_present (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "inputs": {
    "application_elements": [
      {
        "element": "interest-rate-or-range",
        "status": "complete"
      },
      {
        "element": "fees-and-default-charges",
        "status": "complete"
      },
      {
        "element": "repayment-terms",
        "status": "complete"
      },
      {
        "element": "cosigner-rights-disclosure",
        "status": "complete"
      },
      {
        "element": "estimated-total-cost",
        "status": "complete"
      }
    ],
    "approval_elements": [
      {
        "element": "confirmed-interest-rate",
        "status": "complete"
      },
      {
        "element": "confirmed-fees",
        "status": "complete"
      },
      {
        "element": "confirmed-repayment-terms",
        "status": "complete"
      },
      {
        "element": "right-to-accept-30-days-disclosure",
        "status": "complete"
      },
      {
        "element": "rate-lock-period-disclosure",
        "status": "complete"
      }
    ],
    "final_elements": [
      {
        "element": "final-interest-rate",
        "status": "complete"
      },
      {
        "element": "final-fees",
        "status": "complete"
      },
      {
        "element": "final-repayment-schedule",
        "status": "complete"
      },
      {
        "element": "right-to-cancel-3-day-disclosure",
        "status": "complete"
      }
    ],
    "self_certification_present": true,
    "final_disclosure_date": "2026-07-20",
    "holiday_dates": []
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_private_student_loan_disclosures` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
