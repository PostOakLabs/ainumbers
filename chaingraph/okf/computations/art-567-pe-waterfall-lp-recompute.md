---
type: Attested Computation
title: "PE Distribution Waterfall LP-Side Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-567-pe-waterfall-lp-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-567-pe-waterfall-lp-recompute.json#compute_images
timestamp: 2026-08-06
generated: { by: "ainumbers/generate-okf", at: "2026-08-06" }
status: stable
---

# PE Distribution Waterfall LP-Side Recompute — attested computation

> §10.2 Attested Computation binding for [PE Distribution Waterfall LP-Side Recompute](../tools/art-567-pe-waterfall-lp-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-567-pe-waterfall-lp-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:df13afbe5e611661922ccea2123194de8f703a3efa283154ec7af8b7876881e9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
