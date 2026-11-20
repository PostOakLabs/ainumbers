---
type: Attested Computation
title: "x402 Exact Solana Payment Outcome Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-781-x402-svm-payment-outcome.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-781-x402-svm-payment-outcome.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Exact Solana Payment Outcome Recompute — attested computation

> §10.2 Attested Computation binding for [x402 Exact Solana Payment Outcome Recompute](../tools/art-781-x402-svm-payment-outcome.md).

## Executor

Kernel source: `chaingraph/kernels/art-781-x402-svm-payment-outcome.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4f5bae2b41de82ece147ef21e0f3947d10a0c85aec0af7fb420ee8b87202759c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
