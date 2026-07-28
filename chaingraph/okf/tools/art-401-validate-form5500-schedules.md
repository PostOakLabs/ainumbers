---
type: DecisionTool
title: "ERISA Form 5500 Schedule Validator"
description: "Validates a Form 5500 schedule-applicability matrix (plan type and size determine required schedules H/I/A/C/G/MB/SB/R), a Schedule H cross-schedule arithmetic tie (ending assets equal beginning assets plus net income minus distributions), and the filing-deadline calculation (plan-year end plus seven months, with the Form 5558 two-and-a-half-month extension). This is form-lint -- structural schedule applicability and arithmetic -- not retirement or plan-design advice; it sits in the compliance-mechanics lane of the options-shelf constraint, not the advice lane. Part of the record-integrity family alongside lint_metro2_record (art-398), lint_x12_claim_records (art-399), and check_official_statement_completeness (art-400)."
resource: https://ainumbers.co/chaingraph/art-401-validate-form5500-schedules.html
tags: ["compliance_mandate", "wave-47", "mcp:validate_form5500_schedules"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-401-validate-form5500-schedules.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-401-validate-form5500-schedules.html
    title: "public tool page"
---

# ERISA Form 5500 Schedule Validator

> Exports a decision via MCP `validate_form5500_schedules` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-401-validate-form5500-schedules.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
