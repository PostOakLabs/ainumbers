---
type: Attested Computation
title: "Arc Partner Stablecoin Onboarding Conformance — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-110-arc-partner-stablecoin-onboarding.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-110-arc-partner-stablecoin-onboarding.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Arc Partner Stablecoin Onboarding Conformance — attested computation

> §10.2 Attested Computation binding for [Arc Partner Stablecoin Onboarding Conformance](../tools/art-110-arc-partner-stablecoin-onboarding.md).

## Executor

Kernel source: `chaingraph/kernels/art-110-arc-partner-stablecoin-onboarding.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4c76567c95da056626e68881f858c95c745ad333d94f0fbe078b53ac95ca3f49` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
