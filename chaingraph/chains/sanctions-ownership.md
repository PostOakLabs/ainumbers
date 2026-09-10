# 50%-Rule Ownership Screening

W-A flagship. OFAC/EU/BIS 50%-rule aggregate-ownership traversal over a synthetic ownership graph (ART-91) -> sanctions list-coverage conformance (ART-92) -> audit receipt (cry-05). Determines constructively-blocked entities per BIS Affiliates Rule (29 Sep 2025) and OFAC 50% rule. Synthetic entities only.

- Page: https://ainumbers.co/chaingraph/chains/sanctions-ownership.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-ownership.md

## Workflow chain: 50%-Rule Ownership Screening

W-A flagship. OFAC/EU/BIS 50%-rule aggregate-ownership traversal over a synthetic ownership graph (ART-91) -> sanctions list-coverage conformance (ART-92) -> audit receipt (cry-05). Determines constructively-blocked entities per BIS Affiliates Rule (29 Sep 2025) and OFAC 50% rule. Synthetic entities only.

Domain: Sanctions

### Steps

1. art-91-ownership-50pct-aggregator
   blocked-entity verdicts (H1) feed the coverage checker
2. art-92-screening-list-coverage-checker
   coverage conformance (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite ownership-screening artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
