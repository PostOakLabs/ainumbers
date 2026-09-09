# MCP Server Identity Attestation Validator

Validate a new-spec MCP server identity document: required claims (subject, issuer, serverInfo), well-known path correctness (/.well-known/mcp-server-identity), and attestation reference present. Caller supplies decoded document plus a signature-valid boolean: zero network, zero PII. Feeds the RFC 9728 authorization metadata validator (art-148). New MCP spec server identity check active 2025-2026.

- Page: https://ainumbers.co/chaingraph/art-147-mcp-server-identity-attestation-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-147-mcp-server-identity-attestation-validator.md
- MCP tool: validate_mcp_server_identity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- identity (unknown, optional)
- signature_valid (unknown, optional)
- well_known_path (unknown, optional)

## Outputs

- attested (boolean, optional)
- has_issuer (boolean, optional)
- has_server_info (boolean, optional)
- has_subject (boolean, optional)
- identity_valid (boolean, optional)
- missing (array, optional)

## Sample

```json
{
  "identity": {
    "subject": "did:web:example.com",
    "issuer": "did:web:registry.mcp.io",
    "serverInfo": {
      "name": "ExampleMCPServer",
      "version": "1.2.0"
    },
    "attestation": {
      "ref": "https://registry.mcp.io/attestations/abc123"
    }
  },
  "well_known_path": "/.well-known/mcp-server-identity",
  "signature_valid": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_mcp_server_identity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
