---
type: Attested Computation
title: "Credit Concentration Top-N / Sector Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-445-credit-concentration-topn-sector.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-445-credit-concentration-topn-sector.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Credit Concentration Top-N / Sector Checker — attested computation

> §10.2 Attested Computation binding for [Credit Concentration Top-N / Sector Checker](../tools/art-445-credit-concentration-topn-sector.md).

## Executor

Kernel source: `chaingraph/kernels/art-445-credit-concentration-topn-sector.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2c48c891970145492a64a3005f4756cbe485a5a8f04738cc43b59eea9453bb0b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
