---
type: Attested Computation
title: "Circumvention Diligence Assessor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-95-circumvention-diligence-assessor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-95-circumvention-diligence-assessor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Circumvention Diligence Assessor — attested computation

> §10.2 Attested Computation binding for [Circumvention Diligence Assessor](../tools/art-95-circumvention-diligence-assessor.md).

## Executor

Kernel source: `chaingraph/kernels/art-95-circumvention-diligence-assessor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:75587c9e280c8c0b45a80f7846a3c176999cf769b7f62fd36dc96e732b79a75b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
