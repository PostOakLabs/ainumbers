---
type: Attested Computation
title: "M3P Monthly Cap Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-617-m3p-monthly-cap-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-617-m3p-monthly-cap-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# M3P Monthly Cap Calculator — attested computation

> §10.2 Attested Computation binding for [M3P Monthly Cap Calculator](../tools/art-617-m3p-monthly-cap-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-617-m3p-monthly-cap-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:de0f2c827ca03f8101c1cb008207a577cc171246ad97a09d1e966bb29c9efd38` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
