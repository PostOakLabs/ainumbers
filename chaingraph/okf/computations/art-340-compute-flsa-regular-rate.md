---
type: Attested Computation
title: "FLSA Regular Rate & Overtime Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-340-compute-flsa-regular-rate.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-340-compute-flsa-regular-rate.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FLSA Regular Rate & Overtime Calculator — attested computation

> §10.2 Attested Computation binding for [FLSA Regular Rate & Overtime Calculator](../tools/art-340-compute-flsa-regular-rate.md).

## Executor

Kernel source: `chaingraph/kernels/art-340-compute-flsa-regular-rate.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:dc00a21aac85481160cee3c24ff63e9fae0faace62668602b069aab28cb7a06a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
