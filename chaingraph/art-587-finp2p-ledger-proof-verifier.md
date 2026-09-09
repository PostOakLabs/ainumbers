# FinP2P Ledger Proof Verifier

Verifies a FinP2P Ledger Proof in Hashlist mode against a caller-supplied secp256k1 public key. Recomputes the FinP2P Hashlist digest (fixed field order, group hash then hash-of-group-hashes, per finp2p-docs.ownera.io) and reports whether it matches the receipt's stated hash, and separately whether the secp256k1 signature over that digest verifies against the supplied key. Zero network calls; the verification key is caller-supplied, never resolved by this tool. Two independently reported results, never fused into one boolean. Makes no claim about ledger finality, settlement, or acceptance. EIP-712 typed-data proofs are out of scope (Hashlist mode only).

- Page: https://ainumbers.co/chaingraph/art-587-finp2p-ledger-proof-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-587-finp2p-ledger-proof-verifier.md
- MCP tool: verify_finp2p_ledger_proof (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- proof (unknown, required)
- receipt (unknown, required)
- verification_public_key (unknown, optional)

## Outputs

- hash_match (object, optional)
- hashlist_field_order (array, optional)
- hashlist_values_consistent (boolean, optional)
- hashlist_values_declared (array, optional)
- parse_errors (array, optional)
- scope_note (string, optional)
- signature_match (object, optional)
- verified_against (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_finp2p_ledger_proof` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
