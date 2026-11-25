---
type: Attested Computation
title: "Stablecoin Refund Dispute Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/795-stablecoin-refund-dispute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/795-stablecoin-refund-dispute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Stablecoin Refund Dispute Check — attested computation

> §10.2 Attested Computation binding for [Stablecoin Refund Dispute Check](../tools/795-stablecoin-refund-dispute.md).

## Executor

Kernel source: `chaingraph/kernels/795-stablecoin-refund-dispute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4d7a86b07be753ede278b2f9eee405d5519e6d9c90fad8cd96f7985abea3d775` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
