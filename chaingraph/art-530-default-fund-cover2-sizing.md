# CCP Default Fund Cover-2 Sizing

Sizes a CCP default fund under the PFMI Principle 4 "Cover 2" standard: fund size must be at least the largest plus second-largest clearing-member stress loss across caller-declared stress scenarios. Applies each caller-declared scenario loss rate (in basis points, shaped from qfa-03-stress-test-engine's scenario_losses output as a chained input) to every caller-declared member exposure, ranks members per scenario, takes the two largest, and checks a caller-declared fund size against the worst scenario across the declared set. Not a stress-loss engine itself - qfa-03 already computes multi-scenario portfolio stress losses; this node consumes that shape read-only and never reimplements it. Region-portable: no CCP, currency, or jurisdiction is hardcoded. Arithmetic sizing check only, no fund-size recommendation.

- Page: https://ainumbers.co/chaingraph/art-530-default-fund-cover2-sizing.html
- Markdown twin: https://ainumbers.co/chaingraph/art-530-default-fund-cover2-sizing.md
- MCP tool: size_ccp_default_fund_cover2 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- fund_size_minor_units (unknown, required)
- members (array, required)
- stress_scenarios (array, required)

## Outputs

- as_of (string, optional)
- fund_adequate (boolean, optional)
- fund_size_display (string, optional)
- fund_size_minor_units (integer, optional)
- member_count (integer, optional)
- note (string, optional)
- per_scenario (array, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- scenario_count (integer, optional)
- shortfall_display (string, optional)
- shortfall_minor_units (integer, optional)
- worst_case_cover2_requirement_display (string, optional)
- worst_case_cover2_requirement_minor_units (integer, optional)
- worst_case_scenario_id (string, optional)

## Sample

```json
{
  "as_of": "2026-08-01",
  "fund_size_minor_units": 200000000,
  "members": [
    {
      "member_id": "member-alpha",
      "exposure_minor_units": 200000000
    },
    {
      "member_id": "member-beta",
      "exposure_minor_units": 150000000
    },
    {
      "member_id": "member-gamma",
      "exposure_minor_units": 60000000
    }
  ],
  "stress_scenarios": [
    {
      "scenario_id": "gfc_2008",
      "loss_bps": 4620
    },
    {
      "scenario_id": "covid_2020",
      "loss_bps": 3240
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `size_ccp_default_fund_cover2` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
