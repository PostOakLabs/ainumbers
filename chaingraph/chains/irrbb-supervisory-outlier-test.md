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
