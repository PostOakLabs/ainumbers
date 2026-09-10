# CASP Transitional-Deadline & Authorization Path

Member-state transitional-deadline routing incl. the 30 Jun 2026 cliff (ART-99) -> CASP authorization-readiness (ART-100) -> audit receipt (cry-05). File-vs-wind-down decision against the Art 143(3) date.

- Page: https://ainumbers.co/chaingraph/chains/mica-transitional.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-transitional.md

## Workflow chain: CASP Transitional-Deadline & Authorization Path

Member-state transitional-deadline routing incl. the 30 Jun 2026 cliff (ART-99) -> CASP authorization-readiness (ART-100) -> audit receipt (cry-05). File-vs-wind-down decision against the Art 143(3) date.

Domain: Digital-Asset Rails

### Steps

1. art-99-mica-transitional-deadline-router
   deadline + preconditions (H1) feed the readiness assessor
2. art-100-mica-casp-authorization-readiness
   readiness grade (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite transitional artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
