---
type: Attested Computation
title: "Options Greeks Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/qfa-01-options-greeks.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/qfa-01-options-greeks.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Options Greeks Calculator — attested computation

> §10.2 Attested Computation binding for [Options Greeks Calculator](../tools/qfa-01-options-greeks.md).

## Executor

Kernel source: `chaingraph/kernels/qfa-01-options-greeks.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:85150b0c10d583588c0584d76ea17a3378c4a1af666c1c700db412574c42587b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
