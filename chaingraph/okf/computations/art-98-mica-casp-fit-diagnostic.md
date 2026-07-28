---
type: Attested Computation
title: "MiCA CASP Fit Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-98-mica-casp-fit-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-98-mica-casp-fit-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MiCA CASP Fit Diagnostic — attested computation

> §10.2 Attested Computation binding for [MiCA CASP Fit Diagnostic](../tools/art-98-mica-casp-fit-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-98-mica-casp-fit-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f3a4a041f414fd77b5a45a8fa5814804ca22ab1df00e883c54a47a0d3d676035` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
