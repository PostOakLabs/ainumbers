---
type: Attested Computation
title: "Private-Input NAIC RBC Action Level — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-414-compute-rbc-action-level-private.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-414-compute-rbc-action-level-private.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Private-Input NAIC RBC Action Level — attested computation

> §10.2 Attested Computation binding for [Private-Input NAIC RBC Action Level](../tools/art-414-compute-rbc-action-level-private.md).

## Executor

Kernel source: `chaingraph/kernels/art-414-compute-rbc-action-level-private.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f2beca9ef027189ddc810d8ad3f1f3fb2105ee53a8a4e810241c8ca132b5194a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
