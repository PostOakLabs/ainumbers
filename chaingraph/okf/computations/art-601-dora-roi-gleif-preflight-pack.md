---
type: Attested Computation
title: "Dora Roi Gleif Preflight Pack — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-601-dora-roi-gleif-preflight-pack.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-601-dora-roi-gleif-preflight-pack.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Dora Roi Gleif Preflight Pack — attested computation

> §10.2 Attested Computation binding for [Dora Roi Gleif Preflight Pack](../tools/art-601-dora-roi-gleif-preflight-pack.md).

## Executor

Kernel source: `chaingraph/kernels/art-601-dora-roi-gleif-preflight-pack.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bf3d3052e3888bced6a3528b63c51fffe36755a4e6d970720d62c04f4443438c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
