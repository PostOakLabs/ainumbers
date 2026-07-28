---
type: Attested Computation
title: "TFR Travel-Rule Batch Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-104-tfr-travel-rule-batch-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-104-tfr-travel-rule-batch-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TFR Travel-Rule Batch Validator — attested computation

> §10.2 Attested Computation binding for [TFR Travel-Rule Batch Validator](../tools/art-104-tfr-travel-rule-batch-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-104-tfr-travel-rule-batch-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5d9d7105b7d6a2e1265f3c02ee2c2b2bb573c7d0e5fc816dac04771392117b30` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
