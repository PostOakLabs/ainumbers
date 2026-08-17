---
type: DecisionTool
title: "Publish Model Risk Head"
description: "Publishes one SPEC.md §HEAD-1 head-commit publication event for a model's revalidation-history stream, so a model's validation history (art-453/art-489 results, or art-562/art-648 lineage artifacts) becomes a sequence-numbered, signer-continuous chain instead of a series of unlinked artifacts a reviewer must independently discover and order, mirroring NAV-LINEAGE-BUILD-SPEC.md §3 and INDEX-LINEAGE-BUILD-SPEC.md §5, applied to a model's revalidation cadence. HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, exactly like art-562's stage-reference citations, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first, matching the NAV/index lineage rows; a head-file tip proves the signer's claimed tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and is not itself a revalidation-cadence enforcement mechanism. The estate's head-commit primitive (SPEC.md §HEAD-1 + _head.mjs) is merged to main; this node applies that estate-internal primitive to a model-risk stream and makes no claim under RDARR, BCBS 239, or SR 26-2 itself."
resource: https://ainumbers.co/chaingraph/art-649-publish-model-risk-head.html
tags: ["attestation_mandate", "wave-105", "mcp:publish_model_risk_head"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-649-publish-model-risk-head.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-649-publish-model-risk-head.html
    title: "public tool page"
---

# Publish Model Risk Head

> Exports a decision via MCP `publish_model_risk_head` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-649-publish-model-risk-head.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Model Validation Status Assessor](./art-453-model-validation-status.md), [Model Test Battery](./art-489-model-test-battery.md), [Compile Model Risk Lineage Pack](./art-562-compile-model-risk-lineage-pack.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-649-publish-model-risk-head.md) — §10.2.
