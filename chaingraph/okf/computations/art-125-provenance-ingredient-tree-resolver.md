---
type: Attested Computation
title: "Provenance Ingredient Tree Resolver — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-125-provenance-ingredient-tree-resolver.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-125-provenance-ingredient-tree-resolver.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Provenance Ingredient Tree Resolver — attested computation

> §10.2 Attested Computation binding for [Provenance Ingredient Tree Resolver](../tools/art-125-provenance-ingredient-tree-resolver.md).

## Executor

Kernel source: `chaingraph/kernels/art-125-provenance-ingredient-tree-resolver.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7bae0dc529d7955478c147173fb20c3a752a9964162b83434abc62521887e527` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
