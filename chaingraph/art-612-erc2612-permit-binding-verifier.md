# ERC-2612 Permit Binding Verifier

Recomputes the EIP-712 typed-data digest for an ERC-2612 Permit struct (the gasless-approval rail used by USDC/DAI-style tokens) from caller-supplied domain and message fields, recovers the ECDSA signer from a caller-supplied signature, and reports whether the recovered signer binds to the caller-claimed owner or names the diverging field. All four EIP-712 domain fields (name, version, chainId, verifyingContract) are mandatory inputs and are never defaulted or guessed - a guessed verifyingContract would defeat domain separation. keccak256 and secp256k1 recovery come from the already-vendored, pinned noble-curves/noble-hashes bundle shared with the sibling art-590/art-591 x402 pair (no new vendoring); the EIP-712/ERC-2612 ABI encoding scheme is implemented directly as public-spec arithmetic on top of it. This node makes no claim about on-chain nonce freshness, current allowance state, or whether deadline has passed relative to now - it states plainly what it never fetched. Zero network calls; never a facilitator, proxy, or settlement relay. Golden vectors are cross-checked against an independently re-implemented EIP-712 encoding path and real secp256k1 signatures, not round-trip self-tests alone.

- Page: https://ainumbers.co/chaingraph/art-612-erc2612-permit-binding-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-612-erc2612-permit-binding-verifier.md
- MCP tool: verify_erc2612_permit_binding (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chainId (unknown, required)
- deadline (unknown, required)
- name (unknown, required)
- nonce (unknown, required)
- owner (unknown, required)
- r (unknown, required)
- s (unknown, required)
- signature (string, required)
- spender (unknown, required)
- v (unknown, required)
- value (unknown, required)
- verifyingContract (unknown, required)
- version (unknown, required)
- yParity (unknown, required)

## Outputs

- digest (string,null, required)
- diverging_field (null,string, required)
- domain (object, required)
- domain_separator (string,null, required)
- domain_typehash (string, required)
- permit (object, required)
- permit_typehash (string, required)
- reasons (array, required)
- recovered_signer (string,null, required)
- recovered_signer_matches_owner (boolean,null, required)
- recovery_id (number,null, required)
- recovery_id_source (string,null, required)
- scope_note (string, required)
- struct_hash (string,null, required)
- verdict (string, required)

## Sample

```json
{
  "name": "USD Coin",
  "version": "2",
  "chainId": 1,
  "verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "owner": "0xe05fcc23807536bee418f142d19fa0d21bb0cff7",
  "spender": "0x1111111111111111111111111111111111111111",
  "value": 1000000,
  "nonce": 0,
  "deadline": 2000000000,
  "r": "0x70bb0933677f1bd68df1604ed9dcdfab90cb39809ff6b370e3676fb81baa6081",
  "s": "0x25f5a16ced7deac7fd852ea8501a09b720578aeec619db7ffd7022fea1ab7565",
  "yParity": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_erc2612_permit_binding` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
