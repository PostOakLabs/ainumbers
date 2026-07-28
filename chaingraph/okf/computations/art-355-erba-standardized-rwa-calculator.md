---
type: Attested Computation
title: "ERBA / Standardized RWA Calculator (Basel Endgame 2026) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the capital_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-355-erba-standardized-rwa-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-355-erba-standardized-rwa-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ERBA / Standardized RWA Calculator (Basel Endgame 2026) — attested computation

> §10.2 Attested Computation binding for [ERBA / Standardized RWA Calculator (Basel Endgame 2026)](../tools/art-355-erba-standardized-rwa-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-355-erba-standardized-rwa-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:99791def46ab9a59fb40a172849acf5aa989fe19c873d272759c2ddf8bcfd80d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
