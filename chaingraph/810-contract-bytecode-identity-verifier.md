# Contract Bytecode Identity Verifier

Recomputes the identity of a deployed smart contract from caller-declared bytes: the Keccak-256 hash of the runtime code and of the creation code, the runtime size check against the 24,576-byte limit and the initcode size check against the 49,152-byte limit, the fields appended by the Solidity compiler (hash scheme, hash value, compiler version), and the contract address that a CREATE (deployer and nonce) or CREATE2 (deployer, 32-byte salt and creation code) deployment must produce. It compares the recomputed address with the declared address and the runtime hash with a declared verified-source hash, and returns a pass or fail with the list of flags. Identity rests on the runtime code hash only: the metadata hash identifies the compiler metadata file, which is not an input, so it is reported as extracted and never recomputed. Inputs over the two size limits are flagged and not hashed, which also bounds the work. Malformed hex, a wrong-length salt or address, or a scheme that mixes nonce and salt is refused. This node never reads a chain: it cannot know whether the declared bytes are what is deployed at the declared address, and it does not verify source code, checksum capitalization of addresses, or proxy and upgrade patterns. It is not proved: a zero-knowledge proof of this node is slow because hashing the code inside the prover is expensive, and it waits on a host hashing function and a scheduled downtime run. No sealed-proof claim is made.

- Page: https://ainumbers.co/chaingraph/810-contract-bytecode-identity-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/810-contract-bytecode-identity-verifier.md
- MCP tool: verify_contract_bytecode_identity (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "creation_code": "0x00",
  "runtime_code": "0x600b",
  "creation_scheme": "create2",
  "deployer": "0x0000000000000000000000000000000000000000",
  "salt": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "declared_address": "0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_contract_bytecode_identity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
