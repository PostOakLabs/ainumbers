---
type: Attested Computation
title: "EIP-7702 Authorization-Tuple Decoder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-614-eip7702-authorization-tuple-decoder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-614-eip7702-authorization-tuple-decoder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EIP-7702 Authorization-Tuple Decoder — attested computation

> §10.2 Attested Computation binding for [EIP-7702 Authorization-Tuple Decoder](../tools/art-614-eip7702-authorization-tuple-decoder.md).

## Executor

Kernel source: `chaingraph/kernels/art-614-eip7702-authorization-tuple-decoder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:554841b60cdb4e6996f4083fe52c09e3c903610c5e4b31c6936f2ad3c77e32a8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
