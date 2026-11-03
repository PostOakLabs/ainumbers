---
type: Attested Computation
title: "HDHP vs. PPO Break-Even — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-758-hdhp-ppo-break-even.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-758-hdhp-ppo-break-even.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# HDHP vs. PPO Break-Even — attested computation

> §10.2 Attested Computation binding for [HDHP vs. PPO Break-Even](../tools/art-758-hdhp-ppo-break-even.md).

## Executor

Kernel source: `chaingraph/kernels/art-758-hdhp-ppo-break-even.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f7ee5d3baff235297d8382e1aae987363d0a062aa075b9ba66df59a826c5bdbe` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
