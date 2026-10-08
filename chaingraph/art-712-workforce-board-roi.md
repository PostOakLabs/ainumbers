# Workforce Board ROI Report

Workforce program ROI report generator ported from ApexLogics Apex #15 (AL-07). From a program budget, enrollment and WIOA outcome data the node computes cost per participant, cost per employed exit (Q2) and cost per credential; a five-indicator benchmark scorecard against the WIOA PY 2023 target sets for adult, dislocated-worker and youth programs (each indicator exceeds, meets, below or not applicable); an annualized wage gain against the official BLS QCEW Q3 2023 sector baseline for twelve sector keys; a fixed-rate annual taxpayer tax-recapture estimate, a break-even horizon, a three-year net benefit and a three-year return per dollar; and an overall ROI grade (Excellent, Strong, Moderate, Below Target, Scored or Pending Data). Missing required fields and out-of-domain values are named refusals, never throws. Sector baselines are official QCEW Q3 2023 private-sector weekly wage x52 constants; the WIOA PY 2023 target values ride in-kernel flagged UNGROUNDED pending an official DOL ETA source, and the 30 percent tax-recapture rate is a modeling assumption, not a statutory rate.

- Page: https://ainumbers.co/chaingraph/art-712-workforce-board-roi.html
- Markdown twin: https://ainumbers.co/chaingraph/art-712-workforce-board-roi.md
- MCP tool: workforce_board_roi_report (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- program_name (string, optional): Display name of the program; defaults to 'Unnamed Program' when blank.
- program_type (string, required): WIOA Title I-B program type; selects the WIOA PY 2023 target set. Required.
- program_year (string, optional): Program year label; echoed only.
- sector (string, required): Target sector key; selects the BLS QCEW Q3 2023 baseline annual wage. Required.
- total_budget (number, required): Total program budget in USD; must be greater than 0. Required.
- avg_training_weeks (number, optional): Average training duration in weeks; optional, display only.
- participants_enrolled (integer, required): Participants enrolled; must be >= 1. Required.
- participants_exited (integer, optional): Participants exited; defaults to participants_enrolled when omitted.
- emp_rate_q2 (number, optional): Employment rate 2nd quarter after exit, percent (0-100); null when not applicable.
- emp_rate_q4 (number, optional): Employment rate 4th quarter after exit, percent (0-100); null when not applicable.
- median_earnings_q2 (number, optional): Median earnings 2nd quarter after exit, USD (>= 0); null when not entered.
- credential_rate (number, optional): Credential attainment rate, percent (0-100); null when not applicable.
- skill_gains_rate (number, optional): Measurable skill gains rate, percent (0-100); null when not applicable.

## Sample

```json
{
  "program_name": "Advanced Manufacturing Cohort 3",
  "program_type": "adult",
  "program_year": "PY 2023",
  "sector": "manufacturing",
  "total_budget": 500000,
  "avg_training_weeks": 16,
  "participants_enrolled": 150,
  "participants_exited": 120,
  "emp_rate_q2": 76,
  "emp_rate_q4": 74,
  "median_earnings_q2": 6200,
  "credential_rate": 53,
  "skill_gains_rate": 56
}
```

## Verify

Run the sample policy_parameters through MCP tool `workforce_board_roi_report` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
