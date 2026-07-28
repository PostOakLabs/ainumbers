---
type: Attested Computation
title: "ERISA Form 5500 Schedule Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-401-validate-form5500-schedules.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-401-validate-form5500-schedules.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERISA Form 5500 Schedule Validator — attested computation

> §10.2 Attested Computation binding for [ERISA Form 5500 Schedule Validator](../tools/art-401-validate-form5500-schedules.md).

## Executor

Kernel source: `chaingraph/kernels/art-401-validate-form5500-schedules.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:69b7a4767ea76f50dcf221f85f8edb02f48c36b00cf3ec3419be9ad99e00b2f4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
