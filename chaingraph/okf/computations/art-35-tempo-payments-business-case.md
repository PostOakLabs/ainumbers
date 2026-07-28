---
type: Attested Computation
title: "Tempo Payments Business Case — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the treasury_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-35-tempo-payments-business-case.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-35-tempo-payments-business-case.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo Payments Business Case — attested computation

> §10.2 Attested Computation binding for [Tempo Payments Business Case](../tools/art-35-tempo-payments-business-case.md).

## Executor

Kernel source: `chaingraph/kernels/art-35-tempo-payments-business-case.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:983a22594a38514987c18253d6efe800adb9ffb96148357f3deb80975f46837c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
