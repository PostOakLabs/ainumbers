---
type: Attested Computation
title: "Sukuk Tradability Composition — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-854-sukuk-tradability-composition.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-854-sukuk-tradability-composition.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Sukuk Tradability Composition — attested computation

> §10.2 Attested Computation binding for [Sukuk Tradability Composition](../tools/art-854-sukuk-tradability-composition.md).

## Executor

Kernel source: `chaingraph/kernels/art-854-sukuk-tradability-composition.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1ce8d3adda42aeec33ed0bdc89246fdcbac71604f0558dac2287e5bc1d020415` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
