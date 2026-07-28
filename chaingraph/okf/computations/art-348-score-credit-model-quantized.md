---
type: Attested Computation
title: "Quantized Credit Model Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the credit_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-348-score-credit-model-quantized.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-348-score-credit-model-quantized.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Quantized Credit Model Scorer — attested computation

> §10.2 Attested Computation binding for [Quantized Credit Model Scorer](../tools/art-348-score-credit-model-quantized.md).

## Executor

Kernel source: `chaingraph/kernels/art-348-score-credit-model-quantized.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:dc6397d80f24256dca54268da76455d52adbc30581facc329dbec8aa51fbefeb` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
