---
type: Attested Computation
title: "Fuzzy-Match Calibration Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-93-fuzzy-match-calibration-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-93-fuzzy-match-calibration-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Fuzzy-Match Calibration Scorer — attested computation

> §10.2 Attested Computation binding for [Fuzzy-Match Calibration Scorer](../tools/art-93-fuzzy-match-calibration-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-93-fuzzy-match-calibration-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:280862d6b27e8364c05290b99e446bb8938364dc1c03fb90835464743ef0cdc8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
