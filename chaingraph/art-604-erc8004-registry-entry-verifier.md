# ERC-8004 Registry Entry Verifier

Checks whether a caller-supplied claimed ERC-8004 agent registry entry (Identity, Reputation, or Validation registry) and a caller-supplied on-chain record, independently read by the caller from the registry contract, agree field-by-field, and separately whether any address-shaped field in the on-chain record is EIP-55 checksum-valid. Zero network calls; this tool never queries a registry contract itself, so it makes no claim about the current on-chain state, only that the two supplied records are consistent with each other at the time supplied. Generic schema only, no per-registry-type adapter code - the caller supplies both records as arbitrary key-value pairs. agent_id is compared as an opaque literal string throughout: never parsed as a number, never resolved against an Agent Card or A2A endpoint, never cached, and never cross-referenced against another registry. Two independently reported findings, never fused into one boolean.

- Page: https://ainumbers.co/chaingraph/art-604-erc8004-registry-entry-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-604-erc8004-registry-entry-verifier.md
- MCP tool: verify_erc8004_registry_entry (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chain_id (unknown, required)
- claimed_entry (array, required)
- onchain_record (array, required)
- registry_address (string, required)
- registry_type (string, required)

## Outputs

- address_checksum_findings (array, optional)
- agent_id_handling (string, optional)
- chain_id (string, optional)
- field_comparison (array, optional)
- findings (array, optional)
- not_proven (array, optional)
- overall_determination (string, optional)
- registry_address (string, optional)
- registry_type (string, optional)
- scope_note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_erc8004_registry_entry` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
