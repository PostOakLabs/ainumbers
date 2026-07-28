---
type: Attested Computation
title: "EUDR Geolocation Plot Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-166-eudr-geolocation-plot-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-166-eudr-geolocation-plot-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EUDR Geolocation Plot Validator — attested computation

> §10.2 Attested Computation binding for [EUDR Geolocation Plot Validator](../tools/art-166-eudr-geolocation-plot-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-166-eudr-geolocation-plot-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8f52903ef0106be3d988c08666ae2f0f87f7e1b19703d6d8c0a4dcfe6fd3079e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
