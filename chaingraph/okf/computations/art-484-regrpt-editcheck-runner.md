---
type: Attested Computation
title: "Published Regulatory Report Edit-Check Runner — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-484-regrpt-editcheck-runner.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-484-regrpt-editcheck-runner.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Published Regulatory Report Edit-Check Runner — attested computation

> §10.2 Attested Computation binding for [Published Regulatory Report Edit-Check Runner](../tools/art-484-regrpt-editcheck-runner.md).

## Executor

Kernel source: `chaingraph/kernels/art-484-regrpt-editcheck-runner.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:df972fbe752ce9681f083d26e59d2620a3b3675aea04b2d046537d4d5861154a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
