---
type: Attested Computation
title: "Sanctions Screening-Program Quality Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-97-sanctions-screening-quality-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-97-sanctions-screening-quality-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Sanctions Screening-Program Quality Scorer — attested computation

> §10.2 Attested Computation binding for [Sanctions Screening-Program Quality Scorer](../tools/art-97-sanctions-screening-quality-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-97-sanctions-screening-quality-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2e0ba6416081ea51d9652a6c147199662063a9ba489b68691dc07d76f0701983` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
