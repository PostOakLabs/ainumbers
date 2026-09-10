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
