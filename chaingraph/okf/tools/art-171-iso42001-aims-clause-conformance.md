---
type: DecisionTool
title: "ISO 42001 AIMS Clause Conformance"
description: "Assess ISO/IEC 42001 AIMS conformance across clauses 4-10 (context, leadership, planning, support, operation, evaluation, improvement) and six Annex A controls (AI policy, roles, impact assessment, data governance, system lifecycle, third-party supplier management). Scores each as present (1.0), partial (0.5), or absent (0) and returns overall_maturity (0-100), maturity_band (Initial/Developing/Defined/Managed/Optimizing), and a structured gap list. Root node of the ai-management-system-conformance chain. §16 proof candidate. Zero network, zero PII. ISO/IEC 42001:2023."
resource: https://ainumbers.co/chaingraph/art-171-iso42001-aims-clause-conformance.html
tags: ["compliance_mandate", "wave-31", "mcp:assess_iso42001_aims_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-171-iso42001-aims-clause-conformance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-171-iso42001-aims-clause-conformance.html
    title: "public tool page"
---

# ISO 42001 AIMS Clause Conformance

> Exports a decision via MCP `assess_iso42001_aims_conformance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-171-iso42001-aims-clause-conformance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [AI Risk Impact Assessment Validator](./art-172-ai-risk-impact-assessment-validator.md)

## Attested computation

[executor + attester binding](../computations/art-171-iso42001-aims-clause-conformance.md) — §10.2.
