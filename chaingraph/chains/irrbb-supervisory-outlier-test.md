# IRRBB Supervisory Outlier Test

Calculate delta EVE under the 6 BCBS d368 standardised shock scenarios from bucketed repricing cash flow gaps (art-183) -> evaluate the EVE leg of the EBA Supervisory Outlier Test against the hard 15%-of-Tier-1 threshold (art-184) -> evaluate the NII leg of the SOT against a caller-supplied threshold (art-185). Full IRRBB supervisory outlier test pipeline. BCBS d368 (2024 recalibration, effective 1 Jan 2026) + EBA GL/2022/14.

- Page: https://ainumbers.co/chaingraph/chains/irrbb-supervisory-outlier-test.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/irrbb-supervisory-outlier-test.md

## Workflow chain: IRRBB Supervisory Outlier Test

Calculate delta EVE under the 6 BCBS d368 standardised shock scenarios from bucketed repricing cash flow gaps (art-183) -> evaluate the EVE leg of the EBA Supervisory Outlier Test against the hard 15%-of-Tier-1 threshold (art-184) -> evaluate the NII leg of the SOT against a caller-supplied threshold (art-185). Full IRRBB supervisory outlier test pipeline. BCBS d368 (2024 recalibration, effective 1 Jan 2026) + EBA GL/2022/14.

Domain: IRRBB

### Steps

1. art-183-irrbb-eve-shock-calculator
   Per-scenario delta EVE and worst_delta_eve feed SOT/EVE evaluator
2. art-184-irrbb-sot-eve-evaluator
   SOT/EVE outlier verdict feeds SOT/NII evaluator
3. art-185-irrbb-sot-nii-evaluator
   Exports SOT/NII outlier verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our shocked EVE moved 18 percent of tier 1. Does the supervisory outlier test fire for this bank?
Run the AINumbers MCP tool `run_chain` with {"chain":"irrbb-supervisory-outlier-test"} and read `art-184-irrbb-sot-eve-evaluator.eve_outlier`.
Re-run with `inputs` for `art-184-irrbb-sot-eve-evaluator`, reusing the values that result echoed, with `capital` changed so tier1_capital is 2000 in capital. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/irrbb-supervisory-outlier-test.html
