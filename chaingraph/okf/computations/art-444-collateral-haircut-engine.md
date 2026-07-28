---
type: Attested Computation
title: "Collateral Haircut Engine (Basel CRE22) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-444-collateral-haircut-engine.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-444-collateral-haircut-engine.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Collateral Haircut Engine (Basel CRE22) — attested computation

> §10.2 Attested Computation binding for [Collateral Haircut Engine (Basel CRE22)](../tools/art-444-collateral-haircut-engine.md).

## Executor

Kernel source: `chaingraph/kernels/art-444-collateral-haircut-engine.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1d708d8172b54b003ff2da60df4711a8999f6e0d8f327a28ef3538e1eae84cb7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
