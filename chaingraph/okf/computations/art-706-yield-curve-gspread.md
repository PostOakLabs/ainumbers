---
type: Attested Computation
title: "Yield Curve & G-Spread — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-706-yield-curve-gspread.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-706-yield-curve-gspread.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Yield Curve & G-Spread — attested computation

> §10.2 Attested Computation binding for [Yield Curve & G-Spread](../tools/art-706-yield-curve-gspread.md).

## Executor

Kernel source: `chaingraph/kernels/art-706-yield-curve-gspread.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:376d1cf65cb78cf0f916e618176436b629b0fcd903bda64f5c9bd2de934e1f50` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
