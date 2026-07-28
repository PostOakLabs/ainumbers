---
type: Attested Computation
title: "Time-Series Anomaly Detector — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/ml-03-timeseries-anomaly-detector.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/ml-03-timeseries-anomaly-detector.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Time-Series Anomaly Detector — attested computation

> §10.2 Attested Computation binding for [Time-Series Anomaly Detector](../tools/ml-03-timeseries-anomaly-detector.md).

## Executor

Kernel source: `chaingraph/kernels/ml-03-timeseries-anomaly-detector.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ae20b291caf5eac025d4e7103782427565fe7cf0c99f4045122257c87db0d9c6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
