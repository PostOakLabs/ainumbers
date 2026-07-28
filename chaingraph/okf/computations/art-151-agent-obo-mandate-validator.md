---
type: Attested Computation
title: "Agent On-Behalf-Of (OBO) Mandate Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-151-agent-obo-mandate-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-151-agent-obo-mandate-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agent On-Behalf-Of (OBO) Mandate Validator — attested computation

> §10.2 Attested Computation binding for [Agent On-Behalf-Of (OBO) Mandate Validator](../tools/art-151-agent-obo-mandate-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-151-agent-obo-mandate-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3e6402dbb86314d81a2323ad9509ad6ea85359eeaed521b4442a944f53a4ad54` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
