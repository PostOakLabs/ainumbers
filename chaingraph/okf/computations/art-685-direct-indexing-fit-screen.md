---
type: Attested Computation
title: "Direct Indexing Fit Screen — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-685-direct-indexing-fit-screen.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-685-direct-indexing-fit-screen.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Direct Indexing Fit Screen — attested computation

> §10.2 Attested Computation binding for [Direct Indexing Fit Screen](../tools/art-685-direct-indexing-fit-screen.md).

## Executor

Kernel source: `chaingraph/kernels/art-685-direct-indexing-fit-screen.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8bebade7234612a0a224757aa6c635ee00c4ff33248ddf6f4163cec2186cef6e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
