---
type: Attested Computation
title: "CBOM Structural Lint & CNSA-2.0 Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-386-lint-cbom-structure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-386-lint-cbom-structure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CBOM Structural Lint & CNSA-2.0 Classifier — attested computation

> §10.2 Attested Computation binding for [CBOM Structural Lint & CNSA-2.0 Classifier](../tools/art-386-lint-cbom-structure.md).

## Executor

Kernel source: `chaingraph/kernels/art-386-lint-cbom-structure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d82c9dafda429dc646d851ed45d680724fa9e2d9c308b29e2d9a6ac10f24c257` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
