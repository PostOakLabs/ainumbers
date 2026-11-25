---
type: Attested Computation
title: "Diff Evidence Bundles — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-750-diff-evidence-bundles.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-750-diff-evidence-bundles.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Diff Evidence Bundles — attested computation

> §10.2 Attested Computation binding for [Diff Evidence Bundles](../tools/art-750-diff-evidence-bundles.md).

## Executor

Kernel source: `chaingraph/kernels/art-750-diff-evidence-bundles.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:10f7f50fb12b12ed1dacfb63edeeee56fba0eb383eb6cb7ed6fa0cf347b26b58` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
