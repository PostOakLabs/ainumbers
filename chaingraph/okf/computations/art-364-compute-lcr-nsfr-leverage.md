---
type: Attested Computation
title: "LCR / NSFR / Leverage Ratio Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-364-compute-lcr-nsfr-leverage.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-364-compute-lcr-nsfr-leverage.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# LCR / NSFR / Leverage Ratio Calculator — attested computation

> §10.2 Attested Computation binding for [LCR / NSFR / Leverage Ratio Calculator](../tools/art-364-compute-lcr-nsfr-leverage.md).

## Executor

Kernel source: `chaingraph/kernels/art-364-compute-lcr-nsfr-leverage.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:168029eb2a2ece66535b95015170c82a1babc5d499325845f30b73065fedb204` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
