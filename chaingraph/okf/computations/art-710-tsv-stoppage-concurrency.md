---
type: Attested Computation
title: "TSV Stoppage Concurrency — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-710-tsv-stoppage-concurrency.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-710-tsv-stoppage-concurrency.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TSV Stoppage Concurrency — attested computation

> §10.2 Attested Computation binding for [TSV Stoppage Concurrency](../tools/art-710-tsv-stoppage-concurrency.md).

## Executor

Kernel source: `chaingraph/kernels/art-710-tsv-stoppage-concurrency.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:50b06c5208854d0622f2454f8578b75ca6ec066405ff1afe74d0d529b30e7e8b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
