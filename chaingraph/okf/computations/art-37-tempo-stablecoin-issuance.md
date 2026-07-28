---
type: Attested Computation
title: "Tempo Stablecoin Issuance Compliance — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-37-tempo-stablecoin-issuance.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-37-tempo-stablecoin-issuance.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo Stablecoin Issuance Compliance — attested computation

> §10.2 Attested Computation binding for [Tempo Stablecoin Issuance Compliance](../tools/art-37-tempo-stablecoin-issuance.md).

## Executor

Kernel source: `chaingraph/kernels/art-37-tempo-stablecoin-issuance.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:252b8f7b8a64ab8a59613d891c4849f52fdc3322a68a98de86dd032a2305f6ae` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
