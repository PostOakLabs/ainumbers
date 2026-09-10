---
type: DecisionTool
title: "Publish Index Head"
description: "Publishes one SPEC.md §HEAD-1 head-commit publication event for an index or benchmark's per-stream publication history, so an index administrator's published history (art-646-compile-rebalance-evidence-pack results, or art-647-record-index-correction events) becomes a sequence-numbered, signer-continuous chain instead of a series of unlinked artifacts a reviewer must independently discover and order, mirroring NAV-LINEAGE-BUILD-SPEC.md §3 and art-649-publish-model-risk-head, applied to an index/benchmark administrator's stream (INDEX-LINEAGE-BUILD-SPEC.md §5). HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, exactly like art-562's stage-reference citations, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first, matching the NAV/model-risk lineage rows; a head-file tip proves the signer's claimed tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and is not itself a rebalance-cadence enforcement mechanism. Written for administrators in the post-Regulation-(EU)-2025/914 BMR scope (critical/significant benchmarks) and for SEBI-regulated benchmark administrators; this node makes no BMR/SEBI in-scope determination of its own and makes no claim of BMR or SEBI compliance itself."
resource: https://ainumbers.co/chaingraph/art-658-publish-index-head.html
tags: ["attestation_mandate", "wave-111", "mcp:publish_index_head"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-658-publish-index-head.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-658-publish-index-head.html
    title: "public tool page"
---

# Publish Index Head

> Exports a decision via MCP `publish_index_head` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-658-publish-index-head.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Compile Rebalance Evidence Pack](./art-646-compile-rebalance-evidence-pack.md), [Record Index Correction](./art-647-record-index-correction.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-658-publish-index-head.md) — §10.2.
