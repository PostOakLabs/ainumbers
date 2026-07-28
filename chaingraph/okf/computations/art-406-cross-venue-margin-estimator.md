---
type: Attested Computation
title: "Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-406-cross-venue-margin-estimator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-406-cross-venue-margin-estimator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator — attested computation

> §10.2 Attested Computation binding for [Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator](../tools/art-406-cross-venue-margin-estimator.md).

## Executor

Kernel source: `chaingraph/kernels/art-406-cross-venue-margin-estimator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:43750924c09ef1d6bfd8c815c5452fb6c21d0f7261c5518df2c9781abace1499` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
