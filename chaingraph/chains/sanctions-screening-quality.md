# Sanctions Screening-Program Quality

Fuzzy-match calibration (ART-93) -> list-coverage conformance (ART-92) -> Wolfsberg-aligned screening-program quality grade (ART-97) -> audit receipt (cry-05). End-to-end program conformance score.

- Page: https://ainumbers.co/chaingraph/chains/sanctions-screening-quality.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-screening-quality.md

## Workflow chain: Sanctions Screening-Program Quality

Fuzzy-match calibration (ART-93) -> list-coverage conformance (ART-92) -> Wolfsberg-aligned screening-program quality grade (ART-97) -> audit receipt (cry-05). End-to-end program conformance score.

Domain: Sanctions

### Steps

1. art-93-fuzzy-match-calibration-scorer
   calibration grade (H1) feeds the coverage checker
2. art-92-screening-list-coverage-checker
   coverage grade (H2) feeds the quality scorer
3. art-97-sanctions-screening-quality-scorer
   Exports composite program-quality artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The quarterly examination form asks for our screening program grade. What does a defined escalation workflow add to the score?
Run the AINumbers MCP tool `run_chain` with {"chain":"sanctions-screening-quality"} and read `art-97-sanctions-screening-quality-scorer.component_scores.escalation_workflow`.
Re-run with `inputs` for `art-97-sanctions-screening-quality-scorer`, reusing the values that result echoed, with `inputs` changed so the escalation workflow field goes from none to defined. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sanctions-screening-quality.html
