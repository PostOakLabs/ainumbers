# Stablecoin Remittance Corridor Economics

Linear two-step chain for stablecoin remittance corridor economics analysis. Step 1 models the all-in cost of a USDC-based corridor (on-ramp fee, chain gas fee, off-ramp/local-rail fee, FX spread, and pre-funding float savings vs correspondent banking). Step 2 benchmarks total cost against the World Bank RPW Q1 2026 snapshot for the same origin-destination pair and the SDG 10.c 3% target. Together they surface whether a stablecoin corridor meets the SDG 3% goal and how it compares to the World Bank corridor average. Both steps always run.

- Page: https://ainumbers.co/chaingraph/chains/stablecoin-remittance-corridor-economics.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/stablecoin-remittance-corridor-economics.md

## Workflow chain: Stablecoin Remittance Corridor Economics

Linear two-step chain for stablecoin remittance corridor economics analysis. Step 1 models the all-in cost of a USDC-based corridor (on-ramp fee, chain gas fee, off-ramp/local-rail fee, FX spread, and pre-funding float savings vs correspondent banking). Step 2 benchmarks total cost against the World Bank RPW Q1 2026 snapshot for the same origin-destination pair and the SDG 10.c 3% target. Together they surface whether a stablecoin corridor meets the SDG 3% goal and how it compares to the World Bank corridor average. Both steps always run.

Domain: Digital-Asset Rails

### Steps

1. art-250-model-stablecoin-corridor-economics
   USDC corridor all-in cost: on-ramp, chain fee, off-ramp, FX spread, float savings, gross/net cost bps and %, break-even vs traditional MTO. Passes to corridor benchmarking.
2. art-249-compare-corridor-cost
   Corridor cost vs RPW benchmark, SmaRT average, and SDG 10.c target. Includes meets_sdg_target and cost_at_200_usd/cost_at_500_usd. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Treasury wants US to Mexico payouts on a stablecoin rail. What does a 1,000 dollar transfer really cost?
Run the AINumbers MCP tool `run_chain` with {"chain":"stablecoin-remittance-corridor-economics"} and read `art-250-model-stablecoin-corridor-economics.net_cost_pct`.
Re-run with `inputs` for `art-250-model-stablecoin-corridor-economics`, reusing the values that result echoed, with `off_ramp_fee_pct` set to 4. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/stablecoin-remittance-corridor-economics.html
