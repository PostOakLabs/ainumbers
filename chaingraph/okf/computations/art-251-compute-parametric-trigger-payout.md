---
type: Attested Computation
title: "Parametric Trigger Payout Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-251-compute-parametric-trigger-payout.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-251-compute-parametric-trigger-payout.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Parametric Trigger Payout Calculator — attested computation

> §10.2 Attested Computation binding for [Parametric Trigger Payout Calculator](../tools/art-251-compute-parametric-trigger-payout.md).

## Executor

Kernel source: `chaingraph/kernels/art-251-compute-parametric-trigger-payout.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:21c850de44ea52edcd069ddb042c208ec8d8df8175a09b3fc3c9478245db8158` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
