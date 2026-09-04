---
type: Attested Computation
title: "EBA IM-Model Validation Tracker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-674-eba-im-model-validation-tracker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-674-eba-im-model-validation-tracker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EBA IM-Model Validation Tracker — attested computation

> §10.2 Attested Computation binding for [EBA IM-Model Validation Tracker](../tools/art-674-eba-im-model-validation-tracker.md).

## Executor

Kernel source: `chaingraph/kernels/art-674-eba-im-model-validation-tracker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9521fc1f815df0bdd6252148037398a0d0eb75111936058c17e74a864b8ee999` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
