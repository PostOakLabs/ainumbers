---
type: Attested Computation
title: "Settlement-Asset Backing Invariant — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-521-settlement-asset-backing-invariant.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-521-settlement-asset-backing-invariant.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Settlement-Asset Backing Invariant — attested computation

> §10.2 Attested Computation binding for [Settlement-Asset Backing Invariant](../tools/art-521-settlement-asset-backing-invariant.md).

## Executor

Kernel source: `chaingraph/kernels/art-521-settlement-asset-backing-invariant.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d07edbf3cf5ae7efa033576efbe404b75df370bc3c2354e3ce083c943805f4e6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
