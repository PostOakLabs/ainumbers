---
type: Attested Computation
title: "PayPal Dispute Deadline & Evidence — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-776-paypal-dispute-deadline-evidence.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-776-paypal-dispute-deadline-evidence.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# PayPal Dispute Deadline & Evidence — attested computation

> §10.2 Attested Computation binding for [PayPal Dispute Deadline & Evidence](../tools/art-776-paypal-dispute-deadline-evidence.md).

## Executor

Kernel source: `chaingraph/kernels/art-776-paypal-dispute-deadline-evidence.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:eccdef3d5f7ca5483630fafd6531b68216f4f0bbab99b37885cc0f2c1a29b6f7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
