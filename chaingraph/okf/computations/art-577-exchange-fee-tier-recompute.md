---
type: Attested Computation
title: "Exchange Access-Fee / Maker-Taker Tier Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-577-exchange-fee-tier-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-577-exchange-fee-tier-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Exchange Access-Fee / Maker-Taker Tier Recompute — attested computation

> §10.2 Attested Computation binding for [Exchange Access-Fee / Maker-Taker Tier Recompute](../tools/art-577-exchange-fee-tier-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-577-exchange-fee-tier-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:caed451dceca161ee2dd898a0aee48ceeaee497d39ac0eab2963ebad4437f5d8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
