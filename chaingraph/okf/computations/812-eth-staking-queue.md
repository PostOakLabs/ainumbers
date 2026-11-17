---
type: Attested Computation
title: "Ethereum Validator Queue and Sweep Wait — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/812-eth-staking-queue.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/812-eth-staking-queue.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Ethereum Validator Queue and Sweep Wait — attested computation

> §10.2 Attested Computation binding for [Ethereum Validator Queue and Sweep Wait](../tools/812-eth-staking-queue.md).

## Executor

Kernel source: `chaingraph/kernels/812-eth-staking-queue.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:572c5fe067f787dfd04db12afdff90642261ea262745766d1989302747979106` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
