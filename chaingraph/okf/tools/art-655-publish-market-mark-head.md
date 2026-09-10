---
type: DecisionTool
title: "Publish Market Mark Head"
description: "Publishes one SPEC.md §HEAD-1 head-commit publication event for a market's mark-price print stream (stream = \"mark:<venue>:<pair>\"), so a series of art-560-oracle-price-aggregation prints for the same pair becomes a sequence-numbered, signer-continuous chain instead of a set of unlinked artifacts a reader must independently discover and order, mirroring MRM-LINEAGE-BUILD-SPEC.md's art-649-publish-model-risk-head and NAV-LINEAGE-BUILD-SPEC.md §3 / INDEX-LINEAGE-BUILD-SPEC.md §5's own §HEAD-1 sections, applied to a market's mark-print cadence. HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first, matching the model-risk/NAV/index lineage rows; a head-file tip proves the signer's claimed tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and is not itself a print-cadence/staleness enforcement mechanism. The estate's head-commit primitive (SPEC.md §HEAD-1 + _head.mjs) is merged to main; this node applies that estate-internal primitive to a market's mark-price stream and makes no claim under CFTC, SEC, or any venue's own market-data attestation obligations itself."
resource: https://ainumbers.co/mcp.html
tags: ["attestation_mandate", "wave-111", "mcp:publish_market_mark_head"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-655-publish-market-mark-head.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# Publish Market Mark Head

> Exports a decision via MCP `publish_market_mark_head` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Oracle Price Aggregation](./art-560-oracle-price-aggregation.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-655-publish-market-mark-head.md) — §10.2.
