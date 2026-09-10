---
type: Attested Computation
title: "Derivatives Margin Workbench — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the derivatives_margin_health decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-656-derivatives-margin-workbench.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-656-derivatives-margin-workbench.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Derivatives Margin Workbench — attested computation

> §10.2 Attested Computation binding for [Derivatives Margin Workbench](../tools/art-656-derivatives-margin-workbench.md).

## Executor

Kernel source: `chaingraph/kernels/art-656-derivatives-margin-workbench.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:12fe0722a13260d84d8ad2e4644effe9aae35bb42957be78c22392364d0eef53` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
