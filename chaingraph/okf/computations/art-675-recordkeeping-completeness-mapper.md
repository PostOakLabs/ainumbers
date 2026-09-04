---
type: Attested Computation
title: "Recordkeeping Completeness Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-675-recordkeeping-completeness-mapper.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-675-recordkeeping-completeness-mapper.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Recordkeeping Completeness Mapper — attested computation

> §10.2 Attested Computation binding for [Recordkeeping Completeness Mapper](../tools/art-675-recordkeeping-completeness-mapper.md).

## Executor

Kernel source: `chaingraph/kernels/art-675-recordkeeping-completeness-mapper.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:135e6d5e8ef30c3c6d18890b02e8ca948329ac77ab58bb3768d8f7340c973990` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
