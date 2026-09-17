# Basel Output-Floor Phase-In Simulator

Basel III finalization / 2026 reproposal output-floor simulator: applies the published floor mechanic (applied RWA = max(internal-model RWA, floor% x standardized RWA)) across a caller-supplied annual phase-in schedule, returning the year-by-year capital impact path, the first binding-floor year, and the maximum incremental RWA the floor adds versus the internal model. Phase-in years and floor percentages are jurisdiction-specific and, pre-finalization, still proposed - this node takes them as inputs from the caller's own rule text and never vendors or hardcodes a phase-in table.

- Page: https://ainumbers.co/chaingraph/art-358-simulate-output-floor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-358-simulate-output-floor.md
- MCP tool: simulate_output_floor (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- internal_model_rwa (number, optional)
- phase_in_schedule (array, required)
- rule_status (unknown, required)
- standardized_rwa (number, optional)

## Outputs

- binding_floor_year (string, optional)
- capital_impact_path (array, optional)
- floor_ever_binds (boolean, optional)
- internal_model_rwa (integer, optional)
- max_incremental_rwa (integer, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- rule_status (string, optional)
- standardized_rwa (integer, optional)

## Sample

```json
{
  "internal_model_rwa": 800000,
  "standardized_rwa": 1000000,
  "phase_in_schedule": [
    {
      "year": 2025,
      "floor_pct": 0.5
    },
    {
      "year": 2026,
      "floor_pct": 0.55
    },
    {
      "year": 2027,
      "floor_pct": 0.6
    },
    {
      "year": 2028,
      "floor_pct": 0.65
    },
    {
      "year": 2029,
      "floor_pct": 0.7
    },
    {
      "year": 2030,
      "floor_pct": 0.725
    }
  ],
  "rule_status": "proposed"
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_output_floor` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
