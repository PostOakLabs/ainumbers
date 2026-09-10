---
type: Attested Computation
title: "Overdraft / NSF Fee Recomputation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-662-odnsf-fee-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Overdraft / NSF Fee Recomputation — attested computation

> §10.2 Attested Computation binding for [Overdraft / NSF Fee Recomputation](../tools/art-662-odnsf-fee-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-662-odnsf-fee-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:08217afde2dfb95ca1d609a0f728de20f5c0786e6784d47b79847984109622a3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
