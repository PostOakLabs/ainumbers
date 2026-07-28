---
type: Attested Computation
title: "FHA MIP Eligibility Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-224-fha-mip-eligibility.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-224-fha-mip-eligibility.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FHA MIP Eligibility Calculator — attested computation

> §10.2 Attested Computation binding for [FHA MIP Eligibility Calculator](../tools/art-224-fha-mip-eligibility.md).

## Executor

Kernel source: `chaingraph/kernels/art-224-fha-mip-eligibility.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0188afefdc40d10dd5d1058b02fdf32126f50994c6cdfc0389f7e1cf93cfe295` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
