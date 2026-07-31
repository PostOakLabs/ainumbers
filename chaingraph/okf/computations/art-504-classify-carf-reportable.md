---
type: Attested Computation
title: "CARF / DAC8 Reportable User Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-504-classify-carf-reportable.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-504-classify-carf-reportable.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CARF / DAC8 Reportable User Classifier — attested computation

> §10.2 Attested Computation binding for [CARF / DAC8 Reportable User Classifier](../tools/art-504-classify-carf-reportable.md).

## Executor

Kernel source: `chaingraph/kernels/art-504-classify-carf-reportable.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7092917c1c069bc0681a899f7807db3b1927a96accc5ac068fee5faa0d0f19dc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
