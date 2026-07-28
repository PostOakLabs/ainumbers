---
type: Attested Computation
title: "x402 Settlement Cost & Finality Modeler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-03-x402-settlement-modeler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-03-x402-settlement-modeler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Settlement Cost & Finality Modeler — attested computation

> §10.2 Attested Computation binding for [x402 Settlement Cost & Finality Modeler](../tools/art-03-x402-settlement-modeler.md).

## Executor

Kernel source: `chaingraph/kernels/art-03-x402-settlement-modeler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5d693ae08f52fbf0719d500857977fff760b19d533358ae2f5edd6693854de81` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
