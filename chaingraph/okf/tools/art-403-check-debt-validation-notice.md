---
type: DecisionTool
title: "Debt Validation Notice Completeness Checker"
description: "Checks a debt-validation-notice content-element checklist against Regulation F 12 CFR 1006.34 (the Model Form B-1 element set) and computes the 30-day validation-period response-window math from a declared mailing date under a declared mailing-to-receipt assumption. Same present/absent checklist shape as the shipped official-statement / Metro2 / X12 linters. Checks that declared elements are present and well-formed, not that disclosed amounts are accurate."
resource: https://ainumbers.co/chaingraph/art-403-check-debt-validation-notice.html
tags: ["compliance_mandate", "wave-60", "mcp:check_debt_validation_notice"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-403-check-debt-validation-notice.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-403-check-debt-validation-notice.html
    title: "public tool page"
---

# Debt Validation Notice Completeness Checker

> Exports a decision via MCP `check_debt_validation_notice` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-403-check-debt-validation-notice.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Reg F Call-Frequency Presumption Validator](./art-402-validate-regf-call-frequency.md)

**Feeds:** _terminal node_
