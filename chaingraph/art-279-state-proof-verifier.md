# State-Proof Verifier

Verifies an EIP-1186 (eth_getProof) account and storage Merkle-Patricia-Trie proof against a caller-supplied trusted state root using a pure-JavaScript keccak-256 plus RLP decoder and bounded trie walk. Zero-egress, no RPC call. Does not verify that the state root itself belongs to a real canonical block; consensus-proof (light-client header) verification is out of scope. Persona: fund administrator or auditor confirming tokenized-MMF or deposit-token holdings without trusting an RPC provider.

- Page: https://ainumbers.co/chaingraph/art-279-state-proof-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-279-state-proof-verifier.md
- MCP tool: verify_eth_state_proof (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- account_proof (array, required)
- address (unknown, optional)
- block_state_root (unknown, optional)
- storage_slots (array, required)

## Outputs

- account (string, optional)
- account_exists (boolean, optional)
- address (string, optional)
- block_state_root (string, optional)
- bounded_limits (object, optional)
- diagnostic (string, optional)
- errors (array, optional)
- proof_nodes_consumed (integer, optional)
- receipt_statement (string, optional)
- regulatory_note (string, optional)
- storage_results (array, optional)
- verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_eth_state_proof` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
