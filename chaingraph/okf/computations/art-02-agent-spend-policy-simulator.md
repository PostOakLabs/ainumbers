---
type: Attested Computation
title: "Agent Spend-Policy Simulator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-02-agent-spend-policy-simulator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-02-agent-spend-policy-simulator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent Spend-Policy Simulator — attested computation

> §10.2 Attested Computation binding for [Agent Spend-Policy Simulator](../tools/art-02-agent-spend-policy-simulator.md).

## Executor

Kernel source: `chaingraph/kernels/art-02-agent-spend-policy-simulator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:236e163038383b05b4d5d18a1d3cf7d32a974a1035496ab1c00fbad3e84f412a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
