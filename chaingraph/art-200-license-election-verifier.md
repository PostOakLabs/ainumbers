# License Election Verifier

Verifies a certificate produced by the License Election Certifier by recomputing the SHA-256 terms_hash over the JCS-canonical election core and comparing it against the stored hash. Returns verdict (valid | binding_mismatch | incomplete_fields | malformed), binding_ok flag, recomputed_terms_hash, and per-check results. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-200-license-election-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-200-license-election-verifier.md
- MCP tool: verify_license_election (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- certificate (unknown, optional)

## Outputs

- binding_ok (boolean, optional)
- checks (array, optional)
- verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_license_election` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
