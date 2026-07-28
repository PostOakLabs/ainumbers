---
type: Attested Computation
title: "DSCSA Suspect/Illegitimate Product Quarantine Assessor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-114-suspect-product-quarantine.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-114-suspect-product-quarantine.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# DSCSA Suspect/Illegitimate Product Quarantine Assessor — attested computation

> §10.2 Attested Computation binding for [DSCSA Suspect/Illegitimate Product Quarantine Assessor](../tools/art-114-suspect-product-quarantine.md).

## Executor

Kernel source: `chaingraph/kernels/art-114-suspect-product-quarantine.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:69c6f567735fc1a35f728f1f226793ff94b9664813a2c9dfbcfe3569c93f1ed6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
