---
type: Attested Computation
title: "Consent-Order / MRA Remediation Closure Register — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-533-mra-remediation-closure-register.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-533-mra-remediation-closure-register.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Consent-Order / MRA Remediation Closure Register — attested computation

> §10.2 Attested Computation binding for [Consent-Order / MRA Remediation Closure Register](../tools/art-533-mra-remediation-closure-register.md).

## Executor

Kernel source: `chaingraph/kernels/art-533-mra-remediation-closure-register.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ccad868f81e724e7e30de59a9c955f7ba8c69d690fe04fbc6b3984f0e9352f5a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
