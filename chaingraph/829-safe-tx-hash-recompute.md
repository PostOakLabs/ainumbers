# Safe Transaction Hash Recompute

Recomputes the hash and decodes known calls. It does not simulate execution and cannot tell you the destination contract is safe. From pasted Safe transaction fields (to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce), the chain id, the Safe address and the Safe version (1.3.0, 1.4.1 or 1.5.0), it recomputes the domain hash, the message hash and the safeTxHash so a signer can compare them with what a hardware wallet displays. Safe versions before 1.3.0 have no chain id in their domain and are refused with an explicit code, never recomputed. The call data is matched against a fixed selector table (ERC-20 and ERC-721 transfer and approval calls, setApprovalForAll, Safe owner, threshold, module, guard and fallback-handler administration, multiSend) and decoded by hand; an unknown selector is reported as not decoded, never as safe, and a multiSend batch is flagged with its nested payload reported as not decoded. Operation 1 (delegatecall), admin calls on the Safe itself and approvals are flagged. Zero network calls; every field is caller-supplied and echoed, never resolved. The Safe repository publishes no fixed hash vectors, so the shipped vectors are self-generated and cross-checked against an independent Keccak implementation; only the two typehash constants are Safe-sourced.

- Page: https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.md
- MCP tool: recompute_safe_tx_hash (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- version (string, required): the Safe contract's VERSION string; must be exactly 1.3.0, 1.4.1 or 1.5.0. Any other value, including 1.2.0 and older (whose signing domain carries no chain id), is refused with an explicit code, never recomputed.
- chainId (string or number, required): the chain id of the network the Safe lives on, a non-negative uint256 (decimal or 0x-hex).
- safe (string, required): the 20-byte hex address of the Safe account being signed for.
- to (string, required): the 20-byte hex destination address of the transaction.
- value (string or number, optional): the value field in wei, a non-negative uint256; defaults to 0.
- data (string, optional): the transaction call data as even-length hex, 0x-prefixed or bare; absent or empty means a plain transfer. Over 32768 bytes is refused.
- operation (number or string, required): 0 (call) or 1 (delegatecall); anything else is refused.
- safeTxGas (string or number, required): non-negative uint256.
- baseGas (string or number, required): non-negative uint256.
- gasPrice (string or number, required): non-negative uint256.
- gasToken (string, required): 20-byte hex address; the zero address means ether.
- refundReceiver (string, required): 20-byte hex address; the zero address means tx.origin.
- nonce (string or number, required): the Safe's current nonce, a non-negative uint256.

## Outputs

- verdict (string, optional): HASH_COMPUTED, REFUSED (unsupported version) or INDETERMINATE (malformed input).
- refusal_code (string or null, optional): UNSUPPORTED_SAFE_VERSION, MALFORMED_INPUT or null.
- reasons (array, optional): empty on success; refusal reasons otherwise.
- safe_version (string or null, optional): the echoed version when supported.
- transaction (object, optional): the normalized, echoed transaction fields.
- domain_hash (string or null, optional): keccak256 of the EIP-712 domain separator preimage.
- message_hash (string or null, optional): keccak256 of the SafeTx struct preimage.
- safe_tx_hash (string or null, optional): keccak256 of 0x1901 plus domain hash plus message hash; what a Trezor or MetaMask display.
- data_keccak256 (string or null, optional): keccak256 of the call data as it enters the struct.
- data_length_bytes (integer or null, optional)
- decoded_call (object or null, optional): status no_data, not_decoded, partially_decoded or decoded, with selector, name, signature, args and a note where two standards share a selector.
- risk_flags (array, optional): DELEGATECALL, ADMIN_CALL_ON_SAFE, TOKEN_APPROVAL, APPROVAL_UNLIMITED_AMOUNT, APPROVAL_FOR_ALL_GRANTED, MULTISEND_NESTED_NOT_DECODED, CALL_NOT_DECODED, VALUE_SENT_TO_SELF, GAS_REFUND_FIELDS_SET.
- domain_typehash (string, optional): the domain separator typehash, self-checked inside compute().
- safe_tx_typehash (string, optional): the SafeTx typehash, self-checked inside compute().
- scope_note (string, optional)

## Sample

```json
{
  "version": "1.3.0",
  "chainId": "1",
  "safe": "0x91a3230d6ba2a0e5f5b2e6d1a1e2c3b4a596877a",
  "to": "0x1111111111111111111111111111111111111111",
  "value": "0",
  "data": "0xa9059cbb000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000000003e8",
  "operation": 0,
  "safeTxGas": "0",
  "baseGas": "0",
  "gasPrice": "0",
  "gasToken": "0x0000000000000000000000000000000000000000",
  "refundReceiver": "0x0000000000000000000000000000000000000000",
  "nonce": "7"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_safe_tx_hash` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned safeTxHash against what your signing device displays for the same fields. Use synthetic inputs only; never send real personal data.
