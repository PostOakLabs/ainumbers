---
type: Attested Computation
title: "Valuation Double-Count / Decimal Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-319-rhc-valuation-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-319-rhc-valuation-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Valuation Double-Count / Decimal Linter — attested computation

> §10.2 Attested Computation binding for [Valuation Double-Count / Decimal Linter](../tools/art-319-rhc-valuation-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-319-rhc-valuation-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1b2549c6c23eeff309d070117288897e871490b446375f87875bd6d973e25a31` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
