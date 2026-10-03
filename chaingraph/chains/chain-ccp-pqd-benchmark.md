# Cross-CCP PQD Benchmark

Single-node cross-CCP public quantitative disclosure (PQD) benchmark: compares a caller-selected set of CPMI-IOSCO PQD fields across FICC and ICE using a source-cited fixture dataset, flagging any caller-declared threshold breach per entity.

- Page: https://ainumbers.co/chaingraph/chains/chain-ccp-pqd-benchmark.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/chain-ccp-pqd-benchmark.md

## Workflow chain: Cross-CCP PQD Benchmark

Single-node cross-CCP public quantitative disclosure (PQD) benchmark: compares a caller-selected set of CPMI-IOSCO PQD fields across FICC and ICE using a source-cited fixture dataset, flagging any caller-declared threshold breach per entity.

Domain: Treasury Clearing

### Steps

1. art-528-cross-ccp-pqd-comparator
   comparison arithmetic and delta table are the terminal output; no downstream stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before we quote disclosure numbers side by side, which CPMI-IOSCO fields can both FICC and ICE supply for these divisions?
Run the AINumbers MCP tool `run_chain` with {"chain":"chain-ccp-pqd-benchmark"} and read `art-528-cross-ccp-pqd-comparator.partially_available_field_count`.
Re-run with `inputs` for `art-528-cross-ccp-pqd-comparator`, reusing the values that result echoed, with `entity_b` changed so entity_b moves to the ICE ICEU division. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/chain-ccp-pqd-benchmark.html
