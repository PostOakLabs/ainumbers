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

Kernel identity: `sha256:e62a92dde406825f63c0b95978cb5a1070ed19f539f9c3a665a53cd2257c5ee0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
