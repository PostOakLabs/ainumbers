---
type: Attested Computation
title: "Model Outcome-Analysis Comparison — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-451-model-outcome-analysis.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-451-model-outcome-analysis.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Model Outcome-Analysis Comparison — attested computation

> §10.2 Attested Computation binding for [Model Outcome-Analysis Comparison](../tools/art-451-model-outcome-analysis.md).

## Executor

Kernel source: `chaingraph/kernels/art-451-model-outcome-analysis.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0109055fc8041ae9b972ed952fe72e0763d5a5ae8b30ff92ef63886e762d102f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
