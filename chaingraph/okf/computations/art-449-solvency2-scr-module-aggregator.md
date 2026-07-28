---
type: Attested Computation
title: "Solvency II SCR Standard-Formula Module Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-449-solvency2-scr-module-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-449-solvency2-scr-module-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Solvency II SCR Standard-Formula Module Aggregator — attested computation

> §10.2 Attested Computation binding for [Solvency II SCR Standard-Formula Module Aggregator](../tools/art-449-solvency2-scr-module-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/art-449-solvency2-scr-module-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:484b5640fddbb90b1bdecd2a7f4e9023d17cef27245c21ed1f726cbf1f30e0a4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
