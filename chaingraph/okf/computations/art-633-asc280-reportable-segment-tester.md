---
type: Attested Computation
title: "ASC 280 Reportable Segment Tester — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-633-asc280-reportable-segment-tester.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-633-asc280-reportable-segment-tester.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ASC 280 Reportable Segment Tester — attested computation

> §10.2 Attested Computation binding for [ASC 280 Reportable Segment Tester](../tools/art-633-asc280-reportable-segment-tester.md).

## Executor

Kernel source: `chaingraph/kernels/art-633-asc280-reportable-segment-tester.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:861ca3919713e8e7e4d57042aa48f9399e5094c1f1abc550d686ea8c9fcc8487` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
