---
type: Attested Computation
title: "FRTB IMA Expected Shortfall Pre-Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/rca-01-frtb-ima-pre-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/rca-01-frtb-ima-pre-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FRTB IMA Expected Shortfall Pre-Validator — attested computation

> §10.2 Attested Computation binding for [FRTB IMA Expected Shortfall Pre-Validator](../tools/rca-01-frtb-ima-pre-validator.md).

## Executor

Kernel source: `chaingraph/kernels/rca-01-frtb-ima-pre-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:da8805bcbfcd243d64f4bc2ac97f773b290fe8baa5a30fa7277e2d8c965506bb` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
