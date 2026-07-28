---
type: Attested Computation
title: "CBAM Embedded-Emissions Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-69-cbam-embedded-emissions-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-69-cbam-embedded-emissions-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CBAM Embedded-Emissions Calculator — attested computation

> §10.2 Attested Computation binding for [CBAM Embedded-Emissions Calculator](../tools/art-69-cbam-embedded-emissions-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-69-cbam-embedded-emissions-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:41700ba84727c6ac4cb1f9fb130ed565723c48eb48cd03b94b3f3ac31e4d6f00` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
