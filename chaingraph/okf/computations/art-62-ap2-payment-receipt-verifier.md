---
type: Attested Computation
title: "AP2 PaymentReceipt Verifier & HNP Guardrail — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-62-ap2-payment-receipt-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-62-ap2-payment-receipt-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AP2 PaymentReceipt Verifier & HNP Guardrail — attested computation

> §10.2 Attested Computation binding for [AP2 PaymentReceipt Verifier & HNP Guardrail](../tools/art-62-ap2-payment-receipt-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-62-ap2-payment-receipt-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ca4201c7c2cff9069746a1e76dc3f53f390845654f2049dfb8769857a7ae12b9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
