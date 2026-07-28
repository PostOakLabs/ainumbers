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

Kernel identity: `sha256:224b7fe562fe4671cc165a1228afc28e82d8abbdfc5ec4c9e93ee480e50587a5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
