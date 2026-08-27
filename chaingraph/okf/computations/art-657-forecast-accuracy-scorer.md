---
type: Attested Computation
title: "Forecast Accuracy Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the forecast_accuracy_score decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-657-forecast-accuracy-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-657-forecast-accuracy-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Forecast Accuracy Scorer — attested computation

> §10.2 Attested Computation binding for [Forecast Accuracy Scorer](../tools/art-657-forecast-accuracy-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-657-forecast-accuracy-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a7c7fea4d39eb6d60198c64f6962b3687998c5b72b72f5957c229074c54df8a6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
