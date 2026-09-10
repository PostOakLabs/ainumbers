# ERC-4337 UserOperation Math

Recomputes the ERC-4337 account-abstraction userOpHash from a caller-supplied UserOperation, computes the EntryPoint's required prefund from caller-supplied gas limits, and reconciles a declared paymaster charge against a charge recomputed from declared inputs. The EntryPoint version is a mandatory declared parameter and is never inferred: v0.6 hashes a 10-word UserOperation pack while v0.7 hashes an 8-word PackedUserOperation in which verificationGasLimit and callGasLimit pack into accountGasLimits and maxPriorityFeePerGas and maxFeePerGas pack into gasFees, so guessing the version would silently produce a wrong hash. The two versions also differ in the prefund formula: v0.6 multiplies verificationGasLimit by three when a paymaster is present, because that same limit also caps postOp, while v0.7 instead adds the paymaster's own verification and postOp gas limits, parsed from the fixed offsets inside paymasterAndData. Both are supported and an unrecognised version is refused rather than approximated. L1 data and blob fees are never derived: after EIP-4844 they depend on the inclusion-time L1 basefee and blob basefee, which are not derivable offline, so an L1 data fee enters reconciliation only when the caller declares it and its absence is reported as a named gap rather than absorbed into a residual. block.basefee is likewise never fetched, so when the two fee caps differ the effective gas price is reported as null with the reason unless a basefee is declared; when the caps are equal the EntryPoint's own legacy shortcut makes the price derivable with no basefee at all. keccak256 comes from the already-vendored, pinned noble-hashes bundle, copied byte-identically from the sibling x402 digest node, and the ABI encoding scheme is implemented directly as public-spec arithmetic on top of it. Zero network calls and zero chain reads: deposits, stakes, nonce-sequence validity and prior spend are never consulted, and every field is caller-declared and echoed back. This node recomputes and reconciles; it makes no claim that any operation was settled, accepted, included, or final, and no claim about signature validity, since the ERC-4337 spec excludes the signature from the hashed struct. Golden vectors are cross-checked against an independent from-spec Keccak-256 and ABI encoder, itself anchored on externally published Keccak-256 constants, not round-trip self-tests alone.

- Page: https://ainumbers.co/chaingraph/art-613-erc4337-userop-math.html
- Markdown twin: https://ainumbers.co/chaingraph/art-613-erc4337-userop-math.md
- MCP tool: recompute_erc4337_userop_math (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entryPointVersion (string, optional)
- entryPoint (string, optional)
- chainId (number, optional)
- sender (string, optional)
- nonce (number, optional)
- initCode (string, optional)
- callData (string, optional)
- paymasterAndData (string, optional)
- callGasLimit (number, optional)
- verificationGasLimit (number, optional)
- preVerificationGas (number, optional)
- maxFeePerGas (number, optional)
- maxPriorityFeePerGas (number, optional)
- declaredBaseFeePerGas (number, optional)
- declaredActualGasUsed (number, optional)
- declaredActualGasCostWei (string, optional)
- declaredL1DataFeeWei (string, optional)
- reconciliationToleranceWei (string, optional)

## Outputs

- verdict (string, optional)
- reasons (array, optional)
- entry_point (object, optional)
- chain_id (string,null, optional)
- user_op (object, optional)
- packed_words (object,null, optional)
- field_hashes (object,null, optional)
- packed_user_op_hash (string,null, optional)
- user_op_hash (string,null, optional)
- gas_accounting (object,null, optional)
- paymaster_reconciliation (object,null, optional)
- never_fetched (array, optional)
- scope_note (string, optional)

## Sample

```json
{
  "entryPointVersion": "0.6",
  "entryPoint": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  "chainId": 1,
  "sender": "0x2A1530C4C41db0B0b2bB646CB5Eb1A67b7158667",
  "nonce": 0,
  "initCode": "0x",
  "callData": "0xb61d27f60000000000000000000000005ff137d4b0fdcd49dca30c7cf57e578a026d2789",
  "paymasterAndData": "0x",
  "callGasLimit": 100000,
  "verificationGasLimit": 150000,
  "preVerificationGas": 21000,
  "maxFeePerGas": 2000000000,
  "maxPriorityFeePerGas": 1000000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_erc4337_userop_math` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
