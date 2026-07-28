---
type: Attested Computation
title: "A2A x402-Extension Mandate Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-31-a2a-x402-extension-mandate-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-31-a2a-x402-extension-mandate-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# A2A x402-Extension Mandate Validator — attested computation

> §10.2 Attested Computation binding for [A2A x402-Extension Mandate Validator](../tools/art-31-a2a-x402-extension-mandate-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-31-a2a-x402-extension-mandate-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8136ed46e50029be28e18bd1ec82e60c057b1b12a749df5dc4f847a012b5dddf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
