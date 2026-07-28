---
type: Attested Computation
title: "T+1 Settlement Readiness Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-77-t1-settlement-readiness-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-77-t1-settlement-readiness-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# T+1 Settlement Readiness Diagnostic — attested computation

> §10.2 Attested Computation binding for [T+1 Settlement Readiness Diagnostic](../tools/art-77-t1-settlement-readiness-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-77-t1-settlement-readiness-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3152f3bd790393117c348ef2ecfd1f0eab68504808ece058103511bd988c616d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
