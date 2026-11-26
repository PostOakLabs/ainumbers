---
type: Attested Computation
title: "ISA 530 Audit Sampling + MUS — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-693-isa530-audit-sampling-mus.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-693-isa530-audit-sampling-mus.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ISA 530 Audit Sampling + MUS — attested computation

> §10.2 Attested Computation binding for [ISA 530 Audit Sampling + MUS](../tools/art-693-isa530-audit-sampling-mus.md).

## Executor

Kernel source: `chaingraph/kernels/art-693-isa530-audit-sampling-mus.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4a0de636bbeea81172cf57d31a081cb364e22b340318c644ffe74461dde4a53c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
