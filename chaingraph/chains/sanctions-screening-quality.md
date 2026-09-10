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
