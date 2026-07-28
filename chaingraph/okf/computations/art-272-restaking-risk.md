---
type: Attested Computation
title: "Restaking Delegation and Slashing Risk Analyzer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-272-restaking-risk.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-272-restaking-risk.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Restaking Delegation and Slashing Risk Analyzer — attested computation

> §10.2 Attested Computation binding for [Restaking Delegation and Slashing Risk Analyzer](../tools/art-272-restaking-risk.md).

## Executor

Kernel source: `chaingraph/kernels/art-272-restaking-risk.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fa0c0c6dff1a33577f8de9a44bbd6c3d35d4a2d544a0d9f83ed9c1635870b792` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
