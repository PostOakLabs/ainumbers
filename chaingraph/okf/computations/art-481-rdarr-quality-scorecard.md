---
type: Attested Computation
title: "RDARR Quality Scorecard — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-481-rdarr-quality-scorecard.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-481-rdarr-quality-scorecard.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# RDARR Quality Scorecard — attested computation

> §10.2 Attested Computation binding for [RDARR Quality Scorecard](../tools/art-481-rdarr-quality-scorecard.md).

## Executor

Kernel source: `chaingraph/kernels/art-481-rdarr-quality-scorecard.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bb595b3096e163a13b9265cd83ed691343605e21a5fcb974aa04fdc9292c38ba` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
