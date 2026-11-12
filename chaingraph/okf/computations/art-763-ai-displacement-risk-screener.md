---
type: Attested Computation
title: "AI Displacement Risk Screener — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-763-ai-displacement-risk-screener.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-763-ai-displacement-risk-screener.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AI Displacement Risk Screener — attested computation

> §10.2 Attested Computation binding for [AI Displacement Risk Screener](../tools/art-763-ai-displacement-risk-screener.md).

## Executor

Kernel source: `chaingraph/kernels/art-763-ai-displacement-risk-screener.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:91fb630e8e4abce5da6b62416996e456f8665988098ae412e7f24786ac07dedc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
