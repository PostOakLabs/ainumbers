# Multi-Currency PvP Validator

Validate atomic cross-currency PvP settlement on Canton to eliminate Herstatt risk in FX and multi-currency repo. Covers PFMI P12 PvP model compliance, FX netting, and repo pre-funding windows.

- Page: https://ainumbers.co/tools/511-multi-currency-pvp-validator.html
- Markdown twin: https://ainumbers.co/tools/511-multi-currency-pvp-validator.md
- MCP tool: validate_pvp_settlement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- atomicity_type (unknown, required)
- canton_leg (boolean, required)
- finality_type (unknown, required)
- has_unwind_procedure (boolean, required)
- legs (array, required)

## Outputs

- has_canton_leg (boolean, optional)

## Sample

```json
{
  "legs": [
    {
      "ccy_sold": "USD",
      "ccy_bought": "EUR",
      "notional": 1000000,
      "implied_rate": 0.92
    }
  ],
  "atomicity_type": "atomic_pvp",
  "finality_type": "irrevocable_realtime",
  "has_unwind_procedure": true,
  "canton_leg": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_pvp_settlement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
