---
type: Attested Computation
title: "ViDA Compliance Readiness Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-164-vida-compliance-readiness-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-164-vida-compliance-readiness-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ViDA Compliance Readiness Diagnostic — attested computation

> §10.2 Attested Computation binding for [ViDA Compliance Readiness Diagnostic](../tools/art-164-vida-compliance-readiness-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-164-vida-compliance-readiness-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:574ee6c374f1501a9f75ec34933461c9ed1a9829b3d0882eba36dd0d3c1e93c4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
