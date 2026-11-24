---
type: Attested Computation
title: "Murabahah Tawarruq Sequence Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-855-murabahah-tawarruq-sequence.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-855-murabahah-tawarruq-sequence.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Murabahah Tawarruq Sequence Check — attested computation

> §10.2 Attested Computation binding for [Murabahah Tawarruq Sequence Check](../tools/art-855-murabahah-tawarruq-sequence.md).

## Executor

Kernel source: `chaingraph/kernels/art-855-murabahah-tawarruq-sequence.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ae0813958a65cbb0eea09d40577d332d8482f1a84057c43830c4ae23aaef62a5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
