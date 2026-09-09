# MCP Registry Entry Conformance Checker

Validate an MCP Registry server.json entry: $schema present, reverse-DNS name format (namespace/name), semver version, and at least one of packages or remotes populated. Terminal stage of the mcp-server-governance-conformance chain. Exports governance attestation with execution_hash. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-149-mcp-registry-entry-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-149-mcp-registry-entry-conformance.md
- MCP tool: check_mcp_registry_entry (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entry (unknown, optional)

## Outputs

- entry_valid (boolean, optional)
- has_packages (boolean, optional)
- has_remotes (boolean, optional)
- missing (array, optional)
- name_ok (boolean, optional)
- schema_ok (boolean, optional)
- version_ok (boolean, optional)

## Sample

```json
{
  "entry": {
    "$schema": "https://registry.mcp.io/schema/server.json",
    "name": "com.example/my-mcp-server",
    "version": "1.0.0",
    "packages": [
      {
        "registry": "npm",
        "name": "@example/mcp-server",
        "version": "1.0.0"
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_mcp_registry_entry` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
