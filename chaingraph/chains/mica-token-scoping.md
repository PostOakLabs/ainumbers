# MiCA Token & Service Scoping

Disambiguation router (ART-105) classifying ART/EMT-issuer cases (delegated to the existing stablecoin-compliance/reserve chains) vs CASP-service cases -> audit receipt (cry-05). Prevents overlap; packages the MiCA suite.

- Page: https://ainumbers.co/chaingraph/chains/mica-token-scoping.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-token-scoping.md

## Workflow chain: MiCA Token & Service Scoping

Disambiguation router (ART-105) classifying ART/EMT-issuer cases (delegated to the existing stablecoin-compliance/reserve chains) vs CASP-service cases -> audit receipt (cry-05). Prevents overlap; packages the MiCA suite.

Domain: Digital-Asset Rails

### Steps

1. art-105-mica-token-service-scoper
   route decision + cross-references (H1) feed the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite scoping artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
