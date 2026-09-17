# ERC-1967 Proxy Slot Classifier

Recomputes the four canonical EIP-1967 storage slots (bytes32(uint256(keccak256(label)) - 1) for the implementation, admin, beacon, and rollback labels) fresh on every call using the vendored keccak256 bundle already pinned in this repository, then classifies a caller-supplied (declared_slot, storage_value) pair: which of the four roles declared_slot matches, if any, and whether storage_value looks like the zero-padded 20-byte address EIP-1967 expects at that slot (extracting and EIP-55 checksumming the embedded address when it does). Zero network calls: this tool never reads live chain state - declared_slot and storage_value are both caller-supplied, read by the caller from their own eth_getStorageAt call or a block explorer, and may already be stale by the time they are pasted in. Address/slot-level fact only: renders no upgrade-safety, admin-trustworthiness, or implementation-safety judgment, and a non-standard declared_slot does not itself prove a contract is not a proxy.

- Page: https://ainumbers.co/chaingraph/art-607-erc1967-proxy-slot-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-607-erc1967-proxy-slot-classifier.md
- MCP tool: classify_erc1967_proxy_slot (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- declared_slot (unknown, required)
- storage_value (unknown, required)

## Outputs

- classification_summary (string, optional)
- declared_slot (string, optional)
- embedded_address (string, optional)
- embedded_address_checksummed (string, optional)
- findings (array, optional)
- known_eip1967_slots (object, optional)
- matched_role (string, optional)
- not_proven (array, optional)
- overall_determination (string, optional)
- scope_note (string, optional)
- storage_value (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_erc1967_proxy_slot` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
