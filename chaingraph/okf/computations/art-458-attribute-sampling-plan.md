---
type: Attested Computation
title: "Attribute Sampling Plan Generator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-458-attribute-sampling-plan.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-458-attribute-sampling-plan.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Attribute Sampling Plan Generator — attested computation

> §10.2 Attested Computation binding for [Attribute Sampling Plan Generator](../tools/art-458-attribute-sampling-plan.md).

## Executor

Kernel source: `chaingraph/kernels/art-458-attribute-sampling-plan.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5bcd64e2925ab483c805160229d7a37241e311140192cd080b09be6d358fec1b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
