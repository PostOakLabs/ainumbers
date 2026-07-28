---
type: Attested Computation
title: "Agent Insurability Evidence Scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-306-agent-insurability-evidence-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-306-agent-insurability-evidence-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent Insurability Evidence Scorer — attested computation

> §10.2 Attested Computation binding for [Agent Insurability Evidence Scorer](../tools/art-306-agent-insurability-evidence-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-306-agent-insurability-evidence-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f50363027fceb9b9a98ba34c1f35c4327444cc91359d34e351167d15f2812013` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
