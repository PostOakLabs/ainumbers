---
type: Attested Computation
title: "Tempo Agentic Checkout Settlement Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-40-tempo-agentic-checkout.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-40-tempo-agentic-checkout.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo Agentic Checkout Settlement Mapper — attested computation

> §10.2 Attested Computation binding for [Tempo Agentic Checkout Settlement Mapper](../tools/art-40-tempo-agentic-checkout.md).

## Executor

Kernel source: `chaingraph/kernels/art-40-tempo-agentic-checkout.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:47e0d8df39b535ff28996c6dc12584f8049e74d5b4f532510f296e2eebbddc02` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
