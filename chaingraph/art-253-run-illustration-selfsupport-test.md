# Life Illustration Self-Support Test (NAIC Model 582)

Runs the NAIC Model Regulation 582 §8C self-support test (year 15 and year 20 account value positive) and §8D lapse-support prohibition check for life insurance illustrations. ASOP 24 compliant. Inputs: projected account values, premium payments, cost of insurance, expense charges, credited interest, and optional lapse rates per policy year. Outputs: self_support_pass (both year-15 and year-20), lapse_support_flag, and illustration_valid. Use in life-illustration-self-support-test linear chain. ZERO PII: projected cash flows and policy mechanics only.

- Page: https://ainumbers.co/chaingraph/art-253-run-illustration-selfsupport-test.html
- Markdown twin: https://ainumbers.co/chaingraph/art-253-run-illustration-selfsupport-test.md
- MCP tool: run_illustration_selfsupport_test (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- account_values (unknown, required)
- cost_of_insurance (unknown, required)
- credited_interest (unknown, required)
- expense_charges (unknown, required)
- face_amount (unknown, required)
- lapse_rates (unknown, required)
- premium_payments (unknown, required)

## Outputs

- account_value_yr15 (integer, optional)
- account_value_yr20 (integer, optional)
- cumulative_net (integer, optional)
- face_amount (integer, optional)
- illustration_valid (boolean, optional)
- issues (array, optional)
- lapse_adjusted_av_yr20 (integer, optional)
- lapse_support_flag (boolean, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- policy_years_provided (integer, optional)
- regulatory_basis (string, optional)
- self_support_pass (boolean, optional)
- self_support_yr15_pass (boolean, optional)
- self_support_yr20_pass (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_coi (integer, optional)
- total_expenses (integer, optional)
- total_interest (integer, optional)
- total_premiums (integer, optional)

## Sample

```json
{
  "account_values": [
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
    1000,
    1100,
    1200,
    1300,
    1400,
    1500,
    1600,
    1700,
    1800,
    1900,
    2000
  ],
  "premium_payments": [
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120,
    120
  ],
  "cost_of_insurance": [
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50,
    50
  ],
  "expense_charges": [
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20
  ],
  "credited_interest": [
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45,
    45
  ],
  "face_amount": 100000
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_illustration_selfsupport_test` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
