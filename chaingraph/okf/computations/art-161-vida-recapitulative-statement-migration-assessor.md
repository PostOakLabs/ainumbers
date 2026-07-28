---
type: Attested Computation
title: "ViDA Recapitulative Statement Migration Assessor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-161-vida-recapitulative-statement-migration-assessor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-161-vida-recapitulative-statement-migration-assessor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ViDA Recapitulative Statement Migration Assessor — attested computation

> §10.2 Attested Computation binding for [ViDA Recapitulative Statement Migration Assessor](../tools/art-161-vida-recapitulative-statement-migration-assessor.md).

## Executor

Kernel source: `chaingraph/kernels/art-161-vida-recapitulative-statement-migration-assessor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:057a79e66cb2603cd0a4c91cc179046b19ebe82956a4c3a37cf10e5a3ecd1cfb` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
