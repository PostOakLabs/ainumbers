# Remittance Disclosure and Corridor Cost

Gated two-step chain for Reg E remittance disclosure and corridor cost benchmarking. Step 1 computes the required CFPB Reg E subpart B (12 CFR 1005.31/1005.32) disclosure fields and emits estimate_permissible. Gate on /estimate_permissible: if true (12 CFR 1005.32 estimated disclosure applies), the chain ends at the disclosure receipt - no corridor benchmarking required. If false (exact disclosure, default path), Step 2 runs compare_corridor_cost to benchmark total cost (fee % + FX margin %) against the World Bank RPW Q1 2026 snapshot and SDG 10.c 3% target. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/remittance-disclosure-and-corridor-cost.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/remittance-disclosure-and-corridor-cost.md

## Workflow chain: Remittance Disclosure and Corridor Cost

Gated two-step chain for Reg E remittance disclosure and corridor cost benchmarking. Step 1 computes the required CFPB Reg E subpart B (12 CFR 1005.31/1005.32) disclosure fields and emits estimate_permissible. Gate on /estimate_permissible: if true (12 CFR 1005.32 estimated disclosure applies), the chain ends at the disclosure receipt - no corridor benchmarking required. If false (exact disclosure, default path), Step 2 runs compare_corridor_cost to benchmark total cost (fee % + FX margin %) against the World Bank RPW Q1 2026 snapshot and SDG 10.c 3% target. ZERO PII BY CONSTRUCTION.

Domain: Cross-Border & Instant Payments

### Steps

1. art-248-compute-remittance-disclosure
   Reg E disclosure fields including estimate_permissible. Gate: estimate_permissible=true exits with ESTIMATED disclosure (12 CFR 1005.32 path). Default: proceed to corridor cost benchmarking.
2. art-249-compare-corridor-cost
   Corridor cost vs RPW benchmark, SmaRT average, and SDG 10.c target. Includes meets_sdg_target and cost_at_200_usd/cost_at_500_usd. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A customer wants a 200 dollar transfer to Mexico. Does this corridor's all-in cost come in under the three percent target?
Run the AINumbers MCP tool `run_chain` with {"chain":"remittance-disclosure-and-corridor-cost"} and read `art-249-compare-corridor-cost.meets_sdg_target`.
Re-run with `inputs` for `art-249-compare-corridor-cost`, reusing the values that result echoed, with `provider_fee` set to 12. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/remittance-disclosure-and-corridor-cost.html
