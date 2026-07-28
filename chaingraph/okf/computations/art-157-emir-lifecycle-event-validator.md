---
type: Attested Computation
title: "EMIR Lifecycle Event Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-157-emir-lifecycle-event-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-157-emir-lifecycle-event-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EMIR Lifecycle Event Validator — attested computation

> §10.2 Attested Computation binding for [EMIR Lifecycle Event Validator](../tools/art-157-emir-lifecycle-event-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-157-emir-lifecycle-event-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9d3b6b68b0c7bf0cd0b08b8e320a2f27a849be1e49c1044ee5a8fd4c432c9191` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
