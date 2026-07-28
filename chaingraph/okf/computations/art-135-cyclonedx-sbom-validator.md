---
type: Attested Computation
title: "CycloneDX SBOM Validator (EU CRA Annex I) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-135-cyclonedx-sbom-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-135-cyclonedx-sbom-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CycloneDX SBOM Validator (EU CRA Annex I) — attested computation

> §10.2 Attested Computation binding for [CycloneDX SBOM Validator (EU CRA Annex I)](../tools/art-135-cyclonedx-sbom-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-135-cyclonedx-sbom-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3f160ab65134e8918e39f71151aed591c8cd27e82ed90f22cff146f7fa75fcd1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
