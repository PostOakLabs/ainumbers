---
type: Attested Computation
title: "Story PIL Flavor Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-197-pil-flavor-mapper.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-197-pil-flavor-mapper.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Story PIL Flavor Mapper — attested computation

> §10.2 Attested Computation binding for [Story PIL Flavor Mapper](../tools/art-197-pil-flavor-mapper.md).

## Executor

Kernel source: `chaingraph/kernels/art-197-pil-flavor-mapper.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:59ffd31eb91e148f5ffd33a6d7d396cef95c7f55035d3cbe8e8c0457f2cb58ea` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
