# AI Governance Framework Crosswalk

Map AI controls and evidence to NIST AI RMF Govern/Map/Measure/Manage functions with per-function coverage scores (art-174) -> check GPAI provider obligations under EU AI Act Art. 53/55 and voluntary Code of Practice (art-175) -> A-F AI governance readiness diagnostic across ISO 42001, NIST RMF, and EU AI Act convergence (art-176). Full multi-framework governance crosswalk. GPAI enforcement Aug 2026.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-framework-crosswalk.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-framework-crosswalk.md

## Workflow chain: AI Governance Framework Crosswalk

Map AI controls and evidence to NIST AI RMF Govern/Map/Measure/Manage functions with per-function coverage scores (art-174) -> check GPAI provider obligations under EU AI Act Art. 53/55 and voluntary Code of Practice (art-175) -> A-F AI governance readiness diagnostic across ISO 42001, NIST RMF, and EU AI Act convergence (art-176). Full multi-framework governance crosswalk. GPAI enforcement Aug 2026.

Domain: AI Governance

### Steps

1. art-174-nist-ai-rmf-function-mapper
   RMF function coverage feeds GPAI conformance checker
2. art-175-gpai-code-of-practice-conformance
   GPAI obligation status feeds AI governance readiness diagnostic
3. art-176-ai-governance-readiness-diagnostic
   Exports A-F governance readiness grade with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An internal audit found four NIST RMF measure controls unsupported. How far does our function coverage fall once they are withdrawn from the evidence?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-governance-framework-crosswalk"} and read `art-174-nist-ai-rmf-function-mapper.overall_coverage`.
Re-run with `inputs` for `art-174-nist-ai-rmf-function-mapper`, reusing the values that result echoed, with `evidence` changed so measure_analysis, measure_monitoring, measure_testing and measure_benchmarking are false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-governance-framework-crosswalk.html
