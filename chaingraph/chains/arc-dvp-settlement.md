# Arc DvP Atomic Settlement

W-D chain. Validate Arc DvP atomic settlement fit: StableFX + Paymaster for agentic settlement flows.

- Page: https://ainumbers.co/chaingraph/chains/arc-dvp-settlement.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-dvp-settlement.md

## Workflow chain: Arc DvP Atomic Settlement

W-D chain. Validate Arc DvP atomic settlement fit: StableFX + Paymaster for agentic settlement flows.

Domain: Digital-Asset Rails

### Steps

1. art-42-arc-fit-diagnostic
   arc_score → DvP dimension primary
2. art-44-arc-stablefx-model
   pvp_verdict, herstatt_saved feed Stage 3 Paymaster economics
3. art-46-arc-paymaster-model
   paymaster_verdict, cost_per_uop - Exports DvP settlement mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Delivery-versus-payment on Arc only pays off while the FX fee stays thin. Where does the verdict land once StableFX charges forty basis points?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-dvp-settlement"} and read `art-44-arc-stablefx-model.verdict`.
Re-run with `inputs` for `art-44-arc-stablefx-model`, reusing the values that result echoed, with `stablefx_fee_bps` set to 40. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-dvp-settlement.html
