---
type: Attested Computation
title: "Tempo On-Chain AML & Travel Rule Screener — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the aml_rule decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-38-tempo-onchain-aml.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-38-tempo-onchain-aml.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo On-Chain AML & Travel Rule Screener — attested computation

> §10.2 Attested Computation binding for [Tempo On-Chain AML & Travel Rule Screener](../tools/art-38-tempo-onchain-aml.md).

## Executor

Kernel source: `chaingraph/kernels/art-38-tempo-onchain-aml.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:9e0872728a1ce51e8fe58bb13bec82cc382a97584cd3fb9517db6f621072bbc7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
