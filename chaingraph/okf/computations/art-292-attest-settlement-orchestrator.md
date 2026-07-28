---
type: Attested Computation
title: "Settlement Orchestrator Attestation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the infrastructure_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-292-attest-settlement-orchestrator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-292-attest-settlement-orchestrator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Settlement Orchestrator Attestation — attested computation

> §10.2 Attested Computation binding for [Settlement Orchestrator Attestation](../tools/art-292-attest-settlement-orchestrator.md).

## Executor

Kernel source: `chaingraph/kernels/art-292-attest-settlement-orchestrator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4e7ce5129e31667f5c70ae5a5beb2d34564f5217b8e87133a8732f2bfdfee90d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
