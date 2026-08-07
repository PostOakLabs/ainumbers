---
type: Attested Computation
title: "Lease Schedule Recompute — ASC 842 / IFRS 16 — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-571-lease-schedule-recompute-asc842-ifrs16.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-571-lease-schedule-recompute-asc842-ifrs16.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Lease Schedule Recompute — ASC 842 / IFRS 16 — attested computation

> §10.2 Attested Computation binding for [Lease Schedule Recompute — ASC 842 / IFRS 16](../tools/art-571-lease-schedule-recompute-asc842-ifrs16.md).

## Executor

Kernel source: `chaingraph/kernels/art-571-lease-schedule-recompute-asc842-ifrs16.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1a566e2d4a8d4a189f06af50533cfa35d5b37c69090587830c7dbffe07c1d9ed` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
