---
type: Attested Computation
title: "Summa MST Liability Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the cryptographic_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-621-summa-mst-liability-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-621-summa-mst-liability-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Summa MST Liability Aggregator — attested computation

> §10.2 Attested Computation binding for [Summa MST Liability Aggregator](../tools/art-621-summa-mst-liability-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/art-621-summa-mst-liability-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f237e50a1552db96450eb52e9c5ba27f461bfa8c8a610a3eb7a4818213080688` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
