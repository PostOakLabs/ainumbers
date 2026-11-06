---
type: Attested Computation
title: "Ethereum Base Fee and Blob Base Fee Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/815-eth-fee-market.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/815-eth-fee-market.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Ethereum Base Fee and Blob Base Fee Recompute — attested computation

> §10.2 Attested Computation binding for [Ethereum Base Fee and Blob Base Fee Recompute](../tools/815-eth-fee-market.md).

## Executor

Kernel source: `chaingraph/kernels/815-eth-fee-market.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ece5f6ae119b18e933b9721f6a6a8c04bf77d3c998cf8c607f5c521dea771996` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
