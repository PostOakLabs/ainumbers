---
type: DecisionTool
title: "EMIR Reporting Readiness Diagnostic"
description: "Grade a firm EMIR Refit reporting readiness across five dimensions: ISO 20022 format cutover, UPI sourcing via ANNA DSB, UTI sharing SLA (10:00 CET T+1), reconciliation tolerance configuration (148-field set, 2026 escalation), and lifecycle action-type controls. Returns an A-F grade and a gap list. Terminal node of the emir-reconciliation-and-lifecycle chain; exports readiness attestation with execution_hash."
resource: https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html
tags: ["compliance_mandate", "wave-28", "mcp:run_emir_reporting_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-158-emir-reporting-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html
    title: "public tool page"
---

# EMIR Reporting Readiness Diagnostic

> Exports a decision via MCP `run_emir_reporting_fit` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EMIR Lifecycle Event Validator](./art-157-emir-lifecycle-event-validator.md)

**Feeds:** _terminal node_
