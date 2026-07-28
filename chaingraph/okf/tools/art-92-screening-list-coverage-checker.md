---
type: DecisionTool
title: "Screening List-Coverage Checker"
description: "Conformance check: validates a screening config against the required-coverage matrix for EU consolidated + UN + UK Sanctions List (post-OFSI-closure 28 Jan 2026) + OFAC SDN with correct jurisdictional-nexus gating."
resource: https://ainumbers.co/chaingraph/art-92-screening-list-coverage-checker.html
tags: ["compliance_mandate", "wave-19", "mcp:check_screening_list_coverage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-92-screening-list-coverage-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-92-screening-list-coverage-checker.html
    title: "public tool page"
---

# Screening List-Coverage Checker

> Exports a decision via MCP `check_screening_list_coverage` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-92-screening-list-coverage-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Sanctions & Export-Control Screening Fit Diagnostic](./art-90-sanctions-screening-fit-diagnostic.md), [Ownership 50%-Rule Aggregator](./art-91-ownership-50pct-aggregator.md)

**Feeds:** [Sanctions Screening-Program Quality Scorer](./art-97-sanctions-screening-quality-scorer.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-92-screening-list-coverage-checker.md) — §10.2.
