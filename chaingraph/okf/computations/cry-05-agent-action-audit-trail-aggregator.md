---
type: Attested Computation
title: "Agent-Action Audit-Trail Aggregator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the cryptographic_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/cry-05-agent-action-audit-trail-aggregator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/cry-05-agent-action-audit-trail-aggregator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent-Action Audit-Trail Aggregator — attested computation

> §10.2 Attested Computation binding for [Agent-Action Audit-Trail Aggregator](../tools/cry-05-agent-action-audit-trail-aggregator.md).

## Executor

Kernel source: `chaingraph/kernels/cry-05-agent-action-audit-trail-aggregator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5f7f6ab0bb2e2b736805ecde518ca59ba9a83ad38b17545a8c7c133cffa1481f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
