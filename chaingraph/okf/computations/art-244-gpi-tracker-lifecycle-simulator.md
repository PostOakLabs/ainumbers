---
type: Attested Computation
title: "SWIFT GPI Tracker Lifecycle Simulator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-244-gpi-tracker-lifecycle-simulator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-244-gpi-tracker-lifecycle-simulator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SWIFT GPI Tracker Lifecycle Simulator — attested computation

> §10.2 Attested Computation binding for [SWIFT GPI Tracker Lifecycle Simulator](../tools/art-244-gpi-tracker-lifecycle-simulator.md).

## Executor

Kernel source: `chaingraph/kernels/art-244-gpi-tracker-lifecycle-simulator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:95a121c21ae663021a54823e43d3f181762a899c730c31f7d5356f12cd1ba043` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
