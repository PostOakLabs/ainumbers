---
type: Attested Computation
title: "C2PA Content Credential Manifest Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-123-c2pa-manifest-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-123-c2pa-manifest-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# C2PA Content Credential Manifest Validator — attested computation

> §10.2 Attested Computation binding for [C2PA Content Credential Manifest Validator](../tools/art-123-c2pa-manifest-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-123-c2pa-manifest-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:57b6f19cdf64a9288e4ff13b21078dce42b714bd0e9596f5be911756fe634bce` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
