---
type: Attested Computation
title: "Compute HMDA Rate Spread — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-230-compute-hmda-rate-spread.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-230-compute-hmda-rate-spread.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Compute HMDA Rate Spread — attested computation

> §10.2 Attested Computation binding for [Compute HMDA Rate Spread](../tools/art-230-compute-hmda-rate-spread.md).

## Executor

Kernel source: `chaingraph/kernels/art-230-compute-hmda-rate-spread.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bf8ab4e43a576fd89244c8f1a43a0adb3c8ae4fb433d163a90773584efe86b9b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
