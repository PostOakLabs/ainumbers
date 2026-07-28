---
type: Attested Computation
title: "Sanctions & Export-Control Screening Fit Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-90-sanctions-screening-fit-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-90-sanctions-screening-fit-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Sanctions & Export-Control Screening Fit Diagnostic — attested computation

> §10.2 Attested Computation binding for [Sanctions & Export-Control Screening Fit Diagnostic](../tools/art-90-sanctions-screening-fit-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-90-sanctions-screening-fit-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:38748fbbd98786a5c965a54c809622a7dd0d1f193507e321aa3ad9fa9f06c178` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
