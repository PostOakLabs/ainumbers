---
type: Attested Computation
title: "Validate Adverse Action Notice — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-227-validate-adverse-action-notice.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-227-validate-adverse-action-notice.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Validate Adverse Action Notice — attested computation

> §10.2 Attested Computation binding for [Validate Adverse Action Notice](../tools/art-227-validate-adverse-action-notice.md).

## Executor

Kernel source: `chaingraph/kernels/art-227-validate-adverse-action-notice.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:68a2b118857650ebe9fb5729f49dad91a524e942c1634d0ac6b6e7997dd2a667` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
