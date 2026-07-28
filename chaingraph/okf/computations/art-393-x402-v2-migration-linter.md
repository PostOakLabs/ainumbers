---
type: Attested Computation
title: "x402 v2 Wire-Format Migration Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-393-x402-v2-migration-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-393-x402-v2-migration-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 v2 Wire-Format Migration Linter — attested computation

> §10.2 Attested Computation binding for [x402 v2 Wire-Format Migration Linter](../tools/art-393-x402-v2-migration-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-393-x402-v2-migration-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fdb16b08532bdd3b1513e88aa97cb133f64c2ea0d04d8b0556107a2d0e95caac` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
