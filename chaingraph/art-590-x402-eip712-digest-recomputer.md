# x402 EIP-712 Digest Recomputer

Recomputes the EIP-712 typed-data digest for an EIP-3009 TransferWithAuthorization struct (the x402 payments rail's underlying authorization primitive) from caller-supplied domain and struct fields only: domain separator, struct hash, and the final keccak256(0x19 || 0x01 || domainSeparator || structHash) digest. All four EIP-712 domain fields (name, version, chainId, verifyingContract) are mandatory inputs and are never defaulted or guessed - a guessed verifyingContract would defeat the entire point of domain separation. keccak256 comes from the already-vendored, pinned noble-curves/noble-hashes bundle (no new vendoring); the EIP-712/EIP-3009 ABI encoding scheme is implemented directly as public-spec arithmetic on top of it. This node performs no signature recovery and no domain/nonce/window checks - it makes no claim about signature validity, on-chain settlement, or spend. Zero network calls; never a facilitator, proxy, or settlement relay. Golden vectors are cross-checked against externally published references (the EIP-712 spec's own domain-separator worked example, and Circle's production TransferWithAuthorization typehash), not round-trip self-tests alone.

- Page: https://ainumbers.co/chaingraph/art-590-x402-eip712-digest-recomputer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-590-x402-eip712-digest-recomputer.md
- MCP tool: recompute_x402_eip712_digest (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- name (string, optional)
- version (string, optional)
- chainId (number, optional)
- verifyingContract (string, optional)
- from (string, optional)
- to (string, optional)
- value (number, optional)
- validAfter (number, optional)
- validBefore (number, optional)
- nonce (string, optional)

## Outputs

- verdict (string, optional)
- reasons (array, optional)
- domain (object, optional)
- authorization (object, optional)
- domain_separator (string,null, optional)
- struct_hash (string,null, optional)
- digest (string,null, optional)
- domain_typehash (string, optional)
- transfer_with_authorization_typehash (string, optional)
- scope_note (string, optional)

## Sample

```json
{
  "name": "USD Coin",
  "version": "2",
  "chainId": 1,
  "verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "from": "0x2A1530C4C41db0B0b2bB646CB5Eb1A67b7158667",
  "to": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f2",
  "value": 1000000,
  "validAfter": 0,
  "validBefore": 2000000000,
  "nonce": "0x0000000000000000000000000000000000000000000000000000000000000001"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_x402_eip712_digest` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
