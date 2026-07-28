---
type: Attested Computation
title: "TDMRep AI Training Reservation Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-202-tdmrep-reservation-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-202-tdmrep-reservation-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TDMRep AI Training Reservation Builder — attested computation

> §10.2 Attested Computation binding for [TDMRep AI Training Reservation Builder](../tools/art-202-tdmrep-reservation-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-202-tdmrep-reservation-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:77d5d176f6eb5aa056509c41f30ed50029f753eba0fb68413759e38b7b670e08` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
