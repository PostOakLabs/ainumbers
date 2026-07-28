---
type: Attested Computation
title: "EMIR Reconciliation Break Ageing — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-483-emir-break-ageing.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-483-emir-break-ageing.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EMIR Reconciliation Break Ageing — attested computation

> §10.2 Attested Computation binding for [EMIR Reconciliation Break Ageing](../tools/art-483-emir-break-ageing.md).

## Executor

Kernel source: `chaingraph/kernels/art-483-emir-break-ageing.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:61ca7bf25c81b012ffcf0eacf2a531f340641c6492b4f96ad95b2e17faab1a11` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
