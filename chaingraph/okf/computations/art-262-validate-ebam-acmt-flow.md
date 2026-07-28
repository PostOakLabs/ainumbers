---
type: Attested Computation
title: "eBAM Account Message Flow Validation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-262-validate-ebam-acmt-flow.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-262-validate-ebam-acmt-flow.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# eBAM Account Message Flow Validation — attested computation

> §10.2 Attested Computation binding for [eBAM Account Message Flow Validation](../tools/art-262-validate-ebam-acmt-flow.md).

## Executor

Kernel source: `chaingraph/kernels/art-262-validate-ebam-acmt-flow.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4c2c59094077b7f535e7fc1557867c48c163b79d2f4ddf7a001b0d15daf4b1e5` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
