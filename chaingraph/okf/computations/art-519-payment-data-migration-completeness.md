---
type: Attested Computation
title: "Payment Data Migration Completeness — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-519-payment-data-migration-completeness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-519-payment-data-migration-completeness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Payment Data Migration Completeness — attested computation

> §10.2 Attested Computation binding for [Payment Data Migration Completeness](../tools/art-519-payment-data-migration-completeness.md).

## Executor

Kernel source: `chaingraph/kernels/art-519-payment-data-migration-completeness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d9e4f0984fd3d85463ece41f052a47bf3b98fed2df72e38ab131273cacd5d587` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
