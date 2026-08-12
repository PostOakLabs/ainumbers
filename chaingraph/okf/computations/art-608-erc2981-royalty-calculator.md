---
type: Attested Computation
title: "ERC-2981 Royalty Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-608-erc2981-royalty-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-608-erc2981-royalty-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-2981 Royalty Calculator — attested computation

> §10.2 Attested Computation binding for [ERC-2981 Royalty Calculator](../tools/art-608-erc2981-royalty-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-608-erc2981-royalty-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c573de67d9322a020f559748f9321e33213cedf75800b73729610cbe6cec2a94` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
