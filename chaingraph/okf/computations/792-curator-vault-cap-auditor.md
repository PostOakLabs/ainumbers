---
type: Attested Computation
title: "Curator Vault Cap Auditor — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/792-curator-vault-cap-auditor.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/792-curator-vault-cap-auditor.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Curator Vault Cap Auditor — attested computation

> §10.2 Attested Computation binding for [Curator Vault Cap Auditor](../tools/792-curator-vault-cap-auditor.md).

## Executor

Kernel source: `chaingraph/kernels/792-curator-vault-cap-auditor.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5c179330342a136524f4808a6f201ab22ba0f39015250bc42ef835c7cd944a1e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
