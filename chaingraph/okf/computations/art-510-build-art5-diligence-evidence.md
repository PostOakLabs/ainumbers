---
type: Attested Computation
title: "Article 5 Due Diligence Evidence Record — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-510-build-art5-diligence-evidence.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-510-build-art5-diligence-evidence.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Article 5 Due Diligence Evidence Record — attested computation

> §10.2 Attested Computation binding for [Article 5 Due Diligence Evidence Record](../tools/art-510-build-art5-diligence-evidence.md).

## Executor

Kernel source: `chaingraph/kernels/art-510-build-art5-diligence-evidence.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:72798cbb71379e42e0b388c97b0781d1189fd20a06e289e2bbff86254b0dd17e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
