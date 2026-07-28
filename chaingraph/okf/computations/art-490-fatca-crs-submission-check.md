---
type: Attested Computation
title: "FATCA/CRS Submission Conformance Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-490-fatca-crs-submission-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-490-fatca-crs-submission-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FATCA/CRS Submission Conformance Check — attested computation

> §10.2 Attested Computation binding for [FATCA/CRS Submission Conformance Check](../tools/art-490-fatca-crs-submission-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-490-fatca-crs-submission-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ff7382928e6f04fd05ef9d458b2681f0d86180f02468157ccfa443450eca1d01` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
