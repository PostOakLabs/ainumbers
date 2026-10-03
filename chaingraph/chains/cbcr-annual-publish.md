# CbCR Annual Publish

OECD BEPS Action 13 Country-by-Country Report build with internal consistency gates and anomaly-pattern surfacing in one artifact. gate_status (auto_pass / review_required) and anomaly_flags (e.g. profit-with-zero-employees) are recorded in output_payload per the §27 Human Accountability vocabulary; a PUBLIC release additionally requires a dual_control(2) preparer/tax-officer gate before disclosure - both recorded now, enforced once HA-RETRO-1 wires runtime gating. Cross-links art-473-interquartile-benchmark (same underlying entity financial data, different arm's-length-range analysis) and art-456 GloBE safe-harbour.

- Page: https://ainumbers.co/chaingraph/chains/cbcr-annual-publish.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbcr-annual-publish.md

## Workflow chain: CbCR Annual Publish

OECD BEPS Action 13 Country-by-Country Report build with internal consistency gates and anomaly-pattern surfacing in one artifact. gate_status (auto_pass / review_required) and anomaly_flags (e.g. profit-with-zero-employees) are recorded in output_payload per the §27 Human Accountability vocabulary; a PUBLIC release additionally requires a dual_control(2) preparer/tax-officer gate before disclosure - both recorded now, enforced once HA-RETRO-1 wires runtime gating. Cross-links art-473-interquartile-benchmark (same underlying entity financial data, different arm's-length-range analysis) and art-456 GloBE safe-harbour.

Domain: Audit & Assurance

### Steps

1. art-472-cbcr-builder
   Builds the CbCR XML schema skeleton, runs consistency checks, surfaces anomaly_flags, and computes gate_status - final stage. PUBLIC export_mode release requires a dual_control(2) preparer + tax-officer sign-off (recorded, not yet runtime-gated) and review_required routing on any anomaly_flags before disclosure.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Finance assembled the country-by-country tables for the annual filing. Do any jurisdiction rows fail the consistency edits?
Run the AINumbers MCP tool `run_chain` with {"chain":"cbcr-annual-publish"} and read `art-472-cbcr-builder.fatal_failure_count`.
Re-run with `inputs` for `art-472-cbcr-builder`, reusing the values that result echoed, with `table1_jurisdictions` changed so related_party_revenue is 1200 while total_revenue stays 1000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cbcr-annual-publish.html
