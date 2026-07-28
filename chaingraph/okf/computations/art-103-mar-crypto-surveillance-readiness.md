---
type: Attested Computation
title: "MAR-Crypto Surveillance-Readiness Assessor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-103-mar-crypto-surveillance-readiness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-103-mar-crypto-surveillance-readiness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MAR-Crypto Surveillance-Readiness Assessor — attested computation

> §10.2 Attested Computation binding for [MAR-Crypto Surveillance-Readiness Assessor](../tools/art-103-mar-crypto-surveillance-readiness.md).

## Executor

Kernel source: `chaingraph/kernels/art-103-mar-crypto-surveillance-readiness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ccfc18748b7ec8fa614b64c2704c277dbf6424b1634d54850f579057588da7a9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
