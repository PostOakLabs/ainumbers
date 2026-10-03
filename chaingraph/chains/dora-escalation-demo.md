# DORA Escalation Demo

OCG §22.8 escalation-record demo. DORA readiness diagnostic gates on grade: grade F escalates to human review (run HALTs, open escalation record attached). Any passing grade (D or above) continues to DORA incident classification. Demonstrates skipped_by_escalation, deterministic record_hash, and both-branch fixture coverage.

- Page: https://ainumbers.co/chaingraph/chains/dora-escalation-demo.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dora-escalation-demo.md

## Workflow chain: DORA Escalation Demo

OCG §22.8 escalation-record demo. DORA readiness diagnostic gates on grade: grade F escalates to human review (run HALTs, open escalation record attached). Any passing grade (D or above) continues to DORA incident classification. Demonstrates skipped_by_escalation, deterministic record_hash, and both-branch fixture coverage.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-29-dora-readiness-diagnostic
   DORA readiness grade. GATE: grade='F' escalates to human review (OCG §22.8). Default (any grade != F) continues to incident classification.
2. art-09-dora-incident-classifier
   DORA incident classification: major_incident determination, reporting clock, competent authority note. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our compliance answers just went through review. What DORA readiness grade do the twelve controls earn, and which ones stay open?
Run the AINumbers MCP tool `run_chain` with {"chain":"dora-escalation-demo"} and read `art-29-dora-readiness-diagnostic.grade`.
Re-run with `inputs` for `art-29-dora-readiness-diagnostic`, reusing the values that result echoed, with `answers` changed so every q1 to q12 answer is yes. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/dora-escalation-demo.html
