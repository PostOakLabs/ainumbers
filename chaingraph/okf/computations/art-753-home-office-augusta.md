---
type: Attested Computation
title: "Home Office and Augusta Rule — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the home_office_augusta_record decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-753-home-office-augusta.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-753-home-office-augusta.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Home Office and Augusta Rule — attested computation

> §10.2 Attested Computation binding for [Home Office and Augusta Rule](../tools/art-753-home-office-augusta.md).

## Executor

Kernel source: `chaingraph/kernels/art-753-home-office-augusta.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6d83f8dc0cf5f4459dea7103f7ef5666695670004ec94a3efba9dcf4d0edc3b1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
