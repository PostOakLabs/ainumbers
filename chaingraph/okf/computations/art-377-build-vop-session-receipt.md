---
type: Attested Computation
title: "VoP Session Receipt Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-377-build-vop-session-receipt.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-377-build-vop-session-receipt.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# VoP Session Receipt Builder — attested computation

> §10.2 Attested Computation binding for [VoP Session Receipt Builder](../tools/art-377-build-vop-session-receipt.md).

## Executor

Kernel source: `chaingraph/kernels/art-377-build-vop-session-receipt.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0a05ff3c98289d522ac8c33f9348e44f835c6ace45f93a2e25e4fa6d7871f317` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
