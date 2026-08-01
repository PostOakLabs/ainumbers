---
type: Attested Computation
title: "IDV/KYC Session Evidence Receipt Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-359-idv-session-receipt-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-359-idv-session-receipt-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IDV/KYC Session Evidence Receipt Builder — attested computation

> §10.2 Attested Computation binding for [IDV/KYC Session Evidence Receipt Builder](../tools/art-359-idv-session-receipt-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-359-idv-session-receipt-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7536fd33a1939b2ccca8c639a235de97b52d53a4897d621ce3a6af1218aae4a5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
