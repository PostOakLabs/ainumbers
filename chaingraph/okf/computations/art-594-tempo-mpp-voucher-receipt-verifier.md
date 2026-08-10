---
type: Attested Computation
title: "Tempo MPP Voucher & Receipt Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-594-tempo-mpp-voucher-receipt-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-594-tempo-mpp-voucher-receipt-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo MPP Voucher & Receipt Verifier — attested computation

> §10.2 Attested Computation binding for [Tempo MPP Voucher & Receipt Verifier](../tools/art-594-tempo-mpp-voucher-receipt-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-594-tempo-mpp-voucher-receipt-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4db1842bc9f674ac0c7f1039f1226c4ce9e91ce798e02470bd81a6ee6302ce3b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
