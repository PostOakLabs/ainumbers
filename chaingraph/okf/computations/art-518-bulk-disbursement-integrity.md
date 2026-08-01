---
type: Attested Computation
title: "Bulk Disbursement Integrity — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-518-bulk-disbursement-integrity.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-518-bulk-disbursement-integrity.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Bulk Disbursement Integrity — attested computation

> §10.2 Attested Computation binding for [Bulk Disbursement Integrity](../tools/art-518-bulk-disbursement-integrity.md).

## Executor

Kernel source: `chaingraph/kernels/art-518-bulk-disbursement-integrity.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d399955e44b9c1d31f8ad39c574de640ce32eee4b5755975d41de22d08f04db1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
