---
type: Attested Computation
title: "E-Invoice Jurisdiction Mandate Router — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-295-einvoice-jurisdiction-mandate-router.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-295-einvoice-jurisdiction-mandate-router.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# E-Invoice Jurisdiction Mandate Router — attested computation

> §10.2 Attested Computation binding for [E-Invoice Jurisdiction Mandate Router](../tools/art-295-einvoice-jurisdiction-mandate-router.md).

## Executor

Kernel source: `chaingraph/kernels/art-295-einvoice-jurisdiction-mandate-router.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0b10eacc01a0d809c04d6f3548e9c09c589eb0eeb330672b8dfaab9877cd9d20` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
