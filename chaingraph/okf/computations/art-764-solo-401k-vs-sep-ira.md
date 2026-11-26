---
type: Attested Computation
title: "Solo 401(k) vs. SEP-IRA Optimizer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compensation_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-764-solo-401k-vs-sep-ira.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-764-solo-401k-vs-sep-ira.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Solo 401(k) vs. SEP-IRA Optimizer — attested computation

> §10.2 Attested Computation binding for [Solo 401(k) vs. SEP-IRA Optimizer](../tools/art-764-solo-401k-vs-sep-ira.md).

## Executor

Kernel source: `chaingraph/kernels/art-764-solo-401k-vs-sep-ira.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2832967e017299fa4023575d5b141110985215f4da2bb9d6e4a10be38ffb8186` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
