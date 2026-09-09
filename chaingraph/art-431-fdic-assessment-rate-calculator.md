# FDIC Deposit-Insurance Assessment Rate Calculator

FDIC deposit-insurance assessment rate calculator (12 CFR 327): looks up the base assessment rate for a supplied composite CAMELS + financial-ratio score against a caller-supplied rate schedule, then applies the unsecured-debt and brokered-deposit adjustments and floors/caps the result to a caller-supplied statutory range. The rate schedule is caller-supplied policy input, not hardcoded, so a future FDIC rate-schedule update (including a pending assessments rulemaking) is a policy_parameters change, not a kernel change. Does not compute the composite CAMELS score itself.

- Page: https://ainumbers.co/chaingraph/art-431-fdic-assessment-rate-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-431-fdic-assessment-rate-calculator.md
- MCP tool: compute_fdic_assessment_rate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assessment_base_musd (number, optional)
- brokered_deposit_adjustment_bp (number, optional)
- rate_brackets (unknown, required)
- rate_cap_bp (number, required)
- rate_floor_bp (number, optional)
- rate_schedule_version (unknown, required)
- total_score (number, optional)
- unsecured_debt_adjustment_bp (number, optional)

## Outputs

- assessment_base_musd (integer, optional)
- base_rate_bp (integer, optional)
- brokered_deposit_adjustment_bp (number, optional)
- estimated_quarterly_assessment_musd (number, optional)
- note (string, optional)
- npr_banner (string, optional)
- rate_cap_bp (integer, optional)
- rate_floor_bp (number, optional)
- rate_floor_or_cap_applied (boolean, optional)
- rate_schedule_version (string, optional)
- total_rate_bp (number, optional)
- total_score (integer, optional)
- unsecured_debt_adjustment_bp (integer, optional)

## Sample

```json
{
  "rate_schedule_version": "FDIC-2023-FINAL-RULE-SAMPLE-V1",
  "total_score": 62,
  "rate_brackets": [
    {
      "max_score": 50,
      "base_rate_bp": 4
    },
    {
      "max_score": 75,
      "base_rate_bp": 7
    },
    {
      "max_score": 90,
      "base_rate_bp": 12
    },
    {
      "max_score": null,
      "base_rate_bp": 20
    }
  ],
  "unsecured_debt_adjustment_bp": -1,
  "brokered_deposit_adjustment_bp": 0.5,
  "rate_floor_bp": 1.5,
  "rate_cap_bp": 40,
  "assessment_base_musd": 8000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_fdic_assessment_rate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
