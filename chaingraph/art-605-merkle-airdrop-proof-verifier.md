# Merkle Airdrop-Proof Verifier

Recomputes a Merkle airdrop-claim proof from caller-declared leaf fields (address, uint256 amount, encoding_variant) and a sibling path, OpenZeppelin MerkleProof.verify shape (processProof/_hashPair over chaingraph/kernels/_noble-secp256k1.bundle.mjs's already-vendored keccak256, no new vendoring, no hand-rolled hashing). Leaf derivation follows OpenZeppelin StandardMerkleTree's (address,uint256) convention: encoding_variant selects the double-hash leaf (keccak256(keccak256(abi.encode(address,amount))), the default, second-preimage-resistant) or a single-hash variant some deployed contracts use instead - never assumed, always a declared param. Sibling-pair hashing is sorted/commutative (OpenZeppelin's default _hashPair, pair_sort:true) or explicit per-step left/right position (pair_sort:false) - also a declared param, never an assumption. Given an optional claimed_path (a prior run's per-step running hashes), re-verifies and reports the earliest step at which the recompute diverges, instead of only a final match/no-match. This node never reads any chain: it cannot know whether claimed_root is the root actually recorded on-chain, whether the leaf's allocation was already claimed or redeemed, or whether the underlying tree was built correctly from the full allocation list - it only recomputes hashes from what the caller supplies.

- Page: https://ainumbers.co/chaingraph/art-605-merkle-airdrop-proof-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-605-merkle-airdrop-proof-verifier.md
- MCP tool: verify_merkle_airdrop_proof (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- address (string, optional)
- amount (string, optional)
- encoding_variant (string, optional)
- pair_sort (boolean, optional)
- proof (array, optional)
- claimed_root (string, optional)
- claimed_path (array, optional)

## Outputs

- leaf (string,null, optional)
- computed_root (string,null, optional)
- path (array, optional)
- encoding_variant_used (string,null, optional)
- pair_sort_used (boolean, optional)
- root_matches_claimed (boolean,null, optional)
- path_intact (boolean,null, optional)
- first_divergent_step (number,null, optional)
- note (string, optional)
- reasons (array, optional)

## Sample

```json
{
  "address": "0x1111111111111111111111111111111111111111",
  "amount": "1000000000000000000",
  "encoding_variant": "double-hash",
  "proof": [],
  "claimed_root": "0xb38ec842db1cd54e5e5ce48491f1a404551e9726ebda349d0478e189e0996dd4"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_merkle_airdrop_proof` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
