---
type: Attested Computation
title: "TRID Fee Tolerance and Cure — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-216-trid-tolerance-cure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-216-trid-tolerance-cure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TRID Fee Tolerance and Cure — attested computation

> §10.2 Attested Computation binding for [TRID Fee Tolerance and Cure](../tools/art-216-trid-tolerance-cure.md).

## Executor

Kernel source: `chaingraph/kernels/art-216-trid-tolerance-cure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a14561c3b546632ff5be0fb5ede6be4eb9476a72fab5dde8ed67075849b3c16f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
