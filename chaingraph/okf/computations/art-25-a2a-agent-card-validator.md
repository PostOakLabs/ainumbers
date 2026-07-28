---
type: Attested Computation
title: "A2A Agent Card Validator & Extension Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-25-a2a-agent-card-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-25-a2a-agent-card-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# A2A Agent Card Validator & Extension Checker — attested computation

> §10.2 Attested Computation binding for [A2A Agent Card Validator & Extension Checker](../tools/art-25-a2a-agent-card-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-25-a2a-agent-card-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:31f05f94d1769d1602bf8a182a0c58acbc94caa2292ed294d99233f5ba0d3e1b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
