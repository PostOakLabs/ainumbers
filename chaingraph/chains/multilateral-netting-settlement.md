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
