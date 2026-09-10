# Publish Index Head

Publishes one SPEC.md §HEAD-1 head-commit publication event for an index or benchmark's per-stream publication history, so an index administrator's published history (art-646-compile-rebalance-evidence-pack results, or art-647-record-index-correction events) becomes a sequence-numbered, signer-continuous chain instead of a series of unlinked artifacts a reviewer must independently discover and order, mirroring NAV-LINEAGE-BUILD-SPEC.md §3 and art-649-publish-model-risk-head, applied to an index/benchmark administrator's stream (INDEX-LINEAGE-BUILD-SPEC.md §5). HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, exactly like art-562's stage-reference citations, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first, matching the NAV/model-risk lineage rows; a head-file tip proves the signer's claimed tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and is not itself a rebalance-cadence enforcement mechanism. Written for administrators in the post-Regulation-(EU)-2025/914 BMR scope (critical/significant benchmarks) and for SEBI-regulated benchmark administrators; this node makes no BMR/SEBI in-scope determination of its own and makes no claim of BMR or SEBI compliance itself.

- Page: https://ainumbers.co/chaingraph/art-658-publish-index-head.html
- Markdown twin: https://ainumbers.co/chaingraph/art-658-publish-index-head.md
- MCP tool: publish_index_head (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chain_verification (array, required)
- head (unknown, required)
- prior_head (unknown, required)
- signature_verification (unknown, required)

## Outputs

- chain_errors (array, required)
- chain_valid (null,boolean, required)
- chain_verified_by (null,string, required)
- errors (array, required)
- fence (string, required)
- head_hash (null,string, required)
- is_genesis (boolean, required)
- not_proven (array, required)
- prev_head_hash (null,string, required)
- regulatory_framework (string, required)
- root (null,string, required)
- rotates_to (null,string, required)
- seq (null,number, required)
- signature_valid (null,boolean, required)
- signature_verified_by (null,string, required)
- signer (null,string, required)
- stream (null,string, required)
- structural_error (string,null, required)
- timestamp (null,string, required)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `publish_index_head` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
