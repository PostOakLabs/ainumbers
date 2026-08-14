---
type: Attested Computation
title: "ERC-4337 UserOperation Math — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-613-erc4337-userop-math.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-613-erc4337-userop-math.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERC-4337 UserOperation Math — attested computation

> §10.2 Attested Computation binding for [ERC-4337 UserOperation Math](../tools/art-613-erc4337-userop-math.md).

## Executor

Kernel source: `chaingraph/kernels/art-613-erc4337-userop-math.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5590e940c1c036d108e0bfb8662b88bdfec6c275cc55843ac2a9f14cd0c78ba9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
