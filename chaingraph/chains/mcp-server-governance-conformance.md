# MCP Server Governance Conformance

Validate a new-spec MCP server identity document including subject, issuer, serverInfo, and attestation reference at the well-known path (art-147) → validate OAuth 2.0 Protected Resource Metadata per RFC 9728: resource URI, authorization servers, scopes, and bearer methods (art-148) → validate the MCP Registry server.json entry for schema, reverse-DNS name, semver version, and endpoint (art-149). Full governance attestation with execution_hash: final stage.

- Page: https://ainumbers.co/chaingraph/chains/mcp-server-governance-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mcp-server-governance-conformance.md

## Workflow chain: MCP Server Governance Conformance

Validate a new-spec MCP server identity document including subject, issuer, serverInfo, and attestation reference at the well-known path (art-147) → validate OAuth 2.0 Protected Resource Metadata per RFC 9728: resource URI, authorization servers, scopes, and bearer methods (art-148) → validate the MCP Registry server.json entry for schema, reverse-DNS name, semver version, and endpoint (art-149). Full governance attestation with execution_hash: final stage.

Domain: AI & Agent Governance

### Steps

1. art-147-mcp-server-identity-attestation-validator
   Server identity validity feeds RFC 9728 authorization metadata validator
2. art-148-mcp-authorization-metadata-validator
   Authorization metadata validity feeds MCP Registry entry conformance checker
3. art-149-mcp-registry-entry-conformance
   Exports registry conformance verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The registry listing is drafted. Does the server entry clear the conformance checks as published?
Run the AINumbers MCP tool `run_chain` with {"chain":"mcp-server-governance-conformance"} and read `art-149-mcp-registry-entry-conformance.entry_valid`.
Re-run with `inputs` for `art-149-mcp-registry-entry-conformance`, reusing the values that result echoed, with `entry` changed so the version field is absent from the entry. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mcp-server-governance-conformance.html
