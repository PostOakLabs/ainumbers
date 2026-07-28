---
type: Attested Computation
title: "Canton Tokenization Readiness Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the readiness_diagnostic decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/503-canton-tokenization-readiness-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/503-canton-tokenization-readiness-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Canton Tokenization Readiness Diagnostic — attested computation

> §10.2 Attested Computation binding for [Canton Tokenization Readiness Diagnostic](../tools/503-canton-tokenization-readiness-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/503-canton-tokenization-readiness-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cd83aaa98a7055cdc55b74bf14d81e559e4797625a9796e5d8deaa43a9021157` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
