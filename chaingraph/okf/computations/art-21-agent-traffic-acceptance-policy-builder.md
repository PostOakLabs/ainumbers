---
type: Attested Computation
title: "Agent-Traffic Acceptance Policy Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-21-agent-traffic-acceptance-policy-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-21-agent-traffic-acceptance-policy-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent-Traffic Acceptance Policy Builder — attested computation

> §10.2 Attested Computation binding for [Agent-Traffic Acceptance Policy Builder](../tools/art-21-agent-traffic-acceptance-policy-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-21-agent-traffic-acceptance-policy-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6243000aa7fa78f35081606c6c9c5dd114268e7a28e879dcb7f96f2be704cd76` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
