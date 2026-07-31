---
type: Attested Computation
title: "CARF Status Message Disposition — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-505-dispose-carf-status-message.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-505-dispose-carf-status-message.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CARF Status Message Disposition — attested computation

> §10.2 Attested Computation binding for [CARF Status Message Disposition](../tools/art-505-dispose-carf-status-message.md).

## Executor

Kernel source: `chaingraph/kernels/art-505-dispose-carf-status-message.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:035ab5ed297070b1f9a69babee5ab27760f0ac1404e3cc2f4383a6816ab39729` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
