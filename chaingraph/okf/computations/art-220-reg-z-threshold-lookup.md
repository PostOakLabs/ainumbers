---
type: Attested Computation
title: "Reg Z Threshold Lookup — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-220-reg-z-threshold-lookup.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-220-reg-z-threshold-lookup.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Reg Z Threshold Lookup — attested computation

> §10.2 Attested Computation binding for [Reg Z Threshold Lookup](../tools/art-220-reg-z-threshold-lookup.md).

## Executor

Kernel source: `chaingraph/kernels/art-220-reg-z-threshold-lookup.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d8b0d25c1f2ec5d46b13155ce06213c2bbb4d4749903d18d3777adffeaf5a392` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
