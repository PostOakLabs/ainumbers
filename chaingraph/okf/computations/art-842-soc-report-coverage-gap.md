---
type: Attested Computation
title: "SOC Report Coverage and Bridge Gap — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-842-soc-report-coverage-gap.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-842-soc-report-coverage-gap.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# SOC Report Coverage and Bridge Gap — attested computation

> §10.2 Attested Computation binding for [SOC Report Coverage and Bridge Gap](../tools/art-842-soc-report-coverage-gap.md).

## Executor

Kernel source: `chaingraph/kernels/art-842-soc-report-coverage-gap.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cec65d5341087b8568d3736ff418a994c1b1fd26503e4d8e6ae55f2c62ea6a33` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
