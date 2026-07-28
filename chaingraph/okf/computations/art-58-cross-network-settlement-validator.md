---
type: Attested Computation
title: "Cross-Network Atomic Settlement Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-58-cross-network-settlement-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-58-cross-network-settlement-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Cross-Network Atomic Settlement Validator — attested computation

> §10.2 Attested Computation binding for [Cross-Network Atomic Settlement Validator](../tools/art-58-cross-network-settlement-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-58-cross-network-settlement-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3bd0c00f1525794b85021aa94d28caed825ccbf0bae6d32f38092cb2ec96bc8b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
