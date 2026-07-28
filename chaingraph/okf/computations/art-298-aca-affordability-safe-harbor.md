---
type: Attested Computation
title: "ACA Affordability Safe-Harbor Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-298-aca-affordability-safe-harbor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-298-aca-affordability-safe-harbor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ACA Affordability Safe-Harbor Calculator — attested computation

> §10.2 Attested Computation binding for [ACA Affordability Safe-Harbor Calculator](../tools/art-298-aca-affordability-safe-harbor.md).

## Executor

Kernel source: `chaingraph/kernels/art-298-aca-affordability-safe-harbor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:517e7ad37c5723b7df461c5830be597d989342422f3c60cad22e15cdcd8d7695` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
