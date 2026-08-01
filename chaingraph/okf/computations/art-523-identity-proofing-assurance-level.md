---
type: Attested Computation
title: "Identity-Proofing Assurance Level Evaluator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-523-identity-proofing-assurance-level.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-523-identity-proofing-assurance-level.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Identity-Proofing Assurance Level Evaluator — attested computation

> §10.2 Attested Computation binding for [Identity-Proofing Assurance Level Evaluator](../tools/art-523-identity-proofing-assurance-level.md).

## Executor

Kernel source: `chaingraph/kernels/art-523-identity-proofing-assurance-level.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f691517dd02006a5787bea91055d22c567fb6049e1f3d15c3bb2a474032cd335` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
