---
type: Attested Computation
title: "Tempo Zone Selective-Disclosure Attestation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-39-tempo-zone-disclosure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-39-tempo-zone-disclosure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo Zone Selective-Disclosure Attestation — attested computation

> §10.2 Attested Computation binding for [Tempo Zone Selective-Disclosure Attestation](../tools/art-39-tempo-zone-disclosure.md).

## Executor

Kernel source: `chaingraph/kernels/art-39-tempo-zone-disclosure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:05bec4999682594eba3e6bccae123325059131b7d46c30a259ce4f0037610adf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
