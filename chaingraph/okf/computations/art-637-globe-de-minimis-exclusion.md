---
type: Attested Computation
title: "GloBE Permanent De Minimis Exclusion Evaluator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-637-globe-de-minimis-exclusion.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-637-globe-de-minimis-exclusion.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE Permanent De Minimis Exclusion Evaluator — attested computation

> §10.2 Attested Computation binding for [GloBE Permanent De Minimis Exclusion Evaluator](../tools/art-637-globe-de-minimis-exclusion.md).

## Executor

Kernel source: `chaingraph/kernels/art-637-globe-de-minimis-exclusion.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6c793bc89b2393ccb5f62dc4970e46c0ca508f47b414fa7fe925237690106ec1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
