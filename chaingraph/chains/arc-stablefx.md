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

### Ask your agent

Question: Our book settles dollar-yen bilaterally today. At what StableFX fee in basis points does the atomic alternative stop beating the incumbent?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-stablefx"} and read `art-44-arc-stablefx-model.verdict`.
Re-run with `inputs` for `art-44-arc-stablefx-model`, reusing the values that result echoed, with `stablefx_fee_bps` set to 30. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-stablefx.html
