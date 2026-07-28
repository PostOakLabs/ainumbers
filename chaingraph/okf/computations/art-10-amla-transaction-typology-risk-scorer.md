---
type: Attested Computation
title: "AMLA Transaction-Typology Risk Scorer — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the risk_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-10-amla-transaction-typology-risk-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-10-amla-transaction-typology-risk-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AMLA Transaction-Typology Risk Scorer — attested computation

> §10.2 Attested Computation binding for [AMLA Transaction-Typology Risk Scorer](../tools/art-10-amla-transaction-typology-risk-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-10-amla-transaction-typology-risk-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c02483af798b9da4593d70b071619e12487bbd02e21b016eb9d46ced84c5ab90` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
