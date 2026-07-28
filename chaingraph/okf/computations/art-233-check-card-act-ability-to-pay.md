---
type: Attested Computation
title: "Check CARD Act Ability to Pay — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-233-check-card-act-ability-to-pay.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-233-check-card-act-ability-to-pay.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Check CARD Act Ability to Pay — attested computation

> §10.2 Attested Computation binding for [Check CARD Act Ability to Pay](../tools/art-233-check-card-act-ability-to-pay.md).

## Executor

Kernel source: `chaingraph/kernels/art-233-check-card-act-ability-to-pay.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d86f9301b3835cd8d80c1ed5bfa8cc607bbeb1876e91b2482c16eb64316db228` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
