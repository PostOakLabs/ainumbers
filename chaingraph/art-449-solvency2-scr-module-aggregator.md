# Solvency II SCR Standard-Formula Module Aggregator

Aggregates the five Solvency II standard-formula risk-module capital charges (market, counterparty default, life underwriting, health underwriting, non-life underwriting) into Basic SCR via the Delegated Regulation (EU) 2015/35 Annex IV correlation matrix, then adds the operational risk charge and subtracts the loss-absorbing adjustment (deferred tax/technical provisions) to produce total SCR. Delta over calculate_solvency2_scr_ratio (art-180), which takes `scr` as a given input and does not derive it from sub-module charges; feeds art-180's scr input. Not the US NAIC RBC action-level ladder (a different jurisdiction and regime, see compute_rbc_action_level). Solvency II Dir. 2009/138/EC + Del. Reg. (EU) 2015/35 Annex IV. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-449-solvency2-scr-module-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-449-solvency2-scr-module-aggregator.md
- MCP tool: aggregate_solvency2_scr_modules (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- modules (unknown, optional)
- operational (unknown, optional)

## Outputs

- adjustment_exceeds_bscr_plus_op (boolean, optional)
- bscr (number, optional)
- default_scr (integer, optional)
- health_scr (integer, optional)
- life_scr (integer, optional)
- loss_absorbing_adjustment (integer, optional)
- market_scr (integer, optional)
- nonlife_scr (integer, optional)
- scr_operational (integer, optional)
- scr_total (number, optional)

## Sample

```json
{
  "modules": {
    "market": 500,
    "default": 200,
    "life": 300,
    "health": 100,
    "nonlife": 400
  },
  "operational": {
    "scr_operational": 50,
    "loss_absorbing_adjustment": 30
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_solvency2_scr_modules` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
