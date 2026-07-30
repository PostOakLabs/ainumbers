---
type: Attested Computation
title: "CASS 15 Safeguarding Method Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-500-classify-safeguarding-method.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-500-classify-safeguarding-method.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CASS 15 Safeguarding Method Classifier — attested computation

> §10.2 Attested Computation binding for [CASS 15 Safeguarding Method Classifier](../tools/art-500-classify-safeguarding-method.md).

## Executor

Kernel source: `chaingraph/kernels/art-500-classify-safeguarding-method.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:314afddd557143ad20b8ecc8db1f7ebf34c9ff4eded6024723b8cde4d9501938` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
