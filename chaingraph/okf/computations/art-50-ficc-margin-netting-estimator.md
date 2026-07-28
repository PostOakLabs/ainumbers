---
type: Attested Computation
title: "FICC Margin & Netting Estimator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-50-ficc-margin-netting-estimator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-50-ficc-margin-netting-estimator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FICC Margin & Netting Estimator — attested computation

> §10.2 Attested Computation binding for [FICC Margin & Netting Estimator](../tools/art-50-ficc-margin-netting-estimator.md).

## Executor

Kernel source: `chaingraph/kernels/art-50-ficc-margin-netting-estimator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fcea3a670c5ee043f842757592ea575bbe5426b8f825016d4ec0c0d18d2e304b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
