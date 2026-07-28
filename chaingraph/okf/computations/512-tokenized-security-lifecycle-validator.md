---
type: Attested Computation
title: "Tokenized Security Lifecycle Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/512-tokenized-security-lifecycle-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/512-tokenized-security-lifecycle-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Tokenized Security Lifecycle Validator — attested computation

> §10.2 Attested Computation binding for [Tokenized Security Lifecycle Validator](../tools/512-tokenized-security-lifecycle-validator.md).

## Executor

Kernel source: `chaingraph/kernels/512-tokenized-security-lifecycle-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f17b5982d127f5ae1fcc3d3dc4be5844c49a6c73de4e12e41815b25215350270` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
