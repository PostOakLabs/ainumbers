---
type: DecisionTool
title: "Merkle Airdrop-Proof Verifier"
description: "Recomputes a Merkle airdrop-claim proof from caller-declared leaf fields (address, uint256 amount, encoding_variant) and a sibling path, OpenZeppelin MerkleProof.verify shape (processProof/_hashPair over chaingraph/kernels/_noble-secp256k1.bundle.mjs's already-vendored keccak256, no new vendoring, no hand-rolled hashing). Leaf derivation follows OpenZeppelin StandardMerkleTree's (address,uint256) convention: encoding_variant selects the double-hash leaf (keccak256(keccak256(abi.encode(address,amount))), the default, second-preimage-resistant) or a single-hash variant some deployed contracts use instead -- never assumed, always a declared param. Sibling-pair hashing is sorted/commutative (OpenZeppelin's default _hashPair, pair_sort:true) or explicit per-step left/right position (pair_sort:false) -- also a declared param, never an assumption. Given an optional claimed_path (a prior run's per-step running hashes), re-verifies and reports the earliest step at which the recompute diverges, instead of only a final match/no-match. This node never reads any chain: it cannot know whether claimed_root is the root actually recorded on-chain, whether the leaf's allocation was already claimed or redeemed, or whether the underlying tree was built correctly from the full allocation list -- it only recomputes hashes from what the caller supplies."
resource: https://ainumbers.co/chaingraph/art-605-merkle-airdrop-proof-verifier.html
tags: ["payment_policy", "wave-99", "mcp:verify_merkle_airdrop_proof"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-605-merkle-airdrop-proof-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-605-merkle-airdrop-proof-verifier.html
    title: "public tool page"
---

# Merkle Airdrop-Proof Verifier

> Exports a decision via MCP `verify_merkle_airdrop_proof` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-605-merkle-airdrop-proof-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-605-merkle-airdrop-proof-verifier.md) — §10.2.
