---
type: Attested Computation
title: "Evidence Bundle Tier Labeler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-408-evidence-bundle-tier-labeler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-408-evidence-bundle-tier-labeler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Evidence Bundle Tier Labeler — attested computation

> §10.2 Attested Computation binding for [Evidence Bundle Tier Labeler](../tools/art-408-evidence-bundle-tier-labeler.md).

## Executor

Kernel source: `chaingraph/kernels/art-408-evidence-bundle-tier-labeler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4bffde8c450663ed6c3f2e2d7f8671638c0277be7be5f9e9717598f5911b88f8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
