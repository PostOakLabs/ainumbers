---
type: Attested Computation
title: "E-Invoice Transmission Receipt Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-296-einvoice-transmission-receipt-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-296-einvoice-transmission-receipt-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# E-Invoice Transmission Receipt Builder — attested computation

> §10.2 Attested Computation binding for [E-Invoice Transmission Receipt Builder](../tools/art-296-einvoice-transmission-receipt-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-296-einvoice-transmission-receipt-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:efd9144454c833bea1da03c8c2003da04d8d3b21f33bd1e5e963a512bf21278c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
