---
type: Attested Computation
title: "Securitization Trustee-Report Waterfall Recomputation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-568-securitization-trustee-report-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-568-securitization-trustee-report-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Securitization Trustee-Report Waterfall Recomputation — attested computation

> §10.2 Attested Computation binding for [Securitization Trustee-Report Waterfall Recomputation](../tools/art-568-securitization-trustee-report-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-568-securitization-trustee-report-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d055891899f36887772e5e5edccb200703d03fa965edd3ea178f6c6933e98578` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
