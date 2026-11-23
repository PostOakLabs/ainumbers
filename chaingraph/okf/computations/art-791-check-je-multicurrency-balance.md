---
type: Attested Computation
title: "Multicurrency JE Balance Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-791-check-je-multicurrency-balance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-791-check-je-multicurrency-balance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Multicurrency JE Balance Check — attested computation

> §10.2 Attested Computation binding for [Multicurrency JE Balance Check](../tools/art-791-check-je-multicurrency-balance.md).

## Executor

Kernel source: `chaingraph/kernels/art-791-check-je-multicurrency-balance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5efbb74ddb2a6f6d072ccaa66ce2cf7c6d12c5f3be29925f4edb07ddc04efbb2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
