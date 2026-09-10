# Private-Input Sanctions Screen

Screens a privately held party/transfer list against a pinned OFAC-SDN-style list version and emits a public verdict (screened, hit count, clean flag) without disclosing the party list. Carries an OCG Standard §25 ocg-private-input@1 declaration: the party list is committed via sha256-salted@1 in policy_parameters.parties_commitment, never in the clear. Proves the screening ran against a specific committed list and list version. Private-input variant of screen_tip20_transfer_batch (art-38); use that public-input kernel when disclosure of the party list is acceptable; use this one when it is not. ZERO PII disclosed: only the verdict is public.

- Page: https://ainumbers.co/chaingraph/art-413-screen-sanctions-private.html
- Markdown twin: https://ainumbers.co/chaingraph/art-413-screen-sanctions-private.md
- MCP tool: screen_sanctions_private (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- list_version (unknown, required)

## Outputs

- clean (boolean, optional)
- coverage (object, optional)
- hit_count (integer, optional)
- list_version (string, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- screened (boolean, optional)

## Sample

```json
{
  "parties_commitment": "sha256:ce2d79b801e14f3bfdfe37e2c43800a21242deb74e4914d393646fd6f87e29d4",
  "list_version": "OFAC-SDN-TEST-2026-07",
  "list_source": "OFAC Specially Designated Nationals (SDN) List test fixture set, per FinCEN 31 CFR Chapter X screening obligations. Production deployments substitute the live OFAC SDN + FATF Travel Rule party lists; this profile proves the SCREENING RAN against a committed list, not the list contents.",
  "matching_config": {
    "case_insensitive": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `screen_sanctions_private` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
