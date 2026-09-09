# Arc StableFX Risk Elimination

W-B chain. Quantify Herstatt risk and FX spread savings from Arc StableFX atomic PvP vs non-CLS bilateral settlement.

- Page: https://ainumbers.co/chaingraph/chains/arc-stablefx.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-stablefx.md

## Workflow chain: Arc StableFX Risk Elimination

W-B chain. Quantify Herstatt risk and FX spread savings from Arc StableFX atomic PvP vs non-CLS bilateral settlement.

Domain: Digital-Asset Rails

### Steps

1. art-42-arc-fit-diagnostic
   arc_score → StableFX dimension primary
2. art-44-arc-stablefx-model
   herstatt_exposure, annual_benefit_usd, verdict - StableFX economics - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
