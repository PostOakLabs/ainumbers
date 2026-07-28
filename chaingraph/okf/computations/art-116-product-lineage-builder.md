---
type: Attested Computation
title: "Digital Product Passport Cradle-to-Gate Lineage Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-116-product-lineage-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-116-product-lineage-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Digital Product Passport Cradle-to-Gate Lineage Builder — attested computation

> §10.2 Attested Computation binding for [Digital Product Passport Cradle-to-Gate Lineage Builder](../tools/art-116-product-lineage-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-116-product-lineage-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c90285303f490a09ce2e73fc197bc99fb23ca31e2db96426f18f373ba021c574` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
