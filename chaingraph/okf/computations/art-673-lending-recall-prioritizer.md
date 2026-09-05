---
type: Attested Computation
title: "Lending Recall Prioritizer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-673-lending-recall-prioritizer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-673-lending-recall-prioritizer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Lending Recall Prioritizer — attested computation

> §10.2 Attested Computation binding for [Lending Recall Prioritizer](../tools/art-673-lending-recall-prioritizer.md).

## Executor

Kernel source: `chaingraph/kernels/art-673-lending-recall-prioritizer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:31d9a8356f9e3c350463c2c5b981a0d7bb78e11ba3d90412bb123ee4963b0719` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
