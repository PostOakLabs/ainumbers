---
type: Attested Computation
title: "Borrower Escrow Auditor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the consumer_finance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/732-borrower-escrow-auditor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/732-borrower-escrow-auditor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Borrower Escrow Auditor — attested computation

> §10.2 Attested Computation binding for [Borrower Escrow Auditor](../tools/732-borrower-escrow-auditor.md).

## Executor

Kernel source: `chaingraph/kernels/732-borrower-escrow-auditor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b9e2ac19f3a7bba67b8bef47d7c1ef77a631ed51cb3d865f9859117e790164cd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
