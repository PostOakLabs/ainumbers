---
type: Attested Computation
title: "Ap2 X402 Cart Correlation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-596-ap2-x402-cart-correlation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-596-ap2-x402-cart-correlation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Ap2 X402 Cart Correlation — attested computation

> §10.2 Attested Computation binding for [Ap2 X402 Cart Correlation](../tools/art-596-ap2-x402-cart-correlation.md).

## Executor

Kernel source: `chaingraph/kernels/art-596-ap2-x402-cart-correlation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bd768b21783024010879049cb1560f975da0ac0a210a9fde5da62dca74523c81` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
