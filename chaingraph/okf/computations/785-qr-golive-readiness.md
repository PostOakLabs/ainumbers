---
type: Attested Computation
title: "QR Go-Live Readiness Assessor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/785-qr-golive-readiness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/785-qr-golive-readiness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# QR Go-Live Readiness Assessor — attested computation

> §10.2 Attested Computation binding for [QR Go-Live Readiness Assessor](../tools/785-qr-golive-readiness.md).

## Executor

Kernel source: `chaingraph/kernels/785-qr-golive-readiness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b58f3a1db322c0acaf1938fc79d763d616f6143c5806a4cfa456fbf285cd2ecc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
