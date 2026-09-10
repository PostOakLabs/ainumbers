# License Election Certifier

Binds a license election (family, id, params) to a named asset and licensor DID, producing a deterministic terms_hash via SHA-256 over the JCS-canonical election core. Emits a portable certificate object with all fields needed for downstream verification. Not legal advice. Selection only.

- Page: https://ainumbers.co/chaingraph/art-199-license-election-certifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-199-license-election-certifier.md
- MCP tool: certify_license_election (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_ref (string, optional)
- license_election (array, optional)
- licensor_did (string, optional)

## Outputs

- all_checks_pass (boolean, optional)
- certificate (object, optional)
- checks (array, optional)
- terms_hash (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `certify_license_election` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
