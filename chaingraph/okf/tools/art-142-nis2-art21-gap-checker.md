---
type: DecisionTool
title: "NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)"
description: "Check presence and maturity of all ten NIS2 Article 21(2)(a)–(j) cybersecurity risk-management measures. Derives per-measure maturity (0=absent, 1=documented-only, 2=implemented, 3=implemented+tested), aggregates to compliance score 0–100 and grade A–F, emits critical-gap list and prioritised remediation list. Consumes art-141 scope verdict; feeds penalty exposure calculator art-143."
resource: https://ainumbers.co/chaingraph/art-142-nis2-art21-gap-checker.html
tags: ["compliance_mandate", "wave-26", "mcp:check_nis2_art21_measures"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-142-nis2-art21-gap-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-142-nis2-art21-gap-checker.html
    title: "public tool page"
---

# NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)

> Exports a decision via MCP `check_nis2_art21_measures` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-142-nis2-art21-gap-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope)](./art-141-nis2-entity-scope-classifier.md)

**Feeds:** [NIS2 Penalty Exposure Calculator (Art. 34)](./art-143-nis2-penalty-exposure-calculator.md)
