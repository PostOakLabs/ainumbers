---
type: Attested Computation
title: "AP Concentration + Redemption-Path Stress — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-322-rhc-ap-redemption-stress.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-322-rhc-ap-redemption-stress.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AP Concentration + Redemption-Path Stress — attested computation

> §10.2 Attested Computation binding for [AP Concentration + Redemption-Path Stress](../tools/art-322-rhc-ap-redemption-stress.md).

## Executor

Kernel source: `chaingraph/kernels/art-322-rhc-ap-redemption-stress.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:043b1b5c17986181cd446d5ffa5594209cc4cf4e29416c72e3a47a436160ea2d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
