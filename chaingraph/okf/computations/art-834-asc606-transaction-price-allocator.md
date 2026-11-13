---
type: Attested Computation
title: "ASC 606 Transaction Price Allocator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-834-asc606-transaction-price-allocator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-834-asc606-transaction-price-allocator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ASC 606 Transaction Price Allocator — attested computation

> §10.2 Attested Computation binding for [ASC 606 Transaction Price Allocator](../tools/art-834-asc606-transaction-price-allocator.md).

## Executor

Kernel source: `chaingraph/kernels/art-834-asc606-transaction-price-allocator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a5fc86788526c97004e538ce8a220e63293c36a07c0f90f1318e339601e8c6ef` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
