# EIP-7702 Authorization-Tuple Decoder

Recomputes the EIP-7702 authorization-tuple hash (keccak256(0x05 || rlp([chain_id, address, nonce])), the 'Set EOA account code' standard live on Ethereum mainnet since the Pectra upgrade, 2025-05-07), recovers the ECDSA signer from a caller-supplied signature, and reports the address the recovered signer is authorizing as its delegate. The tuple's own address field IS the delegate: the code the EOA is pointing itself at. This node stops at that address - it never inspects, fetches, or judges the delegate contract's bytecode, and makes no safe/unsafe verdict about it. chain_id = 0 is EIP-7702-defined as a valid, deliberate cross-chain authorization (replayable on any chain) and is reported as such, never treated as malformed input. RLP encoding is hand-authored public-spec arithmetic (Ethereum Yellow Paper Appendix B); keccak256 and secp256k1 recovery come from the already-vendored, pinned noble-curves bundle, no new vendoring. Zero network calls: does not confirm the authorization was ever submitted on-chain, does not confirm the EOA's account nonce matches the declared nonce at any block, and makes no settlement claim.

- Page: https://ainumbers.co/chaingraph/art-614-eip7702-authorization-tuple-decoder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-614-eip7702-authorization-tuple-decoder.md
- MCP tool: decode_eip7702_authorization_tuple (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chainId (number, optional)
- address (string, optional)
- nonce (number, optional)
- signature (string, optional)
- r (string, optional)
- s (string, optional)
- v (number, optional)
- yParity (number, optional)

## Outputs

- verdict (string, optional)
- reasons (array, optional)
- chain_id (number,null, optional)
- cross_chain_authorization (boolean,null, optional)
- delegate_address (string,null, optional)
- nonce (number,null, optional)
- authorization_tuple_hash (string,null, optional)
- recovered_signer (string,null, optional)
- recovery_id (number,null, optional)
- recovery_id_source (string,null, optional)
- scope_note (string, optional)

## Sample

```json
{
  "chainId": 1,
  "address": "0x1234567890123456789012345678901234567890",
  "nonce": 0,
  "r": "0xbcc0abd2b842f32cc9c8844ec50c0d5c9b41563f825ef1a143ad93428fb23ad8",
  "s": "0x12678a935e15a1d1fae421fa00abd642222fb4db4aaf4f95a894ba0e38eebbae",
  "yParity": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `decode_eip7702_authorization_tuple` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
