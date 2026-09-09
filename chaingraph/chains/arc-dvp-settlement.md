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
