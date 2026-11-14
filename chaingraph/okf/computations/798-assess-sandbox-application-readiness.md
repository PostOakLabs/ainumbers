---
type: Attested Computation
title: "Assess Sandbox Application Readiness — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/798-assess-sandbox-application-readiness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/798-assess-sandbox-application-readiness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Assess Sandbox Application Readiness — attested computation

> §10.2 Attested Computation binding for [Assess Sandbox Application Readiness](../tools/798-assess-sandbox-application-readiness.md).

## Executor

Kernel source: `chaingraph/kernels/798-assess-sandbox-application-readiness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1baf99ad45ac55bbd6ee95ff9e3f6cd47197a717cce1ab82bab0271f4df4a827` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
