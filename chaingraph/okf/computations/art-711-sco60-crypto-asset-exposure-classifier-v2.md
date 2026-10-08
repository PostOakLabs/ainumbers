---
type: Attested Computation
title: "SCO60 Group 2 Exposure Limit V2 — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-711-sco60-crypto-asset-exposure-classifier-v2.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-711-sco60-crypto-asset-exposure-classifier-v2.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SCO60 Group 2 Exposure Limit V2 — attested computation

> §10.2 Attested Computation binding for [SCO60 Group 2 Exposure Limit V2](../tools/art-711-sco60-crypto-asset-exposure-classifier-v2.md).

## Executor

Kernel source: `chaingraph/kernels/art-711-sco60-crypto-asset-exposure-classifier-v2.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5627f00323bc2806d95cc61771090e8d3ff31a943cb31b8a145a7dda8fdad419` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
