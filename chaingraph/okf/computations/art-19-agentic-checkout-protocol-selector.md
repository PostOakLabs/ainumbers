---
type: Attested Computation
title: "Agentic Checkout Protocol Selector — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the routing_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-19-agentic-checkout-protocol-selector.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-19-agentic-checkout-protocol-selector.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agentic Checkout Protocol Selector — attested computation

> §10.2 Attested Computation binding for [Agentic Checkout Protocol Selector](../tools/art-19-agentic-checkout-protocol-selector.md).

## Executor

Kernel source: `chaingraph/kernels/art-19-agentic-checkout-protocol-selector.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4219bb286318e4b2c15e45b65ee7be8d960c49a3f2a805aee2e9b9d49ff797e0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
