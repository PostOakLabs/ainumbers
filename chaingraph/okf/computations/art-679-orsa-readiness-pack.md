---
type: Attested Computation
title: "ORSA Readiness Pack — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-679-orsa-readiness-pack.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-679-orsa-readiness-pack.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ORSA Readiness Pack — attested computation

> §10.2 Attested Computation binding for [ORSA Readiness Pack](../tools/art-679-orsa-readiness-pack.md).

## Executor

Kernel source: `chaingraph/kernels/art-679-orsa-readiness-pack.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1dc812c6c0a705895c7f5cc8c6a10acd3ba2d7d30d833fa04ebffa55ac5d2e93` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
