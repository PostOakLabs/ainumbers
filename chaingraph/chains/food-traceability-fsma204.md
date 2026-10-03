# Food Traceability & 24-Hour Recall (FSMA 204 / GS1 EPCIS 2.0)

Validate Critical Tracking Event KDEs (art-118) → link Traceability Lot Code chain across CTEs, detect transformation events (art-119) → one-up/one-back recall trace emitting the FDA 24-hour sortable list (art-120). Zero-egress alternative to a food safety consortium.

- Page: https://ainumbers.co/chaingraph/chains/food-traceability-fsma204.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/food-traceability-fsma204.md

## Workflow chain: Food Traceability & 24-Hour Recall (FSMA 204 / GS1 EPCIS 2.0)

Validate Critical Tracking Event KDEs (art-118) → link Traceability Lot Code chain across CTEs, detect transformation events (art-119) → one-up/one-back recall trace emitting the FDA 24-hour sortable list (art-120). Zero-egress alternative to a food safety consortium.

Domain: Supply-Chain Traceability

### Steps

1. art-118-fsma204-cte-validator
   validated CTE KDEs feed lot code linkage
2. art-119-traceability-lot-code-linker
   lot code lineage feeds recall trace resolution
3. art-120-recall-trace-resolver
   Exports recall trace artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: FDA gives us 24 hours. From the contaminated lot code, how many lots fall inside the recall window?
Run the AINumbers MCP tool `run_chain` with {"chain":"food-traceability-fsma204"} and read `art-120-recall-trace-resolver.traced_count`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/food-traceability-fsma204.html
