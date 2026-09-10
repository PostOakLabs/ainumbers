# Buy-In Exposure Modeler

Models CSDR Refit last-resort mandatory buy-in exposure: eligible trigger date per asset class, extension period (liquid equity ~7 cal days, gov bond ~12, SME ~22), buy-in cost mark-up (default 5%), and cash-compensation alternative. CSDR Refit buy-in reform pending delegated acts (verify current status).

- Page: https://ainumbers.co/chaingraph/art-83-buy-in-exposure-modeler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-83-buy-in-exposure-modeler.md
- MCP tool: model_buy_in_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- buyin_markup_pct (unknown, optional): Percentage value
- cash_comp_premium_pct (unknown, optional): Percentage value
- delegated_acts_in_force (unknown, optional)
- fails (unknown, optional)

## Outputs

- buyin_triggered_count (integer, optional)
- modeled_fails (array, optional)
- note (string, optional)
- reference (object, optional)
- status_note (string, optional)
- total_buyin_exposure (integer, optional)
- total_cash_comp_exposure (integer, optional)
- total_fails (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `model_buy_in_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
