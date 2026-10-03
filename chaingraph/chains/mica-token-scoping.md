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

### Ask your agent

Question: We are about to issue a payment token in the EU. Which MiCA route does the scoper assign when the token is an EMT?
Run the AINumbers MCP tool `run_chain` with {"chain":"mica-token-scoping"} and read `art-105-mica-token-service-scoper.classification`.
Re-run with `inputs` for `art-105-mica-token-service-scoper`, reusing the values that result echoed, with `inputs` changed so the token is an EMT and the activity is issuance. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mica-token-scoping.html
