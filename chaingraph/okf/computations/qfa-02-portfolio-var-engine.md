---
type: Attested Computation
title: "Portfolio Covariance & VaR Engine — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the risk_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/qfa-02-portfolio-var-engine.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/qfa-02-portfolio-var-engine.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Portfolio Covariance & VaR Engine — attested computation

> §10.2 Attested Computation binding for [Portfolio Covariance & VaR Engine](../tools/qfa-02-portfolio-var-engine.md).

## Executor

Kernel source: `chaingraph/kernels/qfa-02-portfolio-var-engine.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9051ffa2fd22d389890aa26c21be6f7d3f32a0da1de5ba47890946271487ebe3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
