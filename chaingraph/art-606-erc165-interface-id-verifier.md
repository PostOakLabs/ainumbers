# ERC-165 Interface ID Verifier

Recomputes an ERC-165 interfaceId as the XOR of 4-byte function selectors (the first 4 bytes of keccak256 of each canonical Solidity signature) over a caller-declared list of function signatures, using the vendored keccak256 bundle already pinned in this repository. Zero network calls: this tool never queries a live contract's supportsInterface(bytes4) and makes no claim about what any deployed contract actually returns. Compares the recomputed id against an optional claimed_interface_id and flags a match against seven well-known standard ids (ERC-165 itself, ERC-721 core/Metadata/Enumerable, ERC-1155 core/MetadataURI, ERC-2981) purely as a courtesy label, never as verification. Malformed signature entries are excluded from the XOR and reported separately rather than silently dropped. A CONSISTENT match only establishes that the declared function list hashes to that value - never that the list is complete, correct, or actually implemented anywhere.

- Page: https://ainumbers.co/chaingraph/art-606-erc165-interface-id-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-606-erc165-interface-id-verifier.md
- MCP tool: verify_erc165_interface_id (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claimed_interface_id (string, required)
- function_signatures (array, required)

## Outputs

- claimed_interface_id (string, optional)
- computed_interface_id (string, optional)
- duplicate_signatures (array, optional)
- findings (array, optional)
- known_standard_match (string, optional)
- malformed_signatures (array, optional)
- not_proven (array, optional)
- overall_determination (string, optional)
- scope_note (string, optional)
- selectors (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_erc165_interface_id` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
