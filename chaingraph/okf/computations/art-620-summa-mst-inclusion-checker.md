---
type: Attested Computation
title: "Summa MST Inclusion Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-620-summa-mst-inclusion-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-620-summa-mst-inclusion-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Summa MST Inclusion Checker — attested computation

> §10.2 Attested Computation binding for [Summa MST Inclusion Checker](../tools/art-620-summa-mst-inclusion-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-620-summa-mst-inclusion-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b1d00b37e7585853e001320d57d046d9a9fde7008d810c8df91000726f21f864` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
