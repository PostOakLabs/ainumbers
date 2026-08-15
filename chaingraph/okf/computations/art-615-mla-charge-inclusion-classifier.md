---
type: Attested Computation
title: "MLA Charge-Inclusion Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-615-mla-charge-inclusion-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-615-mla-charge-inclusion-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MLA Charge-Inclusion Classifier — attested computation

> §10.2 Attested Computation binding for [MLA Charge-Inclusion Classifier](../tools/art-615-mla-charge-inclusion-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-615-mla-charge-inclusion-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:89816e3e50a57991a0dc1ef768b3915ef88e0fad54e72319fdd72363c04680af` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
