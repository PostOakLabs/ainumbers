---
type: Attested Computation
title: "Canton Synchronizer Traffic-Cost Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-391-compute-canton-traffic-cost.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-391-compute-canton-traffic-cost.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Canton Synchronizer Traffic-Cost Calculator — attested computation

> §10.2 Attested Computation binding for [Canton Synchronizer Traffic-Cost Calculator](../tools/art-391-compute-canton-traffic-cost.md).

## Executor

Kernel source: `chaingraph/kernels/art-391-compute-canton-traffic-cost.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c712461e3738d99efd948256b9a9bf6a56f0c3c18aeca6685fb4acad40be39be` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
