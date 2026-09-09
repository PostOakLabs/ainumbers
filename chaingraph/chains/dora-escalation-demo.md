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
