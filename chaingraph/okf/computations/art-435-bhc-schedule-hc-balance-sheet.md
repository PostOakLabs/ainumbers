---
type: Attested Computation
title: "FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-435-bhc-schedule-hc-balance-sheet.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-435-bhc-schedule-hc-balance-sheet.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper — attested computation

> §10.2 Attested Computation binding for [FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper](../tools/art-435-bhc-schedule-hc-balance-sheet.md).

## Executor

Kernel source: `chaingraph/kernels/art-435-bhc-schedule-hc-balance-sheet.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:82f0207a25a6122e68a398fa7e274529843c39c73a82287c072e77a414b0e7fe` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
