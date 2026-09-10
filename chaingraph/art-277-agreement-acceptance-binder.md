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
{
  "referenced_execution_hash": "b8f9d0a0210a5fa2b704fcb625119fe6ae03b819ec9b59f3b3377cdd48f13729",
  "template_id": "common-paper-mnda-v1.0",
  "body_sha256": "51accb97035821280371ff3088871e3866927ef0ce60e64ed5244883f11b6cfe",
  "accepting_party_role": "party_a",
  "previous_proof_hash": "",
  "acceptance_statement": ""
}
```

## Verify

Run the sample policy_parameters through MCP tool `bind_agreement_acceptance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
