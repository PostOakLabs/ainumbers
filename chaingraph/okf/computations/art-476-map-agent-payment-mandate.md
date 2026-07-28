---
type: Attested Computation
title: "Agent Payment Mandate Cross-Protocol Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-476-map-agent-payment-mandate.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-476-map-agent-payment-mandate.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent Payment Mandate Cross-Protocol Mapper — attested computation

> §10.2 Attested Computation binding for [Agent Payment Mandate Cross-Protocol Mapper](../tools/art-476-map-agent-payment-mandate.md).

## Executor

Kernel source: `chaingraph/kernels/art-476-map-agent-payment-mandate.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a10219350fc810ab2fc5e6acfec6cad91e855e0b0c493b1e518b3fcc04a2e07d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
