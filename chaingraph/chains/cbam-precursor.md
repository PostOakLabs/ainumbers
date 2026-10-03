# CBAM Precursor Emissions Roll-Up

Precursor embedded-emissions aggregation incl. the 2028 scrap rule (ART-72) -> consignment embedded-emissions calculation (ART-69) -> Merkle integrity over the supplier data set (cry-04). Lets a complex-goods producer supply verifiable embedded emissions to its importer; pre-positions the downstream-180 scope extension.

- Page: https://ainumbers.co/chaingraph/chains/cbam-precursor.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbam-precursor.md

## Workflow chain: CBAM Precursor Emissions Roll-Up

Precursor embedded-emissions aggregation incl. the 2028 scrap rule (ART-72) -> consignment embedded-emissions calculation (ART-69) -> Merkle integrity over the supplier data set (cry-04). Lets a complex-goods producer supply verifiable embedded emissions to its importer; pre-positions the downstream-180 scope extension.

Domain: CBAM

### Steps

1. art-72-cbam-precursor-emissions-aggregator
   cumulative precursor SEE (H1) feeds the emissions calculator
2. art-69-cbam-embedded-emissions-calculator
   consignment embedded emissions (H2) feed the verifier
3. cry-04-merkle-batch-verifier
   Exports composite precursor artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: No precursor data was supplied for these complex goods. What does the roll-up compute once one precursor is declared?
Run the AINumbers MCP tool `run_chain` with {"chain":"cbam-precursor"} and read `art-72-cbam-precursor-emissions-aggregator.cumulative_see_tco2e`.
Re-run with `inputs` for `art-72-cbam-precursor-emissions-aggregator`, reusing the values that result echoed, with `precursors` changed so one precursor at mass_fraction 0.6 with see_tco2e_per_t 2.1. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cbam-precursor.html
