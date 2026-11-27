# Safe Transaction Hash Recompute

Recomputes the hash and decodes known calls. It does not simulate execution and cannot tell you the destination contract is safe. From pasted Safe transaction fields (to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce), the chain id, the Safe address and the Safe version (1.3.0, 1.4.1 or 1.5.0), it recomputes the domain hash, the message hash and the safeTxHash so a signer can compare them with what a hardware wallet displays. Safe versions before 1.3.0 have no chain id in their domain and are refused with an explicit code, never recomputed. The call data is matched against a fixed selector table (ERC-20 and ERC-721 transfer and approval calls, setApprovalForAll, Safe owner, threshold, module, guard and fallback-handler administration, multiSend) and decoded by hand; an unknown selector is reported as not decoded, never as safe, and a multiSend batch is flagged with its nested payload reported as not decoded. Operation 1 (delegatecall), admin calls on the Safe itself and approvals are flagged. Zero network calls; every field is caller-supplied and echoed, never resolved. The Safe repository publishes no fixed hash vectors, so the shipped vectors are self-generated and cross-checked against an independent Keccak implementation; only the two typehash constants are Safe-sourced.

- Page: https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.md
- MCP tool: recompute_safe_tx_hash (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- version (string, required): Safe contract version (the VERSION constant). Versions before 1.3.0 are refused.
- chainId (string, required): Chain id the Safe is deployed on (uint256, decimal or 0x-hex).
- safe (string, required): Address of the Safe that will execute the transaction (the EIP-712 verifyingContract), 20-byte hex.
- to (string, required): Destination address, 20-byte hex.
- value (string, required): Ether value in wei (uint256).
- data (string, optional): Call data as hex (0x-prefixed or bare). Empty or 0x for a plain ether transfer. Up to 32768 bytes.
- operation (string, required): 0 = call, 1 = delegatecall.
- safeTxGas (string, required): safeTxGas (uint256).
- baseGas (string, required): baseGas (uint256).
- gasPrice (string, required): gasPrice (uint256).
- gasToken (string, required): gasToken address; the zero address for ether.
- refundReceiver (string, required): refundReceiver address; the zero address for tx.origin.
- nonce (string, required): Safe nonce (uint256).

## Outputs

- verdict (string, optional)
- refusal_code (string,null, optional)
- reasons (array, optional)
- safe_version (string,null, optional)
- transaction (object, optional)
- domain_hash (string,null, optional)
- message_hash (string,null, optional)
- safe_tx_hash (string,null, optional)
- data_keccak256 (string,null, optional)
- data_length_bytes (number,null, optional)
- decoded_call (object,null, optional)
- risk_flags (array, optional)
- domain_typehash (string, optional)
- safe_tx_typehash (string, optional)
- scope_note (string, optional)

## Sample

```json
{
  "version": "1.3.0",
  "chainId": "1",
  "safe": "0x1111111111111111111111111111111111111111",
  "to": "0x2222222222222222222222222222222222222222",
  "value": "1000000000000000000",
  "data": "0x",
  "operation": "0",
  "safeTxGas": "0",
  "baseGas": "0",
  "gasPrice": "0",
  "gasToken": "0x0000000000000000000000000000000000000000",
  "refundReceiver": "0x0000000000000000000000000000000000000000",
  "nonce": "7"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_safe_tx_hash` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
