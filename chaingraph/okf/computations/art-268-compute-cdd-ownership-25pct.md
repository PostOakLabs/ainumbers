---
type: Attested Computation
title: "FinCEN CDD 25% Beneficial Ownership Attribution — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-268-compute-cdd-ownership-25pct.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-268-compute-cdd-ownership-25pct.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FinCEN CDD 25% Beneficial Ownership Attribution — attested computation

> §10.2 Attested Computation binding for [FinCEN CDD 25% Beneficial Ownership Attribution](../tools/art-268-compute-cdd-ownership-25pct.md).

## Executor

Kernel source: `chaingraph/kernels/art-268-compute-cdd-ownership-25pct.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:642fc536fb114413087309fee7485f146927deeabb3ad8e9eac8e3bf98f5d36a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
