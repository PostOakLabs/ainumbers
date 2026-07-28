---
type: Attested Computation
title: "Clearing Access Model Selector — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the treasury_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-49-clearing-access-model-selector.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-49-clearing-access-model-selector.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Clearing Access Model Selector — attested computation

> §10.2 Attested Computation binding for [Clearing Access Model Selector](../tools/art-49-clearing-access-model-selector.md).

## Executor

Kernel source: `chaingraph/kernels/art-49-clearing-access-model-selector.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ff9e78cf7128918984b55cbf858c74f3ca3a6e818389e067899863b8cd570034` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
