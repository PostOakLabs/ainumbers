---
type: Attested Computation
title: "Medicare Out-of-Pocket Exposure — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the retirement_projection decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-769-medicare-oop-exposure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-769-medicare-oop-exposure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Medicare Out-of-Pocket Exposure — attested computation

> §10.2 Attested Computation binding for [Medicare Out-of-Pocket Exposure](../tools/art-769-medicare-oop-exposure.md).

## Executor

Kernel source: `chaingraph/kernels/art-769-medicare-oop-exposure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8da5afef94905e85214f687d89d290ee3e272913db2e52d117496d7f30b859d1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
