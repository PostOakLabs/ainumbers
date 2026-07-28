---
type: Attested Computation
title: "Tempo MPP Agent Mandate — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-36-tempo-mpp-agent-mandate.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-36-tempo-mpp-agent-mandate.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tempo MPP Agent Mandate — attested computation

> §10.2 Attested Computation binding for [Tempo MPP Agent Mandate](../tools/art-36-tempo-mpp-agent-mandate.md).

## Executor

Kernel source: `chaingraph/kernels/art-36-tempo-mpp-agent-mandate.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4967b7d4af80a186fa8374e13f61c4f6a14a94ef7f74474dc4fd840ddf488608` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
