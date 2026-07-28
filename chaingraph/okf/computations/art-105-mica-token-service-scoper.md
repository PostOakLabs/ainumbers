---
type: Attested Computation
title: "MiCA Token & Service Scoper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-105-mica-token-service-scoper.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-105-mica-token-service-scoper.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MiCA Token & Service Scoper — attested computation

> §10.2 Attested Computation binding for [MiCA Token & Service Scoper](../tools/art-105-mica-token-service-scoper.md).

## Executor

Kernel source: `chaingraph/kernels/art-105-mica-token-service-scoper.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d0eebd3034d330eb5b1a17311674632a9254db5a191bde8f9508ca7f16d2b615` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
