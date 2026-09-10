# Treasury Corridor

FX netting simulation > FX hedge optimisation > corridor savings calculation.

- Page: https://ainumbers.co/chaingraph/chains/treasury-corridor.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-corridor.md

## Workflow chain: Treasury Corridor

FX netting simulation > FX hedge optimisation > corridor savings calculation.

Domain: Corporate Treasury & FX

### Steps

1. 105-fx-netting-simulator
   netting_savings and net_exposure feed Stage 2 hedge optimisation
2. 76-fx-hedge-optimizer
   hedge_ratio and instrument_mix feed Stage 3 corridor savings model
3. 23-corridor-savings-calc
   Exports treasury corridor Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
