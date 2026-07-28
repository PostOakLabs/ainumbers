---
type: DecisionTool
title: "NIS2 Penalty Exposure Calculator (Art. 34)"
description: "Calculate maximum NIS2 Art. 34 penalty exposure given entity classification, global annual turnover, and declared infringement types. Essential entities: max(€10M, 2% global turnover); important: max(€7M, 1.4%). Applies mitigating-factor reduction (10% per factor, floor 30% of max). Emits maximum penalty, turnover-pct exposure, and mitigated estimate. Terminal stage of nis2-entity-scope-and-obligations chain."
resource: https://ainumbers.co/chaingraph/art-143-nis2-penalty-exposure-calculator.html
tags: ["compliance_mandate", "wave-26", "mcp:calculate_nis2_penalty_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-143-nis2-penalty-exposure-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-143-nis2-penalty-exposure-calculator.html
    title: "public tool page"
---

# NIS2 Penalty Exposure Calculator (Art. 34)

> Exports a decision via MCP `calculate_nis2_penalty_exposure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-143-nis2-penalty-exposure-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)](./art-142-nis2-art21-gap-checker.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-143-nis2-penalty-exposure-calculator.md) — §10.2.
