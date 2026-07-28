---
type: Attested Computation
title: "Agentic Payments Readiness Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-27-agentic-readiness-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-27-agentic-readiness-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agentic Payments Readiness Diagnostic — attested computation

> §10.2 Attested Computation binding for [Agentic Payments Readiness Diagnostic](../tools/art-27-agentic-readiness-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-27-agentic-readiness-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:722288a354cc971531c98d20232fd303c991b6adf4cae35f974a30d1e3a3e33a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
