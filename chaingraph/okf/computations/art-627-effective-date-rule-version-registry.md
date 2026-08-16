---
type: Attested Computation
title: "Effective-Date / Rule-Version Registry — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-627-effective-date-rule-version-registry.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-627-effective-date-rule-version-registry.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Effective-Date / Rule-Version Registry — attested computation

> §10.2 Attested Computation binding for [Effective-Date / Rule-Version Registry](../tools/art-627-effective-date-rule-version-registry.md).

## Executor

Kernel source: `chaingraph/kernels/art-627-effective-date-rule-version-registry.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:64836000e9e411175a31ce378e45f464cb8dc8f398ed04f409d94f764265cfe5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
