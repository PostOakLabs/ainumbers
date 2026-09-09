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
