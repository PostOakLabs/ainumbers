---
type: Attested Computation
title: "Conditional-Relief Collateral Receipt — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-514-conditional-relief-collateral-receipt.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-514-conditional-relief-collateral-receipt.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Conditional-Relief Collateral Receipt — attested computation

> §10.2 Attested Computation binding for [Conditional-Relief Collateral Receipt](../tools/art-514-conditional-relief-collateral-receipt.md).

## Executor

Kernel source: `chaingraph/kernels/art-514-conditional-relief-collateral-receipt.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b4e574eae79a1ae5d3d37e79cb155af73e2d4d9a14b9e346737a1b9c144daefa` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
