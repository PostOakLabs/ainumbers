---
type: Attested Computation
title: "Basel Operational Risk SMA (2026 Reproposal) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the capital_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-356-compute-oprisk-sma-2026.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-356-compute-oprisk-sma-2026.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Basel Operational Risk SMA (2026 Reproposal) — attested computation

> §10.2 Attested Computation binding for [Basel Operational Risk SMA (2026 Reproposal)](../tools/art-356-compute-oprisk-sma-2026.md).

## Executor

Kernel source: `chaingraph/kernels/art-356-compute-oprisk-sma-2026.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e67b9da9f48f588611dee11e1da315939919a5a8b20c287a02840be84ccad970` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
