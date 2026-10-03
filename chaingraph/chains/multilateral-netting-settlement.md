# Multilateral Netting Settlement

Linear two-step chain for IHB settlement cycles. Step 1 computes N-entity corporate cash netting (gross positions to net positions to minimum settlement legs, BIS CPMI greedy algorithm). Step 2 allocates IHB overnight interest on the net settlement balances per OECD TP Guidelines 2022 Chapter X arm's-length rate, with ACT/360 day-count and per-member withholding tax. Corporate cash netting only - NOT FICC clearing margin netting. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/multilateral-netting-settlement.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/multilateral-netting-settlement.md

## Workflow chain: Multilateral Netting Settlement

Linear two-step chain for IHB settlement cycles. Step 1 computes N-entity corporate cash netting (gross positions to net positions to minimum settlement legs, BIS CPMI greedy algorithm). Step 2 allocates IHB overnight interest on the net settlement balances per OECD TP Guidelines 2022 Chapter X arm's-length rate, with ACT/360 day-count and per-member withholding tax. Corporate cash netting only - NOT FICC clearing margin netting. ZERO PII BY CONSTRUCTION.

Domain: Corporate Treasury & FX

### Steps

1. art-259-compute-multilateral-netting
   Net entity positions, settlement legs, wire-count savings, netting_efficiency_pct. Emits entity_net_positions[] and settlement_legs[]. NOT FICC clearing margin netting.
2. art-260-allocate-ihb-interest
   OECD TP arm's-length interest allocation on net settlement balances. Per-member gross_interest, withholding_amount, net_interest. Supports ACT/360, ACT/365, 30/360. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Under a single master agreement, how much settlement volume does multilateral netting remove across these positions?
Run the AINumbers MCP tool `run_chain` with {"chain":"multilateral-netting-settlement"} and read `art-259-compute-multilateral-netting.netting_efficiency_pct`.
Re-run with `inputs` for `art-259-compute-multilateral-netting`, reusing the values that result echoed, with `gross_positions` changed so ENTITY A pays only 100 instead of 1000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/multilateral-netting-settlement.html
