---
type: Attested Computation
title: "GloBE Transitional Safe Harbour Test Evaluator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-456-globe-safe-harbour-tests.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-456-globe-safe-harbour-tests.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE Transitional Safe Harbour Test Evaluator — attested computation

> §10.2 Attested Computation binding for [GloBE Transitional Safe Harbour Test Evaluator](../tools/art-456-globe-safe-harbour-tests.md).

## Executor

Kernel source: `chaingraph/kernels/art-456-globe-safe-harbour-tests.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9dd9ae74b1d4edde67ba59bd862dc96cd7a0623011b3e59070bf5fd6ccbf3669` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
