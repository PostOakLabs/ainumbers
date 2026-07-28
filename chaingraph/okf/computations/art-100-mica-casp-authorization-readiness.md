---
type: Attested Computation
title: "CASP Authorization-Readiness Assessor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-100-mica-casp-authorization-readiness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-100-mica-casp-authorization-readiness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CASP Authorization-Readiness Assessor — attested computation

> §10.2 Attested Computation binding for [CASP Authorization-Readiness Assessor](../tools/art-100-mica-casp-authorization-readiness.md).

## Executor

Kernel source: `chaingraph/kernels/art-100-mica-casp-authorization-readiness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:83af4fb729adb2375b158401895030ed23a4469569312c67aa80c1240640c70e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
