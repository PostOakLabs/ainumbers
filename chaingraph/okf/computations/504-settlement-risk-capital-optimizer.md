---
type: Attested Computation
title: "Settlement-Risk Capital Efficiency Optimizer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the capital_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/504-settlement-risk-capital-optimizer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/504-settlement-risk-capital-optimizer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Settlement-Risk Capital Efficiency Optimizer — attested computation

> §10.2 Attested Computation binding for [Settlement-Risk Capital Efficiency Optimizer](../tools/504-settlement-risk-capital-optimizer.md).

## Executor

Kernel source: `chaingraph/kernels/504-settlement-risk-capital-optimizer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:57a3a1bd70235be6b46ba6d177b784665e1480eb8f0c59047d84f3498611cfe8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
