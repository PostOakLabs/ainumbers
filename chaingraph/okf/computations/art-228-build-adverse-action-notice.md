---
type: Attested Computation
title: "Build Adverse Action Notice — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-228-build-adverse-action-notice.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-228-build-adverse-action-notice.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Build Adverse Action Notice — attested computation

> §10.2 Attested Computation binding for [Build Adverse Action Notice](../tools/art-228-build-adverse-action-notice.md).

## Executor

Kernel source: `chaingraph/kernels/art-228-build-adverse-action-notice.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bfe3703cd0865de7a9b879deac13cfa62aa8fdd55eab3348fa8ddc4570a11df1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
