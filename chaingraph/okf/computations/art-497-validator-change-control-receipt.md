---
type: Attested Computation
title: "Validator Change-Control Receipt — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-497-validator-change-control-receipt.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-497-validator-change-control-receipt.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Validator Change-Control Receipt — attested computation

> §10.2 Attested Computation binding for [Validator Change-Control Receipt](../tools/art-497-validator-change-control-receipt.md).

## Executor

Kernel source: `chaingraph/kernels/art-497-validator-change-control-receipt.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:dc2fd0401a33be9a8facce69b9973dd015445c249cdc58410366c2a7ea3c5751` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
