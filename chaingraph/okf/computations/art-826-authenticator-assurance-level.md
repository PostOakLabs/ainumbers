---
type: Attested Computation
title: "Authenticator Assurance Level Evaluator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-826-authenticator-assurance-level.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-826-authenticator-assurance-level.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Authenticator Assurance Level Evaluator — attested computation

> §10.2 Attested Computation binding for [Authenticator Assurance Level Evaluator](../tools/art-826-authenticator-assurance-level.md).

## Executor

Kernel source: `chaingraph/kernels/art-826-authenticator-assurance-level.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:753097999c8df944333000a9093ba2448c0aec45306ed0f6aa21d19d8f437227` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
