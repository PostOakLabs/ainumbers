# C2PA Content Credential Verification (provenance integrity)

Validate a decoded C2PA manifest (art-123) then verify the Content Credential signature against a caller-supplied trust posture with zero network (art-124) then resolve the ingredient provenance tree and confirm it chains back (art-125). Client-side, zero-egress, agent-callable alternative to network-dependent trust-list validation.

- Page: https://ainumbers.co/chaingraph/chains/content-credential-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/content-credential-verification.md

## Workflow chain: C2PA Content Credential Verification (provenance integrity)

Validate a decoded C2PA manifest (art-123) then verify the Content Credential signature against a caller-supplied trust posture with zero network (art-124) then resolve the ingredient provenance tree and confirm it chains back (art-125). Client-side, zero-egress, agent-callable alternative to network-dependent trust-list validation.

Domain: Document & Content Provenance

### Steps

1. art-123-c2pa-manifest-validator
   validated manifest structure feeds signature verification
2. art-124-content-credential-signature-verifier
   signature verdict feeds ingredient-tree resolution
3. art-125-provenance-ingredient-tree-resolver
   Exports provenance verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A supplier sent a file carrying a C2PA content credential. Do we accept its provenance claims when the signature check comes back caller-attested?
Run the AINumbers MCP tool `run_chain` with {"chain":"content-credential-verification"} and read `art-124-content-credential-signature-verifier.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/content-credential-verification.html
