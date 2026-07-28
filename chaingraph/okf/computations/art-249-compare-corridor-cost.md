---
type: Attested Computation
title: "Corridor Cost Comparator (World Bank RPW) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-249-compare-corridor-cost.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-249-compare-corridor-cost.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Corridor Cost Comparator (World Bank RPW) — attested computation

> §10.2 Attested Computation binding for [Corridor Cost Comparator (World Bank RPW)](../tools/art-249-compare-corridor-cost.md).

## Executor

Kernel source: `chaingraph/kernels/art-249-compare-corridor-cost.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5b97702d4128add63e1efcd5e53b18eb0f0c6775b5e0a7192e52492070064bec` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
