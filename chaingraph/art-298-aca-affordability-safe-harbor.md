# ACA Affordability Safe-Harbor Calculator

Compute the ACA employer-mandate affordability percentage under each of the three IRC 4980H(a)(1)(B) safe harbors (W-2 wages, rate-of-pay, federal poverty line) against a supplied lowest-cost self-only monthly premium, using the version-pinned 2026 affordability threshold (9.96%, IRS Rev. Proc. 2025-25). Returns per-harbor affordability verdicts and which harbor(s) the offer satisfies. Root node of the aca-226j-response-composer chain. Not tax or legal advice - calculation evidence only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-298-aca-affordability-safe-harbor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-298-aca-affordability-safe-harbor.md
- MCP tool: compute_aca_affordability_safe_harbor (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fpl_mainland_annual (unknown, required)
- hourly_rate (unknown, required)
- lowest_cost_self_only_monthly_premium (unknown, required)
- tax_year (unknown, required)
- w2_box1_wages_annual (unknown, required)

## Outputs

- affordability_pct (number, optional)
- error (string, optional)
- harbors (object, optional)
- harbors_satisfied (array, optional)
- lowest_cost_self_only_monthly_premium (integer, optional)
- satisfies_any_harbor (boolean, optional)
- tax_year (string, optional)

## Sample

```json
{
  "tax_year": "2026",
  "lowest_cost_self_only_monthly_premium": 90,
  "w2_box1_wages_annual": 12000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_aca_affordability_safe_harbor` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
