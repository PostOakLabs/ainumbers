# Hedge Effectiveness Test

ASC 815-20-35 retrospective hedge effectiveness test. Computes dollar-offset ratio (fair-value change of hedging instrument / hedged item, must be 80-125%) and OLS R-squared regression (must be >=0.8) using pure deterministic arithmetic - no Math.sqrt/log/pow transcendentals. RFC 3161 anchor surface for timestamped hedge designation evidence. Emits is_effective (bool), offset_ratio_pct, r_squared, and compliance_flags. ZERO PII: price series data only.

- Page: https://ainumbers.co/chaingraph/art-261-test-hedge-effectiveness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-261-test-hedge-effectiveness.md
- MCP tool: test_hedge_effectiveness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- effectiveness_standard (unknown, required)
- hedge_ratio (unknown, required)
- hedged_item_changes (array, required)
- hedging_instrument_changes (array, required)
- method (unknown, required)

## Outputs

- anchor_surface (string, optional)
- asc815_80_125_band (string, optional)
- cumulative_hedged_change (integer, optional)
- cumulative_hedging_change (integer, optional)
- dollar_offset_effective (boolean, optional)
- dollar_offset_ratio (number, optional)
- effectiveness_reason (string, optional)
- effectiveness_standard (string, optional)
- hedge_ratio (integer, optional)
- ifrs9_hedge_ratio_passes (boolean, optional)
- is_effective (boolean, optional)
- method_applied (string, optional)
- not_legal_advice (string, optional)
- observation_count (integer, optional)
- ols_alpha (number, optional)
- ols_beta (number, optional)
- pii_note (string, optional)
- r_squared (number, optional)
- regression_effective (boolean, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "method": "both",
  "effectiveness_standard": "asc815",
  "hedge_ratio": 1,
  "hedged_item_changes": [
    100,
    150,
    200,
    -50,
    -100
  ],
  "hedging_instrument_changes": [
    -95,
    -145,
    -195,
    48,
    97
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `test_hedge_effectiveness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
