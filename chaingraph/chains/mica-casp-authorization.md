# CASP Authorization & Own-Funds

W-A flagship. CASP authorization-readiness (governance, custody segregation, conflicts) (ART-100) -> Art 67 own-funds calculation (ART-101) -> audit receipt (cry-05). The CASP licensing lifecycle end-to-end. Decision-support draft.

- Page: https://ainumbers.co/chaingraph/chains/mica-casp-authorization.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-casp-authorization.md

## Workflow chain: CASP Authorization & Own-Funds

W-A flagship. CASP authorization-readiness (governance, custody segregation, conflicts) (ART-100) -> Art 67 own-funds calculation (ART-101) -> audit receipt (cry-05). The CASP licensing lifecycle end-to-end. Decision-support draft.

Domain: Digital-Asset Rails

### Steps

1. art-100-mica-casp-authorization-readiness
   authorization grade + gaps (H1) feed the own-funds calculator
2. art-101-mica-art67-own-funds-calculator
   own-funds requirement (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite authorization artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
