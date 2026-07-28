---
type: Attested Computation
title: "Agentic AI Risk & GPAI Governance Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-67-agentic-ai-risk-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-67-agentic-ai-risk-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agentic AI Risk & GPAI Governance Classifier — attested computation

> §10.2 Attested Computation binding for [Agentic AI Risk & GPAI Governance Classifier](../tools/art-67-agentic-ai-risk-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-67-agentic-ai-risk-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e54de58d609e2ca40d3ef029fc40d7560ae0d23ce483dc067fbe7ed9f60165af` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
