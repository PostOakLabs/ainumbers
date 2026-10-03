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

### Ask your agent

Question: Budget season. How much own capital must the CASP hold, and which leg of Article 67 binds?
Run the AINumbers MCP tool `run_chain` with {"chain":"mica-casp-authorization"} and read `art-101-mica-art67-own-funds-calculator.required_own_funds`.
Re-run with `inputs` for `art-101-mica-art67-own-funds-calculator`, reusing the values that result echoed, with `fixed_overheads_annual` set to 400000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mica-casp-authorization.html
