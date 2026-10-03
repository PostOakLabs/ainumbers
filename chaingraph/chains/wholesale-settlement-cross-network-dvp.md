# Cross-Network Atomic DvP/PvP Settlement

W-A. Cross-network atomicity + finality-compatibility + settlement-risk window (ART-58) -> asset-leg DvP atomicity (507) -> FX-leg PvP (511). The flagship decision chain: is this tokenized settlement all-or-nothing across the cash network and the asset network?

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-cross-network-dvp.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-cross-network-dvp.md

## Workflow chain: Cross-Network Atomic DvP/PvP Settlement

W-A. Cross-network atomicity + finality-compatibility + settlement-risk window (ART-58) -> asset-leg DvP atomicity (507) -> FX-leg PvP (511). The flagship decision chain: is this tokenized settlement all-or-nothing across the cash network and the asset network?

Domain: Wholesale Settlement

### Steps

1. art-58-cross-network-settlement-validator
   atomicity_verdict and settlement_risk_window (H1) feed the DvP validator
2. 507-canton-dvp-atomicity-validator
   asset-leg atomicity (H2) feeds the PvP validator
3. 511-multi-currency-pvp-validator
   Exports composite cross-network settlement artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our trade settles across two networks that do not talk to each other. Does either side still face settlement risk?
Run the AINumbers MCP tool `run_chain` with {"chain":"wholesale-settlement-cross-network-dvp"} and read `511-multi-currency-pvp-validator.verdict`.
Re-run with `inputs` for `511-multi-currency-pvp-validator`, reusing the values that result echoed, with `has_unwind_procedure` set to false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-cross-network-dvp.html
