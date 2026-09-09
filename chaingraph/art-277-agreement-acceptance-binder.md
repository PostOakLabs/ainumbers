# Agreement Acceptance Binder

Binds a party's acceptance to a specific assembled agreement artifact, referenced by its execution_hash, template_id, and vendored body_sha256, never by re-embedding the agreement text. Carries no party identity, only the accepting role and the referenced hashes. An OPTIONAL section-16 eddsa-jcs-2022 signature on the emitted artifact turns this into a countersignable acceptance receipt; an optional previous_proof_hash links a second party's acceptance to the first, forward-compatible with a future proof-chain endorsement. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-277-agreement-acceptance-binder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-277-agreement-acceptance-binder.md
- MCP tool: bind_agreement_acceptance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- acceptance_statement (unknown, required)
- accepting_party_role (unknown, required)
- body_sha256 (unknown, required)
- previous_proof_hash (unknown, required)
- referenced_execution_hash (unknown, required)
- template_id (unknown, required)

## Outputs

- acceptance_statement (string, optional)
- accepted_body_sha256 (string, optional)
- accepted_template_id (string, optional)
- accepting_party_role (string, optional)
- checks (array, optional)
- disclaimer (string, optional)
- previous_proof_hash (string, optional)
- referenced_execution_hash (string, optional)
- zero_pii_notice (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `bind_agreement_acceptance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
