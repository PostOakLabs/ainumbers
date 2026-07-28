---
type: Attested Computation
title: "FICC-CME Cross-Margining Estimator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-51-cross-margining-benefit-estimator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-51-cross-margining-benefit-estimator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FICC-CME Cross-Margining Estimator — attested computation

> §10.2 Attested Computation binding for [FICC-CME Cross-Margining Estimator](../tools/art-51-cross-margining-benefit-estimator.md).

## Executor

Kernel source: `chaingraph/kernels/art-51-cross-margining-benefit-estimator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:830bc39ca270ab8fec28d7bbd220b84a37787e3dfc4e61110e95816a63d70da1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
