---
type: Attested Computation
title: "Workforce Board ROI Report — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the workforce_program_roi decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-712-workforce-board-roi.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-712-workforce-board-roi.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Workforce Board ROI Report — attested computation

> §10.2 Attested Computation binding for [Workforce Board ROI Report](../tools/art-712-workforce-board-roi.md).

## Executor

Kernel source: `chaingraph/kernels/art-712-workforce-board-roi.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6657f151d3920546003c4c6eced39e5805a32e7e65d2109a812eda50e8582782` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
