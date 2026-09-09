# §125 Cafeteria Plan Nondiscrimination Tester

Runs the §125 cafeteria-plan nondiscrimination tests from supplied aggregate participant counts: an eligibility-ratio test and a contributions-and-benefits ratio test (§410(b)-style ratio-percentage analogy - IRS has never finalized regs under §125(g)(3), DRAFT pending final rules), and the statutory key-employee 25% concentration limit (IRC §125(b)(2), fixed). Returns per-test pass/fail and the concentration ratio. Not a plan-qualification opinion - verify-side employer-evidence assembly only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-301-section125-ndt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-301-section125-ndt.md
- MCP tool: run_section125_ndt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- hce_avg_benefit_pct (unknown, required): Percentage value
- hce_eligible_count (unknown, required): Count
- hce_total_count (unknown, required): Count
- key_employee_elected_total (unknown, required)
- nhce_avg_benefit_pct (unknown, required): Percentage value
- nhce_eligible_count (unknown, required): Count
- nhce_total_count (unknown, required): Count
- total_elected_all_participants (unknown, required)

## Outputs

- all_tests_pass (boolean, optional)
- benefits (object, optional)
- concentration (object, optional)
- eligibility (object, optional)
- error (string, optional)

## Sample

```json
{
  "nhce_eligible_count": 180,
  "nhce_total_count": 200,
  "hce_eligible_count": 20,
  "hce_total_count": 20,
  "nhce_avg_benefit_pct": 0.06,
  "hce_avg_benefit_pct": 0.055,
  "key_employee_elected_total": 15000,
  "total_elected_all_participants": 100000
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_section125_ndt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
