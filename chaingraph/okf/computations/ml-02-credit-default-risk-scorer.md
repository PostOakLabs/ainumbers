---
type: Attested Computation
title: "Credit Default Risk Scorer — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the credit_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/ml-02-credit-default-risk-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/ml-02-credit-default-risk-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Credit Default Risk Scorer — attested computation

> §10.2 Attested Computation binding for [Credit Default Risk Scorer](../tools/ml-02-credit-default-risk-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/ml-02-credit-default-risk-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a2933b0418c10f52d341cae29d664e594f88937aa4ad42187f95eaf86af9bb2f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
