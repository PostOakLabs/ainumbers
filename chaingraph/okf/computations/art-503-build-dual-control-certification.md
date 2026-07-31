---
type: Attested Computation
title: "Dual Control Certification Evidence — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-503-build-dual-control-certification.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-503-build-dual-control-certification.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Dual Control Certification Evidence — attested computation

> §10.2 Attested Computation binding for [Dual Control Certification Evidence](../tools/art-503-build-dual-control-certification.md).

## Executor

Kernel source: `chaingraph/kernels/art-503-build-dual-control-certification.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a57bc96bcfdea16261374e636c9a22668fd91415abc1e441540e6d48306026b0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
