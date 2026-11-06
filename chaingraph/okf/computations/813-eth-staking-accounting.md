---
type: Attested Computation
title: "Ethereum Epoch Accounting Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/813-eth-staking-accounting.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/813-eth-staking-accounting.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Ethereum Epoch Accounting Recompute — attested computation

> §10.2 Attested Computation binding for [Ethereum Epoch Accounting Recompute](../tools/813-eth-staking-accounting.md).

## Executor

Kernel source: `chaingraph/kernels/813-eth-staking-accounting.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3c67f800389a0cc0ff46a484c2793943fdc886a2d2f941562eb9eae23c90e52d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
