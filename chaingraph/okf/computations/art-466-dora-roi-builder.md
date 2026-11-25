---
type: Attested Computation
title: "DORA Register of Information (RoI) Builder & Cross-Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-466-dora-roi-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-466-dora-roi-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DORA Register of Information (RoI) Builder & Cross-Validator — attested computation

> §10.2 Attested Computation binding for [DORA Register of Information (RoI) Builder & Cross-Validator](../tools/art-466-dora-roi-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-466-dora-roi-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:32bccaf880b7193ab5430857244909678e38fbe92c16fbd0af6490c1565f0ef6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
