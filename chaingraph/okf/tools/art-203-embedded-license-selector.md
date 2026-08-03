---
type: DecisionTool
title: "Embedded License Selector"
description: "Maps creator answers to the SolSea and ALL.ART 4-tier embedded-license menu: Private/No Commercial, Personal/Public Display/No Commercial, Public Display/No Commercial, or Reproduction/Commercial. Outputs the elected tier id, label, rights vector, decision path, and source citation. Not legal advice. Selection only."
resource: https://ainumbers.co/chaingraph/art-203-embedded-license-selector.html
tags: ["compliance_mandate", "wave-35", "mcp:select_embedded_license"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-203-embedded-license-selector.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-203-embedded-license-selector.html
    title: "public tool page"
---

# Embedded License Selector

> Exports a decision via MCP `select_embedded_license` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-203-embedded-license-selector.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Cross-License Rights Comparator](./art-198-cross-license-rights-comparator.md)

**Feeds:** [License Compatibility Checker](./art-204-license-compatibility-checker.md)

## Attested computation

[executor + attester binding](../computations/art-203-embedded-license-selector.md) — §10.2.
