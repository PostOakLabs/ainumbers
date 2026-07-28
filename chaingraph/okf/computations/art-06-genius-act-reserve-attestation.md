---
type: Attested Computation
title: "GENIUS Act Reserve Attestation Pre-Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-06-genius-act-reserve-attestation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-06-genius-act-reserve-attestation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GENIUS Act Reserve Attestation Pre-Check — attested computation

> §10.2 Attested Computation binding for [GENIUS Act Reserve Attestation Pre-Check](../tools/art-06-genius-act-reserve-attestation.md).

## Executor

Kernel source: `chaingraph/kernels/art-06-genius-act-reserve-attestation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8e520c99a42e6c53799b4c14a5d31d7face65414f1d0fd590a089488f621dc24` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
