---
type: Attested Computation
title: "Stablecoin Corridor Economics Model — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-250-model-stablecoin-corridor-economics.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-250-model-stablecoin-corridor-economics.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Stablecoin Corridor Economics Model — attested computation

> §10.2 Attested Computation binding for [Stablecoin Corridor Economics Model](../tools/art-250-model-stablecoin-corridor-economics.md).

## Executor

Kernel source: `chaingraph/kernels/art-250-model-stablecoin-corridor-economics.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:65998d555685be3e102ff17ae1fd898ca63aa688a69873358fa6d7a520660f2b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
