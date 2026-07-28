---
type: Attested Computation
title: "EN 16931 / Factur-X E-Invoicing Batch Validator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-08-en16931-einvoice-batch-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-08-en16931-einvoice-batch-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EN 16931 / Factur-X E-Invoicing Batch Validator — attested computation

> §10.2 Attested Computation binding for [EN 16931 / Factur-X E-Invoicing Batch Validator](../tools/art-08-en16931-einvoice-batch-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-08-en16931-einvoice-batch-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2ae638995633cb25dd6ef2c645f6246c8aef863054019213ba1424a7509c4c7e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
