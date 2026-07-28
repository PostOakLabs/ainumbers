---
type: Attested Computation
title: "FDIC Deposit-Insurance Assessment Rate Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-431-fdic-assessment-rate-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-431-fdic-assessment-rate-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FDIC Deposit-Insurance Assessment Rate Calculator — attested computation

> §10.2 Attested Computation binding for [FDIC Deposit-Insurance Assessment Rate Calculator](../tools/art-431-fdic-assessment-rate-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-431-fdic-assessment-rate-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b1df1b03484fa6c52ac635f0e59f3d0c3f8d2fade923f4ad223a7d39202d1e26` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
