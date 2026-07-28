---
type: Attested Computation
title: "Cross-Border Payment Prevalidation Readiness Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-247-prevalidation-readiness-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-247-prevalidation-readiness-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Cross-Border Payment Prevalidation Readiness Scorer — attested computation

> §10.2 Attested Computation binding for [Cross-Border Payment Prevalidation Readiness Scorer](../tools/art-247-prevalidation-readiness-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-247-prevalidation-readiness-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5474f7090f70ee2ec83b77349b3e6a1aa511bfb76c6e43c9b8972f5556b752c7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
