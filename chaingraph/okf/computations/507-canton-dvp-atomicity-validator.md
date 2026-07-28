---
type: Attested Computation
title: "Canton DvP Atomicity Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/507-canton-dvp-atomicity-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/507-canton-dvp-atomicity-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Canton DvP Atomicity Validator — attested computation

> §10.2 Attested Computation binding for [Canton DvP Atomicity Validator](../tools/507-canton-dvp-atomicity-validator.md).

## Executor

Kernel source: `chaingraph/kernels/507-canton-dvp-atomicity-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e8b30471c1feafecb89b5283df71ad9b4f2aeafe3b4606af46ae14e48849f55c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
