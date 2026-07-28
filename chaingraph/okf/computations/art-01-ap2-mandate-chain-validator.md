---
type: Attested Computation
title: "AP2 Mandate-Chain Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-01-ap2-mandate-chain-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-01-ap2-mandate-chain-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AP2 Mandate-Chain Validator — attested computation

> §10.2 Attested Computation binding for [AP2 Mandate-Chain Validator](../tools/art-01-ap2-mandate-chain-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-01-ap2-mandate-chain-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:623495f9378cb65cb88c889831f43c2c82c8844af29dfaa32e3a5d1e6cfa5337` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
