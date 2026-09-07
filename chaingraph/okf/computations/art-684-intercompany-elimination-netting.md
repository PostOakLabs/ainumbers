---
type: Attested Computation
title: "Intercompany Elimination and Netting Workflow — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-684-intercompany-elimination-netting.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-684-intercompany-elimination-netting.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Intercompany Elimination and Netting Workflow — attested computation

> §10.2 Attested Computation binding for [Intercompany Elimination and Netting Workflow](../tools/art-684-intercompany-elimination-netting.md).

## Executor

Kernel source: `chaingraph/kernels/art-684-intercompany-elimination-netting.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:095706cb39c4376c2a3782381693f0cb72986cfd7fabe8cc894cef4d385aece3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
