# Revocation-Status Verifier

Checks a receipt's optional W3C BitstringStatusList credentialStatus reference and reads the revocation bit at statusListIndex from a supplied, zero-egress status list credential. A set bit means revoked, and revocation overrides the receipt's own signature validity even when that signature is cryptographically valid. Absence of a credentialStatus reference is its own no-signal state, never treated as evidence of active status. Not-X-use-Y: this kernel checks revocation status only, it does not verify the underlying §16 signature itself.

- Page: https://ainumbers.co/chaingraph/art-287-revocation-status-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-287-revocation-status-verifier.md
- MCP tool: verify_revocation_status (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- credential_status (unknown, optional)
- status_list_credential (unknown, optional)

## Outputs

- note (string, optional)
- revoked_for_purpose (string, optional)
- status (string, optional)
- status_list_credential_url (string, optional)
- status_list_index (string, optional)
- structural_error (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_revocation_status` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
