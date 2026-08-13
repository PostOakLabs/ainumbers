---
type: Attested Computation
title: "Stablecoin Reserve 3-Source Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-603-stablecoin-reserve-3source-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-603-stablecoin-reserve-3source-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Stablecoin Reserve 3-Source Recompute — attested computation

> §10.2 Attested Computation binding for [Stablecoin Reserve 3-Source Recompute](../tools/art-603-stablecoin-reserve-3source-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-603-stablecoin-reserve-3source-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c8316be3de60b7720200258695a7e8932fc30fc151208c12d87714c647bfc3db` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
