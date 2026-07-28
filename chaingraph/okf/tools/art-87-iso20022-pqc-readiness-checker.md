---
type: DecisionTool
title: "SWIFT / ISO 20022 PQC Readiness Checker"
description: "Scores SWIFT/ISO 20022 PQC readiness with BAH signature-bloat sizing per the BIS Project Leap Phase 2 model (ML-DSA ~12.9x RSA payload at BAH level). Models new message sizes against current limits and flags size breaches. Reuses HNDL priority from tool 500."
resource: https://ainumbers.co/chaingraph/art-87-iso20022-pqc-readiness-checker.html
tags: ["compliance_mandate", "wave-18", "mcp:check_iso20022_pqc_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-87-iso20022-pqc-readiness-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-87-iso20022-pqc-readiness-checker.html
    title: "public tool page"
---

# SWIFT / ISO 20022 PQC Readiness Checker

> Exports a decision via MCP `check_iso20022_pqc_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-87-iso20022-pqc-readiness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [PQC Timeline & Migration Fit Diagnostic](./art-85-pqc-timeline-fit-diagnostic.md), `500-hndl-quantum-risk-scorer` _(not live)_

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-87-iso20022-pqc-readiness-checker.md) — §10.2.
