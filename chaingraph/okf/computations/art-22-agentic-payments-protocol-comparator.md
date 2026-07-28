---
type: Attested Computation
title: "Agentic Payments Protocol Comparator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the routing_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-22-agentic-payments-protocol-comparator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-22-agentic-payments-protocol-comparator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agentic Payments Protocol Comparator — attested computation

> §10.2 Attested Computation binding for [Agentic Payments Protocol Comparator](../tools/art-22-agentic-payments-protocol-comparator.md).

## Executor

Kernel source: `chaingraph/kernels/art-22-agentic-payments-protocol-comparator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0d884710ed42dd2b36075266167a7fed1219199fa4aebad015933fabc4dfdee8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
